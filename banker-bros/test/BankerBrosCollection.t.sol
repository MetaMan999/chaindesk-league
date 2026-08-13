// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { TestBase } from "./TestBase.sol";
import { BankerBrosCollection } from "../src/BankerBrosCollection.sol";

contract BankerBrosCollectionTest is TestBase {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    BankerBrosCollection internal collection;

    function setUp() public {
        collection = new BankerBrosCollection(
            address(this),
            address(this),
            address(this),
            0.02 ether,
            "ipfs://hidden",
            "ipfs://contract"
        );
        vm.deal(ALICE, 100 ether);
        vm.deal(BOB, 100 ether);
    }

    function test_publicMintAndTransfer() public {
        collection.configureSale(BankerBrosCollection.SalePhase.Public, 0.02 ether, 5);
        vm.prank(ALICE);
        collection.mint{ value: 0.04 ether }(2, 0, new bytes32[](0));
        assertEq(collection.ownerOf(1), ALICE);
        assertEq(collection.ownerOf(2), ALICE);
        assertEq(collection.balanceOf(ALICE), 2);

        vm.prank(ALICE);
        collection.transferFrom(ALICE, BOB, 1);
        assertEq(collection.ownerOf(1), BOB);
    }

    function test_allowlistUsesPerWalletAllowance() public {
        bytes32 root = keccak256(abi.encode(ALICE, uint16(2)));
        collection.setMerkleRoot(root);
        collection.configureSale(BankerBrosCollection.SalePhase.Allowlist, 0.02 ether, 5);
        vm.prank(ALICE);
        collection.mint{ value: 0.04 ether }(2, 2, new bytes32[](0));

        vm.prank(ALICE);
        vm.expectRevert(BankerBrosCollection.WalletLimit.selector);
        collection.mint{ value: 0.02 ether }(1, 2, new bytes32[](0));
    }

    function test_revealOffsetsMetadataAndFreezes() public {
        collection.commitProvenance(keccak256("ordered-assets"));
        collection.setMetadataURIs("ipfs://hidden", "ipfs://base/", "ipfs://contract");
        bytes32 secret = keccak256("launch-secret");
        collection.commitReveal(keccak256(abi.encode(secret)));
        vm.roll(block.number + 1);
        collection.reveal(secret);
        assertTrue(collection.revealed());
        uint256 metadata = collection.metadataId(1);
        assertTrue(metadata >= 1 && metadata <= 222);
        collection.freezeMetadata();
        assertTrue(collection.metadataFrozen());
    }

    function testFuzz_royaltyNeverExceedsTenPercent(uint96 rawBps, uint128 salePrice) public {
        uint96 bps = uint96(bound(rawBps, 0, 1_000));
        collection.setRoyalty(address(this), bps);
        (, uint256 royalty) = collection.royaltyInfo(1, salePrice);
        assertEq(royalty, uint256(salePrice) * bps / 10_000);
        assertTrue(royalty <= uint256(salePrice) / 10);
    }

    function test_supplyPartitionsAreHardCappedAt200And22() public {
        collection.configureSale(BankerBrosCollection.SalePhase.Public, 0, 20);
        for (uint256 i; i < 10; ++i) {
            address minter = address(uint160(0x1000 + i));
            vm.prank(minter);
            collection.mint(20, 0, new bytes32[](0));
        }
        assertEq(collection.communityMinted(), 200);

        vm.prank(address(0x9999));
        vm.expectRevert(BankerBrosCollection.SoldOut.selector);
        collection.mint(1, 0, new bytes32[](0));

        collection.mintReserve(BOB, 22);
        assertEq(collection.reserveMinted(), 22);
        assertEq(collection.totalMinted(), 222);

        vm.expectRevert(BankerBrosCollection.SoldOut.selector);
        collection.mintReserve(BOB, 1);
    }
}
