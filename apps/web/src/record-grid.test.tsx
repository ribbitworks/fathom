// SPDX-License-Identifier: Apache-2.0

// Tests for the shared table on its own, with a made-up kind of record, gadgets.

import {
  type DraftKind,
  draftKinds,
  type Field,
  type List,
  draftFilterKey,
} from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { type ReactNode, useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { noDrafts } from "./drafts.ts";
import {
  cellColumn,
  type CellRecord,
  columnWidth,
  type Column,
  type GridDraft,
  wordsColumn,
  countedRecords,
  droppedAfter,
  inOrder,
  keyColumn,
  keyColumnKey,
  liveFields,
  liveRecordsOf,
  newRecordProblems,
  focusRecordCell,
  readOnlyTableParts,
  type RecordActions,
  RecordGrid,
  type RecordTable,
  useTableScroll,
} from "./record-grid.tsx";
import { type RowTicks, withTicks } from "./row-ticks.tsx";
import {
  emptyView,
  formatDay,
  type RowGroup,
  type View,
} from "./table-view.ts";
import {
  choiceUnder,
  choicesUnder,
  recordCell,
  rowActions,
  testTheme,
  tipOn,
} from "./test-support.tsx";

interface Gadget extends CellRecord {
  name: string;
  code: string;
}

// A type, not an interface, as the server's changes are, so it holds any detail by its key.
type GadgetChange = {
  name?: string;
  code?: string;
  values?: Record<string, string[]> | undefined;
};

const colour: Field = {
  id: "f1",
  keyNumber: 1,
  name: "Colour",
  type: "choice" as const,
  listId: "l1",
  visibility: null,
  multiple: false,
  required: false,
  onPlannedHires: true,
};
const colours: List = {
  id: "l1",
  keyNumber: 1,
  name: "Colours",
  description: "",
  visibility: "general",
  retired: false,
  choices: [{ id: "c1", label: "Teal", description: "", retired: false }],
};

const gadgetColumns = (
  fields: readonly Field[],
  lists: readonly List[],
  order: readonly string[],
): Column<Gadget, GadgetChange>[] =>
  inOrder(
    [
      cellColumn<Gadget, GadgetChange>("name", "text", {
        label: "Name",
        required: true,
        choices: [],
        multiple: false,
        maxLength: 10,
      }),
      cellColumn<Gadget, GadgetChange>("code", "text", {
        label: "Code",
        required: false,
        choices: [],
        multiple: false,
      }),
      ...fields.map((field) =>
        cellColumn<Gadget, GadgetChange>(field.id, field.type, {
          label: field.name,
          required: field.required,
          field,
          choices: lists.find(({ id }) => id === field.listId)?.choices ?? [],
          multiple: field.multiple,
        }),
      ),
    ],
    order,
  );

const liveGadgets = (gadgets: readonly Gadget[]) =>
  liveRecordsOf(gadgets, ["name", "code"]);

const waiting = {
  state: "waiting" as const,
  madeBy: "Fictional Maker",
  changed: [] as string[],
  live: { values: {}, links: {} },
};

const gadget = (id: string, more: Partial<Gadget> = {}): Gadget => ({
  id,
  name: `Gadget ${id}`,
  code: id.toUpperCase(),
  values: {},
  links: {},
  ...more,
});

const noop = () => undefined;

function gadgetTable(
  recordProblem: RecordTable<
    Gadget,
    GadgetChange,
    GadgetChange
  >["recordProblem"] = noop,
): RecordTable<Gadget, GadgetChange, GadgetChange> {
  return {
    label: "Gadgets",
    one: "gadget",
    noun: "gadgets",
    newRowLabel: () => "New gadget",
    removeLabel: () => "Remove gadget",
    nameOf: (one) => one.name,
    nameColumn: "name",
    columnsFor: gadgetColumns,
    liveRecords: liveGadgets,
    draftFields: () => [],
    recordProblem,
    request: (changes) => Object.assign({}, ...changes) as GadgetChange,
    drafts: (ids) => ({ ...noDrafts(), lists: ids }),
  };
}

const actions = (
  more: Partial<RecordActions<Gadget, GadgetChange, GadgetChange>> = {},
): RecordActions<Gadget, GadgetChange, GadgetChange> => ({
  add: noop,
  update: noop,
  remove: noop,
  discard: noop,
  resubmit: noop,
  decide: noop,
  editColumn: noop,
  discardColumn: noop,
  resubmitColumn: noop,
  ...more,
});

function renderGadgets({
  gadgets,
  table = gadgetTable(),
  given = actions(),
  view = emptyView,
  onView = noop,
  approves = [],
  canEditColumns = false,
  fields = [colour],
  order = [],
}: {
  gadgets: Gadget[];
  fields?: Field[];
  table?: RecordTable<Gadget, GadgetChange, GadgetChange>;
  given?: RecordActions<Gadget, GadgetChange, GadgetChange>;
  view?: View;
  onView?: (view: View) => void;
  approves?: readonly DraftKind[];
  canEditColumns?: boolean;
  order?: string[];
}) {
  return render(
    <MantineProvider theme={testTheme}>
      <RecordGrid
        records={gadgets}
        table={table}
        fields={fields}
        order={order}
        lists={[colours]}
        canEdit
        approves={approves}
        canEditColumns={canEditColumns}
        view={view}
        onView={onView}
        actions={given}
      />
    </MantineProvider>,
  );
}

const nameThen = (next: Column<Gadget, GadgetChange>) => ({
  ...gadgetTable(),
  columnsFor: () => [...gadgetColumns([], [], []).slice(0, 1), next],
});
const nextColumn = (kind: "date" | "flag" | "text") =>
  cellColumn<Gadget, GadgetChange>("next", kind, {
    label: "Next",
    required: false,
    choices: [],
    multiple: false,
  });

describe("the empty row", () => {
  it("shows no starting value until something is typed in it, then shows and adds it", async () => {
    // Given a column that starts new rows on a value
    const add =
      vi.fn<RecordActions<Gadget, GadgetChange, GadgetChange>["add"]>();
    renderGadgets({
      gadgets: [],
      fields: [],
      table: nameThen({ ...nextColumn("text"), newRowValue: () => "Starter" }),
      given: actions({ add }),
    });
    const next = () => document.getElementById("cell-new-0-next");
    expect(next()?.textContent).toBe("");

    // When a name is typed in the empty row
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Widget{Tab}{Escape}");

    // Then the starting value shows, and is added with the record
    expect(next()?.textContent).toBe("Starter");
    await userEvent.keyboard("{Enter}");
    expect(add.mock.calls.at(0)?.[0].map(({ request }) => request)).toEqual([
      { name: "Widget", next: "Starter" },
    ]);
  });
});

describe("Tab across a new row", () => {
  const typeNameAndTab = async () => {
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Widget{Tab}");
  };
  const focusMovesToNext = () =>
    waitFor(() => {
      expect(document.activeElement?.id).toBe("cell-new-0-next");
    });

  it("moves onto a checkbox without changing it, closing the cell it left", async () => {
    const add =
      vi.fn<RecordActions<Gadget, GadgetChange, GadgetChange>["add"]>();
    renderGadgets({
      gadgets: [],
      fields: [],
      table: nameThen(nextColumn("flag")),
      given: actions({ add }),
    });
    await typeNameAndTab();
    await focusMovesToNext();
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    await userEvent.keyboard("{Enter}");
    expect(add.mock.calls.at(0)?.[0].map(({ request }) => request)).toEqual([
      { name: "Widget", next: false },
    ]);
  });

  it("lays out a date's digits as they are typed, and shows a date once left", async () => {
    renderGadgets({
      gadgets: [],
      fields: [],
      table: nameThen(nextColumn("date")),
    });
    act(() => {
      document.getElementById("cell-new-0-next")?.focus();
    });
    await userEvent.keyboard("203009");
    const editor = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Next",
    });
    expect(editor.value).toBe("2030-09");
    await userEvent.keyboard("01{Tab}");
    expect(document.getElementById("cell-new-0-next")?.textContent).toContain(
      formatDay("2030-09-01"),
    );
  });

  it("moves onto a read-only cell, closing the cell it left", async () => {
    renderGadgets({
      gadgets: [],
      fields: [],
      table: nameThen({ ...nextColumn("text"), readOnly: true }),
    });
    await typeNameAndTab();
    await focusMovesToNext();
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    expect(screen.getByText("Widget")).toBeTruthy();
  });
});

describe("a table of another kind of record", () => {
  it("names the table, its rows, and what none matching are by the table's own words", () => {
    renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, search: "nothing like it" },
    });
    expect(screen.getByRole("grid", { name: "Gadgets" })).toBeTruthy();
    expect(screen.getByRole("row", { name: "New gadget" })).toBeTruthy();
    expect(screen.getByText("No matching gadgets")).toBeTruthy();
  });

  it("names its sort and frozen columns in a Views menu without saved views, removing each", async () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      view: {
        ...emptyView,
        sort: [{ key: "name", descending: false }],
        frozen: 0,
      },
      onView,
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    const menu = await screen.findByRole("menu", { name: /^Views/ });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Name ↑ascending, remove sort",
      "Unfrozen, reset",
      "Clear view",
    ]);
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Unfrozen, reset" }),
    );
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sort: [{ key: "name", descending: false }],
        frozen: undefined,
      }),
    );
  });

  it("counts its records in Metrics by the table's own words", () => {
    const { unmount } = renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, breakdown: [] },
    });
    expect(
      screen.getByRole("region", { name: "Metrics" }).textContent,
    ).toContain("1 gadget");
    unmount();
    renderGadgets({
      gadgets: [gadget("g1"), gadget("g2")],
      view: { ...emptyView, breakdown: [] },
    });
    const panel = screen.getByRole("region", { name: "Metrics" });
    expect(panel.textContent).toContain("2 gadgets");
    expect(panel.textContent).not.toContain("Choose a column to count");
  });

  it("names each record's menu, removes it, and decides its draft through the table's drafts", async () => {
    const remove = vi.fn();
    const decide = vi.fn();
    renderGadgets({
      gadgets: [
        gadget("g1"),
        gadget("g2", { draft: { ...waiting, action: "created" } }),
      ],
      given: actions({ remove, decide }),
      approves: draftKinds,
    });
    await userEvent.click(rowActions("Gadget g1"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove gadget" }),
    );
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }));
    await userEvent.click(rowActions("Gadget g2"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Approve draft…" }),
    );
    expect(decide).toHaveBeenCalledWith("approve", {
      ...noDrafts(),
      lists: ["g2"],
    });
  });

  it("checks a changed record whole, naming the column changed and giving the other records' values and its own before", async () => {
    const recordProblem = vi.fn(
      (
        values: Record<string, unknown>,
        others: () => Record<string, unknown>[],
        changed?: string,
      ) =>
        changed === "code" && others().some(({ code }) => code === values.code)
          ? { message: "Another gadget has that code" }
          : undefined,
    );
    const update = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1"), gadget("g2")],
      table: gadgetTable(recordProblem),
      given: actions({ update }),
    });
    act(() => {
      document.getElementById("cell-g1-code")?.focus();
    });
    await userEvent.keyboard("G2{Enter}");
    expect(screen.getByRole("alert").textContent).toBe(
      "Another gadget has that code",
    );
    expect(update).not.toHaveBeenCalled();
    act(() => {
      document.getElementById("cell-g1-name")?.focus();
    });
    await userEvent.keyboard("Gizmo{Enter}");
    expect(recordProblem).toHaveBeenLastCalledWith(
      { name: "Gizmo", code: "G1", f1: [] },
      expect.any(Function),
      "name",
      { name: "Gadget g1", code: "G1", f1: [] },
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }), {
      name: "Gizmo",
    });
  });

  it("refuses text longer than its column takes, and leaves a column with no limit unchecked", async () => {
    const update = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], given: actions({ update }) });
    act(() => {
      document.getElementById("cell-g1-name")?.focus();
    });
    await userEvent.keyboard("Far too long a name{Enter}");
    expect(screen.getByRole("alert").textContent).toBe("Name too long");
    await userEvent.keyboard("{Escape}");
    act(() => {
      document.getElementById("cell-g1-code")?.focus();
    });
    await userEvent.keyboard("A very long code indeed{Enter}");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }), {
      code: "A very long code indeed",
    });
  });

  it("checks new rows against the records and other new rows, without naming a column changed", async () => {
    const recordProblem = vi.fn(() => undefined);
    const add = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      table: gadgetTable(recordProblem),
      given: actions({ add }),
    });
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.paste("Widget\tW1\nSprocket\tS1");
    expect(recordProblem).toHaveBeenCalledTimes(2);
    expect(recordProblem).toHaveBeenCalledWith(
      { name: "Widget", code: "W1" },
      expect.any(Function),
    );
    const [, others] = recordProblem.mock.calls[0] as unknown as [
      unknown,
      () => unknown[],
    ];
    expect(others()).toContainEqual({ name: "Gadget g1", code: "G1", f1: [] });
    expect(add).toHaveBeenCalledWith(
      [
        {
          id: expect.stringMatching(/^pending-/) as string,
          request: { name: "Widget", code: "W1", values: { f1: [] } },
        },
        {
          id: expect.stringMatching(/^pending-/) as string,
          request: { name: "Sprocket", code: "S1", values: { f1: [] } },
        },
      ],
      expect.any(Function),
      expect.any(Function),
    );
  });
});

