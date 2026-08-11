// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Valueless six-decimal ERC-20 used only for local and public-testnet game routing.
contract FaucetTestAsset {
    error AllowanceExceeded();
    error BalanceExceeded();
    error FaucetCoolingDown();
    error InvalidRecipient();

    uint256 public constant FAUCET_AMOUNT = 100_000 * 1e6;
    uint256 public constant FAUCET_COOLDOWN = 4 hours;
    uint8 public constant decimals = 6;

    string public name;
    string public symbol;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint64) public lastFaucetAt;

    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 amount);

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    function faucet() external {
        uint64 previous = lastFaucetAt[msg.sender];
        if (previous != 0 && block.timestamp < previous + FAUCET_COOLDOWN) {
            revert FaucetCoolingDown();
        }
        lastFaucetAt[msg.sender] = uint64(block.timestamp);
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 permitted = allowance[from][msg.sender];
        if (permitted != type(uint256).max) {
            if (permitted < amount) revert AllowanceExceeded();
            allowance[from][msg.sender] = permitted - amount;
            emit Approval(from, msg.sender, permitted - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _mint(address to, uint256 amount) private {
        if (to == address(0)) revert InvalidRecipient();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _transfer(address from, address to, uint256 amount) private {
        if (to == address(0)) revert InvalidRecipient();
        if (balanceOf[from] < amount) revert BalanceExceeded();
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
