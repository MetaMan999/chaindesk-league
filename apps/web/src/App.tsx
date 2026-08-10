import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatEther, formatUnits, hexToString, isAddress, parseEther, stringToHex, zeroAddress } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { DisclaimerModal } from "./components/DisclaimerModal";
import { Sparkline } from "./components/Sparkline";
import { WalletButton } from "./components/WalletButton";
import {
  achievementAbi,
  achievementAddress,
  contractsConfigured,
  crewAbi,
  crewAddress,
  dealRoomAbi,
  dealRoomAddress,
  erc20ReadOnlyAbi,
  gameAbi,
  gameAddress,
  profileAbi,
  profileAddress,
  workFloorAbi,
  workFloorAddress,
} from "./lib/contracts";
import {
  calculateFeeSplit,
  clientWireForFloor,
  crewHeadquartersFloor,
  crewLeaderboard,
  crewRoleLabel,
  CREDIT,
  corporateOfferings,
  demoCrewRoster,
  executiveAccessFloor,
  executiveFloors,
  fictionalNotional,
  formatCredits,
  leaderboard,
  marketAssets,
  officeLevelCap,
  officeTracks,
  officeUpgradeCost,
  parseCreditInput,
  shortenAddress,
  towerDivisionForFloor,
  towerDivisions,
  towerFloors,
} from "./lib/game";

type Panel = "workspace" | "floor" | "tower" | "desk" | "work" | "crews" | "deals" | "league" | "protocol";
type Side = "buy" | "sell";

const mintFee = parseEther(import.meta.env.VITE_PROFILE_MINT_FEE_ETH || "0.001");
const suitNames = ["No suit yet", "Pinstripe Starter", "Power Suit", "Executive Cut", "Chairman Reserve", "Wall Street Legend"];
const suitStyles = ["Unassigned", "Midnight Navy", "Charcoal Stripe", "Merger Gray", "Bordeaux Double-Breasted", "Bull Market Blue", "Black Monday"];
const configuredNetwork = Number(import.meta.env.VITE_CHAIN_ID || 84532) === 46630
  ? "ROBINHOOD TESTNET"
  : Number(import.meta.env.VITE_CHAIN_ID || 84532) === 31337 ? "LOCAL WIRE" : "BASE SEPOLIA";

function compactTokenAmount(value: bigint, decimals: number) {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  return fraction ? `${whole}.${fraction.slice(0, 4).replace(/0+$/, "")}`.replace(/\.$/, "") : whole;
}

function imageFromTokenUri(uri?: string) {
  const prefix = "data:application/json;base64,";
  if (!uri?.startsWith(prefix)) return undefined;
  try {
    const metadata = JSON.parse(atob(uri.slice(prefix.length))) as { image?: unknown };
    return typeof metadata.image === "string" ? metadata.image : undefined;
  } catch {
    return undefined;
  }
}

