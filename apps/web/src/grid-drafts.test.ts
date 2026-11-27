// SPDX-License-Identifier: Apache-2.0

// Tests for the waiting drafts a shared table offers to decide, the draft marking a cell, a row's
// state, and the drafts renaming choices a value holds.

import type { Choice, Field, List, Show } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { type DraftSelection, decidable, noDrafts } from "./drafts.ts";
import {
  cellDraftOf,
  choiceRenamings,
  draftColumn,
  renamedValue,
  renamedWas,
  rowState,
  waitingDrafts,
} from "./grid-drafts.ts";
import type { GridDraft, GridRecord } from "./record-table.ts";
import type { CellValue } from "./table-view.ts";

const waiting = { state: "waiting" as const, madeBy: null };
const record = (id: string, more: Partial<GridRecord> = {}): GridRecord => ({
  id,
  draft: { ...waiting, action: "changed", changed: ["name"] },
  ...more,
});
const field = (id: string, draft?: Field["draft"], heldBy?: string) =>
  ({ id, draft, heldBy }) as unknown as Field;
const columnDraft: NonNullable<Field["draft"]> = {
  ...waiting,
  madeAt: null,
  action: "changed",
  changed: [],
  live: {},
};

// A table whose rows are records of one kind, approved by a role approving the kinds given.
const deciding = ({
  approves = true,
  approvesColumns = true,
  draftsOf = (ids: string[]): DraftSelection => ({
    ...noDrafts(),
    people: ids,
  }),
}: {
  approves?: boolean;
  approvesColumns?: boolean;
  draftsOf?: (ids: string[]) => DraftSelection;
} = {}) => ({
  decidableRow: decidable,
  approvesRecord: () => approves,
  approvesColumn: () => approvesColumns,
  draftsOf,
});

describe("the waiting drafts a table offers to decide", () => {
  it("takes each record's and column's waiting draft", () => {
    expect(
      waitingDrafts(
        [record("p1"), record("p2")],
        [field("f1", columnDraft)],
        deciding(),
      ),
    ).toEqual({ ...noDrafts(), people: ["p1", "p2"], columns: ["f1"] });
  });

  it.each([
    ["held by someone else", { heldBy: "Fictional Holder" }],
    [
      "not yet published",
      {
        draft: {
          ...waiting,
          action: "changed" as const,
          changed: [],
          unpublished: true,
        },
      },
    ],
    [
      "rejected",
      {
        draft: {
          ...waiting,
          state: "rejected" as const,
          action: "changed" as const,
          changed: [],
        },
      },
    ],
    ["with no draft", { draft: undefined }],
  ])("leaves out a record's draft %s", (_case, more) => {
    expect(waitingDrafts([record("p1", more)], [], deciding()).people).toEqual(
      [],
    );
  });

  it("leaves out records and columns of kinds the role doesn't approve", () => {
    expect(
      waitingDrafts(
        [record("p1")],
        [field("f1", columnDraft)],
        deciding({ approves: false, approvesColumns: false }),
      ),
    ).toEqual(noDrafts());
  });

  it("leaves out a column's draft that someone else holds", () => {
    expect(
      waitingDrafts(
        [],
        [field("f1", columnDraft, "Fictional Holder")],
        deciding(),
      ).columns,
    ).toEqual([]);
  });
});

describe("the draft that marks a cell", () => {
  const drafts = new Map([
    ["release", "the release's draft"],
    ["releaseColour", "the colour's draft"],
  ]);

  it("is the one by the column's key, else by the column its values follow from", () => {
    expect([
      cellDraftOf(drafts, { key: "release", changesWith: "releaseColour" }),
      cellDraftOf(new Map([["releaseColour", "the colour's draft"]]), {
        key: "release",
        changesWith: "releaseColour",
      }),
    ]).toEqual(["the release's draft", "the colour's draft"]);
  });

  it("is none for a column no other record's draft changes", () => {
    expect([
      cellDraftOf(drafts, { key: "name" }),
      cellDraftOf(undefined, { key: "release" }),
    ]).toEqual([undefined, undefined]);
  });
});

describe("a row's state", () => {
  const rejected = { state: "rejected" as const };

  it("waits while its own draft, or one marking its values, waits", () => {
    expect([
      rowState(rejected, new Map([["code", waiting]])),
      rowState(waiting, new Map([["code", rejected]])),
    ]).toEqual(["waiting", "waiting"]);
  });

  it("is rejected only once every draft was", () => {
    expect([
      rowState(rejected, undefined),
      rowState(rejected, new Map([["code", rejected]])),
      rowState(undefined, undefined),
    ]).toEqual(["rejected", "rejected", undefined]);
  });
});