describe("a read-only table", () => {
  it("names no new row or removal, finds no draft fields, checks nothing, and refuses to add a record", () => {
    expect([
      readOnlyTableParts.newRowLabel(),
      readOnlyTableParts.removeLabel(),
    ]).toEqual(["", ""]);
    expect(readOnlyTableParts.draftFields()).toEqual([]);
    expect(readOnlyTableParts.recordProblem).not.toThrow();
    expect(() => readOnlyTableParts.request()).toThrow(
      "A read-only table adds no records",
    );
  });
});

describe("the order of the columns", () => {
  it("follows the order given, putting columns it does not name at the end in their usual order", () => {
    expect(
      inOrder([{ key: "a" }, { key: "b" }, { key: "c" }], ["c", "a"]).map(
        ({ key }) => key,
      ),
    ).toEqual(["c", "a", "b"]);
  });
});

describe("the records as they are live", () => {
  it("leave out those only drafted to be added, and put back each detail and column a draft changes", () => {
    expect(
      liveGadgets([
        gadget("g1"),
        gadget("g2", { draft: { ...waiting, action: "created" } }),
        gadget("g3", { draft: { ...waiting, action: "deleted" } }),
        gadget("g4", {
          name: "Renamed",
          values: { f1: ["c1"], f2: ["c2"] },
          links: { f3: { address: "https://example.test/new", text: "" } },
          draft: {
            ...waiting,
            action: "changed",
            changed: ["name", "f1", "f3"],
            live: {
              name: "Gadget g4",
              values: { f1: [] },
              links: { f3: { address: "https://example.test/old", text: "" } },
            },
          },
        }),
      ]),
    ).toEqual([
      gadget("g1"),
      gadget("g3"),
      gadget("g4", {
        values: { f2: ["c2"] },
        links: { f3: { address: "https://example.test/old", text: "" } },
      }),
    ]);
  });
});

describe("the records the metrics count", () => {
  const gadgets = [
    gadget("g1"),
    gadget("g2", { draft: { ...waiting, action: "created" } }),
    gadget("g3", { draft: { ...waiting, action: "deleted" } }),
  ];
  const [column, other] = gadgetColumns([], [], []);

  it("are those shown, unless drafts show beside live", () => {
    for (const show of ["live", "drafts"] as const) {
      expect(
        countedRecords(show, gadgets, [], () => undefined, liveGadgets),
      ).toEqual({ rows: gadgets });
    }
  });

  it("are, with drafts beside live, those not drafted to be removed, and as they are live by each column's live copy", () => {
    const counted = countedRecords(
      "both",
      gadgets,
      [column, other].flatMap((each) => (each ? [each] : [])),
      (each) => (each === column ? each : undefined),
      liveGadgets,
    );
    expect(counted.rows.map(({ id }) => id)).toEqual(["g1", "g2"]);
    expect(counted.live?.rows.map(({ id }) => id)).toEqual(["g1", "g3"]);
    expect(counted.live?.columns).toEqual([column]);
  });
});

describe("where a dragged column goes", () => {
  const keys = ["a", "b", "c"];

  it.each([
    ["a", "c", "c"],
    ["c", "a", null],
    ["c", "b", "a"],
    ["a", "a", undefined],
    ["x", "a", undefined],
  ])("%s dropped on %s follows %s", (moved, onto, after) => {
    expect(droppedAfter(keys, moved, onto)).toBe(after);
  });
});

// Where a frozen cell sits, by the CSS variable its style names, as the table's panel sets it.
function placed(cell: HTMLElement | null | undefined): string {
  const variable = /^var\((.+)\)$/.exec(cell?.style.left ?? "")?.[1];
  if (variable === undefined) return "";
  const panel = cell?.closest("table")?.parentElement?.parentElement;
  return panel?.style.getPropertyValue(variable) ?? "";
}

describe("frozen columns", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Every header cell 100 pixels wide, in a table with `room` pixels to show them.
  function measuredAs(room: { width: number }) {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 100,
    } as DOMRect);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      () => room.width,
    );
  }

  const headerOf = (label: string) =>
    screen.getByRole("button", {
      name: (name) => name.startsWith(`${label} column`),
    });
  // Where a header cell sits, from the CSS variable its column's frozen place is kept in, or
  // nothing for a column not frozen.
  const leftOf = (label: string) => placed(headerOf(label).closest("th"));

  const changedColour: Field = {
    ...colour,
    draft: {
      state: "waiting",
      madeBy: null,
      madeAt: null,
      action: "changed",
      changed: ["name", "multiple"],
      live: { name: "Hue", multiple: true },
    },
  };

  it("sets each frozen cell, and a live copy beside one, where the columns before it end", () => {
    measuredAs({ width: 1000 });
    renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, frozen: 3 },
      fields: [changedColour],
    });
    expect(leftOf("Name")).toBe("0px");
    expect(leftOf("Code")).toBe("100px");
    expect(leftOf("Colour")).toBe("200px");
    const live = screen
      .getAllByRole("columnheader", { hidden: true })
      .find((cell) => cell.textContent.startsWith("Hue"));
    expect(placed(live)).toBe("300px");
  });

  it("freezes no more than half the room the table has, and fewer once it has less", async () => {
    let resized: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe = noop;
        disconnect = disconnect;
      },
    );
    const room = { width: 1000 };
    measuredAs(room);
    const { unmount } = renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, frozen: 3 },
    });
    expect(leftOf("Colour")).toBe("200px");
    room.width = 250;
    act(() => {
      resized?.();
    });
    expect(leftOf("Name")).toBe("0px");
    expect(leftOf("Code")).toBe("");
    await userEvent.click(headerOf("Code"));
    const freeze = await screen.findByRole("menuitem", {
      name: "Freeze up to this column",
    });
    expect(freeze.hasAttribute("disabled")).toBe(true);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  describe("fades at an edge with more columns beyond it", () => {
    const scrolledTo = (
      scroll: HTMLElement,
      scrollLeft: number,
      widths = { clientWidth: 300, scrollWidth: 900 },
    ) => {
      Object.defineProperty(scroll, "clientWidth", {
        value: widths.clientWidth,
        configurable: true,
      });
      Object.defineProperty(scroll, "scrollWidth", {
        value: widths.scrollWidth,
        configurable: true,
      });
      scroll.scrollLeft = scrollLeft;
      fireEvent.scroll(scroll);
    };
    const fade = (side: string) =>
      document.querySelector(`[data-side="${side}"]`);

    it("fades the right edge while columns lie that way, and the left once scrolled", () => {
      renderGadgets({
        gadgets: [gadget("g1")],
        view: { ...emptyView, frozen: 0 },
      });
      const scroll = screen.getByRole("grid").parentElement as HTMLElement;

      scrolledTo(scroll, 0);
      expect(fade("after")).not.toBeNull();
      expect(fade("before")).toBeNull();

      scrolledTo(scroll, 600);
      expect(fade("after")).toBeNull();
      expect(fade("before")).not.toBeNull();
    });

    it("leaves the left edge to the frozen columns' shadow", () => {
      renderGadgets({ gadgets: [gadget("g1")] });
      const scroll = screen.getByRole("grid").parentElement as HTMLElement;

      scrolledTo(scroll, 40);

      expect(fade("before")).toBeNull();
    });
  });

  it("shadows the frozen columns' edge once the table scrolls sideways", () => {
    renderGadgets({ gadgets: [gadget("g1")] });
    const scroll = screen.getByRole("grid").parentElement as HTMLElement;
    const edge = scroll.nextElementSibling as HTMLElement;
    expect(edge.hasAttribute("data-scrolled")).toBe(false);
    scroll.scrollLeft = 40;
    fireEvent.scroll(scroll);
    expect(edge.hasAttribute("data-scrolled")).toBe(true);
  });

  it("freezes up to the first column as the table does to start", async () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, frozen: 0 },
      onView,
    });
    await userEvent.click(headerOf("Name"));
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: "Freeze up to this column",
      }),
    );
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ frozen: undefined }),
    );
  });

  it("keeps a column moved into the frozen ones frozen, in the view", () => {
    const onView = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], onView });
    fireEvent.dragStart(headerOf("Code").closest("th") as HTMLElement);
    fireEvent.drop(headerOf("Name").closest("th") as HTMLElement);
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: ["code", "name", "f1"], frozen: 2 }),
    );
  });

  it("unfreezes a frozen column moved out, in the view", async () => {
    const onView = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], onView });
    headerOf("Name").focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: ["code", "name", "f1"], frozen: 0 }),
    );
  });

  it("leaves no order in the view once a column is back in the table's own place", async () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, order: ["code", "name", "f1"] },
      onView,
      order: ["name", "code", "f1"],
    });
    headerOf("Code").focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: undefined }),
    );
  });

  it("places the columns in the view's order, even on a table that starts them in its own", () => {
    renderGadgets({
      gadgets: [gadget("g1")],
      table: { ...gadgetTable(), columnsFor: () => gadgetColumns([], [], []) },
      view: { ...emptyView, order: ["code", "name"] },
    });
    expect(
      headerOf("Code").compareDocumentPosition(headerOf("Name")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("moves a column from the order a table starts them in, and leaves none once back", async () => {
    const onView = vi.fn();
    const table = {
      ...gadgetTable(),
      columnsFor: (fields: readonly Field[], lists: readonly List[]) =>
        gadgetColumns(fields, lists, ["code", "name"]),
    };
    const { rerender } = renderGadgets({
      gadgets: [gadget("g1")],
      table,
      onView,
      order: ["f1"],
    });
    headerOf("Code").focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: ["name", "code", "f1"] }),
    );
    rerender(
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={[gadget("g1")]}
          table={table}
          fields={[colour]}
          order={["f1"]}
          lists={[colours]}
          canEdit
          canEditColumns={false}
          view={{ ...emptyView, order: ["name", "code", "f1"] }}
          onView={onView}
          actions={actions()}
        />
      </MantineProvider>,
    );
    headerOf("Code").focus();
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: undefined }),
    );
  });

  it("keeps a column drafted to be removed in its place when another moves past it", async () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      fields: [
        {
          ...colour,
          draft: {
            state: "waiting",
            madeBy: null,
            madeAt: null,
            action: "deleted",
            changed: [],
            live: {},
          },
        },
        { ...colour, id: "f2", name: "Shade" },
      ],
      view: { ...emptyView, show: "drafts" },
      onView,
      order: ["name", "code", "f1", "f2"],
    });
    headerOf("Code").focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: ["name", "f2", "f1", "code"] }),
    );
  });

  it("keeps the rows where they are when the columns frozen or their widths change", () => {
    const sorted: View = {
      ...emptyView,
      sort: [{ key: "name", descending: false }],
    };
    const table = (gadgets: Gadget[], view: View) => (
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={gadgets}
          table={gadgetTable()}
          fields={[colour]}
          order={[]}
          lists={[colours]}
          canEdit
          canEditColumns={false}
          view={view}
          onView={noop}
          actions={actions()}
        />
      </MantineProvider>
    );
    const names = () =>
      screen
        .getAllByRole("gridcell")
        .filter((cell) => cell.id.endsWith("-name"))
        .map((cell) => cell.textContent)
        .filter((text) => text !== "");
    const first = gadget("a", { name: "Alpha" });
    const second = gadget("b", { name: "Bravo" });
    const { rerender } = render(table([first, second], sorted));
    rerender(
      table([{ ...first, name: "Zulu" }, second], {
        ...sorted,
        frozen: 2,
        order: ["code", "name", "f1"],
        widths: { name: 200 },
      }),
    );
    expect(names()).toEqual(["Zulu", "Bravo"]);
  });
});

