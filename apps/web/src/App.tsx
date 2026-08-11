import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { WalletButton } from "./components/WalletButton";
import { City3D } from "./components/City3D";
import { OnchainBrokerConsole, type ConfirmedRpgSwap } from "./components/OnchainBrokerConsole";
import { playWallStreetJingle, storedSoundEnabled, storeSoundEnabled } from "./lib/audio";
import { chainHookCatalog, createChainIntent, regulatedMarketGate, type ChainIntent } from "./lib/chainHooks";
import { districtPulse, districtStandings, type BrokerStanding, type DistrictPulse } from "./lib/livingWorld";
import type { ProgramResult } from "./lib/cityPrograms";
import { useOnchainBroker, type OnchainBrokerSnapshot } from "./lib/onchainBroker";
import {
  SAVE_KEY,
  addItem,
  adjacentInteractive,
  advanceQuest,
  createNewSave,
  getObjectCells,
  isBlocked,
  marketStateForHour,
  officeUpgradeCost,
  positionInDirection,
  rankForReputation,
  resolveNegotiation,
  scenes,
  type Direction,
  type GameSave,
  type NegotiationAction,
  type NegotiationState,
  type SceneId,
  type WorldObject,
} from "./lib/rpg";

type Screen = "title" | "game";
type WorldView = "2d" | "3d";
type Drawer = "hub" | "quests" | "briefcase" | "chain" | "help" | null;
type Dialogue = { speaker: string; text: string; action?: { label: string; run: () => void } };
type Battle = {
  opponent: string;
  subtitle: string;
  kind: "rival" | "client";
  state: NegotiationState;
  line: string;
  outcome?: "won" | "lost";
};

const initialBattleState: NegotiationState = { playerConfidence: 100, rivalResolve: 100, insight: 0, hedge: 0, turn: 1 };

function loadSave(): GameSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameSave;
    return parsed.version === 1 && scenes[parsed.scene] ? parsed : null;
  } catch {
    return null;
  }
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function Sprite({ variant = "banker", direction = "down", accent = "blue", walking = false }: {
  variant?: WorldObject["sprite"] | "player";
  direction?: Direction;
  accent?: string;
  walking?: boolean;
}) {
  return (
    <span className={`pixel-sprite ${variant} face-${direction} accent-${accent} ${walking ? "walking" : ""}`} aria-hidden="true">
      <i className="sprite-hair" />
      <i className="sprite-head" />
      <i className="sprite-body" />
      <i className="sprite-arm left" />
      <i className="sprite-arm right" />
      <i className="sprite-leg left" />
      <i className="sprite-leg right" />
      {variant === "player" && <i className="sprite-case" />}
    </span>
  );
}

function WorldObjectView({ object, sceneWidth, sceneHeight }: { object: WorldObject; sceneWidth: number; sceneHeight: number }) {
  const style = {
    "--x": `${(object.x / sceneWidth) * 100}%`,
    "--y": `${(object.y / sceneHeight) * 100}%`,
    "--ow": `${((object.width ?? 1) / sceneWidth) * 100}%`,
    "--oh": `${((object.height ?? 1) / sceneHeight) * 100}%`,
  } as CSSProperties;

  if (object.kind === "building") {
    return (
      <div className={`world-object building accent-${object.accent ?? "gold"}`} style={style}>
        <div className="building-roof" />
        <div className="building-windows" />
        <strong>{object.label}</strong>
      </div>
    );
  }

  if (object.kind === "npc") {
    return (
      <div className="world-object npc-object" style={style} title={object.label}>
        <Sprite variant={object.sprite} accent={object.accent} />
        <span className="npc-name">{object.label?.split(" · ")[0]}</span>
      </div>
    );
  }

  return (
    <div className={`world-object object-${object.kind} ${object.interaction ? "interactive-object" : ""}`} style={style} title={object.label}>
      <span className="object-pixels">
        {object.id.includes("door") || object.id.includes("exit") ? "▥" :
          object.id === "subway" ? "M" : object.id === "otc-gate" ? "↗" :
            object.id === "bell" ? "◆" : object.id === "ticker" ? "↗" :
              object.id === "newsstand" ? "N" : object.kind === "counter" ? "" : "●"}
      </span>
      {object.label && object.kind === "portal" && <b>{object.label}</b>}
      {object.kind === "counter" && <b>{object.label}</b>}
    </div>
  );
}

