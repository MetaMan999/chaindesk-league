import { describe, expect, it } from "vitest";
import { brokerLadderScore, districtPulse, districtStandings, floorForLadderScore } from "./livingWorld";

describe("living Wall Street hub", () => {
  it("rewards real progression inputs and caps the tower", () => {
    const rookie = brokerLadderScore(10, 100, 10_000, 1);
    const veteran = brokerLadderScore(100, 2_000, 1_000_000, 4);
    expect(veteran).toBeGreaterThan(rookie);
    expect(floorForLadderScore(1_000_000)).toBe(100);
  });

  it("places the player into a sorted district ladder", () => {
    const standings = districtStandings({ handle: "Shy Bull", reputation: 300, commission: 5_000, aum: 2_000_000, officeLevel: 4 }, "MARKET OPEN");
    expect(standings.some((broker) => broker.player)).toBe(true);
    expect(standings.every((broker, index) => index === 0 || standings[index - 1].score >= broker.score)).toBe(true);
  });

  it("rotates a deterministic market pulse", () => {
    expect(districtPulse(30_000, "MARKET OPEN", 3)).toEqual(districtPulse(30_000, "MARKET OPEN", 3));
    expect(districtPulse(30_000, "MARKET OPEN", 3)).not.toEqual(districtPulse(60_000, "MARKET OPEN", 3));
  });
});
