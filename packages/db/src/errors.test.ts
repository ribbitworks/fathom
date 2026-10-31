// SPDX-License-Identifier: Apache-2.0

// Tests for describing errors, whether an Error or any other value is thrown, and for recognizing
// database errors by their code, however deeply they are wrapped.

import { describe, expect, it } from "vitest";
import { databaseCodes, describeError, hasDatabaseCode } from "./errors.ts";

describe("describing errors", () => {
  it("uses an Error's message", () => {
    expect(describeError(new Error("example failure"))).toBe("example failure");
  });

  it("converts anything else thrown to text", () => {
    expect(describeError("example text")).toBe("example text");
  });
});

describe("recognizing database errors", () => {
  const unique = Object.assign(new Error("duplicate"), {
    code: databaseCodes.uniqueViolation,
  });

  it("finds the code on the error or on any error it wraps", () => {
    expect(hasDatabaseCode(unique, databaseCodes.uniqueViolation)).toBe(true);
    expect(
      hasDatabaseCode(
        new Error("query failed", { cause: unique }),
        databaseCodes.uniqueViolation,
      ),
    ).toBe(true);
  });

  it("does not find another code, or a code on something that is not an Error", () => {
    expect(hasDatabaseCode(unique, databaseCodes.checkViolation)).toBe(false);
    expect(
      hasDatabaseCode(
        { code: databaseCodes.uniqueViolation },
        databaseCodes.uniqueViolation,
      ),
    ).toBe(false);
  });
});
