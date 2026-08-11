// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BankerHook } from "../src/BankerHook.sol";
import { BrokerLicense } from "../src/BrokerLicense.sol";
import { BrokerRegistry } from "../src/BrokerRegistry.sol";
import { BrokerRouter } from "../src/BrokerRouter.sol";
import { BrokerVault } from "../src/BrokerVault.sol";
import { IERC6551Registry } from "../src/interfaces/IERC6551Registry.sol";
import { IQualifiedExecutionPartner } from "../src/interfaces/IQualifiedExecutionPartner.sol";
import { IERC721Owner } from "../src/interfaces/ITokenInterfaces.sol";
import { RobinhoodAssetRegistry } from "../src/RobinhoodAssetRegistry.sol";

interface VmLiquidity {
    function expectRevert(bytes4 revertData) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

contract MockBrokerNft is IERC721Owner {
    error NotOwner();

    mapping(uint256 => address) public ownerOf;

    function mint(address to, uint256 tokenId) external {
        ownerOf[tokenId] = to;
    }

    function transfer(uint256 tokenId, address to) external {
        if (ownerOf[tokenId] != msg.sender) revert NotOwner();
        ownerOf[tokenId] = to;
    }
}

contract MockTokenBoundAccount { }

contract Mock6551Registry is IERC6551Registry {
    mapping(bytes32 => address) public accounts;

    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address accountAddress) {
        bytes32 key = keccak256(abi.encode(implementation, salt, chainId, tokenContract, tokenId));
        accountAddress = accounts[key];
        if (accountAddress == address(0)) {
            accountAddress = address(new MockTokenBoundAccount());
            accounts[key] = accountAddress;
        }
    }

    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address) {
        return accounts[
            keccak256(abi.encode(implementation, salt, chainId, tokenContract, tokenId))
        ];
    }
}

contract MockTestToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 6;
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
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockQualifiedPartner is IQualifiedExecutionPartner {
    mapping(address => mapping(bytes32 => bool)) public eligible;
    mapping(bytes32 => OrderStatus) public orderStatus;
    uint256 public nonce;

    function setEligible(address customer, bytes32 assetId, bool allowed) external {
        eligible[customer][assetId] = allowed;
    }

    function isEligible(address customer, bytes32 assetId) external view returns (bool) {
        return eligible[customer][assetId];
    }

    function submitOrder(address customer, OrderRequest calldata request)
        external
        returns (bytes32 partnerOrderId)
    {
        if (!eligible[customer][request.assetId]) revert("ineligible");
        partnerOrderId = keccak256(abi.encode(customer, request.clientReference, ++nonce));
        orderStatus[partnerOrderId] = OrderStatus.Pending;
    }

    function fill(BrokerRouter router, bytes32 partnerOrderId, uint256 notional, uint256 commission)
        external
    {
        orderStatus[partnerOrderId] = OrderStatus.Filled;
        router.recordQualifiedFill(partnerOrderId, notional, commission);
    }
}

