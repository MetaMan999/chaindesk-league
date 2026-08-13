// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { TestBase } from "./TestBase.sol";
import { BrokerRegistry } from "../src/BrokerRegistry.sol";
import { MockNFT, Mock6551 } from "./mocks/Mocks.sol";

contract BrokerRegistryTest is TestBase {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    MockNFT internal nft;
    BrokerRegistry internal registry;

    function setUp() public {
        nft = new MockNFT();
        registry = new BrokerRegistry();
        registry.initialize(address(this), address(this), address(nft), 1, 2 days);
        nft.mint(ALICE, 7);
    }

    function test_registersCanonicalTokenBoundAccount() public {
        Mock6551 account = new Mock6551(block.chainid, address(nft), 7);
        vm.prank(ALICE);
        registry.registerBroker(7, address(account));
        assertEq(registry.accountOf(7), address(account));
        assertEq(registry.controllerOf(7), ALICE);
        assertTrue(registry.isActive(7));
    }

    function test_rejectsWrongOwner() public {
        Mock6551 account = new Mock6551(block.chainid, address(nft), 7);
        vm.prank(BOB);
        vm.expectRevert(BrokerRegistry.NotBrokerOwner.selector);
        registry.registerBroker(7, address(account));
    }

    function test_tracksNFTTransferWithoutRegistryMutation() public {
        Mock6551 account = new Mock6551(block.chainid, address(nft), 7);
        vm.startPrank(ALICE);
        registry.registerBroker(7, address(account));
        nft.transfer(7, BOB);
        vm.stopPrank();
        assertEq(registry.controllerOf(7), BOB);
    }
}
