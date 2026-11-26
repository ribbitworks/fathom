// SPDX-License-Identifier: Apache-2.0

// Tests for record keys: how a key and its link are written, which keys and links are read, and
// when two keys are the same.

import { describe, expect, it } from "vitest";
import {
  parseRecordKey,
  parseRecordLink,
  recordKey,
  recordLinkPath,
  sameRecordKey,
  shownRecordKey,
} from "./record-keys.ts";

describe("writing a key", () => {
  it("names the kind in capitals before the number", () => {
    expect(recordKey({ kind: "feature", keyNumber: 123 })).toBe("FEATURE-123");
  });

  it("shows the key after a #", () => {
    expect(shownRecordKey({ kind: "hire", keyNumber: 14 })).toBe("#HIRE-14");
  });

  it("links to the kind in lower case and the number", () => {
    expect(recordLinkPath({ kind: "person", keyNumber: 210 })).toBe(
      "/go/person/210",
    );
  });

  it("writes a random key as its kind in capitals and its code, and links to it whole", () => {
    const key = { kind: "row", code: "4X9T" } as const;
    expect(shownRecordKey(key)).toBe("#ROW-4X9T");
    expect(recordLinkPath(key)).toBe("/go/ROW-4X9T");
    expect(recordLinkPath({ kind: "page", code: "K7QMZ" })).toBe(
      "/go/PAGE-K7QMZ",
    );
  });
});

describe("reading a key", () => {
  it.each(["FEATURE-123", "feature-123", "#Feature-123", " #FEATURE-123 "])(
    "reads %j in any case, with or without the #",
    (typed) => {
      expect(parseRecordKey(typed)).toEqual({
        kind: "feature",
        keyNumber: 123,
      });
    },
  );

  it.each([
    "",
    "FEATURE",
    "FEATURE-",
    "FEATURE-0",
    "FEATURE-012",
    "FEATURE-1.5",
    "FEAT-12",
    "##FEATURE-12",
    "FEATURE 12",
    "FEATURE-2147483648",
    "CYCLE-3",
  ])("refuses %j", (typed) => {
    expect(parseRecordKey(typed)).toBeUndefined();
  });

  it.each(["PAGE-K7QM", "page-k7qm", "#Row-4x9t", "ROW-K7QM2"])(
    "reads the random key %j in any case",
    (typed) => {
      const key = parseRecordKey(typed);
      expect(key).toEqual({
        kind: typed.toLowerCase().includes("page") ? "page" : "row",
        code: typed.replace(/^.*-/u, "").toUpperCase(),
      });
    },
  );

  it.each(["PAGE-K7Q", "PAGE-K7QMZZ", "ROW-01IL", "ROW-4X9U", "PAGE-12"])(
    "refuses the random key %j, not one the database makes",
    (typed) => {
      expect(parseRecordKey(typed)).toBeUndefined();
    },
  );

  it("reads the largest number a key may have", () => {
    expect(parseRecordKey("ROLE-2147483647")).toEqual({
      kind: "role",
      keyNumber: 2_147_483_647,
    });
  });
});

describe("reading a link", () => {
  it("reads a link's kind and number in any case", () => {
    expect(parseRecordLink("Schedule", "3")).toEqual({
      kind: "schedule",
      keyNumber: 3,
    });
  });

  it("refuses a link whose parts aren't a key's", () => {
    expect(parseRecordLink("feature", "x")).toBeUndefined();
  });
});

describe("comparing keys", () => {
  it("finds two keys the same only when both kind and number match", () => {
    const key = { kind: "feature", keyNumber: 2 } as const;
    expect(sameRecordKey(key, { kind: "feature", keyNumber: 2 })).toBe(true);
    expect(sameRecordKey(key, { kind: "feature", keyNumber: 20 })).toBe(false);
    expect(sameRecordKey(key, { kind: "project", keyNumber: 2 })).toBe(false);
    expect(
      sameRecordKey(
        { kind: "row", code: "4X9T" },
        { kind: "row", code: "4X9T" },
      ),
    ).toBe(true);
    expect(
      sameRecordKey(
        { kind: "row", code: "4X9T" },
        { kind: "page", code: "4X9T" },
      ),
    ).toBe(false);
  });
});
