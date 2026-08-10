// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IWorkFloorProfile {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IWorkFloorGame {
    function effectiveTier(uint256 profileId) external view returns (uint8);
}

interface IRandomnessProvider {
    function requestRandomness(uint256 profileId) external returns (uint256 requestId);
}

/// @notice Gamified banker shifts that build non-transferable desk assets.
/// @dev Inputs lock before randomness is requested. Work reputation never affects outcome score.
contract BankerWorkFloor {
    error AlreadyClockedIn();
    error AlreadyClaimed();
    error AlreadySpunToday();
    error InvalidAssignment();
    error NotProfileOwner();
    error OnlyRandomnessProvider();
    error ProfileInactive();
    error ShiftNotReady();
    error UnknownRequest();
    error WinnerNotReady();

    uint64 public constant SHIFT_DURATION = 8 hours;
    uint8 public constant MAX_SHIFTS_PER_DAY = 3;
    uint8 private constant REQUEST_SHIFT = 1;
    uint8 private constant REQUEST_SUIT = 2;

    struct Shift {
        uint64 startedAt;
        uint64 readyAt;
        uint64 completedAt;
        uint8 assignment;
        uint8 status;
        uint8 quality;
        uint8 rarity;
        uint256 requestId;
    }

    struct RandomnessRequest {
        uint256 profileId;
        uint8 kind;
    }

    IWorkFloorProfile public immutable profile;
    IWorkFloorGame public immutable game;
    IRandomnessProvider public immutable randomnessProvider;

    mapping(uint256 => Shift) public shifts;
    mapping(uint256 => RandomnessRequest) public randomnessRequests;
    mapping(uint256 => uint32) public workReputation;
    mapping(uint256 => uint32) public completedShifts;
    mapping(uint256 => mapping(uint8 => mapping(uint8 => uint32))) public deskAssets;
    mapping(uint256 => mapping(uint64 => uint8)) public dailyShifts;
    mapping(uint256 => uint64) public lastSuitSpinDayPlusOne;
    mapping(uint256 => uint32) public dailySuitSpins;
    mapping(uint256 => uint8) public bestSuitTier;
    mapping(uint256 => uint8) public latestSuitTier;
    mapping(uint256 => uint8) public latestSuitStyle;
    mapping(uint256 => mapping(uint8 => uint32)) public suitCollection;
    mapping(uint64 => mapping(uint256 => uint32)) public dailyWorkScore;
    mapping(uint64 => uint256) public dailyLeaderProfile;
    mapping(uint64 => uint32) public dailyLeaderScore;
    mapping(uint64 => bool) public dailyTrophyClaimed;
    mapping(uint256 => uint32) public dailyWins;

    event BankerClockedIn(
        uint256 indexed profileId, uint8 indexed assignment, uint64 readyAt, uint8 dailyShift
    );
    event ShiftRandomnessRequested(uint256 indexed profileId, uint256 indexed requestId);
    event DailySuitSpinRequested(uint256 indexed profileId, uint256 indexed requestId, uint64 day);
    event DeskAssetBuilt(
        uint256 indexed profileId,
        uint256 indexed requestId,
        uint8 indexed assignment,
        uint8 rarity,
        uint8 quality,
        uint256 reputationEarned
    );
    event SuitTailored(
        uint256 indexed profileId,
        uint256 indexed requestId,
        uint8 indexed tier,
        uint8 style,
        bool newPersonalBest
    );
    event DailyLeaderChanged(uint64 indexed day, uint256 indexed profileId, uint256 score);
    event DailyTrophyClaimed(
        uint64 indexed day, uint256 indexed profileId, uint256 bonusReputation
    );

    constructor(
        IWorkFloorProfile profile_,
        IWorkFloorGame game_,
        IRandomnessProvider randomnessProvider_
    ) {
        if (
            address(profile_) == address(0) || address(game_) == address(0)
                || address(randomnessProvider_) == address(0)
        ) revert UnknownRequest();
        profile = profile_;
        game = game_;
        randomnessProvider = randomnessProvider_;
    }

    /// @param assignment 1 research dossier, 2 client rolodex, 3 terminal module, 4 deal blueprint.
    function clockIn(uint256 profileId, uint8 assignment) external {
        if (profile.ownerOf(profileId) != msg.sender) revert NotProfileOwner();
        if (game.effectiveTier(profileId) == 0) revert ProfileInactive();
        if (assignment == 0 || assignment > 4) revert InvalidAssignment();
        Shift storage current = shifts[profileId];
        if (current.status == 1 || current.status == 2) revert AlreadyClockedIn();

        uint64 day = uint64(block.timestamp / 1 days);
        uint8 count = dailyShifts[profileId][day];
        if (count >= MAX_SHIFTS_PER_DAY) revert AlreadyClockedIn();
        dailyShifts[profileId][day] = count + 1;
        uint64 readyAt = uint64(block.timestamp + SHIFT_DURATION);
        shifts[profileId] = Shift({
            startedAt: uint64(block.timestamp),
            readyAt: readyAt,
            completedAt: 0,
            assignment: assignment,
            status: 1,
            quality: 0,
            rarity: 0,
            requestId: 0
        });
        emit BankerClockedIn(profileId, assignment, readyAt, count + 1);
    }

    function finishShift(uint256 profileId) external returns (uint256 requestId) {
        if (profile.ownerOf(profileId) != msg.sender) revert NotProfileOwner();
        Shift storage shift = shifts[profileId];
        if (shift.status != 1 || block.timestamp < shift.readyAt) revert ShiftNotReady();

        // Lock the shift before the external request. There is intentionally no cancel or reroll path.
        shift.status = 2;
        requestId = randomnessProvider.requestRandomness(profileId);
        if (requestId == 0 || randomnessRequests[requestId].profileId != 0) {
            revert UnknownRequest();
        }
        shift.requestId = requestId;
        randomnessRequests[requestId] = RandomnessRequest(profileId, REQUEST_SHIFT);
        emit ShiftRandomnessRequested(profileId, requestId);
    }

    /// @notice Requests one provably random cosmetic suit per UTC day.
    /// @dev The day is locked before requesting randomness, so there is no reroll or cancellation path.
    function spinDailySuit(uint256 profileId) external returns (uint256 requestId) {
        if (profile.ownerOf(profileId) != msg.sender) revert NotProfileOwner();
        if (game.effectiveTier(profileId) == 0) revert ProfileInactive();

        uint64 day = uint64(block.timestamp / 1 days);
        if (lastSuitSpinDayPlusOne[profileId] == day + 1) revert AlreadySpunToday();
        lastSuitSpinDayPlusOne[profileId] = day + 1;

        requestId = randomnessProvider.requestRandomness(profileId);
        if (requestId == 0 || randomnessRequests[requestId].profileId != 0) {
            revert UnknownRequest();
        }
        randomnessRequests[requestId] = RandomnessRequest(profileId, REQUEST_SUIT);
        emit DailySuitSpinRequested(profileId, requestId, day);
    }

    function fulfillRandomness(uint256 requestId, uint256 randomWord) external {
        if (msg.sender != address(randomnessProvider)) revert OnlyRandomnessProvider();
        RandomnessRequest memory request = randomnessRequests[requestId];
        uint256 profileId = request.profileId;
        if (profileId == 0) revert UnknownRequest();

        delete randomnessRequests[requestId];
        if (request.kind == REQUEST_SUIT) {
            _tailorSuit(profileId, requestId, randomWord);
            return;
        }
        if (request.kind != REQUEST_SHIFT) revert UnknownRequest();

        Shift storage shift = shifts[profileId];
        if (shift.status != 2 || shift.requestId != requestId) revert UnknownRequest();

        uint8 quality = uint8(40 + randomWord % 61);
        uint256 rarityRoll = uint256(keccak256(abi.encode(randomWord, requestId))) % 1_000;
        uint8 rarity = rarityRoll < 600 ? 1 : rarityRoll < 850 ? 2 : rarityRoll < 970 ? 3 : 4;
        uint256 reputationEarned = uint256(quality) * rarity;

        shift.status = 3;
        shift.completedAt = uint64(block.timestamp);
        shift.quality = quality;
        shift.rarity = rarity;
        deskAssets[profileId][shift.assignment][rarity]++;
        completedShifts[profileId]++;
        _addWorkReputation(profileId, reputationEarned);
        _addDailyScore(profileId, reputationEarned);
        emit DeskAssetBuilt(
            profileId, requestId, shift.assignment, rarity, quality, reputationEarned
        );
    }

    function _tailorSuit(uint256 profileId, uint256 requestId, uint256 randomWord) private {
        uint256 roll = randomWord % 10_000;
        uint8 tier = roll < 5_500 ? 1 : roll < 8_000 ? 2 : roll < 9_300 ? 3 : roll < 9_900 ? 4 : 5;
        uint8 style =
            uint8(uint256(keccak256(abi.encode(randomWord, requestId, profileId))) % 6 + 1);
        bool newPersonalBest = tier > bestSuitTier[profileId];

        dailySuitSpins[profileId]++;
        suitCollection[profileId][tier]++;
        latestSuitTier[profileId] = tier;
        latestSuitStyle[profileId] = style;
        if (newPersonalBest) bestSuitTier[profileId] = tier;
        _addDailyScore(profileId, uint256(tier) * 50);
        emit SuitTailored(profileId, requestId, tier, style, newPersonalBest);
    }

    function claimDailyTrophy(uint64 day) external {
        if (day >= block.timestamp / 1 days) revert WinnerNotReady();
        if (dailyTrophyClaimed[day]) revert AlreadyClaimed();
        uint256 winnerProfileId = dailyLeaderProfile[day];
        if (winnerProfileId == 0) revert WinnerNotReady();

        dailyTrophyClaimed[day] = true;
        dailyWins[winnerProfileId]++;
        _addWorkReputation(winnerProfileId, 250);
        emit DailyTrophyClaimed(day, winnerProfileId, 250);
    }

    function _addDailyScore(uint256 profileId, uint256 points) private {
        uint64 day = uint64(block.timestamp / 1 days);
        uint256 nextScore = uint256(dailyWorkScore[day][profileId]) + points;
        uint32 score = uint32(nextScore > type(uint32).max ? type(uint32).max : nextScore);
        dailyWorkScore[day][profileId] = score;
        if (score > dailyLeaderScore[day]) {
            dailyLeaderScore[day] = score;
            dailyLeaderProfile[day] = profileId;
            emit DailyLeaderChanged(day, profileId, score);
        }
    }

    function _addWorkReputation(uint256 profileId, uint256 points) private {
        uint256 nextReputation = uint256(workReputation[profileId]) + points;
        workReputation[profileId] =
            uint32(nextReputation > type(uint32).max ? type(uint32).max : nextReputation);
    }

    function assignmentName(uint8 assignment) external pure returns (string memory) {
        if (assignment == 1) return "Research Dossier";
        if (assignment == 2) return "Client Rolodex";
        if (assignment == 3) return "Terminal Module";
        if (assignment == 4) return "Deal Blueprint";
        revert InvalidAssignment();
    }

    function rarityName(uint8 rarity) external pure returns (string memory) {
        if (rarity == 1) return "Standard";
        if (rarity == 2) return "Uncommon";
        if (rarity == 3) return "Rare";
        if (rarity == 4) return "Legendary";
        return "Pending";
    }

    function suitName(uint8 tier) external pure returns (string memory) {
        if (tier == 1) return "Pinstripe Starter";
        if (tier == 2) return "Power Suit";
        if (tier == 3) return "Executive Cut";
        if (tier == 4) return "Chairman Reserve";
        if (tier == 5) return "Wall Street Legend";
        return "No Suit Yet";
    }

    function suitStyleName(uint8 style) external pure returns (string memory) {
        if (style == 1) return "Midnight Navy";
        if (style == 2) return "Charcoal Stripe";
        if (style == 3) return "Merger Gray";
        if (style == 4) return "Bordeaux Double-Breasted";
        if (style == 5) return "Bull Market Blue";
        if (style == 6) return "Black Monday";
        return "Unassigned";
    }
}
