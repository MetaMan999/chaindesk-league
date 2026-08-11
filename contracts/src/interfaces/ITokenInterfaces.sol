// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC721Owner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