function ProgressBar({ value, tone = "green" }: { value: number; tone?: "green" | "red" | "gold" }) {
  return <span className={`progress-bar ${tone}`}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [worldView, setWorldView] = useState<WorldView>("3d");
  const [save, setSave] = useState<GameSave>(() => createNewSave());
  const [hasSave, setHasSave] = useState(() => Boolean(loadSave()));
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [walking, setWalking] = useState(false);
  const [toast, setToast] = useState("Find Bull & Bean before the opening bell.");
  const [chainIntents, setChainIntents] = useState<ChainIntent[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<bigint>();
  const [worldClock, setWorldClock] = useState(() => Date.now());
  const [soundEnabled, setSoundEnabled] = useState(storedSoundEnabled);
  const { isConnected } = useAccount();
  const onchainBroker = useOnchainBroker(selectedProfileId);

  const scene = scenes[save.scene];
  const marketState = marketStateForHour(new Date().getHours());
  const rank = rankForReputation(save.reputation);
  const bankerName = onchainBroker.handle
    ? onchainBroker.handle.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Shy Bull";
  const standings = useMemo(() => districtStandings({
    handle: bankerName,
    reputation: save.reputation,
    commission: save.commission,
    aum: save.aum,
    officeLevel: save.officeLevel,
  }, marketState), [bankerName, marketState, save.aum, save.commission, save.officeLevel, save.reputation]);
  const pulses = useMemo(() => districtPulse(worldClock, marketState), [marketState, worldClock]);
  const playerStanding = standings.find((broker) => broker.player)!;
  const facingObject = useMemo(
    () => adjacentInteractive(scene, save.position, save.direction),
    [scene, save.position, save.direction],
  );

  const persist = useCallback((next: GameSave, showFlash = false) => {
    const stamped = { ...next, lastSavedAt: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(stamped));
    setHasSave(true);
    if (showFlash) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1200);
    }
  }, []);

  useEffect(() => {
    if (screen !== "game") return;
    const timeout = window.setTimeout(() => persist(save), 450);
    return () => window.clearTimeout(timeout);
  }, [persist, save, screen]);

  useEffect(() => {
    if (!selectedProfileId && onchainBroker.ownedProfileIds[0]) setSelectedProfileId(onchainBroker.ownedProfileIds[0]);
  }, [onchainBroker.ownedProfileIds, selectedProfileId]);

  useEffect(() => {
    if (screen !== "game") return;
    const interval = window.setInterval(() => setWorldClock(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, [screen]);

  const enterScene = useCallback((target: SceneId, position: { x: number; y: number }) => {
    setSave((current) => ({
      ...current,
      scene: target,
      position,
      direction: target === "wall-street" ? "down" : "up",
      visited: current.visited.includes(target) ? current.visited : [...current.visited, target],
    }));
    setDialogue(null);
    setToast(scenes[target].subtitle);
  }, []);

  const move = useCallback((direction: Direction) => {
    if (worldView !== "2d" || screen !== "game" || dialogue || battle || drawer) return;
    setSave((current) => {
      const currentScene = scenes[current.scene];
      const next = positionInDirection(current.position, direction);
      const base = { ...current, direction };
      if (isBlocked(currentScene, next)) return base;
      const portal = currentScene.objects.find((object) => object.targetScene && getObjectCells(object).some((cell) => cell.x === next.x && cell.y === next.y));
      if (portal?.targetScene && portal.targetPosition) {
        window.setTimeout(() => enterScene(portal.targetScene!, portal.targetPosition!), 0);
        return base;
      }
      return { ...base, position: next };
    });
    setWalking(true);
    window.setTimeout(() => setWalking(false), 130);
  }, [battle, dialogue, drawer, enterScene, screen, worldView]);

  const addChainIntent = useCallback((hook: Parameters<typeof createChainIntent>[0], gameEvent: string, payload: ChainIntent["payload"] = {}) => {
    const intent = createChainIntent(hook, gameEvent, payload);
    setChainIntents((items) => [intent, ...items].slice(0, 6));
  }, []);

  const handleConfirmedSwap = useCallback((result: ConfirmedRpgSwap) => {
    setSave((current) => ({
      ...current,
      reputation: current.reputation + 1,
      commission: current.commission + result.commission,
      aum: current.aum + result.retainedFee,
    }));
    addChainIntent("BankerHook", "testnet_order_settled", {
      brokerId: result.brokerId,
      volume: result.volume,
      transaction: result.transactionHash,
    });
    setToast(`ONCHAIN ORDER · ${result.volume.toLocaleString()} test units attributed`);
  }, [addChainIntent]);

  const handleCityProgram = useCallback((result: ProgramResult) => {
    if (!result.allowed) return;
    setSave((current) => ({
      ...current,
      reputation: current.reputation + result.program.reputation,
      commission: current.commission + result.program.commission,
      aum: current.aum + result.program.aum,
    }));
    if (result.program.hook) {
      addChainIntent(result.program.hook, `city_program_${result.program.id}`, {
        simulated: true,
        location: result.program.location,
        jobXp: result.program.shiftXp,
      });
    }
    setToast(`${result.program.label.toUpperCase()} · +${result.program.reputation} REP`);
  }, [addChainIntent]);

  const completeCoffee = useCallback(() => {
    const alreadyOwned = save.inventory.some((item) => item.id === "espresso");
    if (!alreadyOwned) {
      setSave((current) => ({
        ...current,
        inventory: addItem(current.inventory, { id: "espresso", name: "Double Espresso", description: "+10 confidence in spirit, if not in code.", quantity: 1, icon: "☕" }),
        quests: advanceQuest(current.quests, "morning-coffee"),
      }));
      setToast("ITEM GET · Double Espresso");
    }
    setDialogue({ speaker: "Tess", text: alreadyOwned ? "Your usual is already in the briefcase. Please don't ask how." : "One double espresso. The floor brokers say Apex & Co. is quoting too wide today." });
  }, [save.inventory]);

  const startBattle = useCallback((kind: Battle["kind"]) => {
    setDialogue(null);
    setBattle({
      opponent: kind === "rival" ? "CHADWICK" : "MS. LEDGER",
      subtitle: kind === "rival" ? "APEX & CO. · RIVAL BROKER" : "FIRST BULL BANK · CLIENT MANDATE",
      kind,
      state: { ...initialBattleState },
      line: kind === "rival"
        ? "“You call that a spread? Show me what your tiny desk can do.”"
        : "“My fund needs care, clarity, and enough depth to sleep at night.”",
    });
  }, []);

  const interact = useCallback(() => {
    if (worldView !== "2d" || screen !== "game" || drawer || battle) return;
    if (dialogue) {
      setDialogue(null);
      return;
    }
    const object = adjacentInteractive(scenes[save.scene], save.position, save.direction);
    if (!object) {
      setToast("Nothing to inspect here.");
      return;
    }
    if (object.targetScene && object.targetPosition) {
      enterScene(object.targetScene, object.targetPosition);
      return;
    }
    switch (object.interaction) {
      case "intern":
        setDialogue({ speaker: "Maya", text: "Wall Street rule one: coffee before confidence. Bull & Bean is southwest. Bring your briefcase—you'll need it." });
        break;
      case "analyst":
        setDialogue({ speaker: "Lost Analyst", text: "Is this Broad Street or breadth strategy? Never mind. Your office is the blue-signed building southeast." });
        break;
      case "coffee":
        completeCoffee();
        break;
      case "bell": {
        const hasCoffee = save.inventory.some((item) => item.id === "espresso");
        const quest = save.quests.find((item) => item.id === "morning-coffee");
        if (hasCoffee && quest?.state !== "complete") {
          setSave((current) => ({
            ...current,
            reputation: current.reputation + 8,
            quests: advanceQuest(current.quests, "morning-coffee"),
            inventory: addItem(current.inventory, { id: "market-pass", name: "Market Pass", description: "Access credential for the simulated trading floor.", quantity: 1, icon: "P" }),
          }));
          addChainIntent("BrokerRegistry", "opening_bell_quest_complete", { reputation: 8 });
          setToast("QUEST COMPLETE · The Opening Bell");
          setDialogue({ speaker: "Closing Bell Clerk", text: "Right on time. Your Market Pass is active, rookie. Chadwick from Apex is waiting by the west rail." });
        } else {
          setDialogue({ speaker: "Closing Bell Clerk", text: quest?.state === "complete" ? "The tape is live. Protect the client before you protect your ego." : "The bell waits for no banker. You, however, should get coffee first." });
        }
        break;
      }
      case "rival":
        setDialogue({ speaker: "Chadwick", text: "Apex & Co. owns this block. Beat my quote and maybe I'll remember your firm's name.", action: { label: "Accept challenge", run: () => startBattle("rival") } });
        break;
      case "client": {
        setSave((current) => ({ ...current, quests: current.quests.map((quest) => quest.id === "first-client" && quest.state === "available" ? { ...quest, state: "active" } : quest) }));
        setDialogue({ speaker: "Ms. Ledger", text: "I have a $25,000 fictional mandate. Convince me your desk can price it without gambling the book.", action: { label: "Pitch the mandate", run: () => startBattle("client") } });
        break;
      }
      case "upgrade":
        setDrawer("briefcase");
        setToast("Select OFFICE UPGRADE in the briefcase panel.");
        break;
      case "desk":
        setDialogue({ speaker: "Desk Terminal", text: `Ledger & Co. · Level ${save.officeLevel}. ${money(save.aum)} AUM. ${money(save.commission)} lifetime demo commission.` });
        break;
      case "router":
        addChainIntent("BrokerRouter", "inspect_routing_terminal", { broker: "Ledger & Co.", demo: true });
        setDrawer("chain");
        break;
      case "vault":
        addChainIntent("BrokerVault", "inspect_client_vault", { asset: "TEST-USD", custody: false });
        setDialogue({ speaker: "Vault Clerk", text: "BrokerVault is in demo mode. It records valueless test allocations; no real customer assets are accepted." });
        break;
      case "terminal":
        setDialogue({ speaker: "Market Tape", text: "WETH / USDG  2,184.20  +1.8% · NOVA / TEST  42.18  +3.8%. All labels and prices are simulated." });
        break;
      case "otc":
        setDialogue({ speaker: "Grey Broker", text: "I trade rumors, test tokens, and very dramatic pauses. Real-stock modules? Not through this gate." });
        break;
      case "regulated":
        setDialogue({ speaker: "Compliance Gate", text: regulatedMarketGate.reason });
        break;
      case "subway":
        setDialogue({ speaker: "Conductor", text: "Uptown and international districts are still under construction. Your Metro Card is ready for the next expansion." });
        break;
      case "assistant":
        setDialogue({ speaker: "June", text: "The desk is small, but the books are clean. Win a client mandate and we'll have enough commission for an upgrade." });
        break;
      case "fund":
        setDialogue({ speaker: "Fund PM", text: "Everybody talks alpha before coffee. I prefer the people who ask about drawdown first." });
        break;
      case "manager":
        setDialogue({ speaker: "Lobby Manager", text: "Client confidence is a balance sheet item. Treat it accordingly." });
        break;
      case "floor-broker":
        setDialogue({ speaker: "Floor Broker", text: "Keyboard tip: arrows or WASD to walk, E or Enter to talk, Q for quests, I for briefcase." });
        break;
      case "hub":
        setDrawer("hub");
        setToast("DISTRICT HUB · Brokers are moving on the ladder.");
        break;
      case "ticker":
        setDialogue({ speaker: "Street Ticker", text: `${marketState} · NOVA +3.84% · QUANT -1.24% · WETH +1.80% · Fictional/test markets.` });
        break;
      case "newsstand":
        setDialogue({ speaker: "The Daily Ledger", text: "ROOKIE BROKER OPENS TINY OFFICE. Neighbors cautiously optimistic; landlord extremely optimistic." });
        break;
      default:
        setDialogue({ speaker: object.label ?? "Wall Street", text: "Nothing unusual—at least not by market standards." });
    }
  }, [addChainIntent, battle, completeCoffee, dialogue, drawer, enterScene, marketState, save, screen, startBattle, worldView]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen === "title") {
        if (event.key === "Enter") startGame(hasSave ? "continue" : "new");
        return;
      }
      const key = event.key.toLowerCase();
      const direction = ({ arrowup: "up", w: "up", arrowdown: "down", s: "down", arrowleft: "left", a: "left", arrowright: "right", d: "right" } as Record<string, Direction>)[key];
      if (direction) {
        event.preventDefault();
        move(direction);
      } else if (key === "enter" || key === "e" || key === " ") {
        event.preventDefault();
        interact();
      } else if (key === "q") setDrawer((value) => value === "quests" ? null : "quests");
      else if (key === "i") setDrawer((value) => value === "briefcase" ? null : "briefcase");
      else if (key === "escape") {
        setDrawer(null);
        setDialogue(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasSave, interact, move, screen]);

  function startGame(mode: "new" | "continue") {
    if (soundEnabled) void playWallStreetJingle();
    const next = mode === "continue" ? loadSave() ?? createNewSave() : createNewSave();
    setSave(next);
    setScreen("game");
    setToast(mode === "continue" ? "Welcome back to the district." : "Find Bull & Bean before the opening bell.");
    setDrawer(null);
    setDialogue(null);
    setBattle(null);
    if (mode === "new") persist(next);
  }

  function toggleSound() {
    setSoundEnabled((current) => {
      const next = !current;
      storeSoundEnabled(next);
      if (next) void playWallStreetJingle();
      return next;
    });
  }

  function battleAction(action: NegotiationAction) {
    if (!battle || battle.outcome) return;
    const result = resolveNegotiation(battle.state, action, Math.random());
    const outcome = result.rivalResolve <= 0 ? "won" : result.playerConfidence <= 0 ? "lost" : undefined;
    setBattle({ ...battle, state: result, line: result.line, outcome });
    if (outcome === "won") {
      setSave((current) => {
        const questId = battle.kind === "rival" ? "rival-desk" : "first-client";
        const alreadyComplete = current.quests.find((quest) => quest.id === questId)?.state === "complete";
        if (alreadyComplete) return { ...current, commission: current.commission + 25 };
        const rewardItem = battle.kind === "rival"
          ? { id: "brass-calculator", name: "Brass Calculator", description: "A trophy from Apex & Co. Adds considerable desk gravitas.", quantity: 1, icon: "+" }
          : { id: "client-card", name: "Ledger Mandate", description: "A signed fictional client mandate worth $25K demo AUM.", quantity: 1, icon: "C" };
        return {
          ...current,
          reputation: current.reputation + (battle.kind === "rival" ? 15 : 10),
          commission: current.commission + (battle.kind === "rival" ? 90 : 120),
          aum: current.aum + (battle.kind === "client" ? 25_000 : 0),
          inventory: addItem(current.inventory, rewardItem),
          quests: advanceQuest(current.quests, questId),
        };
      });
      addChainIntent(battle.kind === "rival" ? "BankerHook" : "BrokerVault", `${battle.kind}_negotiation_won`, { simulated: true });
    }
  }

  function buyOfficeUpgrade() {
    const nextLevel = Math.min(4, save.officeLevel + 1);
    const cost = officeUpgradeCost(nextLevel);
    if (save.officeLevel >= 4) {
      setToast("Your office is fully upgraded for this slice.");
      return;
    }
    if (save.commission < cost) {
      setToast(`Need ${money(cost - save.commission)} more demo commission.`);
      return;
    }
    setSave((current) => ({ ...current, officeLevel: nextLevel, commission: current.commission - cost }));
    addChainIntent("BrokerRegistry", "office_upgraded", { level: nextLevel, cost });
    setToast(`OFFICE UPGRADED · Level ${nextLevel}`);
  }

  const tiles = useMemo(() => Array.from({ length: scene.width * scene.height }, (_, index) => {
    const x = index % scene.width;
    const y = Math.floor(index / scene.width);
    return { x, y, kind: scene.tileAt?.(x, y) ?? scene.defaultTile };
  }), [scene]);

  if (screen === "title") {
    return (
      <main className="title-screen">
        <div className="title-art" />
        <div className="title-vignette" />
        <section className="title-card" aria-label="Banker Bros title screen">
          <div className="title-kicker">AN ONCHAIN FINANCE RPG</div>
          <h1><span>BANKER</span><b>BROS</b></h1>
          <p>WALL STREET DISTRICT</p>
          <div className="pixel-divider"><i /><i /><i /></div>
          <button className="title-primary" onClick={() => startGame(hasSave ? "continue" : "new")}>
            {hasSave ? "Continue" : "New Game"}<small>{hasSave ? "Return to Ledger & Co." : "Begin your brokerage story"}</small>
          </button>
          {hasSave && <button className="title-secondary" onClick={() => startGame("new")}>Start a new game</button>}
          <button className="title-sound" aria-pressed={soundEnabled} onClick={toggleSound}>
            <span>{soundEnabled ? "♪" : "×"}</span> WALL STREET JINGLE · {soundEnabled ? "ON" : "OFF"}
          </button>
          <div className="title-controls">WASD TO ROAM · V CAMERA · F TO WORK · 2D MODE AVAILABLE</div>
          <div className="simulation-ribbon">FICTIONAL & CRYPTO-TEST MARKETS · NO REAL VALUE · REGULATED MODULES LOCKED</div>
        </section>
      </main>
    );
  }

  return (
    <main className={`game-shell market-${marketState.toLowerCase().replace(" ", "-")}`}>
      <header className="game-header">
        <button className="mini-brand" onClick={() => setScreen("title")}><span>BB</span><b>BANKER BROS</b></button>
        <div className="market-tape" aria-label="Simulated market tape">
          <span className="market-state"><i />{marketState}</span>
          <span>WETH <b>2,184.20</b> <em>+1.80%</em></span>
          <span>NOVA <b>42.18</b> <em>+3.84%</em></span>
          <span>QUANT <b>88.62</b> <em className="down">-1.24%</em></span>
          <small>SIMULATED</small>
        </div>
        <WalletButton floor={onchainBroker.floor ?? save.officeLevel} rank={onchainBroker.rank ?? save.reputation} />
      </header>

      <section className="rpg-layout">
        <aside className="trainer-card">
          <div className="portrait-frame"><Sprite variant="player" accent="blue" /></div>
          <span className="eyebrow">YOUR BANKER</span>
          <h2>{bankerName}</h2>
          <p>{onchainBroker.profileId ? `Onchain Banker #${onchainBroker.profileId}` : rank}</p>
          <div className="trainer-stats">
            <label><span>REPUTATION</span><b>{save.reputation}</b></label>
            <ProgressBar value={(save.reputation % 70) / 0.7} tone="gold" />
            <label><span>COMMISSION</span><b>{money(save.commission)}</b></label>
            <label><span>AUM</span><b>{money(save.aum)}</b></label>
            <label><span>OFFICE</span><b>LV. {save.officeLevel}</b></label>
          </div>
          <nav className="rpg-menu">
            <button onClick={() => setDrawer(drawer === "quests" ? null : "quests")}><i>Q</i><span>Quest Log</span><b>{save.quests.filter((quest) => quest.state === "active").length}</b></button>
            <button onClick={() => setDrawer(drawer === "briefcase" ? null : "briefcase")}><i>I</i><span>Briefcase</span><b>{save.inventory.length}</b></button>
            <button onClick={() => setDrawer(drawer === "hub" ? null : "hub")}><i>↑</i><span>Trading Hub</span><b>F{playerStanding.floor}</b></button>
            <button onClick={() => setWorldView((view) => view === "2d" ? "3d" : "2d")}><i>3D</i><span>{worldView === "3d" ? "Pixel District" : "3D City"}</span><b>{worldView === "3d" ? "2D" : "PLAY"}</b></button>
            <button onClick={() => setDrawer(drawer === "chain" ? null : "chain")}><i>⌁</i><span>Broker Passport</span><b>{isConnected ? "ON" : "JOIN"}</b></button>
            <button onClick={() => setDrawer(drawer === "help" ? null : "help")}><i>?</i><span>Controls</span></button>
          </nav>
          <button className="save-button" onClick={() => persist(save, true)}>{savedFlash ? "SAVED!" : "SAVE GAME"}</button>
        </aside>

        <section className={`world-frame ${worldView === "3d" ? "three-d" : ""}`}>
          <div className="location-banner">
            <span>{worldView === "3d" ? "Wall Street City" : scene.name}</span>
            <small>{worldView === "3d" ? "Third-person career world · Press V for first person" : scene.subtitle}</small>
          </div>
          {worldView === "3d" ? (
            <City3D bankerName={bankerName} marketState={marketState} onProgramComplete={handleCityProgram} />
          ) : (
            <>
              <div className="world-viewport">
                <div className="world-board" style={{ "--cols": scene.width, "--rows": scene.height } as CSSProperties}>
                  <div className="tile-layer">
                    {tiles.map((tile) => <i key={`${tile.x}-${tile.y}`} className={`tile tile-${tile.kind}`} />)}
                  </div>
                  <div className="street-lines" aria-hidden="true" />
                  {scene.objects.map((object) => <WorldObjectView key={object.id} object={object} sceneWidth={scene.width} sceneHeight={scene.height} />)}
                  <div
                    className="player-object"
                    style={{ left: `${(save.position.x / scene.width) * 100}%`, top: `${(save.position.y / scene.height) * 100}%`, width: `${100 / scene.width}%`, height: `${100 / scene.height}%` }}
                  >
                    <Sprite variant="player" direction={save.direction} accent="blue" walking={walking} />
                    <i className="player-shadow" />
                  </div>
                </div>
              </div>
              <div className={`interaction-prompt ${facingObject ? "visible" : ""}`}>
                <button onClick={interact}><kbd>E</kbd> {facingObject?.label ?? "Interact"}</button>
              </div>
            </>
          )}
          <div className="toast-line"><span>◆</span>{toast}</div>
        </section>

        <aside className="district-card">
          <span className="eyebrow">DISTRICT MAP</span>
          <div className="mini-map">
            <i className={`mini-player scene-${save.scene}`} />
            <span className="map-exchange">EXCHANGE</span>
            <span className="map-bank">BANK</span>
            <span className="map-coffee">COFFEE</span>
            <span className="map-office">YOUR OFFICE</span>
            <span className="map-road vertical" />
            <span className="map-road horizontal" />
          </div>
          <div className="district-objective">
            <small>CURRENT OBJECTIVE</small>
            <b>{save.quests.find((quest) => quest.state === "active")?.title ?? "Explore Wall Street"}</b>
            <p>{save.quests.find((quest) => quest.state === "active")?.detail ?? "Meet clients and grow your desk."}</p>
          </div>
          <div className="district-legend">
            <span><i className="gold" /> Main story</span>
            <span><i className="green" /> Enterable</span>
            <span><i className="red" /> Rival</span>
          </div>
        </aside>
      </section>

      {worldView === "2d" && <div className="mobile-controls" aria-label="Touch controls">
        <div className="d-pad">
          <button className="up" onClick={() => move("up")}>▲</button>
          <button className="left" onClick={() => move("left")}>◀</button>
          <button className="right" onClick={() => move("right")}>▶</button>
          <button className="down" onClick={() => move("down")}>▼</button>
        </div>
        <div className="mobile-shortcuts"><button onClick={() => setDrawer("chain")}>PASSPORT</button><button onClick={() => setDrawer("hub")}>HUB</button></div>
        <button className="a-button" onClick={interact}>A<small>TALK</small></button>
      </div>}

      {dialogue && (
        <div className="dialogue-wrap" onClick={() => !dialogue.action && setDialogue(null)}>
          <section className="dialogue-box" role="dialog" aria-live="polite">
            <div className="dialogue-avatar"><Sprite variant={dialogue.speaker === "Chadwick" ? "rival" : "banker"} accent={dialogue.speaker === "Chadwick" ? "red" : "gold"} /></div>
            <div><strong>{dialogue.speaker}</strong><p>{dialogue.text}</p></div>
            {dialogue.action
              ? <button onClick={(event) => { event.stopPropagation(); dialogue.action?.run(); }}>{dialogue.action.label} <span>›</span></button>
              : <span className="dialogue-next">▼</span>}
          </section>
        </div>
      )}

      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(null)}>
          <aside className="game-drawer" onClick={(event) => event.stopPropagation()}>
            <button className="drawer-close" onClick={() => setDrawer(null)}>×</button>
            {drawer === "quests" && <QuestDrawer save={save} />}
            {drawer === "briefcase" && <BriefcaseDrawer save={save} onUpgrade={buyOfficeUpgrade} />}
            {drawer === "hub" && <HubDrawer standings={standings} pulses={pulses} marketState={marketState} onMeet={(broker) => { setDrawer(null); setDialogue({ speaker: broker.handle, text: `${broker.desk}, Floor ${broker.floor}. “The ladder remembers every clean fill and every client you keep. Meet me on the Exchange floor when your book is ready.”` }); }} />}
            {drawer === "chain" && <ChainDrawer intents={chainIntents} connected={isConnected} broker={onchainBroker} onSelectProfile={setSelectedProfileId} onSwapConfirmed={handleConfirmedSwap} />}
            {drawer === "help" && <HelpDrawer />}
          </aside>
        </div>
      )}

      {battle && (
        <Negotiation battle={battle} onAction={battleAction} onClose={() => { setBattle(null); setToast(battle.outcome === "won" ? "Negotiation won. Progress saved." : "Back to the street."); }} />
      )}
    </main>
  );
}

