// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { TestBase } from "./TestBase.sol";
import { BrokerRegistry } from "../src/BrokerRegistry.sol";
import { CommissionAccounting } from "../src/CommissionAccounting.sol";
import { BrokerVault } from "../src/BrokerVault.sol";
import { ERC1967Proxy } from "../src/lib/ERC1967Proxy.sol";
import { SafeTransferLib } from "../src/lib/ProtocolAccess.sol";
import { MockNFT, Mock6551 } from "./mocks/Mocks.sol";

contract TransferHarness is SafeTransferLib {
    function transfer(address token, address to, uint256 amount) external {
        _safeTransfer(token, to, amount);
    }

    function transferFrom(address token, address from, address to, uint256 amount) external {
        _safeTransferFrom(token, from, to, amount);
    }
}

contract HardeningTest is TestBase {
    address internal constant ALICE = address(0xA11CE);
    uint256 internal constant BROKER_ID = 7;
    bytes4 internal constant INVALID_ADDRESS = bytes4(keccak256("InvalidAddress()"));
    bytes4 internal constant INCOMPATIBLE_IMPLEMENTATION =
        bytes4(keccak256("IncompatibleImplementation()"));
    bytes4 internal constant UPGRADE_NOT_READY = bytes4(keccak256("UpgradeNotReady()"));

    MockNFT internal nft;
    Mock6551 internal account;
    BrokerRegistry internal registry;

    function setUp() public {
        nft = new MockNFT();
        nft.mint(ALICE, BROKER_ID);
        account = new Mock6551(block.chainid, address(nft), BROKER_ID);

        registry = new BrokerRegistry();
        registry.initialize(address(this), address(this), address(nft), 1, 1 days);
        vm.prank(ALICE);
        registry.registerBroker(BROKER_ID, address(account));
    }

    function test_refreshRejectsAddressWithoutCode() public {
        vm.expectRevert(BrokerRegistry.InvalidTokenBoundAccount.selector);
        vm.prank(ALICE);
        registry.refreshAccount(BROKER_ID, address(0xBEEF));
    }

    function test_safeTransferRejectsAddressWithoutCode() public {
        TransferHarness harness = new TransferHarness();
        vm.expectRevert(SafeTransferLib.TransferFailed.selector);
        harness.transfer(address(0xBEEF), ALICE, 1);

        vm.expectRevert(SafeTransferLib.TransferFailed.selector);
        harness.transferFrom(address(0xBEEF), ALICE, address(this), 1);
    }

    function test_claimBrokerRejectsZeroRecipient() public {
        CommissionAccounting accounting = new CommissionAccounting();
        accounting.initialize(
            address(this), address(this), address(registry), address(this), 1_000, 0
        );

        vm.expectRevert(INVALID_ADDRESS);
        vm.prank(ALICE);
        accounting.claimBroker(BROKER_ID, address(0xCAFE), address(0));
    }

    function test_proxiableUuidCannotBeCalledThroughProxy() public {
        BrokerRegistry implementation = new BrokerRegistry();
        bytes memory initialization = abi.encodeCall(
            BrokerRegistry.initialize,
            (address(this), address(this), address(nft), 1, uint64(1 days))
        );
        BrokerRegistry proxy =
            BrokerRegistry(address(new ERC1967Proxy(address(implementation), initialization)));

        vm.expectRevert(INCOMPATIBLE_IMPLEMENTATION);
        proxy.proxiableUUID();
    }

    function test_proxyCannotUpgradeToItself() public {
        BrokerRegistry implementation = new BrokerRegistry();
        bytes memory initialization = abi.encodeCall(
            BrokerRegistry.initialize,
            (address(this), address(this), address(nft), 1, uint64(1 days))
        );
        BrokerRegistry proxy =
            BrokerRegistry(address(new ERC1967Proxy(address(implementation), initialization)));

        proxy.scheduleUpgrade(address(proxy));
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(UPGRADE_NOT_READY);
        proxy.executeUpgrade();
    }

    function test_vaultDepositRejectsAddressWithoutCode() public {
        BrokerVault vault = new BrokerVault(address(registry), BROKER_ID, address(this));
        vm.expectRevert(SafeTransferLib.TransferFailed.selector);
        vault.deposit(address(0xBEEF), 1);
    }
}
