// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IBrokerRegistry } from "./interfaces/IProtocol.sol";
import { ProtocolAccess } from "./lib/ProtocolAccess.sol";

contract LiquidityAttribution is ProtocolAccess {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
    IBrokerRegistry public registry;

    mapping(bytes32 => mapping(uint256 => int256)) public brokerLiquidity;
    mapping(bytes32 => mapping(uint256 => mapping(address => uint256))) public brokerVolume;

    event LiquidityChanged(
        bytes32 indexed poolId, uint256 indexed brokerId, int256 delta, int256 total
    );
    event SwapAttributed(
        bytes32 indexed poolId, uint256 indexed brokerId, address indexed token, uint256 volume
    );
    error InactiveBroker();
    error NegativeLiquidity();

    function initialize(address admin, address guardian, address registry_, uint64 delay) external {
        _initializeAccess(admin, guardian, delay);
        if (registry_.code.length == 0) revert InvalidAddress();
        registry = IBrokerRegistry(registry_);
    }

    function recordSwap(bytes32 poolId, uint256 brokerId, address token, uint256 volume)
        external
        onlyRole(RECORDER_ROLE)
        whenNotPaused
    {
        if (!registry.isActive(brokerId)) revert InactiveBroker();
        brokerVolume[poolId][brokerId][token] += volume;
        emit SwapAttributed(poolId, brokerId, token, volume);
    }

    function recordLiquidity(bytes32 poolId, uint256 brokerId, int256 delta)
        external
        onlyRole(RECORDER_ROLE)
        whenNotPaused
    {
        if (!registry.isActive(brokerId)) revert InactiveBroker();
        int256 next = brokerLiquidity[poolId][brokerId] + delta;
        if (next < 0) revert NegativeLiquidity();
        brokerLiquidity[poolId][brokerId] = next;
        emit LiquidityChanged(poolId, brokerId, delta, next);
    }
}
