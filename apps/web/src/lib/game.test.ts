import { describe, expect, it } from "vitest";
import {
  calculateFeeSplit,
  clientWireForFloor,
  crewHeadquartersFloor,
  crewRoleLabel,
  CREDIT,
  executiveAccessFloor,
  fictionalNotional,
  formatCredits,
  officeLevelCap,
  officeUpgradeCost,
  parseCreditInput,
  previewTowerMove,
  towerDivisionForFloor,
} from "./game";

describe("game economy helpers", () => {
  it("keeps the full commission fee accounted for", () => {
    const notional = 10_000n * CREDIT;
    const split = calculateFeeSplit(notional, 2);
    expect(split.fee).toBe(100n * CREDIT);
    expect(split.banker + split.loyalty + split.protocol + split.rewards).toBe(split.fee);
    expect(split.banker).toBe(70n * CREDIT);
    expect(split.loyalty).toBe(10n * CREDIT);
  });

  it("clamps tiers and formats credit precision", () => {
    expect(calculateFeeSplit(1_000n * CREDIT, 99).banker).toBe(8n * CREDIT);
    expect(formatCredits(42_125_000n)).toBe("42.13");
  });

  it("caps ordinary promotions, demotes inactive desks, and reserves floor 100 for rank one", () => {
    expect(previewTowerMove(1, 1_250, 2)).toBe(11);
    expect(previewTowerMove(42, 0, 500, false)).toBe(39);
    expect(previewTowerMove(12, 5_000, 1)).toBe(100);
    expect(towerDivisionForFloor(100).name).toBe("The Penthouse");
    expect(towerDivisionForFloor(42).name).toBe("Institutional Desk");
  });

  it("matches office level gates and floor-specific client wires", () => {
    expect(officeLevelCap(1)).toBe(1);
    expect(officeLevelCap(42)).toBe(3);
    expect(officeLevelCap(100)).toBe(5);
    expect(officeUpgradeCost(3)).toBe(10_000);
    expect(clientWireForFloor(42).client).toBe("Empire Municipal Fund");
  });

  it("derives crew roles and the shared headquarters floor", () => {
    expect(crewRoleLabel(3)).toBe("Captain");
    expect(crewRoleLabel(1)).toBe("Analyst");
    expect(crewHeadquartersFloor([100, 63, 52, 49])).toBe(66);
    expect(crewHeadquartersFloor([])).toBe(0);
  });

  it("parses user credit inputs without render-time exceptions", () => {
    expect(parseCreditInput("10.25")).toBe(10_250_000n);
    expect(parseCreditInput("1e999")).toBe(0n);
    expect(parseCreditInput("12.1234567")).toBe(0n);
    expect(fictionalNotional(42.18, "2")).toBe(84_360_000n);
  });

  it("formats large bigint balances without losing precision", () => {
    expect(formatCredits(9_007_199_254_740_993_125_000n, 3)).toBe("9,007,199,254,740,993.125");
  });

  it("unlocks executive floors from reputation and headquarters together", () => {
    expect(executiveAccessFloor(1_000, 39)).toBe(70);
    expect(executiveAccessFloor(1_000, 40)).toBe(80);
    expect(executiveAccessFloor(5_000, 80)).toBe(100);
  });
});
