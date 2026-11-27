// SPDX-License-Identifier: Apache-2.0

// Tests for the drafts an Approver approves or rejects at once, the area each kind belongs to,
// which drafts a user changed, and which of a user's unpublished changes go with those chosen.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { permissionGrid } from "./access.ts";
import {
  approvableKinds,
  draftsChangedBy,
  approvePermissions,
  draftKinds,
  draftsAtOnce,
  draftsRequestSchema,
  draftsWhere,
  kindsAsked,
  planningSettingsId,
  recordRefSchema,
  rejectionRequestSchema,
  draftKeysOf,
  fromDraftKey,
  withNeeded,
  withUsers,
  takenAlongRefusal,
} from "./drafts.ts";

const message = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("draftsRequestSchema", () => {
  it("accepts drafts of any kind", () => {
    expect(draftsRequestSchema.parse({ people: [randomUUID()] }).lists).toEqual(
      [],
    );
  });

  const tooFewOrMany = `Choose from 1 to ${String(draftsAtOnce)} drafts`;
  const ids = (count: number) =>
    Array.from({ length: count }, () => randomUUID());

  it("refuses a request for no drafts", () => {
    expect(message(draftsRequestSchema.safeParse({}))).toBe(tooFewOrMany);
  });

  it("refuses more drafts than are approved at once", () => {
    expect(
      message(
        draftsRequestSchema.safeParse({
          people: ids(draftsAtOnce / 2 + 1),
          lists: ids(draftsAtOnce / 2),
        }),
      ),
    ).toBe(tooFewOrMany);
  });

  it("refuses the same record of the plan twice", () => {
    const id = randomUUID();
    expect(
      message(
        draftsRequestSchema.safeParse({
          records: [
            { type: "release", id },
            { type: "release", id },
          ],
        }),
      ),
    ).toBe("Each record once");
  });

  it("refuses the same draft twice", () => {
    const id = randomUUID();
    expect(message(draftsRequestSchema.safeParse({ choices: [id, id] }))).toBe(
      "Each choice once",
    );
  });
});

describe("rejectionRequestSchema", () => {
  const columns = [randomUUID()];

  it("keeps a rejection's reason trimmed", () => {
    expect(
      rejectionRequestSchema.safeParse({ columns, reason: " Not now " }).data
        ?.reason,
    ).toBe("Not now");
  });

  it("needs a reason", () => {
    expect(
      rejectionRequestSchema.safeParse({ columns, reason: " " }).success,
    ).toBe(false);
  });

  it("needs drafts", () => {
    expect(
      message(rejectionRequestSchema.safeParse({ reason: "Not now" })),
    ).toBe(`Choose from 1 to ${String(draftsAtOnce)} drafts`);
  });
});

describe("approving by area", () => {
  const release = { type: "release" as const, id: randomUUID() };
  const stream = { type: "release-stream" as const, id: randomUUID() };
  const everyKind = draftsRequestSchema.parse({
    people: [randomUUID()],
    plannedHires: [randomUUID()],
    featureTeams: [randomUUID()],
    lists: [randomUUID()],
    choices: [randomUUID()],
    orders: [randomUUID()],
    columns: [randomUUID()],
    records: [
      release,
      stream,
      ...(
        [
          "cycle-pattern",
          "feature",
          "customer",
          "proposal",
          "project",
          "milestone",
          "activity",
          "allocation",
        ] as const
      ).map((type) => ({ type, id: randomUUID() })),
      { type: "planning-settings", id: planningSettingsId },
    ],
  });

  it("approves each kind with an Approve permission on the Roles grid", () => {
    const approving = new Set(
      permissionGrid.flatMap(({ actions }) =>
        actions.approve === undefined ? [] : [actions.approve],
      ),
    );
    for (const kind of draftKinds) {
      // The kind is always one of the fixed list.
      // eslint-disable-next-line security/detect-object-injection
      for (const permission of approvePermissions[kind]) {
        expect(approving).toContain(permission);
      }
    }
  });

  it("finds every kind asked for, and none when nothing is", () => {
    expect(kindsAsked(everyKind)).toEqual([...draftKinds]);
    expect(
      kindsAsked(draftsRequestSchema.parse({ records: [release] })),
    ).toEqual(["release"]);
  });

  it("keeps only the drafts of the kinds wanted", () => {
    expect(draftsWhere(everyKind, (kind) => kind === "release-stream")).toEqual(
      {
        people: [],
        plannedHires: [],
        featureTeams: [],
        lists: [],
        choices: [],
        orders: [],
        columns: [],
        records: [stream],
      },
    );
    expect(draftsWhere(everyKind, () => true)).toEqual(everyKind);
  });

  it("names the kinds some permissions approve", () => {
    expect(approvableKinds(["people:approve", "features:approve"])).toEqual([
      "person",
      "release",
      "feature",
      "activity",
    ]);
    expect(approvableKinds(["plan:approve", "people:view"])).toEqual([
      "release-stream",
      "cycle-pattern",
      "customer",
      "proposal",
      "project",
      "milestone",
    ]);
    expect(approvableKinds(["features:edit", "people:view"])).toEqual([]);
  });

  it("refuses taking along a draft the role does not approve, naming it and the permission it needs", () => {
    expect(
      takenAlongRefusal(
        ["features:approve"],
        "field",
        "the new column Fictional Score",
      ),
    ).toBe(
      "Approving this also approves the new column Fictional Score, which needs Approve Configuration.",
    );
  });

  it("names each permission that would do, when any of several approves the kind", () => {
    expect(
      takenAlongRefusal([], "release-stream", "the schedule Fictional"),
    ).toBe(
      "Approving this also approves the schedule Fictional, which needs Approve Plan or Approve Configuration.",
    );
  });

  it("lets a role that approves the kind take it along", () => {
    expect(
      takenAlongRefusal(
        ["features:approve", "configuration:approve"],
        "field",
        "the new column Fictional Score",
      ),
    ).toBeUndefined();
  });
});

