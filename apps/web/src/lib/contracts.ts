import { isAddress, parseAbi, zeroAddress } from "viem";

export const gameAddress = isAddress(import.meta.env.VITE_GAME_ADDRESS ?? "")
  ? (import.meta.env.VITE_GAME_ADDRESS as `0x${string}`)
  : zeroAddress;

export const profileAddress = isAddress(import.meta.env.VITE_PROFILE_ADDRESS ?? "")
  ? (import.meta.env.VITE_PROFILE_ADDRESS as `0x${string}`)
  : zeroAddress;

export const paperAssetAddress = isAddress(import.meta.env.VITE_PAPER_ASSET_ADDRESS ?? "")
  ? (import.meta.env.VITE_PAPER_ASSET_ADDRESS as `0x${string}`)
  : zeroAddress;

export const achievementAddress = isAddress(import.meta.env.VITE_ACHIEVEMENT_ADDRESS ?? "")
  ? (import.meta.env.VITE_ACHIEVEMENT_ADDRESS as `0x${string}`)
  : zeroAddress;

export const crewAddress = isAddress(import.meta.env.VITE_CREW_ADDRESS ?? "")
  ? (import.meta.env.VITE_CREW_ADDRESS as `0x${string}`)
  : zeroAddress;

export const dealRoomAddress = isAddress(import.meta.env.VITE_DEAL_ROOM_ADDRESS ?? "")
  ? (import.meta.env.VITE_DEAL_ROOM_ADDRESS as `0x${string}`)
  : zeroAddress;

export const workFloorAddress = isAddress(import.meta.env.VITE_WORK_FLOOR_ADDRESS ?? "")
  ? (import.meta.env.VITE_WORK_FLOOR_ADDRESS as `0x${string}`)
  : zeroAddress;

export const contractsConfigured = gameAddress !== zeroAddress;

export const gameAbi = parseAbi([
  "function claimFaucet()",
  "function mintProfile(bytes32 handle) payable returns (uint256)",
  "function createDesk(uint256 profileId, bytes32 deskName) returns (address)",
  "function activateDesk(uint256 profileId, uint8 targetTier)",
  "function buy(uint256 profileId, uint256 assetId, uint256 shareAmount)",
  "function sell(uint256 profileId, uint256 assetId, uint256 shareAmount)",
  "function claimCommissions(uint256 profileId) returns (uint256)",
  "function claimLoyaltyCredits() returns (uint256)",
  "function loyaltyCredits(address) view returns (uint256)",
  "function setRiskMandate(uint256 profileId, bytes32 strategyName, uint16 maxPositionBps, uint16 maxDrawdownBps, uint32 rebalanceCooldown, uint8 riskClass)",
  "function setMandateActive(uint256 profileId, bool active)",
  "function allocateToDesk(uint256 profileId, uint256 amount)",
  "function withdrawFromDesk(uint256 profileId, uint256 amount)",
  "function managedBuy(address client, uint256 profileId, uint256 assetId, uint256 shareAmount)",
  "function managedSell(address client, uint256 profileId, uint256 assetId, uint256 shareAmount)",
  "function portfolioEquity(address client, uint256 profileId) view returns (uint256)",
  "function outcomeScore(uint64 seasonId, uint256 profileId) view returns (uint256)",
  "function towerFloorOf(uint256 profileId) view returns (uint8)",
  "function latestTowerRank(uint256 profileId) view returns (uint16)",
  "function floor100Champion() view returns (uint256)",
  "function previewTowerFloor(uint64 seasonId, uint256 profileId, uint16 towerRank) view returns (uint8)",
  "function offices(uint256 profileId) view returns (uint8 terminalLevel, uint8 researchLevel, uint8 hospitalityLevel, uint16 rating, uint128 creditsSpent)",
  "function maxOfficeLevel(uint256 profileId) view returns (uint8)",
  "function officeUpgradeCost(uint8 targetLevel) pure returns (uint256)",
  "function upgradeOffice(uint256 profileId, uint8 track) returns (uint8)",
  "function currentSeason() view returns (uint64)",
  "function seasonEndsAt() view returns (uint64)",
  "function advanceMarket()",
  "function credits(address) view returns (uint256)",
  "function deskCount() view returns (uint256)",
  "function deskProfileIds(uint256) view returns (uint256)",
  "function effectiveTier(uint256 profileId) view returns (uint8)",
  "function quote(uint256 profileId, uint256 assetId, uint256 shareAmount) view returns (uint256 notional, uint256 fee)",
  "function getDesk(uint256 profileId) view returns (address deskAddress, bytes32 deskName, uint8 tier, uint64 createdAt, uint128 commissionsAccrued, uint128 lifetimeCommission, uint128 lifetimeVolume)",
  "function simulationNotice() pure returns (string)",
]);

export const profileAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function handleOf(uint256 tokenId) view returns (bytes32)",
  "function transferNonce(uint256 tokenId) view returns (uint64)",
  "function totalSupply() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function remainingSupply() view returns (uint256)",
  "function tokensOfOwner(address account) view returns (uint256[])",
  "function tokenOfOwnerByIndex(address account, uint256 index) view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)",
  "function levelOf(uint256 tokenId) view returns (uint256)",
  "function scoreOf(uint256 tokenId) view returns (uint256)",
  "function towerFloorOf(uint256 tokenId) view returns (uint8)",
  "function latestTowerRankOf(uint256 tokenId) view returns (uint16)",
  "function latestTowerSeasonOf(uint256 tokenId) view returns (uint64)",
  "function officeRatingOf(uint256 tokenId) view returns (uint16)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);