describe("column widths", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("as they start", () => {
    const text = cellColumn("note", "text", {
      label: "Note",
      required: false,
      choices: [],
      multiple: false,
    });
    const long = new Map([["note", 60]]);

    it("starts a column no wider than its widest", () => {
      expect(columnWidth(text, long).cells).toBe(30);
    });

    it("starts a name column narrower, so the columns after it get the room", () => {
      expect(columnWidth(text, long, "note").cells).toBe(24);
    });

    it("starts a name column of short names as wide as they need", () => {
      expect(
        columnWidth(text, new Map([["note", 12]]), "note").cells,
      ).toBeLessThan(24);
    });
  });

  // Every header cell 100 pixels wide, starting at the page's left edge, in a table with `room`
  // pixels to show them.
  function measuredAs(room: number) {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 100,
      left: 0,
    } as DOMRect);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(room);
  }

  const headerOf = (label: string) =>
    screen.getByRole("button", {
      name: (name) => name.startsWith(`${label} column`),
    });
  const edgeOf = (label: string) =>
    headerOf(label).closest("th")?.lastElementChild as HTMLElement;
  const setWidths = () =>
    [...document.querySelectorAll("col")].map((col) =>
      col.style.getPropertyValue("--set-width"),
    );
  const menuItem = async (label: string, name: string) => {
    await userEvent.click(headerOf(label));
    const menu = await screen.findByRole("menu", {
      name: (shown) => shown.startsWith(`${label} column`),
    });
    return within(menu).getByRole("menuitem", {
      name: (shown) => shown.startsWith(name),
    });
  };

  it("sets each column's width, and its live copy's, from the view, leaving the others to fit", () => {
    renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, widths: { f1: 240 } },
      fields: [
        {
          ...colour,
          draft: {
            state: "waiting",
            madeBy: null,
            madeAt: null,
            action: "changed",
            changed: ["name", "multiple"],
            live: { name: "Hue", multiple: true },
          },
        },
      ],
    });
    expect(setWidths()).toEqual(["", "", "240px", "240px", ""]);
  });

  it("widens and narrows a column a step at a time with Shift, Alt and the arrow keys, without moving it", async () => {
    measuredAs(1000);
    const onView = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, widths: { name: 200 } },
      onView,
    });
    headerOf("Code").focus();
    await userEvent.keyboard("{Shift>}{Alt>}{ArrowRight}{/Alt}{/Shift}");
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ widths: { name: 200, code: 116 } }),
    );
    headerOf("Name").focus();
    await userEvent.keyboard("{Shift>}{Alt>}{ArrowLeft}{/Alt}{/Shift}");
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ widths: { name: 184 } }),
    );
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(onView).toHaveBeenCalledTimes(2);
  });

  it("offers Wider, Narrower, and, once set, Reset width in a column's menu", async () => {
    measuredAs(1000);
    const onView = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, widths: { code: 64 } },
      onView,
    });
    await userEvent.click(await menuItem("Code", "Wider"));
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ widths: { code: 80 } }),
    );
    expect((await menuItem("Code", "Narrower")).hasAttribute("disabled")).toBe(
      true,
    );
    await userEvent.click(await menuItem("Code", "Reset width"));
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ widths: undefined }),
    );
    await userEvent.click(await menuItem("Colour", "Narrower"));
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ widths: { code: 64, f1: 84 } }),
    );
    expect(
      within(
        screen.getByRole("menu", {
          name: (shown) => shown.startsWith("Colour column"),
        }),
      ).queryByRole("menuitem", { name: "Reset width" }),
    ).toBe(null);
  });

  it("widens a frozen column only as far as keeps the frozen columns within half the table", async () => {
    measuredAs(200);
    const onView = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], onView });
    expect((await menuItem("Name", "Wider")).hasAttribute("disabled")).toBe(
      true,
    );
    await userEvent.keyboard("{Escape}");
    headerOf("Name").focus();
    await userEvent.keyboard("{Shift>}{Alt>}{ArrowRight}{/Alt}{/Shift}");
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ widths: { name: 100 } }),
    );
  });

  // The edge as a browser holds it: captured from a press until it is let go.
  function grabbable(edge: HTMLElement) {
    let captured = false;
    edge.setPointerCapture = () => {
      captured = true;
    };
    edge.hasPointerCapture = () => captured;
    return edge;
  }

  it("follows a drag of the header's edge, the view taking the width once it ends", () => {
    measuredAs(1000);
    const onView = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], onView });
    const edge = grabbable(edgeOf("Code"));
    fireEvent.pointerDown(edge, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(edge, { pointerId: 1, clientX: 160 });
    expect(setWidths()).toEqual(["", "160px", "", ""]);
    expect(onView).not.toHaveBeenCalled();
    fireEvent.pointerUp(edge, { pointerId: 1 });
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ widths: { code: 160 } }),
    );
  });

  it("keeps the width reached when the browser cancels a drag", () => {
    measuredAs(1000);
    const onView = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], onView });
    const edge = grabbable(edgeOf("Code"));
    fireEvent.pointerDown(edge, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(edge, { pointerId: 1, clientX: 180 });
    fireEvent.pointerCancel(edge, { pointerId: 1 });
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ widths: { code: 180 } }),
    );
  });

  it("changes nothing for a pointer moved before a press, a press with another button, or a press let go without moving", () => {
    measuredAs(1000);
    const onView = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], onView });
    const edge = grabbable(edgeOf("Code"));
    fireEvent.pointerMove(edge, { pointerId: 1, clientX: 500 });
    fireEvent.pointerDown(edge, { pointerId: 1, button: 2 });
    fireEvent.pointerMove(edge, { pointerId: 1, clientX: 500 });
    expect(setWidths()).toEqual(["", "", "", ""]);
    fireEvent.pointerDown(edge, { pointerId: 1, clientX: 100 });
    fireEvent.pointerUp(edge, { pointerId: 1 });
    expect(onView).not.toHaveBeenCalled();
  });

  it("refuses to drag the header whose edge is pressed, so the column never moves", () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      onView,
    });
    const header = headerOf("Code").closest("th") as HTMLElement;
    fireEvent.pointerDown(grabbable(edgeOf("Code")), { pointerId: 1 });
    expect(fireEvent.dragStart(header)).toBe(false);
    fireEvent.drop(headerOf("Name").closest("th") as HTMLElement);
    expect(onView).not.toHaveBeenCalled();
  });

  it("moves the frozen columns after a frozen one as its edge is dragged", () => {
    measuredAs(1000);
    renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, frozen: 2 },
    });
    const edge = grabbable(edgeOf("Name"));
    fireEvent.pointerDown(edge, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(edge, { pointerId: 1, clientX: 140 });
    expect(placed(headerOf("Code").closest("th"))).toBe("140px");
    const panel = screen.getByRole("grid").parentElement?.parentElement;
    expect(panel?.style.getPropertyValue("--frozen-width")).toBe("240px");
  });

  it("lets a column fit what it holds again once its edge is double-clicked", () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, widths: { code: 300 } },
      onView,
    });
    fireEvent.click(edgeOf("Code"));
    fireEvent.doubleClick(edgeOf("Code"));
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ widths: undefined }),
    );
  });

  it("puts the widths back with Clear all, shown for a view that sets only widths, and with Clear view", async () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, widths: { code: 300 } },
      onView,
    });
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onView).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ widths: expect.anything() as unknown }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Clear view" }),
    );
    expect(onView).toHaveBeenLastCalledWith(emptyView);
  });

  it("names the columns whose widths are set in the Views menu, putting them back", async () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      view: { ...emptyView, widths: { code: 300, name: 200 } },
      onView,
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: "Widths: Name, Code, reset",
      }),
    );
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ widths: undefined }),
    );
  });
});

describe("the live columns", () => {
  const column = {
    id: "f1",
    keyNumber: 1,
    name: "Grade",
    type: "choice" as const,
    listId: "l1",
    visibility: null,
    multiple: false,
    required: true,
    onPlannedHires: true,
  };
  const draft = {
    state: "waiting" as const,
    madeBy: null,
    madeAt: null,
  };
  it("leave out columns only drafted to be added, and put back each setting a draft changes", () => {
    expect(
      liveFields([
        { ...column, id: "f0" },
        {
          ...column,
          draft: {
            ...draft,
            action: "changed",
            changed: ["name", "required"],
            live: { name: "Level", required: false },
          },
        },
        {
          ...column,
          id: "f2",
          keyNumber: 1,
          draft: { ...draft, action: "created", changed: [], live: {} },
        },
        {
          ...column,
          id: "f4",
          keyNumber: 1,
          listId: "l2",
          draft: {
            ...draft,
            action: "changed",
            changed: ["listId"],
            live: { listId: "l1" },
          },
        },
        {
          ...column,
          id: "f3",
          keyNumber: 1,
          draft: { ...draft, action: "deleted", changed: [], live: {} },
        },
      ]),
    ).toEqual([
      { ...column, id: "f0" },
      { ...column, name: "Level", required: false },
      { ...column, id: "f4" },
      { ...column, id: "f3" },
    ]);
  });
});

describe("problems with a row", () => {
  it("names a value its first column cannot take in that cell, and marks the editor", async () => {
    const update = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], given: actions({ update }) });
    act(() => {
      document.getElementById("cell-g1-name")?.focus();
    });
    await userEvent.keyboard("Far too long a name{Tab}");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Name too long");
    const editor = screen.getByRole("textbox", { name: "Name" });
    expect(editor.getAttribute("aria-invalid")).toBe("true");
    expect(editor.getAttribute("aria-describedby")).toBe(alert.id);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("marks the editor of a refused value in a later column, names it under the row, and leaves the row as it was once the cell is left", async () => {
    const recordProblem = vi.fn(
      (_values: unknown, _others: unknown, changed?: string) =>
        changed === "code" ? { message: "Codes are fixed" } : undefined,
    );
    renderGadgets({
      gadgets: [gadget("g1")],
      table: gadgetTable(recordProblem),
    });
    act(() => {
      document.getElementById("cell-g1-code")?.focus();
    });
    await userEvent.keyboard("NEW{Tab}");
    const editor = screen.getByRole("textbox", { name: "Code" });
    expect(editor.getAttribute("aria-invalid")).toBe("true");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Codes are fixed");
    expect(editor.getAttribute("aria-describedby")).toBe(alert.id);
    expect(document.getElementById("cell-g1-name")?.contains(alert)).toBe(true);
    const cell = document.getElementById("cell-g1-code");
    expect(cell?.textContent).not.toContain("Codes are fixed");
    expect(editor.className).toContain("recordEditorInvalid");
    expect(cell?.className).not.toContain("recordProblemCell");
    act(() => {
      editor.blur();
    });
    // The cell has its own value back, which is not the one refused.
    expect(cell?.textContent).toBe("G1");
    expect(cell?.className).not.toContain("recordProblemCell");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("names a whole record's problem before a value still needed, and a value its column cannot take before both", async () => {
    const add = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      table: gadgetTable(() => ({
        message: "Another gadget has that code",
        column: "code",
      })),
      given: actions({ add }),
    });
    act(() => {
      document.getElementById("cell-new-0-code")?.focus();
    });
    await userEvent.keyboard("G1{Enter}");
    expect(screen.getByRole("alert").textContent).toBe(
      "Another gadget has that code",
    );
    expect(document.getElementById("cell-new-0-code")?.className).toContain(
      "recordProblemCell",
    );
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Far too long a name{Enter}");
    expect(screen.getByRole("alert").textContent).toBe("Name too long");
    expect(document.getElementById("cell-new-0-name")?.className).toContain(
      "recordProblemCell",
    );
    expect(add).not.toHaveBeenCalled();
  });

  it("names a value still needed beside its cell when nothing else is wrong", async () => {
    renderGadgets({ gadgets: [] });
    act(() => {
      document.getElementById("cell-new-0-code")?.focus();
    });
    await userEvent.keyboard("W1{Enter}");
    expect(screen.getByRole("alert").textContent).toBe("Name needed");
  });
});

