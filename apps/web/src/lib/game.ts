export const CREDIT = 1_000_000n;

export type MarketAsset = {
  id: number;
  symbol: string;
  name: string;
  price: number;
  change: number;
  spark: number[];
  accent: string;
};

export type TowerDivision = {
  min: number;
  max: number;
  name: string;
  label: string;
  unlock: string;
  accent: string;
};

export type ClientWire = {
  minFloor: number;
  maxFloor: number;
  client: string;
  mandate: string;
  capital: string;
  risk: string;
  brief: string;
};

export const towerDivisions: TowerDivision[] = [
  { min: 100, max: 100, name: "The Penthouse", label: "Season champion", unlock: "Tower-wide spotlight and champion suite", accent: "#ffc24b" },
  { min: 81, max: 99, name: "Chairman's Circle", label: "Elite desks", unlock: "Scarce mandates and chairman cosmetics", accent: "#ff4b3e" },
  { min: 61, max: 80, name: "Executive Floors", label: "Senior leadership", unlock: "Crew offices and analyst terminals", accent: "#f09b3e" },
  { min: 41, max: 60, name: "Institutional Desk", label: "Risk specialists", unlock: "Advanced mandates and risk tooling", accent: "#62ff85" },
  { min: 21, max: 40, name: "Brokerage Floor", label: "Established bankers", unlock: "Managed portfolios and loyalty programs", accent: "#55c878" },
  { min: 2, max: 20, name: "The Boiler Room", label: "Rising desks", unlock: "Daily circuits and office upgrades", accent: "#d2a145" },
  { min: 1, max: 1, name: "The Trenches", label: "New desks", unlock: "Training mandates and first clients", accent: "#9b8d69" },
];

export const towerFloors = Array.from({ length: 100 }, (_, index) => 100 - index);

export const clientWires: ClientWire[] = [
  { minFloor: 1, maxFloor: 1, client: "Corner Deli Pension", mandate: "First Book", capital: "750 credits", risk: "LOW", brief: "Build a three-name paper portfolio and finish the week inside a 10% drawdown." },
  { minFloor: 2, maxFloor: 20, client: "Canal Street Imports", mandate: "Quick Turn", capital: "2,500 credits", risk: "MED", brief: "Complete four fictional trades while respecting a 35% concentration ceiling." },
  { minFloor: 21, maxFloor: 40, client: "Hudson Family Office", mandate: "Capital Defense", capital: "10,000 credits", risk: "MED", brief: "Protect a balanced mandate through two market advances and retain the client." },
  { minFloor: 41, maxFloor: 60, client: "Empire Municipal Fund", mandate: "Five Borough Book", capital: "25,000 credits", risk: "CONTROLLED", brief: "Manage all four paper assets with a published 20% drawdown limit." },
  { minFloor: 61, maxFloor: 80, client: "Atlantic Employee Trust", mandate: "Stewardship Run", capital: "50,000 credits", risk: "STRICT", brief: "Deliver a positive marked outcome with zero mandate violations." },
  { minFloor: 81, maxFloor: 99, client: "Chairman's Syndicate", mandate: "Red Phone", capital: "100,000 credits", risk: "ELITE", brief: "Lead a crew mandate while retaining every fictional client for the season." },
  { minFloor: 100, maxFloor: 100, client: "The Tower Board", mandate: "Bellwether", capital: "Champion book", risk: "PUBLIC", brief: "Defend Floor 100 with the tower's best client-outcome score." },
];

export const officeTracks = [
  { id: 1, key: "terminal", name: "Terminal Bank", short: "T", benefit: "Adds denser market and mandate tooling to the office view." },
  { id: 2, key: "research", name: "Research Library", short: "R", benefit: "Unlocks deeper fictional-company dossiers and risk notes." },
  { id: 3, key: "hospitality", name: "Client Lounge", short: "C", benefit: "Adds client-history, loyalty, and retention displays." },
] as const;

export function towerDivisionForFloor(floor: number) {
  const safeFloor = Math.max(1, Math.min(100, Math.trunc(floor)));
  return towerDivisions.find((division) => safeFloor >= division.min && safeFloor <= division.max) ?? towerDivisions[towerDivisions.length - 1];
}

