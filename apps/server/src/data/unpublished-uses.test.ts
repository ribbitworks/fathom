// SPDX-License-Identifier: Apache-2.0

// Tests for which of a user's unpublished changes go with those chosen: the changes they use when
// publishing, the changes that use them when discarding, each the whole way along, and the changes
// of a fill, or saved together, always together.

import { withNeeded, withUsers } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { ColumnsState } from "./column-state.ts";
import type { ListsState } from "./lists.ts";
import type { RecordsState } from "./record-state.ts";
import {
  fillKeys,
  type OwnDrafts,
  publishableAmong,
  usesAmong,
} from "./unpublished-uses.ts";

// A list, a choice added to it, and a person given the choice, each using the one before.
const uses = new Map([
  ["list sites", []],
  ["list-item north", ["list sites"]],
  ["person avery", ["list-item north"]],
  ["person blake", []],
]);

describe("the changes a role may publish", () => {
  const all = [...uses.keys()];

  it("publishes every change when none is refused", () => {
    expect([...publishableAmong(uses, all, [])].sort()).toEqual(
      [...all].sort(),
    );
  });

  it("leaves a change refused", () => {
    expect([...publishableAmong(uses, all, ["person avery"])].sort()).toEqual([
      "list sites",
      "list-item north",
      "person blake",
    ]);
  });

  it("leaves the changes that use a change refused, the whole way along", () => {
    expect([...publishableAmong(uses, all, ["list sites"])]).toEqual([
      "person blake",
    ]);
  });

  it("leaves the changes saved together with a change refused", () => {
    // Saved together, each links to the other.
    const together = new Map([
      ["cycle-pattern p", ["release r"]],
      ["release r", ["cycle-pattern p"]],
      ["person blake", []],
    ]);
    expect([
      ...publishableAmong(together, [...together.keys()], ["release r"]),
    ]).toEqual(["person blake"]);
  });
});

describe("which of a user's changes use which", () => {
  // Only fills are read for the kinds below, with no draft of the person or hire.
  const own: OwnDrafts = {
    lists: {} as ListsState,
    columns: {} as ColumnsState,
    records: {} as RecordsState,
    people: new Map(),
    hires: new Map(),
    together: [
      ...fillKeys([
        {
          hireId: "h",
          personId: "p",
          people: ["p"],
          personFields: [],
          plannedHires: ["h", "report"],
        },
      ]),
      ["list saved", "person p"],
    ],
  };

  it("has the changes of a fill, or saved together, use one another, among the user's own", () => {
    const found = usesAmong(own, [
      { recordType: "person", recordId: "p" },
      { recordType: "planned-hire", recordId: "h" },
      { recordType: "list", recordId: "saved" },
      { recordType: "feature-team", recordId: "t" },
      { recordType: "a kind Fathom no longer has", recordId: "x" },
    ]);
    expect(Object.fromEntries(found)).toEqual({
      "person p": ["planned-hire h", "list saved"],
      "planned-hire h": ["person p"],
      "list saved": ["person p"],
      "feature-team t": [],
      "a kind Fathom no longer has x": [],
    });
  });

  it("links a large group through its first change, not every pair", () => {
    const keys = ["person a", "person b", "person c", "person d"];
    const found = usesAmong(
      { ...own, together: [["person gone", ...keys]] },
      keys.map((key) => ({
        recordType: "person",
        recordId: key.slice("person ".length),
      })),
    );
    expect(Object.fromEntries(found)).toEqual({
      "person a": ["person b", "person c", "person d"],
      "person b": ["person a"],
      "person c": ["person a"],
      "person d": ["person a"],
    });
    expect([...withNeeded(found, ["person d"])].sort()).toEqual(keys);
    expect([...withUsers(found, ["person d"])].sort()).toEqual(keys);
  });
});
