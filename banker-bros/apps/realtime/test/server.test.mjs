import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.REALTIME_SESSION_SECRET = "test-secret-with-more-than-32-characters";

const { MAX_PLAYERS, activeCount, applyMission, applyMovement, deactivatePlayer, districtFor, getPlayer, leaderboard, missions, readSession, signSession } = await import("../src/server.mjs");

test("signed sessions validate and tampering is rejected", () => {
  const address = "0x1111111111111111111111111111111111111111";
  const token = signSession(address, 77);
  const session = readSession({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(session.address, address);
  assert.equal(session.tokenId, 77);
  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  assert.equal(readSession({ headers: { authorization: `Bearer ${tampered}` } }), null);
});

test("mission catalog exposes all five server-authoritative jobs", () => {
  assert.equal(Object.keys(missions).length, 5);
  for (const mission of Object.values(missions)) {
    assert.ok(mission.cooldownMs >= 15_000);
    assert.ok(mission.xp > 0);
  }
});

test("empty leaderboard is stable", () => {
  assert.deepEqual(leaderboard(null), []);
});

test("world positions resolve to the nearest district room", () => {
  assert.equal(districtFor(24, 8), "Neon Heights");
  assert.equal(districtFor(30, 16), "Degen Wharf");
});

test("movement rejects teleports and accepts normal walking", () => {
  const address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const player = getPlayer(address, 219);
  player.lastMoveAt = 1_000;
  assert.throws(() => applyMovement(player, 35, 35, 1_100), (error) => error.code === "movement_rejected");
  assert.doesNotThrow(() => applyMovement(player, 18.5, 18.5, 2_000));
  deactivatePlayer(address);
});

test("mission rewards require proximity and enforce cooldown", () => {
  const address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const player = getPlayer(address, 220);
  player.x = 9;
  player.y = 8;
  player.district = "Old Exchange";
  const first = applyMission(player, "exchange", 10_000);
  assert.equal(first.progress.xp, 40);
  assert.equal(first.progress.credits, 335);
  assert.throws(() => applyMission(player, "exchange", 10_001), (error) => error.code === "mission_cooldown");
  player.x = 18;
  player.y = 18;
  assert.throws(() => applyMission(player, "deal", 30_000), (error) => error.code === "not_at_mission");
  deactivatePlayer(address);
});

test("durable progression follows the Banker Bro token across an owner transfer", () => {
  const firstOwner = "0xcccccccccccccccccccccccccccccccccccccccc";
  const nextOwner = "0xdddddddddddddddddddddddddddddddddddddddd";
  const player = getPlayer(firstOwner, 218);
  player.xp = 321;
  assert.equal(getPlayer(nextOwner, 218), null);
  deactivatePlayer(firstOwner);
  const transferred = getPlayer(nextOwner, 218);
  assert.equal(transferred.xp, 321);
  assert.equal(transferred.address, nextOwner);
  deactivatePlayer(nextOwner);
});

test("active multiplayer capacity is hard-capped at 222 wallets", () => {
  for (let index = 1; index <= MAX_PLAYERS; index += 1) {
    const address = `0x${index.toString(16).padStart(40, "0")}`;
    assert.ok(getPlayer(address, index));
  }
  assert.equal(MAX_PLAYERS, 222);
  assert.equal(activeCount(), 222);
  assert.equal(getPlayer("0xffffffffffffffffffffffffffffffffffffffff", 222), null);
});

test("an inactive returning profile cannot overflow a full room", () => {
  const original = "0x0000000000000000000000000000000000000001";
  const replacement = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  deactivatePlayer(original);
  assert.ok(getPlayer(replacement, 1));
  assert.equal(activeCount(), 222);
  assert.equal(getPlayer(original, 1), null);
  assert.equal(activeCount(), 222);
});