function HubDrawer({ standings, pulses, marketState, onMeet }: {
  standings: BrokerStanding[];
  pulses: DistrictPulse[];
  marketState: ReturnType<typeof marketStateForHour>;
  onMeet: (broker: BrokerStanding) => void;
}) {
  const player = standings.find((broker) => broker.player)!;
  const next = standings[player.rank - 2];
  return (
    <>
      <div className="drawer-heading"><span>LIVING WALL STREET</span><h2>Trading Hub</h2><p>Meet desks, follow district activity, and climb through service, liquidity, reputation, and client trust.</p></div>
      <section className="hub-rank-card">
        <div><small>YOUR DISTRICT POSITION</small><strong>#{player.rank}</strong><span>FLOOR {player.floor}</span></div>
        <p><b>{player.handle}</b><span>{player.score.toLocaleString()} ladder points</span><em>{next ? `${Math.max(0, next.score - player.score).toLocaleString()} to catch ${next.handle}` : "You hold the bell"}</em></p>
      </section>
      <div className="hub-session"><i /><b>{marketState}</b><span>LOCAL DISTRICT SIMULATION · ONCHAIN EVENTS BECOME THE PERSISTENT WORLD FEED</span></div>
      <h3 className="event-heading">BROKER LADDER</h3>
      <div className="broker-ladder">
        {standings.map((broker) => (
          <article key={`${broker.handle}-${broker.desk}`} className={broker.player ? "player" : ""}>
            <strong>#{broker.rank}</strong><div><b>{broker.handle}</b><span>{broker.desk} · Floor {broker.floor}</span></div><em>{broker.score.toLocaleString()}</em><small>{broker.status}</small>
            {!broker.player && <button onClick={() => onMeet(broker)}>MEET</button>}
          </article>
        ))}
      </div>
      <h3 className="event-heading">DISTRICT PULSE</h3>
      <div className="district-pulse">
        {pulses.map((pulse) => <p key={pulse.id} className={pulse.tone}><i /><b>{pulse.desk}</b><span>{pulse.message}</span><em>NOW</em></p>)}
      </div>
      <p className="hub-boundary">This slice simulates resident activity locally. Production multiplayer will use wallet-authenticated presence and indexed contract events; chat and matchmaking never become financial settlement authority.</p>
    </>
  );
}