describe("clearing a new row", () => {
  it("takes away a new row and what it holds from its menu, leaving an empty row to fill", async () => {
    const add = vi.fn();
    renderGadgets({ gadgets: [], given: actions({ add }) });
    expect(
      screen.queryAllByRole("button", { name: "Actions for new gadget" }),
    ).toHaveLength(0);
    act(() => {
      document.getElementById("cell-new-0-code")?.focus();
    });
    await userEvent.keyboard("W1{Enter}");
    expect(screen.getByRole("alert").textContent).toBe("Name needed");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    const menu = await screen.findByRole("menu");
    await userEvent.click(within(menu).getByText("New gadget"));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(rowActions("new gadget"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Clear row" }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("row", { name: "New gadget" })).toHaveLength(1);
    expect(screen.queryByText("W1")).toBeNull();
    expect(add).not.toHaveBeenCalled();
  });

  it("clears one of several new rows from its button, keeping the others", async () => {
    renderGadgets({ gadgets: [] });
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.paste("Widget\tW1\nFar too long a name\tS1");
    const filled = screen.getAllByRole("row", { name: "New gadget" }).filter(
      (row) =>
        within(row).queryAllByRole("button", {
          name: "Actions for new gadget",
        }).length > 0,
    );
    expect(filled).toHaveLength(2);
    await userEvent.click(
      within(filled[1] as HTMLElement).getAllByRole("button", {
        name: "Actions for new gadget",
      })[0] as HTMLElement,
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Clear row" }),
    );
    expect(screen.queryByText("S1")).toBeNull();
    expect(screen.getByText("Widget")).toBeTruthy();
  });

  it("clears the only new row, typed in but not added, leaving an empty one", async () => {
    renderGadgets({ gadgets: [] });
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Widget{Tab}{Escape}");
    expect(screen.getByText("Widget")).toBeTruthy();
    await userEvent.click(rowActions("new gadget"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Clear row" }),
    );
    expect(screen.queryByText("Widget")).toBeNull();
    expect(screen.getAllByRole("row", { name: "New gadget" })).toHaveLength(1);
    expect(document.activeElement?.id).toMatch(/^cell-new-\d+-name$/);
  });
});

describe("the mark of a new row being filled in", () => {
  it("names a value its column cannot take, then what is still needed once it can", async () => {
    renderGadgets({ gadgets: [] });
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Far too long a name{Tab}{Escape}");
    expect(
      screen.getByText(", New, not saved yet: Name too long"),
    ).toBeDefined();
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("{Delete}");
    act(() => {
      document.getElementById("cell-new-0-code")?.focus();
    });
    await userEvent.keyboard("W1{Tab}{Escape}");
    expect(screen.getByText(", New, not saved yet: Name needed")).toBeTruthy();
  });

  it("marks no cell for a problem with the whole row that names no column", async () => {
    renderGadgets({
      gadgets: [],
      table: gadgetTable(() => ({ message: "Not this one" })),
    });
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Widget{Enter}");
    expect(screen.getByRole("alert").textContent).toBe("Not this one");
    expect(document.querySelector("[class*='recordProblemCell']")).toBeNull();
  });
});

describe("a refused value", () => {
  it("keeps a record's value when clearing it is refused, leaving the row as it was", async () => {
    const update = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], given: actions({ update }) });
    act(() => {
      document.getElementById("cell-g1-name")?.focus();
    });
    await userEvent.keyboard("{Delete}");
    // The row is as it was, so nothing is named or marked in it.
    expect(screen.queryByRole("alert")).toBeNull();
    const cell = document.getElementById("cell-g1-name");
    expect(cell?.textContent).toContain("Gadget g1");
    expect(cell?.className).not.toContain("recordProblemCell");
    expect(cell?.getAttribute("aria-invalid")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("marks a choice editor whose choice is refused, described by the problem under the row", async () => {
    renderGadgets({
      gadgets: [gadget("g1")],
      table: gadgetTable((_values, _others, changed) =>
        changed === "f1" ? { message: "Not that colour" } : undefined,
      ),
    });
    act(() => {
      document.getElementById("cell-g1-f1")?.focus();
    });
    await userEvent.keyboard("Teal{Enter}");
    const editor = screen.getByRole("textbox", { name: "Colour" });
    expect(editor.getAttribute("aria-invalid")).toBe("true");
    expect(editor.className).toContain("recordEditorInvalid");
    const alert = screen.getByRole("alert");
    expect(editor.getAttribute("aria-describedby")).toBe(alert.id);
  });

  it("marks a web link's address when the link is refused, described by the problem under the row", async () => {
    const site: Field = {
      id: "f2",
      keyNumber: 1,
      name: "Site",
      type: "link",
      listId: null,
      visibility: "general",
      multiple: false,
      required: false,
      onPlannedHires: true,
    };
    renderGadgets({
      gadgets: [gadget("g1")],
      fields: [site],
      table: gadgetTable((_values, _others, changed) =>
        changed === "f2" ? { message: "Not that site" } : undefined,
      ),
    });
    act(() => {
      document.getElementById("cell-g1-f2")?.focus();
    });
    await userEvent.keyboard("{Enter}");
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Address" }),
      "example.test{Enter}",
    );
    const address = screen.getByRole("textbox", { name: "Address" });
    expect(address.getAttribute("aria-invalid")).toBe("true");
    expect(
      screen
        .getByRole("form", { name: "Site" })
        .getAttribute("aria-describedby"),
    ).toBe(screen.getByRole("alert").id);
  });

  it("describes an editor by a new row's mark only while the mark is shown", async () => {
    renderGadgets({
      gadgets: [gadget("g1")],
      table: gadgetTable((values) =>
        values.code === "G1"
          ? { message: "Another gadget has that code", column: "code" }
          : undefined,
      ),
    });
    act(() => {
      document.getElementById("cell-new-0-code")?.focus();
    });
    await userEvent.keyboard("G1{Tab}{Escape}");
    const cell = document.getElementById("cell-new-0-code");
    expect(cell?.getAttribute("aria-invalid")).toBe("true");
    expect(cell?.className).toContain("recordProblemCell");
    act(() => {
      cell?.focus();
    });
    await userEvent.keyboard("{F2}");
    const editor = screen.getByRole("textbox", { name: "Code" });
    const named = document.getElementById(
      editor.getAttribute("aria-describedby") ?? "",
    );
    expect(named?.textContent).toBe("Another gadget has that code");
  });

  it("describes no first-column editor by a mark hidden while it is edited", async () => {
    renderGadgets({ gadgets: [] });
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Far too long a name{Tab}{Escape}");
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("{F2}");
    const editor = screen.getByRole("textbox", { name: "Name" });
    expect(editor.getAttribute("aria-invalid")).toBe("true");
    expect(editor.getAttribute("aria-describedby")).toBeNull();
  });

  it("clears a new row from the keyboard, putting focus on the row after it", async () => {
    renderGadgets({ gadgets: [] });
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.paste("Widget\tW1\nFar too long a name\tS1");
    const [first] = screen.getAllByRole("row", { name: "New gadget" });
    act(() => {
      (first?.querySelector("[role='gridcell']") as HTMLElement).focus();
    });
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await screen.findByRole("menuitem", { name: "Clear row" });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(screen.queryByText("Widget")).toBeNull();
    expect(document.activeElement?.closest("tr")?.textContent).toContain("S1");
  });
});

describe("the problems with a new record", () => {
  const columns = gadgetColumns([], [], []);
  const problems = (
    values: Record<string, string>,
    whole: { message: string; column?: string } | undefined,
  ) =>
    newRecordProblems(
      columns,
      "record",
      values,
      () => whole,
      () => [],
    );

  it("names values taken together in the first column when they name none", () => {
    expect(problems({ name: "Gizmo" }, { message: "Not unique" })).toEqual([
      { message: "Not unique", column: "name" },
    ]);
  });

  it("names values taken together before the columns' own problems", () => {
    expect(
      problems(
        { name: "", code: "X" },
        { message: "Codes are fixed", column: "code" },
      ),
    ).toEqual([
      { message: "Codes are fixed", column: "code" },
      { message: "Name needed", column: "name" },
    ]);
  });

  it("names only the column's own problem when values taken together name the same column", () => {
    expect(
      problems(
        { name: "", code: "" },
        { message: "Not unique", column: "name" },
      ),
    ).toEqual([{ message: "Name needed", column: "name" }]);
  });
});

describe("a record under several groups", () => {
  // Each letter of a gadget's code is a group it's in.
  const byLetters: RecordTable<Gadget, GadgetChange, GadgetChange> = {
    ...gadgetTable(),
    groupings: [
      {
        key: "letters",
        label: "Letters",
        holds: "list",
        of: ({ code }) => {
          const [first, ...rest] = Array.from(code, (letter) => ({
            key: letter,
            label: `Group ${letter}`,
            rank: letter.charCodeAt(0),
          }));
          // Every gadget here has a code.
          return [first as RowGroup, ...rest];
        },
      },
    ],
  };
  const gadgets = [
    gadget("a", { code: "XY" }),
    gadget("b", { code: "X" }),
    gadget("c", { code: "Y" }),
  ];
  const view = { ...emptyView, grouping: "letters" };
  const nameCells = () =>
    screen
      .getAllByRole("gridcell")
      .filter((cell) =>
        cell.getAttribute("data-record-cell")?.endsWith(" name"),
      );

  it("shows a record under each of its groups, each heading counting its own rows, and the table counting it once", () => {
    renderGadgets({ gadgets, table: byLetters, view });

    expect(
      screen.getAllByRole("rowheader").map(({ textContent }) => textContent),
    ).toEqual(["Group X2 gadgets", "Group Y2 gadgets"]);
    expect(nameCells().map(({ textContent }) => textContent)).toEqual([
      "Gadget a+1, also under Group Y.",
      "Gadget b",
      "Gadget a+1, also under Group X.",
      "Gadget c",
    ]);
    expect(screen.getByRole("status").textContent).toBe("3 gadgets");
  });

  it("names the other groups in the mark's tip, shown on pointing at it", async () => {
    renderGadgets({ gadgets, table: byLetters, view });

    const tips = [];
    for (const mark of screen.getAllByText("+1")) tips.push(await tipOn(mark));
    expect(tips).toEqual(["Also under Group Y", "Also under Group X"]);
  });

  it("gives each row of a record a cell of its own, which the arrows step through", async () => {
    renderGadgets({ gadgets, table: byLetters, view });
    const [first, , second] = nameCells();
    expect(first?.id).not.toBe(second?.id);
    act(() => {
      first?.focus();
    });

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");

    expect(document.activeElement).toBe(second);
  });

  it("saves a change made in any of a record's rows to the record", async () => {
    const update =
      vi.fn<RecordActions<Gadget, GadgetChange, GadgetChange>["update"]>();
    renderGadgets({
      gadgets,
      table: byLetters,
      view,
      given: actions({ update }),
    });
    act(() => {
      nameCells()[2]?.focus();
    });

    await userEvent.keyboard("Renamed{Enter}");

    expect(update).toHaveBeenCalledWith(gadgets[0], { name: "Renamed" });
  });

  it("shows a refused value's problem in the row it was typed in alone, and keeps that row's cell after Esc", async () => {
    renderGadgets({
      gadgets,
      table: {
        ...byLetters,
        recordProblem: (values) =>
          values.name === "Bad" ? { message: "Not this name" } : undefined,
      },
    });
    const second = nameCells()[2];
    act(() => {
      second?.focus();
    });

    await userEvent.keyboard("Bad{Enter}");
    expect(screen.getAllByText("Not this name")).toHaveLength(1);
    expect(second?.closest("tr")?.textContent).toContain("Not this name");
    await userEvent.keyboard("{Escape}");

    expect(document.activeElement).toBe(nameCells()[2]);
  });

  it("keeps a record shown since the view was set under its headings while its grouped value changes", () => {
    const grid = (shown: Gadget[]) => (
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={shown}
          table={byLetters}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit
          canEditColumns={false}
          view={view}
          onView={noop}
          actions={actions()}
        />
      </MantineProvider>
    );
    const { rerender } = render(grid(gadgets));
    rerender(grid([...gadgets, gadget("d", { code: "X" })]));
    rerender(grid([...gadgets, gadget("d", { code: "Y" })]));

    expect(
      recordCell("d", "name")?.closest("tr")?.previousSibling?.textContent,
    ).toBe("Group X1 gadget");
  });

  it("marks a record's draft, with its Live row, under each of its groups", () => {
    renderGadgets({
      gadgets: [
        gadget("a", {
          code: "XY",
          name: "Renamed",
          draft: {
            ...waiting,
            action: "changed",
            changed: ["name"],
            live: { name: "Gadget a", values: {}, links: {} },
          },
        }),
      ],
      table: byLetters,
      view,
    });

    expect(screen.getAllByText("Gadget a")).toHaveLength(2);
    expect(
      nameCells().map(({ textContent }) =>
        textContent.includes("Draft: changed from “Gadget a”"),
      ),
    ).toEqual([true, true]);
  });

  it("puts focus on a record's cell in the row of the active cell, or else its first", async () => {
    renderGadgets({ gadgets, table: byLetters, view });
    const [first, , second, last] = nameCells();

    focusRecordCell("a", "name");
    await waitFor(() => {
      expect(document.activeElement).toBe(first);
    });
    act(() => {
      last?.focus();
    });
    await userEvent.keyboard("{ArrowUp}");
    act(() => {
      (document.activeElement as HTMLElement).blur();
    });
    focusRecordCell("a", "name");
    await waitFor(() => {
      expect(document.activeElement).toBe(second);
    });
  });
});

describe("rows grouped again under each heading", () => {
  const letterGroup = (prefix: string) => (letter: string) => ({
    key: letter,
    label: `${prefix} ${letter}`,
    rank: letter.charCodeAt(0),
  });
  const nested = (
    more: Partial<RecordTable<Gadget, GadgetChange, GadgetChange>> = {},
  ): RecordTable<Gadget, GadgetChange, GadgetChange> => ({
    ...gadgetTable(),
    groupings: [
      {
        key: "first",
        label: "First letter",
        holds: "list",
        of: ({ code }) => [letterGroup("Starts")(code.charAt(0))],
      },
      {
        key: "letters",
        label: "Letters",
        holds: "list",
        of: ({ code }) => {
          const [first, ...rest] = Array.from(code, letterGroup("Group"));
          // Every gadget here has a code.
          return [first as RowGroup, ...rest];
        },
      },
    ],
    ...more,
  });
  const gadgets = [
    gadget("a", { code: "XY" }),
    gadget("b", { code: "X" }),
    gadget("c", { code: "YZ" }),
  ];
  const view = { ...emptyView, grouping: "first", thenBy: "letters" };
  const headings = () =>
    screen.getAllByRole("rowheader").map(({ textContent }) => textContent);

  it("heads each group's rows with their second groups, leaving out those empty, each counting its own records", () => {
    renderGadgets({ gadgets, table: nested(), view });

    expect(headings()).toEqual([
      "Starts X2 gadgets",
      "Group X2 gadgets",
      "Group Y1 gadget",
      "Starts Y1 gadget",
      "Group Y1 gadget",
      "Group Z1 gadget",
    ]);
    expect(screen.getByRole("status").textContent).toBe("3 gadgets");
  });

  it("marks a record under several second groups, naming the others", async () => {
    renderGadgets({ gadgets, table: nested(), view });

    const tips = [];
    for (const mark of screen.getAllByText("+1")) tips.push(await tipOn(mark));
    expect(tips).toEqual([
      "Also under Group Y",
      "Also under Group X",
      "Also under Group Z",
      "Also under Group Y",
    ]);
  });

  it("names another place differing in both groups by both, the first, a colon, then the second", async () => {
    renderGadgets({
      gadgets: [gadget("a", { code: "XY" })],
      table: nested({
        groupings: [
          ...(nested().groupings ?? []),
          {
            key: "again",
            label: "Again",
            holds: "list",
            of: ({ code }) => {
              const [first, ...rest] = Array.from(code, letterGroup("Again"));
              // Every gadget here has a code.
              return [first as RowGroup, ...rest];
            },
          },
        ],
      }),
      view: { ...emptyView, grouping: "letters", thenBy: "again" },
    });

    expect(await tipOn(screen.getAllByText("+3")[0] as HTMLElement)).toBe(
      "Also under Again Y, Group Y, Group Y: Again Y",
    );
  });

  it("names both groupings on one button, offering the other groupings under the first, starting with none", async () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets,
      table: nested(),
      view: { ...emptyView, grouping: "first" },
      onView,
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Group by: First letter" }),
    );

    expect(
      (await choicesUnder("Group by"))
        .getAllByRole("menuitem")
        .map(({ textContent }) => textContent),
    ).toEqual(["None", "First letter, chosen", "Letters"]);
    const thenBy = await choicesUnder("Then by");
    expect(
      thenBy.getAllByRole("menuitem").map(({ textContent }) => textContent),
    ).toEqual(["None, chosen", "Letters"]);
    await userEvent.click(thenBy.getByRole("menuitem", { name: "Letters" }));
    expect(onView).toHaveBeenLastCalledWith(view);
  });

  it("takes the second grouping away when none is chosen for it", async () => {
    const onView = vi.fn();
    renderGadgets({ gadgets, table: nested(), view, onView });

    await userEvent.click(
      screen.getByRole("button", {
        name: "Group by: First letter, then Letters",
      }),
    );
    await userEvent.click(await choiceUnder("Then by", "None"));

    expect(onView).toHaveBeenLastCalledWith({ ...view, thenBy: undefined });
  });

  it("takes the second grouping away with the first, or when it becomes the first", async () => {
    const onView = vi.fn();
    renderGadgets({ gadgets, table: nested(), view, onView });

    await userEvent.click(
      screen.getByRole("button", {
        name: "Group by: First letter, then Letters",
      }),
    );
    await userEvent.click(await choiceUnder("Group by", "Letters"));

    expect(onView).toHaveBeenLastCalledWith({
      ...emptyView,
      grouping: "letters",
      thenBy: undefined,
    });
  });

  it("keeps the second grouping when another first is chosen", async () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets,
      table: nested({
        groupings: [
          ...(nested().groupings ?? []),
          {
            key: "code",
            label: "Code",
            holds: "list",
            of: ({ code }) => [letterGroup("Code")(code)],
          },
        ],
      }),
      view,
      onView,
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: "Group by: First letter, then Letters",
      }),
    );
    await userEvent.click(await choiceUnder("Group by", "Code"));

    expect(onView).toHaveBeenLastCalledWith({
      ...emptyView,
      grouping: "code",
      thenBy: "letters",
    });
  });

  it("clears both groupings back to none, offered only once one is chosen", async () => {
    const onView = vi.fn();
    const { unmount } = renderGadgets({
      gadgets,
      table: nested(),
      view: { ...emptyView, grouping: "letters", thenBy: "first" },
      onView,
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: "Group by: Letters, then First letter",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Clear grouping" }),
    );
    expect(onView).toHaveBeenLastCalledWith({
      ...emptyView,
      grouping: undefined,
      thenBy: undefined,
    });
    unmount();

    renderGadgets({ gadgets, table: nested() });
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    await screen.findAllByRole("menuitem");
    expect(
      screen.queryByRole("menuitem", { name: "Clear grouping" }),
    ).toBeNull();
  });

  it("offers no second grouping while the rows show as one list", async () => {
    renderGadgets({
      gadgets,
      table: nested(),
      view: { ...emptyView, thenBy: "letters" },
    });

    await userEvent.click(screen.getByRole("button", { name: "Group by" }));

    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["None, chosen", "First letter", "Letters"]);
    expect(screen.queryByRole("group", { name: "Then by" })).toBeNull();
  });

  it("offers no second grouping, and groups one level deep, on a table whose records are made for its grouping", async () => {
    renderGadgets({ gadgets, table: nested({ oneLevel: true }), view });

    await userEvent.click(
      screen.getByRole("button", { name: "Group by: First letter" }),
    );

    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual([
      "None",
      "First letter, chosen",
      "Letters",
      "List order, chosen",
      "Reverse list order",
      "Clear grouping",
    ]);
    expect(screen.queryByRole("group", { name: "Then by" })).toBeNull();
    expect(headings()).toEqual(["Starts X2 gadgets", "Starts Y1 gadget"]);
  });
});