export default function App() {
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [panel, setPanel] = useState<Panel>("workspace");
  const [selectedAsset, setSelectedAsset] = useState(marketAssets[0]);
  const [side, setSide] = useState<Side>("buy");
  const [shares, setShares] = useState("10");
  const [profileId, setProfileId] = useState("1");
  const [selectedFloor, setSelectedFloor] = useState(42);
  const [handle, setHandle] = useState("delta_bank");
  const [deskName, setDeskName] = useState("Delta Desk");
  const [strategyName, setStrategyName] = useState("Balanced Growth");
  const [allocation, setAllocation] = useState("1000");
  const [managedClient, setManagedClient] = useState("");
  const [maxPosition, setMaxPosition] = useState("60");
  const [maxDrawdown, setMaxDrawdown] = useState("20");
  const [rebalanceHours, setRebalanceHours] = useState("0");
  const [crewName, setCrewName] = useState("Northstar Firm");
  const [crewIdInput, setCrewIdInput] = useState("1");
  const [inviteProfileId, setInviteProfileId] = useState("2");
  const [roleProfileId, setRoleProfileId] = useState("2");
  const [crewRole, setCrewRole] = useState("2");
  const [offeringIdInput, setOfferingIdInput] = useState("1");
  const [pitchStrategy, setPitchStrategy] = useState("Disciplined Growth");
  const [workAssignment, setWorkAssignment] = useState("1");
  const [observedToken, setObservedToken] = useState("");
  const [nftRecipient, setNftRecipient] = useState("");
  const [message, setMessage] = useState("Demo data is active. Connect a testnet contract to transact.");
  const safeProfileId = /^\d+$/.test(profileId) && profileId !== "0" ? BigInt(profileId) : 0n;
  const currentUtcDay = BigInt(Math.floor(Date.now() / 86_400_000));
  const previousUtcDay = currentUtcDay > 0n ? currentUtcDay - 1n : 0n;

  const { address, isConnected } = useAccount();
  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const { data: onchainCredits, refetch: refetchCredits } = useReadContract({
    address: gameAddress,
    abi: gameAbi,
    functionName: "credits",
    args: [address ?? zeroAddress],
    query: { enabled: contractsConfigured && Boolean(address) },
  });
  const { data: onchainLoyalty, refetch: refetchLoyalty } = useReadContract({
    address: gameAddress,
    abi: gameAbi,
    functionName: "loyaltyCredits",
    args: [address ?? zeroAddress],
    query: { enabled: contractsConfigured && Boolean(address) },
  });
  const { data: onchainCurrentSeason, refetch: refetchCurrentSeason } = useReadContract({
    address: gameAddress,
    abi: gameAbi,
    functionName: "currentSeason",
    query: { enabled: contractsConfigured },
  });
  const { data: onchainProfileHandle, refetch: refetchProfileHandle } = useReadContract({
    address: profileAddress,
    abi: profileAbi,
    functionName: "handleOf",
    args: [safeProfileId],
    query: { enabled: profileAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainProfileSupply, refetch: refetchProfileSupply } = useReadContract({
    address: profileAddress,
    abi: profileAbi,
    functionName: "totalSupply",
    query: { enabled: profileAddress !== zeroAddress },
  });
  const { data: onchainOwnedProfiles, refetch: refetchOwnedProfiles } = useReadContract({
    address: profileAddress,
    abi: profileAbi,
    functionName: "tokensOfOwner",
    args: [address ?? zeroAddress],
    query: { enabled: profileAddress !== zeroAddress && Boolean(address) },
  });
  const { data: onchainProfileOwner, refetch: refetchProfileOwner } = useReadContract({
    address: profileAddress,
    abi: profileAbi,
    functionName: "ownerOf",
    args: [safeProfileId],
    query: { enabled: profileAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainTransferNonce, refetch: refetchTransferNonce } = useReadContract({
    address: profileAddress,
    abi: profileAbi,
    functionName: "transferNonce",
    args: [safeProfileId],
    query: { enabled: profileAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainTokenUri, refetch: refetchTokenUri } = useReadContract({
    address: profileAddress,
    abi: profileAbi,
    functionName: "tokenURI",
    args: [safeProfileId],
    query: { enabled: profileAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainTowerFloor, refetch: refetchTowerFloor } = useReadContract({
    address: gameAddress,
    abi: gameAbi,
    functionName: "towerFloorOf",
    args: [safeProfileId],
    query: { enabled: contractsConfigured && safeProfileId > 0n },
  });
  const { data: onchainTowerRank, refetch: refetchTowerRank } = useReadContract({
    address: gameAddress,
    abi: gameAbi,
    functionName: "latestTowerRank",
    args: [safeProfileId],
    query: { enabled: contractsConfigured && safeProfileId > 0n },
  });
  const { data: onchainOffice, refetch: refetchOffice } = useReadContract({
    address: gameAddress,
    abi: gameAbi,
    functionName: "offices",
    args: [safeProfileId],
    query: { enabled: contractsConfigured && safeProfileId > 0n },
  });
  const { data: onchainCrewId, refetch: refetchCrewId } = useReadContract({
    address: crewAddress,
    abi: crewAbi,
    functionName: "crewOfProfile",
    args: [safeProfileId],
    query: { enabled: crewAddress !== zeroAddress && safeProfileId > 0n },
  });
  const selectedCrewId = typeof onchainCrewId === "bigint" && onchainCrewId > 0n
    ? onchainCrewId
    : /^\d+$/.test(crewIdInput) ? BigInt(crewIdInput) : 1n;
  const { data: onchainCrew, refetch: refetchCrew } = useReadContract({
    address: crewAddress,
    abi: crewAbi,
    functionName: "crews",
    args: [selectedCrewId],
    query: { enabled: crewAddress !== zeroAddress && selectedCrewId > 0n },
  });
  const { data: onchainHqFloor, refetch: refetchHqFloor } = useReadContract({
    address: crewAddress,
    abi: crewAbi,
    functionName: "headquartersFloor",
    args: [selectedCrewId],
    query: { enabled: crewAddress !== zeroAddress && selectedCrewId > 0n },
  });
  const { data: onchainCrewScore, refetch: refetchCrewScore } = useReadContract({
    address: crewAddress,
    abi: crewAbi,
    functionName: "crewSeasonScore",
    args: [selectedCrewId, onchainCurrentSeason ?? 1n],
    query: { enabled: crewAddress !== zeroAddress && selectedCrewId > 0n },
  });
  const { data: onchainCrewOffice, refetch: refetchCrewOffice } = useReadContract({
    address: crewAddress,
    abi: crewAbi,
    functionName: "crewOfficeRating",
    args: [selectedCrewId],
    query: { enabled: crewAddress !== zeroAddress && selectedCrewId > 0n },
  });
  const selectedOfferingId = /^\d+$/.test(offeringIdInput) && offeringIdInput !== "0" ? BigInt(offeringIdInput) : 1n;
  const { data: onchainFirmReputation, refetch: refetchFirmReputation } = useReadContract({
    address: dealRoomAddress,
    abi: dealRoomAbi,
    functionName: "firmReputation",
    args: [selectedCrewId],
    query: { enabled: dealRoomAddress !== zeroAddress && selectedCrewId > 0n },
  });
  const { data: onchainMandatesWon, refetch: refetchMandatesWon } = useReadContract({
    address: dealRoomAddress,
    abi: dealRoomAbi,
    functionName: "mandatesWon",
    args: [selectedCrewId],
    query: { enabled: dealRoomAddress !== zeroAddress && selectedCrewId > 0n },
  });
  const { data: onchainExecutiveFloor, refetch: refetchExecutiveFloor } = useReadContract({
    address: dealRoomAddress,
    abi: dealRoomAbi,
    functionName: "executiveFloorOf",
    args: [selectedCrewId],
    query: { enabled: dealRoomAddress !== zeroAddress && selectedCrewId > 0n },
  });
  const { data: onchainOffering, refetch: refetchOffering } = useReadContract({
    address: dealRoomAddress,
    abi: dealRoomAbi,
    functionName: "offerings",
    args: [selectedOfferingId],
    query: { enabled: dealRoomAddress !== zeroAddress && selectedOfferingId > 0n },
  });
  const { data: onchainShift, refetch: refetchShift } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "shifts",
    args: [safeProfileId],
    query: { enabled: workFloorAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainWorkReputation, refetch: refetchWorkReputation } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "workReputation",
    args: [safeProfileId],
    query: { enabled: workFloorAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainCompletedShifts, refetch: refetchCompletedShifts } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "completedShifts",
    args: [safeProfileId],
    query: { enabled: workFloorAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainSuitSpins, refetch: refetchSuitSpins } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "dailySuitSpins",
    args: [safeProfileId],
    query: { enabled: workFloorAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainLastSuitDay, refetch: refetchLastSuitDay } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "lastSuitSpinDayPlusOne",
    args: [safeProfileId],
    query: { enabled: workFloorAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainBestSuit, refetch: refetchBestSuit } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "bestSuitTier",
    args: [safeProfileId],
    query: { enabled: workFloorAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainLatestSuit, refetch: refetchLatestSuit } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "latestSuitTier",
    args: [safeProfileId],
    query: { enabled: workFloorAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainLatestSuitStyle, refetch: refetchLatestSuitStyle } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "latestSuitStyle",
    args: [safeProfileId],
    query: { enabled: workFloorAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainDailyScore, refetch: refetchDailyScore } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "dailyWorkScore",
    args: [currentUtcDay, safeProfileId],
    query: { enabled: workFloorAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: onchainDailyLeader, refetch: refetchDailyLeader } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "dailyLeaderProfile",
    args: [currentUtcDay],
    query: { enabled: workFloorAddress !== zeroAddress },
  });
  const { data: onchainDailyLeaderScore, refetch: refetchDailyLeaderScore } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "dailyLeaderScore",
    args: [currentUtcDay],
    query: { enabled: workFloorAddress !== zeroAddress },
  });
  const { data: onchainDailyWins, refetch: refetchDailyWins } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "dailyWins",
    args: [safeProfileId],
    query: { enabled: workFloorAddress !== zeroAddress && safeProfileId > 0n },
  });
  const { data: previousTrophyClaimed, refetch: refetchPreviousTrophy } = useReadContract({
    address: workFloorAddress,
    abi: workFloorAbi,
    functionName: "dailyTrophyClaimed",
    args: [previousUtcDay],
    query: { enabled: workFloorAddress !== zeroAddress && previousUtcDay > 0n },
  });
  const observedTokenAddress = isAddress(observedToken) ? observedToken : zeroAddress;
  const observedTokenEnabled = isConnected && observedTokenAddress !== zeroAddress && Boolean(address);
  const { data: observedBalance } = useReadContract({
    address: observedTokenAddress,
    abi: erc20ReadOnlyAbi,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    query: { enabled: observedTokenEnabled },
  });
  const { data: observedDecimals } = useReadContract({
    address: observedTokenAddress,
    abi: erc20ReadOnlyAbi,
    functionName: "decimals",
    query: { enabled: observedTokenEnabled },
  });
  const { data: observedSymbol } = useReadContract({
    address: observedTokenAddress,
    abi: erc20ReadOnlyAbi,
    functionName: "symbol",
    query: { enabled: observedTokenEnabled },
  });

  useEffect(() => {
    if (receipt.isSuccess) {
      setMessage(`Confirmed onchain · ${hash?.slice(0, 10)}…`);
      void refetchCredits();
      void refetchLoyalty();
      void refetchCurrentSeason();
      void refetchProfileHandle();
      void refetchProfileSupply();
      void refetchOwnedProfiles();
      void refetchProfileOwner();
      void refetchTransferNonce();
      void refetchTokenUri();
      void refetchTowerFloor();
      void refetchTowerRank();
      void refetchOffice();
      void refetchCrewId();
      void refetchCrew();
      void refetchHqFloor();
      void refetchCrewScore();
      void refetchCrewOffice();
      void refetchFirmReputation();
      void refetchMandatesWon();
      void refetchExecutiveFloor();
      void refetchOffering();
      void refetchShift();
      void refetchWorkReputation();
      void refetchCompletedShifts();
      void refetchSuitSpins();
      void refetchLastSuitDay();
      void refetchBestSuit();
      void refetchLatestSuit();
      void refetchLatestSuitStyle();
      void refetchDailyScore();
      void refetchDailyLeader();
      void refetchDailyLeaderScore();
      void refetchDailyWins();
      void refetchPreviousTrophy();
    }
  }, [hash, receipt.isSuccess, refetchCredits, refetchLoyalty, refetchCurrentSeason, refetchProfileHandle, refetchProfileSupply, refetchOwnedProfiles, refetchProfileOwner, refetchTransferNonce, refetchTokenUri, refetchTowerFloor, refetchTowerRank, refetchOffice, refetchCrewId, refetchCrew, refetchHqFloor, refetchCrewScore, refetchCrewOffice, refetchFirmReputation, refetchMandatesWon, refetchExecutiveFloor, refetchOffering, refetchShift, refetchWorkReputation, refetchCompletedShifts, refetchSuitSpins, refetchLastSuitDay, refetchBestSuit, refetchLatestSuit, refetchLatestSuitStyle, refetchDailyScore, refetchDailyLeader, refetchDailyLeaderScore, refetchDailyWins, refetchPreviousTrophy]);

  const ownedProfileKey = onchainOwnedProfiles?.map((tokenId) => tokenId.toString()).join(",") ?? "";
  useEffect(() => {
    if (!address || !onchainOwnedProfiles?.length) return;
    setProfileId((current) => {
      const currentToken = /^\d+$/.test(current) ? BigInt(current) : 0n;
      return onchainOwnedProfiles.includes(currentToken) ? current : onchainOwnedProfiles[0].toString();
    });
  }, [address, ownedProfileKey]);

  useEffect(() => {
    if (error) setMessage(error.message);
  }, [error]);

  const shareAmount = parseCreditInput(shares);
  const notional = fictionalNotional(selectedAsset.price, shares);
  const feeSplit = useMemo(() => calculateFeeSplit(notional, 2), [notional]);
  const displayedCredits = typeof onchainCredits === "bigint" ? formatCredits(onchainCredits) : "100,000";
  const displayedLoyalty = typeof onchainLoyalty === "bigint" ? formatCredits(onchainLoyalty) : "420";
  const displayedProfileSupply = typeof onchainProfileSupply === "bigint" ? onchainProfileSupply : 248n;
  const remainingProfiles = 1_000n - displayedProfileSupply;
  const collectionSoldOut = displayedProfileSupply >= 1_000n;
  const bankerNftImage = useMemo(() => imageFromTokenUri(onchainTokenUri), [onchainTokenUri]);
  const displayedFloor = typeof onchainTowerFloor === "number" && onchainTowerFloor > 0 ? onchainTowerFloor : 42;
  const displayedRank = typeof onchainTowerRank === "number" && onchainTowerRank > 0 ? onchainTowerRank : 4;
  const ownsSelectedProfile = !contractsConfigured || Boolean(
    address && onchainProfileOwner && address.toLowerCase() === onchainProfileOwner.toLowerCase(),
  );
  const displayedTransferCount = typeof onchainTransferNonce === "bigint" ? onchainTransferNonce : 0n;
  const selectedDivision = towerDivisionForFloor(selectedFloor);
  const officeLevels = {
    terminal: onchainOffice?.[0] ?? 2,
    research: onchainOffice?.[1] ?? 1,
    hospitality: onchainOffice?.[2] ?? 2,
  };
  const displayedOfficeRating = onchainOffice?.[3] ?? 500;
  const officeCap = officeLevelCap(displayedFloor);
  const activeClientWire = clientWireForFloor(displayedFloor);
  const displayedCrewName = onchainCrew?.[0]
    ? hexToString(onchainCrew[0]).replace(/\0/g, "")
    : "Northstar & Co.";
  const displayedHqFloor = typeof onchainHqFloor === "number"
    ? onchainHqFloor
    : crewHeadquartersFloor(demoCrewRoster.map((member) => member.floor));
  const displayedCrewScore = typeof onchainCrewScore === "bigint" ? Number(onchainCrewScore) : 216_955;
  const displayedCrewOffice = typeof onchainCrewOffice === "bigint" ? Number(onchainCrewOffice) : 1_400;
  const displayedCrewMembers = typeof onchainCrew?.[3] === "number" ? onchainCrew[3] : demoCrewRoster.length;
  const displayedProfileHandle = onchainProfileHandle
    ? hexToString(onchainProfileHandle).replace(/\0/g, "")
    : "DeltaPilot";
  const displayedSeason = typeof onchainCurrentSeason === "bigint" ? Number(onchainCurrentSeason) : 1;
  const displayedFirmReputation = typeof onchainFirmReputation === "number" ? onchainFirmReputation : 1_000;
  const displayedMandatesWon = typeof onchainMandatesWon === "number" ? onchainMandatesWon : 3;
  const displayedExecutiveFloor = typeof onchainExecutiveFloor === "number"
    ? onchainExecutiveFloor
    : executiveAccessFloor(displayedFirmReputation, displayedHqFloor);
  const displayedWorkReputation = typeof onchainWorkReputation === "number" ? onchainWorkReputation : 2_480;
  const displayedCompletedShifts = typeof onchainCompletedShifts === "number" ? onchainCompletedShifts : 18;
  const displayedSuitSpins = typeof onchainSuitSpins === "number" ? onchainSuitSpins : 7;
  const displayedBestSuit = typeof onchainBestSuit === "number" ? onchainBestSuit : 3;
  const displayedLatestSuit = typeof onchainLatestSuit === "number" ? onchainLatestSuit : 2;
  const displayedLatestSuitStyle = typeof onchainLatestSuitStyle === "number" ? onchainLatestSuitStyle : 2;
  const displayedDailyScore = typeof onchainDailyScore === "number" ? onchainDailyScore : 640;
  const displayedDailyLeader = typeof onchainDailyLeader === "bigint" && onchainDailyLeader > 0n ? onchainDailyLeader : 7n;
  const displayedDailyLeaderScore = typeof onchainDailyLeaderScore === "number" && onchainDailyLeaderScore > 0 ? onchainDailyLeaderScore : 1_120;
  const displayedDailyWins = typeof onchainDailyWins === "number" ? onchainDailyWins : 4;
  const suitSpunToday = typeof onchainLastSuitDay === "bigint" && onchainLastSuitDay === currentUtcDay + 1n;
  const shiftStatus = onchainShift?.[4] ?? 0;
  const shiftReadyAt = Number(onchainShift?.[1] ?? 0n);
  const displayedObservedBalance = typeof observedBalance === "bigint" && typeof observedDecimals === "number"
    ? compactTokenAmount(observedBalance, observedDecimals)
    : "—";
  const workspaceClock = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  }).format(new Date());
  const workspaceTask = shiftStatus === 1
    ? `SHIFT ACTIVE · READY ${shiftReadyAt ? new Date(shiftReadyAt * 1_000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "SOON"}`
    : shiftStatus === 2 ? "VRF REVEAL PENDING" : suitSpunToday ? "DAILY SUIT CLAIMED" : "DAILY SUIT AVAILABLE";
  const demoOffering = corporateOfferings[Math.max(0, Math.min(corporateOfferings.length - 1, Number(selectedOfferingId) - 1))] ?? corporateOfferings[0];
  const displayedOffering = onchainOffering?.[0]
    ? {
        client: hexToString(onchainOffering[0]).replace(/\0/g, ""),
        ticker: hexToString(onchainOffering[1]).replace(/\0/g, ""),
        mandate: hexToString(onchainOffering[2]).replace(/\0/g, ""),
        season: Number(onchainOffering[3]),
        deadline: Number(onchainOffering[4]),
        minimumFloor: onchainOffering[5],
        minimumReputation: onchainOffering[6],
        reward: onchainOffering[7],
        allocation: onchainOffering[8],
        pitchCount: onchainOffering[9],
        winnerCrewId: onchainOffering[10],
        active: onchainOffering[12],
        finalized: onchainOffering[13],
      }
    : null;
  const activeOffering = displayedOffering ?? {
    client: demoOffering.client,
    ticker: demoOffering.ticker,
    mandate: demoOffering.mandate,
    season: displayedSeason,
    deadline: 0,
    minimumFloor: demoOffering.minimumFloor,
    minimumReputation: demoOffering.minimumReputation,
    reward: demoOffering.reward,
    allocation: BigInt(demoOffering.allocation) * CREDIT,
    pitchCount: 6,
    winnerCrewId: 0n,
    active: demoOffering.status === "PITCHING",
    finalized: false,
  };
  const firmQualifiesForOffering = displayedHqFloor >= activeOffering.minimumFloor
    && displayedFirmReputation >= activeOffering.minimumReputation;

  function guardWrite(action: () => void) {
    if (!isConnected) {
      setMessage("Connect a wallet before sending a transaction.");
      return;
    }
    if (!contractsConfigured) {
      setMessage("Demo mode: add VITE_GAME_ADDRESS after a local or testnet deployment.");
      return;
    }
    action();
  }

  function submitTrade(event: FormEvent) {
    event.preventDefault();
    if (safeProfileId === 0n || shareAmount === 0n) {
      setMessage("Enter a valid banker profile and share amount with no more than six decimals.");
      return;
    }
    guardWrite(() =>
      writeContract({
        address: gameAddress,
        abi: gameAbi,
        functionName: side,
        args: [safeProfileId, BigInt(selectedAsset.id), shareAmount],
      }),
    );
  }

  function mintProfile() {
    if (handle.length < 3) {
      setMessage("A banker handle needs at least three letters or numbers.");
      return;
    }
    guardWrite(() =>
      writeContract({
        address: gameAddress,
        abi: gameAbi,
        functionName: "mintProfile",
        args: [stringToHex(handle, { size: 32 })],
        value: mintFee,
      }),
    );
  }

  function transferProfile() {
    if (safeProfileId === 0n || !isAddress(nftRecipient)) {
      setMessage("Enter a valid banker profile and destination wallet.");
      return;
    }
    if (!address || !onchainProfileOwner || address.toLowerCase() !== onchainProfileOwner.toLowerCase()) {
      setMessage("Only the wallet that currently owns this banker NFT can transfer it.");
      return;
    }
    if (address.toLowerCase() === nftRecipient.toLowerCase()) {
      setMessage("Choose a different destination wallet.");
      return;
    }
    guardWrite(() =>
      writeContract({
        address: profileAddress,
        abi: profileAbi,
        functionName: "safeTransferFrom",
        args: [address, nftRecipient, safeProfileId],
      }),
    );
  }

  function createDesk() {
    if (safeProfileId === 0n || deskName.trim().length < 3) {
      setMessage("Enter a valid profile ID and a desk name of at least three characters.");
      return;
    }
    guardWrite(() =>
      writeContract({
        address: gameAddress,
        abi: gameAbi,
        functionName: "createDesk",
        args: [safeProfileId, stringToHex(deskName, { size: 32 })],
      }),
    );
  }

  function claimFaucet() {
    guardWrite(() =>
      writeContract({ address: gameAddress, abi: gameAbi, functionName: "claimFaucet" }),
    );
  }

  function publishMandate() {
    const positionBps = Math.round(Number(maxPosition) * 100);
    const drawdownBps = Math.round(Number(maxDrawdown) * 100);
    const cooldownSeconds = Math.round(Number(rebalanceHours) * 3600);
    if (
      safeProfileId === 0n || strategyName.trim().length < 3
        || !Number.isInteger(positionBps) || positionBps < 500 || positionBps > 10_000
        || !Number.isInteger(drawdownBps) || drawdownBps < 100 || drawdownBps > 10_000
        || !Number.isInteger(cooldownSeconds) || cooldownSeconds < 0 || cooldownSeconds > 30 * 86_400
    ) {
      setMessage("Check the mandate: position 5–100%, drawdown 1–100%, and cooldown 0–720 hours.");
      return;
    }
    guardWrite(() =>
      writeContract({
        address: gameAddress,
        abi: gameAbi,
        functionName: "setRiskMandate",
        args: [
          safeProfileId,
          stringToHex(strategyName, { size: 32 }),
          positionBps,
          drawdownBps,
          cooldownSeconds,
          3,
        ],
      }),
    );
  }

  function allocatePortfolio() {
    const amount = parseCreditInput(allocation);
    if (safeProfileId === 0n || amount === 0n) {
      setMessage("Enter a valid profile and positive play-credit allocation.");
      return;
    }
    guardWrite(() =>
      writeContract({
        address: gameAddress,
        abi: gameAbi,
        functionName: "allocateToDesk",
        args: [safeProfileId, amount],
      }),
    );
  }

  function withdrawPortfolio() {
    const amount = parseCreditInput(allocation);
    if (safeProfileId === 0n || amount === 0n) {
      setMessage("Enter the positive cash amount to withdraw from the managed paper account.");
      return;
    }
    guardWrite(() =>
      writeContract({
        address: gameAddress,
        abi: gameAbi,
        functionName: "withdrawFromDesk",
        args: [safeProfileId, amount],
      }),
    );
  }

  function claimLoyalty() {
    guardWrite(() =>
      writeContract({ address: gameAddress, abi: gameAbi, functionName: "claimLoyaltyCredits" }),
    );
  }

  function submitManagedOrder() {
    if (!isAddress(managedClient)) {
      setMessage("Enter a valid client wallet before routing a managed order.");
      return;
    }
    if (safeProfileId === 0n || shareAmount === 0n) {
      setMessage("Enter a valid profile and share amount before routing the order.");
      return;
    }
    guardWrite(() =>
      writeContract({
        address: gameAddress,
        abi: gameAbi,
        functionName: side === "buy" ? "managedBuy" : "managedSell",
        args: [managedClient, safeProfileId, BigInt(selectedAsset.id), shareAmount],
      }),
    );
  }

  function claimObserverAchievement() {
    if (!isConnected) {
      setMessage("Connect the eligible wallet before claiming an achievement.");
      return;
    }
    if (achievementAddress === zeroAddress) {
      setMessage("Achievement claiming stays disabled until an eligibility partner and program are configured.");
      return;
    }
    if (safeProfileId === 0n) {
      setMessage("Enter the banker profile that should receive the observer badge.");
      return;
    }
    writeContract({
      address: achievementAddress,
      abi: achievementAbi,
      functionName: "claim",
      args: [stringToHex("STOCK_OBSERVER", { size: 32 }), safeProfileId],
    });
  }

  function installOfficeUpgrade(track: number) {
    guardWrite(() =>
      writeContract({
        address: gameAddress,
        abi: gameAbi,
        functionName: "upgradeOffice",
        args: [safeProfileId, track],
      }),
    );
  }

  function activateTier(targetTier: number) {
    if (safeProfileId === 0n) {
      setMessage("Enter your banker profile ID before activating a tier.");
      return;
    }
    guardWrite(() =>
      writeContract({ address: gameAddress, abi: gameAbi, functionName: "activateDesk", args: [safeProfileId, targetTier] }),
    );
  }

  function claimCommissions() {
    if (safeProfileId === 0n) {
      setMessage("Enter your banker profile ID before claiming commissions.");
      return;
    }
    guardWrite(() =>
      writeContract({ address: gameAddress, abi: gameAbi, functionName: "claimCommissions", args: [safeProfileId] }),
    );
  }

  function advanceMarket() {
    guardWrite(() =>
      writeContract({ address: gameAddress, abi: gameAbi, functionName: "advanceMarket" }),
    );
  }

  function guardCrewWrite(action: () => void) {
    if (!isConnected) {
      setMessage("Connect a wallet before signing a crew transaction.");
      return;
    }
    if (crewAddress === zeroAddress) {
      setMessage("Demo mode: add VITE_CREW_ADDRESS after deploying CrewRegistry.");
      return;
    }
    action();
  }

  function createCrew() {
    if (safeProfileId === 0n || crewName.trim().length < 3) {
      setMessage("Enter a valid captain profile and unique firm name.");
      return;
    }
    guardCrewWrite(() =>
      writeContract({
        address: crewAddress,
        abi: crewAbi,
        functionName: "createCrew",
        args: [stringToHex(crewName, { size: 32 }), safeProfileId],
      }),
    );
  }

  function inviteCrewProfile() {
    const candidate = /^\d+$/.test(inviteProfileId) ? BigInt(inviteProfileId) : 0n;
    if (candidate === 0n) {
      setMessage("Enter a valid banker profile ID for the invitation.");
      return;
    }
    guardCrewWrite(() =>
      writeContract({
        address: crewAddress,
        abi: crewAbi,
        functionName: "inviteProfile",
        args: [selectedCrewId, candidate],
      }),
    );
  }

  function acceptCrewInvitation() {
    guardCrewWrite(() =>
      writeContract({
        address: crewAddress,
        abi: crewAbi,
        functionName: "acceptInvitation",
        args: [selectedCrewId, safeProfileId],
      }),
    );
  }

  function updateCrewRole() {
    const member = /^\d+$/.test(roleProfileId) ? BigInt(roleProfileId) : 0n;
    const role = Number(crewRole);
    if (member === 0n || (role !== 1 && role !== 2)) {
      setMessage("Choose a valid member profile and the Analyst or Trader role.");
      return;
    }
    guardCrewWrite(() =>
      writeContract({ address: crewAddress, abi: crewAbi, functionName: "setRole", args: [selectedCrewId, member, role] }),
    );
  }

  function leaveCrew() {
    if (safeProfileId === 0n) {
      setMessage("Enter the profile that should leave the firm.");
      return;
    }
    guardCrewWrite(() =>
      writeContract({ address: crewAddress, abi: crewAbi, functionName: "leaveCrew", args: [safeProfileId] }),
    );
  }

  function submitCorporatePitch() {
    if (safeProfileId === 0n || pitchStrategy.trim().length < 3) {
      setMessage("Enter a lead banker profile and a pitch strategy of at least three characters.");
      return;
    }
    if (!isConnected) {
      setMessage("Connect the lead banker's wallet before signing the pitch.");
      return;
    }
    if (dealRoomAddress === zeroAddress) {
      setMessage("Demo mode: add VITE_DEAL_ROOM_ADDRESS after deploying CorporateDealRoom.");
      return;
    }
    writeContract({
      address: dealRoomAddress,
      abi: dealRoomAbi,
      functionName: "submitPitch",
      args: [selectedOfferingId, safeProfileId, stringToHex(pitchStrategy, { size: 32 })],
    });
  }

  function finalizeCorporateOffering() {
    if (!isConnected) {
      setMessage("Connect a wallet to settle the completed fictional offering.");
      return;
    }
    if (dealRoomAddress === zeroAddress) {
      setMessage("Demo mode: deploy CorporateDealRoom before finalizing an offering.");
      return;
    }
    writeContract({ address: dealRoomAddress, abi: dealRoomAbi, functionName: "finalizeOffering", args: [selectedOfferingId] });
  }

  function guardWorkWrite(action: () => void) {
    if (!isConnected) {
      setMessage("Connect the banker's wallet before entering the work floor.");
      return;
    }
    if (workFloorAddress === zeroAddress) {
      setMessage("Demo mode: deploy the Work Floor with a verified randomness provider first.");
      return;
    }
    if (safeProfileId === 0n) {
      setMessage("Enter a valid banker profile ID.");
      return;
    }
    action();
  }

  function clockIn() {
    const assignment = Number(workAssignment);
    if (assignment < 1 || assignment > 4) {
      setMessage("Choose a valid desk assignment.");
      return;
    }
    guardWorkWrite(() => writeContract({
      address: workFloorAddress,
      abi: workFloorAbi,
      functionName: "clockIn",
      args: [safeProfileId, assignment],
    }));
  }

  function finishShift() {
    guardWorkWrite(() => writeContract({
      address: workFloorAddress,
      abi: workFloorAbi,
      functionName: "finishShift",
      args: [safeProfileId],
    }));
  }

  function spinDailySuit() {
    guardWorkWrite(() => writeContract({
      address: workFloorAddress,
      abi: workFloorAbi,
      functionName: "spinDailySuit",
      args: [safeProfileId],
    }));
  }

  function claimClosingBellTrophy() {
    guardWorkWrite(() => writeContract({
      address: workFloorAddress,
      abi: workFloorAbi,
      functionName: "claimDailyTrophy",
      args: [previousUtcDay],
    }));
  }

  return (
    <div className="app-shell">
      {!noticeAccepted && <DisclaimerModal onAccept={() => setNoticeAccepted(true)} />}
      <header className="topbar">
        <button className="brand" onClick={() => setPanel("workspace")} aria-label="ChainDesk League home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>ChainDesk</strong><small>LEAGUE / TESTNET</small></span>
        </button>
        <nav aria-label="Primary navigation">
          {(["workspace", "floor", "tower", "desk", "work", "crews", "deals", "league", "protocol"] as Panel[]).map((item) => (
            <button key={item} className={panel === item ? "active" : ""} onClick={() => setPanel(item)}>
              {item === "workspace" ? "My office" : item === "floor" ? "Market" : item === "tower" ? "The tower" : item === "desk" ? "My desk" : item === "work" ? "Clock in" : item === "crews" ? "Firms" : item === "deals" ? "Deal room" : item}
            </button>
          ))}
        </nav>
        <WalletButton floor={ownsSelectedProfile ? displayedFloor : undefined} rank={ownsSelectedProfile ? displayedRank : undefined} />
      </header>

      <div className="status-tape" aria-label="Simulation status">
        <span><b>WALL STREET SIM</b> fictional markets only</span>
        <span>NOVA <em className="up">+3.84%</em></span>
        <span>QUANT <em className="down">−1.24%</em></span>
        <span>HELIOS <em className="up">+6.17%</em></span>
        <span>ARCADE <em className="up">+0.72%</em></span>
        <span className="online"><i /> PRIVATE WIRE // {configuredNetwork}</span>
      </div>

      <main>
        {panel === "workspace" && (
          <section className="retro-workspace-page">
            <div className="retro-browser-chrome">
              <div className="retro-window-title">
                <span className="window-icon">CD</span>
                <b>CHAIN DESK OS 6.4 // BANKER_WORKSPACE.EXE</b>
                <div className="window-controls"><i>_</i><i>□</i><i>×</i></div>
              </div>
              <div className="retro-address-bar"><span>LOCATION:</span><code>C:\CHAIN_DESK\TOWER\FLOOR_{String(displayedFloor).padStart(3, "0")}\OFFICE</code><b>SECURE</b></div>
              <div className="workspace-scene">
                <img src={import.meta.env.BASE_URL + "assets/banker-workspace-64bit.jpg"} alt="Low-poly 64-bit-era Manhattan banker office with CRT terminals, elevator, and nighttime skyline" />
                <div className="scene-scanlines" />
                <div className="scene-vignette" />

                <button className="scene-hotspot hotspot-market" onClick={() => setPanel("floor")} aria-label="Open market terminal">
                  <i /><span><b>MARKET CRT</b><small>TRADE PAPER TAPE</small></span>
                </button>
                <button className="scene-hotspot hotspot-work" onClick={() => setPanel("work")} aria-label="Open work floor terminal">
                  <i /><span><b>WORK TERMINAL</b><small>{workspaceTask}</small></span>
                </button>
                <button className="scene-hotspot hotspot-phone" onClick={() => setPanel("deals")} aria-label="Answer deal room phone">
                  <i /><span><b>RED PHONE</b><small>{displayedMandatesWon} MANDATES WON</small></span>
                </button>
                <button className="scene-hotspot hotspot-elevator" onClick={() => setPanel("tower")} aria-label="Enter tower elevator">
                  <i /><span><b>EXEC ELEVATOR</b><small>OFFICE F{displayedFloor} · RANK #{displayedRank}</small></span>
                </button>
                <button className="scene-hotspot hotspot-board" onClick={() => setPanel("work")} aria-label="View daily closing bell leaderboard">
                  <i /><span><b>CLOSING BELL</b><small>LEADER #{displayedDailyLeader.toString()} · {displayedDailyLeaderScore.toLocaleString()} PTS</small></span>
                </button>
                <button className="scene-hotspot hotspot-desk" onClick={() => setPanel("desk")} aria-label="Open banker desk controls">
                  <i /><span><b>MY DESK</b><small>{formatCredits(onchainCredits ?? 100_000n * CREDIT)} PLAY CR</small></span>
                </button>

                <aside className="scene-rank-hud">
                  <span>PLAYER ONE</span>
                  <strong>{displayedProfileHandle}</strong>
                  <div><b>F{String(displayedFloor).padStart(2, "0")}</b><i>RANK #{String(displayedRank).padStart(2, "0")}</i></div>
                  <small>{displayedCrewName} // SEASON {String(displayedSeason).padStart(2, "0")}</small>
                </aside>
                <aside className="scene-clock"><span>NYC</span><b>{workspaceClock}</b><small>PRIVATE WIRE ONLINE</small></aside>
                <div className="scene-help">CLICK THE GLOWING OFFICE OBJECTS TO MOVE AROUND</div>
              </div>
              <div className="retro-statusbar"><span><i /> CHAIN: {configuredNetwork}</span><span>PROFILE #{profileId}</span><span>ROOM: EXECUTIVE OFFICE</span><span className="status-ready">READY</span></div>
            </div>

            <div className="workspace-command-grid">
              <article className="retro-module daily-briefing-module">
                <div className="retro-module-title"><span>DAILY_BRIEFING.TXT</span><i>?</i></div>
                <div className="briefing-body">
                  <span className="pixel-kicker">GOOD EVENING, {displayedProfileHandle.toUpperCase()}</span>
                  <h1>Build the book.<br /><em>Take the top floor.</em></h1>
                  <p>Your office is the game board. Work the terminals, answer the syndicate phone, and beat the daily tape without risking real capital.</p>
                  <div className="briefing-actions"><button onClick={() => setPanel("work")}>▶ START DAILY RUN</button><button onClick={() => setPanel("floor")}>▦ OPEN BIG BOARD</button></div>
                </div>
              </article>

              <article className="retro-module quest-module">
                <div className="retro-module-title"><span>TODAY'S QUEST</span><i>×</i></div>
                <div className="quest-body">
                  <div className="quest-icon">!</div>
                  <span><small>ACTIVE OBJECTIVE</small><b>{workspaceTask}</b><em>+ DAILY BELL POINTS</em></span>
                  <div className="pixel-progress"><i style={{ width: `${Math.min(100, Math.round(displayedDailyScore / Math.max(1, displayedDailyLeaderScore) * 100))}%` }} /></div>
                  <p>{displayedDailyScore.toLocaleString()} / {displayedDailyLeaderScore.toLocaleString()} PTS TO MATCH THE LEADER</p>
                  <button onClick={() => setPanel("work")}>GO TO WORK FLOOR →</button>
                </div>
              </article>

              <article className="retro-module inventory-module">
                <div className="retro-module-title"><span>INVENTORY.DAT</span><i>×</i></div>
                <div className="inventory-body">
                  <div className={`mini-suit suit-tier-${displayedBestSuit}`}><i /><b>SUIT</b></div>
                  <span><small>BEST WARDROBE ITEM</small><strong>{suitNames[displayedBestSuit]}</strong><b>{displayedDailyWins} DAILY TROPHIES</b></span>
                  <button onClick={() => setPanel("work")}>{suitSpunToday ? "VIEW WARDROBE" : "ROLL TODAY'S SUIT"}</button>
                </div>
              </article>
            </div>

            <div className="retro-launcher" aria-label="Workspace quick launcher">
              <button onClick={() => setPanel("workspace")} className="active"><i>■</i><span>OFFICE</span></button>
              <button onClick={() => setPanel("floor")}><i>▥</i><span>MARKET</span></button>
              <button onClick={() => setPanel("work")}><i>⌛</i><span>WORK</span></button>
              <button onClick={() => setPanel("tower")}><i>▲</i><span>TOWER</span></button>
              <button onClick={() => setPanel("deals")}><i>☎</i><span>DEALS</span></button>
              <button onClick={() => setPanel("crews")}><i>♜</i><span>FIRM</span></button>
            </div>
          </section>
        )}

        {panel === "floor" && (<>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">MANHATTAN DESK CIRCUIT // 1987 MODE</div>
            <h1>Run the room.<br /><span>Own the tape.</span></h1>
            <p>
              Pick up the line, publish your mandate, and build the most trusted simulated brokerage
              desk downtown. Client outcomes—not empty sales volume—put your name on the big board.
            </p>
            <div className="hero-actions">
              <button className="primary-action" onClick={() => setPanel("tower")}>Take the elevator</button>
              <button className="secondary-action" onClick={() => setPanel("desk")}>Claim a desk</button>
            </div>
            <div className="safety-line"><span>TESTNET</span> No real stocks · no cash value · no revenue rights</div>
          </div>
          <div className="identity-card" aria-label="Example dynamic banker NFT">
            <div className="card-glow" />
            <div className="card-top"><span>REGISTERED PAPER BROKER</span><b>FLOOR {String(displayedFloor).padStart(2, "0")}</b></div>
            <div className="avatar"><span>DP</span><i className="orbit one" /><i className="orbit two" /></div>
            <div className="card-name"><strong>{displayedProfileHandle}</strong><span>{displayedCrewName}</span></div>
            <div className={`card-suit suit-tier-${displayedBestSuit}`}><small>BEST SUIT</small><b>{suitNames[displayedBestSuit]}</b></div>
            <div className="card-stats">
              <div><small>FLOOR</small><b>{String(displayedFloor).padStart(2, "0")}</b></div>
              <div><small>TOWER RANK</small><b>#{String(displayedRank).padStart(2, "0")}</b></div>
              <div><small>XP</small><b>12,840</b></div>
            </div>
            <div className="xp-track"><i style={{ width: "72%" }} /></div>
            <div className="card-foot"><span>NFT RANK · DYNAMIC</span><span className="verified">SEASON {String(displayedSeason).padStart(2, "0")}</span></div>
          </div>
        </section>

        <section className="metric-strip">
          <article><span>LEAGUE VOLUME</span><strong>3.84M</strong><small>sim credits</small></article>
          <article><span>ACTIVE DESKS</span><strong>248</strong><small>this season</small></article>
          <article><span>YOUR FLOOR</span><strong>{String(displayedFloor).padStart(2, "0")}</strong><small>tower rank #{displayedRank}</small></article>
          <article><span>YOUR BALANCE</span><strong>{displayedCredits}</strong><small>play credits</small></article>
          <article><span>LOYALTY READY</span><strong>{displayedLoyalty}</strong><small>rebate credits</small></article>
        </section>
        </>)}

        {panel === "floor" && (
          <section className="floor-grid">
            <div className="panel market-panel">
              <div className="panel-heading">
                <div><span className="eyebrow">Consolidated paper tape</span><h2>The Big Board</h2></div>
                <button className="text-button" disabled={isPending} onClick={advanceMarket}>Ring next bell ↗</button>
              </div>
              <div className="asset-table" role="table">
                <div className="asset-row table-head" role="row">
                  <span>ASSET</span><span>PRICE</span><span>24H</span><span>SESSION</span><span />
                </div>
                {marketAssets.map((asset) => (
                  <button className={`asset-row ${asset.id === selectedAsset.id ? "selected" : ""}`} key={asset.id} onClick={() => setSelectedAsset(asset)}>
                    <span className="asset-name"><i style={{ background: asset.accent }}>{asset.symbol.slice(0, 1)}</i><b>{asset.symbol}<small>{asset.name}</small></b></span>
                    <strong>{asset.price.toFixed(2)}</strong>
                    <em className={asset.change >= 0 ? "up" : "down"}>{asset.change >= 0 ? "+" : ""}{asset.change.toFixed(2)}%</em>
                    <Sparkline points={asset.spark} positive={asset.change >= 0} />
                    <span className="chevron">›</span>
                  </button>
                ))}
              </div>
            </div>

            <form className="panel trade-ticket" onSubmit={submitTrade}>
              <div className="ticket-title"><span>DESK 04 // ORDER SLIP</span><b>PAPER</b></div>
              <div className="selected-symbol"><i style={{ background: selectedAsset.accent }}>{selectedAsset.symbol[0]}</i><div><strong>{selectedAsset.symbol}</strong><small>{selectedAsset.name}</small></div><b>{selectedAsset.price.toFixed(2)}</b></div>
              <div className="side-toggle">
                <button type="button" className={side === "buy" ? "active" : ""} onClick={() => setSide("buy")}>Buy</button>
                <button type="button" className={side === "sell" ? "active sell" : ""} onClick={() => setSide("sell")}>Sell</button>
              </div>
              <label>SHARES<input value={shares} inputMode="decimal" onChange={(event) => setShares(event.target.value)} /></label>
              <label>BANKER PROFILE<input value={profileId} inputMode="numeric" onChange={(event) => setProfileId(event.target.value)} /></label>
              <div className="receipt-lines">
                <div><span>Notional</span><b>{formatCredits(notional)} credits</b></div>
                <div><span>Commission (1%)</span><b>{formatCredits(feeSplit.fee)} credits</b></div>
                <div><span>Banker earns</span><b className="mint">{formatCredits(feeSplit.banker)} credits</b></div>
              </div>
              <button className="primary-action wide" disabled={isPending || shareAmount === 0n}>{isPending ? "Confirming…" : `${side === "buy" ? "Buy" : "Sell"} ${selectedAsset.symbol}`}</button>
              <small className="ticket-note">Paper positions are non-transferable and redeemable only for game credits.</small>
            </form>
          </section>
        )}

        {panel === "tower" && (
          <section className="tower-page">
            <div className="tower-intro">
              <div>
                <span className="eyebrow">100 floors // one reputation</span>
                <h2>ChainDesk Tower</h2>
                <p>Start in the trenches. Protect client capital, post consistent outcomes, and earn a higher office when the season closes.</p>
              </div>
              <div className="tower-position-card">
                <span>YOUR CREDENTIAL</span>
                <strong>F{String(displayedFloor).padStart(2, "0")}</strong>
                <b>RANK #{String(displayedRank).padStart(2, "0")}</b>
                <small>{towerDivisionForFloor(displayedFloor).name}</small>
              </div>
            </div>

            <div className="tower-layout">
              <div className="tower-building panel" aria-label="Interactive 100-floor skyscraper">
                <div className="tower-antenna" />
                <div className="tower-crown"><span>CHAIN DESK</span><b>100</b></div>
                <div className="tower-floors">
                  {towerFloors.map((floor) => {
                    const division = towerDivisionForFloor(floor);
                    const isCurrent = floor === displayedFloor;
                    const isSelected = floor === selectedFloor;
                    return (
                      <button
                        key={floor}
                        className={`${isCurrent ? "current" : ""} ${isSelected ? "selected" : ""} ${floor === 100 ? "champion" : ""}`}
                        onClick={() => setSelectedFloor(floor)}
                        aria-label={`Floor ${floor}: ${division.name}${isCurrent ? ", your current office" : ""}`}
                        title={`F${floor} · ${division.name}`}
                      >
                        <i />
                        <span>{floor === 1 || floor % 10 === 0 ? String(floor).padStart(2, "0") : ""}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="tower-lobby"><b>WALL ST.</b><span>LOBBY // THE TRENCHES</span></div>
              </div>

              <aside className="elevator-console panel">
                <div className="elevator-header"><span>ELEVATOR BANK A</span><i>●</i></div>
                <div className="floor-display"><small>SELECTED FLOOR</small><strong>{String(selectedFloor).padStart(3, "0")}</strong><span>{selectedDivision.name}</span></div>
                <div className="elevator-track" aria-hidden="true"><i style={{ width: `${selectedFloor}%` }} /></div>
                <div className="elevator-copy">
                  <span>{selectedDivision.label}</span>
                  <h3>{selectedFloor === 100 ? "The champion suite" : `Office access · F${String(selectedFloor).padStart(2, "0")}`}</h3>
                  <p>{selectedDivision.unlock}. Floor access reflects settled game reputation, not wallet balance.</p>
                </div>
                <div className="elevator-buttons" aria-label="Express elevator buttons">
                  {[100, 80, 60, 40, 20, 1].map((floor) => <button key={floor} className={selectedFloor === floor ? "active" : ""} onClick={() => setSelectedFloor(floor)}>{floor}</button>)}
                </div>
                <button className="primary-action wide" onClick={() => setSelectedFloor(displayedFloor)}>Return to my office · F{displayedFloor}</button>
                <div className="promotion-docket">
                  <span>NEXT SEASON ENVELOPE</span>
                  <div><b>Ordinary promotion</b><strong>+10 floors max</strong></div>
                  <div><b>Inactive desk</b><strong className="down">−3 floors</strong></div>
                  <div><b>Season rank #1</b><strong className="up">Floor 100</strong></div>
                </div>
              </aside>
            </div>

            <div className="tower-divisions">
              {towerDivisions.map((division) => (
                <button
                  key={division.name}
                  className={selectedFloor >= division.min && selectedFloor <= division.max ? "active" : ""}
                  onClick={() => setSelectedFloor(division.max)}
                >
                  <i style={{ background: division.accent }} />
                  <span><b>{division.name}</b><small>{division.min === division.max ? `F${division.min}` : `F${division.min}–${division.max}`} · {division.label}</small></span>
                  <em>↗</em>
                </button>
              ))}
            </div>

            <div className="panel tower-rules">
              <div><span className="eyebrow">Season settlement</span><h3>Your office follows your record.</h3></div>
              <p>Client outcomes, clients served, drawdown control, and managed activity produce the score. The settlement transaction writes floor, latest rank, and season to the game and dynamic banker NFT.</p>
              <code>settleTowerFloor → NFT metadata → wallet badge</code>
            </div>
          </section>
        )}

        {panel === "desk" && (
          <div className="desk-page">
            <section className="desk-layout">
              <div className="panel create-panel">
                <div className="panel-heading"><div><span className="eyebrow">Onchain identity</span><h2>Create your banker</h2></div><span className="step-badge">01</span></div>
                <p>Join the fixed 1,000-banker collection, claim free play credits, then stake credits to open a desk contract.</p>
                <div className="collection-supply">
                  <span><b>{displayedProfileSupply.toString()}</b> / 1,000 MINTED</span>
                  <i><em style={{ width: Math.min(100, Number(displayedProfileSupply) / 10) + "%" }} /></i>
                  <small>{collectionSoldOut ? "COLLECTION SOLD OUT" : remainingProfiles.toString() + " BANKER PASSPORTS REMAIN"}</small>
                </div>
                {isConnected && (
                  <div className="wallet-profile-picker">
                    <span>MY WALLET PASSPORTS</span>
                    {onchainOwnedProfiles?.length ? (
                      <div>
                        {onchainOwnedProfiles.map((tokenId) => (
                          <button
                            type="button"
                            key={tokenId.toString()}
                            className={tokenId === safeProfileId ? "active" : ""}
                            onClick={() => setProfileId(tokenId.toString())}
                          >
                            BANKER #{tokenId.toString()}
                          </button>
                        ))}
                      </div>
                    ) : <small>No banker found in this wallet yet. Mint your first passport below.</small>}
                  </div>
                )}
                <label>PUBLIC HANDLE<input maxLength={32} value={handle} onChange={(event) => setHandle(event.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))} /></label>
                <button className="primary-action wide" onClick={mintProfile} disabled={isPending || collectionSoldOut}>
                  {collectionSoldOut ? "Collection sold out" : <>Mint profile · {formatEther(mintFee)} test ETH</>}
                </button>
                <button className="secondary-action wide" onClick={claimFaucet} disabled={isPending}>Claim 100,000 play credits</button>
              </div>
              <div className="panel create-panel">
                <div className="panel-heading"><div><span className="eyebrow">Desk registry</span><h2>Open the doors</h2></div><span className="step-badge">02</span></div>
                <p>Your desk gets its own onchain address. Ownership follows the banker profile NFT.</p>
                <label>PROFILE ID<input value={profileId} inputMode="numeric" onChange={(event) => setProfileId(event.target.value)} /></label>
                <label>DESK NAME<input maxLength={32} value={deskName} onChange={(event) => setDeskName(event.target.value.replace(/[^a-zA-Z0-9 _-]/g, ""))} /></label>
                <div className="stake-callout"><span>OPENING STAKE</span><b>5,000 credits</b><small>Flows into the season reward pool</small></div>
                <button className="primary-action wide" onClick={createDesk} disabled={isPending}>Create desk contract</button>
              </div>
              <div className="panel tier-panel">
                <div className="panel-heading"><div><span className="eyebrow">Progression</span><h2>Commission tiers</h2></div></div>
                {[{t:1,n:"Associate",s:"65%",c:"5K"},{t:2,n:"Director",s:"70%",c:"12.5K"},{t:3,n:"Partner",s:"75%",c:"30K"},{t:4,n:"Chair",s:"80%",c:"65K"}].map((tier) => (
                  <div className="tier-row" key={tier.t}><i>{tier.t}</i><span><b>{tier.n}</b><small>{tier.c} credit stake</small></span><strong>{tier.s}<small>of fee</small></strong><button disabled={isPending} onClick={() => activateTier(tier.t)}>Activate</button></div>
                ))}
                <button className="secondary-action wide commission-claim" disabled={isPending} onClick={claimCommissions}>Claim desk commissions</button>
              </div>
            </section>

            <section className="panel nft-portability">
              <div className="nft-passport">
                <div className="nft-passport-art">
                  {bankerNftImage
                    ? <img src={bankerNftImage} alt={"Onchain artwork for banker profile " + profileId} />
                    : <span><b>#{profileId}</b><small>ONCHAIN ART LOADS AFTER MINT</small></span>}
                </div>
                <div className="nft-passport-copy">
                  <span className="eyebrow">Dynamic banker passport // ERC-721</span>
                  <h2>Move wallets. Keep the record.</h2>
                  <p>The handle, XP, achievements, office rating, floor, and latest rank stay attached to profile #{profileId}. A transfer emits a metadata refresh signal so compatible wallets can update the NFT card.</p>
                  <div className="passport-stats">
                    <span><small>CURRENT OWNER</small><b>{onchainProfileOwner ? shortenAddress(onchainProfileOwner) : "NOT LOADED"}</b></span>
                    <span><small>TOWER POSITION</small><b>F{String(displayedFloor).padStart(2, "0")} · #{String(displayedRank).padStart(2, "0")}</b></span>
                    <span><small>WALLET MOVES</small><b>{displayedTransferCount.toString()}</b></span>
                    <span><small>METADATA</small><b>ONCHAIN · LIVE</b></span>
                  </div>
                </div>
              </div>
              <div className="nft-transfer-console">
                <span className="feature-badge">OWNER ONLY</span>
                <label>DESTINATION WALLET<input placeholder="0x…" value={nftRecipient} onChange={(event) => setNftRecipient(event.target.value.trim())} /></label>
                <button className="primary-action wide" onClick={transferProfile} disabled={isPending || !ownsSelectedProfile}>Transfer banker NFT</button>
                <small>Safe transfer moves the complete banker identity. The receiving wallet must reactivate the desk tier before new orders can earn commissions.</small>
              </div>
            </section>

            <section className="managed-grid">
              <div className="panel managed-panel">
                <div className="panel-heading"><div><span className="eyebrow">Onchain mandate</span><h2>Publish your guardrails</h2></div><span className="feature-badge">BANKER</span></div>
                <p>Clients see the limits before allocating. Buys that breach concentration, cooldown, or drawdown controls revert.</p>
                <label>STRATEGY NAME<input maxLength={32} value={strategyName} onChange={(event) => setStrategyName(event.target.value.replace(/[^a-zA-Z0-9 _-]/g, ""))} /></label>
                <div className="input-pair">
                  <label>MAX POSITION %<input value={maxPosition} inputMode="decimal" onChange={(event) => setMaxPosition(event.target.value)} /></label>
                  <label>MAX DRAWDOWN %<input value={maxDrawdown} inputMode="decimal" onChange={(event) => setMaxDrawdown(event.target.value)} /></label>
                </div>
                <label>REBALANCE COOLDOWN · HOURS<input value={rebalanceHours} inputMode="decimal" onChange={(event) => setRebalanceHours(event.target.value)} /></label>
                <button className="primary-action wide" onClick={publishMandate} disabled={isPending}>Publish risk mandate</button>
              </div>

              <div className="panel managed-panel">
                <div className="panel-heading"><div><span className="eyebrow">Managed paper account</span><h2>Back a banker</h2></div><span className="feature-badge client">CLIENT</span></div>
                <p>Allocation stays in an isolated paper account. Only available cash can be withdrawn; positions remain fictional.</p>
                <label>PROFILE ID<input value={profileId} inputMode="numeric" onChange={(event) => setProfileId(event.target.value)} /></label>
                <label>PLAY CREDIT ALLOCATION<input value={allocation} inputMode="decimal" onChange={(event) => setAllocation(event.target.value)} /></label>
                <div className="loyalty-card"><span>LOYALTY REBATE</span><strong>{displayedLoyalty} credits</strong><small>10% of every game fee returns to the client.</small></div>
                <button className="primary-action wide" onClick={allocatePortfolio} disabled={isPending}>Allocate to strategy</button>
                <button className="secondary-action wide" onClick={withdrawPortfolio} disabled={isPending}>Withdraw available cash</button>
                <button className="secondary-action wide" onClick={claimLoyalty} disabled={isPending}>Claim loyalty credits</button>
              </div>

              <div className="panel managed-panel">
                <div className="panel-heading"><div><span className="eyebrow">Mandated execution</span><h2>Route a client order</h2></div><span className="feature-badge">BANKER</span></div>
                <p>The selected banker wallet can trade only inside the client's published mandate.</p>
                <label>CLIENT WALLET<input placeholder="0x…" value={managedClient} onChange={(event) => setManagedClient(event.target.value)} /></label>
                <div className="managed-order">
                  <span><i style={{ background: selectedAsset.accent }}>{selectedAsset.symbol[0]}</i><b>{selectedAsset.symbol}</b></span>
                  <strong>{shares} shares</strong>
                </div>
                <button className="primary-action wide" onClick={submitManagedOrder} disabled={isPending}>{side === "buy" ? "Buy" : "Sell"} inside mandate</button>
                <small className="ticket-note">Uses the selected asset and share amount from the Market Floor order ticket.</small>
              </div>
            </section>

            <section className="office-module">
              <article className="panel office-scene">
                <div className="office-scene-head">
                  <span>OFFICE {String(displayedFloor).padStart(2, "0")} // DELTA DESK</span>
                  <b>RATING {displayedOfficeRating}</b>
                </div>
                <div className="office-window" aria-label="Stylized Manhattan office view">
                  <div className="skyline"><i /><i /><i /><i /><i /><i /><i /></div>
                  <span>MANHATTAN · 19:87</span>
                </div>
                <div className="office-room">
                  <div className={`research-wall level-${officeLevels.research}`}><span>RESEARCH</span><i /><i /><i /></div>
                  <div className="office-desk-visual">
                    <div className={`monitor-bank level-${officeLevels.terminal}`}><i>NOVA</i><i>QUANT</i><i>RISK</i></div>
                    <div className="desk-surface"><span>PRIVATE WIRE</span></div>
                  </div>
                  <div className={`client-lounge level-${officeLevels.hospitality}`}><i /><i /><span>CLIENT LOUNGE</span></div>
                </div>
                <div className="office-plaque"><strong>F{displayedFloor}</strong><span>{towerDivisionForFloor(displayedFloor).name}</span><small>UPGRADES ARE COSMETIC / TOOLING ONLY</small></div>
              </article>

              <article className="panel office-upgrades">
                <div className="panel-heading"><div><span className="eyebrow">Onchain office</span><h2>Build out the room</h2></div><span className="feature-badge">CAP L{officeCap}</span></div>
                <p>Office levels unlock floor-specific presentation and tools. They never increase outcome score.</p>
                {officeTracks.map((track) => {
                  const level = officeLevels[track.key];
                  const nextLevel = level + 1;
                  const locked = nextLevel > officeCap;
                  return (
                    <div className="office-track" key={track.id}>
                      <i>{track.short}</i>
                      <span><b>{track.name}</b><small>{track.benefit}</small></span>
                      <strong>L{level}<small>/ {officeCap}</small></strong>
                      <button disabled={isPending || locked || level >= 5} onClick={() => installOfficeUpgrade(track.id)}>
                        {level >= 5 ? "MAX" : locked ? `UNLOCK F${nextLevel * 20 - 19}` : `${officeUpgradeCost(nextLevel).toLocaleString()} CR`}
                      </button>
                    </div>
                  );
                })}
                <small className="office-sink-note">Upgrade credits flow into the valueless season pool. The office follows the profile NFT if ownership changes.</small>
              </article>

              <article className="panel client-wire">
                <div className="wire-status"><i /> INCOMING FLOOR WIRE</div>
                <span className="eyebrow">{towerDivisionForFloor(displayedFloor).name}</span>
                <h2>{activeClientWire.mandate}</h2>
                <div className="wire-client"><small>PROSPECT</small><strong>{activeClientWire.client}</strong></div>
                <div className="wire-terms"><span><small>PAPER CAPITAL</small><b>{activeClientWire.capital}</b></span><span><small>RISK DESK</small><b>{activeClientWire.risk}</b></span></div>
                <p>{activeClientWire.brief}</p>
                <button className="secondary-action wide" onClick={() => { setMessage(`${activeClientWire.mandate} staged. Publish a matching mandate, then receive a real client allocation.`); setStrategyName(activeClientWire.mandate); }}>Stage mandate brief</button>
                <small className="ticket-note">The wire is a game prompt. Score comes only from onchain managed-paper activity and client outcomes.</small>
              </article>
            </section>
          </div>
        )}

        {panel === "work" && (
          <section className="work-floor-page">
            <div className="work-floor-hero panel">
              <div>
                <span className="eyebrow">Time clock // asset-building shift</span>
                <h2>Punch in. Build the book.</h2>
                <p>Choose a desk assignment, work an eight-hour onchain shift, then let verifiable randomness determine the quality and rarity of the non-transferable asset you built.</p>
                <div className="work-metrics">
                  <span><small>SHIFTS CLOSED</small><b>{displayedCompletedShifts}</b></span>
                  <span><small>WORK REPUTATION</small><b>{displayedWorkReputation.toLocaleString()}</b></span>
                  <span><small>CURRENT FLOOR</small><b>F{displayedFloor}</b></span>
                  <span><small>SUITS CUT</small><b>{displayedSuitSpins}</b></span>
                </div>
              </div>
              <div className="punch-clock" aria-label="Stylized banker time clock">
                <span>CHAIN DESK<br />TIME OFFICE</span>
                <strong>{shiftStatus === 1 ? "ON SHIFT" : shiftStatus === 2 ? "AWAIT VRF" : "OFF CLOCK"}</strong>
                <i>{shiftReadyAt ? new Date(shiftReadyAt * 1_000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "08:00"}</i>
                <b>EMP. #{profileId.padStart(4, "0")}</b>
              </div>
            </div>

            <div className="panel closing-bell-board">
              <div className="closing-bell-title"><span className="eyebrow">Daily competition // resets 00:00 UTC</span><h2>The Closing Bell</h2><p>Every completed shift adds quality × rarity points. Today's suit adds 50 points per tier. Highest total at the bell owns the daily trophy.</p></div>
              <div className="daily-leader-card"><small>LIVE LEADER</small><strong>PROFILE #{displayedDailyLeader.toString()}</strong><b>{displayedDailyLeaderScore.toLocaleString()} PTS</b><i>● LIVE</i></div>
              <div className="daily-player-card"><small>YOUR RUN · PROFILE #{profileId}</small><strong>{displayedDailyScore.toLocaleString()} PTS</strong><b>{Math.max(0, displayedDailyLeaderScore - displayedDailyScore).toLocaleString()} TO TAKE THE TAPE</b><span>{displayedDailyWins} CAREER WINS</span></div>
              <button className="secondary-action" disabled={isPending || previousTrophyClaimed === true} onClick={claimClosingBellTrophy}>{previousTrophyClaimed === true ? "Yesterday settled" : "Settle yesterday's trophy"}</button>
            </div>

            <div className="work-floor-grid">
              <article className="panel shift-console">
                <div className="panel-heading"><div><span className="eyebrow">Bullpen assignment</span><h2>The trenches</h2></div><span className="feature-badge">3 / DAY MAX</span></div>
                <p>One active shift at a time. Your assignment locks at punch-in and cannot be changed before the reveal.</p>
                <label>BANKER PROFILE<input value={profileId} inputMode="numeric" onChange={(event) => setProfileId(event.target.value.replace(/\D/g, ""))} /></label>
                <label>DESK ASSIGNMENT<select value={workAssignment} onChange={(event) => setWorkAssignment(event.target.value)}><option value="1">Research Dossier</option><option value="2">Client Rolodex</option><option value="3">Terminal Module</option><option value="4">Deal Blueprint</option></select></label>
                <div className="shift-status-card">
                  <span><small>STATUS</small><b>{shiftStatus === 1 ? "WORKING" : shiftStatus === 2 ? "RANDOMNESS PENDING" : shiftStatus === 3 ? "SHIFT COMPLETE" : "READY"}</b></span>
                  <span><small>LAST QUALITY</small><b>{onchainShift?.[5] ? `${onchainShift[5]}/100` : "—"}</b></span>
                  <span><small>LAST RARITY</small><b>{["—", "STANDARD", "UNCOMMON", "RARE", "LEGENDARY"][onchainShift?.[6] ?? 0]}</b></span>
                </div>
                <button className="primary-action wide" disabled={isPending || shiftStatus === 1 || shiftStatus === 2} onClick={clockIn}>Clock in for eight hours</button>
                <button className="secondary-action wide" disabled={isPending || shiftStatus !== 1 || Date.now() / 1_000 < shiftReadyAt} onClick={finishShift}>Finish shift · request VRF</button>
                <small className="ticket-note">Work reputation and assets are progression collectibles. They do not alter outcome score or client P&amp;L.</small>
              </article>

              <article className={`panel wardrobe-card suit-tier-${displayedLatestSuit}`}>
                <div className="wardrobe-light"><i /><i /><i /></div>
                <span className="eyebrow">One random cut per UTC day</span>
                <h2>The Daily Suit</h2>
                <div className="suit-silhouette"><i className="lapel left" /><i className="lapel right" /><span>CD</span></div>
                <div className="suit-result"><small>LATEST CUT</small><strong>{suitNames[displayedLatestSuit]}</strong><b>{suitStyles[displayedLatestSuitStyle]}</b></div>
                <div className="best-suit"><span>PERSONAL BEST</span><b>{suitNames[displayedBestSuit]}</b><em>TIER {displayedBestSuit}/5</em></div>
                <button className="primary-action wide suit-spin" disabled={isPending || suitSpunToday} onClick={spinDailySuit}>{suitSpunToday ? "Today's suit is cut" : "Spin today's suit"}</button>
                <div className="suit-odds"><span>STARTER 55%</span><span>POWER 25%</span><span>EXEC 13%</span><span>CHAIR 6%</span><span>LEGEND 1%</span></div>
                <small className="ticket-note">Cosmetic wardrobe only. Every request is locked before VRF; there is no cancel or reroll.</small>
              </article>

              <aside className="panel collector-cabinet">
                <div className="cabinet-header"><span>WALLET DISPLAY CASE</span><b>READ ONLY</b></div>
                <span className="eyebrow">External stock-token view</span>
                <h2>Collector cabinet</h2>
                <p>Paste an ERC-20 token address from the connected test network to view what this wallet holds. ChainDesk requests no approval and cannot move it.</p>
                <label>TOKEN CONTRACT<input placeholder="0x…" value={observedToken} onChange={(event) => setObservedToken(event.target.value.trim())} /></label>
                <div className="token-balance-display"><small>CONNECTED WALLET BALANCE</small><strong>{displayedObservedBalance}</strong><b>{typeof observedSymbol === "string" ? observedSymbol : "TOKEN"}</b></div>
                <div className="cabinet-rules"><span>✓ No approvals</span><span>✓ No transfers</span><span>✓ No custody</span><span>✓ No floor advantage</span></div>
                <small className="ticket-note">A read-only achievement can recognize an allowlisted balance after eligibility. It never creates rights in an underlying company.</small>
              </aside>
            </div>

            <div className="panel work-boundary">
              <code>CLOCK IN → LOCK ASSIGNMENT → REQUEST VRF → BUILD DESK ASSET</code>
              <p>Floor promotion still comes from seasonal client outcomes. Suits and wallet collectibles show identity and dedication without turning wealth into rank.</p>
            </div>
          </section>
        )}

        {panel === "crews" && (
          <section className="crews-page">
            <div className="crew-hero panel">
              <div className="crew-hero-copy">
                <span className="eyebrow">Firm registry // Crew #{selectedCrewId.toString()}</span>
                <h2>{displayedCrewName}</h2>
                <p>Bankers keep individual desks and outcomes, but share a firm identity, headquarters floor, analyst roster, and aggregate seasonal score.</p>
                <div className="crew-seal"><i>N</i><span><b>NORTHSTAR</b><small>MEMBER-OWNED PAPER FIRM</small></span></div>
              </div>
              <div className="crew-hq-building" aria-label={`Crew headquarters on floor ${displayedHqFloor}`}>
                <div className="hq-crown">FIRM HQ</div>
                {Array.from({ length: 14 }, (_, index) => <i className={index === 13 - Math.min(13, Math.floor(displayedHqFloor / 8)) ? "lit" : ""} key={index} />)}
                <strong>F{String(displayedHqFloor).padStart(2, "0")}</strong>
              </div>
              <div className="crew-metrics">
                <span><small>HQ FLOOR</small><b>{displayedHqFloor}</b></span>
                <span><small>ROSTER</small><b>{displayedCrewMembers}/12</b></span>
                <span><small>SEASON SCORE</small><b>{displayedCrewScore.toLocaleString()}</b></span>
                <span><small>OFFICE RATING</small><b>{displayedCrewOffice.toLocaleString()}</b></span>
              </div>
            </div>

            <div className="crew-workspace">
              <article className="panel firm-boardroom">
                <div className="boardroom-header"><span>PRIVATE BOARDROOM // F{displayedHqFloor}</span><b>WIRE OPEN</b></div>
                <div className="boardroom-window"><div className="boardroom-skyline"><i /><i /><i /><i /><i /></div></div>
                <div className="boardroom-table"><i /><i /><i /><i /><i /><i /><span>NORTHSTAR & CO.</span></div>
                <div className="boardroom-screens"><span>FIRM P&amp;L</span><span>RISK BOOK</span><span>CLIENT WIRE</span></div>
              </article>

              <article className="panel crew-roster">
                <div className="panel-heading"><div><span className="eyebrow">Firm directory</span><h2>The roster</h2></div><span className="feature-badge">{displayedCrewMembers} ACTIVE</span></div>
                <div className="roster-head"><span>BANKER</span><span>ROLE</span><span>FLOOR</span><span>OUTCOME</span></div>
                {demoCrewRoster.map((member) => (
                  <div className="roster-row" key={member.profileId}>
                    <span><i>{member.handle[0]}</i><b>{member.handle}<small>PROFILE #{member.profileId}</small></b></span>
                    <em className={`role-${member.role}`}>{crewRoleLabel(member.role)}</em>
                    <strong>F{member.floor}</strong>
                    <b>{member.outcome.toLocaleString()}</b>
                  </div>
                ))}
                <p>Firm score uses eligible member outcomes for Season {String(displayedSeason).padStart(2, "0")}. Office spending and roster size add no points.</p>
              </article>

              <aside className="panel crew-registry-card">
                <div className="registry-stamp">ONCHAIN REGISTRY</div>
                <span className="eyebrow">Open a firm</span>
                <h2>Hang your shingle.</h2>
                <p>Captains must own an active banker desk on Floor 21 or higher. A crew can hold up to twelve profiles.</p>
                <label>FIRM NAME<input maxLength={32} value={crewName} onChange={(event) => setCrewName(event.target.value.replace(/[^a-zA-Z0-9 _-]/g, ""))} /></label>
                <label>CAPTAIN PROFILE<input value={profileId} inputMode="numeric" onChange={(event) => setProfileId(event.target.value)} /></label>
                <button className="primary-action wide" disabled={isPending || displayedFloor < 21} onClick={createCrew}>{displayedFloor < 21 ? "Reach Floor 21" : "Register crew"}</button>
                <div className="registry-divider"><span>CAPTAIN WIRE</span></div>
                <div className="input-pair"><label>CREW ID<input value={crewIdInput} inputMode="numeric" onChange={(event) => setCrewIdInput(event.target.value)} /></label><label>PROFILE TO INVITE<input value={inviteProfileId} inputMode="numeric" onChange={(event) => setInviteProfileId(event.target.value)} /></label></div>
                <button className="secondary-action wide" disabled={isPending} onClick={inviteCrewProfile}>Send profile invitation</button>
                <button className="text-button wide" disabled={isPending} onClick={acceptCrewInvitation}>Accept invitation for profile #{profileId}</button>
                <div className="registry-divider"><span>ROSTER CONTROL</span></div>
                <div className="input-pair"><label>MEMBER PROFILE<input value={roleProfileId} inputMode="numeric" onChange={(event) => setRoleProfileId(event.target.value)} /></label><label>ROLE<select value={crewRole} onChange={(event) => setCrewRole(event.target.value)}><option value="2">Trader</option><option value="1">Analyst</option></select></label></div>
                <button className="secondary-action wide" disabled={isPending} onClick={updateCrewRole}>Update member role</button>
                <button className="text-button wide danger-action" disabled={isPending} onClick={leaveCrew}>Leave firm with profile #{profileId}</button>
              </aside>
            </div>

            <article className="panel firm-league">
              <div className="panel-heading"><div><span className="eyebrow">Season {String(displayedSeason).padStart(2, "0")} // Inter-firm circuit</span><h2>The partnership table</h2></div><span className="live-pill"><i /> LIVE</span></div>
              <div className="firm-league-head"><span>RANK / FIRM</span><span>HQ</span><span>ROSTER</span><span>OFFICE</span><span>OUTCOME SCORE</span></div>
              {crewLeaderboard.map((firm) => <div className="firm-league-row" key={firm.rank}><span><b>{String(firm.rank).padStart(2,"0")}</b><i>{firm.ticker}</i><strong>{firm.name}</strong></span><span>F{firm.hqFloor}</span><span>{firm.members}/12</span><span>{firm.office.toLocaleString()}</span><strong>{firm.score.toLocaleString()}</strong></div>)}
              <p className="data-note">HQ floor is the average settled floor of the current roster. Firm standings can be indexed directly from CrewRegistry and BrokerGame.</p>
            </article>
          </section>
        )}

        {panel === "deals" && (
          <section className="deal-room-page">
            <div className="deal-room-hero panel">
              <div className="deal-room-copy">
                <span className="eyebrow">Corporate wire // fictional mandates only</span>
                <h2>The Deal Room</h2>
                <p>Compete for corporate paper accounts, present a risk-first pitch, and win a non-transferable allocation. Completed client outcomes decide the mandate—not wallet size.</p>
                <div className="firm-reputation-strip">
                  <span><small>FIRM</small><b>{displayedCrewName}</b></span>
                  <span><small>REPUTATION</small><b>{displayedFirmReputation.toLocaleString()}</b></span>
                  <span><small>MANDATES WON</small><b>{displayedMandatesWon}</b></span>
                  <span><small>PRIVATE ACCESS</small><b>{displayedExecutiveFloor ? `F${displayedExecutiveFloor}` : "LOCKED"}</b></span>
                </div>
              </div>
              <div className="red-phone" aria-label="Incoming fictional corporate client wire"><div className="phone-handset"><i /><i /></div><div className="phone-dial">ATLS</div><span>INCOMING<br />SYNDICATE WIRE</span></div>
            </div>

            <div className="deal-room-grid">
              <article className="panel pitch-book">
                <div className="pitch-book-band"><span>CONFIDENTIAL // PAPER OFFERING</span><b>#{selectedOfferingId.toString().padStart(3, "0")}</b></div>
                <div className="offering-identity"><i>{activeOffering.ticker}</i><span><small>FICTIONAL ISSUER</small><h2>{activeOffering.client}</h2><b>{activeOffering.mandate}</b></span></div>
                <div className="offering-terms">
                  <span><small>PAPER ALLOCATION</small><b>{formatCredits(activeOffering.allocation)} CR</b></span>
                  <span><small>REPUTATION PRIZE</small><b>+{activeOffering.reward.toLocaleString()}</b></span>
                  <span><small>MINIMUM HQ</small><b>F{activeOffering.minimumFloor}</b></span>
                  <span><small>MINIMUM REP</small><b>{activeOffering.minimumReputation.toLocaleString()}</b></span>
                </div>
                <p>The submitted roster is frozen into this pitch. After Season {String(activeOffering.season).padStart(2, "0")} closes, the contract totals that roster's client-outcome score and adds modest pre-pitch HQ and reputation bonuses.</p>
                <div className={`qualification-stamp ${firmQualifiesForOffering ? "qualified" : "locked"}`}>
                  {firmQualifiesForOffering ? "FIRM QUALIFIED" : "FIRM BELOW MANDATE"}
                </div>
              </article>

              <aside className="panel pitch-console">
                <div className="console-lights"><i /><i /><i /><span>SYNDICATE DESK ONLINE</span></div>
                <span className="eyebrow">Submit the book</span>
                <h2>Pitch for the account.</h2>
                <p>The lead banker signs for the firm. One pitch per firm, maximum sixteen competing firms.</p>
                <label>OFFERING ID<input value={offeringIdInput} inputMode="numeric" onChange={(event) => setOfferingIdInput(event.target.value.replace(/\D/g, ""))} /></label>
                <label>LEAD BANKER PROFILE<input value={profileId} inputMode="numeric" onChange={(event) => setProfileId(event.target.value.replace(/\D/g, ""))} /></label>
                <label>PITCH STRATEGY<input maxLength={32} value={pitchStrategy} onChange={(event) => setPitchStrategy(event.target.value.replace(/[^a-zA-Z0-9 _-]/g, ""))} /></label>
                <div className="pitch-checks"><span className={displayedHqFloor >= activeOffering.minimumFloor ? "pass" : "fail"}>HQ F{displayedHqFloor} / F{activeOffering.minimumFloor}</span><span className={displayedFirmReputation >= activeOffering.minimumReputation ? "pass" : "fail"}>REP {displayedFirmReputation.toLocaleString()} / {activeOffering.minimumReputation.toLocaleString()}</span></div>
                <button className="primary-action wide" disabled={isPending || !firmQualifiesForOffering || !activeOffering.active} onClick={submitCorporatePitch}>{!activeOffering.active ? "Pitching closed" : firmQualifiesForOffering ? "Sign and submit pitch" : "Firm not qualified"}</button>
                <button className="secondary-action wide settle-offering" disabled={isPending || activeOffering.finalized} onClick={finalizeCorporateOffering}>Settle after season close</button>
                <small className="ticket-note">No capital, security, or token is issued. The allocation is a non-transferable game record.</small>
              </aside>
            </div>

            <article className="panel offering-board">
              <div className="panel-heading"><div><span className="eyebrow">Syndicate pipeline</span><h2>Corporate accounts on the wire</h2></div><span className="live-pill"><i /> {activeOffering.pitchCount} PITCHES</span></div>
              <div className="offering-board-head"><span>ISSUER / MANDATE</span><span>ALLOCATION</span><span>MIN HQ</span><span>MIN REP</span><span>WINDOW</span></div>
              {corporateOfferings.map((offering) => (
                <button className={`offering-board-row ${Number(selectedOfferingId) === offering.id ? "selected" : ""}`} key={offering.id} onClick={() => setOfferingIdInput(String(offering.id))}>
                  <span><i>{offering.ticker}</i><b>{offering.client}<small>{offering.mandate}</small></b></span><strong>{offering.allocation.toLocaleString()} CR</strong><span>F{offering.minimumFloor}</span><span>{offering.minimumReputation.toLocaleString()}</span><em>{offering.status}</em>
                </button>
              ))}
            </article>

            <div className="executive-access panel">
              <div><span className="eyebrow">Private elevator key</span><h2>Reputation opens the executive floors.</h2><p>Both firm reputation and headquarters quality are required. Paper allocations and reputation cannot be transferred or bought.</p></div>
              <div className="executive-floor-track">
                {executiveFloors.map((requirement) => {
                  const unlocked = displayedExecutiveFloor >= requirement.floor;
                  return <article className={unlocked ? "unlocked" : ""} key={requirement.floor}><strong>F{requirement.floor}</strong><span><b>{requirement.name}</b><small>{requirement.reputation.toLocaleString()} REP · HQ F{requirement.headquartersFloor}</small></span><i>{unlocked ? "OPEN" : "LOCKED"}</i></article>;
                })}
              </div>
            </div>
          </section>
        )}

        {panel === "league" && (
          <section className="panel leaderboard-panel">
            <div className="panel-heading"><div><span className="eyebrow">Season {String(displayedSeason).padStart(2, "0")} · outcome circuit</span><h2>Outcome league</h2></div><span className="live-pill"><i /> LIVE</span></div>
            <div className="score-method">
              <span><b>01</b> positive client outcome</span>
              <span><b>02</b> clients served</span>
              <span><b>03</b> drawdown control</span>
              <span><b>04</b> managed activity</span>
            </div>
            <div className="leaderboard-head"><span>RANK / BANKER</span><span>DESK</span><span>FLOOR / LEVEL</span><span>CLIENT CAPITAL</span><span>OUTCOME SCORE</span></div>
            {leaderboard.map((entry) => (
              <div className="leaderboard-row" key={entry.rank}>
                <span><b className={entry.rank <= 3 ? "medal" : ""}>{String(entry.rank).padStart(2,"0")}</b><i>{entry.handle[0]}</i><strong>{entry.handle}</strong></span>
                <span>{entry.desk}</span><span>F{entry.floor} · L{entry.level}</span><span>{entry.volume.toLocaleString()}</span><strong>{entry.score.toLocaleString()}</strong>
              </div>
            ))}
            <p className="data-note">Season rank and office floor are written into the dynamic NFT and connected-wallet badge. Demo standings are replaced by indexed onchain settlement events.</p>
          </section>
        )}

        {panel === "protocol" && (
          <section className="protocol-layout">
            <div className="protocol-copy"><span className="eyebrow">The loop</span><h2>From rookie to market legend.</h2><p>Every action is legible onchain, but the economy stays inside a fictional simulation.</p></div>
            <div className="loop-grid">
              {[{n:"01",t:"Publish a mandate",p:"Bankers commit concentration, cooldown, drawdown, and risk limits onchain."},{n:"02",t:"Win client trust",p:"Clients allocate valueless credits into isolated managed paper accounts."},{n:"03",t:"Deliver outcomes",p:"Risk-aware results, retention, and stewardship drive seasonal score."},{n:"04",t:"Clock in daily",p:"Locked shifts and one VRF suit draw compete for the activity-only Closing Bell trophy."},{n:"05",t:"Win corporate wires",p:"Firms pitch for fictional mandates and unlock executive access through reputation."},{n:"06",t:"Evolve identity",p:"Medals, achievements, XP, floor, rank, wardrobe, and trophies shape the banker identity."}].map((item) => <article key={item.n}><span>{item.n}</span><h3>{item.t}</h3><p>{item.p}</p></article>)}
            </div>
            <div className="hook-callout"><div><span className="eyebrow">Optional adapter</span><h3>Uniswap v4 hook-shaped integration</h3><p>An allowlisted afterSwap adapter can record fictional-pool volume without minting game credits or touching real-asset pools.</p></div><code>afterSwap → recordHookVolume → profile XP</code></div>
            <div className="integration-grid">
              <article className="panel integration-card">
                <span className="integration-status ready">READ ONLY</span>
                <div className="eyebrow">Stock-token achievement</div>
                <h3>Prove, never custody.</h3>
                <p>An allowlisted program reads an eligible wallet's balance once. It cannot transfer, wrap, trade, or approve the observed token.</p>
                <label>PROFILE ID<input value={profileId} inputMode="numeric" onChange={(event) => setProfileId(event.target.value)} /></label>
                <button className="secondary-action wide" onClick={claimObserverAchievement}>Claim observer badge</button>
              </article>
              <article className="panel integration-card locked">
                <span className="integration-status">DISABLED</span>
                <div className="eyebrow">Qualified execution partner</div>
                <h3>No provider connected.</h3>
                <p>The repository includes only a typed partner boundary. Real orders stay impossible until a licensed provider supplies eligibility, custody, execution, settlement, disclosures, and reporting.</p>
                <button className="secondary-action wide" disabled>Regulated execution unavailable</button>
              </article>
            </div>
          </section>
        )}

        <div className={`transaction-toast ${receipt.isSuccess ? "success" : ""}`} role="status"><span>{receipt.isLoading ? "◌" : receipt.isSuccess ? "✓" : "i"}</span>{message}</div>
      </main>

      <footer><div className="brand mini"><span className="brand-mark"><i /><i /><i /></span><span><strong>ChainDesk</strong><small>LEAGUE</small></span></div><p>Experimental testnet software. Not a broker, exchange, investment product, or security.</p><span>PRIVATE WIRE 04 · SIMULATION ONLINE</span></footer>
    </div>
  );
}