describe("naming a record", () => {
  it("takes a record's identifier, or the planning settings' name", () => {
    for (const id of [randomUUID(), planningSettingsId]) {
      expect(recordRefSchema.safeParse({ type: "release", id }).success).toBe(
        true,
      );
    }
  });

  it("refuses any other name", () => {
    expect(
      recordRefSchema.safeParse({ type: "release", id: "settings" }).success,
    ).toBe(false);
  });
});

describe("the keys of the drafts asked for", () => {
  it("names each by its kind and its record's identifier, of every kind asked for", () => {
    expect(
      draftKeysOf({
        people: ["p"],
        plannedHires: ["h"],
        featureTeams: ["t"],
        lists: ["l"],
        choices: ["c"],
        orders: ["o"],
        columns: ["f"],
        records: [{ type: "release", id: "r" }],
      }),
    ).toEqual([
      "person p",
      "planned-hire h",
      "feature-team t",
      "list l",
      "list-item c",
      "choice-order o",
      "field f",
      "release r",
    ]);
  });

  it("names none of the kinds not asked for", () => {
    expect(draftKeysOf({ columns: ["f"] })).toEqual(["field f"]);
  });
});

describe("the record a draft's key names", () => {
  it("splits the key at its first space, keeping any later ones in the identifier", () => {
    expect(fromDraftKey("choice-order list 1")).toEqual({
      recordType: "choice-order",
      recordId: "list 1",
    });
  });
});

describe("the drafts a user changed, which need another approver", () => {
  const change = (
    recordId: string,
    makerId: string | null,
    kind = "change",
    draft = true,
  ) => ({ recordId, draft, kind, makerId });
  const kinds = {
    resets: new Set(["approval", "discard"]),
    changesNothing: new Set(["rejection", "resubmission"]),
  };

  it("names a record whose draft the user changed", () => {
    expect(draftsChangedBy([change("r1", "u1")], "u1", kinds)).toEqual(
      new Set(["r1"]),
    );
  });

  it("leaves out drafts others or Fathom itself changed", () => {
    expect(
      draftsChangedBy([change("r1", "u2"), change("r2", null)], "u1", kinds),
    ).toEqual(new Set());
  });

  it("leaves out a change the user made that drafted nothing", () => {
    expect(
      draftsChangedBy([change("r1", "u1", "change", false)], "u1", kinds),
    ).toEqual(new Set());
  });

  it("starts again once a draft is approved or discarded", () => {
    expect(
      draftsChangedBy(
        [
          change("r1", "u1"),
          change("r1", "u2", "approval"),
          change("r2", "u1"),
          change("r2", "u2", "discard"),
        ],
        "u1",
        kinds,
      ),
    ).toEqual(new Set());
  });

  it("counts a change made after the last approval", () => {
    expect(
      draftsChangedBy(
        [change("r1", "u2", "approval"), change("r1", "u1")],
        "u1",
        kinds,
      ),
    ).toEqual(new Set(["r1"]));
  });

  it("neither counts nor resets on rejecting or resubmitting, which change nothing", () => {
    expect(
      draftsChangedBy(
        [
          change("r1", "u1"),
          change("r1", "u1", "rejection"),
          change("r1", "u1", "resubmission"),
          change("r2", "u1", "rejection"),
          change("r2", "u1", "resubmission"),
        ],
        "u1",
        kinds,
      ),
    ).toEqual(new Set(["r1"]));
  });
});

// A list, a choice added to it, and a person given the choice, each using the one before.
const uses = new Map([
  ["list sites", []],
  ["list-item north", ["list sites"]],
  ["person avery", ["list-item north"]],
  ["person blake", []],
]);

describe("the changes that go with those chosen", () => {
  it("publishes a change with every change it uses, the whole way along", () => {
    expect([...withNeeded(uses, ["person avery"])].sort()).toEqual([
      "list sites",
      "list-item north",
      "person avery",
    ]);
  });

  it("discards a change with every change that uses it, the whole way along", () => {
    expect([...withUsers(uses, ["list sites"])].sort()).toEqual([
      "list sites",
      "list-item north",
      "person avery",
    ]);
  });

  it("takes each change once, though changes go with each other both ways", () => {
    const together = new Map([
      ["person a", ["person b"]],
      ["person b", ["person a"]],
    ]);
    expect([...withNeeded(together, ["person a"])]).toEqual([
      "person a",
      "person b",
    ]);
  });

  it("takes nothing more with a change nothing uses and that uses nothing", () => {
    expect([...withNeeded(uses, ["person blake"])]).toEqual(["person blake"]);
    expect([...withUsers(uses, ["person blake"])]).toEqual(["person blake"]);
  });
});
