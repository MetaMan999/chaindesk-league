import { describe, expect, it } from "vitest";
import { decodeBytes32Label } from "./onchainBroker";

describe("onchain broker bridge helpers", () => {
  it("decodes padded bytes32 labels", () => {
    expect(decodeBytes32Label("0x64656c74615f62616e6b00000000000000000000000000000000000000000000")).toBe("delta_bank");
  });

  it("fails closed for malformed labels", () => {
    expect(decodeBytes32Label("not-hex")).toBeUndefined();
    expect(decodeBytes32Label(undefined)).toBeUndefined();
  });
});