describe("total rows", () => {
  const totalled: RecordTable<Gadget, GadgetChange, GadgetChange> = {
    ...gadgetTable(),
    groupings: [
      {
        key: "code",
        label: "Code",
        holds: "list",
        of: ({ code }) => [{ key: code, label: `Group ${code}`, rank: 0 }],
      },
    ],
    totals: {
      label: "Total",
      overall: "All gadgets",
      cell: (records, columnKey) =>
        `${columnKey} ${records.map(({ id }) => id).join(" ")}`,
    },
  };
  const gadgets = [
    gadget("a", { code: "X" }),
    gadget("b", { code: "X" }),
    gadget("c", { code: "Y" }),
  ];
  const view = { ...emptyView, grouping: "code" };
  const totalHeaders = () =>
    screen
      .queryAllByRole("rowheader")
      .map((header) => header.textContent)
      .filter((text) => !text.startsWith("Group"));
  const totalRows = () =>
    screen
      .getAllByRole("row")
      .filter((row) => within(row).queryAllByRole("cell").length > 0)
      .filter((row) => within(row).queryByRole("rowheader") !== null)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      );

  it("ends each group with its total, and the table with all the rows' total", () => {
    renderGadgets({ gadgets, table: totalled, view });

    expect(totalHeaders()).toEqual(["Total", "Total", "All gadgets"]);
    expect(totalRows().map((cells) => cells.at(0))).toEqual([
      "code a b",
      "code c",
      "code a b c",
    ]);
  });

  it("draws only the whole table's total when the rows are not grouped", () => {
    renderGadgets({
      gadgets,
      table: totalled,
    });

    expect(totalHeaders()).toEqual(["All gadgets"]);
  });

  it("leaves total rows out of the count above the table", () => {
    renderGadgets({ gadgets, table: totalled, view });

    expect(screen.getByRole("status").textContent).toBe("3 gadgets");
  });

  it("totals only the rows the search leaves", () => {
    renderGadgets({
      gadgets,
      table: totalled,
      view: { ...emptyView, search: "Gadget c" },
    });

    expect(totalRows().map((cells) => cells.at(0))).toEqual(["code c"]);
  });

  it("moves from a group's last row past its total to the next group's first", async () => {
    renderGadgets({ gadgets, table: totalled, view });
    const [last] = screen.getAllByRole("gridcell", { name: /Gadget b/ });
    act(() => {
      last?.focus();
    });

    await userEvent.keyboard("{ArrowDown}");

    expect(document.activeElement?.textContent).toContain("Gadget c");
  });

  it("draws no total rows for a table that does not total", () => {
    renderGadgets({ gadgets });

    expect(totalHeaders()).toEqual([]);
  });
});

describe("a column of the words its records hold", () => {
  interface Held {
    id: string;
    site: unknown;
    draft?: GridDraft & { live: object };
  }
  const held: Held[] = [
    { id: "a", site: "B" },
    { id: "b", site: "" },
    { id: "c", site: ["C10", "C9", 1] },
  ];

  it("reads one word, none, or several, as they are live too", () => {
    const sites = wordsColumn<Held, never>("site", "Site", held);
    expect([
      ...held.map((record) => sites.value(record)),
      sites.live({
        action: "changed",
        changed: ["site"],
        state: "waiting",
        madeBy: "Fictional Editor",
        live: { site: "X" },
      }),
      sites.readOnly,
    ]).toEqual([["B"], [], ["C10", "C9"], ["X"], true]);
  });

  it("offers every word its records hold, alphabetically with numbers in order, or in the order given", () => {
    const labels = (order?: (one: string, other: string) => number) =>
      wordsColumn<Held, never>("site", "Site", held, {
        required: true,
        multiple: true,
        emptyLabel: "None",
        ...(order === undefined ? {} : { order }),
      }).choices.map(({ label }) => label);
    expect([
      labels(),
      labels((one, other) => other.localeCompare(one)),
    ]).toEqual([
      ["B", "C9", "C10"],
      ["C9", "C10", "B"],
    ]);
  });
});

