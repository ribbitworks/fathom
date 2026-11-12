// SPDX-License-Identifier: Apache-2.0

// Tests for what the server is told of an export, and the classified data an export holds in words.

import { describe, expect, it } from "vitest";
import {
  classifiedData,
  classifiedDataWords,
  exportRequestSchema,
  heldClassNames,
  heldData,
  heldTiers,
} from "./exports.ts";

describe("the classified data an export holds", () => {
  const both = {
    personal: ["Home address", "Start"],
    confidential: ["Salary"],
  };

  it("lists the classes held, the most sensitive first", () => {
    expect(heldTiers(both)).toEqual(["confidential", "personal"]);
    expect(heldClassNames(both)).toBe("Confidential and Personal");
  });

  it("gives each class held with its columns, the most sensitive first", () => {
    expect(heldData(both)).toEqual([
      { dataClass: "confidential", columns: ["Salary"] },
      { dataClass: "personal", columns: ["Home address", "Start"] },
    ]);
  });

  it("names each class's columns after it", () => {
    expect(classifiedDataWords(both)).toBe(
      "Confidential data (Salary) and Personal data (Home address, Start)",
    );
  });

  it("leaves out a class with no columns", () => {
    expect(
      classifiedDataWords({ personal: [], confidential: ["Salary"] }),
    ).toBe("Confidential data (Salary)");
    expect(heldTiers({})).toEqual([]);
  });
});

describe("classifiedData", () => {
  it("names the Personal and Confidential columns, in order, leaving out General ones", () => {
    expect(
      classifiedData([
        { name: "Name", dataClass: "general" },
        { name: "End", dataClass: "personal" },
        { name: "Salary", dataClass: "confidential" },
        { name: "Start", dataClass: "personal" },
      ]),
    ).toEqual({ personal: ["End", "Start"], confidential: ["Salary"] });
  });
});

describe("exportRequestSchema", () => {
  const record = { table: "people", columns: ["startDate", "endDate"] };

  it("accepts a table and its columns' keys, holding no details unless named", () => {
    expect(exportRequestSchema.parse(record)).toEqual({
      ...record,
      details: [],
    });
  });

  it("accepts the details the rows hold", () => {
    expect(
      exportRequestSchema.parse({ ...record, details: ["hiringPlan"] }).details,
    ).toEqual(["hiringPlan"]);
  });

  it.each([
    ["a table it doesn't know", { ...record, table: "salaries" }],
    ["no columns", { ...record, columns: [] }],
    ["an empty key", { ...record, columns: [""] }],
    ["a detail it doesn't know", { ...record, details: ["salary"] }],
    [
      "a detail named twice",
      { ...record, details: ["hiringPlan", "hiringPlan"] },
    ],
    ["a key too long", { ...record, columns: ["x".repeat(101)] }],
    [
      "a column named twice",
      { ...record, columns: ["startDate", "startDate"] },
    ],
    [
      "too many columns",
      {
        ...record,
        columns: Array.from({ length: 201 }, (_, at) => `c${String(at)}`),
      },
    ],
  ])("refuses %s", (_case, request) => {
    expect(exportRequestSchema.safeParse(request).success).toBe(false);
  });
});