function QuestDrawer({ save }: { save: GameSave }) {
  return (
    <>
      <div className="drawer-heading"><span>FIELD NOTES</span><h2>Quest Log</h2><p>The road from folding desk to Wall Street legend.</p></div>
      <div className="quest-list">
        {save.quests.map((quest) => (
          <article key={quest.id} className={`quest-row ${quest.state}`}>
            <i>{quest.state === "complete" ? "✓" : quest.state === "active" ? "!" : "·"}</i>
            <div><span>{quest.state}</span><h3>{quest.title}</h3><p>{quest.detail}</p><small>REWARD · {quest.reward}</small></div>
            <b>{quest.progress}/{quest.goal}</b>
          </article>
        ))}
      </div>
    </>
  );
}

function BriefcaseDrawer({ save, onUpgrade }: { save: GameSave; onUpgrade: () => void }) {
  const nextLevel = Math.min(4, save.officeLevel + 1);
  const cost = officeUpgradeCost(nextLevel);
  return (
    <>
      <div className="drawer-heading"><span>LEDGER & CO.</span><h2>Briefcase</h2><p>Everything a hungry young brokerage needs.</p></div>
      <div className="inventory-grid">
        {save.inventory.map((item) => (
          <article key={item.id}><i>{item.icon}</i><div><h3>{item.name}</h3><p>{item.description}</p></div><b>×{item.quantity}</b></article>
        ))}
      </div>
      <section className="office-upgrade-card">
        <div><span>OFFICE PROGRESSION</span><h3>Ledger & Co. · Level {save.officeLevel}</h3><p>{save.officeLevel >= 4 ? "Penthouse-ready for this vertical slice." : `Install ${["", "a secondhand terminal", "a client lounge", "a brass research desk", "the district trading suite"][nextLevel]}.`}</p></div>
        <button disabled={save.officeLevel >= 4 || save.commission < cost} onClick={onUpgrade}>{save.officeLevel >= 4 ? "MAX LEVEL" : `UPGRADE · ${money(cost)}`}</button>
      </section>
    </>
  );
}

