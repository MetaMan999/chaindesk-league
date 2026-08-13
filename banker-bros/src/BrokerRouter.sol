// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {
    IERC20,
    IBrokerRegistry,
    ICommissionAccounting,
    IReputationEngine,
    ILiquidityAttribution,
    IRouteAdapter
} from "./interfaces/IProtocol.sol";
import { ProtocolAccess, SafeTransferLib } from "./lib/ProtocolAccess.sol";

contract BrokerRouter is ProtocolAccess, SafeTransferLib {
    uint16 public constant BPS = 10_000;
    uint16 public constant MAX_ROUTE_FEE_BPS = 100;

    struct RouteRequest {
        uint256 brokerId;
        address adapter;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint16 feeBps;
        uint64 deadline;
        bytes32 poolId;
    }

    IBrokerRegistry public registry;
    ICommissionAccounting public accounting;
    IReputationEngine public reputation;
    ILiquidityAttribution public attribution;
    mapping(address => bool) public allowedAdapter;
    mapping(address => bool) public allowedAsset;

    event RouteExecuted(
        uint256 indexed brokerId,
        address indexed sender,
        address indexed adapter,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    event AdapterAllowed(address indexed adapter, bool allowed);
    event AssetAllowed(address indexed asset, bool allowed);
    error InvalidRoute();
    error Expired();
    error Slippage();

    function initialize(
        address admin,
        address guardian,
        address registry_,
        address accounting_,
        address reputation_,
        address attribution_,
        uint64 delay
    ) external {
        _initializeAccess(admin, guardian, delay);
        if (
            registry_.code.length == 0 || accounting_.code.length == 0
                || reputation_.code.length == 0 || attribution_.code.length == 0
        ) revert InvalidAddress();
        registry = IBrokerRegistry(registry_);
        accounting = ICommissionAccounting(accounting_);
        reputation = IReputationEngine(reputation_);
        attribution = ILiquidityAttribution(attribution_);
    }

    function route(RouteRequest calldata request, bytes calldata adapterData)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 userAmountOut)
    {
        if (block.timestamp > request.deadline) revert Expired();
        if (
            !registry.isActive(request.brokerId) || !allowedAdapter[request.adapter]
                || !allowedAsset[request.tokenIn] || !allowedAsset[request.tokenOut]
                || request.amountIn == 0 || request.feeBps > MAX_ROUTE_FEE_BPS
        ) revert InvalidRoute();

        _safeTransferFrom(request.tokenIn, msg.sender, request.adapter, request.amountIn);
        uint256 balanceBefore = IERC20(request.tokenOut).balanceOf(address(this));
        uint256 declaredAmountOut = IRouteAdapter(request.adapter)
            .execute(
                request.tokenIn,
                request.tokenOut,
                request.amountIn,
                request.minAmountOut,
                address(this),
                adapterData
            );
        uint256 balanceAfter = IERC20(request.tokenOut).balanceOf(address(this));
        if (balanceAfter < balanceBefore) revert InvalidRoute();
        uint256 amountOut = balanceAfter - balanceBefore;
        if (amountOut != declaredAmountOut) revert InvalidRoute();
        uint256 fee = amountOut * request.feeBps / BPS;
        userAmountOut = amountOut - fee;
        if (userAmountOut < request.minAmountOut) revert Slippage();

        _safeTransfer(request.tokenOut, msg.sender, userAmountOut);
        if (fee != 0) {
            _safeTransfer(request.tokenOut, address(accounting), fee);
            accounting.recordFee(request.brokerId, request.tokenOut, fee);
        }
        attribution.recordSwap(request.poolId, request.brokerId, request.tokenOut, amountOut);
        reputation.recordRoutedVolume(request.brokerId, amountOut);
        emit RouteExecuted(
            request.brokerId,
            msg.sender,
            request.adapter,
            request.tokenIn,
            request.tokenOut,
            request.amountIn,
            amountOut,
            fee
        );
    }

    function setAdapter(address adapter, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (adapter.code.length == 0) revert InvalidAddress();
        allowedAdapter[adapter] = allowed;
        emit AdapterAllowed(adapter, allowed);
    }

    function setAsset(address asset, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (asset.code.length == 0) revert InvalidAddress();
        allowedAsset[asset] = allowed;
        emit AssetAllowed(asset, allowed);
    }
}
