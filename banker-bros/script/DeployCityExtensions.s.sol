// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ScriptBase } from "./ScriptBase.sol";
import { ERC1967Proxy } from "../src/lib/ERC1967Proxy.sol";
import { BankerBroAccountFactory } from "../src/BankerBroAccountFactory.sol";
import { CityDealDesk } from "../src/CityDealDesk.sol";

contract DeployCityExtensions is ScriptBase {
    event CityExtensionsDeployment(address indexed accountFactory, address indexed dealDesk);

    function run()
        external
        returns (BankerBroAccountFactory accountFactory, CityDealDesk dealDesk)
    {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address guardian = vm.envAddress("GUARDIAN_ADDRESS");
        address collection = vm.envAddress("COLLECTION_ADDRESS");
        address registry = vm.envAddress("REGISTRY_ADDRESS");

        vm.startBroadcast(key);
        accountFactory = new BankerBroAccountFactory(collection);
        CityDealDesk implementation = new CityDealDesk();
        dealDesk = CityDealDesk(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        CityDealDesk.initialize, (admin, guardian, registry, uint64(2 days))
                    )
                )
            )
        );
        vm.stopBroadcast();
        emit CityExtensionsDeployment(address(accountFactory), address(dealDesk));
    }
}
