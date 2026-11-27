// SPDX-License-Identifier: Apache-2.0

// Tests for the drafts an Approver approves or rejects at once, the area each kind belongs to,
// which drafts a user changed, and which of a user's unpublished changes go with those chosen.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { permissionGrid } from "./access.ts";
import {
  approvableKinds,
  type DraftChange,
  draftsChangedBy,
  isDraftKind,
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
  inCountedOrder,
  standingChanges,
  draftKey,
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

describe("a kind of record as stored", () => {
  it("is a kind of draft when Fathom keeps drafts of it", () => {
    expect(isDraftKind("person")).toBe(true);
    expect(isDraftKind("saved-view")).toBe(false);
  });
});

// The server's kinds of change set that start again who changed a draft, and those that change
// nothing of it.
const kinds = {
  resets: new Set(["approval", "discard"]),
  changesNothing: new Set(["rejection", "resubmission"]),
};

describe("the changes standing on a draft, by every way change sets arise", () => {
  // Dan adds the record; Uma changes it. A change counts for the reader once published, or while it
  // is the reader's own, held: "own" is Uma reading her own, "other" anyone else.
  // A change at its place among a scenario's, which a change taking it back names by that place.
  const row = (
    makerId: string,
    kind: string,
    counts: boolean,
    field = "name",
    recordId = "r1",
  ) => ({
    recordType: "person",
    recordId,
    field,
    draft: kind !== "approval",
    kind,
    makerId,
    counts,
    takes: undefined as number | undefined,
  });
  // A change given up, taking back the scenario's change at the place given.
  const givenUp = (takes: number, field = "name") => ({
    ...row("uma", "given-up", false, field),
    takes,
  });
  const placed = (rows: readonly ReturnType<typeof row>[]): DraftChange[] =>
    rows.map(({ takes, ...change }, place) => ({
      ...change,
      id: place,
      takesBack: takes ?? null,
    }));
  const added = row("dan", "edit", true);
  const scenarios: [string, ReturnType<typeof row>[], string[]][] = [
    ["a published change", [added, row("uma", "edit", true)], ["dan", "uma"]],
    [
      "a private change, own",
      [added, row("uma", "edit", true)],
      ["dan", "uma"],
    ],
    ["a private change, other", [added, row("uma", "edit", false)], ["dan"]],
    [
      "a private change given up, then published",
      [added, row("uma", "edit", true), givenUp(1)],
      ["dan"],
    ],
    [
      "a private change given up, still held",
      [added, row("uma", "edit", false), givenUp(1)],
      ["dan"],
    ],
    [
      "a whole record given up",
      [
        added,
        row("uma", "edit", true, "name"),
        row("uma", "edit", true, "site"),
        givenUp(1, "name"),
        givenUp(2, "site"),
      ],
      ["dan"],
    ],
    [
      "a private removal of a live record, other",
      [added, row("uma", "edit", false)],
      ["dan"],
    ],
    [
      "a private removal of a draft-only record, own",
      [added, row("uma", "discard", true)],
      [],
    ],
    [
      "a private removal of a draft-only record, other",
      [added, row("uma", "discard", false)],
      ["dan"],
    ],
    [
      "that removal given up, its set published since",
      [added, row("uma", "discard", true), givenUp(1)],
      ["dan"],
    ],
    [
      "that removal given up, its set still held",
      [added, row("uma", "discard", false), givenUp(1)],
      ["dan"],
    ],
    [
      "that removal discarded by choice, its sets published since",
      [
        added,
        row("uma", "discard", true),
        givenUp(1),
        row("uma", "edit", true),
      ],
      ["dan", "uma"],
    ],
    [
      "that removal discarded with everything, never published",
      [added, row("uma", "discard", false)],
      ["dan"],
    ],
    [
      "a removal given up on publishing, after the same field of another record",
      [
        added,
        row("uma", "discard", true, "name"),
        row("uma", "edit", true, "name", "r2"),
        givenUp(1),
      ],
      ["dan"],
    ],
    [
      "a removal discarded by choice, after the same field of another record",
      [
        added,
        row("uma", "discard", true, "name"),
        row("uma", "edit", true, "name", "r2"),
        givenUp(1),
        row("uma", "edit", true, "name"),
      ],
      ["dan", "uma"],
    ],
    [
      "a private removal undone, then published",
      [
        added,
        row("uma", "discard", true, "name"),
        givenUp(1),
        row("uma", "edit", true, "name"),
      ],
      ["dan", "uma"],
    ],
    [
      "a change withdrawn because its record went",
      [row("uma", "edit", false), row("uma", "gone", false)],
      [],
    ],
    [
      "a change left for a role that may publish it",
      [added, row("uma", "edit", false)],
      ["dan"],
    ],
    ["an undo, held", [added, row("dan", "edit", false)], ["dan"]],
    [
      "an approval, then a change",
      [added, row("ann", "approval", true), row("uma", "edit", true)],
      ["uma"],
    ],
    [
      "a rejection and resubmission, which change nothing",
      [added, row("ann", "rejection", true), row("dan", "resubmission", true)],
      ["dan"],
    ],
  ];

  it.each(scenarios)("after %s", (_, rows, counted) => {
    const standing =
      standingChanges(placed(rows), kinds).get(draftKey("person", "r1")) ?? [];
    expect(
      [
        ...new Set(
          standing.filter(({ counts }) => counts).map(({ makerId }) => makerId),
        ),
      ].sort(),
    ).toEqual(counted);
  });
});

describe("who changed a draft, counting each change from when others could see it", () => {
  // A change set's change to Kai, made at a moment, and published at one, or still private.
  const at = (
    makerId: string | null,
    kind: string,
    madeAtMicros: number,
    publishedAtMicros: number | null,
    recordId = "kai",
  ) => ({
    id: madeAtMicros,
    recordType: "person",
    recordId,
    field: "name",
    counts: true,
    takesBack: null,
    kind,
    makerId,
    draft: kind !== "approval",
    madeAtMicros,
    publishedAtMicros,
  });
  // Everyone who changed Kai's draft, of those who might have.
  const changedBy = (rows: ReturnType<typeof at>[]) =>
    ["ana", "ann", "dan", "uma"].filter((userId) =>
      draftsChangedBy(inCountedOrder(rows, kinds), userId, kinds).has("kai"),
    );
  const cases: [string, ReturnType<typeof at>[], string[]][] = [
    [
      "a change saved privately before an approval of another's change, published after it",
      [
        at("ana", "edit", 1, 1),
        at("dan", "edit", 2, 4),
        at("ann", "approval", 3, 3),
      ],
      ["dan"],
    ],
    [
      "a change saved privately before another's change and its approval, published after both",
      [
        at("dan", "edit", 1, 4),
        at("ana", "edit", 2, 2),
        at("ann", "approval", 3, 3),
      ],
      ["dan"],
    ],
    [
      "another's private discard published before an earlier-saved change is",
      [
        at("dan", "edit", 1, 5),
        at("uma", "edit", 2, 4),
        at("uma", "discard", 3, 4),
      ],
      ["dan"],
    ],
    [
      "a maker's own change, covered by their own discard published with it",
      [
        at("dan", "edit", 1, 3),
        at("dan", "discard", 2, 3),
        at("ana", "edit", 4, 4),
      ],
      ["ana"],
    ],
    [
      "another's change, published before a maker's stale private discard is",
      [
        at("dan", "edit", 1, 4),
        at("dan", "discard", 2, 4),
        at("ana", "edit", 3, 3),
      ],
      ["ana"],
    ],
    [
      "a change, not covered by its maker's discard of another record",
      [
        at("dan", "edit", 1, 3),
        at("dan", "discard", 2, 3, "lee"),
        at("ann", "approval", 0, 0),
      ],
      ["dan"],
    ],
    [
      "a fill taken out of the record, recorded as the discarder's edit beside the discard",
      [at("dan", "edit", 1, 1), at("dan", "edit", 2, 2)],
      ["dan"],
    ],
    [
      "a change approved since it was published",
      [at("dan", "edit", 1, 2), at("ann", "approval", 3, 3)],
      [],
    ],
  ];

  it.each(cases)("after %s", (_, rows, changed) => {
    expect(changedBy(rows)).toEqual(changed);
  });

  it("never covers a change Fathom itself made with a decision of its own", () => {
    const rows = [
      at(null, "edit", 1, 5),
      at(null, "discard", 2, 5),
      at("ann", "approval", 3, 3),
    ];
    expect(inCountedOrder(rows, kinds).map(({ id }) => id)).toEqual([2, 3, 1]);
  });

  it("leaves a published change where it was published, uncovered by its maker's later discard still private", () => {
    const rows = [
      at("dan", "discard", 5, null),
      at("ann", "approval", 3, 3),
      at("dan", "edit", 2, 4),
    ];
    expect(inCountedOrder(rows, kinds).map(({ id }) => id)).toEqual([3, 2, 5]);
  });

  it("counts the reader's own changes still private last, then as made", () => {
    const rows = [
      at("dan", "edit", 1, null),
      at("ann", "approval", 3, 3),
      at("ana", "edit", 2, 2),
      { ...at("ana", "edit", 2, 2), id: 0 },
    ];
    expect(inCountedOrder(rows, kinds).map(({ id }) => id)).toEqual([
      0, 2, 3, 1,
    ]);
  });
});

describe("the drafts a user changed, which need another approver", () => {
  const change = (
    recordId: string,
    makerId: string | null,
    kind = "change",
    draft = true,
    field = "name",
    counts = true,
  ) => ({
    recordType: "person",
    recordId,
    field,
    draft,
    kind,
    makerId,
    counts,
    takesBack: null as number | null,
  });
  // A change given up, taking back the change at the place given.
  const givenUp = (recordId: string, field: string, takes: number) => ({
    ...change(recordId, "u1", "given-up", true, field, false),
    takesBack: takes,
  });
  // The changes given, each at its place in the history.
  const placed = (rows: readonly ReturnType<typeof change>[]) =>
    rows.map((row, id) => ({ ...row, id }));
  const changedBy = (rows: readonly ReturnType<typeof change>[]) =>
    draftsChangedBy(placed(rows), "u1", kinds);

  it("names a record whose draft the user changed", () => {
    expect(changedBy([change("r1", "u1")])).toEqual(new Set(["r1"]));
  });

  it("leaves out drafts others or Fathom itself changed", () => {
    expect(changedBy([change("r1", "u2"), change("r2", null)])).toEqual(
      new Set(),
    );
  });

  it("leaves out a change the user made that drafted nothing", () => {
    expect(changedBy([change("r1", "u1", "change", false)])).toEqual(new Set());
  });

  it("starts again once a draft is approved or discarded", () => {
    expect(
      changedBy([
        change("r1", "u1"),
        change("r1", "u2", "approval"),
        change("r2", "u1"),
        change("r2", "u2", "discard"),
      ]),
    ).toEqual(new Set());
  });

  it("counts a change made after the last approval", () => {
    expect(
      changedBy([change("r1", "u2", "approval"), change("r1", "u1")]),
    ).toEqual(new Set(["r1"]));
  });

  it("stops counting a field the user gave up, and a record once every field is", () => {
    expect(
      changedBy([
        change("r1", "u1", "change", true, "name"),
        change("r1", "u1", "change", true, "site"),
        givenUp("r1", "site", 1),
        change("r2", "u1", "change", true, "site"),
        givenUp("r2", "site", 3),
      ]),
    ).toEqual(new Set(["r1"]));
  });

  it("still counts a change the user published before giving up a later one to the field", () => {
    expect(
      changedBy([
        change("r1", "u1", "change", true, "site"),
        change("r1", "u2", "change", true, "site"),
        change("r1", "u1", "change", true, "site"),
        givenUp("r1", "site", 2),
      ]),
    ).toEqual(new Set(["r1"]));
  });

  it("takes back only the change a change given up names", () => {
    // Given a published change, then a private one still held back in its change set, given up
    expect(
      changedBy([
        change("r1", "u1", "change", true, "site"),
        change("r1", "u1", "change", true, "site", false),
        givenUp("r1", "site", 1),
      ]),
    ).toEqual(new Set(["r1"]));
  });

  it("takes back each of several private changes to a field with a change given up for each", () => {
    expect(
      changedBy([
        change("r1", "u1", "change", true, "site"),
        change("r1", "u1", "change", true, "site"),
        givenUp("r1", "site", 0),
        givenUp("r1", "site", 1),
      ]),
    ).toEqual(new Set());
  });

  it("neither resets nor counts on a discard that doesn't count, such as another user's private one", () => {
    expect(
      changedBy([
        change("r1", "u1"),
        change("r1", "u2", "discard", true, "name", false),
      ]),
    ).toEqual(new Set(["r1"]));
  });

  it("leaves out the user's changes that don't count for the reader", () => {
    expect(
      changedBy([change("r1", "u1", "change", true, "site", false)]),
    ).toEqual(new Set());
  });

  it("neither counts nor resets on rejecting or resubmitting, which change nothing", () => {
    expect(
      changedBy([
        change("r1", "u1"),
        change("r1", "u1", "rejection"),
        change("r1", "u1", "resubmission"),
        change("r2", "u1", "rejection"),
        change("r2", "u1", "resubmission"),
      ]),
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
