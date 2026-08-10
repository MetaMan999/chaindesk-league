// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "./lib/Ownable.sol";

/// @notice Non-transferable simulated positions. These are game inventory, not tokenized securities.
contract PaperAsset is Ownable {
    error AlreadyConfigured();
    error InvalidAsset();
    error NonTransferable();
    error NotGame();

    struct Asset {
        bytes12 symbol;
        bytes32 displayName;
        uint64 price;
        uint32 volatilityBps;
        bool active;
    }

    address public game;
    uint256 public assetCount;
    mapping(uint256 => Asset) public assets;
    mapping(uint256 => mapping(address => uint256)) public balanceOf;

    event AssetAdded(uint256 indexed assetId, bytes12 symbol, bytes32 displayName, uint256 price);
    event GameConfigured(address indexed game);
    event PositionChanged(address indexed account, uint256 indexed assetId, int256 amount);

    constructor(address initialOwner) Ownable(initialOwner) { }

    modifier onlyGame() {
        if (msg.sender != game) revert NotGame();
        _;
    }

    function setGame(address game_) external onlyOwner {
        if (game != address(0)) revert AlreadyConfigured();
        if (game_ == address(0)) revert ZeroAddress();
        game = game_;
        emit GameConfigured(game_);
    }

    function addAsset(bytes12 symbol, bytes32 displayName, uint64 price, uint32 volatilityBps)
        external
        onlyOwner
        returns (uint256 assetId)
    {
        if (symbol == bytes12(0) || price == 0 || volatilityBps > 2_000) revert InvalidAsset();
        assetId = ++assetCount;
        assets[assetId] = Asset(symbol, displayName, price, volatilityBps, true);
        emit AssetAdded(assetId, symbol, displayName, price);
    }

    function setPrice(uint256 assetId, uint64 newPrice) external onlyGame {
        if (!assets[assetId].active || newPrice == 0) revert InvalidAsset();
        assets[assetId].price = newPrice;
    }

    function mint(address to, uint256 assetId, uint256 amount) external onlyGame {
        if (!assets[assetId].active) revert InvalidAsset();
        balanceOf[assetId][to] += amount;
        emit PositionChanged(to, assetId, int256(amount));
    }

    function burn(address from, uint256 assetId, uint256 amount) external onlyGame {
        balanceOf[assetId][from] -= amount;
        emit PositionChanged(from, assetId, -int256(amount));
    }

    function transfer(address, uint256, uint256) external pure returns (bool) {
        revert NonTransferable();
    }

    function transferFrom(address, address, uint256, uint256) external pure returns (bool) {
        revert NonTransferable();
    }
}

