// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "./lib/Ownable.sol";

interface IERC20BalanceView {
    function balanceOf(address account) external view returns (uint256);
}

interface IEligibilityView {
    function isEligible(bytes32 programId, address account) external view returns (bool);
}

interface IAchievementGame {
    function recordReadOnlyAchievement(uint256 profileId, address claimant) external;
}

/// @notice Opt-in achievements that read an allowlisted balance but never custody or move the asset.
contract ReadOnlyAchievementRegistry is Ownable {
    error AlreadyClaimed();
    error Ineligible();
    error InsufficientObservedBalance();
    error ProgramInactive();

    struct Program {
        address observedToken;
        uint256 minimumBalance;
        bytes32 badgeName;
        bool active;
    }

    IEligibilityView public immutable eligibility;
    IAchievementGame public immutable game;
    mapping(bytes32 => Program) public programs;
    mapping(bytes32 => mapping(address => bool)) public claimed;

    event AchievementClaimed(
        bytes32 indexed programId, address indexed claimant, uint256 indexed profileId
    );
    event ProgramConfigured(
        bytes32 indexed programId,
        address indexed observedToken,
        uint256 minimumBalance,
        bytes32 badgeName,
        bool active
    );

    constructor(address initialOwner, IEligibilityView eligibility_, IAchievementGame game_)
        Ownable(initialOwner)
    {
        if (address(eligibility_) == address(0) || address(game_) == address(0)) {
            revert ZeroAddress();
        }
        eligibility = eligibility_;
        game = game_;
    }

    function configureProgram(
        bytes32 programId,
        address observedToken,
        uint256 minimumBalance,
        bytes32 badgeName,
        bool active
    ) external onlyOwner {
        if (observedToken == address(0)) revert ZeroAddress();
        programs[programId] = Program(observedToken, minimumBalance, badgeName, active);
        emit ProgramConfigured(programId, observedToken, minimumBalance, badgeName, active);
    }

    function claim(bytes32 programId, uint256 profileId) external {
        Program memory program = programs[programId];
        if (!program.active) revert ProgramInactive();
        if (claimed[programId][msg.sender]) revert AlreadyClaimed();
        if (!eligibility.isEligible(programId, msg.sender)) revert Ineligible();
        if (IERC20BalanceView(program.observedToken).balanceOf(msg.sender) < program.minimumBalance)
        {
            revert InsufficientObservedBalance();
        }
        claimed[programId][msg.sender] = true;
        game.recordReadOnlyAchievement(profileId, msg.sender);
        emit AchievementClaimed(programId, msg.sender, profileId);
    }
}

