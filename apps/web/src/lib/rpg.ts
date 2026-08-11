export type SceneId = "wall-street" | "exchange" | "bank" | "brokerage" | "coffee" | "otc" | "subway";
export type Direction = "up" | "down" | "left" | "right";
export type MarketState = "PRE-MARKET" | "MARKET OPEN" | "AFTER HOURS";
export type TileKind = "grass" | "road" | "walk" | "floor" | "carpet" | "wood" | "alley";

export type Position = { x: number; y: number };

export type WorldObject = Position & {
  id: string;
  kind: "building" | "door" | "npc" | "prop" | "portal" | "counter";
  label?: string;
  width?: number;
  height?: number;
  solid?: boolean;
  targetScene?: SceneId;
  targetPosition?: Position;
  interaction?: string;
  sprite?: "banker" | "client" | "rival" | "barista" | "guard";
  accent?: string;
};

export type Scene = {
  id: SceneId;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  defaultTile: TileKind;
  tileAt?: (x: number, y: number) => TileKind;
  objects: WorldObject[];
};

export type QuestState = "available" | "active" | "complete";
export type Quest = {
  id: string;
  title: string;
  detail: string;
  state: QuestState;
  progress: number;
  goal: number;
  reward: string;
};

export type BriefcaseItem = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  icon: string;
};

export type GameSave = {
  version: 1;
  scene: SceneId;
  position: Position;
  direction: Direction;
  reputation: number;
  commission: number;
  aum: number;
  officeLevel: number;
  inventory: BriefcaseItem[];
  quests: Quest[];
  visited: SceneId[];
  lastSavedAt: number;
};

export type NegotiationAction = "quote" | "liquidity" | "research" | "hedge";
export type NegotiationState = {
  playerConfidence: number;
  rivalResolve: number;
  insight: number;
  hedge: number;
  turn: number;
};

export type NegotiationResult = NegotiationState & {
  playerDelta: number;
  rivalDelta: number;
  line: string;
};

export const SAVE_KEY = "banker-bros-wall-street-v1";

export const initialQuests: Quest[] = [
  {
    id: "morning-coffee",
    title: "The Opening Bell",
    detail: "Pick up a double espresso from Bull & Bean, then report to the Exchange.",
    state: "active",
    progress: 0,
    goal: 2,
    reward: "+8 reputation · Market Pass",
  },
  {
    id: "first-client",
    title: "A Nervous Client",
    detail: "Speak with Ms. Ledger in the bank lobby and win her mandate.",
    state: "available",
    progress: 0,
    goal: 1,
    reward: "+$25K AUM · 120 commission",
  },
  {
    id: "rival-desk",
    title: "Spread the Word",
    detail: "Defeat Chadwick from Apex & Co. in a brokerage negotiation.",
    state: "available",
    progress: 0,
    goal: 1,
    reward: "+15 reputation · Brass Calculator",
  },
];

export const starterInventory: BriefcaseItem[] = [
  { id: "metro-card", name: "Metro Card", description: "A scuffed pass for future district fast travel.", quantity: 1, icon: "M" },
  { id: "pocket-ledger", name: "Pocket Ledger", description: "Tracks every simulated fill. Smells faintly of coffee.", quantity: 1, icon: "L" },
  { id: "test-usdc", name: "Test USD", description: "Valueless demo liquidity for fictional markets only.", quantity: 250, icon: "$" },
];

export function createNewSave(): GameSave {
  return {
    version: 1,
    scene: "wall-street",
    position: { x: 12, y: 9 },
    direction: "down",
    reputation: 12,
    commission: 350,
    aum: 25_000,
    officeLevel: 1,
    inventory: starterInventory.map((item) => ({ ...item })),
    quests: initialQuests.map((quest) => ({ ...quest })),
    visited: ["wall-street"],
    lastSavedAt: Date.now(),
  };
}

const facade = (id: string, x: number, y: number, width: number, height: number, label: string, accent: string): WorldObject => ({
  id,
  x,
  y,
  width,
  height,
  kind: "building",
  label,
  accent,
  solid: true,
});

const door = (id: string, x: number, y: number, label: string, targetScene: SceneId, targetPosition: Position): WorldObject => ({
  id,
  x,
  y,
  kind: "door",
  label,
  targetScene,
  targetPosition,
  solid: false,
});

