import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.REALTIME_SESSION_SECRET = "test-secret-with-more-than-32-characters";

test("durable profiles survive restart without persisting sessions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "banker-bros-realtime-"));
  const dataFile = join(directory, "profiles.json");
  process.env.REALTIME_DATA_FILE = dataFile;

  try {
    const writer = await import("../src/server.mjs?persistence-writer");
    const address = "0xdddddddddddddddddddddddddddddddddddddddd";
    const player = writer.getPlayer(address, 42);
    player.x = 9;
    player.y = 8;
    player.district = "Old Exchange";
    writer.applyMission(player, "exchange", 10_000);
    await writer.persistProfiles(true);

    const snapshot = JSON.parse(await readFile(dataFile, "utf8"));
    assert.equal(snapshot.version, 1);
    assert.equal(snapshot.players[0].xp, 40);
    assert.equal("session" in snapshot.players[0], false);

    const reader = await import("../src/server.mjs?persistence-reader");
    const restored = reader.leaderboard(null).find((entry) => entry.address === address);
    assert.equal(restored.tokenId, 42);
    assert.equal(restored.xp, 40);
    assert.equal(restored.online, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
    delete process.env.REALTIME_DATA_FILE;
  }
});
