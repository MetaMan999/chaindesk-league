// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ICommissionSink } from "../interfaces/ICommissionSink.sol";
import { Ownable } from "../lib/Ownable.sol";

type Currency is address;
type BalanceDelta is int256;

interface IHookMarker { }

struct PoolKey {
    Currency currency0;
    Currency currency1;
    uint24 fee;
    int24 tickSpacing;
    IHookMarker hooks;
}

struct SwapParams {
    bool zeroForOne;
    int256 amountSpecified;
    uint160 sqrtPriceLimitX96;
}

/// @notice Minimal Uniswap v4 afterSwap-shape adapter for fictional game pools.
/// @dev Deploy with a mined hook address whose permission bits include AFTER_SWAP_FLAG, then compare
///      this ABI against the exact v4-core release used by the target chain before integration.
contract BankerCommissionHook is Ownable {
    error InvalidHookData();
    error PoolNotAllowed();
    error OnlyPoolManager();

    struct Permissions {
        bool beforeInitialize;
        bool afterInitialize;
        bool beforeAddLiquidity;
        bool afterAddLiquidity;
        bool beforeRemoveLiquidity;
        bool afterRemoveLiquidity;
        bool beforeSwap;
        bool afterSwap;
        bool beforeDonate;
        bool afterDonate;
        bool beforeSwapReturnDelta;
        bool afterSwapReturnDelta;
        bool afterAddLiquidityReturnDelta;
        bool afterRemoveLiquidityReturnDelta;
    }

    address public immutable poolManager;
    ICommissionSink public immutable sink;
    mapping(bytes32 => bool) public allowedPool;

    event PoolPermissionSet(bytes32 indexed poolId, bool allowed);

    constructor(address initialOwner, address poolManager_, ICommissionSink sink_)
        Ownable(initialOwner)
    {
        if (poolManager_ == address(0) || address(sink_) == address(0)) revert ZeroAddress();
        poolManager = poolManager_;
        sink = sink_;
    }

    function getHookPermissions() external pure returns (Permissions memory permissions) {
        permissions.afterSwap = true;
    }

    function setPoolAllowed(PoolKey calldata key, bool allowed) external onlyOwner {
        bytes32 poolId = keccak256(abi.encode(key));
        allowedPool[poolId] = allowed;
        emit PoolPermissionSet(poolId, allowed);
    }

    function afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta,
        bytes calldata hookData
    ) external returns (bytes4, int128) {
        if (msg.sender != poolManager) revert OnlyPoolManager();
        if (hookData.length != 64) revert InvalidHookData();
        bytes32 poolId = keccak256(abi.encode(key));
        if (!allowedPool[poolId]) revert PoolNotAllowed();

        (address trader, uint256 profileId) = abi.decode(hookData, (address, uint256));
        uint256 amount = params.amountSpecified < 0
            ? uint256(-(params.amountSpecified + 1)) + 1
            : uint256(params.amountSpecified);
        sink.recordHookVolume(profileId, trader, amount);
        return (this.afterSwap.selector, 0);
    }
}