function ChainDrawer({ intents, connected, broker, onSelectProfile, onSwapConfirmed }: {
  intents: ChainIntent[];
  connected: boolean;
  broker: OnchainBrokerSnapshot;
  onSelectProfile: (profileId: bigint) => void;
  onSwapConfirmed: (result: ConfirmedRpgSwap) => void;
}) {
  const readinessByHook = {
    "ERC-6551 Identity": broker.readiness.identity,
    BrokerRegistry: broker.readiness.registry,
    BrokerVault: broker.readiness.vault,
    BrokerRouter: broker.readiness.router,
    BankerHook: broker.readiness.hook,
  } as const;
  return (
    <>
      <div className="drawer-heading"><span>YOUR ONCHAIN IDENTITY</span><h2>Broker Passport</h2><p>Connect once, enter Wall Street, and let your license carry your brokerage history.</p></div>
      <div className="chain-status"><i className={broker.mode === "live" ? "connected" : ""} /><b>{broker.mode === "live" ? "Onchain identity reader active" : connected ? "Wallet connected" : "Demo adapter active"}</b><span>{broker.mode === "live" ? "Legacy BankerProfile reads are live; the testnet order console below activates only when its complete address set is configured." : connected ? "Configure the liquidity addresses to unlock the guided external-NFT test order." : "Connect a testnet wallet when you are ready."}</span></div>
      {broker.mode === "live" && (
        <section className="linked-broker-card">
          <div className="linked-broker-heading"><span>LINKED BANKER IDENTITY</span><b>{broker.loading ? "SYNCING" : broker.error ? "READ ERROR" : "READ ONLY"}</b></div>
          {broker.profileId ? (
            <>
              <h3>{broker.handle ?? `Banker #${broker.profileId}`}</h3>
              <div className="linked-broker-stats">
                <span><small>PROFILE</small><b>#{broker.profileId.toString()}</b></span>
                <span><small>LEVEL</small><b>{broker.level ?? "—"}</b></span>
                <span><small>TOWER</small><b>{broker.floor ? `F${broker.floor}` : "LOBBY"}</b></span>
                <span><small>RANK</small><b>{broker.rank ? `#${broker.rank}` : "—"}</b></span>
                <span><small>OFFICE</small><b>{broker.officeRating ?? 0}</b></span>
                <span><small>CREDITS</small><b>{broker.credits !== undefined ? (broker.credits / 1_000_000n).toLocaleString() : "—"}</b></span>
              </div>
              {broker.desk && <p className="linked-desk"><b>{broker.desk.name}</b><span>Tier {broker.desk.tier} · Volume {(broker.desk.lifetimeVolume / 1_000_000n).toLocaleString()} credits</span></p>}
              {broker.ownedProfileIds.length > 1 && <div className="profile-picker"><small>WALLET BANKERS</small>{broker.ownedProfileIds.map((profileId) => <button className={profileId === broker.profileId ? "active" : ""} key={profileId.toString()} onClick={() => onSelectProfile(profileId)}>#{profileId.toString()}</button>)}</div>}
            </>
          ) : <p className="no-linked-broker">This wallet does not own a BankerProfile on the configured deployment. Demo progression remains available.</p>}
        </section>
      )}
      <OnchainBrokerConsole onSwapConfirmed={onSwapConfirmed} />
      <div className="hook-list">
        {chainHookCatalog.map((hook) => <article key={hook.name}><i>⌁</i><div><h3>{hook.name}</h3><p>{hook.role}</p><code>{hook.method}</code></div><b className={readinessByHook[hook.name] ? "ready" : ""}>{readinessByHook[hook.name] ? "CONFIGURED" : "PLACEHOLDER"}</b></article>)}
      </div>
      <h3 className="event-heading">RECENT GAME → CHAIN INTENTS</h3>
      <div className="intent-list">
        {intents.length ? intents.map((intent, index) => <p key={`${intent.gameEvent}-${index}`}><b>{intent.hook}</b><span>{intent.gameEvent}</span><em>{intent.status}</em></p>) : <small>Walk to the routing terminal, vault, or complete a quest to generate demo intents.</small>}
      </div>
      <div className="regulated-gate"><b>LOCKED</b><div><strong>{regulatedMarketGate.label}</strong><p>{regulatedMarketGate.reason}</p></div></div>
    </>
  );
}

function HelpDrawer() {
  return (
    <>
      <div className="drawer-heading"><span>HOW TO PLAY</span><h2>Controls</h2><p>Designed for keyboard, touch, and gamepad-shaped hands.</p></div>
      <div className="help-grid">
        <article><kbd>↑ ↓ ← →</kbd><b>Walk</b><span>WASD works too</span></article>
        <article><kbd>E / ENTER</kbd><b>Interact</b><span>Talk, inspect, enter</span></article>
        <article><kbd>Q</kbd><b>Quest log</b><span>Track district stories</span></article>
        <article><kbd>I</kbd><b>Briefcase</b><span>Items and upgrades</span></article>
        <article><kbd>ESC</kbd><b>Close</b><span>Back to the street</span></article>
      </div>
      <p className="help-note">Tip: face an NPC, sign, terminal, or doorway. The interaction prompt appears at the bottom of the game window.</p>
    </>
  );
}

function Negotiation({ battle, onAction, onClose }: { battle: Battle; onAction: (action: NegotiationAction) => void; onClose: () => void }) {
  const actions: Array<{ id: NegotiationAction; name: string; note: string; icon: string }> = [
    { id: "quote", name: "Tight Quote", note: "High pressure · uses insight", icon: "↔" },
    { id: "liquidity", name: "Source Liquidity", note: "Reliable depth · variable impact", icon: "▦" },
    { id: "research", name: "Read the Tape", note: "Build insight for the next quote", icon: "⌁" },
    { id: "hedge", name: "Hedge Risk", note: "Reduce incoming pressure", icon: "◇" },
  ];
  return (
    <div className="battle-screen">
      <div className="battle-skyline" />
      <header><span>BROKERAGE NEGOTIATION</span><b>TURN {battle.state.turn}</b></header>
      <section className="opponent-stage">
        <div className="battle-stat rival-stat"><span>{battle.opponent}</span><small>{battle.subtitle}</small><ProgressBar value={battle.state.rivalResolve} tone="red" /><b>RESOLVE {battle.state.rivalResolve}/100</b></div>
        <div className="rival-sprite"><Sprite variant={battle.kind === "rival" ? "rival" : "client"} accent={battle.kind === "rival" ? "red" : "violet"} /></div>
        <div className="battle-desk"><i /><span>CLIENT BOOK</span></div>
      </section>
      <section className="player-stage">
        <div className="player-battle-sprite"><Sprite variant="player" accent="blue" /></div>
        <div className="battle-stat"><span>SHY BULL</span><small>LEDGER & CO. · {battle.state.insight} INSIGHT · {battle.state.hedge} HEDGE</small><ProgressBar value={battle.state.playerConfidence} /><b>CONFIDENCE {battle.state.playerConfidence}/100</b></div>
      </section>
      <section className="battle-command">
        <div className="battle-line">
          <p>{battle.outcome === "won" ? "The mandate is yours. Your clean execution wins the room." : battle.outcome === "lost" ? "The room goes quiet. Reset the book and try a different approach." : battle.line}</p>
          <span>{battle.outcome ? (battle.outcome === "won" ? "NEGOTIATION WON" : "NEGOTIATION LOST") : "Choose your move"}</span>
        </div>
        {battle.outcome ? (
          <button className="battle-continue" onClick={onClose}>{battle.outcome === "won" ? "COLLECT REWARDS" : "RETURN TO STREET"} ›</button>
        ) : (
          <div className="action-grid">
            {actions.map((action) => <button key={action.id} onClick={() => onAction(action.id)}><i>{action.icon}</i><span><b>{action.name}</b><small>{action.note}</small></span></button>)}
          </div>
        )}
      </section>
    </div>
  );
}