export function clientWireForFloor(floor: number) {
  const safeFloor = Math.max(1, Math.min(100, Math.trunc(floor)));
  return clientWires.find((wire) => safeFloor >= wire.minFloor && safeFloor <= wire.maxFloor) ?? clientWires[0];
}

export function officeLevelCap(floor: number) {
  const safeFloor = Math.max(1, Math.min(100, Math.trunc(floor)));
  return 1 + Math.floor((safeFloor - 1) / 20);
}

export function officeUpgradeCost(targetLevel: number) {
  return [0, 2_000, 5_000, 10_000, 20_000, 40_000][Math.max(0, Math.min(5, Math.trunc(targetLevel)))] ?? 0;
}

export function previewTowerMove(currentFloor: number, score: number, rank: number, active = true) {
  const current = Math.max(1, Math.min(100, Math.trunc(currentFloor)));
  if (!active) return Math.max(1, current - 3);
  if (rank === 1 && score >= 1_000) return 100;
  if (current === 100) return 99;
  let desired = 1 + Math.floor(Math.max(0, score) / 500);
  if (rank <= 10) desired += 8;
  else if (rank <= 50) desired += 3;
  desired = Math.min(99, desired);
  if (desired > current) return Math.min(desired, current + 10);
  if (desired < current) return Math.max(desired, current - 5);
  return current;
}

export const marketAssets: MarketAsset[] = [
  {
    id: 1,
    symbol: "NOVA",
    name: "Nova Robotics",
    price: 42.18,
    change: 3.84,
    spark: [20, 18, 27, 24, 34, 31, 44, 52],
    accent: "#75f0c1",
  },
  {
    id: 2,
    symbol: "QUANT",
    name: "Quantum Grid",
    price: 88.62,
    change: -1.24,
    spark: [52, 59, 54, 49, 53, 45, 42, 39],
    accent: "#9da9ff",
  },
  {
    id: 3,
    symbol: "HELIOS",
    name: "Helios Transit",
    price: 27.04,
    change: 6.17,
    spark: [17, 22, 20, 31, 29, 42, 48, 57],
    accent: "#ffc86b",
  },
  {
    id: 4,
    symbol: "ARCADE",
    name: "Arcade Cloud",
    price: 64.39,
    change: 0.72,
    spark: [28, 32, 30, 36, 35, 39, 41, 43],
    accent: "#f89ac7",
  },
];

export const leaderboard = [
  { rank: 1, floor: 100, handle: "MiraOnchain", desk: "Northstar", level: 8, volume: 842_920, score: 98_420 },
  { rank: 2, floor: 91, handle: "BlockBaron", desk: "Obsidian", level: 7, volume: 728_400, score: 86_110 },
  { rank: 3, floor: 84, handle: "YieldYard", desk: "Green Room", level: 7, volume: 691_210, score: 80_774 },
  { rank: 4, floor: 42, handle: "DeltaPilot", desk: "Delta Desk", level: 5, volume: 484_080, score: 56_901 },
  { rank: 5, floor: 28, handle: "PaperAlpha", desk: "First Light", level: 4, volume: 337_600, score: 43_208 },
];

export const crewLeaderboard = [
  { rank: 1, name: "Northstar & Co.", ticker: "NST", hqFloor: 67, members: 8, score: 284_610, office: 4_800 },
  { rank: 2, name: "Obsidian Partners", ticker: "OBS", hqFloor: 61, members: 7, score: 251_440, office: 4_100 },
  { rank: 3, name: "Green Room Capital", ticker: "GRC", hqFloor: 54, members: 9, score: 226_805, office: 3_900 },
  { rank: 4, name: "Five Borough Desk", ticker: "FBD", hqFloor: 48, members: 6, score: 198_720, office: 3_100 },
];

export const demoCrewRoster = [
  { profileId: 1, handle: "DeltaPilot", role: 3, floor: 100, outcome: 98_420 },
  { profileId: 17, handle: "TapeReader", role: 2, floor: 63, outcome: 44_910 },
  { profileId: 31, handle: "RiskClerk", role: 1, floor: 52, outcome: 38_405 },
  { profileId: 44, handle: "HudsonQuant", role: 2, floor: 49, outcome: 35_220 },
];

