import { hexToString, zeroAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";
import {
  bankerHookAddress,
  brokerRegistryAddress,
  brokerRouterAddress,
  brokerVaultAddress,
  contractsConfigured,
  erc6551RegistryAddress,
  gameAbi,
  gameAddress,
  profileAbi,
  profileAddress,
  brokerIdentityNftAddress,
} from "./contracts";

export type ChainMode = "demo" | "wallet" | "live";

export type ContractReadiness = {
  core: boolean;
  identity: boolean;
  registry: boolean;
  vault: boolean;
  router: boolean;
  hook: boolean;
};

export type OnchainBrokerSnapshot = {
  mode: ChainMode;
  address?: `0x${string}`;
  ownedProfileIds: bigint[];
  profileId?: bigint;
  handle?: string;
  level?: number;
  score?: number;
  floor?: number;
  rank?: number;
  officeRating?: number;
  credits?: bigint;
  desk?: {
    address: `0x${string}`;
    name: string;
    tier: number;
    lifetimeCommission: bigint;
    lifetimeVolume: bigint;
  };
  readiness: ContractReadiness;
  loading: boolean;
  error: boolean;
};

export function decodeBytes32Label(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("0x")) return undefined;
  try {
    return hexToString(value as `0x${string}`).replace(/\0/g, "").trim() || undefined;
  } catch {
    return undefined;
  }
}

export function configuredContractReadiness(): ContractReadiness {
  return {
    core: contractsConfigured && profileAddress !== zeroAddress,
    identity: brokerIdentityNftAddress !== zeroAddress && erc6551RegistryAddress !== zeroAddress,
    registry: brokerRegistryAddress !== zeroAddress,
    vault: brokerVaultAddress !== zeroAddress,
    router: brokerRouterAddress !== zeroAddress,
    hook: bankerHookAddress !== zeroAddress,
  };
}

function toNumber(value: unknown) {
  return typeof value === "bigint" || typeof value === "number" ? Number(value) : undefined;
}

export function useOnchainBroker(selectedProfileId?: bigint): OnchainBrokerSnapshot {
  const { address, isConnected } = useAccount();
  const readiness = configuredContractReadiness();
  const readsEnabled = readiness.core && Boolean(address);

  const owned = useReadContract({
    address: profileAddress,
    abi: profileAbi,
    functionName: "tokensOfOwner",
    args: [address ?? zeroAddress],
    query: { enabled: readsEnabled },
  });
  const ownedProfileIds = Array.isArray(owned.data) ? [...owned.data] : [];
  const profileId = selectedProfileId && ownedProfileIds.includes(selectedProfileId)
    ? selectedProfileId
    : ownedProfileIds[0];
  const profileEnabled = readsEnabled && typeof profileId === "bigint" && profileId > 0n;

  const handle = useReadContract({ address: profileAddress, abi: profileAbi, functionName: "handleOf", args: [profileId ?? 0n], query: { enabled: profileEnabled } });
  const level = useReadContract({ address: profileAddress, abi: profileAbi, functionName: "levelOf", args: [profileId ?? 0n], query: { enabled: profileEnabled } });
  const score = useReadContract({ address: profileAddress, abi: profileAbi, functionName: "scoreOf", args: [profileId ?? 0n], query: { enabled: profileEnabled } });
  const floor = useReadContract({ address: profileAddress, abi: profileAbi, functionName: "towerFloorOf", args: [profileId ?? 0n], query: { enabled: profileEnabled } });
  const rank = useReadContract({ address: profileAddress, abi: profileAbi, functionName: "latestTowerRankOf", args: [profileId ?? 0n], query: { enabled: profileEnabled } });
  const office = useReadContract({ address: profileAddress, abi: profileAbi, functionName: "officeRatingOf", args: [profileId ?? 0n], query: { enabled: profileEnabled } });
  const credits = useReadContract({ address: gameAddress, abi: gameAbi, functionName: "credits", args: [address ?? zeroAddress], query: { enabled: readsEnabled } });
  const desk = useReadContract({ address: gameAddress, abi: gameAbi, functionName: "getDesk", args: [profileId ?? 0n], query: { enabled: profileEnabled } });

  const deskTuple = desk.data as readonly [`0x${string}`, `0x${string}`, number, bigint, bigint, bigint, bigint] | undefined;
  const hasDesk = Boolean(deskTuple && deskTuple[0] !== zeroAddress);
  const readResults = [owned, handle, level, score, floor, rank, office, credits, desk];
  const loading = readResults.some((result) => result.isLoading);
  const error = readResults.some((result) => Boolean(result.error));

  return {
    mode: readiness.core && isConnected ? "live" : isConnected ? "wallet" : "demo",
    address,
    ownedProfileIds,
    profileId,
    handle: decodeBytes32Label(handle.data),
    level: toNumber(level.data),
    score: toNumber(score.data),
    floor: toNumber(floor.data),
    rank: toNumber(rank.data),
    officeRating: toNumber(office.data),
    credits: typeof credits.data === "bigint" ? credits.data : undefined,
    desk: hasDesk && deskTuple ? {
      address: deskTuple[0],
      name: decodeBytes32Label(deskTuple[1]) ?? "Unnamed Desk",
      tier: Number(deskTuple[2]),
      lifetimeCommission: deskTuple[5],
      lifetimeVolume: deskTuple[6],
    } : undefined,
    readiness,
    loading,
    error,
  };
}
