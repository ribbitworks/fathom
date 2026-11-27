// SPDX-License-Identifier: Apache-2.0

// Unit tests for the people and owners a change names, whom the history hides from a reader who
// doesn't see start and end dates, and for the draft a rejection rejected and whom it names.

import type { StoredChange } from "./changes.ts";
import { describe, expect, it } from "vitest";
import {
  draftAsRejected,
  draftNamesUnseen,
  ownersNamedBy,
  peopleNamedBy,
} from "./history-visibility.ts";

const saved = (field: string, draft: boolean): StoredChange => ({
  id: 1,
  changeSetId: "fictional-set",
  recordType: "person",
  recordId: "fictional-person",
  action: "changed",
  field,
  tier: "general",
  oldValue: "Fictional drafted value",
  newValue: "Fictional value",
  draft,
  keepsDraft: false,
});

const fieldsOf = (changes: readonly StoredChange[]) =>
  draftAsRejected(changes).map(({ field }) => field);

describe("the draft a rejection found", () => {
  it("holds each change to a draft, a discard's included", () => {
    expect(
      fieldsOf([saved("value:site", true), saved("preferredName", true)]),
    ).toEqual(["value:site", "preferredName"]);
  });

  it("leaves out a field changed live since, as by approving the draft or removing its column", () => {
    expect(
      fieldsOf([
        saved("value:site", true),
        saved("value:removed", false),
        saved("preferredName", false),
      ]),
    ).toEqual(["value:site"]);
  });

  it("leaves out a rejection's reason, set or cleared", () => {
    expect(
      fieldsOf([saved("rejected", true), saved("value:site", true)]),
    ).toEqual(["value:site"]);
  });
});

const change = (fields: Partial<StoredChange>) =>
  ({ oldValue: null, newValue: null, ...fields }) as StoredChange;

describe("the owners a change names", () => {
  it.each([
    ["a project's owner", "project"],
    ["a proposal's owner", "proposal"],
  ])("include %s, before and after", (_, recordType) => {
    expect(
      ownersNamedBy(
        change({
          recordType,
          field: "ownerId",
          oldValue: "p-before",
          newValue: "p-after",
        }),
      ),
    ).toEqual(["p-before", "p-after"]);
  });

  it("are none in a person's change or another field", () => {
    expect(
      ownersNamedBy(change({ recordType: "person", recordId: "p-5" })),
    ).toEqual([]);
    expect(
      ownersNamedBy(
        change({ recordType: "project", field: "name", newValue: "p-6" }),
      ),
    ).toEqual([]);
  });
});

describe("the people a change names", () => {
  it("include a feature team's lead and a planned hire's manager", () => {
    expect(
      peopleNamedBy(
        change({
          recordType: "feature-team",
          field: "leadId",
          newValue: "p-1",
        }),
      ),
    ).toEqual(["p-1"]);
    expect(
      peopleNamedBy(
        change({
          recordType: "planned-hire",
          field: "managerId",
          newValue: "p-2",
        }),
      ),
    ).toEqual(["p-2"]);
  });

  it("include the person a person's change is to, and none from other fields", () => {
    expect(
      peopleNamedBy(change({ recordType: "person", recordId: "p-3" })),
    ).toEqual(["p-3"]);
    expect(
      peopleNamedBy(
        change({ recordType: "project", field: "name", newValue: "p-4" }),
      ),
    ).toEqual([]);
  });
});

describe("whether a rejected draft names someone unseen", () => {
  const unseen = { people: new Set(["p-gone"]), owners: new Set(["o-new"]) };

  it.each([
    [
      "a team member it adds",
      change({
        recordType: "feature-team",
        field: "members",
        oldValue: ["p-1"],
        newValue: ["p-1", "p-gone"],
      }),
    ],
    [
      "a team member it removes",
      change({
        recordType: "feature-team",
        field: "members",
        oldValue: ["p-1", "p-gone"],
        newValue: ["p-1"],
      }),
    ],
    [
      "a lead it dates",
      change({
        recordType: "feature-team",
        field: "leadFrom",
        oldValue: { "p-gone": "2026-01-05" },
        newValue: null,
      }),
    ],
    [
      "a team's lead",
      change({
        recordType: "feature-team",
        field: "leadId",
        newValue: "p-gone",
      }),
    ],
    [
      "a member it dates",
      change({
        recordType: "feature-team",
        field: "memberFrom",
        newValue: { "p-gone": "2026-01-05" },
      }),
    ],
    [
      "a hire's manager",
      change({
        recordType: "planned-hire",
        field: "managerId",
        newValue: "p-gone",
      }),
    ],
    [
      "a hire's manager it replaces",
      change({
        recordType: "planned-hire",
        field: "managerId",
        oldValue: "p-gone",
        newValue: "p-1",
      }),
    ],
    [
      "a hire's filler",
      change({
        recordType: "planned-hire",
        field: "filledBy",
        newValue: "p-gone",
      }),
    ],
    [
      "the person changed",
      change({
        recordType: "person",
        recordId: "p-gone",
        field: "preferredName",
      }),
    ],
    [
      "an owner not yet started",
      change({ recordType: "project", field: "ownerId", newValue: "o-new" }),
    ],
  ])("is true for %s", (_, named) => {
    expect(draftNamesUnseen([named], unseen)).toBe(true);
  });

  it.each([
    [
      "an owner who has left, whom the plan names as retired",
      [
        change({
          recordType: "proposal",
          field: "ownerId",
          newValue: "p-gone",
        }),
      ],
    ],
    [
      "a team member it keeps",
      [
        change({
          recordType: "feature-team",
          field: "members",
          oldValue: ["p-gone"],
          newValue: ["p-gone", "p-1"],
        }),
      ],
    ],
    [
      "only people the reader sees",
      [
        change({
          recordType: "planned-hire",
          field: "managerId",
          newValue: "p-1",
        }),
      ],
    ],
    ["an empty draft", []],
  ])("is false for %s", (_, draft) => {
    expect(draftNamesUnseen(draft, unseen)).toBe(false);
  });

  it("is false when the reader sees everyone", () => {
    expect(
      draftNamesUnseen(
        [
          change({
            recordType: "planned-hire",
            field: "managerId",
            newValue: "p-gone",
          }),
        ],
        { people: new Set(), owners: new Set() },
      ),
    ).toBe(false);
  });
});
