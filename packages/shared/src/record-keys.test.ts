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
    expect(recordKey("feature", 123)).toBe("FEATURE-123");
  });

  it("shows the key after a #", () => {
    expect(shownRecordKey("hire", 14)).toBe("#HIRE-14");
  });

  it("links to the kind in lower case and the number", () => {
    expect(recordLinkPath("person", 210)).toBe("/go/person/210");
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
  });
});
