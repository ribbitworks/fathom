// SPDX-License-Identifier: Apache-2.0

// Unit tests for finding the changes a rejection rejected, from the latest change to each of its
// record's fields up to it.

import type { StoredChange } from "./changes.ts";
import { describe, expect, it } from "vitest";
import { draftAsRejected } from "./history-visibility.ts";

const latest = (field: string, draft: boolean): StoredChange => ({
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
});

const fieldsOf = (changes: readonly StoredChange[]) =>
  draftAsRejected(changes).map(({ field }) => field);

describe("the draft a rejection found", () => {
  it("holds each field whose latest change was to a draft, a discard's included", () => {
    expect(
      fieldsOf([latest("value:site", true), latest("preferredName", true)]),
    ).toEqual(["value:site", "preferredName"]);
  });

  it("leaves out a field changed live since, as by approving the draft or removing its column", () => {
    expect(
      fieldsOf([
        latest("value:site", true),
        latest("value:removed", false),
        latest("preferredName", false),
      ]),
    ).toEqual(["value:site"]);
  });

  it("leaves out a rejection's reason, set or cleared", () => {
    expect(
      fieldsOf([latest("rejected", true), latest("value:site", true)]),
    ).toEqual(["value:site"]);
  });
});
