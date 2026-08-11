// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BankerHook } from "../src/BankerHook.sol";
import { BrokerLicense } from "../src/BrokerLicense.sol";
import { BrokerRegistry } from "../src/BrokerRegistry.sol";
import { BrokerRouter } from "../src/BrokerRouter.sol";
import { FaucetTestAsset } from "../src/FaucetTestAsset.sol";
import { IERC6551Registry } from "../src/interfaces/IERC6551Registry.sol";
import { IERC721Owner } from "../src/interfaces/ITokenInterfaces.sol";
import { RobinhoodAssetRegistry } from "../src/RobinhoodAssetRegistry.sol";

interface VmBrokerLiquidity {
    function addr(uint256 privateKey) external returns (address);
    function envAddress(string calldata name) external returns (address);
    function envOr(string calldata name, address defaultValue) external returns (address);
    function envOr(string calldata name, bool defaultValue) external returns (bool);
    function envOr(string calldata name, uint256 defaultValue) external returns (uint256);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Deploys the external-NFT/ERC-6551 broker liquidity layer.
/// @dev Defaults to local or Robinhood Chain Testnet. Robinhood Stock Tokens are never registered
///      automatically; canonical addresses and market state must be synchronized separately.
contract DeployBrokerLiquidity {
    error IdentityNftMatchesFungibleToken();
    error UnsupportedChain(uint256 chainId);

    VmBrokerLiquidity private constant vm =
        VmBrokerLiquidity(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run()
        external
        returns (
            RobinhoodAssetRegistry assets,
            BrokerRegistry registry,
            BankerHook hook,
            BrokerRouter router,
            FaucetTestAsset testUsd,
            FaucetTestAsset testEth,
            BrokerLicense license
        )
    {
        bool allowUnsafeChain = vm.envOr("ALLOW_UNSAFE_CHAIN", false);
        bool supported = block.chainid == 31_337 || block.chainid == 46_630;
        if (!supported && !allowUnsafeChain) revert UnsupportedChain(block.chainid);

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address treasury = vm.envOr("TREASURY", deployer);
        address brokerNft = vm.envOr("BROKER_IDENTITY_NFT_ADDRESS", address(0));
        address stonkBrokerToken = vm.envOr("STONKBROKER_TOKEN_ADDRESS", address(0));
        address erc6551Registry = vm.envAddress("ERC6551_REGISTRY_ADDRESS");
        address accountImplementation = vm.envAddress("ERC6551_ACCOUNT_IMPLEMENTATION");
        uint256 nftChainId = vm.envOr("BROKER_IDENTITY_NFT_CHAIN_ID", block.chainid);
        uint256 accountSalt = vm.envOr("ERC6551_ACCOUNT_SALT", uint256(0));
        uint256 feeBps = vm.envOr("TEST_SWAP_FEE_BPS", uint256(30));
        if (brokerNft == stonkBrokerToken && stonkBrokerToken != address(0)) {
            revert IdentityNftMatchesFungibleToken();
        }

        vm.startBroadcast(privateKey);
        if (brokerNft == address(0)) {
            license = new BrokerLicense(deployer, true);
            brokerNft = address(license);
            nftChainId = block.chainid;
        }
        assets = new RobinhoodAssetRegistry(deployer);
        testUsd = new FaucetTestAsset("Banker Bros Test USD", "bbUSD");
        testEth = new FaucetTestAsset("Banker Bros Test Ether", "bbETH");
        assets.configureAsset(
            address(testUsd),
            bytes32(0),
            "bbUSD",
            RobinhoodAssetRegistry.AssetClass.CryptoTest,
            true
        );
        assets.configureAsset(
            address(testEth),
            bytes32(0),
            "bbETH",
            RobinhoodAssetRegistry.AssetClass.CryptoTest,
            true
        );
        assets.setMarketState(address(testUsd), true, false, 1e18, uint64(block.timestamp));
        assets.setMarketState(address(testEth), true, false, 1e18, uint64(block.timestamp));
        registry = new BrokerRegistry(
            deployer,
            IERC721Owner(brokerNft),
            IERC6551Registry(erc6551Registry),
            accountImplementation,
            bytes32(accountSalt),
            nftChainId,
            assets
        );
        hook = new BankerHook(deployer, registry);
        router = new BrokerRouter(deployer, registry, assets, hook, uint16(feeBps));
        hook.setRouter(address(router));
        registry.configureInfrastructure(address(router), address(hook));
        if (address(license) != address(0)) {
            license.setBrokerRegistry(address(registry));
            license.transferOwnership(treasury);
        }

        assets.transferOwnership(treasury);
        registry.transferOwnership(treasury);
        hook.transferOwnership(treasury);
        router.transferOwnership(treasury);
        vm.stopBroadcast();
    }
}
