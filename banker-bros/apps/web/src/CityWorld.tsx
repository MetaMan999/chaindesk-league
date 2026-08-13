import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

type Point = { x: number; y: number };
type Citizen = Point & {
  id: number;
  homeX: number;
  homeY: number;
  phase: number;
  speed: number;
  skin: string;
  suit: string;
};

type CityJob = Point & {
  id: string;
  name: string;
  building: string;
  district: string;
  description: string;
  color: string;
  height: number;
  xp: number;
  credits: number;
  reputation: number;
};

type Progress = {
  credits: number;
  xp: number;
  reputation: number;
  jobsCompleted: number;
  history: string[];
};

type RemotePlayer = Point & {
  address: string;
  tokenId: number;
  district: string;
  xp: number;
  reputation: number;
  jobsCompleted: number;
};

type LeaderEntry = {
  rank: number;
  address: string;
  tokenId: number;
  district: string;
  xp: number;
  reputation: number;
  jobsCompleted: number;
};

const WORLD_SIZE = 36;
const TILE_X = 32;
const TILE_Y = 16;
const STORAGE_KEY = "banker-bros-city-progress-v1";
const MISSION_COOLDOWN_MS = 15_000;
const REQUEST_TIMEOUT_MS = 8_000;

const jobs: CityJob[] = [
  { id: "exchange", name: "Route Test Swap", building: "Grand Exchange", district: "Old Exchange", description: "Match a simulated ETH / TEST USD order.", color: "#baff52", x: 9, y: 8, height: 94, xp: 40, credits: 85, reputation: 2 },
  { id: "deal", name: "Settle City Deal", building: "Deal Desk", district: "Neon Heights", description: "Review and settle a training broker-to-broker deal.", color: "#66efbd", x: 24, y: 8, height: 72, xp: 55, credits: 110, reputation: 3 },
  { id: "liquidity", name: "Balance Test Pool", building: "Liquidity Lab", district: "Market Gardens", description: "Rebalance a simulated two-asset liquidity position.", color: "#55bfff", x: 10, y: 25, height: 80, xp: 70, credits: 140, reputation: 4 },
  { id: "audit", name: "Audit the Books", building: "City Treasury", district: "Ledger Square", description: "Verify a training commission ledger balances.", color: "#ffc557", x: 24, y: 25, height: 105, xp: 65, credits: 125, reputation: 5 },
  { id: "wharf", name: "Clear Wharf Orders", building: "Degen Wharf", district: "Degen Wharf", description: "Clear a batch of volatile test-token orders.", color: "#ff77b7", x: 30, y: 16, height: 64, xp: 80, credits: 155, reputation: 3 },
];

const districts = [
  { name: "Old Exchange", x: 9, y: 10, color: "#baff52" },
  { name: "Neon Heights", x: 24, y: 9, color: "#66efbd" },
  { name: "Market Gardens", x: 10, y: 25, color: "#55bfff" },
  { name: "Ledger Square", x: 24, y: 25, color: "#ffc557" },
  { name: "Degen Wharf", x: 30, y: 17, color: "#ff77b7" },
];

const levelNames = ["Folding Desk", "Strip Mall", "Downtown", "Trading Floor", "Regional Bank", "Glass Tower"];
const levelThresholds = [0, 100, 500, 1_500, 4_000, 10_000];

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 9283.31 + salt * 77.17) * 43758.5453;
  return value - Math.floor(value);
}

function makeCitizens(): Citizen[] {
  const skins = ["#f2c9a5", "#dca57c", "#b97754", "#8c563c", "#613723", "#f0b98f"];
  const suits = ["#142d48", "#243d35", "#43283e", "#3c3c46", "#583226", "#1c4c55"];
  return Array.from({ length: 222 }, (_, index) => {
    const id = index + 1;
    const homeX = 2 + seeded(id, 1) * (WORLD_SIZE - 4);
    const homeY = 2 + seeded(id, 2) * (WORLD_SIZE - 4);
    return {
      id,
      x: homeX,
      y: homeY,
      homeX,
      homeY,
      phase: seeded(id, 3) * Math.PI * 2,
      speed: 0.28 + seeded(id, 4) * 0.3,
      skin: skins[Math.floor(seeded(id, 5) * skins.length)]!,
      suit: suits[Math.floor(seeded(id, 6) * suits.length)]!,
    };
  });
}

