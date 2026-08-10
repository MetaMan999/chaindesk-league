// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Future integration boundary for a licensed execution/custody provider.
/// @dev No implementation is deployed by this repository. Do not connect a generic router here.
interface IQualifiedExecutionPartner {
    enum Side {
        Buy,
        Sell
    }

    enum OrderStatus {
        Unknown,
        Pending,
        Filled,
        Rejected,
        Cancelled
    }

    struct OrderRequest {
        bytes32 clientReference;
        bytes32 assetId;
        Side side;
        uint256 quantity;
        uint256 limitPrice;
        uint64 expiresAt;
    }

    function isEligible(address customer, bytes32 assetId) external view returns (bool);
    function submitOrder(address customer, OrderRequest calldata request)
        external
        returns (bytes32 partnerOrderId);
    function orderStatus(bytes32 partnerOrderId) external view returns (OrderStatus);
}

