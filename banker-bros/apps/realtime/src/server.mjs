import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname } from "node:path";

const PORT = Number(process.env.REALTIME_PORT ?? 8787);
const HOST = process.env.REALTIME_HOST ?? "127.0.0.1";
const SESSION_SECRET = process.env.REALTIME_SESSION_SECRET ?? "development-only-change-me";
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173").split(",").map((value) => value.trim()).filter(Boolean));
const AUTH_DOMAIN = process.env.REALTIME_AUTH_DOMAIN ?? "localhost";
const AUTH_URI = process.env.REALTIME_AUTH_URI ?? "http://localhost:5173";
const AUTH_CHAIN_ID = Number(process.env.CHAIN_ID ?? 46630);
const REQUIRE_NFT_OWNERSHIP = process.env.REALTIME_REQUIRE_NFT_OWNERSHIP === "true";
const IDENTITY_COLLECTION = process.env.BROKER_IDENTITY_NFT ?? "";
const OWNERSHIP_RPC_URL = process.env.REALTIME_RPC_URL ?? process.env.TESTNET_RPC_URL ?? "";
const TRUST_PROXY = process.env.REALTIME_TRUST_PROXY === "true";
const DATA_FILE = (process.env.REALTIME_DATA_FILE ?? "").trim();
const SESSION_TTL_MS = 15 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PLAYER_TTL_MS = 75 * 1000;
const MAX_PLAYERS = 222;
const MAX_PROFILES = MAX_PLAYERS;
const MAX_CHALLENGES = 5_000;
const MAX_RATE_BUCKETS = 10_000;
const MAX_BODY_BYTES = 16_384;
const MAX_SPEED = 8;
const SERVICE_AUDIENCE = "banker-bros-shared-city";
const SERVICE_ISSUER = `${AUTH_DOMAIN}|${AUTH_CHAIN_ID}`;

const ownerOfAbi = [{ type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "owner", type: "address" }] }];
let viemPromise;
let ownershipClient;

function isAddress(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function getAddress(value) {
  if (!isAddress(value)) throw new Error("invalid address");
  return value.toLowerCase();
}

function loadViem() {
  viemPromise ??= import("viem");
  return viemPromise;
}

const districts = {
  "Old Exchange": { x: 9, y: 10 },
  "Neon Heights": { x: 24, y: 9 },
  "Market Gardens": { x: 10, y: 25 },
  "Ledger Square": { x: 24, y: 25 },
  "Degen Wharf": { x: 30, y: 17 },
};

const missions = {
  exchange: { x: 9, y: 8, district: "Old Exchange", name: "Route Test Swap", xp: 40, credits: 85, reputation: 2, cooldownMs: 15_000 },
  deal: { x: 24, y: 8, district: "Neon Heights", name: "Settle City Deal", xp: 55, credits: 110, reputation: 3, cooldownMs: 15_000 },
  liquidity: { x: 10, y: 25, district: "Market Gardens", name: "Balance Test Pool", xp: 70, credits: 140, reputation: 4, cooldownMs: 15_000 },
  audit: { x: 24, y: 25, district: "Ledger Square", name: "Audit the Books", xp: 65, credits: 125, reputation: 5, cooldownMs: 15_000 },
  wharf: { x: 30, y: 16, district: "Degen Wharf", name: "Clear Wharf Orders", xp: 80, credits: 155, reputation: 3, cooldownMs: 15_000 },
};

const challenges = new Map();
const players = new Map();
const streams = new Map();
const rateBuckets = new Map();

const sharedBinding = !["127.0.0.1", "localhost", "::1"].includes(HOST);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) throw new Error("REALTIME_PORT must be a valid TCP port");
if (!Number.isSafeInteger(AUTH_CHAIN_ID) || AUTH_CHAIN_ID < 1) throw new Error("CHAIN_ID must be a positive integer");
if (AUTH_DOMAIN.includes("\n") || AUTH_DOMAIN.includes("\r")) throw new Error("REALTIME_AUTH_DOMAIN is invalid");
let parsedAuthUri;
try { parsedAuthUri = new URL(AUTH_URI); } catch { throw new Error("REALTIME_AUTH_URI must be an absolute URL"); }
if (process.env.NODE_ENV !== "test" && sharedBinding) {
  if (SESSION_SECRET === "development-only-change-me" || SESSION_SECRET.length < 32) throw new Error("REALTIME_SESSION_SECRET must contain at least 32 characters before binding a shared interface");
  if (ALLOWED_ORIGINS.has("*") || ALLOWED_ORIGINS.size === 0) throw new Error("ALLOWED_ORIGINS must contain explicit trusted origins");
  const validOrigins = [...ALLOWED_ORIGINS].every((origin) => {
    try { const parsed = new URL(origin); return parsed.protocol === "https:" && parsed.origin === origin; } catch { return false; }
  });
  if (parsedAuthUri.protocol !== "https:" || parsedAuthUri.host !== AUTH_DOMAIN || !ALLOWED_ORIGINS.has(parsedAuthUri.origin) || !validOrigins) throw new Error("Shared deployment requires matching HTTPS auth domain, URI, and allowed origins");
  if (!REQUIRE_NFT_OWNERSHIP || !isAddress(IDENTITY_COLLECTION) || !OWNERSHIP_RPC_URL) throw new Error("Shared deployment requires NFT ownership verification, a collection address, and a dedicated RPC URL");
  if (!DATA_FILE) throw new Error("Shared deployment requires REALTIME_DATA_FILE for durable player progress");
}

