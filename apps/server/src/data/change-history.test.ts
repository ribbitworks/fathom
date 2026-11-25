// SPDX-License-Identifier: Apache-2.0

// Tests for the people and owners a change names, whom the history hides from a reader who doesn't see
// start and end dates.

import { describe, expect, it } from "vitest";
import type { StoredChange } from "./changes.ts";
import { ownersNamedBy, peopleNamedBy } from "./change-history.ts";

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
