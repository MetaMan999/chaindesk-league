// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BrokerRegistry } from "./BrokerRegistry.sol";
import { ICommissionSink } from "./interfaces/ICommissionSink.sol";
import { Ownable } from "./lib/Ownable.sol";

/// @notice Attributes routed test swaps and qualified fills to a registered broker.
/// @dev This accounting sink does not execute swaps or custody assets. The optional v4 adapter can
///      submit volume-only observations through ICommissionSink.
contract BankerHook is Ownable, ICommissionSink {
    error CommissionExceedsNotional();
    error InvalidShare();
    error OnlyRouter();
    error OnlyV4Adapter();

    uint256 private constant BPS = 10_000;
    uint256 private constant REPUTATION_UNIT = 10_000 * 1e6;

    BrokerRegistry public immutable registry;
    address public router;
    address public v4Adapter;
    uint16 public brokerCommissionShareBps = 7_000;

    event RouterSet(address indexed router);
    event V4AdapterSet(address indexed adapter);
    event CommissionShareSet(uint16 shareBps);
    event SwapAttributed(
        uint256 indexed brokerId,
        address indexed trader,
        uint256 volume,
        uint256 grossFee,
        uint256 brokerCommission,
        uint256 reputationDelta,
        bool qualified
    );

    constructor(address initialOwner, BrokerRegistry registry_) Ownable(initialOwner) {
        if (address(registry_) == address(0)) revert ZeroAddress();
        registry = registry_;
    }

    function setRouter(address router_) external onlyOwner {
        if (router_ == address(0)) revert ZeroAddress();
        router = router_;
        emit RouterSet(router_);
    }

    function setV4Adapter(address adapter) external onlyOwner {
        v4Adapter = adapter;
        emit V4AdapterSet(adapter);
    }

    function setBrokerCommissionShare(uint16 shareBps) external onlyOwner {
        if (shareBps > 9_000) revert InvalidShare();
        brokerCommissionShareBps = shareBps;
        emit CommissionShareSet(shareBps);
    }

    function recordDirectSwap(uint256 brokerId, address trader, uint256 amountIn, uint256 amountOut)
        external
        returns (uint256 commission, uint256 reputationDelta)
    {
        if (msg.sender != router) revert OnlyRouter();
        if (amountOut > amountIn) revert CommissionExceedsNotional();
        uint256 grossFee = amountIn - amountOut;
        commission = grossFee * brokerCommissionShareBps / BPS;
        reputationDelta = _reputationFor(amountIn);
        registry.recordTrade(brokerId, trader, amountIn, commission, reputationDelta, grossFee);
        emit SwapAttributed(
            brokerId, trader, amountIn, grossFee, commission, reputationDelta, false
        );
    }

    function recordQualifiedFill(
        uint256 brokerId,
        address trader,
        uint256 notional,
        uint256 commission
    ) external returns (uint256 reputationDelta) {
        if (msg.sender != router) revert OnlyRouter();
        if (commission > notional) revert CommissionExceedsNotional();
        reputationDelta = _reputationFor(notional);
        registry.recordTrade(brokerId, trader, notional, commission, reputationDelta, 0);
        emit SwapAttributed(
            brokerId, trader, notional, commission, commission, reputationDelta, true
        );
    }

    function recordHookVolume(uint256 brokerId, address trader, uint256 simulatedNotional)
        external
    {
        if (msg.sender != v4Adapter || v4Adapter == address(0)) revert OnlyV4Adapter();
        uint256 reputationDelta = _reputationFor(simulatedNotional);
        registry.recordTrade(brokerId, trader, simulatedNotional, 0, reputationDelta, 0);
        emit SwapAttributed(brokerId, trader, simulatedNotional, 0, 0, reputationDelta, false);
    }

    function _reputationFor(uint256 volume) private pure returns (uint256) {
        uint256 reputationDelta = 1 + volume / REPUTATION_UNIT;
        return reputationDelta > 20 ? 20 : reputationDelta;
    }
}