describe("the drafts renaming choices", () => {
  const renaming = (
    id: string,
    more: Partial<NonNullable<Choice["draft"]>> = {},
  ): Choice => ({
    id,
    label: `Renamed ${id}`,
    description: "",
    retired: false,
    draft: {
      ...waiting,
      madeAt: null,
      action: "changed",
      changed: ["label"],
      live: { label: id },
      ...more,
    },
  });
  const listOf = (choices: Choice[]) =>
    ({ id: "l1", choices }) as unknown as List;

  it("are each choice's draft changing its name, with who changed it and its live name", () => {
    const renamings = choiceRenamings([
      listOf([
        renaming("c1", { changedBy: { label: "Fictional Editor" } }),
        renaming("c2", { changedBy: { label: null } }),
        renaming("c3"),
        renaming("c4", { changed: ["description"] }),
        { ...renaming("c5"), draft: undefined },
      ]),
    ]);
    expect([...renamings]).toEqual([
      [
        "c1",
        {
          draft: { action: "changed", state: "waiting" },
          by: "Fictional Editor",
          live: "c1",
        },
      ],
      [
        "c2",
        {
          draft: { action: "changed", state: "waiting" },
          by: "Fathom",
          live: "c2",
        },
      ],
      [
        "c3",
        {
          draft: { action: "changed", state: "waiting" },
          by: undefined,
          live: "c3",
        },
      ],
    ]);
  });

  const renamings = new Map([
    [
      "c1",
      {
        draft: { state: "rejected" as const },
        by: "Fictional Editor",
        live: "Teal",
      },
    ],
    [
      "c2",
      { draft: { state: "waiting" as const }, by: undefined, live: "Sea" },
    ],
    [
      "c4",
      {
        draft: { state: "waiting" as const },
        by: "Fictional Planner",
        live: "Rust",
      },
    ],
  ]);
  const choiceOf = (id: string, label: string) => ({
    id,
    label,
    description: "",
    retired: false,
  });
  const column = {
    key: "f1",
    choices: [
      choiceOf("c1", "Sea teal"),
      choiceOf("c2", "Ocean"),
      choiceOf("c3", "Coral"),
      choiceOf("c4", "Ember"),
    ],
  };
  const named = (value: CellValue, marked?: GridDraft, shown: Show = "both") =>
    renamedValue(renamings, column, value, marked, shown);

  it("mark a value holding one choice, or several, by a waiting one first", () => {
    expect([
      named("c1")?.by,
      named(["c1", "c2"])?.draft.state,
      named(["c3"]),
      named(null),
    ]).toEqual(["Fictional Editor", "waiting", undefined, undefined]);
  });

  it("credit every one who renamed a choice the value holds", () => {
    expect(named(["c1", "c2", "c4"])?.by).toBe(
      "Fictional Editor and Fictional Planner",
    );
  });

  it("mark nothing in a column with no choices", () => {
    expect(
      renamedValue(
        renamings,
        { key: "f1", choices: [] },
        "c1",
        undefined,
        "both",
      ),
    ).toBeUndefined();
  });

  it("say what a value was with each renamed choice under its live name", () => {
    expect(
      renamedWas({ ...column, kind: "choice" }, ["c1", "c3"], renamings),
    ).toBe("“Teal, Coral”");
  });

  it("leave a value its record's draft changes, or a cell marking its own parts, to those", () => {
    const changing = (state: "waiting" | "rejected"): GridDraft => ({
      ...waiting,
      state,
      action: "changed",
      changed: ["f1"],
    });
    expect([
      named("c1", changing("waiting")),
      named("c1", changing("rejected")),
      renamedValue(
        renamings,
        { ...column, marksParts: true },
        "c1",
        undefined,
        "both",
      ),
    ]).toEqual([undefined, undefined, undefined]);
  });

  it("mark a value whose record's rejected draft the view leaves out", () => {
    const rejected: GridDraft = {
      ...waiting,
      state: "rejected",
      action: "changed",
      changed: ["f1"],
    };
    expect([
      named("c4", rejected, "drafts")?.by,
      named("c4", rejected, "live")?.by,
    ]).toEqual(["Fictional Planner", "Fictional Planner"]);
  });
});

describe("the Draft filter's state of a record", () => {
  it("is its row's state, waiting while a draft marking one of its values waits", () => {
    const rejectedOwn = record("r1", {
      draft: { ...waiting, state: "rejected", action: "changed", changed: [] },
      cellDrafts: new Map([
        ["code", { ...waiting, action: "changed", changed: ["code"] }],
      ]),
    });
    expect([
      draftColumn.value(rejectedOwn),
      draftColumn.value(record("r2", { draft: undefined })),
    ]).toEqual([["waiting"], []]);
  });
});
