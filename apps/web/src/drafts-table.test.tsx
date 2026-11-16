// SPDX-License-Identifier: Apache-2.0

// Tests for the Drafts table's rows and columns: each draft's record, what it does, its state,
// type, area, maker, day and reason; the facts that keep a draft from being decided now, shown
// only to those whose role decides it; the choices each column offers; and the drafts a set of
// rows names.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Entry } from "./draft-entries.ts";
import { emptyView } from "./table-view.ts";
import { testTheme } from "./test-support.tsx";
import { noDrafts } from "./drafts.ts";
import {
  areaOf,
  draftColumns,
  draftRows,
  draftsTable,
  draftsTabOf,
  viewOnTab,
  isOnTab,
  mineToDecide,
  mineToDecideChoice,
  needsAnotherApprover,
  selectionOf,
  waitsOnRejected,
} from "./drafts-table.tsx";

const entry = (key: string, more: Partial<Entry> = {}): Entry => ({
  key,
  madeAt: "2026-11-01T10:00:00.000Z",
  action: "changed",
  state: "waiting",
  who: "Fictional Editor",
  kind: "person",
  name: `Fictional ${key}`,
  details: [[{ strong: "Start" }, " set to ", { value: "Nov 2, 2026" }]],
  reason: undefined,
  unpublished: false,
  heldBy: undefined,
  needsOtherApprover: false,
  place: { page: "people", open: `E-${key}` },
  selects: { ...noDrafts(), people: [key] },
  ...more,
});

const reading = {
  waits: ({ key }: Entry) => key === "waits",
  choosable: ({ key }: Entry) => key !== "not-ours",
};

describe("a draft's row", () => {
  it("names its record, what it does and changes, its type, area, maker and day", () => {
    const [row] = draftRows([entry("p1")], reading);
    expect(row).toMatchObject({
      id: "p1",
      record: "Fictional p1",
      change: "Changed",
      state: "Waiting",
      changes: "Start set to Nov 2, 2026",
      type: "Person",
      area: "People",
      madeBy: "Fictional Editor",
      drafted: "2026-11-01",
      reason: "",
      facts: [],
    });
  });

  it("says a new order reorders, and a draft not published is Not published", () => {
    const rows = draftRows(
      [
        entry("o1", { action: undefined, kind: "choice-order" }),
        entry("p2", { action: "created", unpublished: true }),
        entry("p3", { action: "deleted" }),
      ],
      reading,
    );
    expect(rows.map(({ change, state }) => [change, state])).toEqual([
      ["Reordered", "Waiting"],
      ["Added", "Not published"],
      ["Removed", "Waiting"],
    ]);
    // A new order is drawn as a change of its list.
    expect(rows[0]?.draft.action).toBe("changed");
  });

  it("gives a rejected draft its reason, and one with no time recorded no day", () => {
    const [row] = draftRows(
      [
        entry("p4", {
          state: "rejected",
          reason: "Fictional reason",
          madeAt: null,
        }),
      ],
      reading,
    );
    expect(row).toMatchObject({
      state: "Rejected",
      reason: "Fictional reason",
      drafted: "",
    });
  });

  it("says why a draft the role decides can't be decided yet", () => {
    const rows = draftRows(
      [entry("waits"), entry("p5", { needsOtherApprover: true })],
      reading,
    );
    expect(rows.map(({ facts }) => facts)).toEqual([
      [waitsOnRejected],
      [needsAnotherApprover],
    ]);
  });

  it.each([
    ["of a kind the role doesn't decide", entry("not-ours")],
    ["rejected", entry("waits", { state: "rejected" })],
    ["not published", entry("waits", { unpublished: true })],
  ])("names no facts for a draft %s", (_case, one) => {
    expect(draftRows([one], reading)[0]?.facts).toEqual([]);
  });
});

describe("each draft's area", () => {
  it("is the area whose Approvers decide it, as a heading names it", () => {
    expect(
      (["person", "field", "release", "milestone"] as const).map(areaOf),
    ).toEqual(["People", "Configuration", "Features and releases", "The plan"]);
  });
});