contract BrokerLiquidityTest {
    VmLiquidity private constant vm =
        VmLiquidity(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant BANKER = address(0xB0B);
    address private constant TRADER = address(0xC11E17);
    address private constant BUYER = address(0xB0B2);
    uint256 private constant BROKER_ID = 1139;
    uint256 private constant UNIT = 1e6;
    bytes32 private constant STOCK_UID = keccak256("ROBINHOOD_STOCK_TEST_UID");

    MockBrokerNft private nft;
    Mock6551Registry private erc6551;
    MockTestToken private testUsd;
    MockTestToken private testEth;
    MockTestToken private stockToken;
    RobinhoodAssetRegistry private assets;
    BrokerRegistry private registry;
    BankerHook private hook;
    BrokerRouter private router;
    BrokerVault private vault;
    MockQualifiedPartner private partner;

    function setUp() public {
        nft = new MockBrokerNft();
        erc6551 = new Mock6551Registry();
        testUsd = new MockTestToken("Test USD", "TUSD");
        testEth = new MockTestToken("Test Ether", "TETH");
        stockToken = new MockTestToken("Example Robinhood Stock Token", "RSTK");
        assets = new RobinhoodAssetRegistry(address(this));
        assets.configureAsset(
            address(testUsd), bytes32(0), "TUSD", RobinhoodAssetRegistry.AssetClass.CryptoTest, true
        );
        assets.configureAsset(
            address(testEth), bytes32(0), "TETH", RobinhoodAssetRegistry.AssetClass.CryptoTest, true
        );
        assets.configureAsset(
            address(stockToken),
            STOCK_UID,
            "RSTK",
            RobinhoodAssetRegistry.AssetClass.RobinhoodStockToken,
            false
        );
        assets.setMarketState(address(testUsd), true, false, 1e18, uint64(block.timestamp));
        assets.setMarketState(address(testEth), true, false, 1e18, uint64(block.timestamp));
        assets.setMarketState(address(stockToken), true, false, 1e18, uint64(block.timestamp));

        nft.mint(BANKER, BROKER_ID);
        registry = new BrokerRegistry(
            address(this), nft, erc6551, address(0x6551), bytes32(uint256(1)), block.chainid, assets
        );
        hook = new BankerHook(address(this), registry);
        router = new BrokerRouter(address(this), registry, assets, hook, 30);
        hook.setRouter(address(router));
        registry.configureInfrastructure(address(router), address(hook));

        vm.prank(BANKER);
        (, address vaultAddress) = registry.registerBroker(BROKER_ID);
        vault = BrokerVault(vaultAddress);

        testUsd.mint(BANKER, 2_000_000 * UNIT);
        testEth.mint(BANKER, 2_000_000 * UNIT);
        testUsd.mint(TRADER, 2_000_000 * UNIT);
        testEth.mint(TRADER, 2_000_000 * UNIT);
        stockToken.mint(TRADER, 100_000 * UNIT);
    }

    function testEndToEndNftAccountVaultSwapAndAttribution() public {
        _depositBoth(100_000 * UNIT);
        vm.prank(TRADER);
        testUsd.approve(address(router), type(uint256).max);

        uint256 traderEthBefore = testEth.balanceOf(TRADER);
        vm.prank(TRADER);
        (, uint256 amountOut) = router.routeTestSwap(
            BROKER_ID,
            address(testUsd),
            address(testEth),
            10_000 * UNIT,
            9_970 * UNIT,
            uint64(block.timestamp)
        );

        _assertEq(amountOut, 9_970 * UNIT, "test output");
        _assertEq(testEth.balanceOf(TRADER), traderEthBefore + amountOut, "trader output");
        (
            address tokenBoundAccount,
            address vaultAddress,,
            uint64 trades,
            uint256 aum,
            uint256 lifetimeVolume,
            uint256 lifetimeCommission,
            uint256 reputation
        ) = registry.brokers(BROKER_ID);
        if (tokenBoundAccount == address(0) || vaultAddress != address(vault)) {
            revert("identity bridge missing");
        }
        _assertEq(trades, 1, "trades");
        _assertEq(aum, 200_030 * UNIT, "aum includes retained test fee");
        _assertEq(lifetimeVolume, 10_000 * UNIT, "volume");
        _assertEq(lifetimeCommission, 21 * UNIT, "commission");
        _assertEq(reputation, 2, "reputation");
    }

    function testDirectRouterRejectsRobinhoodStockToken() public {
        _depositBoth(100_000 * UNIT);
        vm.prank(TRADER);
        stockToken.approve(address(router), type(uint256).max);
        vm.expectRevert(BrokerRouter.DirectStockRoutingDisabled.selector);
        vm.prank(TRADER);
        router.routeTestSwap(
            BROKER_ID,
            address(stockToken),
            address(testUsd),
            100 * UNIT,
            99 * UNIT,
            uint64(block.timestamp)
        );
    }

    function testQualifiedStockOrderChecksEligibilityHaltsAndAttributesFill() public {
        partner = new MockQualifiedPartner();
        router.setQualifiedPartner(partner);
        IQualifiedExecutionPartner.OrderRequest memory request =
            IQualifiedExecutionPartner.OrderRequest({
                clientReference: keccak256("client-order-1"),
                assetId: STOCK_UID,
                side: IQualifiedExecutionPartner.Side.Buy,
                quantity: 10 * UNIT,
                limitPrice: 200 * UNIT,
                expiresAt: uint64(block.timestamp + 1 hours)
            });

        vm.expectRevert(BrokerRouter.IneligibleTrader.selector);
        vm.prank(TRADER);
        router.submitQualifiedOrder(BROKER_ID, address(stockToken), request);

        partner.setEligible(TRADER, STOCK_UID, true);
        vm.prank(TRADER);
        bytes32 orderId = router.submitQualifiedOrder(BROKER_ID, address(stockToken), request);
        partner.fill(router, orderId, 2_000 * UNIT, 5 * UNIT);

        (,,, uint64 trades, uint256 aum, uint256 volume, uint256 commission, uint256 reputation) =
            registry.brokers(BROKER_ID);
        _assertEq(trades, 1, "qualified trade");
        _assertEq(aum, 0, "qualified execution is non-custodial");
        _assertEq(volume, 2_000 * UNIT, "qualified volume");
        _assertEq(commission, 5 * UNIT, "qualified commission");
        _assertEq(reputation, 1, "qualified reputation");

        assets.setMarketState(address(stockToken), true, true, 1e18, uint64(block.timestamp));
        request.clientReference = keccak256("client-order-2");
        vm.expectRevert(BrokerRouter.AssetNotAllowed.selector);
        vm.prank(TRADER);
        router.submitQualifiedOrder(BROKER_ID, address(stockToken), request);
    }

    function testQualifiedStockOrderRejectsStaleMarketState() public {
        partner = new MockQualifiedPartner();
        router.setQualifiedPartner(partner);
        partner.setEligible(TRADER, STOCK_UID, true);
        assets.setMarketState(address(stockToken), true, false, 1e18, uint64(block.timestamp));
        vm.warp(block.timestamp + 2 hours);
        IQualifiedExecutionPartner.OrderRequest memory request =
            IQualifiedExecutionPartner.OrderRequest({
                clientReference: keccak256("stale-order"),
                assetId: STOCK_UID,
                side: IQualifiedExecutionPartner.Side.Buy,
                quantity: 1 * UNIT,
                limitPrice: 10 * UNIT,
                expiresAt: uint64(block.timestamp + 1 hours)
            });

        vm.expectRevert(BrokerRouter.AssetNotAllowed.selector);
        vm.prank(TRADER);
        router.submitQualifiedOrder(BROKER_ID, address(stockToken), request);
    }

    function testNftTransferMovesVaultControl() public {
        _depositBoth(1_000 * UNIT);
        vm.prank(BANKER);
        nft.transfer(BROKER_ID, BUYER);

        vm.expectRevert(BrokerVault.NotController.selector);
        vm.prank(BANKER);
        vault.withdraw(address(testUsd), 100 * UNIT, BANKER);

        vm.prank(BUYER);
        vault.withdraw(address(testUsd), 100 * UNIT, BUYER);
        _assertEq(testUsd.balanceOf(BUYER), 100 * UNIT, "new owner withdrawal");
    }

    function testOnlyIdentityNftCanUseAtomicOnboardingPath() public {
        vm.expectRevert(BrokerRegistry.OnlyBrokerNft.selector);
        vm.prank(BANKER);
        registry.registerBrokerFor(BROKER_ID, BANKER);
    }

    function testFuzzTestSwapMaintainsAccountedAum(uint96 rawAmount) public {
        _depositBoth(1_000_000 * UNIT);
        uint256 amount = UNIT + uint256(rawAmount) % (100_000 * UNIT);
        vm.prank(TRADER);
        testUsd.approve(address(router), type(uint256).max);
        vm.prank(TRADER);
        router.routeTestSwap(
            BROKER_ID,
            address(testUsd),
            address(testEth),
            amount,
            amount * 9_970 / 10_000,
            uint64(block.timestamp)
        );

        (,,,, uint256 aum,,,) = registry.brokers(BROKER_ID);
        uint256 vaultBalances =
            testUsd.balanceOf(address(vault)) + testEth.balanceOf(address(vault));
        _assertEq(aum, vaultBalances, "accounted aum matches balances");
    }

    function _depositBoth(uint256 amount) private {
        vm.prank(BANKER);
        testUsd.approve(address(vault), type(uint256).max);
        vm.prank(BANKER);
        vault.deposit(address(testUsd), amount);
        vm.prank(BANKER);
        testEth.approve(address(vault), type(uint256).max);
        vm.prank(BANKER);
        vault.deposit(address(testEth), amount);
    }

    function _assertEq(uint256 actual, uint256 expected, string memory reason) private pure {
        if (actual != expected) revert(reason);
    }
}

contract BrokerLicenseTest {
    VmLiquidity private constant vm =
        VmLiquidity(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant BANKER = address(0xB0B);
    address private constant BUYER = address(0xB0B2);

    BrokerLicense private license;
    BrokerRegistry private registry;

    function setUp() public {
        license = new BrokerLicense(address(this), true);
        RobinhoodAssetRegistry assets = new RobinhoodAssetRegistry(address(this));
        registry = new BrokerRegistry(
            address(this),
            IERC721Owner(address(license)),
            new Mock6551Registry(),
            address(0x6551),
            bytes32(uint256(1)),
            block.chainid,
            assets
        );
        registry.configureInfrastructure(address(0xBEEF), address(0xCAFE));
        license.setBrokerRegistry(address(registry));
    }

    function testLicenseMintsAndDynamicallyBindsToRegistry() public {
        vm.prank(BANKER);
        uint256 brokerId = license.mintLicense("LEDGER AND CO.");
        vm.prank(BANKER);
        (address account, address vault) = registry.registerBroker(brokerId);

        (address boundAccount, address boundVault) = license.bindingOf(brokerId);
        if (boundAccount != account || boundVault != vault) revert("license binding");
        if (license.ownerOf(brokerId) != BANKER) revert("license owner");
        if (bytes(license.tokenURI(brokerId)).length == 0) revert("metadata");

        vm.prank(BANKER);
        license.transferFrom(BANKER, BUYER, brokerId);
        if (registry.ownerOfBroker(brokerId) != BUYER) revert("dynamic controller");
    }

    function testPublicMintIsOnePerWallet() public {
        vm.prank(BANKER);
        license.mintLicense("LEDGER AND CO.");
        vm.expectRevert(BrokerLicense.AlreadyMinted.selector);
        vm.prank(BANKER);
        license.mintLicense("SECOND DESK");
    }

    function testEnterWallStreetMintsAndBindsInOneTransaction() public {
        vm.prank(BANKER);
        (uint256 brokerId, address account, address vault) =
            license.enterWallStreet("LEDGER AND CO.");
        if (brokerId == 0 || account == address(0) || vault == address(0)) {
            revert("one click onboarding");
        }
        (address boundAccount, address boundVault) = license.bindingOf(brokerId);
        if (boundAccount != account || boundVault != vault) revert("one click binding");
    }
}

contract BrokerSwapHandler {
    BrokerRouter private immutable router;
    BrokerVault private immutable vault;
    MockTestToken private immutable tokenA;
    MockTestToken private immutable tokenB;

    constructor(
        BrokerRouter router_,
        BrokerVault vault_,
        MockTestToken tokenA_,
        MockTestToken tokenB_
    ) {
        router = router_;
        vault = vault_;
        tokenA = tokenA_;
        tokenB = tokenB_;
        tokenA.approve(address(router_), type(uint256).max);
        tokenB.approve(address(router_), type(uint256).max);
    }

    function swap(uint96 rawAmount, bool aToB) external {
        MockTestToken tokenIn = aToB ? tokenA : tokenB;
        MockTestToken tokenOut = aToB ? tokenB : tokenA;
        uint256 traderBalance = tokenIn.balanceOf(address(this));
        uint256 maxByOutput = tokenOut.balanceOf(address(vault)) * 10_000 / 9_970;
        uint256 maximum = traderBalance < maxByOutput ? traderBalance : maxByOutput;
        if (maximum == 0) return;
        uint256 amount = 1 + uint256(rawAmount) % maximum;
        router.routeTestSwap(
            1,
            address(tokenIn),
            address(tokenOut),
            amount,
            amount * 9_970 / 10_000,
            uint64(block.timestamp)
        );
    }
}

contract BrokerLiquidityInvariant {
    MockBrokerNft private nft;
    Mock6551Registry private erc6551;
    MockTestToken private tokenA;
    MockTestToken private tokenB;
    RobinhoodAssetRegistry private assets;
    BrokerRegistry private registry;
    BankerHook private hook;
    BrokerRouter private router;
    BrokerVault private vault;
    BrokerSwapHandler private handler;

    function setUp() public {
        nft = new MockBrokerNft();
        erc6551 = new Mock6551Registry();
        tokenA = new MockTestToken("Invariant A", "INVA");
        tokenB = new MockTestToken("Invariant B", "INVB");
        assets = new RobinhoodAssetRegistry(address(this));
        assets.configureAsset(
            address(tokenA), bytes32(0), "INVA", RobinhoodAssetRegistry.AssetClass.CryptoTest, true
        );
        assets.configureAsset(
            address(tokenB), bytes32(0), "INVB", RobinhoodAssetRegistry.AssetClass.CryptoTest, true
        );
        assets.setMarketState(address(tokenA), true, false, 1e18, uint64(block.timestamp));
        assets.setMarketState(address(tokenB), true, false, 1e18, uint64(block.timestamp));
        nft.mint(address(this), 1);
        registry = new BrokerRegistry(
            address(this), nft, erc6551, address(0x6551), bytes32(0), block.chainid, assets
        );
        hook = new BankerHook(address(this), registry);
        router = new BrokerRouter(address(this), registry, assets, hook, 30);
        hook.setRouter(address(router));
        registry.configureInfrastructure(address(router), address(hook));
        (, address vaultAddress) = registry.registerBroker(1);
        vault = BrokerVault(vaultAddress);
        tokenA.mint(address(this), 100_000 * 1e6);
        tokenB.mint(address(this), 100_000 * 1e6);
        tokenA.approve(address(vault), type(uint256).max);
        tokenB.approve(address(vault), type(uint256).max);
        vault.deposit(address(tokenA), 100_000 * 1e6);
        vault.deposit(address(tokenB), 100_000 * 1e6);
        handler = new BrokerSwapHandler(router, vault, tokenA, tokenB);
        tokenA.mint(address(handler), 1_000_000 * 1e6);
        tokenB.mint(address(handler), 1_000_000 * 1e6);
    }

    function targetContracts() public view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function invariantAccountedAumEqualsDirectVaultBalances() public view {
        (,,,, uint256 aum,,,) = registry.brokers(1);
        uint256 balances = tokenA.balanceOf(address(vault)) + tokenB.balanceOf(address(vault));
        if (aum != balances) revert("aum invariant");
    }
}
