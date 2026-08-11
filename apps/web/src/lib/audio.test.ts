import { describe, expect, it } from "vitest";
import { WALL_STREET_JINGLE, wallStreetJingleDuration } from "./audio";

describe("Wall Street jingle", () => {
  it("is a short, ordered original game ident", () => {
    expect(WALL_STREET_JINGLE).toHaveLength(9);
    expect(WALL_STREET_JINGLE.every((note, index) => index === 0 || note.at >= WALL_STREET_JINGLE[index - 1].at)).toBe(true);
    expect(WALL_STREET_JINGLE.every((note) => note.frequency >= 220 && note.frequency <= 660)).toBe(true);
    expect(wallStreetJingleDuration()).toBeGreaterThanOrEqual(2.2);
    expect(wallStreetJingleDuration()).toBeLessThan(3);
  });
});
