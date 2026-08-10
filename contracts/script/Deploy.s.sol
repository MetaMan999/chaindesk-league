// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BankerProfile } from "../src/BankerProfile.sol";
import { BrokerGame } from "../src/BrokerGame.sol";
import {
    CorporateDealRoom,
    IDealRoomCrews,
    IDealRoomGame,
    IDealRoomProfile
} from "../src/CorporateDealRoom.sol";
import { CrewRegistry, ICrewGame, ICrewProfile } from "../src/CrewRegistry.sol";
import { EligibilityRegistry } from "../src/EligibilityRegistry.sol";
import { PaperAsset } from "../src/PaperAsset.sol";
import {
    IAchievementGame,
    IEligibilityView,
    ReadOnlyAchievementRegistry
} from "../src/ReadOnlyAchievementRegistry.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function envAddress(string calldata name) external returns (address);
    function envOr(string calldata name, address defaultValue) external returns (address);
    function envOr(string calldata name, bool defaultValue) external returns (bool);
    function envOr(string calldata name, uint256 defaultValue) external returns (uint256);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract Deploy {
    error MainnetDeploymentDisabled(uint256 chainId);

    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run()
        external
        returns (
            BankerProfile profile,
            PaperAsset assets,
            BrokerGame game,
            EligibilityRegistry eligibility,
            ReadOnlyAchievementRegistry achievements,
            CrewRegistry crews,
            CorporateDealRoom dealRoom
        )
    {
        bool allowUnsafeChain = vm.envOr("ALLOW_UNSAFE_CHAIN", false);
        bool supported = block.chainid == 31_337 || block.chainid == 11_155_111
            || block.chainid == 84_532 || block.chainid == 46_630;
        if (!supported && !allowUnsafeChain) revert MainnetDeploymentDisabled(block.chainid);

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address treasury = vm.envOr("TREASURY", deployer);
        uint256 mintFee = vm.envOr("PROFILE_MINT_FEE", uint256(0.001 ether));

        vm.startBroadcast(privateKey);
        profile = new BankerProfile(deployer);
        assets = new PaperAsset(deployer);
        game = new BrokerGame(deployer, profile, assets, treasury, mintFee, block.chainid);
        profile.setGame(address(game));
        assets.setGame(address(game));
        eligibility = new EligibilityRegistry(deployer);
        achievements = new ReadOnlyAchievementRegistry(
            deployer, IEligibilityView(address(eligibility)), IAchievementGame(address(game))
        );
        game.setAchievementRegistry(address(achievements));
        crews = new CrewRegistry(ICrewProfile(address(profile)), ICrewGame(address(game)));
        dealRoom = new CorporateDealRoom(
            deployer,
            IDealRoomProfile(address(profile)),
            IDealRoomGame(address(game)),
            IDealRoomCrews(address(crews))
        );

        assets.addAsset("NOVA", "Nova Robotics", 42 * 1e6, 350);
        assets.addAsset("QUANT", "Quantum Grid", 88 * 1e6, 250);
        assets.addAsset("HELIOS", "Helios Transit", 27 * 1e6, 425);
        assets.addAsset("ARCADE", "Arcade Cloud", 64 * 1e6, 500);

        profile.transferOwnership(treasury);
        assets.transferOwnership(treasury);
        game.transferOwnership(treasury);
        eligibility.transferOwnership(treasury);
        achievements.transferOwnership(treasury);
        dealRoom.transferOwnership(treasury);
        vm.stopBroadcast();
    }
}