describe("what a table can ask of its columns and rows", () => {
  const noted = (
    more: Partial<Column<Gadget, GadgetChange>>,
  ): RecordTable<Gadget, GadgetChange, GadgetChange> => ({
    ...gadgetTable(),
    columnsFor: () => {
      const [name, code] = gadgetColumns([], [], []) as [
        Column<Gadget, GadgetChange>,
        Column<Gadget, GadgetChange>,
      ];
      return [name, { ...code, ...more }];
    },
  });

  const renderTable = (
    table: RecordTable<Gadget, GadgetChange, GadgetChange>,
    gadgets: Gadget[],
    more: {
      canEdit?: boolean;
      rowActions?: boolean;
      opensAtColumn?: string;
      withDrafts?: boolean;
      view?: View;
      above?: () => ReactNode;
    } = {},
  ) =>
    render(
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={gadgets}
          table={table}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit={more.canEdit ?? false}
          canEditColumns={false}
          view={more.view ?? emptyView}
          onView={noop}
          actions={actions()}
          {...(more.opensAtColumn === undefined
            ? {}
            : { opensAtColumn: more.opensAtColumn })}
          {...(more.withDrafts === undefined
            ? {}
            : { withDrafts: more.withDrafts })}
          {...(more.rowActions === undefined
            ? {}
            : { rowActions: more.rowActions })}
          {...(more.above === undefined ? {} : { above: more.above })}
        />
      </MantineProvider>,
    );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a column's own content in place of the value in words, on records alone", () => {
    renderTable(
      noted({ content: (one) => <b>Made from {one.name}</b> }),
      [gadget("a")],
      { canEdit: true },
    );

    expect(screen.getByText("Made from Gadget a")).toBeDefined();
    expect(screen.queryByText("A")).toBeNull();
  });

  // What a value's cells draw, in order: each colour's square, by its colour, and each word.
  const drawn = (words: string) =>
    screen.getAllByText(words).map((value) => {
      const cell = value.closest("td") as HTMLElement;
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_ALL);
      const parts: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim() ?? "";
        if (node instanceof HTMLElement && node.dataset.colour !== undefined) {
          parts.push(`square ${node.dataset.colour}`);
        } else if (node.nodeType === Node.TEXT_NODE && text !== "") {
          parts.push(text);
        }
      }
      return parts;
    });

  it("draws a column's colour as its square before the value's words", () => {
    renderTable(noted({ colour: () => "grape" }), [gadget("a")]);

    expect(drawn("A")).toEqual([["square grape", "A"]]);
  });

  it("draws no square for a value with no colour", () => {
    renderTable(noted({ colour: () => null }), [gadget("a")]);

    expect(drawn("A")).toEqual([["A"]]);
  });

  it("draws the colour of the record as it is live in the Live row", () => {
    // Given a rename drafted, the drafted record's colour following its name
    renderTable(
      noted({ colour: (one) => (one.name === "Renamed" ? "grape" : "teal") }),
      [
        gadget("a", {
          name: "Renamed",
          draft: {
            ...waiting,
            action: "changed",
            changed: ["name"],
            live: { name: "Gadget a", values: {}, links: {} },
          },
        }),
      ],
    );

    // Then the drafted row's square is the drafted colour and the Live row's the live one
    expect(drawn("A").map(([square]) => square)).toEqual([
      "square grape",
      "square teal",
    ]);
  });

  it("offers no filter on a column whose rows are chosen elsewhere", async () => {
    renderTable(noted({ filterable: false }), [gadget("a")]);
    await userEvent.click(screen.getByRole("button", { name: /^Code column/ }));
    const menu = await screen.findByRole("menu");
    expect([
      within(menu).queryByRole("menuitem", { name: "Filter…" }),
      within(menu).getAllByRole("menuitem").length > 0,
    ]).toEqual([null, true]);
  });

  it("offers neither Empty nor Not empty in a required column's filter", async () => {
    renderTable(noted({ required: true }), [gadget("a")]);
    await userEvent.click(screen.getByRole("button", { name: /^Code column/ }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Filter…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Filter Code" });
    expect(
      within(dialog)
        .getAllByRole("textbox")
        .map((box) => (box as HTMLInputElement).labels?.[0]?.textContent),
    ).toEqual(["Contains"]);
    expect(within(dialog).queryAllByRole("checkbox")).toEqual([]);
  });

  it("draws the record as it is live with a column's own content in the Live row", () => {
    renderTable(noted({ content: (one) => <b>Made from {one.name}</b> }), [
      gadget("a", {
        name: "Renamed",
        draft: {
          ...waiting,
          action: "changed",
          changed: ["name"],
          live: { name: "Gadget a", values: {}, links: {} },
        },
      }),
    ]);

    expect(screen.getByText("Made from Renamed")).toBeDefined();
    expect(screen.getByText("Made from Gadget a")).toBeDefined();
  });

  it("centres only the headings a column says to", () => {
    const table = gadgetTable();
    renderTable(
      {
        ...table,
        columnsFor: (...args: Parameters<typeof table.columnsFor>) =>
          table
            .columnsFor(...args)
            .map((column, index) =>
              index === 0 ? { ...column, headingCentred: true } : column,
            ),
      },
      [gadget("a")],
    );

    const [first, second] = screen.getAllByRole("columnheader");
    expect(first?.hasAttribute("data-centred")).toBe(true);
    expect(second?.hasAttribute("data-centred")).toBe(false);
  });

  it("shades only the cells a column says to", () => {
    renderTable(noted({ shaded: (one) => one.id === "a" }), [
      gadget("a"),
      gadget("b"),
    ]);

    const shaded = (text: string) =>
      screen.getByText(text).closest("td")?.hasAttribute("data-shaded");
    expect(shaded("A")).toBe(true);
    expect(shaded("B")).toBe(false);
  });

  it("sets a column to the characters asked for", () => {
    renderTable(noted({ cellChars: 7 }), [gadget("a")]);

    expect(
      document
        .querySelector<HTMLElement>('col[data-column="code"]')
        ?.style.getPropertyValue("--cell-chars"),
    ).toBe("7");
  });

  describe("scrolling from above the table", () => {
    const frozenWidth = 100;
    const withLater = (): RecordTable<Gadget, GadgetChange, GadgetChange> => ({
      ...gadgetTable(),
      columnsFor: () =>
        [
          ...gadgetColumns([], [], []),
          cellColumn<Gadget, GadgetChange>("later", "text", {
            label: "Later",
            required: false,
            choices: [],
            multiple: false,
          }),
        ] as Column<Gadget, GadgetChange>[],
    });

    function ScrollTo({ column }: { column: string }) {
      const scroll = useTableScroll();
      return (
        <button
          type="button"
          onClick={() => {
            scroll.scrollTo(column);
          }}
        >
          Scroll to {column}
        </button>
      );
    }

    it("scrolls a column to just after the frozen columns", async () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        width: frozenWidth,
      } as DOMRect);
      renderTable(withLater(), [gadget("a")], {
        above: () => <ScrollTo column="later" />,
      });

      await userEvent.click(
        screen.getByRole("button", { name: "Scroll to later" }),
      );

      expect(screen.getByRole("grid").parentElement?.scrollLeft).toBe(
        frozenWidth,
      );
    });

    it("leaves the table where it is for a column it does not have", async () => {
      renderTable(withLater(), [gadget("a")], {
        above: () => <ScrollTo column="missing" />,
      });
      const box = screen.getByRole("grid").parentElement as HTMLElement;
      box.scrollLeft = 30;

      await userEvent.click(
        screen.getByRole("button", { name: "Scroll to missing" }),
      );

      expect(box.scrollLeft).toBe(30);
    });

    it("is refused outside a table", () => {
      vi.spyOn(console, "error").mockImplementation(noop);

      expect(() => render(<ScrollTo column="later" />)).toThrow(
        "Only what a table draws above itself follows its scrolling.",
      );
    });
  });

  describe("opening at a column", () => {
    const frozenWidth = 100;

    it("scrolls it to just after the frozen columns", () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        width: frozenWidth,
      } as DOMRect);
      const table = {
        ...gadgetTable(),
        columnsFor: () =>
          [
            ...gadgetColumns([], [], []),
            cellColumn<Gadget, GadgetChange>("later", "text", {
              label: "Later",
              required: false,
              choices: [],
              multiple: false,
            }),
          ] as Column<Gadget, GadgetChange>[],
      };

      renderTable(table, [gadget("a")], { opensAtColumn: "later" });

      expect(screen.getByRole("grid").parentElement?.scrollLeft).toBe(
        frozenWidth,
      );
    });

    it("stays at the start for a column the table does not have", () => {
      renderTable(gadgetTable(), [gadget("a")], { opensAtColumn: "missing" });

      expect(screen.getByRole("grid").parentElement?.scrollLeft).toBe(0);
    });
  });

  describe("without row actions", () => {
    it("lets cells be edited, with no row menu", async () => {
      renderTable(gadgetTable(), [gadget("a")], {
        canEdit: true,
        rowActions: false,
      });

      act(() => {
        document.getElementById("cell-a-name")?.focus();
      });
      await userEvent.keyboard("{Enter}");

      expect(screen.getByRole("textbox", { name: "Name" })).toBeDefined();
      expect(
        screen.queryAllByRole("button", { name: "Actions for Gadget a" }),
      ).toHaveLength(0);
    });

    it("keeps the row menu for a table with them", () => {
      renderTable(gadgetTable(), [gadget("a")], { canEdit: true });

      expect(rowActions("Gadget a")).toBeDefined();
    });
  });

  describe("without drafts", () => {
    const withMetrics = { ...emptyView, breakdown: ["code"] };

    it("offers no Draft menu, and the metrics do not mention drafts", () => {
      renderTable(gadgetTable(), [gadget("a")], {
        withDrafts: false,
        view: withMetrics,
      });

      expect(screen.queryByRole("button", { name: /^Draft/u })).toBeNull();
      expect(screen.queryByText(/with drafts/u)).toBeNull();
    });

    it("keeps both for a table with drafts", () => {
      renderTable(gadgetTable(), [gadget("a")], { view: withMetrics });

      expect(screen.getByRole("button", { name: /^Draft/u })).toBeDefined();
      expect(screen.getByText(/with drafts/u)).toBeDefined();
    });
  });

  describe("something with a row under each of two groups", () => {
    const counted = { ...gadgetTable(), countedAs: ({ code }: Gadget) => code };
    const twice = [
      gadget("a", { code: "SAME" }),
      gadget("b", { code: "SAME" }),
      gadget("c", { code: "OTHER" }),
    ];

    it("is counted once above the table", () => {
      renderTable(counted, twice);

      expect(screen.getByRole("status").textContent).toBe("2 gadgets");
    });

    it("is counted once when the view narrows the rows", () => {
      renderTable(counted, twice, {
        view: { ...emptyView, search: "same" },
      });

      expect(screen.getByRole("status").textContent).toBe("1 of 2");
    });

    it("ignores the drafts an address asks for on a table without drafts", () => {
      renderTable(counted, twice, {
        withDrafts: false,
        view: {
          ...emptyView,
          show: "drafts",
          filters: { [draftFilterKey]: { any: ["rejected"] } },
        },
      });

      expect(screen.getByRole("status").textContent).toBe("2 gadgets");
    });

    it("is counted once in the metrics", () => {
      renderTable(counted, twice, {
        withDrafts: false,
        view: { ...emptyView, breakdown: ["name"] },
      });

      expect(screen.getAllByText("2 gadgets")).toHaveLength(2);
    });
  });
});