describe("the Drafts table's columns", () => {
  const rows = draftRows(
    [
      entry("p1", { who: "Zed Fictional" }),
      entry("l1", { kind: "list", who: "Ann Fictional" }),
      entry("p2", { who: "Zed Fictional" }),
    ],
    reading,
  );
  const columns = draftColumns(rows);
  const choicesOf = (key: string) =>
    columns
      .find((column) => column.key === key)
      ?.choices.map(({ label }) => label);

  it("are in the table's order, with State beside Change", () => {
    expect(columns.map(({ label }) => label)).toEqual([
      "Record",
      "Change",
      "State",
      "What changes",
      "Type",
      "Area",
      "Made by",
      "Drafted",
      "Reason",
    ]);
  });

  it("offer the types and areas the rows hold, in their order, and the makers by name", () => {
    expect(choicesOf("type")).toEqual(["Person", "List"]);
    expect(choicesOf("area")).toEqual(["People", "Configuration"]);
    expect(choicesOf("madeBy")).toEqual(["Ann Fictional", "Zed Fictional"]);
  });

  it("put a record's facts after it", () => {
    const [waits] = draftRows([entry("waits")], reading);
    const record = draftColumns([]).find(({ key }) => key === "record");
    render(
      <MantineProvider theme={testTheme}>
        {waits && record?.mark?.(waits)}
      </MantineProvider>,
    );
    expect(screen.getByText(waitsOnRejected)).toBeDefined();
    expect(rows[0] && record?.mark?.(rows[0])).toBe(false);
  });
});

describe("the page's tabs", () => {
  it("are kept in the view, My changes dropping Mine to decide and For approval keeping the rest", () => {
    const view = {
      ...emptyView,
      search: "fictional",
      choices: { decide: mineToDecide },
    };
    const mine = viewOnTab(view, "mine");
    expect(mine).toMatchObject({
      search: "fictional",
      choices: { tab: "mine" },
    });
    expect(draftsTabOf(mine)).toBe("mine");
    const back = viewOnTab(mine, "approval");
    expect(back.choices).toBeUndefined();
    expect(draftsTabOf(back)).toBe("approval");
    expect(draftsTabOf(emptyView)).toBe("approval");
  });

  it("put one's own unpublished changes on My changes, and the rest for approval", () => {
    const [own, others] = draftRows(
      [entry("p1", { unpublished: true }), entry("p2")],
      reading,
    );
    expect(own && [isOnTab("mine", own), isOnTab("approval", own)]).toEqual([
      true,
      false,
    ]);
    expect(
      others && [isOnTab("mine", others), isOnTab("approval", others)],
    ).toEqual([false, true]);
  });

  it("leave Made by out of My changes", () => {
    expect(draftColumns([], "mine").some(({ key }) => key === "madeBy")).toBe(
      false,
    );
  });
});

describe("Mine to decide", () => {
  const choice = mineToDecideChoice(3);

  it("counts the drafts to decide, and is kept in the view beside the page's other choices", () => {
    expect(choice.label).toBe("Mine to decide");
    expect(choice.count).toBe(3);
    const view = { ...emptyView, choices: { other: "kept" } };
    const on = choice.turned(view, true);
    expect(on.choices).toEqual({ other: "kept", decide: mineToDecide });
    expect(choice.on(on)).toBe(true);
    expect(choice.turned(on, false).choices).toEqual({ other: "kept" });
  });

  it("leaves no choices once it was the only one", () => {
    const on = choice.turned(emptyView, true);
    expect(choice.turned(on, false).choices).toBeUndefined();
    expect(choice.on(emptyView)).toBe(false);
  });
});

describe("the drafts rows name", () => {
  it("are all of theirs together, which deciding a row asks for", () => {
    const rows = draftRows(
      [entry("p1"), entry("l1", { selects: { ...noDrafts(), lists: ["l1"] } })],
      reading,
    );
    expect(selectionOf(rows)).toEqual({
      ...noDrafts(),
      people: ["p1"],
      lists: ["l1"],
    });
    const table = draftsTable({ rows, decidable: () => true });
    expect(table.drafts(["l1", "gone"])).toEqual({
      ...noDrafts(),
      lists: ["l1"],
    });
    expect(table.groupings?.map(({ key }) => key)).toEqual([
      "change",
      "state",
      "type",
      "area",
      "madeBy",
    ]);
  });
});
