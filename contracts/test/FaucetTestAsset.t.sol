// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { FaucetTestAsset } from "../src/FaucetTestAsset.sol";

interface VmFaucet {
    function expectRevert(bytes4 revertData) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

contract FaucetTestAssetTest {
    VmFaucet private constant vm =
        VmFaucet(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant PLAYER = address(0xB0B);

    FaucetTestAsset private token;

    function setUp() public {
        token = new FaucetTestAsset("Banker Bros Test USD", "bbUSD");
    }

    function testFaucetIssuesOnlyValuelessTestUnits() public {
        vm.prank(PLAYER);
        token.faucet();
        _assertEq(token.balanceOf(PLAYER), 100_000 * 1e6, "faucet balance");
        _assertEq(token.decimals(), 6, "test decimals");
    }

    function testFaucetCooldown() public {
        vm.prank(PLAYER);
        token.faucet();
        vm.expectRevert(FaucetTestAsset.FaucetCoolingDown.selector);
        vm.prank(PLAYER);
        token.faucet();

        vm.warp(block.timestamp + 4 hours);
        vm.prank(PLAYER);
        token.faucet();
        _assertEq(token.balanceOf(PLAYER), 200_000 * 1e6, "second faucet balance");
    }

    function _assertEq(uint256 actual, uint256 expected, string memory reason) private pure {
        if (actual != expected) revert(reason);
    }
}
