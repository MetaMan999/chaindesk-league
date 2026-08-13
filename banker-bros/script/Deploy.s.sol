// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ScriptBase } from "./ScriptBase.sol";
import { ERC1967Proxy } from "../src/lib/ERC1967Proxy.sol";
import { BrokerRegistry } from "../src/BrokerRegistry.sol";
import { CommissionAccounting } from "../src/CommissionAccounting.sol";
import { ReputationEngine } from "../src/ReputationEngine.sol";
import { LiquidityAttribution } from "../src/LiquidityAttribution.sol";
import { BrokerRouter } from "../src/BrokerRouter.sol";
import { BrokerVaultFactory } from "../src/BrokerVaultFactory.sol";

interface IRoleAdmin {
    function setRole(bytes32 role, address account, bool enabled) external;
}

contract Deploy is ScriptBase {
    uint64 internal constant UPGRADE_DELAY = 2 days;

    struct Config {
        address admin;
        address guardian;
        address treasury;
        address collection;
        address bootstrapAdmin;
        uint32 season;
    }

    struct Addresses {
        BrokerRegistry registry;
        CommissionAccounting accounting;
        ReputationEngine reputation;
        LiquidityAttribution attribution;
        BrokerRouter router;
        BrokerVaultFactory factory;
    }

    event Deployment(
        address registry,
        address accounting,
        address reputation,
        address attribution,
        address router,
        address vaultFactory
    );

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        Config memory config = Config({
            admin: vm.envAddress("ADMIN_ADDRESS"),
            guardian: vm.envAddress("GUARDIAN_ADDRESS"),
            treasury: vm.envAddress("TREASURY_ADDRESS"),
            collection: vm.envAddress("BROKER_IDENTITY_NFT"),
            bootstrapAdmin: vm.addr(deployerKey),
            season: uint32(vm.envUint("SEASON_ID"))
        });

        vm.startBroadcast(deployerKey);
        Addresses memory deployed;
        deployed.registry = _deployRegistry(config);
        deployed.accounting = _deployAccounting(config, deployed.registry);
        deployed.reputation = _deployReputation(config, deployed.registry);
        deployed.attribution = _deployAttribution(config, deployed.registry);
        deployed.router = _deployRouter(config, deployed);
        deployed.factory = _deployFactory(config, deployed.registry, deployed.router);
        _wireAndHandoff(config, deployed);
        vm.stopBroadcast();
        emit Deployment(
            address(deployed.registry),
            address(deployed.accounting),
            address(deployed.reputation),
            address(deployed.attribution),
            address(deployed.router),
            address(deployed.factory)
        );
    }

    function _deployRegistry(Config memory config) internal returns (BrokerRegistry deployed) {
        BrokerRegistry implementation = new BrokerRegistry();
        deployed = BrokerRegistry(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        BrokerRegistry.initialize,
                        (
                            config.bootstrapAdmin,
                            config.guardian,
                            config.collection,
                            config.season,
                            UPGRADE_DELAY
                        )
                    )
                )
            )
        );
    }

    function _deployAccounting(Config memory config, BrokerRegistry registry)
        internal
        returns (CommissionAccounting deployed)
    {
        CommissionAccounting implementation = new CommissionAccounting();
        deployed = CommissionAccounting(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        CommissionAccounting.initialize,
                        (
                            config.bootstrapAdmin,
                            config.guardian,
                            address(registry),
                            config.treasury,
                            uint16(1_000),
                            UPGRADE_DELAY
                        )
                    )
                )
            )
        );
    }

    function _deployReputation(Config memory config, BrokerRegistry registry)
        internal
        returns (ReputationEngine deployed)
    {
        ReputationEngine implementation = new ReputationEngine();
        deployed = ReputationEngine(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        ReputationEngine.initialize,
                        (config.bootstrapAdmin, config.guardian, address(registry), UPGRADE_DELAY)
                    )
                )
            )
        );
    }

    function _deployAttribution(Config memory config, BrokerRegistry registry)
        internal
        returns (LiquidityAttribution deployed)
    {
        LiquidityAttribution implementation = new LiquidityAttribution();
        deployed = LiquidityAttribution(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        LiquidityAttribution.initialize,
                        (config.bootstrapAdmin, config.guardian, address(registry), UPGRADE_DELAY)
                    )
                )
            )
        );
    }

    function _deployRouter(Config memory config, Addresses memory deployed)
        internal
        returns (BrokerRouter router)
    {
        BrokerRouter implementation = new BrokerRouter();
        router = BrokerRouter(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        BrokerRouter.initialize,
                        (
                            config.bootstrapAdmin,
                            config.guardian,
                            address(deployed.registry),
                            address(deployed.accounting),
                            address(deployed.reputation),
                            address(deployed.attribution),
                            UPGRADE_DELAY
                        )
                    )
                )
            )
        );
    }

    function _deployFactory(Config memory config, BrokerRegistry registry, BrokerRouter router)
        internal
        returns (BrokerVaultFactory deployed)
    {
        BrokerVaultFactory implementation = new BrokerVaultFactory();
        deployed = BrokerVaultFactory(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        BrokerVaultFactory.initialize,
                        (
                            config.bootstrapAdmin,
                            config.guardian,
                            address(registry),
                            address(router),
                            UPGRADE_DELAY
                        )
                    )
                )
            )
        );
    }

    function _wireAndHandoff(Config memory config, Addresses memory deployed) internal {
        bytes32 adminRole = bytes32(0);
        bytes32 upgraderRole = keccak256("UPGRADER_ROLE");
        bytes32 recorderRole = keccak256("RECORDER_ROLE");

        deployed.accounting.setRole(recorderRole, address(deployed.router), true);
        deployed.reputation.setRole(recorderRole, address(deployed.router), true);
        deployed.attribution.setRole(recorderRole, address(deployed.router), true);

        address[6] memory modules = [
            address(deployed.registry),
            address(deployed.accounting),
            address(deployed.reputation),
            address(deployed.attribution),
            address(deployed.router),
            address(deployed.factory)
        ];
        if (config.admin == config.bootstrapAdmin) return;
        for (uint256 i; i < modules.length; ++i) {
            IRoleAdmin(modules[i]).setRole(adminRole, config.admin, true);
            IRoleAdmin(modules[i]).setRole(upgraderRole, config.admin, true);
            IRoleAdmin(modules[i]).setRole(upgraderRole, config.bootstrapAdmin, false);
            IRoleAdmin(modules[i]).setRole(adminRole, config.bootstrapAdmin, false);
        }
    }
}
