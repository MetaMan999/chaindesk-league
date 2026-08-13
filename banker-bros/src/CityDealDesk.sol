// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC20, IBrokerRegistry } from "./interfaces/IProtocol.sol";
import { ProtocolAccess, SafeTransferLib } from "./lib/ProtocolAccess.sol";

/// @notice Escrowed broker-to-broker spot deals for approved crypto/test assets.
/// @dev No leverage, lending, securities, partial fills, fiat, or arbitrary external execution.
contract CityDealDesk is ProtocolAccess, SafeTransferLib {
    enum DealStatus {
        None,
        Open,
        Settled,
        Cancelled
    }

    struct Deal {
        uint256 makerBrokerId;
        uint256 takerBrokerId;
        address makerAsset;
        address takerAsset;
        uint128 makerAmount;
        uint128 takerAmount;
        uint64 expiresAt;
        DealStatus status;
    }

    IBrokerRegistry public registry;
    uint256 public nextDealId;
    mapping(uint256 => Deal) public deals;
    mapping(address => bool) public allowedAsset;

    event DealOpened(
        uint256 indexed dealId,
        uint256 indexed makerBrokerId,
        uint256 indexed takerBrokerId,
        address makerAsset,
        address takerAsset,
        uint256 makerAmount,
        uint256 takerAmount,
        uint64 expiresAt
    );
    event DealSettled(
        uint256 indexed dealId, uint256 indexed makerBrokerId, uint256 indexed takerBrokerId
    );
    event DealCancelled(uint256 indexed dealId, uint256 indexed makerBrokerId);
    event DealAssetAllowed(address indexed asset, bool allowed);

    error InvalidDeal();
    error InvalidStatus();
    error Expired();
    error WrongBrokerAccount();

    function initialize(
        address admin,
        address guardian,
        address registry_,
        uint64 upgradeDelaySeconds
    ) external {
        _initializeAccess(admin, guardian, upgradeDelaySeconds);
        if (registry_.code.length == 0) revert InvalidAddress();
        registry = IBrokerRegistry(registry_);
        nextDealId = 1;
    }

    /// @notice Must be called by the maker's token-bound account after approving this contract.
    function openDeal(
        uint256 makerBrokerId,
        uint256 takerBrokerId,
        address makerAsset,
        address takerAsset,
        uint128 makerAmount,
        uint128 takerAmount,
        uint64 expiresAt
    ) external whenNotPaused nonReentrant returns (uint256 dealId) {
        if (msg.sender != registry.accountOf(makerBrokerId)) {
            revert WrongBrokerAccount();
        }
        if (!registry.isActive(makerBrokerId)) revert InvalidDeal();
        if (
            !allowedAsset[makerAsset] || !allowedAsset[takerAsset] || makerAsset == takerAsset
                || makerAmount == 0 || takerAmount == 0 || expiresAt <= block.timestamp
        ) revert InvalidDeal();
        if (takerBrokerId != 0 && !registry.isActive(takerBrokerId)) revert InvalidDeal();

        dealId = nextDealId++;
        deals[dealId] = Deal({
            makerBrokerId: makerBrokerId,
            takerBrokerId: takerBrokerId,
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            makerAmount: makerAmount,
            takerAmount: takerAmount,
            expiresAt: expiresAt,
            status: DealStatus.Open
        });
        uint256 escrowBefore = IERC20(makerAsset).balanceOf(address(this));
        _safeTransferFrom(makerAsset, msg.sender, address(this), makerAmount);
        uint256 escrowAfter = IERC20(makerAsset).balanceOf(address(this));
        if (escrowAfter < escrowBefore || escrowAfter - escrowBefore != makerAmount) {
            revert InvalidDeal();
        }
        emit DealOpened(
            dealId,
            makerBrokerId,
            takerBrokerId,
            makerAsset,
            takerAsset,
            makerAmount,
            takerAmount,
            expiresAt
        );
    }

    /// @notice Must be called by the accepting broker's token-bound account.
    function acceptDeal(uint256 dealId, uint256 acceptingBrokerId)
        external
        whenNotPaused
        nonReentrant
    {
        Deal storage deal = deals[dealId];
        if (deal.status != DealStatus.Open) revert InvalidStatus();
        if (block.timestamp > deal.expiresAt) revert Expired();
        if (msg.sender != registry.accountOf(acceptingBrokerId)) revert WrongBrokerAccount();
        if (!registry.isActive(acceptingBrokerId) || acceptingBrokerId == deal.makerBrokerId) {
            revert InvalidDeal();
        }
        if (deal.takerBrokerId != 0 && deal.takerBrokerId != acceptingBrokerId) {
            revert InvalidDeal();
        }

        deal.status = DealStatus.Settled;
        deal.takerBrokerId = acceptingBrokerId;
        address makerAccount = registry.accountOf(deal.makerBrokerId);
        address takerAccount = msg.sender;
        uint256 makerBalanceBefore = IERC20(deal.takerAsset).balanceOf(makerAccount);
        _safeTransferFrom(deal.takerAsset, takerAccount, makerAccount, deal.takerAmount);
        uint256 makerBalanceAfter = IERC20(deal.takerAsset).balanceOf(makerAccount);
        if (
            makerBalanceAfter < makerBalanceBefore
                || makerBalanceAfter - makerBalanceBefore != deal.takerAmount
        ) revert InvalidDeal();
        uint256 takerBalanceBefore = IERC20(deal.makerAsset).balanceOf(takerAccount);
        _safeTransfer(deal.makerAsset, takerAccount, deal.makerAmount);
        uint256 takerBalanceAfter = IERC20(deal.makerAsset).balanceOf(takerAccount);
        if (
            takerBalanceAfter < takerBalanceBefore
                || takerBalanceAfter - takerBalanceBefore != deal.makerAmount
        ) revert InvalidDeal();
        emit DealSettled(dealId, deal.makerBrokerId, acceptingBrokerId);
    }

    function cancelDeal(uint256 dealId) external nonReentrant {
        Deal storage deal = deals[dealId];
        if (deal.status != DealStatus.Open) revert InvalidStatus();
        address makerAccount = registry.accountOf(deal.makerBrokerId);
        if (msg.sender != makerAccount && block.timestamp <= deal.expiresAt) {
            revert WrongBrokerAccount();
        }
        deal.status = DealStatus.Cancelled;
        _safeTransfer(deal.makerAsset, makerAccount, deal.makerAmount);
        emit DealCancelled(dealId, deal.makerBrokerId);
    }

    function setAsset(address asset, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (asset.code.length == 0) revert InvalidAddress();
        allowedAsset[asset] = allowed;
        emit DealAssetAllowed(asset, allowed);
    }
}
