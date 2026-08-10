// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ICrewProfile {
    function ownerOf(uint256 tokenId) external view returns (address);
    function officeRatingOf(uint256 tokenId) external view returns (uint16);
}

interface ICrewGame {
    function effectiveTier(uint256 profileId) external view returns (uint8);
    function towerFloorOf(uint256 profileId) external view returns (uint8);
    function outcomeScore(uint64 seasonId, uint256 profileId) external view returns (uint256);
    function currentSeason() external view returns (uint64);
}

/// @notice Modular social registry for ChainDesk banker crews.
/// @dev Crews aggregate existing outcome scores. They cannot trade, custody assets, or modify score.
contract CrewRegistry {
    error AlreadyInCrew();
    error CaptainMustTransfer();
    error CrewFull();
    error FloorTooLow();
    error InvalidCrew();
    error InvalidName();
    error InvalidRole();
    error NoInvitation();
    error NotCaptain();
    error NotMember();
    error NotProfileOwner();
    error ProfileInactive();
    error ZeroAddress();

    uint8 public constant MAX_MEMBERS = 12;
    uint8 public constant CREW_CREATION_FLOOR = 21;

    struct Crew {
        bytes32 name;
        uint256 captainProfileId;
        uint64 createdAt;
        uint16 memberCount;
        bool active;
    }

    ICrewProfile public immutable profile;
    ICrewGame public immutable game;
    uint256 public crewCount;

    mapping(uint256 => Crew) public crews;
    mapping(bytes32 => uint256) public crewIdByName;
    mapping(uint256 => uint256) public crewOfProfile;
    mapping(uint256 => uint8) public roleOfProfile;
    mapping(uint256 => uint64) public joinedSeasonOfProfile;
    mapping(uint256 => mapping(uint256 => bool)) public invitations;
    mapping(uint256 => uint256[]) private _members;

    event CaptainTransferred(
        uint256 indexed crewId, uint256 indexed previousCaptain, uint256 indexed newCaptain
    );
    event CrewCreated(uint256 indexed crewId, uint256 indexed captainProfileId, bytes32 name);
    event CrewInvitation(uint256 indexed crewId, uint256 indexed profileId, bool active);
    event CrewJoined(uint256 indexed crewId, uint256 indexed profileId, uint8 role);
    event CrewLeft(uint256 indexed crewId, uint256 indexed profileId);
    event CrewRoleUpdated(uint256 indexed crewId, uint256 indexed profileId, uint8 role);

    constructor(ICrewProfile profile_, ICrewGame game_) {
        if (address(profile_) == address(0) || address(game_) == address(0)) revert ZeroAddress();
        profile = profile_;
        game = game_;
    }

    function createCrew(bytes32 name, uint256 captainProfileId) external returns (uint256 crewId) {
        _requireProfileOwner(captainProfileId);
        if (!_validName(name)) revert InvalidName();
        if (crewIdByName[name] != 0) revert InvalidName();
        if (crewOfProfile[captainProfileId] != 0) revert AlreadyInCrew();
        if (game.effectiveTier(captainProfileId) == 0) revert ProfileInactive();
        if (game.towerFloorOf(captainProfileId) < CREW_CREATION_FLOOR) revert FloorTooLow();

        crewId = ++crewCount;
        crews[crewId] = Crew({
            name: name,
            captainProfileId: captainProfileId,
            createdAt: uint64(block.timestamp),
            memberCount: 1,
            active: true
        });
        crewOfProfile[captainProfileId] = crewId;
        crewIdByName[name] = crewId;
        roleOfProfile[captainProfileId] = 3;
        joinedSeasonOfProfile[captainProfileId] = game.currentSeason();
        _members[crewId].push(captainProfileId);
        emit CrewCreated(crewId, captainProfileId, name);
        emit CrewJoined(crewId, captainProfileId, 3);
    }

    function inviteProfile(uint256 crewId, uint256 profileId) external {
        Crew storage crew = _requireCaptain(crewId);
        if (crew.memberCount >= MAX_MEMBERS) revert CrewFull();
        if (crewOfProfile[profileId] != 0) revert AlreadyInCrew();
        if (game.effectiveTier(profileId) == 0) revert ProfileInactive();
        profile.ownerOf(profileId);
        invitations[crewId][profileId] = true;
        emit CrewInvitation(crewId, profileId, true);
    }

    function cancelInvitation(uint256 crewId, uint256 profileId) external {
        _requireCaptain(crewId);
        invitations[crewId][profileId] = false;
        emit CrewInvitation(crewId, profileId, false);
    }

    function acceptInvitation(uint256 crewId, uint256 profileId) external {
        _requireProfileOwner(profileId);
        Crew storage crew = crews[crewId];
        if (!crew.active) revert InvalidCrew();
        if (!invitations[crewId][profileId]) revert NoInvitation();
        if (crew.memberCount >= MAX_MEMBERS) revert CrewFull();
        if (crewOfProfile[profileId] != 0) revert AlreadyInCrew();
        if (game.effectiveTier(profileId) == 0) revert ProfileInactive();

        invitations[crewId][profileId] = false;
        crewOfProfile[profileId] = crewId;
        roleOfProfile[profileId] = 2;
        joinedSeasonOfProfile[profileId] = game.currentSeason();
        crew.memberCount++;
        _members[crewId].push(profileId);
        emit CrewInvitation(crewId, profileId, false);
        emit CrewJoined(crewId, profileId, 2);
    }

    function setRole(uint256 crewId, uint256 profileId, uint8 role) external {
        Crew storage crew = _requireCaptain(crewId);
        if (role == 0 || role > 2) revert InvalidRole();
        if (crewOfProfile[profileId] != crewId) revert NotMember();
        if (profileId == crew.captainProfileId) revert InvalidRole();
        roleOfProfile[profileId] = role;
        emit CrewRoleUpdated(crewId, profileId, role);
    }

    function transferCaptain(uint256 crewId, uint256 newCaptainProfileId) external {
        Crew storage crew = _requireCaptain(crewId);
        if (crewOfProfile[newCaptainProfileId] != crewId) revert NotMember();
        uint256 previousCaptain = crew.captainProfileId;
        roleOfProfile[previousCaptain] = 2;
        roleOfProfile[newCaptainProfileId] = 3;
        crew.captainProfileId = newCaptainProfileId;
        emit CaptainTransferred(crewId, previousCaptain, newCaptainProfileId);
    }

    function leaveCrew(uint256 profileId) external {
        _requireProfileOwner(profileId);
        uint256 crewId = crewOfProfile[profileId];
        if (crewId == 0) revert NotMember();
        Crew storage crew = crews[crewId];
        if (profileId == crew.captainProfileId && crew.memberCount > 1) {
            revert CaptainMustTransfer();
        }

        uint256[] storage members = _members[crewId];
        for (uint256 i; i < members.length; i++) {
            if (members[i] == profileId) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }
        crew.memberCount--;
        crewOfProfile[profileId] = 0;
        roleOfProfile[profileId] = 0;
        joinedSeasonOfProfile[profileId] = 0;
        if (crew.memberCount == 0) crew.active = false;
        emit CrewLeft(crewId, profileId);
    }

    function getMembers(uint256 crewId) external view returns (uint256[] memory) {
        if (!crews[crewId].active) revert InvalidCrew();
        return _members[crewId];
    }

    function headquartersFloor(uint256 crewId) public view returns (uint8) {
        uint256[] storage members = _members[crewId];
        if (!crews[crewId].active || members.length == 0) revert InvalidCrew();
        uint256 total;
        for (uint256 i; i < members.length; i++) {
            total += game.towerFloorOf(members[i]);
        }
        return uint8(total / members.length);
    }

    function crewSeasonScore(uint256 crewId, uint64 seasonId)
        external
        view
        returns (uint256 score)
    {
        uint256[] storage members = _members[crewId];
        if (!crews[crewId].active) revert InvalidCrew();
        for (uint256 i; i < members.length; i++) {
            if (joinedSeasonOfProfile[members[i]] <= seasonId) {
                score += game.outcomeScore(seasonId, members[i]);
            }
        }
    }

    function crewOfficeRating(uint256 crewId) external view returns (uint256 rating) {
        uint256[] storage members = _members[crewId];
        if (!crews[crewId].active) revert InvalidCrew();
        for (uint256 i; i < members.length; i++) {
            rating += profile.officeRatingOf(members[i]);
        }
    }

    function _requireCaptain(uint256 crewId) internal view returns (Crew storage crew) {
        crew = crews[crewId];
        if (!crew.active) revert InvalidCrew();
        if (profile.ownerOf(crew.captainProfileId) != msg.sender) revert NotCaptain();
    }

    function _requireProfileOwner(uint256 profileId) internal view {
        if (profile.ownerOf(profileId) != msg.sender) revert NotProfileOwner();
    }

    function _validName(bytes32 name) internal pure returns (bool) {
        bool seenNull;
        uint256 length;
        for (uint256 i; i < 32; i++) {
            uint8 char = uint8(name[i]);
            if (char == 0) {
                seenNull = true;
                continue;
            }
            if (seenNull) return false;
            bool valid = (char >= 48 && char <= 57) || (char >= 65 && char <= 90)
                || (char >= 97 && char <= 122) || char == 45 || char == 95 || char == 32;
            if (!valid) return false;
            length++;
        }
        return length >= 3;
    }
}
