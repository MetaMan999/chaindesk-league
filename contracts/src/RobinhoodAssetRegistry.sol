// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "./lib/Ownable.sol";

/// @notice Canonical asset and safety metadata for Robinhood Chain compatibility.
/// @dev Stock Token metadata must be synchronized from Robinhood's canonical registry/API or an
///      approved oracle. Registration never grants direct routing or proves user eligibility.
contract RobinhoodAssetRegistry is Ownable {
    error InvalidAsset();
    error InvalidMultiplier();
    error InvalidStateAge();

    enum AssetClass {
        CryptoTest,
        RobinhoodStockToken
    }

    struct Asset {
        bytes32 uid;
        bytes12 symbol;
        AssetClass assetClass;
        uint64 updatedAt;
        uint128 multiplierWad;
        bool active;
        bool halted;
        bool directVaultEnabled;
    }

    mapping(address => Asset) public assets;
    uint64 public maxQualifiedStateAge = 1 hours;

    event AssetConfigured(
        address indexed token,
        bytes32 indexed uid,
        bytes12 symbol,
        AssetClass assetClass,
        bool directVaultEnabled
    );
    event AssetMarketStateSet(
        address indexed token, bool active, bool halted, uint256 multiplierWad, uint64 updatedAt
    );
    event MaxQualifiedStateAgeSet(uint64 maxAge);

    constructor(address initialOwner) Ownable(initialOwner) { }

    function configureAsset(
        address token,
        bytes32 uid,
        bytes12 symbol,
        AssetClass assetClass,
        bool directVaultEnabled
    ) external onlyOwner {
        if (token == address(0) || symbol == bytes12(0)) {
            revert InvalidAsset();
        }
        if (assetClass == AssetClass.RobinhoodStockToken && directVaultEnabled) {
            revert InvalidAsset();
        }
        Asset storage asset = assets[token];
        asset.uid = uid;
        asset.symbol = symbol;
        asset.assetClass = assetClass;
        asset.directVaultEnabled = directVaultEnabled;
        emit AssetConfigured(token, uid, symbol, assetClass, directVaultEnabled);
    }

    function setMarketState(
        address token,
        bool active,
        bool halted,
        uint128 multiplierWad,
        uint64 sourceUpdatedAt
    ) external onlyOwner {
        Asset storage asset = assets[token];
        if (asset.symbol == bytes12(0)) revert InvalidAsset();
        if (asset.assetClass == AssetClass.RobinhoodStockToken && multiplierWad == 0) {
            revert InvalidMultiplier();
        }
        asset.active = active;
        asset.halted = halted;
        asset.multiplierWad = multiplierWad;
        asset.updatedAt = sourceUpdatedAt;
        emit AssetMarketStateSet(token, active, halted, multiplierWad, sourceUpdatedAt);
    }

    /// @notice Limits how long Stock Token eligibility and halt metadata may be trusted.
    function setMaxQualifiedStateAge(uint64 maxAge) external onlyOwner {
        if (maxAge < 5 minutes || maxAge > 7 days) revert InvalidStateAge();
        maxQualifiedStateAge = maxAge;
        emit MaxQualifiedStateAgeSet(maxAge);
    }

    function isDirectAsset(address token) external view returns (bool) {
        Asset memory asset = assets[token];
        return asset.assetClass == AssetClass.CryptoTest && asset.active && !asset.halted
            && asset.directVaultEnabled;
    }

    function isQualifiedAsset(address token) external view returns (bool) {
        Asset memory asset = assets[token];
        return asset.assetClass == AssetClass.RobinhoodStockToken && asset.active && !asset.halted
            && asset.uid != bytes32(0) && asset.updatedAt <= block.timestamp
            && block.timestamp - asset.updatedAt <= maxQualifiedStateAge;
    }

    function getAsset(address token) external view returns (Asset memory) {
        return assets[token];
    }
}