export const corporateOfferings = [
  { id: 1, client: "Atlas Dynamics", ticker: "ATLS", mandate: "Paper IPO Growth", minimumFloor: 50, minimumReputation: 0, allocation: 25_000, reward: 1_000, status: "PITCHING", deadline: "48H" },
  { id: 2, client: "Liberty Aeroworks", ticker: "LBRT", mandate: "Expansion Syndicate", minimumFloor: 65, minimumReputation: 1_000, allocation: 60_000, reward: 1_500, status: "UP NEXT", deadline: "S03" },
  { id: 3, client: "MetroFiber Systems", ticker: "MFS", mandate: "Municipal Paper Book", minimumFloor: 80, minimumReputation: 2_500, allocation: 100_000, reward: 2_500, status: "LOCKED", deadline: "S04" },
];

export const executiveFloors = [
  { floor: 70, reputation: 250, headquartersFloor: 21, name: "Syndicate Lounge" },
  { floor: 80, reputation: 1_000, headquartersFloor: 40, name: "Executive Deal Desk" },
  { floor: 90, reputation: 2_500, headquartersFloor: 60, name: "Chairman's Dining Room" },
  { floor: 100, reputation: 5_000, headquartersFloor: 80, name: "Penthouse Boardroom" },
];

export function crewRoleLabel(role: number) {
  if (role === 3) return "Captain";
  if (role === 2) return "Trader";
  if (role === 1) return "Analyst";
  return "Unassigned";
}

export function crewHeadquartersFloor(floors: number[]) {
  if (floors.length === 0) return 0;
  const total = floors.reduce((sum, floor) => sum + Math.max(1, Math.min(100, Math.trunc(floor))), 0);
  return Math.floor(total / floors.length);
}

export function executiveAccessFloor(reputation: number, headquartersFloor: number) {
  return executiveFloors.reduce(
    (highest, requirement) => reputation >= requirement.reputation && headquartersFloor >= requirement.headquartersFloor ? requirement.floor : highest,
    0,
  );
}

export function parseCreditInput(value: string) {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{0,6})?$/.test(normalized)) return 0n;
  const [whole, fraction = ""] = normalized.split(".");
  try {
    return BigInt(whole) * CREDIT + BigInt(fraction.padEnd(6, "0"));
  } catch {
    return 0n;
  }
}

export function fictionalNotional(price: number, shares: string) {
  if (!Number.isFinite(price) || price <= 0) return 0n;
  const priceInCredits = BigInt(Math.round(price * Number(CREDIT)));
  return priceInCredits * parseCreditInput(shares) / CREDIT;
}

export function calculateFeeSplit(notionalCredits: bigint, tier: number) {
  const fee = (notionalCredits * 100n) / 10_000n;
  const safeTier = Math.max(1, Math.min(4, Math.trunc(tier)));
  const bankerBps = 6_000n + BigInt(safeTier) * 500n;
  const banker = (fee * bankerBps) / 10_000n;
  const loyalty = (fee * 1_000n) / 10_000n;
  const protocol = (fee * 1_000n) / 10_000n;
  const rewards = fee - banker - loyalty - protocol;
  return { fee, banker, loyalty, protocol, rewards };
}

export function formatCredits(value: bigint | number, maximumFractionDigits = 2) {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
  }
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const digits = Math.max(0, Math.min(6, Math.trunc(maximumFractionDigits)));
  const roundingFactor = 10n ** BigInt(6 - digits);
  const rounded = (absolute + roundingFactor / 2n) / roundingFactor;
  const fractionalBase = 10n ** BigInt(digits);
  const whole = rounded / fractionalBase;
  const wholeText = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(whole);
  if (digits === 0) return `${sign}${wholeText}`;
  const fraction = (rounded % fractionalBase).toString().padStart(digits, "0").replace(/0+$/, "");
  return `${sign}${wholeText}${fraction ? `.${fraction}` : ""}`;
}

export function shortenAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