function loadProgress(): Progress {
  const initial = { credits: 250, xp: 0, reputation: 1, jobsCompleted: 0, history: ["Entered Liquidity City"] };
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? sanitizeProgress(JSON.parse(saved), initial.history) : initial;
  } catch {
    return initial;
  }
}

function finiteCounter(value: unknown, fallback: number, maximum = 1_000_000_000) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : fallback;
}

function sanitizeProgress(value: unknown, fallbackHistory: string[] = []): Progress {
  const data = value && typeof value === "object" ? value as Partial<Progress> : {};
  return {
    credits: finiteCounter(data.credits, 250),
    xp: finiteCounter(data.xp, 0),
    reputation: finiteCounter(data.reputation, 1),
    jobsCompleted: finiteCounter(data.jobsCompleted, 0),
    history: Array.isArray(data.history) ? data.history.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 120)).slice(0, 5) : fallbackHistory,
  };
}

function safeRemotePlayers(value: unknown): RemotePlayer[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RemotePlayer => Boolean(item && typeof item === "object" && typeof item.address === "string" && /^0x[0-9a-fA-F]{40}$/.test(item.address) && Number.isFinite(item.x) && Number.isFinite(item.y) && Number.isInteger(item.tokenId) && item.tokenId >= 1 && item.tokenId <= 222 && typeof item.district === "string")).slice(0, 222);
}

function safeLeaderboard(value: unknown): LeaderEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is LeaderEntry => Boolean(item && typeof item === "object" && typeof item.address === "string" && /^0x[0-9a-fA-F]{40}$/.test(item.address) && Number.isInteger(item.rank) && Number.isInteger(item.tokenId) && item.tokenId >= 1 && item.tokenId <= 222 && Number.isFinite(item.xp))).slice(0, 25);
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  let result: Record<string, unknown> = {};
  try { result = await response.json() as Record<string, unknown>; } catch { if (response.ok) throw new Error("invalid_server_response"); }
  if (!response.ok) {
    const error = new Error(typeof result.error === "string" ? result.error : `request_failed_${response.status}`);
    Object.assign(error, result, { status: response.status });
    throw error;
  }
  return result;
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x - width, y);
  ctx.closePath();
}