describe("the row's controls", () => {
  const withDetails = (showDetails: (one: Gadget) => void) => ({
    ...gadgetTable(),
    showDetails,
  });

  it("shows a record's details from the button over its Name cell", async () => {
    const showDetails = vi.fn();
    renderGadgets({ gadgets: [gadget("a")], table: withDetails(showDetails) });

    await userEvent.click(
      within(document.getElementById("cell-a-name") as HTMLElement).getByRole(
        "button",
        { name: "Show details of Gadget a" },
      ),
    );

    expect(showDetails).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a" }),
    );
  });

  it("closes an open menu when the details button is pressed", async () => {
    const showDetails = vi.fn();
    renderGadgets({ gadgets: [gadget("a")], table: withDetails(showDetails) });
    await userEvent.click(rowActions("Gadget a"));
    await screen.findByRole("menu");

    await userEvent.click(
      within(document.getElementById("cell-a-name") as HTMLElement).getByRole(
        "button",
        { name: "Show details of Gadget a" },
      ),
    );

    expect(showDetails).toHaveBeenCalled();
    await waitFor(() => {
      expect(rowActions("Gadget a").getAttribute("aria-expanded")).toBe(
        "false",
      );
    });
  });

  it("offers Show details first in the row's menu", async () => {
    const showDetails = vi.fn();
    renderGadgets({ gadgets: [gadget("a")], table: withDetails(showDetails) });

    await userEvent.click(rowActions("Gadget a"));
    const items = within(await screen.findByRole("menu")).getAllByRole(
      "menuitem",
    );
    expect(items.map((item) => item.textContent)).toEqual([
      "Show details",
      "Remove gadget",
    ]);
    await userEvent.click(items[0] as HTMLElement);

    expect(showDetails).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a" }),
    );
  });

  it("opens the row's menu from the ⋯ over its Name cell", async () => {
    renderGadgets({ gadgets: [gadget("a")] });

    await userEvent.click(
      within(document.getElementById("cell-a-name") as HTMLElement).getByRole(
        "button",
        { name: "Actions for Gadget a" },
      ),
    );

    expect(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Remove gadget",
      }),
    ).toBeDefined();
  });

  it("opens the row's menu where any of its cells is right-clicked", async () => {
    renderGadgets({ gadgets: [gadget("a")] });

    const shown = fireEvent.contextMenu(
      document.getElementById("cell-a-code") as HTMLElement,
      { clientX: 40, clientY: 60 },
    );

    expect(shown).toBe(false);
    expect(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Remove gadget",
      }),
    ).toBeDefined();
  });

  it("marks only the row whose right-click menu is open, which keeps its controls shown", async () => {
    renderGadgets({ gadgets: [gadget("a"), gadget("b")] });

    fireEvent.contextMenu(
      document.getElementById("cell-b-code") as HTMLElement,
      { clientX: 40, clientY: 60 },
    );
    await screen.findByRole("menu");

    const marked = [...document.querySelectorAll("tr[data-menu-open]")];
    expect(marked).toEqual([
      document.getElementById("cell-b-code")?.closest("tr"),
    ]);
  });

  it("opens a new row's menu where it is right-clicked, once it holds something", async () => {
    renderGadgets({ gadgets: [] });
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Widget{Tab}{Escape}");

    fireEvent.contextMenu(
      document.getElementById("cell-new-0-code") as HTMLElement,
    );

    expect(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Clear row",
      }),
    ).toBeDefined();
  });

  it("leaves the browser's own menu in a cell being typed in", async () => {
    renderGadgets({ gadgets: [gadget("a")] });
    act(() => {
      document.getElementById("cell-a-code")?.focus();
    });
    await userEvent.keyboard("{Enter}");

    const shown = fireEvent.contextMenu(
      screen.getByRole("textbox", { name: "Code" }),
    );

    expect(shown).toBe(true);
  });

  it("leaves the browser's own menu on a row with no menu", () => {
    render(
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={[gadget("a")]}
          table={gadgetTable()}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit={false}
          approves={[]}
          canEditColumns={false}
          view={emptyView}
          onView={noop}
          actions={actions()}
        />
      </MantineProvider>,
    );

    const shown = fireEvent.contextMenu(
      document.getElementById("cell-a-code") as HTMLElement,
    );

    expect(shown).toBe(true);
    expect(
      screen.queryAllByRole("button", { name: "Actions for Gadget a" }),
    ).toHaveLength(0);
  });

  it("puts focus back on the cell right-clicked when its menu closes", async () => {
    renderGadgets({ gadgets: [gadget("a")] });
    const cell = document.getElementById("cell-a-code") as HTMLElement;
    act(() => {
      cell.focus();
    });
    fireEvent.contextMenu(cell, { clientX: 40, clientY: 60 });
    await screen.findByRole("menu");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(document.activeElement).toBe(cell);
    });
  });

  it("keeps a menu open where it is when right-clicked in", async () => {
    renderGadgets({ gadgets: [gadget("a")] });
    await userEvent.click(rowActions("Gadget a"));
    const menu = await screen.findByRole("menu");

    const shown = fireEvent.contextMenu(within(menu).getByText("Gadget a"));

    expect(shown).toBe(true);
    expect(rowActions("Gadget a").getAttribute("aria-expanded")).toBe("true");
  });

  it("opens nothing from Shift+F10 on a row with no menu", async () => {
    renderGadgets({ gadgets: [] });
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });

    await userEvent.keyboard("{Shift>}{F10}{/Shift}");

    expect(
      screen.queryAllByRole("button", { name: "Actions for new gadget" }),
    ).toHaveLength(0);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("hiding columns", () => {
  const headerOf = (label: string) =>
    screen.queryByRole("button", {
      name: (name) => name.startsWith(`${label} column`),
    });
  const columnMenu = async (label: string) => {
    await userEvent.click(headerOf(label) as HTMLElement);
    return screen.findByRole("menu", {
      name: (shown) => shown.startsWith(`${label} column`),
    });
  };

  // The table with its view kept as the page keeps it, each view it is given passed on.
  function renderViewing(
    first: View,
    seen: (view: View) => void = noop,
    more: { given?: ReturnType<typeof actions>; canEditColumns?: boolean } = {},
  ) {
    function Viewing() {
      const [view, setView] = useState(first);
      return (
        <RecordGrid
          records={[gadget("a"), gadget("b")]}
          table={gadgetTable()}
          fields={[colour]}
          order={[]}
          lists={[colours]}
          canEdit
          approves={[]}
          canEditColumns={more.canEditColumns ?? false}
          view={view}
          onView={(next) => {
            seen(next);
            setView(next);
          }}
          actions={more.given ?? actions()}
        />
      );
    }
    return render(
      <MantineProvider theme={testTheme}>
        <Viewing />
      </MantineProvider>,
    );
  }

  it("hides a column from its menu, keeping its filter and sort, and focuses the heading beside it", async () => {
    const seen = vi.fn();
    renderViewing(
      {
        ...emptyView,
        filters: { code: { contains: "B" } },
        sort: [{ key: "code", descending: true }],
      },
      seen,
    );

    await userEvent.click(
      within(await columnMenu("Code")).getByRole("menuitem", {
        name: "Hide column",
      }),
    );

    expect(headerOf("Code")).toBeNull();
    expect(seen).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hidden: ["code"],
        filters: { code: { contains: "B" } },
        sort: [{ key: "code", descending: true }],
      }),
    );
    expect(screen.getByText("Code: contains “B”")).toBeDefined();
    expect(screen.getAllByRole("row").map((row) => row.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Gadget b")]),
    );
    expect(screen.queryByText("Gadget a")).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(headerOf("Colour"));
    });
  });

  it("offers no Hide column on the name column, and shows it even when the view hides it", async () => {
    renderViewing({ ...emptyView, hidden: ["name"] });
    expect(headerOf("Name")).not.toBeNull();

    const menu = await columnMenu("Name");

    expect(
      within(menu).queryByRole("menuitem", { name: "Hide column" }),
    ).toBeNull();
  });

  it("counts frozen columns among those shown, so hiding a frozen one leaves one fewer", async () => {
    const seen = vi.fn();
    renderViewing({ ...emptyView, frozen: 3 }, seen);

    await userEvent.click(
      within(await columnMenu("Code")).getByRole("menuitem", {
        name: "Hide column",
      }),
    );

    expect(seen).toHaveBeenLastCalledWith(
      expect.objectContaining({ hidden: ["code"], frozen: 2 }),
    );
  });

  const viewsMenu = async () => {
    await userEvent.click(screen.getByRole("button", { name: /^Views/ }));
    return screen.findByRole("menu");
  };

  it("names the hidden columns in the Views menu under Hidden, in the table's order, after Show all columns", async () => {
    // Given two columns hidden
    renderViewing({ ...emptyView, hidden: ["f1", "code"] });

    // When the Views menu opens
    const menu = await viewsMenu();

    // Then it names them under Hidden
    expect(within(menu).getByText("Hidden")).toBeDefined();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map(({ textContent }) => textContent)
        .filter((text) => /Show all|show$/.test(text)),
    ).toEqual(["Show all columns", "Code, show", "Colour, show"]);
  });

  it("shows one hidden column again, offering Show all columns no more once one is left", async () => {
    // Given two columns hidden
    renderViewing({ ...emptyView, hidden: ["code", "f1"] });

    // When one is chosen in the Views menu
    await userEvent.click(
      within(await viewsMenu()).getByRole("menuitem", { name: "Code, show" }),
    );

    // Then it is shown again, and the menu names only the other
    expect(headerOf("Code")).not.toBeNull();
    expect(headerOf("Colour")).toBeNull();
    const menu = await viewsMenu();
    expect(
      within(menu).queryByRole("menuitem", { name: "Show all columns" }),
    ).toBeNull();
    expect(
      within(menu).getByRole("menuitem", { name: "Colour, show" }),
    ).toBeDefined();
  });

  it("shows every hidden column at once", async () => {
    renderViewing({ ...emptyView, hidden: ["code", "f1"] });
    await userEvent.click(screen.getByRole("button", { name: /^Views/ }));

    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Show all columns" }),
    );

    expect(headerOf("Code")).not.toBeNull();
    expect(headerOf("Colour")).not.toBeNull();
  });

  it("offers Remove column on an added column for a role that may remove it, and only there", async () => {
    const removeColumn = vi.fn();
    renderViewing(emptyView, noop, {
      given: actions({ removeColumn }),
      canEditColumns: true,
    });

    expect(
      within(await columnMenu("Code")).queryByRole("menuitem", {
        name: "Remove column",
      }),
    ).toBeNull();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      within(await columnMenu("Colour")).getByRole("menuitem", {
        name: "Remove column",
      }),
    );

    expect(removeColumn).toHaveBeenCalledWith(colour);
  });

  it("offers no Remove column without a way to remove it", async () => {
    renderViewing(emptyView, noop, { canEditColumns: true });

    const menu = await columnMenu("Colour");

    expect(
      within(menu).getByRole("menuitem", { name: "Edit column…" }),
    ).toBeDefined();
    expect(
      within(menu).queryByRole("menuitem", { name: "Remove column" }),
    ).toBeNull();
  });

  it("keeps a hidden column's place when another column moves", async () => {
    // Given Code hidden
    const seen = vi.fn();
    renderViewing({ ...emptyView, hidden: ["code"] }, seen);

    // When Colour moves left, past Name
    await userEvent.click(
      within(await columnMenu("Colour")).getByRole("menuitem", {
        name: (shown) => shown.startsWith("Move left"),
      }),
    );

    // Then Code stays where it was, between them
    expect(seen).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: ["f1", "code", "name"] }),
    );
  });

  it("focuses the column's heading again once it has moved", async () => {
    renderViewing(emptyView);

    await userEvent.click(
      within(await columnMenu("Code")).getByRole("menuitem", {
        name: (shown) => shown.startsWith("Move right"),
      }),
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(headerOf("Code"));
    });
  });

  it("focuses the heading before a column removed from its menu, when it was the last", async () => {
    renderViewing(emptyView, noop, {
      given: actions({ removeColumn: noop }),
      canEditColumns: true,
    });

    await userEvent.click(
      within(await columnMenu("Colour")).getByRole("menuitem", {
        name: "Remove column",
      }),
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(headerOf("Code"));
    });
  });

  it("still names a hidden column a new row needs", async () => {
    // Given Code required, and hidden
    renderGadgets({
      gadgets: [],
      table: {
        ...gadgetTable(),
        columnsFor: (fields, lists, order) =>
          gadgetColumns(fields, lists, order).map((column) =>
            column.key === "code" ? { ...column, required: true } : column,
          ),
      },
      view: { ...emptyView, hidden: ["code"] },
    });

    // When a new row is given a name alone
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Widget{Tab}{Escape}");

    // Then its mark names Code as needed
    expect(screen.getByText(", New, not saved yet: Code needed")).toBeDefined();
  });
});

describe("a read-only table's own drafts", () => {
  const rejected = {
    ...waiting,
    state: "rejected" as const,
    action: "changed" as const,
    changed: ["code"],
    live: { code: "OLD", values: {}, links: {} },
  };
  const detailed = (
    more: Partial<RecordTable<Gadget, GadgetChange, GadgetChange>> = {},
  ) => ({ ...gadgetTable(), showDetails: noop, ...more });

  function renderReadOnly({
    gadgets,
    table = detailed(),
    given = actions(),
    view = emptyView,
  }: {
    gadgets: Gadget[];
    table?: RecordTable<Gadget, GadgetChange, GadgetChange>;
    given?: RecordActions<Gadget, GadgetChange, GadgetChange>;
    view?: View;
  }) {
    return render(
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={gadgets}
          table={table}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit={false}
          canAdd={false}
          rowActions={false}
          canEditDrafts
          canEditColumns={false}
          view={view}
          onView={noop}
          actions={given}
        />
      </MantineProvider>,
    );
  }

  const menuOf = async (name: string) => {
    await userEvent.click(rowActions(name));
    await screen.findByRole("menuitem", { name: "Show details" });
    return screen.getByRole("menu");
  };

  it("offers Resubmit and Discard draft for a record's own draft", async () => {
    // Given a rejected draft on a table whose records are changed elsewhere
    const discard = vi.fn();
    const resubmit = vi.fn();
    renderReadOnly({
      gadgets: [gadget("g1", { draft: rejected })],
      given: actions({ discard, resubmit }),
    });

    // When its draft is resubmitted, then discarded
    await menuOf("Gadget g1");
    await userEvent.click(screen.getByRole("menuitem", { name: "Resubmit" }));
    await menuOf("Gadget g1");
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Discard draft" }),
    );

    // Then each reaches the table's actions
    expect([resubmit.mock.calls.length, discard.mock.calls.length]).toEqual([
      1, 1,
    ]);
  });

  it("offers neither under Live only", async () => {
    renderReadOnly({
      gadgets: [gadget("g1", { draft: rejected })],
      view: { ...emptyView, show: "live" },
    });

    const menu = await menuOf("Gadget g1");

    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Show details"]);
  });

  it("offers nothing for drafts of the record's parts alone, with no divider left after Show details", async () => {
    // Given a row whose draft stands for its parts' drafts, the record having none of its own
    renderReadOnly({
      gadgets: [gadget("g1", { draft: rejected })],
      table: detailed({ ownDraft: () => undefined }),
    });

    const menu = await menuOf("Gadget g1");

    expect([
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
      within(menu).queryAllByRole("separator"),
    ]).toEqual([["Show details"], []]);
  });

  it("has no menu for a row whose only drafts are its parts' where the table offers nothing else", () => {
    renderReadOnly({
      gadgets: [gadget("g1", { draft: rejected })],
      table: { ...gadgetTable(), ownDraft: () => undefined },
    });

    expect(
      screen.queryAllByRole("button", { name: "Actions for Gadget g1" }),
    ).toEqual([]);
  });
});