export const scenes: Record<SceneId, Scene> = {
  "wall-street": {
    id: "wall-street",
    name: "Wall Street District",
    subtitle: "Broad & Ledger · Lower Manhattan",
    width: 24,
    height: 16,
    defaultTile: "walk",
    tileAt: (x, y) => {
      if (x >= 9 && x <= 13) return "road";
      if (y >= 6 && y <= 9) return "road";
      if ((x < 2 || x > 21) && y > 4 && y < 12) return "grass";
      if (x > 20 && y >= 5 && y <= 10) return "alley";
      return "walk";
    },
    objects: [
      facade("exchange-building", 2, 0, 6, 5, "The Exchange", "gold"),
      door("exchange-door", 5, 4, "Enter the Exchange", "exchange", { x: 8, y: 9 }),
      facade("bank-building", 15, 0, 6, 5, "First Bull Bank", "green"),
      door("bank-door", 17, 4, "Enter First Bull Bank", "bank", { x: 8, y: 9 }),
      facade("coffee-building", 1, 11, 6, 5, "Bull & Bean", "red"),
      door("coffee-door", 5, 11, "Enter Bull & Bean", "coffee", { x: 8, y: 9 }),
      facade("brokerage-building", 15, 11, 7, 5, "Your Brokerage", "blue"),
      door("brokerage-door", 17, 11, "Enter your brokerage", "brokerage", { x: 8, y: 9 }),
      { id: "subway", x: 11, y: 14, kind: "portal", label: "Broad Street Station", targetScene: "subway", targetPosition: { x: 8, y: 9 }, solid: true },
      { id: "otc-gate", x: 22, y: 7, kind: "portal", label: "OTC Alley", targetScene: "otc", targetPosition: { x: 8, y: 9 }, solid: true },
      { id: "ticker", x: 11, y: 2, kind: "prop", label: "Street ticker", interaction: "ticker", solid: true },
      { id: "newsstand", x: 8, y: 10, kind: "prop", label: "Newsstand", interaction: "newsstand", solid: true },
      { id: "npc-intern", x: 8, y: 7, kind: "npc", label: "Maya the Intern", interaction: "intern", sprite: "banker", accent: "teal", solid: true },
      { id: "npc-tourist", x: 14, y: 8, kind: "npc", label: "Lost Analyst", interaction: "analyst", sprite: "client", accent: "ochre", solid: true },
    ],
  },
  exchange: interior("exchange", "The Exchange", "Trading Floor · Market Simulation", "floor", [
    { id: "exchange-exit", x: 8, y: 10, kind: "door", label: "Exit to Wall Street", targetScene: "wall-street", targetPosition: { x: 5, y: 5 }, solid: false },
    { id: "bell", x: 8, y: 1, kind: "prop", label: "Opening Bell", interaction: "bell", solid: true },
    { id: "rival", x: 5, y: 5, kind: "npc", label: "Chadwick · Apex & Co.", interaction: "rival", sprite: "rival", accent: "red", solid: true },
    { id: "floor-broker", x: 11, y: 4, kind: "npc", label: "Floor Broker", interaction: "floor-broker", sprite: "banker", accent: "blue", solid: true },
    { id: "resident-mira", x: 3, y: 7, kind: "npc", label: "Mira · Northstar", interaction: "hub", sprite: "banker", accent: "gold", solid: true },
    { id: "resident-risk", x: 13, y: 7, kind: "npc", label: "Risk Clerk · Hudson", interaction: "hub", sprite: "banker", accent: "green", solid: true },
    { id: "ladder-board", x: 14, y: 3, kind: "prop", label: "District broker ladder", interaction: "hub", solid: true },
    { id: "exchange-terminal-a", x: 3, y: 2, width: 3, height: 1, kind: "counter", label: "NOVA / USDG tape", interaction: "terminal", solid: true },
    { id: "exchange-terminal-b", x: 10, y: 2, width: 3, height: 1, kind: "counter", label: "WETH / USDG tape", interaction: "terminal", solid: true },
  ]),
  bank: interior("bank", "First Bull Bank", "Client Services Lobby", "carpet", [
    { id: "bank-exit", x: 8, y: 10, kind: "door", label: "Exit to Wall Street", targetScene: "wall-street", targetPosition: { x: 17, y: 5 }, solid: false },
    { id: "client-ledger", x: 6, y: 4, kind: "npc", label: "Ms. Ledger", interaction: "client", sprite: "client", accent: "violet", solid: true },
    { id: "banker-guard", x: 12, y: 7, kind: "npc", label: "Lobby Manager", interaction: "manager", sprite: "guard", accent: "green", solid: true },
    { id: "vault-counter", x: 3, y: 2, width: 10, height: 1, kind: "counter", label: "BrokerVault counter", interaction: "vault", solid: true },
  ]),
  brokerage: interior("brokerage", "Ledger & Co.", "Your Very Small Brokerage", "wood", [
    { id: "brokerage-exit", x: 8, y: 10, kind: "door", label: "Exit to Wall Street", targetScene: "wall-street", targetPosition: { x: 17, y: 10 }, solid: false },
    { id: "desk", x: 6, y: 3, width: 4, height: 2, kind: "counter", label: "Your desk", interaction: "desk", solid: true },
    { id: "upgrade-board", x: 12, y: 2, kind: "prop", label: "Office upgrade board", interaction: "upgrade", solid: true },
    { id: "router-terminal", x: 3, y: 2, kind: "prop", label: "Routing terminal", interaction: "router", solid: true },
    { id: "assistant", x: 11, y: 6, kind: "npc", label: "June · Operations", interaction: "assistant", sprite: "banker", accent: "teal", solid: true },
  ]),
  coffee: interior("coffee", "Bull & Bean", "Espresso · Rumors · Research", "wood", [
    { id: "coffee-exit", x: 8, y: 10, kind: "door", label: "Exit to Wall Street", targetScene: "wall-street", targetPosition: { x: 5, y: 10 }, solid: false },
    { id: "coffee-counter", x: 3, y: 2, width: 10, height: 1, kind: "counter", label: "Coffee counter", interaction: "coffee", solid: true },
    { id: "barista", x: 8, y: 1, kind: "npc", label: "Tess the Barista", interaction: "coffee", sprite: "barista", accent: "red", solid: true },
    { id: "fund-client", x: 12, y: 6, kind: "npc", label: "Mysterious Fund PM", interaction: "fund", sprite: "client", accent: "ochre", solid: true },
  ]),
  otc: interior("otc", "OTC Alley", "Off-Tape · Simulated Assets Only", "alley", [
    { id: "otc-exit", x: 8, y: 10, kind: "door", label: "Return to Wall Street", targetScene: "wall-street", targetPosition: { x: 21, y: 7 }, solid: false },
    { id: "otc-dealer", x: 8, y: 4, kind: "npc", label: "The Grey Broker", interaction: "otc", sprite: "rival", accent: "gray", solid: true },
    { id: "locked-stock", x: 12, y: 2, kind: "prop", label: "Regulated market gate", interaction: "regulated", solid: true },
  ]),
  subway: interior("subway", "Broad Street Station", "District Fast Travel", "floor", [
    { id: "subway-exit", x: 8, y: 10, kind: "door", label: "Return to Wall Street", targetScene: "wall-street", targetPosition: { x: 11, y: 13 }, solid: false },
    { id: "turnstile", x: 4, y: 4, width: 8, height: 1, kind: "counter", label: "Turnstiles", interaction: "subway", solid: true },
    { id: "conductor", x: 12, y: 7, kind: "npc", label: "Conductor", interaction: "subway", sprite: "guard", accent: "blue", solid: true },
  ]),
};

