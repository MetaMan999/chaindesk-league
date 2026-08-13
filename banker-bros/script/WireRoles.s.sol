// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ScriptBase } from "./ScriptBase.sol";
import { CommissionAccounting } from "../src/CommissionAccounting.sol";
import { ReputationEngine } from "../src/ReputationEngine.sol";
import { LiquidityAttribution } from "../src/LiquidityAttribution.sol";

contract WireRoles is ScriptBase {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address router = vm.envAddress("ROUTER_ADDRESS");
        address hook = vm.envAddress("BANKER_HOOK_ADDRESS");
        CommissionAccounting accounting = CommissionAccounting(vm.envAddress("ACCOUNTING_ADDRESS"));
        ReputationEngine reputation = ReputationEngine(vm.envAddress("REPUTATION_ADDRESS"));
        LiquidityAttribution attribution =
            LiquidityAttribution(vm.envAddress("ATTRIBUTION_ADDRESS"));
        bytes32 recorder = keccak256("RECORDER_ROLE");

        vm.startBroadcast(key);
        accounting.setRole(recorder, router, true);
        reputation.setRole(recorder, router, true);
        attribution.setRole(recorder, router, true);
        if (hook != address(0)) attribution.setRole(recorder, hook, true);
        vm.stopBroadcast();
    }
}
