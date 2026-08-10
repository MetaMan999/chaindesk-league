// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {
    BankerWorkFloor,
    IRandomnessProvider,
    IWorkFloorGame,
    IWorkFloorProfile
} from "../src/BankerWorkFloor.sol";
import {
    ChainlinkVrfV25Adapter,
    IVRFCoordinatorV2Plus
} from "../src/randomness/ChainlinkVrfV25Adapter.sol";
import { LocalRandomnessProvider } from "../src/randomness/LocalRandomnessProvider.sol";

interface VmWorkFloor {
    function addr(uint256 privateKey) external returns (address);
    function envAddress(string calldata name) external returns (address);
    function envBytes32(string calldata name) external returns (bytes32);
    function envOr(string calldata name, address defaultValue) external returns (address);
    function envOr(string calldata name, bool defaultValue) external returns (bool);
    function envOr(string calldata name, uint256 defaultValue) external returns (uint256);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Deploys the optional work/wardrobe module after the core game.
/// @dev Local chains receive the explicit mock. Every public chain requires caller-supplied VRF v2.5 data.
contract DeployWorkFloor {
    error PublicVrfConfigurationRequired();
    error InvalidVrfSettings();
    error UnsupportedChain(uint256 chainId);

    VmWorkFloor private constant vm =
        VmWorkFloor(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (BankerWorkFloor workFloor, address provider) {
        bool supported = block.chainid == 31_337 || block.chainid == 11_155_111
            || block.chainid == 84_532 || block.chainid == 46_630;
        if (!supported && !vm.envOr("ALLOW_UNSAFE_CHAIN", false)) {
            revert UnsupportedChain(block.chainid);
        }

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address treasury = vm.envOr("TREASURY", deployer);
        address profile = vm.envAddress("PROFILE_ADDRESS");
        address game = vm.envAddress("GAME_ADDRESS");

        vm.startBroadcast(privateKey);
        if (block.chainid == 31_337) {
            LocalRandomnessProvider localProvider = new LocalRandomnessProvider(deployer);
            workFloor = new BankerWorkFloor(
                IWorkFloorProfile(profile),
                IWorkFloorGame(game),
                IRandomnessProvider(address(localProvider))
            );
            localProvider.setConsumer(address(workFloor));
            localProvider.transferOwnership(treasury);
            provider = address(localProvider);
        } else {
            address coordinator = vm.envAddress("VRF_COORDINATOR");
            bytes32 keyHash = vm.envBytes32("VRF_KEY_HASH");
            uint256 subscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");
            uint256 requestConfirmations = vm.envOr("VRF_REQUEST_CONFIRMATIONS", uint256(3));
            uint256 callbackGasLimit = vm.envOr("VRF_CALLBACK_GAS_LIMIT", uint256(250_000));
            if (coordinator == address(0) || keyHash == bytes32(0) || subscriptionId == 0) {
                revert PublicVrfConfigurationRequired();
            }
            if (
                requestConfirmations == 0 || requestConfirmations > type(uint16).max
                    || callbackGasLimit < 50_000 || callbackGasLimit > 2_500_000
            ) revert InvalidVrfSettings();
            ChainlinkVrfV25Adapter adapter = new ChainlinkVrfV25Adapter(
                deployer,
                IVRFCoordinatorV2Plus(coordinator),
                keyHash,
                subscriptionId,
                uint16(requestConfirmations),
                uint32(callbackGasLimit),
                vm.envOr("VRF_NATIVE_PAYMENT", false)
            );
            workFloor = new BankerWorkFloor(
                IWorkFloorProfile(profile),
                IWorkFloorGame(game),
                IRandomnessProvider(address(adapter))
            );
            adapter.setConsumer(address(workFloor));
            adapter.transferOwnership(treasury);
            provider = address(adapter);
        }
        vm.stopBroadcast();
    }
}
