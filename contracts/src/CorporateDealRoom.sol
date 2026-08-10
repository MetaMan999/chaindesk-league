// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "./lib/Ownable.sol";

interface IDealRoomProfile {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IDealRoomGame {
    function currentSeason() external view returns (uint64);
    function seasonEndsAt() external view returns (uint64);
    function outcomeScore(uint64 seasonId, uint256 profileId) external view returns (uint256);
}

interface IDealRoomCrews {
    function crewOfProfile(uint256 profileId) external view returns (uint256);
    function headquartersFloor(uint256 crewId) external view returns (uint8);
    function getMembers(uint256 crewId) external view returns (uint256[] memory);
}

/// @notice Competitive fictional corporate mandates and paper offerings for banker crews.
/// @dev This module never receives funds and its allocations are non-transferable game records.
contract CorporateDealRoom is Ownable {
    error AlreadyPitched();
    error ExecutiveAccessLocked();
    error InvalidOffering();
    error InvalidPitch();
    error NoPitches();
    error NotProfileOwner();
    error OfferingClosed();
    error PitchWindowClosed();
    error TooManyPitches();
    error UnqualifiedFirm();

    uint8 public constant MAX_PITCHES = 16;

    struct Offering {
        bytes32 clientName;
        bytes12 ticker;
        bytes32 mandate;
        uint64 seasonId;
        uint64 pitchDeadline;
        uint8 minimumHeadquartersFloor;
        uint32 minimumReputation;
        uint32 reputationReward;
        uint128 paperAllocation;
        uint16 pitchCount;
        uint256 winnerCrewId;
        uint256 winningScore;
        bool active;
        bool finalized;
    }

    struct Pitch {
        uint256 leadProfileId;
        bytes32 strategyName;
        uint64 submittedAt;
        uint8 headquartersFloorAtPitch;
        uint32 reputationAtPitch;
        bool exists;
    }

    IDealRoomProfile public immutable profile;
    IDealRoomGame public immutable game;
    IDealRoomCrews public immutable crews;
    uint256 public offeringCount;

    mapping(uint256 => Offering) public offerings;
    mapping(uint256 => mapping(uint256 => Pitch)) public pitches;
    mapping(uint256 => uint256[]) private _offeringCrews;
    mapping(uint256 => mapping(uint256 => uint256[])) private _pitchRosters;
    mapping(uint256 => uint32) public firmReputation;
    mapping(uint256 => mapping(uint256 => uint128)) public paperAllocations;
    mapping(uint256 => uint32) public mandatesWon;

    event CorporateOfferingCreated(
        uint256 indexed offeringId,
        bytes32 indexed clientName,
        bytes12 ticker,
        uint64 indexed seasonId,
        uint64 pitchDeadline
    );
    event FirmPitchSubmitted(
        uint256 indexed offeringId,
        uint256 indexed crewId,
        uint256 indexed leadProfileId,
        bytes32 strategyName,
        uint256 rosterSize
    );
    event CorporateMandateAwarded(
        uint256 indexed offeringId,
        uint256 indexed crewId,
        uint256 score,
        uint256 reputationAwarded,
        uint256 paperAllocation
    );
    event CorporateOfferingCancelled(uint256 indexed offeringId);

    constructor(
        address initialOwner,
        IDealRoomProfile profile_,
        IDealRoomGame game_,
        IDealRoomCrews crews_
    ) Ownable(initialOwner) {
        if (
            address(profile_) == address(0) || address(game_) == address(0)
                || address(crews_) == address(0)
        ) revert ZeroAddress();
        profile = profile_;
        game = game_;
        crews = crews_;
    }

    function createOffering(
        bytes32 clientName,
        bytes12 ticker,
        bytes32 mandate,
        uint64 pitchDeadline,
        uint8 minimumHeadquartersFloor,
        uint32 minimumReputation,
        uint32 reputationReward,
        uint128 paperAllocation
    ) external onlyOwner returns (uint256 offeringId) {
        uint64 seasonId = game.currentSeason();
        if (
            clientName == bytes32(0) || ticker == bytes12(0) || mandate == bytes32(0)
                || pitchDeadline <= block.timestamp || pitchDeadline >= game.seasonEndsAt()
                || minimumHeadquartersFloor == 0 || minimumHeadquartersFloor > 100
                || reputationReward == 0 || reputationReward > 10_000 || paperAllocation == 0
        ) revert InvalidOffering();

        offeringId = ++offeringCount;
        offerings[offeringId] = Offering({
            clientName: clientName,
            ticker: ticker,
            mandate: mandate,
            seasonId: seasonId,
            pitchDeadline: pitchDeadline,
            minimumHeadquartersFloor: minimumHeadquartersFloor,
            minimumReputation: minimumReputation,
            reputationReward: reputationReward,
            paperAllocation: paperAllocation,
            pitchCount: 0,
            winnerCrewId: 0,
            winningScore: 0,
            active: true,
            finalized: false
        });
        emit CorporateOfferingCreated(offeringId, clientName, ticker, seasonId, pitchDeadline);
    }

    function submitPitch(uint256 offeringId, uint256 leadProfileId, bytes32 strategyName) external {
        Offering storage offering = offerings[offeringId];
        if (!offering.active || offering.finalized) revert OfferingClosed();
        if (block.timestamp > offering.pitchDeadline || game.currentSeason() != offering.seasonId) {
            revert PitchWindowClosed();
        }
        if (profile.ownerOf(leadProfileId) != msg.sender) revert NotProfileOwner();
        if (strategyName == bytes32(0)) revert InvalidPitch();

        uint256 crewId = crews.crewOfProfile(leadProfileId);
        if (crewId == 0) revert UnqualifiedFirm();
        if (pitches[offeringId][crewId].exists) revert AlreadyPitched();
        if (offering.pitchCount >= MAX_PITCHES) revert TooManyPitches();

        uint8 headquartersFloor = crews.headquartersFloor(crewId);
        uint32 reputation = firmReputation[crewId];
        if (
            headquartersFloor < offering.minimumHeadquartersFloor
                || reputation < offering.minimumReputation
        ) revert UnqualifiedFirm();

        uint256[] memory roster = crews.getMembers(crewId);
        if (roster.length == 0 || roster.length > 12) revert InvalidPitch();
        pitches[offeringId][crewId] = Pitch({
            leadProfileId: leadProfileId,
            strategyName: strategyName,
            submittedAt: uint64(block.timestamp),
            headquartersFloorAtPitch: headquartersFloor,
            reputationAtPitch: reputation,
            exists: true
        });
        _offeringCrews[offeringId].push(crewId);
        _pitchRosters[offeringId][crewId] = roster;
        offering.pitchCount++;
        emit FirmPitchSubmitted(offeringId, crewId, leadProfileId, strategyName, roster.length);
    }

    function cancelOffering(uint256 offeringId) external onlyOwner {
        Offering storage offering = offerings[offeringId];
        if (!offering.active || offering.finalized) revert OfferingClosed();
        offering.active = false;
        emit CorporateOfferingCancelled(offeringId);
    }

    /// @notice Deterministically awards the mandate after its season is closed.
    /// @dev Outcome score dominates; pre-pitch HQ and reputation provide modest tie-break strength.
    function finalizeOffering(uint256 offeringId)
        external
        returns (uint256 winningCrewId, uint256 winningScore)
    {
        Offering storage offering = offerings[offeringId];
        if (!offering.active || offering.finalized) revert OfferingClosed();
        if (game.currentSeason() <= offering.seasonId) revert PitchWindowClosed();

        uint256[] storage candidates = _offeringCrews[offeringId];
        if (candidates.length == 0) revert NoPitches();
        uint64 earliestSubmission = type(uint64).max;
        for (uint256 i; i < candidates.length; i++) {
            uint256 crewId = candidates[i];
            uint256 score = pitchScore(offeringId, crewId);
            uint64 submittedAt = pitches[offeringId][crewId].submittedAt;
            if (
                winningCrewId == 0 || score > winningScore
                    || (score == winningScore && submittedAt < earliestSubmission)
            ) {
                winningCrewId = crewId;
                winningScore = score;
                earliestSubmission = submittedAt;
            }
        }

        offering.active = false;
        offering.finalized = true;
        offering.winnerCrewId = winningCrewId;
        offering.winningScore = winningScore;
        firmReputation[winningCrewId] += offering.reputationReward;
        mandatesWon[winningCrewId]++;
        paperAllocations[winningCrewId][offeringId] = offering.paperAllocation;
        emit CorporateMandateAwarded(
            offeringId,
            winningCrewId,
            winningScore,
            offering.reputationReward,
            offering.paperAllocation
        );
    }

    function pitchScore(uint256 offeringId, uint256 crewId) public view returns (uint256 score) {
        Offering storage offering = offerings[offeringId];
        Pitch storage pitch = pitches[offeringId][crewId];
        if (!pitch.exists) revert InvalidPitch();
        uint256[] storage roster = _pitchRosters[offeringId][crewId];
        for (uint256 i; i < roster.length; i++) {
            score += game.outcomeScore(offering.seasonId, roster[i]);
        }
        score += uint256(pitch.headquartersFloorAtPitch) * 20;
        score += uint256(pitch.reputationAtPitch) * 5;
    }

    function executiveFloorOf(uint256 crewId) public view returns (uint8) {
        uint32 reputation = firmReputation[crewId];
        uint8 headquartersFloor = crews.headquartersFloor(crewId);
        if (reputation >= 5_000 && headquartersFloor >= 80) return 100;
        if (reputation >= 2_500 && headquartersFloor >= 60) return 90;
        if (reputation >= 1_000 && headquartersFloor >= 40) return 80;
        if (reputation >= 250 && headquartersFloor >= 21) return 70;
        return 0;
    }

    function requireExecutiveAccess(uint256 crewId, uint8 floor) external view {
        if (floor != 70 && floor != 80 && floor != 90 && floor != 100) {
            revert InvalidOffering();
        }
        if (executiveFloorOf(crewId) < floor) revert ExecutiveAccessLocked();
    }

    function getOfferingCrews(uint256 offeringId) external view returns (uint256[] memory) {
        return _offeringCrews[offeringId];
    }

    function getPitchRoster(uint256 offeringId, uint256 crewId)
        external
        view
        returns (uint256[] memory)
    {
        if (!pitches[offeringId][crewId].exists) revert InvalidPitch();
        return _pitchRosters[offeringId][crewId];
    }

    function simulationNotice() external pure returns (string memory) {
        return "Fictional corporate mandates and paper allocations only. No securities, custody, or cash value.";
    }
}
