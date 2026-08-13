// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IBrokerRegistry } from "./interfaces/IProtocol.sol";
import { ProtocolAccess, SafeTransferLib } from "./lib/ProtocolAccess.sol";

contract CommissionAccounting is ProtocolAccess, SafeTransferLib {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
    uint16 public constant BPS = 10_000;
    uint16 public constant MAX_PLATFORM_BPS = 2_000;

    IBrokerRegistry public registry;
    address public treasury;
    uint16 public platformBps;
    mapping(uint256 => mapping(address => uint256)) public brokerClaimable;
    mapping(address => uint256) public treasuryClaimable;
    mapping(address => uint256) public totalAccounted;

    event FeeRecorded(
        uint256 indexed brokerId,
        address indexed token,
        uint256 gross,
        uint256 brokerShare,
        uint256 platformShare
    );
    event BrokerClaimed(
        uint256 indexed brokerId, address indexed token, address indexed to, uint256 amount
    );
    event TreasuryClaimed(address indexed token, uint256 amount);
    error InvalidFee();
    error NothingToClaim();

    function initialize(
        address admin,
        address guardian,
        address registry_,
        address treasury_,
        uint16 platformBps_,
        uint64 upgradeDelaySeconds
    ) external {
        _initializeAccess(admin, guardian, upgradeDelaySeconds);
        if (registry_.code.length == 0 || treasury_ == address(0)) revert InvalidAddress();
        if (platformBps_ > MAX_PLATFORM_BPS) revert InvalidFee();
        registry = IBrokerRegistry(registry_);
        treasury = treasury_;
        platformBps = platformBps_;
    }

    function recordFee(uint256 brokerId, address token, uint256 grossFee)
        external
        onlyRole(RECORDER_ROLE)
        whenNotPaused
    {
        if (!registry.isActive(brokerId) || grossFee == 0) revert InvalidFee();
        uint256 platform = grossFee * platformBps / BPS;
        uint256 broker = grossFee - platform;
        brokerClaimable[brokerId][token] += broker;
        treasuryClaimable[token] += platform;
        totalAccounted[token] += grossFee;
        emit FeeRecorded(brokerId, token, grossFee, broker, platform);
    }

    function claimBroker(uint256 brokerId, address token, address to)
        external
        nonReentrant
        returns (uint256 amount)
    {
        if (to == address(0)) revert InvalidAddress();
        if (
            registry.controllerOf(brokerId) != msg.sender
                && registry.accountOf(brokerId) != msg.sender
        ) {
            revert Unauthorized();
        }
        amount = brokerClaimable[brokerId][token];
        if (amount == 0) revert NothingToClaim();
        brokerClaimable[brokerId][token] = 0;
        totalAccounted[token] -= amount;
        _safeTransfer(token, to, amount);
        emit BrokerClaimed(brokerId, token, to, amount);
    }

    function claimTreasury(address token) external nonReentrant {
        if (msg.sender != treasury) revert Unauthorized();
        uint256 amount = treasuryClaimable[token];
        if (amount == 0) revert NothingToClaim();
        treasuryClaimable[token] = 0;
        totalAccounted[token] -= amount;
        _safeTransfer(token, treasury, amount);
        emit TreasuryClaimed(token, amount);
    }

    function setPlatformBps(uint16 newBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newBps > MAX_PLATFORM_BPS) revert InvalidFee();
        platformBps = newBps;
    }
}
