// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BankerDesk } from "./BankerDesk.sol";
import { BankerProfile } from "./BankerProfile.sol";
import { PaperAsset } from "./PaperAsset.sol";
import { Ownable } from "./lib/Ownable.sol";

/// @notice Testnet-first brokerage game using fictional, non-transferable assets and valueless credits.
contract BrokerGame is Ownable {
    error AlreadyHasDesk();
    error CooldownActive();
    error DeskInactive();
    error InvalidAmount();
    error InvalidChain();
    error InvalidDeskName();
    error InvalidMandate();
    error MandateInactive();
    error PositionLimitExceeded();
    error InvalidTier();
    error NativeFeeMismatch();
    error NotAchievementRegistry();
    error NotAuthorizedHook();
    error NotBanker();
    error NotProfileOwner();
    error OfficeLevelLocked();
    error OfficeMaxed();
    error SeasonStillActive();
    error SeasonClosed();
    error SelfDealing();
    error TowerFloorAlreadySettled();
    error TowerSeasonOutOfOrder();
    error SeasonResultOutOfOrder();

    uint256 public constant CREDIT = 1e6;
    uint256 public constant FAUCET_AMOUNT = 100_000 * CREDIT;
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    uint256 public constant MARKET_EPOCH = 1 hours;
    uint256 public constant DESK_STAKE = 5_000 * CREDIT;
    uint256 public constant MAX_TRADE_NOTIONAL = 25_000 * CREDIT;
    uint256 public constant MIN_MANAGED_ALLOCATION = 100 * CREDIT;
    uint256 public constant DEFAULT_SEASON_DURATION = 28 days;
    uint16 public constant TRADE_FEE_BPS = 100;

    BankerProfile public immutable profile;
    PaperAsset public immutable paperAsset;
    uint256 public immutable deploymentChainId;
    uint256 public immutable profileMintFee;
    address public immutable nativeTreasury;

    struct Desk {
        address deskAddress;
        bytes32 deskName;
        uint8 tier;
        uint64 createdAt;
        uint64 syncedTransferNonce;
        uint128 commissionsAccrued;
        uint128 lifetimeCommission;
        uint128 lifetimeVolume;
    }

    struct RiskMandate {
        bytes32 strategyName;
        uint16 maxPositionBps;
        uint16 maxDrawdownBps;
        uint32 rebalanceCooldown;
        uint8 riskClass;
        bool active;
    }

    struct ManagedAccount {
        uint256 cash;
        uint256 contributed;
        uint256 withdrawn;
        uint256 highWaterMark;
        uint256 lastMarkedEquity;
        uint64 joinedAt;
        uint64 lastTradeAt;
        uint64 lastActiveSeason;
    }

    struct SeasonStats {
        int128 outcomePnl;
        uint128 managedCapital;
        uint128 managedVolume;
        uint96 bankerCommission;
        uint32 clientsServed;
        uint16 worstDrawdownBps;
    }

    struct Office {
        uint8 terminalLevel;
        uint8 researchLevel;
        uint8 hospitalityLevel;
        uint16 rating;
        uint128 creditsSpent;
    }

    mapping(address => uint256) public credits;
    mapping(address => uint256) public loyaltyCredits;
    mapping(address => uint64) public lastFaucetAt;
    mapping(uint256 => Desk) private _desks;
    mapping(uint256 => RiskMandate) public mandates;
    mapping(bytes32 => ManagedAccount) private _managedAccounts;
    mapping(bytes32 => mapping(uint256 => uint256)) public managedPositions;
    mapping(uint64 => mapping(uint256 => SeasonStats)) public seasonStats;
    mapping(uint64 => mapping(uint256 => bool)) public seasonResultRecorded;
    mapping(uint64 => mapping(uint256 => bool)) public towerFloorSettled;
    mapping(uint256 => uint64) public lastTowerSeasonSettled;
    mapping(uint256 => uint64) public lastSeasonResultAwarded;
    mapping(uint256 => uint8) public towerFloorOf;
    mapping(uint256 => uint16) public latestTowerRank;
    mapping(uint256 => Office) public offices;
    uint256[] public deskProfileIds;
    uint64 public lastMarketEpoch;
    uint64 public currentSeason = 1;
    uint64 public seasonEndsAt;
    uint256 public protocolCredits;
    uint256 public rewardPoolCredits;
    address public authorizedHook;
    address public achievementRegistry;
    uint256 public floor100Champion;

    event CommissionsClaimed(uint256 indexed profileId, address indexed owner, uint256 amount);
    event CreditsClaimed(address indexed player, uint256 amount, uint256 nextClaimAt);
    event DeskActivated(uint256 indexed profileId, uint8 tier, uint256 stake);
    event DeskCreated(uint256 indexed profileId, address indexed desk, bytes32 name);
    event LoyaltyClaimed(address indexed client, uint256 amount);
    event LoyaltyEarned(address indexed client, uint256 indexed profileId, uint256 amount);
    event HookConfigured(address indexed hook);
    event HookVolumeRecorded(uint256 indexed profileId, address indexed trader, uint256 notional);
    event MarketAdvanced(uint256 indexed epoch);
    event ProfileMinted(uint256 indexed profileId, address indexed owner, bytes32 handle);
    event ManagedAllocation(address indexed client, uint256 indexed profileId, uint256 amount);
    event ManagedWithdrawal(address indexed client, uint256 indexed profileId, uint256 amount);
    event ManagedTrade(
        address indexed client,
        uint256 indexed profileId,
        uint256 indexed assetId,
        bool isBuy,
        uint256 shareAmount,
        uint256 notional,
        uint256 fee
    );
    event RiskMandateSet(
        uint256 indexed profileId,
        bytes32 strategyName,
        uint16 maxPositionBps,
        uint16 maxDrawdownBps,
        uint32 rebalanceCooldown,
        uint8 riskClass
    );
    event SeasonStarted(uint64 indexed seasonId, uint64 endsAt);
    event SeasonResultAwarded(
        uint64 indexed seasonId, uint256 indexed profileId, uint256 score, uint8 rank
    );
    event TowerFloorSettled(
        uint64 indexed seasonId,
        uint256 indexed profileId,
        uint8 previousFloor,
        uint8 newFloor,
        uint16 towerRank,
        uint256 outcomeScore
    );
    event TowerChampionReplaced(uint256 indexed previousChampion, uint256 indexed newChampion);
    event OfficeUpgraded(
        uint256 indexed profileId, uint8 indexed track, uint8 level, uint16 rating, uint256 cost
    );
    event AchievementRegistryConfigured(address indexed registry);
    event TradeExecuted(
        address indexed trader,
        uint256 indexed profileId,
        uint256 indexed assetId,
        bool isBuy,
        uint256 shareAmount,
        uint256 notional,
        uint256 fee
    );

    constructor(
        address initialOwner,
        BankerProfile profile_,
        PaperAsset paperAsset_,
        address nativeTreasury_,
        uint256 profileMintFee_,
        uint256 allowedChainId
    ) Ownable(initialOwner) {
        if (block.chainid != allowedChainId) revert InvalidChain();
        if (address(profile_) == address(0) || address(paperAsset_) == address(0)) {
            revert ZeroAddress();
        }
        if (nativeTreasury_ == address(0)) revert ZeroAddress();
        profile = profile_;
        paperAsset = paperAsset_;
        nativeTreasury = nativeTreasury_;
        profileMintFee = profileMintFee_;
        deploymentChainId = block.chainid;
        seasonEndsAt = uint64(block.timestamp + DEFAULT_SEASON_DURATION);
        emit SeasonStarted(currentSeason, seasonEndsAt);
    }

    function simulationNotice() external pure returns (string memory) {
        return "Fictional paper markets only. Credits and positions have no cash value or claim on real assets.";
    }

    function mintProfile(bytes32 handle) external payable returns (uint256 profileId) {
        if (msg.value != profileMintFee) revert NativeFeeMismatch();
        profileId = profile.mint(msg.sender, handle);
        emit ProfileMinted(profileId, msg.sender, handle);
    }

    function claimFaucet() external {
        uint64 lastClaim = lastFaucetAt[msg.sender];
        if (lastClaim != 0 && block.timestamp < uint256(lastClaim) + FAUCET_COOLDOWN) {
            revert CooldownActive();
        }
        lastFaucetAt[msg.sender] = uint64(block.timestamp);
        credits[msg.sender] += FAUCET_AMOUNT;
        emit CreditsClaimed(msg.sender, FAUCET_AMOUNT, block.timestamp + FAUCET_COOLDOWN);
    }

    function createDesk(uint256 profileId, bytes32 deskName)
        external
        returns (address deskAddress)
    {
        _requireProfileOwner(profileId);
        if (_desks[profileId].deskAddress != address(0)) revert AlreadyHasDesk();
        if (!_validName(deskName)) revert InvalidDeskName();

        credits[msg.sender] -= DESK_STAKE;
        BankerDesk desk = new BankerDesk(address(this), address(profile), profileId);
        deskAddress = address(desk);
        _desks[profileId] = Desk({
            deskAddress: deskAddress,
            deskName: deskName,
            tier: 1,
            createdAt: uint64(block.timestamp),
            syncedTransferNonce: profile.transferNonce(profileId),
            commissionsAccrued: 0,
            lifetimeCommission: 0,
            lifetimeVolume: 0
        });
        deskProfileIds.push(profileId);
        towerFloorOf[profileId] = 1;
        profile.recordTowerPosition(profileId, 1, 0, currentSeason);
        rewardPoolCredits += DESK_STAKE;
        emit DeskCreated(profileId, deskAddress, deskName);
        emit DeskActivated(profileId, 1, DESK_STAKE);
    }

    function activateDesk(uint256 profileId, uint8 targetTier) external {
        _requireProfileOwner(profileId);
        Desk storage desk = _desks[profileId];
        if (desk.deskAddress == address(0)) revert DeskInactive();
        uint8 currentTier = effectiveTier(profileId);
        if (targetTier == 0 || targetTier > 4 || targetTier <= currentTier) revert InvalidTier();

        uint256 stake = tierStake(targetTier);
        credits[msg.sender] -= stake;
        desk.tier = targetTier;
        desk.syncedTransferNonce = profile.transferNonce(profileId);
        rewardPoolCredits += stake;
        emit DeskActivated(profileId, targetTier, stake);
    }

    function buy(uint256 profileId, uint256 assetId, uint256 shareAmount) external {
        (uint256 notional, uint256 fee) = _quote(profileId, assetId, shareAmount);
        credits[msg.sender] -= notional + fee;
        paperAsset.mint(msg.sender, assetId, shareAmount);
        _settleFee(profileId, msg.sender, notional, fee);
        emit TradeExecuted(msg.sender, profileId, assetId, true, shareAmount, notional, fee);
    }

    function sell(uint256 profileId, uint256 assetId, uint256 shareAmount) external {
        (uint256 notional, uint256 fee) = _quote(profileId, assetId, shareAmount);
        paperAsset.burn(msg.sender, assetId, shareAmount);
        credits[msg.sender] += notional - fee;
        _settleFee(profileId, msg.sender, notional, fee);
        emit TradeExecuted(msg.sender, profileId, assetId, false, shareAmount, notional, fee);
    }

    function setRiskMandate(
        uint256 profileId,
        bytes32 strategyName,
        uint16 maxPositionBps,
        uint16 maxDrawdownBps,
        uint32 rebalanceCooldown,
        uint8 riskClass
    ) external {
        _requireProfileOwner(profileId);
        if (
            effectiveTier(profileId) == 0 || !_validName(strategyName) || maxPositionBps < 500
                || maxPositionBps > 10_000 || maxDrawdownBps < 100 || maxDrawdownBps > 10_000
                || rebalanceCooldown > 30 days || riskClass == 0 || riskClass > 5
        ) revert InvalidMandate();
        mandates[profileId] = RiskMandate({
            strategyName: strategyName,
            maxPositionBps: maxPositionBps,
            maxDrawdownBps: maxDrawdownBps,
            rebalanceCooldown: rebalanceCooldown,
            riskClass: riskClass,
            active: true
        });
        emit RiskMandateSet(
            profileId, strategyName, maxPositionBps, maxDrawdownBps, rebalanceCooldown, riskClass
        );
    }

    function setMandateActive(uint256 profileId, bool active) external {
        _requireProfileOwner(profileId);
        if (mandates[profileId].strategyName == bytes32(0)) revert InvalidMandate();
        mandates[profileId].active = active;
    }

    function allocateToDesk(uint256 profileId, uint256 amount) external {
        if (block.timestamp >= seasonEndsAt) revert SeasonClosed();
        if (amount < MIN_MANAGED_ALLOCATION) revert InvalidAmount();
        if (effectiveTier(profileId) == 0) revert DeskInactive();
        if (profile.ownerOf(profileId) == msg.sender) revert SelfDealing();
        if (!mandates[profileId].active) revert MandateInactive();

        bytes32 key = managedAccountKey(msg.sender, profileId);
        ManagedAccount storage account = _managedAccounts[key];
        if (account.joinedAt == 0) {
            account.joinedAt = uint64(block.timestamp);
        } else {
            _checkpointManagedAccount(msg.sender, profileId);
        }
        _touchSeasonClient(account, profileId);
        credits[msg.sender] -= amount;
        account.cash += amount;
        account.contributed += amount;
        account.lastMarkedEquity += amount;
        if (account.lastMarkedEquity > account.highWaterMark) {
            account.highWaterMark = account.lastMarkedEquity;
        }
        seasonStats[currentSeason][profileId].managedCapital += uint128(amount);
        emit ManagedAllocation(msg.sender, profileId, amount);
    }

    function withdrawFromDesk(uint256 profileId, uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        bytes32 key = managedAccountKey(msg.sender, profileId);
        ManagedAccount storage account = _managedAccounts[key];
        _checkpointManagedAccount(msg.sender, profileId);
        account.cash -= amount;
        account.withdrawn += amount;
        credits[msg.sender] += amount;
        account.lastMarkedEquity -= amount;
        account.highWaterMark = account.highWaterMark > amount
            ? account.highWaterMark - amount
            : account.lastMarkedEquity;
        emit ManagedWithdrawal(msg.sender, profileId, amount);
    }

    function managedBuy(address client, uint256 profileId, uint256 assetId, uint256 shareAmount)
        external
    {
        if (block.timestamp >= seasonEndsAt) revert SeasonClosed();
        _requireBanker(profileId);
        RiskMandate memory mandate = mandates[profileId];
        if (!mandate.active) revert MandateInactive();
        bytes32 key = managedAccountKey(client, profileId);
        ManagedAccount storage account = _managedAccounts[key];
        _requireRebalanceReady(account, mandate.rebalanceCooldown);
        (uint256 notional, uint256 fee, uint256 price) = _managedQuote(assetId, shareAmount);

        uint256 equity = portfolioEquity(client, profileId);
        if (_currentDrawdownBps(account, equity) >= mandate.maxDrawdownBps) {
            revert InvalidMandate();
        }
        account.cash -= notional + fee;
        uint256 nextPosition = managedPositions[key][assetId] + shareAmount;
        uint256 nextPositionValue = nextPosition * price / CREDIT;
        if (nextPositionValue * 10_000 > (equity - fee) * mandate.maxPositionBps) {
            revert PositionLimitExceeded();
        }
        managedPositions[key][assetId] = nextPosition;
        account.lastTradeAt = uint64(block.timestamp);
        _settleFee(profileId, client, notional, fee);
        _recordManagedTrade(client, profileId, notional, fee);
        emit ManagedTrade(client, profileId, assetId, true, shareAmount, notional, fee);
    }

    function managedSell(address client, uint256 profileId, uint256 assetId, uint256 shareAmount)
        external
    {
        if (block.timestamp >= seasonEndsAt) revert SeasonClosed();
        _requireBanker(profileId);
        RiskMandate memory mandate = mandates[profileId];
        if (!mandate.active) revert MandateInactive();
        bytes32 key = managedAccountKey(client, profileId);
        ManagedAccount storage account = _managedAccounts[key];
        _requireRebalanceReady(account, mandate.rebalanceCooldown);
        (uint256 notional, uint256 fee,) = _managedQuote(assetId, shareAmount);
        managedPositions[key][assetId] -= shareAmount;
        account.cash += notional - fee;
        account.lastTradeAt = uint64(block.timestamp);
        _settleFee(profileId, client, notional, fee);
        _recordManagedTrade(client, profileId, notional, fee);
        emit ManagedTrade(client, profileId, assetId, false, shareAmount, notional, fee);
    }

    function claimLoyaltyCredits() external returns (uint256 amount) {
        amount = loyaltyCredits[msg.sender];
        loyaltyCredits[msg.sender] = 0;
        credits[msg.sender] += amount;
        emit LoyaltyClaimed(msg.sender, amount);
    }

    function checkpointPortfolio(address client, uint256 profileId)
        external
        returns (uint256 equity)
    {
        return _checkpointManagedAccount(client, profileId);
    }

    function portfolioEquity(address client, uint256 profileId)
        public
        view
        returns (uint256 equity)
    {
        bytes32 key = managedAccountKey(client, profileId);
        equity = _managedAccounts[key].cash;
        uint256 count = paperAsset.assetCount();
        for (uint256 assetId = 1; assetId <= count; assetId++) {
            (,, uint64 price,, bool active) = paperAsset.assets(assetId);
            if (active) equity += managedPositions[key][assetId] * uint256(price) / CREDIT;
        }
    }

    function getManagedAccount(address client, uint256 profileId)
        external
        view
        returns (ManagedAccount memory)
    {
        return _managedAccounts[managedAccountKey(client, profileId)];
    }

    function managedAccountKey(address client, uint256 profileId) public pure returns (bytes32) {
        return keccak256(abi.encode(client, profileId));
    }

    function outcomeScore(uint64 seasonId, uint256 profileId) public view returns (uint256) {
        SeasonStats memory stats = seasonStats[seasonId][profileId];
        if (stats.clientsServed == 0 || stats.managedCapital == 0) return 0;
        uint256 performancePoints =
            stats.outcomePnl > 0 ? uint256(uint128(stats.outcomePnl)) / CREDIT * 30 : 0;
        uint256 clientPoints = uint256(stats.clientsServed) * 250;
        uint256 stewardshipPoints = uint256(10_000 - stats.worstDrawdownBps) * 1_000 / 10_000;
        uint256 activityPoints = uint256(stats.managedVolume) / (1_000 * CREDIT) * 10;
        return performancePoints + clientPoints + stewardshipPoints + activityPoints;
    }

    function startNextSeason(uint64 duration) external onlyOwner {
        if (block.timestamp < seasonEndsAt) revert SeasonStillActive();
        if (duration < 7 days || duration > 90 days) revert InvalidAmount();
        currentSeason++;
        seasonEndsAt = uint64(block.timestamp + duration);
        emit SeasonStarted(currentSeason, seasonEndsAt);
    }

    function awardSeasonResult(uint64 seasonId, uint256 profileId, uint8 rank) external onlyOwner {
        if (seasonId >= currentSeason || rank == 0 || rank > 3) revert InvalidAmount();
        if (seasonResultRecorded[seasonId][profileId]) revert InvalidAmount();
        if (seasonId <= lastSeasonResultAwarded[profileId]) revert SeasonResultOutOfOrder();
        seasonResultRecorded[seasonId][profileId] = true;
        lastSeasonResultAwarded[profileId] = seasonId;
        uint256 score = outcomeScore(seasonId, profileId);
        profile.recordSeasonResult(profileId, seasonId, score, rank);
        emit SeasonResultAwarded(seasonId, profileId, score, rank);
    }

    /// @notice Settles a banker's office after a completed season using outcome score and league rank.
    /// @dev Upward movement is capped at ten floors, except the active season champion who occupies
    ///      Floor 100. Inactive desks lose three floors. Events provide an indexable floor ranking.
    function settleTowerFloor(uint64 seasonId, uint256 profileId, uint16 towerRank)
        external
        onlyOwner
        returns (uint8 newFloor)
    {
        if (seasonId >= currentSeason || towerRank == 0 || towerRank > 10_000) {
            revert InvalidAmount();
        }
        if (towerFloorSettled[seasonId][profileId]) revert TowerFloorAlreadySettled();
        if (seasonId <= lastTowerSeasonSettled[profileId]) revert TowerSeasonOutOfOrder();
        uint8 previousFloor = towerFloorOf[profileId];
        if (previousFloor == 0) revert DeskInactive();

        uint256 score = outcomeScore(seasonId, profileId);
        SeasonStats memory stats = seasonStats[seasonId][profileId];
        newFloor = _nextTowerFloor(previousFloor, score, towerRank, stats);
        towerFloorSettled[seasonId][profileId] = true;
        lastTowerSeasonSettled[profileId] = seasonId;
        latestTowerRank[profileId] = towerRank;

        if (newFloor == 100) {
            uint256 previousChampion = floor100Champion;
            if (previousChampion != 0 && previousChampion != profileId) {
                towerFloorOf[previousChampion] = 99;
                profile.recordTowerPosition(
                    previousChampion, 99, latestTowerRank[previousChampion], seasonId
                );
                emit TowerChampionReplaced(previousChampion, profileId);
            }
            floor100Champion = profileId;
        } else if (previousFloor == 100 && floor100Champion == profileId) {
            floor100Champion = 0;
        }

        towerFloorOf[profileId] = newFloor;
        profile.recordTowerPosition(profileId, newFloor, towerRank, seasonId);
        emit TowerFloorSettled(seasonId, profileId, previousFloor, newFloor, towerRank, score);
    }

    function previewTowerFloor(uint64 seasonId, uint256 profileId, uint16 towerRank)
        external
        view
        returns (uint8)
    {
        if (towerRank == 0 || towerRank > 10_000) revert InvalidAmount();
        uint8 currentFloor = towerFloorOf[profileId];
        if (currentFloor == 0) revert DeskInactive();
        return _nextTowerFloor(
            currentFloor,
            outcomeScore(seasonId, profileId),
            towerRank,
            seasonStats[seasonId][profileId]
        );
    }

    /// @notice Installs a cosmetic/tooling office upgrade. Office rating never contributes to score.
    /// @param track 1 = terminal bank, 2 = research library, 3 = client lounge.
    function upgradeOffice(uint256 profileId, uint8 track) external returns (uint8 newLevel) {
        _requireProfileOwner(profileId);
        if (effectiveTier(profileId) == 0) revert DeskInactive();
        if (track == 0 || track > 3) revert InvalidAmount();

        Office storage office = offices[profileId];
        uint8 currentLevel = track == 1
            ? office.terminalLevel
            : track == 2 ? office.researchLevel : office.hospitalityLevel;
        if (currentLevel >= 5) revert OfficeMaxed();
        newLevel = currentLevel + 1;
        if (newLevel > maxOfficeLevel(profileId)) revert OfficeLevelLocked();

        uint256 cost = officeUpgradeCost(newLevel);
        credits[msg.sender] -= cost;
        rewardPoolCredits += cost;
        office.creditsSpent += uint128(cost);
        if (track == 1) office.terminalLevel = newLevel;
        else if (track == 2) office.researchLevel = newLevel;
        else office.hospitalityLevel = newLevel;

        office.rating = uint16(
            (uint256(office.terminalLevel) + office.researchLevel + office.hospitalityLevel) * 100
        );
        profile.recordOfficeRating(profileId, office.rating);
        emit OfficeUpgraded(profileId, track, newLevel, office.rating, cost);
    }

    function maxOfficeLevel(uint256 profileId) public view returns (uint8) {
        uint8 floor = towerFloorOf[profileId];
        if (floor == 0) return 0;
        return 1 + (floor - 1) / 20;
    }

    function officeUpgradeCost(uint8 targetLevel) public pure returns (uint256) {
        if (targetLevel == 1) return 2_000 * CREDIT;
        if (targetLevel == 2) return 5_000 * CREDIT;
        if (targetLevel == 3) return 10_000 * CREDIT;
        if (targetLevel == 4) return 20_000 * CREDIT;
        if (targetLevel == 5) return 40_000 * CREDIT;
        revert InvalidAmount();
    }

    function _nextTowerFloor(
        uint8 currentFloor,
        uint256 score,
        uint16 towerRank,
        SeasonStats memory stats
    ) internal pure returns (uint8) {
        bool active = stats.clientsServed != 0 && stats.managedCapital != 0;
        if (!active) return currentFloor > 3 ? currentFloor - 3 : 1;
        if (towerRank == 1 && score >= 1_000) return 100;
        if (currentFloor == 100) return 99;

        uint256 desiredFloor = 1 + score / 500;
        if (towerRank <= 10) desiredFloor += 8;
        else if (towerRank <= 50) desiredFloor += 3;
        if (desiredFloor > 99) desiredFloor = 99;

        if (desiredFloor > currentFloor) {
            uint256 cappedPromotion = uint256(currentFloor) + 10;
            return uint8(desiredFloor > cappedPromotion ? cappedPromotion : desiredFloor);
        }
        if (desiredFloor < currentFloor) {
            uint256 demotionFloor = currentFloor > 5 ? currentFloor - 5 : 1;
            return uint8(desiredFloor < demotionFloor ? demotionFloor : desiredFloor);
        }
        return currentFloor;
    }

    function setAchievementRegistry(address registry) external onlyOwner {
        achievementRegistry = registry;
        emit AchievementRegistryConfigured(registry);
    }

    function recordReadOnlyAchievement(uint256 profileId, address claimant) external {
        if (msg.sender != achievementRegistry) revert NotAchievementRegistry();
        if (profile.ownerOf(profileId) != claimant) revert NotProfileOwner();
        profile.recordAchievement(profileId);
    }

    function claimCommissions(uint256 profileId) external returns (uint256 amount) {
        Desk storage desk = _desks[profileId];
        address currentOwner = profile.ownerOf(profileId);
        if (msg.sender != currentOwner && msg.sender != desk.deskAddress) revert NotProfileOwner();
        bool ownershipChanged = desk.syncedTransferNonce != profile.transferNonce(profileId);
        amount = desk.commissionsAccrued;
        desk.commissionsAccrued = 0;
        desk.syncedTransferNonce = profile.transferNonce(profileId);
        if (ownershipChanged) desk.tier = 0;
        credits[currentOwner] += amount;
        emit CommissionsClaimed(profileId, currentOwner, amount);
    }

    function advanceMarket() external {
        uint64 epoch = uint64(block.timestamp / MARKET_EPOCH);
        uint64 epochMarker = epoch + 1;
        if (epochMarker <= lastMarketEpoch) revert CooldownActive();
        lastMarketEpoch = epochMarker;

        uint256 count = paperAsset.assetCount();
        for (uint256 assetId = 1; assetId <= count; assetId++) {
            (,, uint64 currentPrice, uint32 volatilityBps, bool active) = paperAsset.assets(assetId);
            if (!active) continue;
            uint256 random = uint256(
                keccak256(abi.encode(block.prevrandao, blockhash(block.number - 1), epoch, assetId))
            );
            int256 span = int256(uint256(volatilityBps) * 2 + 1);
            int256 moveBps = int256(random % uint256(span)) - int256(uint256(volatilityBps));
            int256 nextPrice =
                int256(uint256(currentPrice)) + (int256(uint256(currentPrice)) * moveBps) / 10_000;
            if (nextPrice < int256(CREDIT / 100)) nextPrice = int256(CREDIT / 100);
            paperAsset.setPrice(assetId, uint64(uint256(nextPrice)));
        }
        emit MarketAdvanced(epoch);
    }

    function setAuthorizedHook(address hook) external onlyOwner {
        authorizedHook = hook;
        emit HookConfigured(hook);
    }

    /// @notice Optional Uniswap v4 adapter path. It records simulated volume only; it cannot mint credits.
    function recordHookVolume(uint256 profileId, address trader, uint256 simulatedNotional)
        external
    {
        if (msg.sender != authorizedHook) revert NotAuthorizedHook();
        if (effectiveTier(profileId) == 0) revert DeskInactive();
        if (simulatedNotional == 0 || simulatedNotional > MAX_TRADE_NOTIONAL) {
            revert InvalidAmount();
        }
        Desk storage desk = _desks[profileId];
        desk.lifetimeVolume += uint128(simulatedNotional);
        profile.recordPerformance(profileId, simulatedNotional, 0);
        emit HookVolumeRecorded(profileId, trader, simulatedNotional);
    }

    function effectiveTier(uint256 profileId) public view returns (uint8) {
        Desk storage desk = _desks[profileId];
        if (desk.deskAddress == address(0)) return 0;
        if (desk.syncedTransferNonce != profile.transferNonce(profileId)) return 0;
        return desk.tier;
    }

    function tierStake(uint8 tier) public pure returns (uint256) {
        if (tier == 1) return DESK_STAKE;
        if (tier == 2) return 12_500 * CREDIT;
        if (tier == 3) return 30_000 * CREDIT;
        if (tier == 4) return 65_000 * CREDIT;
        revert InvalidTier();
    }

    function getDesk(uint256 profileId)
        external
        view
        returns (
            address deskAddress,
            bytes32 deskName,
            uint8 tier,
            uint64 createdAt,
            uint128 commissionsAccrued,
            uint128 lifetimeCommission,
            uint128 lifetimeVolume
        )
    {
        Desk storage desk = _desks[profileId];
        return (
            desk.deskAddress,
            desk.deskName,
            effectiveTier(profileId),
            desk.createdAt,
            desk.commissionsAccrued,
            desk.lifetimeCommission,
            desk.lifetimeVolume
        );
    }

    function deskCount() external view returns (uint256) {
        return deskProfileIds.length;
    }

    function quote(uint256 profileId, uint256 assetId, uint256 shareAmount)
        external
        view
        returns (uint256 notional, uint256 fee)
    {
        return _quote(profileId, assetId, shareAmount);
    }

    function withdrawNativeFees() external {
        if (msg.sender != nativeTreasury) revert NotProfileOwner();
        (bool ok,) = nativeTreasury.call{ value: address(this).balance }("");
        require(ok, "NATIVE_TRANSFER_FAILED");
    }

    function _quote(uint256 profileId, uint256 assetId, uint256 shareAmount)
        internal
        view
        returns (uint256 notional, uint256 fee)
    {
        if (effectiveTier(profileId) == 0) revert DeskInactive();
        if (profile.ownerOf(profileId) == msg.sender) revert SelfDealing();
        if (shareAmount == 0) revert InvalidAmount();
        (,, uint64 price,, bool active) = paperAsset.assets(assetId);
        if (!active) revert InvalidAmount();
        notional = uint256(price) * shareAmount / CREDIT;
        if (notional == 0 || notional > MAX_TRADE_NOTIONAL) revert InvalidAmount();
        fee = notional * TRADE_FEE_BPS / 10_000;
    }

    function _settleFee(uint256 profileId, address trader, uint256 notional, uint256 fee) internal {
        Desk storage desk = _desks[profileId];
        uint8 tier = effectiveTier(profileId);
        uint256 bankerBps = 6_000 + uint256(tier) * 500;
        uint256 bankerCut = fee * bankerBps / 10_000;
        uint256 loyaltyCut = fee * 1_000 / 10_000;
        uint256 protocolCut = fee * 1_000 / 10_000;
        uint256 rewardCut = fee - bankerCut - loyaltyCut - protocolCut;

        desk.commissionsAccrued += uint128(bankerCut);
        desk.lifetimeCommission += uint128(bankerCut);
        desk.lifetimeVolume += uint128(notional);
        loyaltyCredits[trader] += loyaltyCut;
        protocolCredits += protocolCut;
        rewardPoolCredits += rewardCut;
        profile.recordPerformance(profileId, notional, bankerCut);
        emit LoyaltyEarned(trader, profileId, loyaltyCut);
    }

    function _managedQuote(uint256 assetId, uint256 shareAmount)
        internal
        view
        returns (uint256 notional, uint256 fee, uint256 price)
    {
        if (shareAmount == 0) revert InvalidAmount();
        (,, uint64 storedPrice,, bool active) = paperAsset.assets(assetId);
        if (!active) revert InvalidAmount();
        price = storedPrice;
        notional = price * shareAmount / CREDIT;
        if (notional == 0 || notional > MAX_TRADE_NOTIONAL) revert InvalidAmount();
        fee = notional * TRADE_FEE_BPS / 10_000;
    }

    function _recordManagedTrade(address client, uint256 profileId, uint256 notional, uint256 fee)
        internal
    {
        SeasonStats storage stats = seasonStats[currentSeason][profileId];
        _touchSeasonClient(_managedAccounts[managedAccountKey(client, profileId)], profileId);
        stats.managedVolume += uint128(notional);
        uint256 bankerBps = 6_000 + uint256(effectiveTier(profileId)) * 500;
        stats.bankerCommission += uint96(fee * bankerBps / 10_000);
        _checkpointManagedAccount(client, profileId);
    }

    function _checkpointManagedAccount(address client, uint256 profileId)
        internal
        returns (uint256 equity)
    {
        bytes32 key = managedAccountKey(client, profileId);
        ManagedAccount storage account = _managedAccounts[key];
        equity = portfolioEquity(client, profileId);
        bool seasonOpen = block.timestamp < seasonEndsAt;
        if (account.lastMarkedEquity != 0 && seasonOpen) {
            int256 change = int256(equity) - int256(account.lastMarkedEquity);
            SeasonStats storage stats = seasonStats[currentSeason][profileId];
            int256 nextPnl = int256(stats.outcomePnl) + change;
            if (nextPnl > type(int128).max || nextPnl < type(int128).min) revert InvalidAmount();
            stats.outcomePnl = int128(nextPnl);
        }
        account.lastMarkedEquity = equity;
        if (equity > account.highWaterMark) {
            account.highWaterMark = equity;
        } else if (account.highWaterMark != 0 && seasonOpen) {
            uint256 drawdown = (account.highWaterMark - equity) * 10_000 / account.highWaterMark;
            SeasonStats storage currentStats = seasonStats[currentSeason][profileId];
            if (drawdown > currentStats.worstDrawdownBps) {
                currentStats.worstDrawdownBps = uint16(drawdown > 10_000 ? 10_000 : drawdown);
            }
        }
    }

    function _requireBanker(uint256 profileId) internal view {
        if (profile.ownerOf(profileId) != msg.sender) revert NotBanker();
        if (effectiveTier(profileId) == 0) revert DeskInactive();
    }

    function _requireRebalanceReady(ManagedAccount storage account, uint32 cooldown) internal view {
        if (account.joinedAt == 0) revert InvalidAmount();
        if (account.lastTradeAt != 0 && block.timestamp < uint256(account.lastTradeAt) + cooldown) {
            revert CooldownActive();
        }
    }

    function _touchSeasonClient(ManagedAccount storage account, uint256 profileId) internal {
        if (account.lastActiveSeason != currentSeason) {
            account.lastActiveSeason = currentSeason;
            seasonStats[currentSeason][profileId].clientsServed++;
        }
    }

    function _currentDrawdownBps(ManagedAccount storage account, uint256 equity)
        internal
        view
        returns (uint256)
    {
        if (account.highWaterMark == 0 || equity >= account.highWaterMark) return 0;
        return (account.highWaterMark - equity) * 10_000 / account.highWaterMark;
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
