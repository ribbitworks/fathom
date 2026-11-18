// SPDX-License-Identifier: Apache-2.0

// Tests for the Drafts table's rows and columns: each draft's record, what it does, its state,
// type, area, maker, day and reason; the facts that keep a draft from being decided now, shown
// only to those whose role decides it; the choices each column offers; the page's tabs and which
// drafts each holds; and the drafts a set of rows names.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Entry } from "./draft-entries.ts";
import { keyColumn } from "./record-grid.tsx";
import { applyView, emptyView } from "./table-view.ts";
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
  needsAnotherApprover,
  selectionOf,
  tabsFor,
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
  place: { kind: "person", keyNumber: 1 },
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
  const approverTabs = tabsFor(["person"], true);

  it("offer To decide only to a role that approves drafts, first, and Not published only to one that makes them", () => {
    expect(approverTabs).toEqual(["decide", "unpublished", "all"]);
    expect(tabsFor([], true)).toEqual(["unpublished", "all"]);
    expect(tabsFor(["person"], false)).toEqual(["decide", "all"]);
    expect(tabsFor([], false)).toEqual(["all"]);
  });

  it("are kept in the view beside the rest of it, the first tab named by none", () => {
    // Given a view with a search and another choice of the page's
    const view = {
      ...emptyView,
      search: "fictional",
      choices: { other: "kept" },
    };

    // When it moves to All drafts, then back to the first tab
    const all = viewOnTab(view, "all", approverTabs);
    const back = viewOnTab(all, "decide", approverTabs);

    // Then the tab is named only while it isn't the first, and the rest is kept
    expect(all).toMatchObject({
      search: "fictional",
      choices: { other: "kept", tab: "all" },
    });
    expect(draftsTabOf(all, approverTabs)).toBe("all");
    expect(back.choices).toEqual({ other: "kept" });
    expect(draftsTabOf(back, approverTabs)).toBe("decide");
    expect(
      viewOnTab(emptyView, "decide", approverTabs).choices,
    ).toBeUndefined();
  });

  it("open on the first tab the role sees, whatever tab the view names that it doesn't", () => {
    const named = (tab: string) => ({ ...emptyView, choices: { tab } });
    expect(draftsTabOf(emptyView, ["unpublished", "all"])).toBe("unpublished");
    expect(draftsTabOf(named("decide"), ["unpublished", "all"])).toBe(
      "unpublished",
    );
    expect(draftsTabOf(named("mine"), approverTabs)).toBe("decide");
    expect(draftsTabOf(emptyView, [])).toBe("all");
  });

  it("put drafts to decide now on To decide, one's own changes on Not published, and every published draft on All drafts", () => {
    const [own, decided, other] = draftRows(
      [
        entry("p1", { unpublished: true }),
        entry("p2"),
        entry("p3", { state: "rejected" }),
      ],
      reading,
    );
    const decidesNow = (row: { id: string }) => row.id === "p2";
    const tabsOf = (row: typeof own) =>
      row === undefined
        ? []
        : approverTabs.filter((tab) => isOnTab(tab, row, decidesNow));
    expect(tabsOf(own)).toEqual(["unpublished"]);
    expect(tabsOf(decided)).toEqual(["decide", "all"]);
    expect(tabsOf(other)).toEqual(["all"]);
  });

  it("leave Made by out of Not published", () => {
    const keys = (tab: "unpublished" | "all") =>
      draftColumns([], tab).map(({ key }) => key);
    expect(keys("unpublished")).not.toContain("madeBy");
    expect(keys("all")).toContain("madeBy");
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

describe("the keys of the drafts' records", () => {
  const person = entry("p1", { place: { kind: "person", keyNumber: 12 } });
  const settings = entry("s1", { place: "capacity-settings" });
  const rows = draftRows([person, settings], reading);
  const { keyOf } = draftsTable({ rows, decidable: () => true });

  it("give each row its record's key, and none to the planning settings", () => {
    expect(rows.map((row) => keyOf?.(row))).toEqual([
      { kind: "person", keyNumber: 12 },
      undefined,
    ]);
  });

  it("fill the Key column, hidden at first, empty for the planning settings", () => {
    const column = keyOf && keyColumn(keyOf, rows);
    expect(column?.hiddenAtFirst).toBe(true);
    expect(rows.map((row) => column?.value(row))).toEqual(["12", ""]);
  });

  it("find a record's drafts by its key", () => {
    expect(
      applyView(
        rows,
        draftColumns(rows),
        { ...emptyView, search: "#PERSON-12" },
        [],
        keyOf,
      ).map(({ entry: { key } }) => key),
    ).toEqual(["p1"]);
  });
});
