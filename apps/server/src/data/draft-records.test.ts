// SPDX-License-Identifier: Apache-2.0

// Unit tests for the draft rules every kind of record shares: the action between two versions, a
// rejection's change, refusing to resubmit a draft that wasn't rejected, and a private change's own
// fields.

import { describe, expect, it } from "vitest";
import { ConflictError } from "../errors.ts";
import {
  actionTo,
  type Draft,
  rejectedField,
  rejectionChange,
  requireRejected,
  startedFrom,
  withOwnFields,
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

describe("a private change over the published draft", () => {
  const row = (
    action: Draft["action"],
    fields: Record<string, unknown>,
    started: Record<string, unknown>,
  ) => ({
    recordType: "feature-team",
    recordId: "t1",
    userId: "u1",
    setId: "s1",
    action,
    fields,
    startedFrom: started,
    since: new Date(0),
    sequence: 2,
  });
  const published: Draft = {
    ...waiting,
    fields: { name: "Fictional Later", lead: "p2" },
  };

  it("puts its maker's fields over the published draft's others", () => {
    expect(
      withOwnFields(
        published,
        row(
          "changed",
          { name: "Fictional Team", colour: "teal" },
          {
            colour: null,
          },
        ),
      ),
    ).toMatchObject({
      action: "changed",
      fields: { name: "Fictional Later", lead: "p2", colour: "teal" },
      unpublished: true,
      sequence: 2,
    });
  });

  it("takes back a field its maker returned to the live value", () => {
    expect(
      withOwnFields(
        published,
        row(
          "changed",
          { name: "Fictional Team" },
          {
            lead: "p2",
          },
        ),
      )?.fields,
    ).toEqual({ name: "Fictional Later" });
  });

  it("wants no draft once it leaves none of the published draft's fields", () => {
    expect(
      withOwnFields(
        published,
        row("changed", {}, { name: "Fictional Team", lead: "p2" }),
      ),
    ).toBeUndefined();
  });

  it.each([
    ["names no field of its own", published, row("changed", { name: "A" }, {})],
    [
      "has no published draft under it",
      undefined,
      row("changed", { name: "A" }, { name: null }),
    ],
    ["removes the record", published, row("deleted", {}, { name: "B" })],
  ])("holds the whole draft when it %s", (_, under, change) => {
    expect(withOwnFields(under, change)?.fields).toEqual(change.fields);
  });
});

describe("a field cleared to nothing in a private change", () => {
  it("is its maker's own, though nothing and no value read alike", () => {
    expect(
      startedFrom(
        {},
        { fields: { name: "Fictional Renamed", leadId: null } },
        { fields: { name: "Fictional Team" } },
        { fields: { name: "Fictional Team" } },
        { leadId: "p1" },
      ),
    ).toEqual({ name: "Fictional Team", leadId: "p1" });
  });

  it("leaves no draft once its maker wants none, a cleared field included", () => {
    const published: Draft = {
      ...waiting,
      fields: { name: "Fictional Team", leadId: null },
    };
    const wanted = { fields: {} };
    const own = startedFrom({}, wanted, published, published, undefined);

    expect(Object.keys(own).sort()).toEqual(["leadId", "name"]);
    expect(
      withOwnFields(published, {
        recordType: "feature-team",
        recordId: "t1",
        userId: "u1",
        setId: "s1",
        action: "changed",
        fields: {},
        startedFrom: own,
        since: new Date(0),
        sequence: 2,
      }),
    ).toBeUndefined();
  });
});

describe("the values a private change started from", () => {
  const seen = { fields: { name: "Fictional Team", lead: "p2" } };

  it("records each field the change makes differ, from the published draft or the live record", () => {
    expect(
      startedFrom(
        {},
        { fields: { name: "Fictional Renamed", lead: "p2", colour: "teal" } },
        seen,
        { fields: { name: "Fictional Team" } },
        { colour: "blue" },
      ),
    ).toEqual({ name: "Fictional Team", colour: "blue" });
  });

  it("keeps a field's first value, and starts a missing one from nothing", () => {
    expect(
      startedFrom(
        { name: "Fictional First" },
        { fields: { name: "Fictional Renamed", size: "L" } },
        undefined,
        undefined,
        undefined,
      ),
    ).toEqual({ name: "Fictional First", size: null });
  });
});
