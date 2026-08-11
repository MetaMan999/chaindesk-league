import { describe, expect, it } from "vitest";
import {
  addItem,
  advanceQuest,
  createNewSave,
  isBlocked,
  marketStateForHour,
  rankForReputation,
  resolveNegotiation,
  scenes,
} from "./rpg";

describe("Banker Bros RPG systems", () => {
  it("creates an independent new-game save", () => {
    const first = createNewSave();
    const second = createNewSave();
    first.inventory[0].quantity = 99;
    expect(second.inventory[0].quantity).toBe(1);
    expect(second.scene).toBe("wall-street");
  });

  it("blocks buildings while leaving marked doors walkable", () => {
    expect(isBlocked(scenes["wall-street"], { x: 2, y: 2 })).toBe(true);
    expect(isBlocked(scenes["wall-street"], { x: 5, y: 4 })).toBe(false);
  });

  it("maps clock states and reputation ranks", () => {
    expect(marketStateForHour(8)).toBe("PRE-MARKET");
    expect(marketStateForHour(11)).toBe("MARKET OPEN");
    expect(marketStateForHour(19)).toBe("AFTER HOURS");
    expect(rankForReputation(75)).toBe("Senior Broker");
  });

  it("resolves finance actions without exceeding stat bounds", () => {
    const result = resolveNegotiation({ playerConfidence: 100, rivalResolve: 100, insight: 1, hedge: 0, turn: 1 }, "quote", 0.5);
    expect(result.rivalResolve).toBeLessThan(100);
    expect(result.playerConfidence).toBeLessThan(100);
    expect(result.rivalResolve).toBeGreaterThanOrEqual(0);
  });

  it("stacks briefcase items and completes quest progress", () => {
    const inventory = addItem(createNewSave().inventory, { id: "test-usdc", name: "Test USD", description: "Demo", quantity: 50, icon: "$" });
    expect(inventory.find((item) => item.id === "test-usdc")?.quantity).toBe(300);
    const quests = advanceQuest(createNewSave().quests, "morning-coffee", 2);
    expect(quests[0].state).toBe("complete");
  });
});