function interior(id: SceneId, name: string, subtitle: string, defaultTile: TileKind, objects: WorldObject[]): Scene {
  return {
    id,
    name,
    subtitle,
    width: 16,
    height: 12,
    defaultTile,
    tileAt: (x, y) => (x === 0 || y === 0 || x === 15 || y === 11 ? "grass" : defaultTile),
    objects,
  };
}

export function marketStateForHour(hour: number): MarketState {
  if (hour < 9) return "PRE-MARKET";
  if (hour < 16) return "MARKET OPEN";
  return "AFTER HOURS";
}

export function rankForReputation(reputation: number) {
  if (reputation >= 200) return "Managing Director";
  if (reputation >= 120) return "Vice President";
  if (reputation >= 70) return "Senior Broker";
  if (reputation >= 30) return "Junior Broker";
  return "Street Intern";
}

export function officeUpgradeCost(level: number) {
  return [0, 500, 1_200, 2_500, 5_000][Math.max(0, Math.min(4, level))] ?? 5_000;
}

export function getObjectCells(object: WorldObject): Position[] {
  const cells: Position[] = [];
  for (let y = object.y; y < object.y + (object.height ?? 1); y += 1) {
    for (let x = object.x; x < object.x + (object.width ?? 1); x += 1) cells.push({ x, y });
  }
  return cells;
}