describe("a read-only table of drafts", () => {
  const removed = gadget("g1", { draft: { ...waiting, action: "deleted" } });
  const added = gadget("g2", { draft: { ...waiting, action: "created" } });
  const plain = gadget("g3");
  const cellOf = (id: string, columnKey: string) =>
    recordCell(id, columnKey) as HTMLElement;

  function renderReadOnly({
    gadgets,
    table = gadgetTable(),
    ticks,
  }: {
    gadgets: Gadget[];
    table?: RecordTable<Gadget, GadgetChange, GadgetChange>;
    ticks?: RowTicks<Gadget>;
  }) {
    return render(
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={gadgets}
          table={table}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit={false}
          canEditColumns={false}
          view={emptyView}
          onView={noop}
          actions={actions()}
          ticks={ticks}
        />
      </MantineProvider>,
    );
  }

  // Ticks that keep their own state, as a page would, with g3 never tickable.
  function Ticked({
    view = emptyView,
    first = [],
    tip,
    onTicked = noop,
  }: {
    view?: View;
    first?: string[];
    tip?: RowTicks<Gadget>["tip"];
    onTicked?: (ids: string[]) => void;
  }) {
    const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set(first));
    return (
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={[removed, added, plain]}
          table={gadgetTable()}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit={false}
          canEditColumns={false}
          view={view}
          onView={noop}
          actions={actions()}
          ticks={{
            ticked,
            onTick: (ids, on) => {
              setTicked((current) => {
                const next = withTicks(current, ids, on);
                onTicked([...next]);
                return next;
              });
            },
            tickable: ({ id }) => id !== "g3",
            label: (one) => `Select ${one.name}`,
            allLabel: "Select all",
            ...(tip === undefined ? {} : { tip }),
          }}
        />
      </MantineProvider>
    );
  }

  it("marks a row's draft by its slot's dot alone, when the table asks", () => {
    // Given a table whose every row is a draft
    renderReadOnly({
      gadgets: [removed, added],
      table: { ...gadgetTable(), slotMarksOnly: true },
    });

    // Then no row is tinted or struck through, and no cell is marked or read aloud as a draft
    for (const id of ["g1", "g2"]) {
      const cell = cellOf(id, "code");
      expect(cell.closest("tr")?.className).not.toMatch(
        /draftRow|recordRemovedRow/,
      );
      expect(cell.className).not.toContain("draftCell");
      expect(cell.textContent).not.toContain("draft");
    }
    expect(cellOf("g1", "name").textContent).toContain("Draft: removed");
  });

  it("draws no Live row where the table gives no live record", () => {
    renderReadOnly({
      gadgets: [
        gadget("g4", {
          draft: { ...waiting, action: "changed", changed: ["code"] },
        }),
      ],
      table: { ...gadgetTable(), liveRecords: () => [] },
    });
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("hides a column hidden at first, offering it from the Views menu until the view shows it", async () => {
    // Given a column hidden at first
    const onView = vi.fn<(view: View) => void>();
    render(
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={[plain]}
          table={nameThen({ ...nextColumn("text"), hiddenAtFirst: true })}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit={false}
          canEditColumns={false}
          view={emptyView}
          onView={onView}
          actions={actions()}
        />
      </MantineProvider>,
    );
    expect(screen.queryByRole("button", { name: /^Next column/u })).toBeNull();

    // When it is chosen under Hidden in the Views menu
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Next/u }),
    );

    // Then the view names it shown
    expect(onView).toHaveBeenCalledWith(
      expect.objectContaining({ shown: ["next"], hidden: undefined }),
    );
  });

  it("says when it has no rows at all", () => {
    renderReadOnly({ gadgets: [] });
    expect(screen.getByText("No gadgets")).toBeDefined();
  });

  it("ticks rows one at a time or all those that may be, saying aloud how many", async () => {
    // Given a table of ticks, one of whose rows can't be ticked
    render(<Ticked />);
    expect(screen.queryByText(/selected/u)).toBeNull();
    expect(
      screen.getByRole("checkbox", { name: "Select Gadget g3" }),
    ).toHaveProperty("disabled", true);

    // When one is ticked, then every one that may be
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select Gadget g1" }),
    );
    expect(screen.getByText("1 selected")).toBeDefined();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all" }));

    // Then both are ticked, never the one that can't be, and unticking all says nothing
    expect(screen.getByText("2 selected")).toBeDefined();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(screen.queryByText(/selected/u)).toBeNull();
  });

  it("gives a tick the table's tip for its row, read with it, and none where there is none", () => {
    render(
      <Ticked
        tip={({ id }) =>
          id === "g1" ? "Linked to the change to Gadget g2" : undefined
        }
      />,
    );
    const tickOf = (name: string) => screen.getByRole("checkbox", { name });
    expect(tickOf("Select Gadget g1").getAttribute("aria-description")).toBe(
      "Linked to the change to Gadget g2",
    );
    expect(
      tickOf("Select Gadget g2").getAttribute("aria-description"),
    ).toBeNull();
  });

  it("unticks a row the view hides, so nothing is done to rows out of sight", () => {
    // Given two rows ticked
    const onTicked = vi.fn<(ids: string[]) => void>();

    // When a search hides one of them
    render(
      <Ticked
        first={["g1", "g2"]}
        view={{ ...emptyView, search: "g1" }}
        onTicked={onTicked}
      />,
    );

    // Then only the row in sight stays ticked
    expect(onTicked).toHaveBeenLastCalledWith(["g1"]);
  });

  it("ticks a row with Space on its first cell, and only one that may be", async () => {
    render(<Ticked />);
    act(() => {
      cellOf("g2", "name").focus();
    });
    await userEvent.keyboard(" ");
    expect(
      screen.getByRole("checkbox", { name: "Select Gadget g2" }),
    ).toHaveProperty("checked", true);
    act(() => {
      cellOf("g3", "name").focus();
    });
    await userEvent.keyboard(" ");
    expect(
      screen.getByRole("checkbox", { name: "Select Gadget g3" }),
    ).toHaveProperty("checked", false);
    expect(screen.getByText("1 selected")).toBeDefined();
  });

  it("leaves the select-all tick half ticked while only some are", async () => {
    render(<Ticked />);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select Gadget g1" }),
    );
    expect(screen.getByRole("checkbox", { name: "Select all" })).toHaveProperty(
      "indeterminate",
      true,
    );
  });
});

describe("the Key column", () => {
  // Gadget "a" has a draft, so it has a Live row, "c" stands for a record not yet saved, which has
  // no key, and "d" is drafted to be added.
  const keyNumbers = new Map([
    ["a", 2],
    ["b", 12],
    ["c", 0],
    ["d", 5],
  ]);
  const keyOf = ({ id }: Gadget) => ({
    kind: "feature" as const,
    keyNumber: keyNumbers.get(id) ?? 0,
  });
  const keyedTable = () => ({ ...gadgetTable(), keyOf });
  const keyed = [
    gadget("a", {
      draft: { ...waiting, action: "changed", changed: ["code"] },
    }),
    gadget("b"),
    gadget("c"),
    gadget("d", { draft: { ...waiting, action: "created" } }),
  ];
  const keyShown: View = { ...emptyView, shown: [keyColumnKey] };
  const headings = () =>
    screen
      .getAllByRole("button", { name: / column/u })
      .map((button) => button.getAttribute("aria-label")?.split(" column")[0]);
  const namesShown = () =>
    screen
      .getAllByRole("row")
      .flatMap((row) => /Gadget \w/u.exec(row.textContent)?.[0] ?? []);

  it("is hidden at first, offered under Hidden in the Views menu", async () => {
    // Given a table whose records have keys
    const onView = vi.fn<(view: View) => void>();
    renderGadgets({ gadgets: keyed, table: keyedTable(), onView });
    expect(headings()).not.toContain("Key");

    // When it is chosen under Hidden in the Views menu
    await userEvent.click(screen.getByRole("button", { name: /^Views/u }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Hidden")).toBeDefined();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Key, show" }),
    );

    // Then the view names it shown
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ shown: [keyColumnKey] }),
    );
  });

  it("shows each saved row's whole key right after Name, and none for a row not saved or being added", () => {
    renderGadgets({ gadgets: keyed, table: keyedTable(), view: keyShown });

    expect(headings()).toEqual(["Name", "Key", "Code", "Colour"]);
    expect(recordCell("a", keyColumnKey)?.textContent).toBe("#FEATURE-2");
    expect(recordCell("b", keyColumnKey)?.textContent).toBe("#FEATURE-12");
    expect(recordCell("c", keyColumnKey)?.textContent).toBe("");
    expect(recordCell("d", keyColumnKey)?.textContent).toContain("#FEATURE-5");
    expect(document.getElementById("cell-new-0-recordKey")?.textContent).toBe(
      "",
    );
  });

  it("draws the key in a changed record's Live row too", () => {
    renderGadgets({ gadgets: keyed, table: keyedTable(), view: keyShown });

    const liveRows = [
      ...document.querySelectorAll('tbody tr[aria-hidden="true"]'),
    ];
    expect(liveRows).toHaveLength(1);
    expect(liveRows[0]?.textContent).toContain("#FEATURE-2");
  });

  it("asks nothing of it, or of any other read-only column, for a new record", async () => {
    // Given a table with keys and another read-only column, whose change is watched
    const change = vi.fn((): GadgetChange => ({}));
    const add =
      vi.fn<RecordActions<Gadget, GadgetChange, GadgetChange>["add"]>();
    renderGadgets({
      gadgets: [],
      fields: [],
      table: {
        ...nameThen({ ...nextColumn("text"), readOnly: true, change }),
        keyOf,
      },
      given: actions({ add }),
    });

    // When a new record is added
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Widget{Enter}");

    // Then its request holds its name alone
    expect(add.mock.calls.at(0)?.[0].map(({ request }) => request)).toEqual([
      { name: "Widget" },
    ]);
    expect(change).not.toHaveBeenCalled();
  });

  it("sorts by the key's number, not its text", () => {
    renderGadgets({
      gadgets: [gadget("b"), gadget("a")],
      table: keyedTable(),
      view: { ...keyShown, sort: [{ key: keyColumnKey, descending: false }] },
    });
    expect(namesShown()).toEqual(["Gadget a", "Gadget b"]);
  });

  it("filters by the key's number", () => {
    renderGadgets({
      gadgets: keyed,
      table: keyedTable(),
      view: { ...keyShown, filters: { [keyColumnKey]: { atLeast: 10 } } },
    });
    expect(namesShown()).toEqual(["Gadget b"]);
  });

  it("goes after Name in a view whose own order does not name it", () => {
    renderGadgets({
      gadgets: keyed,
      table: keyedTable(),
      view: { ...keyShown, order: ["code", "name", "f1"] },
    });
    expect(headings()).toEqual(["Code", "Name", "Key", "Colour"]);
  });

  it("keeps its place in a view whose own order names it", () => {
    renderGadgets({
      gadgets: keyed,
      table: keyedTable(),
      view: { ...keyShown, order: ["code", keyColumnKey, "name", "f1"] },
    });
    expect(headings()).toEqual(["Code", "Key", "Name", "Colour"]);
  });

  it("is left out of word search, while a whole key typed finds its record", () => {
    const found = (search: string) => {
      const { unmount } = renderGadgets({
        gadgets: keyed,
        table: keyedTable(),
        view: { ...keyShown, search },
      });
      const names = namesShown();
      unmount();
      return names;
    };
    expect(found("12")).toEqual([]);
    expect(found("#FEATURE-12")).toEqual(["Gadget b"]);
  });

  describe("on its own", () => {
    it("is as wide as its longest key, each character counted a little wider", () => {
      expect(keyColumn(keyOf, keyed).cellChars).toBe(
        Math.ceil("#FEATURE-12".length * 1.3),
      );
      expect(keyColumn(keyOf, []).cellChars).toBe(
        Math.ceil("Key".length * 1.3),
      );
    });

    it("has no live value and refuses any change", () => {
      const column = keyColumn<Gadget, GadgetChange>(keyOf, keyed);
      expect(column.live({ ...waiting, action: "changed" })).toBeNull();
      expect(() => column.change("3")).toThrow(
        "A record's key can't be changed",
      );
    });
  });
});
