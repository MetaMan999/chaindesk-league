// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ScriptBase } from "./ScriptBase.sol";
import { BankerHook } from "../src/BankerHook.sol";

interface ICreate2Deployer {
    function deploy(bytes32 salt, bytes calldata initCode) external returns (address);
}

contract DeployHook is ScriptBase {
    uint160 internal constant ALL_HOOK_MASK = (1 << 14) - 1;
    uint160 internal constant AFTER_SWAP_FLAG = 1 << 6;
    error WrongPermissionBits(address deployed);

    function run() external returns (address hook) {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        bytes32 salt = vm.envBytes32("HOOK_SALT");
        address create2Deployer = vm.envAddress("CREATE2_DEPLOYER");
        bytes memory initCode = abi.encodePacked(
            type(BankerHook).creationCode,
            abi.encode(
                vm.envAddress("POOL_MANAGER"),
                vm.envAddress("REGISTRY_ADDRESS"),
                vm.envAddress("ATTRIBUTION_ADDRESS"),
                vm.envAddress("ADMIN_ADDRESS"),
                vm.envAddress("GUARDIAN_ADDRESS")
            )
        );

        vm.startBroadcast(key);
        hook = ICreate2Deployer(create2Deployer).deploy(salt, initCode);
        vm.stopBroadcast();
        if (uint160(hook) & ALL_HOOK_MASK != AFTER_SWAP_FLAG) {
            revert WrongPermissionBits(hook);
        }
    }
}
