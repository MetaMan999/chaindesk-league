// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC20Minimal } from "./interfaces/ITokenInterfaces.sol";
import { SafeTransferLib } from "./lib/SafeTransferLib.sol";

interface IBrokerRegistryForVault {
    function router() external view returns (address);
    function assetRegistry() external view returns (address);
    function isController(uint256 brokerId, address account) external view returns (bool);
    function recordVaultDelta(uint256 brokerId, bool increase, uint256 amount) external;
}

interface IDirectAssetRegistry {
    function isDirectAsset(address token) external view returns (bool);
}

/// @notice Isolated test-asset vault for one registered external broker NFT.
/// @dev Direct deposits and swaps are limited to allowlisted crypto/test assets denominated in the
///      same six-decimal accounting unit. Robinhood Stock Tokens use the qualified order boundary.
contract BrokerVault {
    using SafeTransferLib for address;

    error AssetNotAllowed();
    error InsufficientLiquidity();
    error NotController();
    error OnlyRouter();
    error ZeroAmount();

    IBrokerRegistryForVault public immutable registry;
    uint256 public immutable brokerId;
    address public immutable tokenBoundAccount;

    event Deposited(address indexed asset, address indexed from, uint256 amount);
    event Withdrawn(address indexed asset, address indexed to, uint256 amount);
    event OrderAssetPaid(address indexed asset, address indexed trader, uint256 amount);

    constructor(address registry_, uint256 brokerId_, address tokenBoundAccount_) {
        registry = IBrokerRegistryForVault(registry_);
        brokerId = brokerId_;
        tokenBoundAccount = tokenBoundAccount_;
    }

    modifier onlyController() {
        if (!registry.isController(brokerId, msg.sender)) revert NotController();
        _;
    }

    modifier onlyRouter() {
        if (msg.sender != registry.router()) revert OnlyRouter();
        _;
    }

    function deposit(address asset, uint256 amount) external onlyController {
        _requireDirectAsset(asset);
        if (amount == 0) revert ZeroAmount();
        asset.safeTransferFrom(msg.sender, address(this), amount);
        registry.recordVaultDelta(brokerId, true, amount);
        emit Deposited(asset, msg.sender, amount);
    }

    function withdraw(address asset, uint256 amount, address to) external onlyController {
        _requireDirectAsset(asset);
        if (amount == 0 || to == address(0)) revert ZeroAmount();
        if (IERC20Minimal(asset).balanceOf(address(this)) < amount) {
            revert InsufficientLiquidity();
        }
        registry.recordVaultDelta(brokerId, false, amount);
        asset.safeTransfer(to, amount);
        emit Withdrawn(asset, to, amount);
    }

    function payOrderAsset(address asset, address trader, uint256 amount) external onlyRouter {
        _requireDirectAsset(asset);
        if (IERC20Minimal(asset).balanceOf(address(this)) < amount) {
            revert InsufficientLiquidity();
        }
        asset.safeTransfer(trader, amount);
        emit OrderAssetPaid(asset, trader, amount);
    }

    function balanceOf(address asset) external view returns (uint256) {
        return IERC20Minimal(asset).balanceOf(address(this));
    }

    function _requireDirectAsset(address asset) private view {
        if (!IDirectAssetRegistry(registry.assetRegistry()).isDirectAsset(asset)) {
            revert AssetNotAllowed();
        }
    }
}
