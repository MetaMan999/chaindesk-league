// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { TestBase } from "./TestBase.sol";
import { BankerBrosCollection } from "../src/BankerBrosCollection.sol";
import { BankerBroAccount } from "../src/BankerBroAccount.sol";
import { BankerBroAccountFactory } from "../src/BankerBroAccountFactory.sol";
import { BrokerRegistry } from "../src/BrokerRegistry.sol";
import { CommissionAccounting } from "../src/CommissionAccounting.sol";
import { ReputationEngine } from "../src/ReputationEngine.sol";
import { LiquidityAttribution } from "../src/LiquidityAttribution.sol";
import { BrokerRouter } from "../src/BrokerRouter.sol";
import { BankerHook } from "../src/BankerHook.sol";
import { CityDealDesk } from "../src/CityDealDesk.sol";
import { MockERC20, MockAdapter } from "./mocks/Mocks.sol";
import { PoolKey, SwapParams, BalanceDelta, Currency } from "../src/v4/V4Types.sol";

contract MockPoolManager {
    function callAfterSwap(
        BankerHook hook,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external {
        hook.afterSwap(address(this), key, params, delta, hookData);
    }
}

contract BankerBroAccountTest is TestBase {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    BankerBrosCollection internal collection;
    BankerBroAccountFactory internal factory;
    BrokerRegistry internal registry;
    BankerBroAccount internal aliceAccount;
    BankerBroAccount internal bobAccount;

    function setUp() public {
        collection = new BankerBrosCollection(
            address(this), address(this), address(this), 0, "ipfs://hidden", "ipfs://contract"
        );
        collection.configureSale(BankerBrosCollection.SalePhase.Public, 0, 5);
        vm.prank(ALICE);
        collection.mint(1, 0, new bytes32[](0));
        vm.prank(BOB);
        collection.mint(1, 0, new bytes32[](0));

        factory = new BankerBroAccountFactory(address(collection));
        aliceAccount = BankerBroAccount(payable(factory.createAccount(1)));
        bobAccount = BankerBroAccount(payable(factory.createAccount(2)));

        registry = new BrokerRegistry();
        registry.initialize(address(this), address(this), address(collection), 1, 0);
        vm.prank(ALICE);
        registry.registerBroker(1, address(aliceAccount));
        vm.prank(BOB);
        registry.registerBroker(2, address(bobAccount));
    }

    function test_accountIsDeterministicAndHoldsAssets() public {
        assertEq(factory.predictAccount(1), address(aliceAccount));
        assertEq(aliceAccount.owner(), ALICE);
        MockERC20 token = new MockERC20("City Credit", "CITY");
        token.mint(address(aliceAccount), 100 ether);
        assertEq(token.balanceOf(address(aliceAccount)), 100 ether);

        vm.prank(ALICE);
        aliceAccount.execute(
            address(token), 0, abi.encodeCall(MockERC20.transfer, (ALICE, 25 ether)), 0
        );
        assertEq(token.balanceOf(ALICE), 25 ether);
        assertEq(aliceAccount.state(), 1);
    }

    function test_nftTransferMovesAccountControl() public {
        vm.prank(ALICE);
        collection.transferFrom(ALICE, BOB, 1);
        assertEq(aliceAccount.owner(), BOB);

        MockERC20 token = new MockERC20("City Credit", "CITY");
        token.mint(address(aliceAccount), 10 ether);
        vm.prank(ALICE);
        vm.expectRevert(BankerBroAccount.Unauthorized.selector);
        aliceAccount.execute(address(token), 0, abi.encodeCall(MockERC20.transfer, (ALICE, 1)), 0);

        vm.prank(BOB);
        aliceAccount.execute(
            address(token), 0, abi.encodeCall(MockERC20.transfer, (BOB, 10 ether)), 0
        );
        assertEq(token.balanceOf(BOB), 10 ether);
    }

    function test_parentNftCannotBeLockedInsideItsOwnAccount() public {
        vm.prank(ALICE);
        vm.expectRevert();
        collection.safeTransferFrom(ALICE, address(aliceAccount), 1);
        assertEq(collection.ownerOf(1), ALICE);
    }

    function test_accountsSettleApprovedCityDeal() public {
        MockERC20 tech = new MockERC20("Test Tech", "TECH");
        MockERC20 usd = new MockERC20("Test USD", "tUSD");
        CityDealDesk desk = new CityDealDesk();
        desk.initialize(address(this), address(this), address(registry), 0);
        desk.setAsset(address(tech), true);
        desk.setAsset(address(usd), true);
        tech.mint(address(aliceAccount), 50 ether);
        usd.mint(address(bobAccount), 1_000 ether);

        vm.startPrank(ALICE);
        aliceAccount.execute(
            address(tech), 0, abi.encodeCall(MockERC20.approve, (address(desk), 50 ether)), 0
        );
        bytes memory opened = aliceAccount.execute(
            address(desk),
            0,
            abi.encodeCall(
                CityDealDesk.openDeal,
                (
                    uint256(1),
                    uint256(2),
                    address(tech),
                    address(usd),
                    uint128(50 ether),
                    uint128(1_000 ether),
                    uint64(block.timestamp + 1 days)
                )
            ),
            0
        );
        vm.stopPrank();
        uint256 dealId = abi.decode(opened, (uint256));

        vm.startPrank(BOB);
        bobAccount.execute(
            address(usd), 0, abi.encodeCall(MockERC20.approve, (address(desk), 1_000 ether)), 0
        );
        bobAccount.execute(
            address(desk), 0, abi.encodeCall(CityDealDesk.acceptDeal, (dealId, uint256(2))), 0
        );
        vm.stopPrank();

        assertEq(tech.balanceOf(address(bobAccount)), 50 ether);
        assertEq(usd.balanceOf(address(aliceAccount)), 1_000 ether);
        (,,,,,,, CityDealDesk.DealStatus status) = desk.deals(dealId);
        assertEq(uint256(status), uint256(CityDealDesk.DealStatus.Settled));
    }

    function test_accountRoutesLiquidityAndV4HookAttributesBroker() public {
        CommissionAccounting accounting = new CommissionAccounting();
        accounting.initialize(
            address(this), address(this), address(registry), address(this), 1_000, 0
        );
        ReputationEngine reputation = new ReputationEngine();
        reputation.initialize(address(this), address(this), address(registry), 0);
        LiquidityAttribution attribution = new LiquidityAttribution();
        attribution.initialize(address(this), address(this), address(registry), 0);
        BrokerRouter router = new BrokerRouter();
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

        MockERC20 tokenIn = new MockERC20("Test ETH", "tETH");
        MockERC20 tokenOut = new MockERC20("Test USD", "tUSD");
        MockAdapter adapter = new MockAdapter();
        router.setAdapter(address(adapter), true);
        router.setAsset(address(tokenIn), true);
        router.setAsset(address(tokenOut), true);
        tokenIn.mint(address(aliceAccount), 10 ether);
        tokenOut.mint(address(adapter), 100 ether);

        vm.startPrank(ALICE);
        aliceAccount.execute(
            address(tokenIn), 0, abi.encodeCall(MockERC20.approve, (address(router), 10 ether)), 0
        );
        BrokerRouter.RouteRequest memory request = BrokerRouter.RouteRequest({
            brokerId: 1,
            adapter: address(adapter),
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: 10 ether,
            minAmountOut: 19 ether,
            feeBps: 50,
            deadline: uint64(block.timestamp),
            poolId: keccak256("TBA_POOL")
        });
        aliceAccount.execute(
            address(router), 0, abi.encodeCall(BrokerRouter.route, (request, bytes(""))), 0
        );
        vm.stopPrank();
        assertTrue(tokenOut.balanceOf(address(aliceAccount)) >= 19 ether);

        MockPoolManager manager = new MockPoolManager();
        BankerHook hook = new BankerHook(
            address(manager), address(registry), address(attribution), address(this), address(this)
        );
        attribution.setRole(recorder, address(hook), true);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(tokenIn)),
            currency1: Currency.wrap(address(tokenOut)),
            fee: 3_000,
            tickSpacing: 60,
            hooks: address(hook)
        });
        SwapParams memory params =
            SwapParams({ zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: 1 });
        manager.callAfterSwap(hook, key, params, BalanceDelta.wrap(int256(5 ether)), abi.encode(1));
        bytes32 poolId = keccak256(abi.encode(key));
        assertEq(attribution.brokerVolume(poolId, 1, address(tokenOut)), 5 ether);
    }
}
