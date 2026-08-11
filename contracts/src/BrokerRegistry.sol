// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BrokerVault } from "./BrokerVault.sol";
import { IERC6551Registry } from "./interfaces/IERC6551Registry.sol";
import { IERC721Owner } from "./interfaces/ITokenInterfaces.sol";
import { Ownable } from "./lib/Ownable.sol";
import { RobinhoodAssetRegistry } from "./RobinhoodAssetRegistry.sol";

/// @notice Connects an external broker NFT and its ERC-6551 account to one isolated brokerage vault.
contract BrokerRegistry is Ownable {
    error AlreadyRegistered();
    error InfrastructureNotConfigured();
    error InvalidAccount();
    error NotBrokerOwner();
    error OnlyBrokerNft();
    error OnlyHook();
    error OnlyVault();
    error UnknownBroker();

    struct Broker {
        address tokenBoundAccount;
        address vault;
        uint64 registeredAt;
        uint64 trades;
        uint256 aum;
        uint256 lifetimeVolume;
        uint256 lifetimeCommission;
        uint256 reputation;
    }

    IERC721Owner public immutable brokerNft;
    IERC6551Registry public immutable erc6551Registry;
    RobinhoodAssetRegistry public immutable assetRegistry;
    address public immutable accountImplementation;
    bytes32 public immutable accountSalt;
    uint256 public immutable nftChainId;

    address public router;
    address public bankerHook;
    uint256 public brokerCount;
    mapping(uint256 => Broker) public brokers;
    mapping(address => uint256) public brokerIdForVault;

    event InfrastructureConfigured(address indexed router, address indexed bankerHook);
    event BrokerRegistered(
        uint256 indexed brokerId, address indexed tokenBoundAccount, address indexed vault
    );
    event VaultAumChanged(uint256 indexed brokerId, uint256 newAum, bool increase, uint256 amount);
    event BrokerActivityRecorded(
        uint256 indexed brokerId,
        address indexed trader,
        uint256 volume,
        uint256 commission,
        uint256 reputationDelta,
        uint256 aumDelta
    );

    constructor(
        address initialOwner,
        IERC721Owner brokerNft_,
        IERC6551Registry erc6551Registry_,
        address accountImplementation_,
        bytes32 accountSalt_,
        uint256 nftChainId_,
        RobinhoodAssetRegistry assetRegistry_
    ) Ownable(initialOwner) {
        if (
            address(brokerNft_) == address(0) || address(erc6551Registry_) == address(0)
                || accountImplementation_ == address(0) || address(assetRegistry_) == address(0)
                || nftChainId_ == 0
        ) revert ZeroAddress();
        brokerNft = brokerNft_;
        erc6551Registry = erc6551Registry_;
        accountImplementation = accountImplementation_;
        accountSalt = accountSalt_;
        nftChainId = nftChainId_;
        assetRegistry = assetRegistry_;
    }

    function configureInfrastructure(address router_, address bankerHook_) external onlyOwner {
        if (router_ == address(0) || bankerHook_ == address(0)) revert ZeroAddress();
        router = router_;
        bankerHook = bankerHook_;
        emit InfrastructureConfigured(router_, bankerHook_);
    }

    function registerBroker(uint256 brokerId)
        external
        returns (address tokenBoundAccount, address vault)
    {
        return _registerBroker(brokerId, msg.sender);
    }

    /// @notice Lets the dedicated license contract mint and bind a new identity atomically.
    function registerBrokerFor(uint256 brokerId, address beneficiary)
        external
        returns (address tokenBoundAccount, address vault)
    {
        if (msg.sender != address(brokerNft)) revert OnlyBrokerNft();
        return _registerBroker(brokerId, beneficiary);
    }

    function _registerBroker(uint256 brokerId, address beneficiary)
        private
        returns (address tokenBoundAccount, address vault)
    {
        if (router == address(0) || bankerHook == address(0)) {
            revert InfrastructureNotConfigured();
        }
        if (brokers[brokerId].vault != address(0)) revert AlreadyRegistered();
        if (beneficiary == address(0) || brokerNft.ownerOf(brokerId) != beneficiary) {
            revert NotBrokerOwner();
        }

        tokenBoundAccount = erc6551Registry.createAccount(
            accountImplementation, accountSalt, nftChainId, address(brokerNft), brokerId
        );
        address expected = erc6551Registry.account(
            accountImplementation, accountSalt, nftChainId, address(brokerNft), brokerId
        );
        if (tokenBoundAccount == address(0) || tokenBoundAccount != expected) {
            revert InvalidAccount();
        }

        vault = address(new BrokerVault(address(this), brokerId, tokenBoundAccount));
        brokers[brokerId] = Broker({
            tokenBoundAccount: tokenBoundAccount,
            vault: vault,
            registeredAt: uint64(block.timestamp),
            trades: 0,
            aum: 0,
            lifetimeVolume: 0,
            lifetimeCommission: 0,
            reputation: 0
        });
        brokerIdForVault[vault] = brokerId;
        ++brokerCount;
        emit BrokerRegistered(brokerId, tokenBoundAccount, vault);
    }

    function ownerOfBroker(uint256 brokerId) public view returns (address) {
        if (brokers[brokerId].vault == address(0)) revert UnknownBroker();
        return brokerNft.ownerOf(brokerId);
    }

    function isController(uint256 brokerId, address account) external view returns (bool) {
        Broker memory broker = brokers[brokerId];
        if (broker.vault == address(0)) return false;
        return account == brokerNft.ownerOf(brokerId) || account == broker.tokenBoundAccount;
    }

    function recordVaultDelta(uint256 brokerId, bool increase, uint256 amount) external {
        Broker storage broker = brokers[brokerId];
        if (msg.sender != broker.vault || broker.vault == address(0)) revert OnlyVault();
        if (increase) broker.aum += amount;
        else broker.aum -= amount;
        emit VaultAumChanged(brokerId, broker.aum, increase, amount);
    }

    function recordTrade(
        uint256 brokerId,
        address trader,
        uint256 volume,
        uint256 commission,
        uint256 reputationDelta,
        uint256 aumDelta
    ) external {
        if (msg.sender != bankerHook) revert OnlyHook();
        Broker storage broker = brokers[brokerId];
        if (broker.vault == address(0)) revert UnknownBroker();
        ++broker.trades;
        broker.lifetimeVolume += volume;
        broker.lifetimeCommission += commission;
        broker.reputation += reputationDelta;
        broker.aum += aumDelta;
        emit BrokerActivityRecorded(brokerId, trader, volume, commission, reputationDelta, aumDelta);
    }

    function vaultForBroker(uint256 brokerId) external view returns (address) {
        return brokers[brokerId].vault;
    }
}
