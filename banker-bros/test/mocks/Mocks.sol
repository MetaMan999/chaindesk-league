// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC20, IRouteAdapter } from "../../src/interfaces/IProtocol.sol";

contract MockNFT {
    mapping(uint256 => address) public ownerOf;

    function mint(address to, uint256 id) external {
        ownerOf[id] = to;
    }

    function transfer(uint256 id, address to) external {
        require(ownerOf[id] == msg.sender, "owner");
        ownerOf[id] = to;
    }
}

contract Mock6551 {
    uint256 private immutable _chainId;
    address private immutable _collection;
    uint256 private immutable _id;
    MockNFT private immutable _nft;

    constructor(uint256 chainId_, address collection_, uint256 id_) {
        _chainId = chainId_;
        _collection = collection_;
        _id = id_;
        _nft = MockNFT(collection_);
    }

    function token() external view returns (uint256, address, uint256) {
        return (_chainId, _collection, _id);
    }

    function owner() external view returns (address) {
        return _nft.ownerOf(_id);
    }
}

contract MockERC20 is IERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract MockAdapter is IRouteAdapter {
    function execute(
        address,
        address tokenOut,
        uint256 amountIn,
        uint256,
        address recipient,
        bytes calldata
    ) external returns (uint256 amountOut) {
        amountOut = amountIn * 2;
        MockERC20(tokenOut).transfer(recipient, amountOut);
    }
}
