// SPDX-License-Identifier: Apache-2.0

// Unit tests for reading records in force from a date until the next one for the same subject.

import { describe, expect, it } from "vitest";
import {
  bySubject,
  currentRecordOn,
  inForceOn,
  inForceOrLater,
} from "./in-force.ts";

const record = (subject: string, fromDate: string) => ({ subject, fromDate });

describe("records in force", () => {
  const first = record("a", "2026-01-01");
  const second = record("a", "2026-03-01");

  it("groups records by subject, earliest first", () => {
    const other = record("b", "2026-02-01");

    expect([
      ...bySubject([second, other, first], ({ subject }) => subject),
    ]).toEqual([
      ["a", [first, second]],
      ["b", [other]],
    ]);
  });

  it.each([
    ["before the first starts", "2025-12-31", undefined],
    ["on the first's day", "2026-01-01", first],
    ["between them", "2026-02-15", first],
    ["after the last starts", "2026-04-01", second],
  ])("finds the record in force %s", (_, day, found) => {
    expect(inForceOn([first, second], day)).toBe(found);
  });

  it.each([
    ["the record in force", first, "2026-02-15", true],
    ["a later record", second, "2026-02-15", true],
    ["an earlier record no longer in force", first, "2026-04-01", false],
  ])("counts %s as in force or later", (_, one, day, counted) => {
    expect(inForceOrLater(one, [first, second], day)).toBe(counted);
  });

  it("takes the first record as current before any has started", () => {
    expect(currentRecordOn([first, second], "2025-06-01")).toBe(first);
    expect(currentRecordOn([first, second], "2026-04-01")).toBe(second);
  });
});
