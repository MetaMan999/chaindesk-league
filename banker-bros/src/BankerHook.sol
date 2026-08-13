// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IBrokerRegistry, ILiquidityAttribution } from "./interfaces/IProtocol.sol";
import { ProtocolAccess } from "./lib/ProtocolAccess.sol";
import {
    PoolKey,
    SwapParams,
    BalanceDelta,
    BeforeSwapDelta,
    Currency,
    BalanceDeltaLibrary,
    PoolIdLibrary
} from "./v4/V4Types.sol";

/// @notice Uniswap v4 afterSwap attribution hook.
/// @dev Must be deployed to an address whose hook permission bits enable AFTER_SWAP only.
contract BankerHook is ProtocolAccess {
    using BalanceDeltaLibrary for BalanceDelta;
    using PoolIdLibrary for PoolKey;

    address public immutable poolManager;
    IBrokerRegistry public immutable registry;
    ILiquidityAttribution public immutable attribution;

    event HookSwapAttributed(
        bytes32 indexed poolId, uint256 indexed brokerId, address indexed token, uint256 volume
    );
    event HookAttributionFailed(bytes32 indexed poolId, uint256 indexed brokerId, bytes reason);
    error OnlyPoolManager();

    constructor(
        address poolManager_,
        address registry_,
        address attribution_,
        address admin,
        address guardian
    ) {
        if (
            poolManager_.code.length == 0 || registry_.code.length == 0
                || attribution_.code.length == 0
        ) {
            revert InvalidAddress();
        }
        poolManager = poolManager_;
        registry = IBrokerRegistry(registry_);
        attribution = ILiquidityAttribution(attribution_);
        _initializeAccess(admin, guardian, 0);
    }

    /// @dev Hook data is abi.encode(uint256 brokerId). Invalid/inactive attribution never breaks a swap.
    function afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external returns (bytes4, int128) {
        if (msg.sender != poolManager) revert OnlyPoolManager();
        if (paused) return (this.afterSwap.selector, 0);
        bytes32 poolId = key.toId();
        if (hookData.length != 32) {
            emit HookAttributionFailed(poolId, 0, bytes("INVALID_HOOK_DATA"));
            return (this.afterSwap.selector, 0);
        }
        uint256 brokerId = abi.decode(hookData, (uint256));

        int128 raw = params.zeroForOne ? delta.amount1() : delta.amount0();
        int256 signedVolume = int256(raw);
        uint256 volume = uint256(signedVolume < 0 ? -signedVolume : signedVolume);
        address token = Currency.unwrap(params.zeroForOne ? key.currency1 : key.currency0);

        try registry.isActive(brokerId) returns (bool active) {
            if (active) {
                try attribution.recordSwap(poolId, brokerId, token, volume) {
                    emit HookSwapAttributed(poolId, brokerId, token, volume);
                } catch (bytes memory reason) {
                    emit HookAttributionFailed(poolId, brokerId, reason);
                }
            }
        } catch (bytes memory reason) {
            emit HookAttributionFailed(poolId, brokerId, reason);
        }
        return (this.afterSwap.selector, 0);
    }

    /// @notice Permission bitmap expected by current v4 periphery tooling.
    function getHookPermissions()
        external
        pure
        returns (bool, bool, bool, bool, bool, bool, bool, bool, bool, bool, bool, bool, bool, bool)
    {
        return (
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            true,
            false,
            false,
            false,
            false,
            false,
            false
        );
    }
}