export function isBlocked(scene: Scene, position: Position) {
  if (position.x < 0 || position.y < 0 || position.x >= scene.width || position.y >= scene.height) return true;
  if (scene.id !== "wall-street" && (position.x === 0 || position.y === 0 || position.x === scene.width - 1 || position.y === scene.height - 1)) return true;
  const hasWalkableDoor = scene.objects.some((object) => object.kind === "door" && getObjectCells(object).some((cell) => cell.x === position.x && cell.y === position.y));
  if (hasWalkableDoor) return false;
  return scene.objects.some((object) => object.solid && getObjectCells(object).some((cell) => cell.x === position.x && cell.y === position.y));
}

export function positionInDirection(position: Position, direction: Direction): Position {
  const delta: Record<Direction, Position> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  return { x: position.x + delta[direction].x, y: position.y + delta[direction].y };
}

export function adjacentInteractive(scene: Scene, position: Position, direction: Direction) {
  const target = positionInDirection(position, direction);
  return scene.objects.find((object) => getObjectCells(object).some((cell) => cell.x === target.x && cell.y === target.y));
}

export function resolveNegotiation(state: NegotiationState, action: NegotiationAction, roll: number): NegotiationResult {
  const luck = Math.max(0, Math.min(1, roll));
  let rivalDelta = 0;
  let playerDelta = 0;
  let insight = state.insight;
  let hedge = state.hedge;
  let line = "The room studies your move.";

  if (action === "quote") {
    rivalDelta = 14 + Math.round(luck * 8) + insight * 3;
    playerDelta = Math.max(0, 7 - hedge * 3);
    insight = 0;
    line = "You tighten the spread. The client leans toward your side of the table.";
  } else if (action === "liquidity") {
    rivalDelta = 10 + Math.round(luck * 12);
    playerDelta = Math.max(0, 4 - hedge * 2);
    line = "You source a clean block of demo liquidity and show real depth.";
  } else if (action === "research") {
    insight = Math.min(3, insight + 1);
    playerDelta = Math.max(0, 3 - hedge * 2);
    line = "You read the tape and spot the rival's weak inventory position.";
  } else {
    hedge = Math.min(2, hedge + 1);
    rivalDelta = 5 + Math.round(luck * 3);
    playerDelta = 0;
    line = "You hedge the desk. Their pressure glances off your risk book.";
  }

  const rivalPressure = Math.max(2, 10 + Math.round((1 - luck) * 7) - hedge * 4);
  playerDelta += rivalPressure;
  return {
    playerConfidence: Math.max(0, state.playerConfidence - playerDelta),
    rivalResolve: Math.max(0, state.rivalResolve - rivalDelta),
    insight,
    hedge: Math.max(0, hedge - (action === "hedge" ? 0 : 1)),
    turn: state.turn + 1,
    playerDelta,
    rivalDelta,
    line,
  };
}

export function addItem(inventory: BriefcaseItem[], item: BriefcaseItem): BriefcaseItem[] {
  const existing = inventory.find((entry) => entry.id === item.id);
  if (!existing) return [...inventory, { ...item }];
  return inventory.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity + item.quantity } : entry);
}

export function advanceQuest(quests: Quest[], id: string, amount = 1): Quest[] {
  return quests.map((quest) => {
    if (quest.id !== id || quest.state === "complete") return quest;
    const progress = Math.min(quest.goal, quest.progress + amount);
    return { ...quest, state: progress >= quest.goal ? "complete" : "active", progress };
  });
}