class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signSession(address, tokenId = 1) {
  const now = Date.now();
  const payload = encode({ v: 1, iss: SERVICE_ISSUER, aud: SERVICE_AUDIENCE, address, tokenId, iat: now, exp: now + SESSION_TTL_MS, nonce: randomBytes(12).toString("hex") });
  const signature = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSession(request) {
  const authorization = request.headers.authorization ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", SESSION_SECRET).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.toString("base64url") !== signature) return null;
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.v !== 1 || parsed.iss !== SERVICE_ISSUER || parsed.aud !== SERVICE_AUDIENCE || parsed.exp <= Date.now() || parsed.iat > Date.now() + 30_000) return null;
    if (!isAddress(parsed.address) || !Number.isInteger(parsed.tokenId) || parsed.tokenId < 1 || parsed.tokenId > 222) return null;
    return { ...parsed, address: getAddress(parsed.address) };
  } catch {
    return null;
  }
}

function cors(request, response) {
  const origin = request.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return false;
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Resource-Policy", "same-site");
  return true;
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function body(request) {
  if (!(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) throw new HttpError(415, "json_content_type_required");
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw new HttpError(413, "body_too_large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpError(400, "invalid_json"); }
}

function requestIp(request) {
  if (TRUST_PROXY) {
    const forwarded = request.headers["x-forwarded-for"];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
    if (first && first.trim().length <= 64) return first.trim();
  }
  return request.socket.remoteAddress ?? "unknown";
}

function tokenIdFrom(input) {
  const tokenId = Number(input.tokenId);
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 222) throw new HttpError(400, "invalid_token_id");
  return tokenId;
}

async function verifyTokenOwnership(address, tokenId) {
  if (!REQUIRE_NFT_OWNERSHIP) return true;
  if (!isAddress(IDENTITY_COLLECTION) || !OWNERSHIP_RPC_URL) return false;
  try {
    const { createPublicClient, http } = await loadViem();
    ownershipClient ??= createPublicClient({ transport: http(OWNERSHIP_RPC_URL) });
    const owner = await ownershipClient.readContract({ address: getAddress(IDENTITY_COLLECTION), abi: ownerOfAbi, functionName: "ownerOf", args: [BigInt(tokenId)] });
    return getAddress(owner) === getAddress(address);
  } catch {
    return false;
  }
}

function limited(key, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && rateBuckets.size >= MAX_RATE_BUCKETS) return true;
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

function publicPlayer(player) {
  return { address: player.address, tokenId: player.tokenId, x: player.x, y: player.y, district: player.district, xp: player.xp, reputation: player.reputation, jobsCompleted: player.jobsCompleted, online: player.online };
}

let persistenceTimer = null;
let persistenceDirty = false;
let persistencePromise = Promise.resolve();

function snapshotProfiles() {
  return {
    version: 1,
    writtenAt: new Date().toISOString(),
    players: [...players.values()].map((player) => ({
      address: player.address,
      tokenId: player.tokenId,
      x: player.x,
      y: player.y,
      xp: player.xp,
      credits: player.credits,
      reputation: player.reputation,
      jobsCompleted: player.jobsCompleted,
      lastSeen: player.lastSeen,
      cooldowns: Object.fromEntries(player.cooldowns),
    })),
  };
}

async function persistProfiles(force = false) {
  if (!DATA_FILE || (!persistenceDirty && !force)) return;
  persistenceDirty = false;
  const temporary = `${DATA_FILE}.tmp`;
  const payload = `${JSON.stringify(snapshotProfiles())}\n`;
  persistencePromise = persistencePromise.catch(() => undefined).then(async () => {
    await mkdir(dirname(DATA_FILE), { recursive: true });
    await writeFile(temporary, payload, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, DATA_FILE);
  });
  try {
    await persistencePromise;
  } catch (error) {
    persistenceDirty = true;
    throw error;
  }
}

function schedulePersistence() {
  if (!DATA_FILE) return;
  persistenceDirty = true;
  if (persistenceTimer) return;
  persistenceTimer = setTimeout(() => {
    persistenceTimer = null;
    persistProfiles().catch((error) => console.error("realtime_persistence_failed", error instanceof Error ? error.message : "unknown_error"));
  }, 5_000);
  persistenceTimer.unref();
}

function restoredNumber(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

async function restoreProfiles() {
  if (!DATA_FILE) return;
  try {
    const metadata = await stat(DATA_FILE);
    if (metadata.size > 10 * 1024 * 1024) throw new Error("profile snapshot exceeds 10 MiB");
    const parsed = JSON.parse(await readFile(DATA_FILE, "utf8"));
    if (parsed?.version !== 1 || !Array.isArray(parsed.players)) throw new Error("unsupported profile snapshot");
    for (const stored of parsed.players.slice(0, MAX_PROFILES)) {
      if (!isAddress(stored.address)) continue;
      const address = getAddress(stored.address);
      const tokenId = Number(stored.tokenId);
      if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 222 || players.has(tokenId)) continue;
      const x = restoredNumber(Number(stored.x), 18, 1, 35);
      const y = restoredNumber(Number(stored.y), 18, 1, 35);
      const cooldowns = new Map(Object.entries(stored.cooldowns ?? {}).filter(([missionId, readyAt]) => missions[missionId] && Number.isFinite(Number(readyAt))).map(([missionId, readyAt]) => [missionId, Number(readyAt)]));
      players.set(tokenId, {
        address,
        tokenId,
        x,
        y,
        district: districtFor(x, y),
        xp: restoredNumber(Number(stored.xp), 0, 0, Number.MAX_SAFE_INTEGER),
        credits: restoredNumber(Number(stored.credits), 250, 0, Number.MAX_SAFE_INTEGER),
        reputation: restoredNumber(Number(stored.reputation), 1, 0, Number.MAX_SAFE_INTEGER),
        jobsCompleted: restoredNumber(Number(stored.jobsCompleted), 0, 0, Number.MAX_SAFE_INTEGER),
        lastSeen: restoredNumber(Number(stored.lastSeen), Date.now(), 0, Date.now()),
        lastMoveAt: Date.now(),
        online: false,
        cooldowns,
      });
    }
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw new Error(`Unable to restore REALTIME_DATA_FILE: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function getPlayer(address, tokenId = 1) {
  const normalized = getAddress(address);
  let player = players.get(tokenId);
  if (!player) {
    if (activeCount() >= MAX_PLAYERS) return null;
    if (players.size >= MAX_PROFILES) return null;
    player = { address: normalized, tokenId, x: 18, y: 18, district: "Old Exchange", xp: 0, credits: 250, reputation: 1, jobsCompleted: 0, lastSeen: Date.now(), lastMoveAt: Date.now(), online: true, cooldowns: new Map() };
    players.set(tokenId, player);
  } else {
    if (!player.online && activeCount() >= MAX_PLAYERS) return null;
    if (player.online && player.address !== normalized) return null;
    player.address = normalized;
  }
  player.lastSeen = Date.now();
  player.online = true;
  schedulePersistence();
  return player;
}

function activeCount() {
  return [...players.values()].filter((player) => player.online).length;
}

function deactivatePlayer(address) {
  const normalized = getAddress(address);
  let changed = false;
  for (const player of players.values()) if (player.address === normalized) {
    player.online = false;
    changed = true;
  }
  if (changed) schedulePersistence();
}

function districtFor(x, y) {
  return Object.entries(districts).reduce((closest, [name, point]) => {
    const distance = Math.hypot(point.x - x, point.y - y);
    return distance < closest.distance ? { name, distance } : closest;
  }, { name: "Old Exchange", distance: Number.POSITIVE_INFINITY }).name;
}

function applyMovement(player, x, y, now = Date.now()) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 1 || x > 35 || y < 1 || y > 35) throw new HttpError(400, "invalid_position");
  const seconds = Math.max(.1, (now - player.lastMoveAt) / 1000);
  if (Math.hypot(x - player.x, y - player.y) > MAX_SPEED * seconds + 1.5) throw new HttpError(409, "movement_rejected");
  const oldDistrict = player.district;
  player.x = x;
  player.y = y;
  player.district = districtFor(x, y);
  player.lastMoveAt = now;
  player.lastSeen = now;
  schedulePersistence();
  return { oldDistrict, districtChanged: oldDistrict !== player.district };
}

function applyMission(player, missionId, now = Date.now()) {
  const mission = missions[missionId];
  if (!mission) throw new HttpError(404, "unknown_mission");
  if (player.district !== mission.district || Math.hypot(player.x - mission.x, player.y - mission.y) > 2.6) throw new HttpError(409, "not_at_mission");
  const readyAt = player.cooldowns.get(missionId) ?? 0;
  if (readyAt > now) {
    const error = new HttpError(429, "mission_cooldown");
    error.retryAfterMs = readyAt - now;
    throw error;
  }
  player.cooldowns.set(missionId, now + mission.cooldownMs);
  player.xp += mission.xp;
  player.credits += mission.credits;
  player.reputation += mission.reputation;
  player.jobsCompleted += 1;
  schedulePersistence();
  return { mission, progress: { xp: player.xp, credits: player.credits, reputation: player.reputation, jobsCompleted: player.jobsCompleted } };
}

function sendEvent(response, event, data) {
  if (!response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) response.end();
}

function broadcast(event, data, district = null) {
  for (const [tokenId, responses] of streams) {
    const viewer = players.get(tokenId);
    if (district && viewer?.district !== district) continue;
    for (const response of responses) sendEvent(response, event, data);
  }
}

function leaderboard(district) {
  return [...players.values()]
    .filter((player) => !district || player.district === district)
    .sort((a, b) => b.xp - a.xp || b.reputation - a.reputation)
    .slice(0, 25)
    .map((player, index) => ({ rank: index + 1, address: player.address, tokenId: player.tokenId, district: player.district, xp: player.xp, reputation: player.reputation, jobsCompleted: player.jobsCompleted, online: player.online }));
}

function authenticate(request, response) {
  const session = readSession(request);
  if (!session) {
    json(response, 401, { error: "invalid_session" });
    return null;
  }
  const player = getPlayer(session.address, session.tokenId);
  if (!player) {
    json(response, 503, { error: "city_full", capacity: MAX_PLAYERS });
    return null;
  }
  return player;
}

const server = createServer(async (request, response) => {
  try {
    if (!cors(request, response)) return json(response, 403, { error: "origin_not_allowed" });
    if (request.method === "OPTIONS") { response.writeHead(204); return response.end(); }
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const ip = requestIp(request);
    if (limited(`ip:${ip}`, 240)) return json(response, 429, { error: "rate_limited" });

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { ok: true, players: activeCount(), profiles: players.size, capacity: MAX_PLAYERS, persistence: DATA_FILE ? "durable-file" : "memory" });
    }

    if (request.method === "POST" && url.pathname === "/auth/challenge") {
      if (limited(`challenge:${ip}`, 12)) return json(response, 429, { error: "rate_limited" });
      const input = await body(request);
      let address;
      try { address = getAddress(input.address); } catch { return json(response, 400, { error: "invalid_address" }); }
      const tokenId = tokenIdFrom(input);
      if (challenges.size >= MAX_CHALLENGES && !challenges.has(`${address}:${tokenId}`)) return json(response, 503, { error: "challenge_capacity_reached" });
      const nonce = randomBytes(16).toString("hex");
      const expiresAt = Date.now() + CHALLENGE_TTL_MS;
      const issuedAt = new Date().toISOString();
      const message = [`${AUTH_DOMAIN} wants you to sign in with your Ethereum account:`, address, "", "Sign in to Banker Bros Shared City. This proves wallet control and does not authorize a transaction.", "", `URI: ${AUTH_URI}`, "Version: 1", `Chain ID: ${AUTH_CHAIN_ID}`, `Nonce: ${nonce}`, `Issued At: ${issuedAt}`, `Expiration Time: ${new Date(expiresAt).toISOString()}`, `Request ID: banker-bros-token-${tokenId}`].join("\n");
      challenges.set(`${address}:${tokenId}`, { message, expiresAt, tokenId });
      return json(response, 200, { message, expiresAt });
    }

    if (request.method === "POST" && url.pathname === "/auth/verify") {
      const input = await body(request);
      let address;
      try { address = getAddress(input.address); } catch { return json(response, 400, { error: "invalid_address" }); }
      const tokenId = tokenIdFrom(input);
      const challengeKey = `${address}:${tokenId}`;
      const challenge = challenges.get(challengeKey);
      challenges.delete(challengeKey);
      if (!challenge || challenge.expiresAt <= Date.now()) return json(response, 401, { error: "challenge_expired" });
      let valid = false;
      try {
        const { verifyMessage } = await loadViem();
        valid = await verifyMessage({ address, message: challenge.message, signature: input.signature });
      } catch { valid = false; }
      if (!valid) return json(response, 401, { error: "invalid_signature" });
      if (!(await verifyTokenOwnership(address, tokenId))) return json(response, 403, { error: "nft_ownership_required" });
      const player = getPlayer(address, tokenId);
      if (!player) return json(response, 503, { error: "city_full", capacity: MAX_PLAYERS });
      return json(response, 200, { token: signSession(address, tokenId), expiresInMs: SESSION_TTL_MS, player: publicPlayer(player), progress: { xp: player.xp, credits: player.credits, reputation: player.reputation, jobsCompleted: player.jobsCompleted } });
    }

    if (request.method === "GET" && url.pathname === "/events") {
      const player = authenticate(request, response);
      if (!player) return;
      const existing = streams.get(player.tokenId);
      if (existing && existing.size >= 3) return json(response, 429, { error: "too_many_presence_streams" });
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      response.write(": connected\n\n");
      let responses = streams.get(player.tokenId);
      if (!responses) { responses = new Set(); streams.set(player.tokenId, responses); }
      responses.add(response);
      sendEvent(response, "snapshot", { players: [...players.values()].filter((item) => item.online && item.district === player.district).map(publicPlayer), leaderboard: leaderboard(player.district), online: activeCount() });
      broadcast("presence", { type: "join", player: publicPlayer(player), online: activeCount() }, player.district);
      request.on("close", () => {
        responses.delete(response);
        if (!responses.size) streams.delete(player.tokenId);
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/leaderboard") {
      const district = url.searchParams.get("district");
      if (district && !districts[district]) return json(response, 400, { error: "unknown_district" });
      return json(response, 200, { district: district || "global", entries: leaderboard(district), online: activeCount(), generatedAt: new Date().toISOString() });
    }

    if (request.method === "POST" && url.pathname === "/presence") {
      const player = authenticate(request, response);
      if (!player) return;
      if (limited(`move:${player.address}`, 30, 10_000)) return json(response, 429, { error: "move_rate_limited" });
      const input = await body(request);
      const x = Number(input.x);
      const y = Number(input.y);
      const now = Date.now();
      let movement;
      try { movement = applyMovement(player, x, y, now); } catch (error) {
        if (error instanceof HttpError) return json(response, error.status, { error: error.code, player: publicPlayer(player) });
        throw error;
      }
      if (movement.districtChanged) {
        broadcast("presence", { type: "leave", address: player.address, tokenId: player.tokenId, online: activeCount() }, movement.oldDistrict);
        broadcast("presence", { type: "join", player: publicPlayer(player), online: activeCount() }, player.district);
      }
      broadcast("presence", { type: "move", player: publicPlayer(player), online: activeCount() }, player.district);
      return json(response, 200, { ok: true, districtChanged: movement.districtChanged, player: publicPlayer(player), players: movement.districtChanged ? [...players.values()].filter((item) => item.online && item.district === player.district).map(publicPlayer) : undefined, leaderboard: movement.districtChanged ? leaderboard(player.district) : undefined });
    }

    if (request.method === "POST" && url.pathname === "/travel") {
      const player = authenticate(request, response);
      if (!player) return;
      const input = await body(request);
      const destination = districts[input.district];
      if (!destination) return json(response, 400, { error: "unknown_district" });
      const oldDistrict = player.district;
      player.district = input.district; player.x = destination.x; player.y = destination.y; player.lastMoveAt = Date.now(); player.lastSeen = Date.now();
      schedulePersistence();
      if (oldDistrict !== player.district) {
        broadcast("presence", { type: "leave", address: player.address, tokenId: player.tokenId, online: activeCount() }, oldDistrict);
        broadcast("presence", { type: "join", player: publicPlayer(player), online: activeCount() }, player.district);
      }
      return json(response, 200, { player: publicPlayer(player), players: [...players.values()].filter((item) => item.online && item.district === player.district).map(publicPlayer), leaderboard: leaderboard(player.district) });
    }

    if (request.method === "POST" && url.pathname === "/missions/complete") {
      const player = authenticate(request, response);
      if (!player) return;
      if (limited(`mission:${player.address}`, 20, 60_000)) return json(response, 429, { error: "mission_rate_limited" });
      const input = await body(request);
      let completed;
      try { completed = applyMission(player, input.missionId); } catch (error) {
        if (error instanceof HttpError) return json(response, error.status, { error: error.code, retryAfterMs: error.retryAfterMs });
        throw error;
      }
      const { mission, progress } = completed;
      const board = leaderboard(player.district);
      broadcast("mission", { address: player.address, missionId: input.missionId, missionName: mission.name, progress, leaderboard: board }, player.district);
      return json(response, 200, { ok: true, mission: mission.name, progress, leaderboard: board });
    }

    return json(response, 404, { error: "not_found" });
  } catch (error) {
    if (error instanceof HttpError) return json(response, error.status, { error: error.code });
    console.error("realtime_request_failed", error instanceof Error ? error.message : "unknown_error");
    return json(response, 500, { error: "internal_error" });
  }
});

server.headersTimeout = 10_000;
server.requestTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 50;

setInterval(() => {
  const now = Date.now();
  for (const [address, challenge] of challenges) if (challenge.expiresAt <= now) challenges.delete(address);
  for (const [tokenId, player] of players) {
    if (player.online && player.lastSeen + PLAYER_TTL_MS <= now && !streams.has(tokenId)) {
      player.online = false;
      schedulePersistence();
      broadcast("presence", { type: "leave", address: player.address, tokenId, online: activeCount() }, player.district);
    }
  }
  for (const [key, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(key);
  for (const responses of streams.values()) for (const response of responses) response.write(": keepalive\n\n");
}, 15_000).unref();

await restoreProfiles();

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, HOST, () => {
    console.log(`Banker Bros realtime listening on http://${HOST}:${PORT}`);
    if (SESSION_SECRET === "development-only-change-me") console.warn("Using development session secret; set REALTIME_SESSION_SECRET before shared deployment.");
  });
  const shutdown = () => server.close(async () => {
    try { await persistProfiles(true); } catch (error) { console.error("realtime_shutdown_persistence_failed", error instanceof Error ? error.message : "unknown_error"); }
    process.exit(0);
  });
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

export { MAX_PLAYERS, activeCount, applyMission, applyMovement, deactivatePlayer, districtFor, getPlayer, leaderboard, missions, persistProfiles, readSession, signSession };
