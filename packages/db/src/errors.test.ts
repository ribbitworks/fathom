import { describe, expect, it } from "vitest";
import { describeError } from "./errors.ts";

describe("describing errors", () => {
  it("uses an Error's message", () => {
    expect(describeError(new Error("example failure"))).toBe("example failure");
  });

  it("converts anything else thrown to text", () => {
    expect(describeError("example text")).toBe("example text");
  });
});
