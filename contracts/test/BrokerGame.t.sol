// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BankerProfile } from "../src/BankerProfile.sol";
import {
    BankerWorkFloor,
    IRandomnessProvider,
    IWorkFloorGame,
    IWorkFloorProfile
} from "../src/BankerWorkFloor.sol";
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
import { LocalRandomnessProvider } from "../src/randomness/LocalRandomnessProvider.sol";
import {
    ChainlinkVrfV25Adapter,
    IVRFCoordinatorV2Plus,
    VRFV2PlusRequest
} from "../src/randomness/ChainlinkVrfV25Adapter.sol";
import {
    IAchievementGame,
    IEligibilityView,
    ReadOnlyAchievementRegistry
} from "../src/ReadOnlyAchievementRegistry.sol";

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function expectRevert(bytes4 revertData) external;
    function prank(address sender) external;
    function store(address target, bytes32 slot, bytes32 value) external;
    function warp(uint256 newTimestamp) external;
}

contract MockObservedToken {
    mapping(address => uint256) public balanceOf;

    function setBalance(address account, uint256 amount) external {
        balanceOf[account] = amount;
    }
}

contract MockVrfCoordinator is IVRFCoordinatorV2Plus {
    uint256 public requestCount;

    function requestRandomWords(VRFV2PlusRequest.RandomWordsRequest calldata)
        external
        returns (uint256 requestId)
    {
        requestId = ++requestCount;
    }

    function fulfill(ChainlinkVrfV25Adapter adapter, uint256 requestId, uint256 randomWord)
        external
    {
        uint256[] memory words = new uint256[](1);
        words[0] = randomWord;
        adapter.rawFulfillRandomWords(requestId, words);
    }
}

