// SPDX-License-Identifier: Apache-2.0

// Tests for the table of records on its own, with a made-up kind of record, gadgets, so nothing
// particular to People is relied on: what the table calls its rows and menus, the checks a table
// makes on a whole record, a text column's length, where a dragged column goes, the columns'
// order, the records as they are live, the records the metrics count, and the live columns.
// People's own table is tested in people-grid.test.tsx.

import {
  type DraftKind,
  draftKinds,
  type Field,
  type List,
} from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
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
  type Column,
  countedRecords,
  droppedAfter,
  inOrder,
  liveFields,
  liveRecordsOf,
  newRecordProblems,
  type RecordActions,
  RecordGrid,
  type RecordTable,
} from "./record-grid.tsx";
import { emptyView, formatDay, type View } from "./table-view.ts";
import { testTheme } from "./test-support.tsx";

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
  canMoveColumns = false,
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
  canMoveColumns?: boolean;
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
        canMoveColumns={canMoveColumns}
        view={view}
        onView={onView}
        actions={given}
      />
    </MantineProvider>,
  );
}

describe("Tab across a new row", () => {
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
    expect(panel.textContent).toContain(
      "Choose a column to count gadgets by its values.",
    );
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
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Gadget g1" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove gadget" }),
    );
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Gadget g2" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Approve draft" }),
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
      changed: ["name"],
      live: { name: "Hue" },
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
    renderGadgets({ gadgets: [gadget("g1")], onView, canMoveColumns: true });
    fireEvent.dragStart(headerOf("Code").closest("th") as HTMLElement);
    fireEvent.drop(headerOf("Name").closest("th") as HTMLElement);
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: ["code", "name", "f1"], frozen: 2 }),
    );
  });

  it("unfreezes a frozen column moved out, in the view", async () => {
    const onView = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], onView, canMoveColumns: true });
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
      canMoveColumns: true,
      order: ["name", "code", "f1"],
    });
    headerOf("Code").focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: undefined }),
    );
  });

  it("does not move columns on a table that does not let them move", async () => {
    const onView = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], onView, canEditColumns: true });
    headerOf("Code").focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onView).not.toHaveBeenCalled();
    expect(
      headerOf("Code").closest("th")?.getAttribute("draggable"),
    ).toBeNull();
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
            changed: ["name"],
            live: { name: "Hue" },
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
      canMoveColumns: true,
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
      canMoveColumns: true,
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
          draft: { ...draft, action: "created", changed: [], live: {} },
        },
        {
          ...column,
          id: "f4",
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
      screen.queryByRole("button", { name: "Actions for new gadget" }),
    ).toBeNull();
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
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for new gadget" }),
    );
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
    const buttons = screen.getAllByRole("button", {
      name: "Actions for new gadget",
    });
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[1] as HTMLElement);
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
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for new gadget" }),
    );
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
    expect(screen.getByTitle("New, not saved yet: Name too long")).toBeTruthy();
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("{Delete}");
    act(() => {
      document.getElementById("cell-new-0-code")?.focus();
    });
    await userEvent.keyboard("W1{Tab}{Escape}");
    expect(screen.getByText("New, not saved yet: Name needed")).toBeTruthy();
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
