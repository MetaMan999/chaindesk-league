// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @dev ABI-compatible subset of Uniswap v4 core types. Pin and import the canonical package in production.
type Currency is address;
type BalanceDelta is int256;
type BeforeSwapDelta is int256;

struct PoolKey {
    Currency currency0;
    Currency currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct SwapParams {
    bool zeroForOne;
    int256 amountSpecified;
    uint160 sqrtPriceLimitX96;
}

library BalanceDeltaLibrary {
    function amount0(BalanceDelta delta) internal pure returns (int128 value) {
        int256 raw = BalanceDelta.unwrap(delta);
        value = int128(raw >> 128);
    }

    function amount1(BalanceDelta delta) internal pure returns (int128 value) {
        int256 raw = BalanceDelta.unwrap(delta);
        value = int128(raw);
    }
}

library PoolIdLibrary {
    function toId(PoolKey calldata key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key));
    }
}
