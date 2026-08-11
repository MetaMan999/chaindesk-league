// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BankerHook } from "./BankerHook.sol";
import { BrokerRegistry } from "./BrokerRegistry.sol";
import { BrokerVault } from "./BrokerVault.sol";
import { IQualifiedExecutionPartner } from "./interfaces/IQualifiedExecutionPartner.sol";
import { Ownable } from "./lib/Ownable.sol";
import { SafeTransferLib } from "./lib/SafeTransferLib.sol";
import { RobinhoodAssetRegistry } from "./RobinhoodAssetRegistry.sol";

/// @notice Test-asset router plus a non-custodial qualified-order boundary for Stock Tokens.
/// @dev Direct swaps are a same-unit testnet simulation. Robinhood Stock Tokens can never enter the
///      direct path; they are forwarded only to the configured qualified execution partner.
contract BrokerRouter is Ownable {
    using SafeTransferLib for address;
    error AssetNotAllowed();
    error DeadlineExpired();
    error DirectStockRoutingDisabled();
    error DuplicateOrder();
    error IneligibleTrader();
    error InvalidFee();
    error InvalidOrder();
    error OnlyQualifiedPartner();
    error Paused();
    error Reentrancy();
    error SlippageExceeded();
    error UnknownBroker();

    uint256 private constant BPS = 10_000;

    struct QualifiedOrder {
        uint256 brokerId;
        address trader;
        address asset;
        bool filled;
        bool exists;
    }

    BrokerRegistry public immutable registry;
    RobinhoodAssetRegistry public immutable assetRegistry;
    BankerHook public immutable bankerHook;
    IQualifiedExecutionPartner public qualifiedPartner;
    uint16 public testSwapFeeBps;
    bool public paused;
    bool private entered;
    mapping(bytes32 => QualifiedOrder) public qualifiedOrders;

    event DirectSwapRouted(
        bytes32 indexed orderId,
        uint256 indexed brokerId,
        address indexed trader,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 commission
    );
    event QualifiedPartnerSet(address indexed partner);
    event QualifiedOrderSubmitted(
        bytes32 indexed partnerOrderId,
        uint256 indexed brokerId,
        address indexed trader,
        address asset
    );
    event QualifiedOrderFilled(
        bytes32 indexed partnerOrderId, uint256 notional, uint256 commission
    );
    event PauseSet(bool paused);
    event TestSwapFeeSet(uint16 feeBps);

    constructor(
        address initialOwner,
        BrokerRegistry registry_,
        RobinhoodAssetRegistry assetRegistry_,
        BankerHook bankerHook_,
        uint16 testSwapFeeBps_
    ) Ownable(initialOwner) {
        if (
            address(registry_) == address(0) || address(assetRegistry_) == address(0)
                || address(bankerHook_) == address(0)
        ) revert ZeroAddress();
        if (testSwapFeeBps_ > 100) revert InvalidFee();
        registry = registry_;
        assetRegistry = assetRegistry_;
        bankerHook = bankerHook_;
        testSwapFeeBps = testSwapFeeBps_;
    }

    modifier nonReentrant() {
        if (entered) revert Reentrancy();
        entered = true;
        _;
        entered = false;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PauseSet(paused_);
    }

    function setTestSwapFee(uint16 feeBps) external onlyOwner {
        if (feeBps > 100) revert InvalidFee();
        testSwapFeeBps = feeBps;
        emit TestSwapFeeSet(feeBps);
    }

    function setQualifiedPartner(IQualifiedExecutionPartner partner) external onlyOwner {
        qualifiedPartner = partner;
        emit QualifiedPartnerSet(address(partner));
    }

    function routeTestSwap(
        uint256 brokerId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint64 deadline
    ) external whenNotPaused nonReentrant returns (bytes32 orderId, uint256 amountOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (tokenIn == tokenOut || amountIn == 0) revert InvalidOrder();
        if (!assetRegistry.isDirectAsset(tokenIn) || !assetRegistry.isDirectAsset(tokenOut)) {
            RobinhoodAssetRegistry.Asset memory inputAsset = assetRegistry.getAsset(tokenIn);
            RobinhoodAssetRegistry.Asset memory outputAsset = assetRegistry.getAsset(tokenOut);
            if (
                inputAsset.assetClass == RobinhoodAssetRegistry.AssetClass.RobinhoodStockToken
                    || outputAsset.assetClass
                        == RobinhoodAssetRegistry.AssetClass.RobinhoodStockToken
            ) revert DirectStockRoutingDisabled();
            revert AssetNotAllowed();
        }
        address vaultAddress = registry.vaultForBroker(brokerId);
        if (vaultAddress == address(0)) revert UnknownBroker();

        amountOut = amountIn * (BPS - testSwapFeeBps) / BPS;
        if (amountOut < minAmountOut || amountOut == 0) revert SlippageExceeded();
        BrokerVault vault = BrokerVault(vaultAddress);
        tokenIn.safeTransferFrom(msg.sender, vaultAddress, amountIn);
        vault.payOrderAsset(tokenOut, msg.sender, amountOut);
        (uint256 commission,) =
            bankerHook.recordDirectSwap(brokerId, msg.sender, amountIn, amountOut);
        orderId = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                brokerId,
                msg.sender,
                tokenIn,
                tokenOut,
                amountIn,
                block.number
            )
        );
        emit DirectSwapRouted(
            orderId, brokerId, msg.sender, tokenIn, tokenOut, amountIn, amountOut, commission
        );
    }

    function submitQualifiedOrder(
        uint256 brokerId,
        address stockToken,
        IQualifiedExecutionPartner.OrderRequest calldata request
    ) external whenNotPaused nonReentrant returns (bytes32 partnerOrderId) {
        address vaultAddress = registry.vaultForBroker(brokerId);
        if (vaultAddress == address(0)) revert UnknownBroker();
        if (address(qualifiedPartner) == address(0)) revert InvalidOrder();
        if (!assetRegistry.isQualifiedAsset(stockToken)) revert AssetNotAllowed();
        RobinhoodAssetRegistry.Asset memory asset = assetRegistry.getAsset(stockToken);
        if (
            request.assetId != asset.uid || request.quantity == 0
                || request.expiresAt < block.timestamp
        ) revert InvalidOrder();
        if (!qualifiedPartner.isEligible(msg.sender, asset.uid)) revert IneligibleTrader();
        partnerOrderId = qualifiedPartner.submitOrder(msg.sender, request);
        if (partnerOrderId == bytes32(0) || qualifiedOrders[partnerOrderId].exists) {
            revert DuplicateOrder();
        }
        qualifiedOrders[partnerOrderId] = QualifiedOrder({
            brokerId: brokerId, trader: msg.sender, asset: stockToken, filled: false, exists: true
        });
        emit QualifiedOrderSubmitted(partnerOrderId, brokerId, msg.sender, stockToken);
    }

    function recordQualifiedFill(bytes32 partnerOrderId, uint256 notional, uint256 commission)
        external
    {
        if (msg.sender != address(qualifiedPartner) || address(qualifiedPartner) == address(0)) {
            revert OnlyQualifiedPartner();
        }
        QualifiedOrder storage order = qualifiedOrders[partnerOrderId];
        if (!order.exists || order.filled || notional == 0 || commission > notional) {
            revert InvalidOrder();
        }
        order.filled = true;
        bankerHook.recordQualifiedFill(order.brokerId, order.trader, notional, commission);
        emit QualifiedOrderFilled(partnerOrderId, notional, commission);
    }
}
