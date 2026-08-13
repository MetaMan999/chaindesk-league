// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { TestBase } from "./TestBase.sol";
import { BrokerRegistry } from "../src/BrokerRegistry.sol";
import { CommissionAccounting } from "../src/CommissionAccounting.sol";
import { ReputationEngine } from "../src/ReputationEngine.sol";
import { LiquidityAttribution } from "../src/LiquidityAttribution.sol";
import { BrokerRouter } from "../src/BrokerRouter.sol";
import { MockNFT, Mock6551, MockERC20, MockAdapter } from "./mocks/Mocks.sol";

contract SystemTest is TestBase {
    address internal constant ALICE = address(0xA11CE);
    uint256 internal constant BROKER = 7;
    BrokerRegistry internal registry;
    CommissionAccounting internal accounting;
    ReputationEngine internal reputation;
    LiquidityAttribution internal attribution;
    BrokerRouter internal router;
    MockERC20 internal tokenIn;
    MockERC20 internal tokenOut;
    MockAdapter internal adapter;

    function setUp() public {
        MockNFT nft = new MockNFT();
        nft.mint(ALICE, BROKER);
        Mock6551 account = new Mock6551(block.chainid, address(nft), BROKER);

        registry = new BrokerRegistry();
        registry.initialize(address(this), address(this), address(nft), 1, 0);
        vm.prank(ALICE);
        registry.registerBroker(BROKER, address(account));

        accounting = new CommissionAccounting();
        accounting.initialize(
            address(this), address(this), address(registry), address(this), 1000, 0
        );
        reputation = new ReputationEngine();
        reputation.initialize(address(this), address(this), address(registry), 0);
        attribution = new LiquidityAttribution();
        attribution.initialize(address(this), address(this), address(registry), 0);
        router = new BrokerRouter();
        router.initialize(
            address(this),
            address(this),
            address(registry),
            address(accounting),
            address(reputation),
            address(attribution),
            0
        );

        bytes32 recorder = keccak256("RECORDER_ROLE");
        accounting.setRole(recorder, address(router), true);
        reputation.setRole(recorder, address(router), true);
        attribution.setRole(recorder, address(router), true);

        tokenIn = new MockERC20("Test ETH", "tETH");
        tokenOut = new MockERC20("Test USD", "tUSD");
        adapter = new MockAdapter();
        router.setAdapter(address(adapter), true);
        router.setAsset(address(tokenIn), true);
        router.setAsset(address(tokenOut), true);
        tokenOut.mint(address(adapter), 2_000_000 ether);
        tokenIn.mint(ALICE, 1_000_000 ether);
        vm.prank(ALICE);
        tokenIn.approve(address(router), type(uint256).max);
    }

    function test_routeAttributesVolumeAndConservesFees() public {
        _route(100 ether, 50);
        uint256 grossOut = 200 ether;
        uint256 fee = grossOut * 50 / 10_000;
        assertEq(tokenOut.balanceOf(ALICE), grossOut - fee);
        assertEq(accounting.brokerClaimable(BROKER, address(tokenOut)), fee * 9000 / 10_000);
        assertEq(accounting.treasuryClaimable(address(tokenOut)), fee * 1000 / 10_000);
        assertEq(accounting.totalAccounted(address(tokenOut)), fee);
        assertEq(attribution.brokerVolume(bytes32("TEST"), BROKER, address(tokenOut)), grossOut);
    }

    function testFuzz_feeSplitConserves(uint96 rawAmount, uint8 rawFeeBps) public {
        uint256 amount = bound(rawAmount, 1e12, 100_000 ether);
        uint16 feeBps = uint16(bound(rawFeeBps, 0, 100));
        _route(amount, feeBps);
        uint256 fee = (amount * 2) * feeBps / 10_000;
        uint256 broker = accounting.brokerClaimable(BROKER, address(tokenOut));
        uint256 platform = accounting.treasuryClaimable(address(tokenOut));
        assertEq(broker + platform, fee);
        assertEq(accounting.totalAccounted(address(tokenOut)), fee);
    }

    function _route(uint256 amount, uint16 feeBps) internal {
        BrokerRouter.RouteRequest memory request = BrokerRouter.RouteRequest({
            brokerId: BROKER,
            adapter: address(adapter),
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: amount,
            minAmountOut: amount,
            feeBps: feeBps,
            deadline: uint64(block.timestamp),
            poolId: bytes32("TEST")
        });
        vm.prank(ALICE);
        router.route(request, "");
    }
}
