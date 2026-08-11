import type { MarketState } from "./rpg";

export type BrokerStanding = {
  rank: number;
  handle: string;
  desk: string;
  floor: number;
  score: number;
  status: string;
  player?: boolean;
};

export type DistrictPulse = {
  id: string;
  desk: string;
  message: string;
  tone: "fill" | "client" | "rival" | "news";
};

const residentBrokers = [
  { handle: "MiraOnchain", desk: "Northstar", floor: 100, score: 124_600 },
  { handle: "BlockBaron", desk: "Obsidian", floor: 91, score: 108_420 },
  { handle: "YieldYard", desk: "Green Room", floor: 84, score: 96_880 },
  { handle: "DeltaPilot", desk: "Delta Desk", floor: 58, score: 72_340 },
  { handle: "TapeReader", desk: "Broad Street", floor: 37, score: 51_720 },
  { handle: "RiskClerk", desk: "Hudson Risk", floor: 18, score: 29_460 },
];

const pulseTemplates = [
  { desk: "Northstar", message: "serviced a 48,000-unit WETH test order", tone: "fill" as const },
  { desk: "First Bull Bank", message: "posted a new fictional client mandate", tone: "client" as const },
  { desk: "Obsidian", message: "challenged Green Room to a spread duel", tone: "rival" as const },
  { desk: "Exchange Clerk", message: "moved the district into the next tape session", tone: "news" as const },
  { desk: "Delta Desk", message: "added liquidity to the NOVA simulation", tone: "fill" as const },
  { desk: "Bull & Bean", message: "heard a rumor about an uptown expansion", tone: "news" as const },
  { desk: "Hudson Risk", message: "retained a cautious pension client", tone: "client" as const },
  { desk: "Apex & Co.", message: "lost three reputation after quoting too wide", tone: "rival" as const },
];

export function brokerLadderScore(reputation: number, commission: number, aum: number, officeLevel: number) {
  return Math.max(0, Math.round(
    Math.max(0, reputation) * 450
      + Math.max(0, commission) * 5
      + Math.sqrt(Math.max(0, aum)) * 30
      + Math.max(1, officeLevel) * 1_250,
  ));
}

export function floorForLadderScore(score: number) {
  return Math.max(1, Math.min(100, 1 + Math.floor(Math.max(0, score) / 2_000)));
}

export function districtStandings(
  player: { handle: string; reputation: number; commission: number; aum: number; officeLevel: number },
  marketState: MarketState,
): BrokerStanding[] {
  const playerScore = brokerLadderScore(player.reputation, player.commission, player.aum, player.officeLevel);
  const status = marketState === "MARKET OPEN" ? "ON THE FLOOR" : marketState === "PRE-MARKET" ? "AT THE DESK" : "AFTER-HOURS";
  return [
    ...residentBrokers.map((broker, index) => ({ ...broker, rank: index + 1, status: index % 3 === 0 ? "WITH CLIENT" : status })),
    { handle: player.handle, desk: "Ledger & Co.", floor: floorForLadderScore(playerScore), score: playerScore, rank: 0, status: "YOU ARE HERE", player: true },
  ]
    .sort((left, right) => right.score - left.score)
    .map((broker, index) => ({ ...broker, rank: index + 1 }));
}

export function districtPulse(timestamp: number, marketState: MarketState, count = 5): DistrictPulse[] {
  const sessionOffset = marketState === "MARKET OPEN" ? 1 : marketState === "AFTER HOURS" ? 3 : 0;
  const cursor = Math.floor(timestamp / 15_000) + sessionOffset;
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const template = pulseTemplates[(cursor - index + pulseTemplates.length * 10) % pulseTemplates.length];
    return { ...template, id: `${cursor}-${index}-${template.desk}` };
  });
}