export function CityWorld({ activeTokenId }: { activeTokenId: number }) {
  const realtimeBase = (import.meta.env.VITE_REALTIME_URL ?? "").replace(/\/$/, "");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const citizens = useMemo(makeCitizens, []);
  const player = useRef<Point>({ x: 18, y: 18 });
  const moveTarget = useRef<Point | null>(null);
  const keys = useRef(new Set<string>());
  const dimensions = useRef({ width: 900, height: 620, dpr: 1 });
  const nearbyJob = useRef<CityJob | null>(null);
  const remotePlayers = useRef<RemotePlayer[]>([]);
  const syncInFlight = useRef(false);
  const offlineCooldowns = useRef(new Map<string, number>());
  const [nearby, setNearby] = useState<CityJob | null>(null);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [message, setMessage] = useState("Walk to a highlighted building and complete your first job.");
  const [started, setStarted] = useState(false);
  const [population, setPopulation] = useState(222);
  const [sessionToken, setSessionToken] = useState("");
  const [multiplayerStatus, setMultiplayerStatus] = useState<"offline" | "connecting" | "online" | "error">("offline");
  const [onlineCount, setOnlineCount] = useState(0);
  const [currentDistrict, setCurrentDistrict] = useState("Old Exchange");
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [sessionAddress, setSessionAddress] = useState("");
  const [working, setWorking] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending: signingIn } = useSignMessage();
  const selectedTokenId = Number.isInteger(activeTokenId) ? Math.max(1, Math.min(222, activeTokenId)) : 1;

  const level = levelThresholds.reduce((result, threshold, index) => progress.xp >= threshold ? index : result, 0);
  const nextLevelXp = levelThresholds[Math.min(level + 1, levelThresholds.length - 1)]!;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setTimeout(() => setCooldownUntil(0), cooldownUntil - Date.now() + 50);
    return () => window.clearTimeout(timer);
  }, [cooldownUntil]);

  const leaveMultiplayer = useCallback(() => {
    setSessionToken("");
    setSessionAddress("");
    remotePlayers.current = [];
    setOnlineCount(0);
    setLeaderboard([]);
    setMultiplayerStatus("offline");
    setMessage("Left the shared room. Offline training remains available.");
  }, []);

  const completeJob = useCallback(async () => {
    const job = nearbyJob.current;
    if (!job) {
      setMessage("Move closer to a glowing job building first.");
      return;
    }
    if (working || cooldownUntil > Date.now()) {
      setMessage(`Mission cooling down for ${Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000))}s.`);
      return;
    }
    setWorking(true);
    if (sessionToken && realtimeBase) {
      try {
        const presence = await fetchJson(`${realtimeBase}/presence`, {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(player.current),
        });
        if (presence.player && typeof presence.player === "object") {
          const authoritative = presence.player as RemotePlayer;
          player.current = { x: authoritative.x, y: authoritative.y };
        }
        const result = await fetchJson(`${realtimeBase}/missions/complete`, {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ missionId: job.id }),
        });
        setProgress((current) => ({ ...sanitizeProgress(result.progress), history: [`${job.name} · server verified`, ...current.history].slice(0, 5) }));
        setLeaderboard(safeLeaderboard(result.leaderboard));
        setCooldownUntil(Date.now() + MISSION_COOLDOWN_MS);
        setMessage(`${job.name} verified by the city server. No onchain assets moved.`);
        return;
      } catch (missionError) {
        const retryAfterMs = typeof (missionError as { retryAfterMs?: unknown })?.retryAfterMs === "number" ? (missionError as { retryAfterMs: number }).retryAfterMs : 0;
        if (retryAfterMs > 0) setCooldownUntil(Date.now() + retryAfterMs);
        if ((missionError as { status?: number })?.status === 401) leaveMultiplayer();
        setMessage(missionError instanceof Error ? missionError.message.replaceAll("_", " ") : "The city server rejected this mission.");
        return;
      } finally {
        setWorking(false);
      }
    }
    const readyAt = offlineCooldowns.current.get(job.id) ?? 0;
    if (readyAt > Date.now()) {
      setCooldownUntil(readyAt);
      setMessage(`Mission cooling down for ${Math.ceil((readyAt - Date.now()) / 1000)}s.`);
      setWorking(false);
      return;
    }
    const nextReadyAt = Date.now() + MISSION_COOLDOWN_MS;
    offlineCooldowns.current.set(job.id, nextReadyAt);
    setCooldownUntil(nextReadyAt);
    setProgress((current) => ({ credits: current.credits + job.credits, xp: current.xp + job.xp, reputation: current.reputation + job.reputation, jobsCompleted: current.jobsCompleted + 1, history: [`${job.name} · +${job.xp} XP`, ...current.history].slice(0, 5) }));
    setMessage(`${job.name} complete in offline training mode. No assets moved.`);
    setWorking(false);
  }, [cooldownUntil, leaveMultiplayer, realtimeBase, sessionToken, working]);

  const joinMultiplayer = useCallback(async () => {
    if (!realtimeBase || !address) {
      setMessage(realtimeBase ? "Connect your wallet before joining multiplayer." : "Configure VITE_REALTIME_URL to enable multiplayer.");
      return;
    }
    setMultiplayerStatus("connecting");
    try {
      const challenge = await fetchJson(`${realtimeBase}/auth/challenge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, tokenId: selectedTokenId }) });
      if (typeof challenge.message !== "string") throw new Error("invalid_login_challenge");
      const signature = await signMessageAsync({ message: challenge.message });
      const verified = await fetchJson(`${realtimeBase}/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, tokenId: selectedTokenId, signature }) });
      if (typeof verified.token !== "string") throw new Error("invalid_session_response");
      setSessionToken(verified.token);
      setSessionAddress(address);
      const verifiedPlayer = safeRemotePlayers(verified.player ? [verified.player] : [])[0];
      if (verifiedPlayer) {
        player.current = { x: verifiedPlayer.x, y: verifiedPlayer.y };
        setCurrentDistrict(verifiedPlayer.district);
      }
      setProgress((current) => ({ ...sanitizeProgress(verified.progress), history: ["Joined authenticated multiplayer", ...current.history].slice(0, 5) }));
      setMultiplayerStatus("online");
      setMessage("Wallet verified. You are now visible in the shared district room.");
    } catch (joinError) {
      setMultiplayerStatus("error");
      setMessage(joinError instanceof Error ? joinError.message.replaceAll("_", " ") : "Could not join multiplayer.");
    }
  }, [address, realtimeBase, selectedTokenId, signMessageAsync]);

  useEffect(() => {
    if (sessionToken && (!isConnected || !address || address.toLowerCase() !== sessionAddress.toLowerCase())) leaveMultiplayer();
  }, [address, isConnected, leaveMultiplayer, sessionAddress, sessionToken]);

  useEffect(() => {
    if (!sessionToken || !realtimeBase) return;
    const controller = new AbortController();
    const connectStream = async () => {
      let retry = 0;
      while (!controller.signal.aborted) {
        try {
          const response = await fetch(`${realtimeBase}/events`, { headers: { Authorization: `Bearer ${sessionToken}` }, signal: controller.signal });
          if (response.status === 401) { leaveMultiplayer(); return; }
          if (!response.ok || !response.body) throw new Error("presence_stream_failed");
          setMultiplayerStatus("online");
          retry = 0;
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) throw new Error("presence_stream_closed");
            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split("\n\n");
            buffer = blocks.pop() ?? "";
            for (const block of blocks) {
              const event = block.split("\n").find((line) => line.startsWith("event: "))?.slice(7);
              const raw = block.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
              if (!event || !raw) continue;
              const data = JSON.parse(raw) as Record<string, unknown>;
              if (event === "snapshot") {
                remotePlayers.current = safeRemotePlayers(data.players).filter((item) => item.address.toLowerCase() !== address?.toLowerCase());
                setLeaderboard(safeLeaderboard(data.leaderboard));
                setOnlineCount(finiteCounter(data.online, 0, 222));
              }
              if (event === "presence") {
                if (data.type === "leave") {
                  const departingTokenId = finiteCounter(data.tokenId, 0, 222);
                  remotePlayers.current = remotePlayers.current.filter((item) => departingTokenId ? item.tokenId !== departingTokenId : item.address !== data.address);
                }
                const incoming = safeRemotePlayers(data.player ? [data.player] : [])[0];
                if (incoming && incoming.address.toLowerCase() !== address?.toLowerCase()) remotePlayers.current = [...remotePlayers.current.filter((item) => item.address !== incoming.address), incoming];
                setOnlineCount(finiteCounter(data.online, 0, 222));
              }
              if (event === "mission") setLeaderboard(safeLeaderboard(data.leaderboard));
            }
          }
        } catch (streamError) {
          if (controller.signal.aborted) return;
          retry += 1;
          setMultiplayerStatus("error");
          setMessage(`Connection interrupted. Reconnecting${".".repeat(Math.min(3, retry))}`);
          await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(10_000, 750 * 2 ** Math.min(retry, 4))));
        }
      }
    };
    void connectStream();
    return () => controller.abort();
  }, [address, leaveMultiplayer, realtimeBase, sessionToken]);

  useEffect(() => {
    if (!sessionToken || !realtimeBase) return;
    const syncPresence = async () => {
      if (syncInFlight.current) return;
      syncInFlight.current = true;
      try {
        const result = await fetchJson(`${realtimeBase}/presence`, { method: "POST", headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" }, body: JSON.stringify(player.current) });
        const authoritative = safeRemotePlayers(result.player ? [result.player] : [])[0];
        if (authoritative && result.districtChanged) {
          player.current = { x: authoritative.x, y: authoritative.y };
          setCurrentDistrict(authoritative.district);
          remotePlayers.current = safeRemotePlayers(result.players).filter((item) => item.address.toLowerCase() !== address?.toLowerCase());
          setLeaderboard(safeLeaderboard(result.leaderboard));
        }
      } catch (syncError) {
        const status = (syncError as { status?: number }).status;
        const authoritative = safeRemotePlayers((syncError as { player?: unknown }).player ? [(syncError as { player: unknown }).player] : [])[0];
        if (authoritative) player.current = { x: authoritative.x, y: authoritative.y };
        if (status === 401) leaveMultiplayer();
      } finally {
        syncInFlight.current = false;
      }
    };
    const timer = window.setInterval(() => void syncPresence(), 700);
    void syncPresence();
    return () => window.clearInterval(timer);
  }, [address, leaveMultiplayer, realtimeBase, sessionToken]);

  const nudge = useCallback((dx: number, dy: number) => {
    player.current.x = Math.max(1, Math.min(WORLD_SIZE - 1, player.current.x + dx));
    player.current.y = Math.max(1, Math.min(WORLD_SIZE - 1, player.current.y + dy));
    moveTarget.current = null;
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(key)) {
        event.preventDefault();
        keys.current.add(key);
        setStarted(true);
      }
      if (key === "e" && !event.repeat) { event.preventDefault(); void completeJob(); }
      if (key === "escape") { moveTarget.current = null; keys.current.clear(); }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [completeJob]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dimensions.current = { width: box.width, height: box.height, dpr };
      canvas.width = Math.max(1, Math.round(box.width * dpr));
      canvas.height = Math.max(1, Math.round(box.height * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let lastTime = performance.now();
    let uiTimer = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const project = (point: Point, camera: Point, z = 0) => ({
      x: (point.x - point.y) * TILE_X - camera.x + dimensions.current.width / 2,
      y: (point.x + point.y) * TILE_Y - camera.y + dimensions.current.height / 2 - z,
    });

    const render = (time: number) => {
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      const speed = 6.2 * delta;
      let dx = 0;
      let dy = 0;
      if (keys.current.has("w") || keys.current.has("arrowup")) { dx -= 1; dy -= 1; }
      if (keys.current.has("s") || keys.current.has("arrowdown")) { dx += 1; dy += 1; }
      if (keys.current.has("a") || keys.current.has("arrowleft")) { dx -= 1; dy += 1; }
      if (keys.current.has("d") || keys.current.has("arrowright")) { dx += 1; dy -= 1; }
      if (dx || dy) {
        const length = Math.hypot(dx, dy);
        player.current.x += dx / length * speed;
        player.current.y += dy / length * speed;
        moveTarget.current = null;
      } else if (moveTarget.current) {
        const tx = moveTarget.current.x - player.current.x;
        const ty = moveTarget.current.y - player.current.y;
        const distance = Math.hypot(tx, ty);
        if (distance < 0.12) moveTarget.current = null;
        else {
          player.current.x += tx / distance * speed;
          player.current.y += ty / distance * speed;
        }
      }
      player.current.x = Math.max(1, Math.min(WORLD_SIZE - 1, player.current.x));
      player.current.y = Math.max(1, Math.min(WORLD_SIZE - 1, player.current.y));

      const width = dimensions.current.width;
      const height = dimensions.current.height;
      const dpr = dimensions.current.dpr;
      const camera = {
        x: (player.current.x - player.current.y) * TILE_X,
        y: (player.current.x + player.current.y) * TILE_Y,
      };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#10251c");
      gradient.addColorStop(1, "#050b08");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      for (let x = 0; x <= WORLD_SIZE; x += 1) {
        for (let y = 0; y <= WORLD_SIZE; y += 1) {
          const p = project({ x, y }, camera);
          if (p.x < -TILE_X || p.x > width + TILE_X || p.y < -TILE_Y || p.y > height + TILE_Y) continue;
          const road = x % 9 === 0 || y % 9 === 0;
          const checker = (x + y) % 2 === 0;
          diamond(ctx, p.x, p.y, TILE_X, TILE_Y);
          ctx.fillStyle = road ? (checker ? "#1d2d27" : "#192721") : (checker ? "#173626" : "#143021");
          ctx.fill();
          ctx.strokeStyle = road ? "rgba(189,255,81,.09)" : "rgba(112,245,192,.035)";
          ctx.stroke();
        }
      }

      type Drawable = { depth: number; draw: () => void };
      const drawables: Drawable[] = [];

      for (const job of jobs) {
        drawables.push({
          depth: job.x + job.y,
          draw: () => {
            const base = project(job, camera);
            const halfW = 54;
            const halfH = 27;
            const topY = base.y - job.height;
            ctx.beginPath();
            ctx.moveTo(base.x, topY - halfH);
            ctx.lineTo(base.x + halfW, topY);
            ctx.lineTo(base.x, topY + halfH);
            ctx.lineTo(base.x - halfW, topY);
            ctx.closePath();
            ctx.fillStyle = job.color;
            ctx.globalAlpha = .9;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.moveTo(base.x - halfW, topY);
            ctx.lineTo(base.x, topY + halfH);
            ctx.lineTo(base.x, base.y + halfH);
            ctx.lineTo(base.x - halfW, base.y);
            ctx.closePath();
            ctx.fillStyle = "#0c1b14";
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(base.x + halfW, topY);
            ctx.lineTo(base.x, topY + halfH);
            ctx.lineTo(base.x, base.y + halfH);
            ctx.lineTo(base.x + halfW, base.y);
            ctx.closePath();
            ctx.fillStyle = "#142b20";
            ctx.fill();
            ctx.strokeStyle = job.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            for (let floor = 18; floor < job.height - 8; floor += 18) {
              ctx.fillStyle = job.color;
              ctx.globalAlpha = .48;
              ctx.fillRect(base.x - 33, base.y - floor, 12, 5);
              ctx.fillRect(base.x + 20, base.y - floor, 12, 5);
            }
            ctx.globalAlpha = 1;
            ctx.font = "600 10px 'DM Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillStyle = "#efffe8";
            ctx.fillText(job.building.toUpperCase(), base.x, topY - 37);
            ctx.font = "8px 'DM Mono', monospace";
            ctx.fillStyle = job.color;
            ctx.fillText(job.district.toUpperCase(), base.x, topY - 24);
          },
        });
      }

      citizens.slice(0, population).forEach((citizen) => {
        const angle = (reduceMotion ? 0 : time / 1000 * citizen.speed) + citizen.phase;
        citizen.x = Math.max(1, Math.min(WORLD_SIZE - 1, citizen.homeX + Math.cos(angle) * 1.25));
        citizen.y = Math.max(1, Math.min(WORLD_SIZE - 1, citizen.homeY + Math.sin(angle * .83) * 1.25));
        drawables.push({
          depth: citizen.x + citizen.y,
          draw: () => {
            const p = project(citizen, camera);
            if (p.x < -25 || p.x > width + 25 || p.y < -45 || p.y > height + 25) return;
            ctx.fillStyle = "rgba(0,0,0,.25)";
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + 4, 9, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = citizen.suit;
            ctx.fillRect(p.x - 5, p.y - 20, 10, 16);
            ctx.fillStyle = citizen.skin;
            ctx.fillRect(p.x - 4, p.y - 28, 8, 8);
            ctx.fillStyle = "#101814";
            ctx.fillRect(p.x - 4, p.y - 30, 8, 3);
          },
        });
      });

      remotePlayers.current.forEach((remote) => {
        drawables.push({
          depth: remote.x + remote.y + .05,
          draw: () => {
            const p = project(remote, camera);
            if (p.x < -35 || p.x > width + 35 || p.y < -55 || p.y > height + 35) return;
            ctx.fillStyle = "rgba(83,196,255,.22)";
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + 5, 15, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#55bfff";
            ctx.stroke();
            ctx.fillStyle = "#1a6f91";
            ctx.fillRect(p.x - 6, p.y - 27, 12, 21);
            ctx.fillStyle = "#dca57c";
            ctx.fillRect(p.x - 5, p.y - 37, 10, 10);
            ctx.font = "700 8px 'DM Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillStyle = "#8bdcff";
            ctx.fillText(`#${remote.tokenId} · ${remote.address.slice(0, 6)}…${remote.address.slice(-4)}`, p.x, p.y - 44);
          },
        });
      });

      drawables.push({
        depth: player.current.x + player.current.y + .1,
        draw: () => {
          const p = project(player.current, camera);
          ctx.fillStyle = "rgba(189,255,81,.22)";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + 5, 17, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#bdff51";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "#bdff51";
          ctx.fillRect(p.x - 7, p.y - 28, 14, 23);
          ctx.fillStyle = "#dca57c";
          ctx.fillRect(p.x - 6, p.y - 39, 12, 11);
          ctx.fillStyle = "#07110d";
          ctx.fillRect(p.x - 6, p.y - 41, 12, 4);
          ctx.font = "700 9px 'DM Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "#efffe8";
          ctx.fillText(`YOU · #${selectedTokenId}`, p.x, p.y - 48);
        },
      });
      drawables.sort((a, b) => a.depth - b.depth).forEach((item) => item.draw());

      const closest = jobs.reduce<CityJob | null>((result, job) => {
        const distance = Math.hypot(job.x - player.current.x, job.y - player.current.y);
        if (distance > 2.4) return result;
        if (!result) return job;
        return distance < Math.hypot(result.x - player.current.x, result.y - player.current.y) ? job : result;
      }, null);
      nearbyJob.current = closest;
      uiTimer += delta;
      if (uiTimer > .15) {
        uiTimer = 0;
        setNearby((current) => current?.id === closest?.id ? current : closest);
        const detectedDistrict = districts.reduce((result, district) => Math.hypot(district.x - player.current.x, district.y - player.current.y) < Math.hypot(result.x - player.current.x, result.y - player.current.y) ? district : result, districts[0]!).name;
        setCurrentDistrict((current) => current === detectedDistrict ? current : detectedDistrict);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [activeTokenId, citizens, population]);

  const clickWorld = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const sx = event.clientX - box.left;
    const sy = event.clientY - box.top;
    const cameraX = (player.current.x - player.current.y) * TILE_X;
    const cameraY = (player.current.x + player.current.y) * TILE_Y;
    const isoX = sx - box.width / 2 + cameraX;
    const isoY = sy - box.height / 2 + cameraY;
    const x = (isoY / TILE_Y + isoX / TILE_X) / 2;
    const y = (isoY / TILE_Y - isoX / TILE_X) / 2;
    moveTarget.current = { x: Math.max(1, Math.min(WORLD_SIZE - 1, x)), y: Math.max(1, Math.min(WORLD_SIZE - 1, y)) };
    setStarted(true);
  };

  const travel = async (point: Point, name: string) => {
    const previousPosition = { ...player.current };
    const previousDistrict = currentDistrict;
    player.current = { ...point };
    moveTarget.current = null;
    setStarted(true);
    setCurrentDistrict(name);
    remotePlayers.current = [];
    if (sessionToken && realtimeBase) {
      try {
        const result = await fetchJson(`${realtimeBase}/travel`, { method: "POST", headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ district: name }) });
        remotePlayers.current = safeRemotePlayers(result.players).filter((item) => item.address.toLowerCase() !== address?.toLowerCase());
        setLeaderboard(safeLeaderboard(result.leaderboard));
      } catch (travelError) {
        player.current = previousPosition;
        setCurrentDistrict(previousDistrict);
        setMessage(travelError instanceof Error ? travelError.message.replaceAll("_", " ") : "Shared travel failed.");
        return;
      }
    }
    setMessage(`Arrived in ${name}. Find the glowing building and press E.`);
  };

  const resetProgress = () => {
    const reset = { credits: 250, xp: 0, reputation: 1, jobsCompleted: 0, history: ["Progress reset"] };
    setProgress(reset);
    player.current = { x: 18, y: 18 };
    setMessage("Training progress reset. Welcome back to Liquidity City.");
  };

  return (
    <section id="world" className="city-world">
      <div className="world-heading">
        <div><p className="eyebrow">LIVE TRAINING WORLD / 222</p><h2>ENTER LIQUIDITY CITY</h2></div>
        <p>All 222 Banker Bros are represented in one performant city simulation. Walk, travel, complete jobs, and build your brokerage profile before using testnet contracts.</p>
      </div>
      <div className="world-shell">
        <div className="world-stage">
          <canvas ref={canvasRef} onClick={clickWorld} aria-label="Playable isometric Liquidity City with 222 Banker Bros. Use W A S D or arrow keys to move and E to work." />
          {!started && <button className="enter-world" onClick={() => setStarted(true)}><span>SEASON 01</span>ENTER THE CITY<small>WASD / ARROWS / CLICK TO MOVE</small></button>}
          <div className="world-status"><i/><b>{population} CITIZENS · {onlineCount} PLAYERS ONLINE</b><span>{multiplayerStatus === "online" ? currentDistrict.toUpperCase() : sessionToken ? "RECONNECTING" : "OFFLINE TRAINING"}</span></div>
          <div className="world-controls"><span>MOVE · WASD / ARROWS</span><div><button aria-label="Move up" onClick={() => nudge(-.7, -.7)}>↑</button><button aria-label="Move left" onClick={() => nudge(-.7, .7)}>←</button><button aria-label="Move down" onClick={() => nudge(.7, .7)}>↓</button><button aria-label="Move right" onClick={() => nudge(.7, -.7)}>→</button></div><button className="work-key" onClick={() => void completeJob()} disabled={!nearby || working || cooldownUntil > Date.now()}>{working ? "WORKING…" : cooldownUntil > Date.now() ? "COOLDOWN" : "E · WORK"}</button></div>
          {nearby && <div className="nearby-prompt"><span>JOB NEARBY</span><strong>{nearby.name}</strong><small>PRESS E OR TAP WORK · +{nearby.xp} XP</small></div>}
        </div>
        <aside className="city-hud">
          <div className={`multiplayer-card ${multiplayerStatus}`}><span>SHARED CITY / 222 CAP</span><strong>{multiplayerStatus === "online" ? `${onlineCount} PLAYERS ONLINE` : multiplayerStatus === "connecting" ? "VERIFYING WALLET…" : multiplayerStatus === "error" ? "RECONNECTING…" : "MULTIPLAYER OFFLINE"}</strong><p>A signature proves wallet and Banker Bro control. It does not send a transaction or move assets.</p>{sessionToken ? <button onClick={leaveMultiplayer}>LEAVE SHARED ROOM</button> : <button onClick={() => void joinMultiplayer()} disabled={!isConnected || !realtimeBase || signingIn}>{!realtimeBase ? "ADD REALTIME URL" : !isConnected ? "CONNECT WALLET FIRST" : signingIn ? "SIGNING…" : "JOIN MULTIPLAYER"}</button>}</div>
          <div className="hud-profile"><span>BANKER BRO</span><strong>#{selectedTokenId}</strong><small>{levelNames[level]}</small></div>
          <div className="hud-stats"><div><span>CITY CREDITS</span><b>{progress.credits.toLocaleString()}</b></div><div><span>REPUTATION</span><b>{progress.reputation}</b></div><div><span>JOBS DONE</span><b>{progress.jobsCompleted}</b></div><div><span>XP</span><b>{progress.xp}</b></div></div>
          <div className="xp-meter"><span style={{ width: `${level === levelThresholds.length - 1 ? 100 : Math.min(100, progress.xp / nextLevelXp * 100)}%` }}/></div>
          <div className="district-map"><h3>FAST TRAVEL</h3>{districts.map((district) => <button key={district.name} onClick={() => travel(district, district.name)}><i style={{ background: district.color }}/><span>{district.name}</span><b>GO ↗</b></button>)}</div>
          <div className="job-card"><span>{nearby ? nearby.district : "CITY DISPATCH"}</span><strong>{nearby?.name ?? "Find a glowing office"}</strong><p>{message}</p>{nearby && <button onClick={() => void completeJob()} disabled={working || cooldownUntil > Date.now()}>{working ? "VERIFYING…" : cooldownUntil > Date.now() ? "MISSION COOLDOWN" : "COMPLETE TRAINING JOB"}</button>}</div>
          <div className="activity-feed"><h3>ACTIVITY</h3>{progress.history.map((item, index) => <p key={`${item}-${index}`}><i/>{item}</p>)}</div>
          <div className="live-leaderboard"><h3>{currentDistrict.toUpperCase()} LEADERBOARD</h3>{leaderboard.slice(0, 5).map((entry) => <p key={`${entry.address}-${entry.tokenId}`}><b>{entry.rank}</b><span>#{entry.tokenId} · {entry.address.slice(0, 6)}…{entry.address.slice(-4)}</span><strong>{entry.xp} XP</strong></p>)}{!leaderboard.length && <small>Join multiplayer to load live standings.</small>}</div>
          <div className="world-options"><button onClick={() => setPopulation((current) => current === 222 ? 72 : 222)}>{population === 222 ? "PERFORMANCE MODE" : "LOAD ALL 222"}</button><button onClick={resetProgress} disabled={Boolean(sessionToken)}>RESET OFFLINE TRAINING</button></div>
          <p className="simulation-note">Offline progress is saved locally. Shared City progress is server-validated. Neither is a token, money, yield, or transferable value; testnet contract actions require separate wallet confirmation.</p>
        </aside>
      </div>
    </section>
  );
}
