// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ScriptBase } from "./ScriptBase.sol";
import { BankerBrosCollection } from "../src/BankerBrosCollection.sol";

contract DeployCollection is ScriptBase {
    event CollectionDeployment(
        address indexed collection, address indexed owner, uint256 mintPrice
    );

    function run() external returns (BankerBrosCollection collection) {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        uint256 configuredPrice = vm.envUint("COLLECTION_MINT_PRICE_WEI");
        if (configuredPrice > type(uint96).max) revert("MINT_PRICE_TOO_LARGE");

        vm.startBroadcast(key);
        collection = new BankerBrosCollection(
            admin,
            vm.envAddress("COLLECTION_PAYOUT"),
            vm.envAddress("COLLECTION_ROYALTY_RECEIVER"),
            uint96(configuredPrice),
            vm.envString("COLLECTION_PLACEHOLDER_URI"),
            vm.envString("COLLECTION_CONTRACT_URI")
        );
        vm.stopBroadcast();
        emit CollectionDeployment(address(collection), admin, configuredPrice);
    }
}
