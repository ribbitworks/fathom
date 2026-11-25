// SPDX-License-Identifier: Apache-2.0

// Unit tests for the draft rules every kind of record shares: the action between two versions, a
// rejection's change, and refusing to resubmit a draft that wasn't rejected.

import { describe, expect, it } from "vitest";
import { ConflictError } from "../errors.ts";
import {
  actionTo,
  type Draft,
  rejectedField,
  rejectionChange,
  requireRejected,
} from "./draft-records.ts";

const waiting: Draft = {
  action: "changed",
  fields: { name: "Fictional Team" },
  state: "waiting",
  reason: null,
  sequence: 1,
};
const rejected = (reason: string): Draft => ({
  ...waiting,
  state: "rejected",
  reason,
});

describe("the action between two versions of a record", () => {
  it.each([
    ["created", undefined, { name: "Fictional" }],
    ["changed", { name: "Fictional" }, { name: "Fictional Team" }],
    ["deleted", { name: "Fictional" }, undefined],
  ] as const)("is %s", (action, before, after) => {
    expect(actionTo(before, after)).toBe(action);
  });
});

describe("a rejection's change", () => {
  it("records the reason over a draft waiting for approval", () => {
    expect(
      rejectionChange("person", "p1", waiting, "Not yet", "personal"),
    ).toEqual([
      {
        recordType: "person",
        recordId: "p1",
        action: "changed",
        field: rejectedField,
        tier: "personal",
        oldValue: null,
        newValue: "Not yet",
        draft: true,
      },
    ]);
  });

  it("records the new reason over one rejected for another", () => {
    expect(
      rejectionChange(
        "field",
        "f1",
        rejected("Too early"),
        "Not yet",
        "general",
      ),
    ).toMatchObject([{ oldValue: "Too early", newValue: "Not yet" }]);
  });

  it("records nothing for one rejected for the same reason", () => {
    expect(
      rejectionChange("field", "f1", rejected("Not yet"), "Not yet", "general"),
    ).toEqual([]);
  });
});

describe("resubmitting a draft", () => {
  it("is refused for no draft, or one waiting for approval", () => {
    expect(() => {
      requireRejected(undefined);
    }).toThrow(ConflictError);
    expect(() => {
      requireRejected(waiting);
    }).toThrow("Only a rejected draft can be resubmitted");
  });

  it("is allowed for a rejected draft", () => {
    expect(() => {
      requireRejected(rejected("Not yet"));
    }).not.toThrow();
  });
});
