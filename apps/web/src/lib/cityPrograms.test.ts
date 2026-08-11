import { describe, expect, it } from "vitest";
import { careerLevel, createCityCareer, programsForLocation, runCityProgram } from "./cityPrograms";

describe("programmable 3D city work", () => {
  it("exposes location-specific jobs", () => {
    expect(programsForLocation("BROKERAGE").map((program) => program.id)).toEqual(["desk-work", "research"]);
  });

  it("applies work rewards, energy, and cooldowns deterministically", () => {
    const state = createCityCareer();
    const result = runCityProgram("service-flow", state, 100_000);
    expect(result.allowed).toBe(true);
    expect(result.state.energy).toBe(88);
    expect(result.state.shiftXp).toBe(18);
    expect(runCityProgram("service-flow", result.state, 110_000).allowed).toBe(false);
  });

  it("blocks work without energy and caps career level", () => {
    expect(runCityProgram("otc-sim", { ...createCityCareer(), energy: 5 }, 100_000).allowed).toBe(false);
    expect(careerLevel(100_000)).toBe(20);
  });
});