contract BrokerGameTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant BANKER = address(0xB0B);
    address private constant CLIENT = address(0xC11E17);
    address private constant BUYER = address(0xB0B2);
    uint256 private constant MINT_FEE = 0.001 ether;

    BankerProfile private profile;
    PaperAsset private assets;
    BrokerGame private game;

    function setUp() public {
        profile = new BankerProfile(address(this));
        assets = new PaperAsset(address(this));
        game = new BrokerGame(
            address(this), profile, assets, address(this), MINT_FEE, block.chainid
        );
        profile.setGame(address(game));
        assets.setGame(address(game));
        assets.addAsset("NOVA", "Nova Robotics", 42 * 1e6, 350);

        vm.deal(BANKER, 10 ether);
        vm.deal(CLIENT, 10 ether);
        vm.deal(BUYER, 10 ether);
    }

    function testFullBrokerageLoopSplitsCommissions() public {
        _createBankerDesk();

        vm.prank(CLIENT);
        game.claimFaucet();

        vm.prank(CLIENT);
        game.buy(1, 1, 2 * 1e6);

        uint256 notional = 84 * 1e6;
        uint256 fee = notional / 100;
        uint256 bankerCut = fee * 6_500 / 10_000;

        _assertEq(assets.balanceOf(1, CLIENT), 2 * 1e6, "paper position");
        _assertEq(game.protocolCredits(), fee * 1_000 / 10_000, "protocol split");
        _assertEq(game.loyaltyCredits(CLIENT), fee * 1_000 / 10_000, "client loyalty");
        (,,,, uint128 accrued, uint128 lifetimeCommission, uint128 lifetimeVolume) = game.getDesk(1);
        _assertEq(accrued, bankerCut, "commission accrued");
        _assertEq(lifetimeCommission, bankerCut, "commission lifetime");
        _assertEq(lifetimeVolume, notional, "volume lifetime");

        uint256 beforeClaim = game.credits(BANKER);
        vm.prank(BANKER);
        game.claimCommissions(1);
        _assertEq(game.credits(BANKER), beforeClaim + bankerCut, "claimed commission");

        uint256 clientBefore = game.credits(CLIENT);
        vm.prank(CLIENT);
        game.claimLoyaltyCredits();
        _assertEq(game.credits(CLIENT), clientBefore + fee * 1_000 / 10_000, "claimed loyalty");
    }

    function testManagedPortfolioMandateAndOutcomeScore() public {
        _createBankerDesk();
        vm.prank(BANKER);
        game.setRiskMandate(1, "Balanced Growth", 6_000, 2_000, 0, 3);

        vm.prank(CLIENT);
        game.claimFaucet();
        vm.prank(CLIENT);
        game.allocateToDesk(1, 10_000 * 1e6);

        vm.prank(BANKER);
        game.managedBuy(CLIENT, 1, 1, 1e6);

        _assertEq(game.managedPositions(game.managedAccountKey(CLIENT, 1), 1), 1e6, "position");
        _assertEq(game.portfolioEquity(CLIENT, 1), 9_999_580_000, "equity after fee");
        if (game.outcomeScore(1, 1) < 1_000) revert("outcome score not recorded");

        vm.prank(BANKER);
        game.managedSell(CLIENT, 1, 1, 1e6);
        BrokerGame.ManagedAccount memory account = game.getManagedAccount(CLIENT, 1);
        if (account.cash == 0) revert("managed cash missing");

        uint256 withdrawable = account.cash;
        vm.prank(CLIENT);
        game.withdrawFromDesk(1, withdrawable);
        _assertEq(game.portfolioEquity(CLIENT, 1), 0, "portfolio withdrawn");
    }

    function testMandateConcentrationAndCooldownAreEnforced() public {
        _createBankerDesk();
        vm.prank(BANKER);
        game.setRiskMandate(1, "Guardrail", 5_000, 2_000, 1 hours, 2);
        vm.prank(CLIENT);
        game.claimFaucet();
        vm.prank(CLIENT);
        game.allocateToDesk(1, 100 * 1e6);

        vm.prank(BANKER);
        game.managedBuy(CLIENT, 1, 1, 1e6);
        vm.expectRevert(BrokerGame.CooldownActive.selector);
        vm.prank(BANKER);
        game.managedBuy(CLIENT, 1, 1, 100_000);

        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert(BrokerGame.PositionLimitExceeded.selector);
        vm.prank(BANKER);
        game.managedBuy(CLIENT, 1, 1, 1e6);
    }

    function testSeasonResultEvolvesNft() public {
        _createBankerDesk();
        vm.prank(BANKER);
        game.setRiskMandate(1, "Season One", 8_000, 3_000, 0, 4);
        vm.prank(CLIENT);
        game.claimFaucet();
        vm.prank(CLIENT);
        game.allocateToDesk(1, 1_000 * 1e6);

        vm.warp(game.seasonEndsAt());
        game.startNextSeason(14 days);
        game.awardSeasonResult(1, 1, 1);

        (,,, uint32 bestScore,, uint16 medals, uint16 latestSeason) = profile.statsOf(1);
        if (bestScore == 0) revert("season score missing");
        _assertEq(medals, 3, "gold medal weight");
        _assertEq(latestSeason, 1, "latest season");
    }

    function testTowerChampionUpdatesNftFloorAndRank() public {
        _createBankerDesk();
        vm.prank(BANKER);
        game.setRiskMandate(1, "Tower Run", 8_000, 3_000, 0, 3);
        vm.prank(CLIENT);
        game.claimFaucet();
        vm.prank(CLIENT);
        game.allocateToDesk(1, 1_000 * 1e6);
        bytes32 metadataBefore = keccak256(bytes(profile.tokenURI(1)));

        vm.warp(game.seasonEndsAt());
        game.startNextSeason(14 days);
        game.settleTowerFloor(1, 1, 1);

        _assertEq(game.towerFloorOf(1), 100, "game floor");
        _assertEq(game.latestTowerRank(1), 1, "game rank");
        _assertEq(game.floor100Champion(), 1, "penthouse champion");
        _assertEq(profile.towerFloorOf(1), 100, "nft floor");
        _assertEq(profile.latestTowerRankOf(1), 1, "nft rank");
        _assertEq(profile.latestTowerSeasonOf(1), 1, "nft season");
        if (keccak256(bytes(profile.tokenURI(1))) == metadataBefore) {
            revert("tower metadata did not evolve");
        }

        vm.expectRevert(BrokerGame.TowerFloorAlreadySettled.selector);
        game.settleTowerFloor(1, 1, 1);
    }

    function testTowerPromotionIsCappedAndInactivityDemotes() public {
        _createBankerDesk();
        vm.prank(BANKER);
        game.setRiskMandate(1, "Steady Climb", 8_000, 3_000, 0, 3);
        vm.prank(CLIENT);
        game.claimFaucet();
        vm.prank(CLIENT);
        game.allocateToDesk(1, 1_000 * 1e6);

        vm.warp(game.seasonEndsAt());
        game.startNextSeason(14 days);
        game.settleTowerFloor(1, 1, 2);
        _assertEq(game.towerFloorOf(1), 11, "ten-floor promotion cap");

        vm.warp(game.seasonEndsAt());
        game.startNextSeason(14 days);
        game.settleTowerFloor(2, 1, 50);
        _assertEq(game.towerFloorOf(1), 8, "inactive desk demotion");
        _assertEq(profile.towerFloorOf(1), 8, "nft follows demotion");
        _assertEq(profile.latestTowerRankOf(1), 50, "wallet rank follows demotion");
    }

    function testOfficeUpgradesAreFloorGatedAndUpdateNft() public {
        _createBankerDesk();
        uint256 creditsBefore = game.credits(BANKER);
        uint256 poolBefore = game.rewardPoolCredits();
        bytes32 metadataBefore = keccak256(bytes(profile.tokenURI(1)));

        vm.prank(BANKER);
        game.upgradeOffice(1, 1);
        (uint8 terminal, uint8 research, uint8 hospitality, uint16 rating, uint128 spent) =
            game.offices(1);
        _assertEq(terminal, 1, "terminal level");
        _assertEq(research, 0, "research level");
        _assertEq(hospitality, 0, "hospitality level");
        _assertEq(rating, 100, "office rating");
        _assertEq(spent, 2_000 * 1e6, "office spend");
        _assertEq(profile.officeRatingOf(1), 100, "nft office rating");
        _assertEq(game.credits(BANKER), creditsBefore - 2_000 * 1e6, "upgrade cost");
        _assertEq(game.rewardPoolCredits(), poolBefore + 2_000 * 1e6, "upgrade sink");
        if (keccak256(bytes(profile.tokenURI(1))) == metadataBefore) {
            revert("office metadata did not evolve");
        }

        vm.expectRevert(BrokerGame.OfficeLevelLocked.selector);
        vm.prank(BANKER);
        game.upgradeOffice(1, 1);

        vm.prank(BANKER);
        game.setRiskMandate(1, "Penthouse Run", 8_000, 3_000, 0, 3);
        vm.prank(CLIENT);
        game.claimFaucet();
        vm.prank(CLIENT);
        game.allocateToDesk(1, 1_000 * 1e6);
        vm.warp(game.seasonEndsAt());
        game.startNextSeason(14 days);
        game.settleTowerFloor(1, 1, 1);

        vm.prank(BANKER);
        game.upgradeOffice(1, 1);
        (terminal,,, rating,) = game.offices(1);
        _assertEq(terminal, 2, "penthouse unlock");
        _assertEq(rating, 200, "office rating evolved");
    }

    function testCrewInvitationsRolesAndHeadquarters() public {
        _createBankerDesk();
        CrewRegistry crews =
            new CrewRegistry(ICrewProfile(address(profile)), ICrewGame(address(game)));

        vm.expectRevert(CrewRegistry.FloorTooLow.selector);
        vm.prank(BANKER);
        crews.createCrew("Northstar Firm", 1);

        vm.prank(BANKER);
        game.setRiskMandate(1, "Crew Season", 8_000, 3_000, 0, 3);
        vm.prank(CLIENT);
        game.claimFaucet();
        vm.prank(CLIENT);
        game.allocateToDesk(1, 1_000 * 1e6);
        vm.warp(game.seasonEndsAt());
        game.startNextSeason(14 days);
        game.settleTowerFloor(1, 1, 1);
        vm.prank(BANKER);
        game.upgradeOffice(1, 1);

        vm.prank(BUYER);
        game.mintProfile{ value: MINT_FEE }("buyer_bank");
        vm.prank(BUYER);
        game.claimFaucet();
        vm.prank(BUYER);
        game.createDesk(2, "Buyer Desk");

        vm.prank(BANKER);
        uint256 crewId = crews.createCrew("Northstar Firm", 1);
        vm.prank(BANKER);
        crews.inviteProfile(crewId, 2);
        vm.prank(BUYER);
        crews.acceptInvitation(crewId, 2);

        _assertEq(crews.crewOfProfile(1), crewId, "captain crew");
        _assertEq(crews.crewOfProfile(2), crewId, "member crew");
        _assertEq(crews.roleOfProfile(1), 3, "captain role");
        _assertEq(crews.roleOfProfile(2), 2, "trader role");
        _assertEq(crews.headquartersFloor(crewId), 50, "average hq floor");
        _assertEq(crews.crewOfficeRating(crewId), 100, "shared office rating");
        _assertEq(crews.joinedSeasonOfProfile(1), 2, "captain join season");
        _assertEq(crews.joinedSeasonOfProfile(2), 2, "member join season");
        _assertEq(crews.crewSeasonScore(crewId, 1), 0, "no retroactive crew score");
        _assertEq(crews.getMembers(crewId).length, 2, "crew roster");

        vm.prank(BANKER);
        crews.setRole(crewId, 2, 1);
        _assertEq(crews.roleOfProfile(2), 1, "analyst role");
        vm.expectRevert(CrewRegistry.CaptainMustTransfer.selector);
        vm.prank(BANKER);
        crews.leaveCrew(1);

        vm.prank(BANKER);
        crews.transferCaptain(crewId, 2);
        vm.prank(BANKER);
        crews.leaveCrew(1);
        _assertEq(crews.roleOfProfile(2), 3, "new captain");
        _assertEq(crews.headquartersFloor(crewId), 1, "hq follows roster");
    }

    function testReadOnlyAchievementRequiresEligibilityAndBalance() public {
        _createBankerDesk();
        EligibilityRegistry eligibility = new EligibilityRegistry(address(this));
        ReadOnlyAchievementRegistry achievements = new ReadOnlyAchievementRegistry(
            address(this), IEligibilityView(address(eligibility)), IAchievementGame(address(game))
        );
        MockObservedToken token = new MockObservedToken();
        bytes32 programId = keccak256("ELIGIBLE_STOCK_TOKEN_READER");

        game.setAchievementRegistry(address(achievements));
        eligibility.setAttestor(address(this), true);
        eligibility.attest(programId, BANKER, uint64(block.timestamp + 7 days));
        achievements.configureProgram(programId, address(token), 1e18, "Observer", true);
        token.setBalance(BANKER, 1e18);

        vm.prank(BANKER);
        achievements.claim(programId, 1);
        (,,,, uint16 achievementCount,,) = profile.statsOf(1);
        _assertEq(achievementCount, 1, "achievement count");
    }

    function testDeskDeactivatesOnProfileTransfer() public {
        _createBankerDesk();
        vm.prank(BANKER);
        game.mintProfile{ value: MINT_FEE }("second_banker");
        uint256[] memory bankerProfilesBefore = profile.tokensOfOwner(BANKER);
        _assertEq(bankerProfilesBefore.length, 2, "wallet profile count before transfer");
        _assertEq(profile.tokenOfOwnerByIndex(BANKER, 0), 1, "first wallet profile");
        _assertEq(profile.tokenOfOwnerByIndex(BANKER, 1), 2, "second wallet profile");
        _assertEq(profile.tokenByIndex(0), 1, "first collection profile");
        _assertEq(profile.tokenByIndex(1), 2, "second collection profile");

        vm.warp(game.seasonEndsAt());
        game.startNextSeason(7 days);
        game.settleTowerFloor(1, 1, 1);
        uint8 floorBefore = profile.towerFloorOf(1);
        uint16 rankBefore = profile.latestTowerRankOf(1);
        string memory metadataBefore = profile.tokenURI(1);

        vm.prank(BANKER);
        profile.safeTransferFrom(BANKER, BUYER, 1);
        if (profile.ownerOf(1) != BUYER) revert("profile did not move wallets");
        uint256[] memory bankerProfilesAfter = profile.tokensOfOwner(BANKER);
        uint256[] memory buyerProfilesAfter = profile.tokensOfOwner(BUYER);
        _assertEq(bankerProfilesAfter.length, 1, "sender profile count");
        _assertEq(bankerProfilesAfter[0], 2, "sender retained second profile");
        _assertEq(buyerProfilesAfter.length, 1, "receiver profile count");
        _assertEq(buyerProfilesAfter[0], 1, "receiver discovered profile");
        _assertEq(profile.transferNonce(1), 1, "transfer count");
        _assertEq(profile.towerFloorOf(1), floorBefore, "floor history moved");
        _assertEq(profile.latestTowerRankOf(1), rankBefore, "rank history moved");
        if (keccak256(bytes(metadataBefore)) == keccak256(bytes(profile.tokenURI(1)))) {
            revert("metadata did not refresh after transfer");
        }
        _assertEq(game.effectiveTier(1), 0, "transfer resets tier");

        vm.prank(BUYER);
        game.claimFaucet();
        vm.prank(BUYER);
        game.claimCommissions(1);
        _assertEq(game.effectiveTier(1), 0, "claim does not bypass reactivation");
        vm.prank(BUYER);
        game.activateDesk(1, 1);
        _assertEq(game.effectiveTier(1), 1, "new owner can reactivate");
    }

    function testSelfDealingIsBlocked() public {
        _createBankerDesk();
        vm.expectRevert(BrokerGame.SelfDealing.selector);
        vm.prank(BANKER);
        game.buy(1, 1, 1e6);
    }

    function testFaucetCooldownAndMarketEpoch() public {
        vm.prank(CLIENT);
        game.claimFaucet();
        vm.expectRevert(BrokerGame.CooldownActive.selector);
        vm.prank(CLIENT);
        game.claimFaucet();

        game.advanceMarket();
        vm.expectRevert(BrokerGame.CooldownActive.selector);
        game.advanceMarket();
        vm.warp(block.timestamp + 1 hours);
        game.advanceMarket();
    }

    function testTokenUriIsFullyOnchain() public {
        _createBankerDesk();
        if (!profile.supportsInterface(0x49064906)) revert("missing EIP-4906 support");
        if (!profile.supportsInterface(0x780e9d63)) revert("missing ERC-721 enumerable support");
        string memory uri = profile.tokenURI(1);
        bytes memory prefix = bytes("data:application/json;base64,");
        bytes memory data = bytes(uri);
        for (uint256 i; i < prefix.length; i++) {
            if (prefix[i] != data[i]) revert("unexpected uri prefix");
        }
    }

    function testDuplicateBankerHandlesAreBlocked() public {
        _createBankerDesk();
        vm.expectRevert(BankerProfile.HandleTaken.selector);
        vm.prank(BUYER);
        game.mintProfile{ value: MINT_FEE }("delta_bank");
    }

    function testBankerCollectionIsCappedAtOneThousand() public {
        _assertEq(profile.MAX_SUPPLY(), 1_000, "collection size");
        _assertEq(profile.remainingSupply(), 1_000, "initial remaining supply");

        // Ownable.owner occupies slot 0; game and totalSupply follow in slots 1 and 2.
        vm.store(address(profile), bytes32(uint256(2)), bytes32(uint256(1_000)));
        _assertEq(profile.remainingSupply(), 0, "sold-out remaining supply");

        vm.expectRevert(BankerProfile.CollectionSoldOut.selector);
        vm.prank(BANKER);
        game.mintProfile{ value: MINT_FEE }("last_banker");
    }

    function testSeasonAwardsAndTowerSettlementsRejectOlderSeasons() public {
        _createBankerDesk();
        vm.warp(game.seasonEndsAt());
        game.startNextSeason(7 days);
        vm.warp(game.seasonEndsAt());
        game.startNextSeason(7 days);

        game.awardSeasonResult(2, 1, 1);
        vm.expectRevert(BrokerGame.SeasonResultOutOfOrder.selector);
        game.awardSeasonResult(1, 1, 1);

        game.settleTowerFloor(2, 1, 50);
        vm.expectRevert(BrokerGame.TowerSeasonOutOfOrder.selector);
        game.settleTowerFloor(1, 1, 50);
    }

    function testCorporateDealRoomAwardsPaperMandateAndExecutiveAccess() public {
        _createBankerDesk();
        vm.prank(BANKER);
        game.setRiskMandate(1, "Client Outcomes", 8_000, 3_000, 0, 3);
        vm.prank(CLIENT);
        game.claimFaucet();
        vm.prank(CLIENT);
        game.allocateToDesk(1, 1_000 * 1e6);

        vm.warp(game.seasonEndsAt());
        game.startNextSeason(14 days);
        game.settleTowerFloor(1, 1, 1);

        CrewRegistry crews =
            new CrewRegistry(ICrewProfile(address(profile)), ICrewGame(address(game)));
        vm.prank(BANKER);
        uint256 crewId = crews.createCrew("Northstar Firm", 1);
        CorporateDealRoom dealRoom = new CorporateDealRoom(
            address(this),
            IDealRoomProfile(address(profile)),
            IDealRoomGame(address(game)),
            IDealRoomCrews(address(crews))
        );

        uint256 offeringId = dealRoom.createOffering(
            "Atlas Dynamics",
            "ATLS",
            "Paper IPO Growth",
            uint64(game.seasonEndsAt() - 1 days),
            50,
            0,
            1_000,
            uint128(25_000 * 1e6)
        );
        vm.prank(BANKER);
        dealRoom.submitPitch(offeringId, 1, "Disciplined Growth");
        _assertEq(dealRoom.getPitchRoster(offeringId, crewId).length, 1, "pitch roster");

        vm.prank(CLIENT);
        game.allocateToDesk(1, 1_000 * 1e6);
        vm.warp(game.seasonEndsAt());
        game.startNextSeason(14 days);
        (uint256 winner, uint256 winningScore) = dealRoom.finalizeOffering(offeringId);

        _assertEq(winner, crewId, "winning firm");
        if (winningScore == 0) revert("winning score missing");
        _assertEq(dealRoom.firmReputation(crewId), 1_000, "firm reputation");
        _assertEq(dealRoom.mandatesWon(crewId), 1, "mandates won");
        _assertEq(dealRoom.paperAllocations(crewId, offeringId), 25_000 * 1e6, "paper allocation");
        _assertEq(dealRoom.executiveFloorOf(crewId), 80, "executive floor");

        uint256 cancelledId = dealRoom.createOffering(
            "Cancelled Client",
            "CXL",
            "Withdrawn Paper Book",
            uint64(game.seasonEndsAt() - 1 days),
            50,
            0,
            500,
            uint128(5_000 * 1e6)
        );
        dealRoom.cancelOffering(cancelledId);
        vm.expectRevert(CorporateDealRoom.OfferingClosed.selector);
        vm.prank(BANKER);
        dealRoom.submitPitch(cancelledId, 1, "Late Book");
    }

    function testManagedScoringClosesAtDeadlineWithoutLockingClientCash() public {
        _createBankerDesk();
        vm.prank(BANKER);
        game.setRiskMandate(1, "Hard Close", 8_000, 3_000, 0, 3);
        vm.prank(CLIENT);
        game.claimFaucet();

        vm.expectRevert(BrokerGame.InvalidAmount.selector);
        vm.prank(CLIENT);
        game.allocateToDesk(1, 99 * 1e6);
        vm.prank(CLIENT);
        game.allocateToDesk(1, 100 * 1e6);

        vm.warp(game.seasonEndsAt());
        vm.expectRevert(BrokerGame.SeasonClosed.selector);
        vm.prank(CLIENT);
        game.allocateToDesk(1, 100 * 1e6);
        vm.expectRevert(BrokerGame.SeasonClosed.selector);
        vm.prank(BANKER);
        game.managedBuy(CLIENT, 1, 1, 1e6);

        vm.prank(CLIENT);
        game.withdrawFromDesk(1, 100 * 1e6);
        _assertEq(game.portfolioEquity(CLIENT, 1), 0, "cash remains withdrawable");
    }

    function testWorkShiftBuildsAssetAndDailySuitCannotReroll() public {
        _createBankerDesk();
        LocalRandomnessProvider provider = new LocalRandomnessProvider(address(this));
        BankerWorkFloor workFloor = new BankerWorkFloor(
            IWorkFloorProfile(address(profile)),
            IWorkFloorGame(address(game)),
            IRandomnessProvider(address(provider))
        );
        provider.setConsumer(address(workFloor));

        vm.prank(BANKER);
        workFloor.clockIn(1, 1);
        vm.expectRevert(BankerWorkFloor.ShiftNotReady.selector);
        vm.prank(BANKER);
        workFloor.finishShift(1);

        vm.warp(block.timestamp + workFloor.SHIFT_DURATION());
        vm.prank(BANKER);
        uint256 shiftRequestId = workFloor.finishShift(1);
        provider.fulfill(shiftRequestId, 777);
        _assertEq(workFloor.completedShifts(1), 1, "completed work shift");
        if (workFloor.workReputation(1) == 0) revert("work reputation missing");

        vm.prank(BANKER);
        uint256 suitRequestId = workFloor.spinDailySuit(1);
        provider.fulfill(suitRequestId, 9_999);
        _assertEq(workFloor.bestSuitTier(1), 5, "legend suit");
        _assertEq(workFloor.suitCollection(1, 5), 1, "wardrobe count");
        uint64 contestDay = uint64(block.timestamp / 1 days);
        _assertEq(workFloor.dailyLeaderProfile(contestDay), 1, "daily leader");
        if (workFloor.dailyLeaderScore(contestDay) == 0) revert("daily score missing");

        vm.expectRevert(BankerWorkFloor.AlreadySpunToday.selector);
        vm.prank(BANKER);
        workFloor.spinDailySuit(1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(BANKER);
        uint256 secondSuitRequestId = workFloor.spinDailySuit(1);
        provider.fulfill(secondSuitRequestId, 0);
        workFloor.claimDailyTrophy(contestDay);
        _assertEq(workFloor.dailySuitSpins(1), 2, "daily spin count");
        _assertEq(workFloor.dailyWins(1), 1, "daily trophy");
        _assertEq(workFloor.latestSuitTier(1), 1, "latest suit");
        _assertEq(workFloor.bestSuitTier(1), 5, "best suit retained");
    }

    function testVrfAdapterStoresThenPermissionlesslyDelivers() public {
        _createBankerDesk();
        MockVrfCoordinator coordinator = new MockVrfCoordinator();
        ChainlinkVrfV25Adapter adapter = new ChainlinkVrfV25Adapter(
            address(this),
            IVRFCoordinatorV2Plus(address(coordinator)),
            bytes32(uint256(1)),
            1,
            3,
            250_000,
            false
        );
        BankerWorkFloor workFloor = new BankerWorkFloor(
            IWorkFloorProfile(address(profile)),
            IWorkFloorGame(address(game)),
            IRandomnessProvider(address(adapter))
        );
        adapter.setConsumer(address(workFloor));

        vm.prank(BANKER);
        uint256 requestId = workFloor.spinDailySuit(1);
        coordinator.fulfill(adapter, requestId, 9_999);
        if (!adapter.fulfilled(requestId)) revert("randomness not stored");
        _assertEq(workFloor.bestSuitTier(1), 0, "consumer called too early");

        vm.prank(CLIENT);
        adapter.deliver(requestId);
        _assertEq(workFloor.bestSuitTier(1), 5, "randomness not delivered");
        if (!adapter.delivered(requestId)) revert("delivery not recorded");

        vm.expectRevert(ChainlinkVrfV25Adapter.RequestNotReady.selector);
        adapter.deliver(requestId);
    }

    function _createBankerDesk() internal {
        vm.prank(BANKER);
        game.mintProfile{ value: MINT_FEE }("delta_bank");
        vm.prank(BANKER);
        game.claimFaucet();
        vm.prank(BANKER);
        game.createDesk(1, "Delta Desk");
    }

    function _assertEq(uint256 actual, uint256 expected, string memory message) internal pure {
        if (actual != expected) revert(message);
    }
}