export const paperAssetAbi = parseAbi([
  "function balanceOf(uint256 assetId, address account) view returns (uint256)",
  "function assets(uint256 assetId) view returns (bytes12 symbol, bytes32 displayName, uint64 price, uint32 volatilityBps, bool active)",
]);

export const achievementAbi = parseAbi([
  "function claim(bytes32 programId, uint256 profileId)",
  "function claimed(bytes32 programId, address account) view returns (bool)",
  "function programs(bytes32 programId) view returns (address observedToken, uint256 minimumBalance, bytes32 badgeName, bool active)",
]);

export const crewAbi = parseAbi([
  "function createCrew(bytes32 name, uint256 captainProfileId) returns (uint256)",
  "function inviteProfile(uint256 crewId, uint256 profileId)",
  "function cancelInvitation(uint256 crewId, uint256 profileId)",
  "function acceptInvitation(uint256 crewId, uint256 profileId)",
  "function setRole(uint256 crewId, uint256 profileId, uint8 role)",
  "function transferCaptain(uint256 crewId, uint256 newCaptainProfileId)",
  "function leaveCrew(uint256 profileId)",
  "function crewCount() view returns (uint256)",
  "function crews(uint256 crewId) view returns (bytes32 name, uint256 captainProfileId, uint64 createdAt, uint16 memberCount, bool active)",
  "function crewOfProfile(uint256 profileId) view returns (uint256)",
  "function roleOfProfile(uint256 profileId) view returns (uint8)",
  "function getMembers(uint256 crewId) view returns (uint256[])",
  "function headquartersFloor(uint256 crewId) view returns (uint8)",
  "function crewSeasonScore(uint256 crewId, uint64 seasonId) view returns (uint256)",
  "function crewOfficeRating(uint256 crewId) view returns (uint256)",
]);

export const dealRoomAbi = parseAbi([
  "function submitPitch(uint256 offeringId, uint256 leadProfileId, bytes32 strategyName)",
  "function cancelOffering(uint256 offeringId)",
  "function finalizeOffering(uint256 offeringId) returns (uint256 winningCrewId, uint256 winningScore)",
  "function offeringCount() view returns (uint256)",
  "function offerings(uint256 offeringId) view returns (bytes32 clientName, bytes12 ticker, bytes32 mandate, uint64 seasonId, uint64 pitchDeadline, uint8 minimumHeadquartersFloor, uint32 minimumReputation, uint32 reputationReward, uint128 paperAllocation, uint16 pitchCount, uint256 winnerCrewId, uint256 winningScore, bool active, bool finalized)",
  "function pitches(uint256 offeringId, uint256 crewId) view returns (uint256 leadProfileId, bytes32 strategyName, uint64 submittedAt, uint8 headquartersFloorAtPitch, uint32 reputationAtPitch, bool exists)",
  "function pitchScore(uint256 offeringId, uint256 crewId) view returns (uint256)",
  "function firmReputation(uint256 crewId) view returns (uint32)",
  "function mandatesWon(uint256 crewId) view returns (uint32)",
  "function paperAllocations(uint256 crewId, uint256 offeringId) view returns (uint128)",
  "function executiveFloorOf(uint256 crewId) view returns (uint8)",
  "function getOfferingCrews(uint256 offeringId) view returns (uint256[])",
  "function getPitchRoster(uint256 offeringId, uint256 crewId) view returns (uint256[])",
  "function simulationNotice() pure returns (string)",
]);

export const workFloorAbi = parseAbi([
  "function clockIn(uint256 profileId, uint8 assignment)",
  "function finishShift(uint256 profileId) returns (uint256 requestId)",
  "function spinDailySuit(uint256 profileId) returns (uint256 requestId)",
  "function shifts(uint256 profileId) view returns (uint64 startedAt, uint64 readyAt, uint64 completedAt, uint8 assignment, uint8 status, uint8 quality, uint8 rarity, uint256 requestId)",
  "function workReputation(uint256 profileId) view returns (uint32)",
  "function completedShifts(uint256 profileId) view returns (uint32)",
  "function dailySuitSpins(uint256 profileId) view returns (uint32)",
  "function lastSuitSpinDayPlusOne(uint256 profileId) view returns (uint64)",
  "function bestSuitTier(uint256 profileId) view returns (uint8)",
  "function latestSuitTier(uint256 profileId) view returns (uint8)",
  "function latestSuitStyle(uint256 profileId) view returns (uint8)",
  "function suitCollection(uint256 profileId, uint8 tier) view returns (uint32)",
  "function dailyWorkScore(uint64 day, uint256 profileId) view returns (uint32)",
  "function dailyLeaderProfile(uint64 day) view returns (uint256)",
  "function dailyLeaderScore(uint64 day) view returns (uint32)",
  "function dailyTrophyClaimed(uint64 day) view returns (bool)",
  "function dailyWins(uint256 profileId) view returns (uint32)",
  "function claimDailyTrophy(uint64 day)",
  "function suitName(uint8 tier) pure returns (string)",
  "function suitStyleName(uint8 style) pure returns (string)",
]);

export const erc20ReadOnlyAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);
