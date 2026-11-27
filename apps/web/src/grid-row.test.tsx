// SPDX-License-Identifier: Apache-2.0

// Tests for the shared table's rows, their marks and totals, with a made-up kind of record,
// gadgets.

import { MantineProvider } from "@mantine/core";
import { useState } from "react";
import { act, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordGrid } from "./record-grid.tsx";
import type { RecordTable } from "./record-table.ts";
import { type RowTicks, withTicks } from "./row-ticks.tsx";
import { type View, emptyView } from "./table-view.ts";
import {
  type Gadget,
  type GadgetChange,
  actions,
  gadget,
  gadgetTable,
  nameThen,
  nextColumn,
  noop,
  recordCell,
  renderGadgets,
  testTheme,
  waiting,
} from "./test-support.tsx";

describe("the mark of a new row being filled in", () => {
  it("names a value its column cannot take, then what is still needed once it can", async () => {
    renderGadgets({ gadgets: [] });
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Far too long a name{Tab}{Escape}");
    expect(
      screen.getByText(", New, not saved yet: Name is too long"),
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

describe("moving between cells", () => {
  it("draws only the cell left and the cell reached, reading no record's values again", async () => {
    // Given a table whose code column counts each value it reads
    const read = vi.fn((one: Gadget) => one.code);
    const table = {
      ...gadgetTable(),
      columnsFor: () => {
        const [name, code] = gadgetTable().columnsFor([], [], [], []);
        return [name, { ...code, value: read }] as ReturnType<
          RecordTable<Gadget, GadgetChange, GadgetChange>["columnsFor"]
        >;
      },
    };
    renderGadgets({
      gadgets: [gadget("g1"), gadget("g2"), gadget("g3")],
      table,
      fields: [],
    });
    const [above, , below] = screen.getAllByRole("gridcell");
    (above as HTMLElement).focus();
    read.mockClear();

    // When the selection moves down
    await userEvent.keyboard("{ArrowDown}");

    // Then the cell below is the one reached by Tab, and nothing was read to draw it
    expect([
      (above as HTMLElement).tabIndex,
      (below as HTMLElement).tabIndex,
    ]).toEqual([-1, 0]);
    expect(read).not.toHaveBeenCalled();
  });

  it("makes the first cell the one reached by Tab once the row selected leaves the table", async () => {
    // Given the second gadget's cell selected
    const grid = (gadgets: Gadget[]) => (
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={gadgets}
          table={gadgetTable()}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit
          canEditColumns={false}
          view={emptyView}
          onView={noop}
          actions={actions()}
        />
      </MantineProvider>
    );
    const { rerender } = render(grid([gadget("g1"), gadget("g2")]));
    (screen.getAllByRole("gridcell")[0] as HTMLElement).focus();
    await userEvent.keyboard("{ArrowDown}");

    // When its row leaves the table
    rerender(grid([gadget("g1")]));

    // Then the first cell is the one reached by Tab
    expect(
      screen
        .getAllByRole("gridcell")
        .map((cell) => cell.tabIndex)
        .slice(0, 2),
    ).toEqual([0, -1]);
  });

  it("makes the first cell the one reached by Tab once the column selected leaves the table", async () => {
    // Given a cell of the Code column selected
    const grid = (table: ReturnType<typeof gadgetTable>) => (
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={[gadget("g1")]}
          table={table}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit
          canEditColumns={false}
          view={emptyView}
          onView={noop}
          actions={actions()}
        />
      </MantineProvider>
    );
    const { rerender } = render(grid(gadgetTable()));
    (screen.getAllByRole("gridcell")[0] as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");

    // When the column leaves the table
    const nameOnly = {
      ...gadgetTable(),
      columnsFor: () => gadgetTable().columnsFor([], [], [], []).slice(0, 1),
    };
    rerender(grid(nameOnly));

    // Then the first cell is the one reached by Tab
    expect((screen.getAllByRole("gridcell")[0] as HTMLElement).tabIndex).toBe(
      0,
    );
  });
});

describe("a value another record's draft changes", () => {
  it("is marked by that draft's state, not its row's", () => {
    // Given a gadget whose rename was rejected, and whose code another record's waiting draft changes
    renderGadgets({
      gadgets: [
        gadget("g1", {
          name: "Renamed",
          draft: {
            ...waiting,
            state: "rejected",
            reason: "Fictional reason",
            action: "changed",
            changed: ["name"],
            live: { name: "Gadget g1", values: {}, links: {} },
          },
          cellDrafts: new Map([
            [
              "code",
              {
                ...waiting,
                action: "changed" as const,
                changed: ["code"],
                live: { values: {}, links: {} },
              },
            ],
          ]),
        }),
      ],
      fields: [],
    });

    // Then the name is marked rejected and the code waiting
    const [name, code] = screen.getAllByRole("gridcell");
    expect([
      name?.textContent.includes("Rejected"),
      code?.textContent.includes("Rejected"),
      code?.textContent.includes("Draft: filled in"),
    ]).toEqual([true, false, true]);
  });

  it("is read aloud as a draft only while its row shows one, as it doesn't under Live only", () => {
    renderGadgets({
      gadgets: [
        gadget("g1", {
          cellDrafts: new Map([
            [
              "code",
              {
                ...waiting,
                action: "changed" as const,
                changed: ["code"],
                live: { values: {}, links: {} },
              },
            ],
          ]),
        }),
      ],
      fields: [],
    });
    const [, code] = screen.getAllByRole("gridcell");
    expect(code?.textContent.includes(", draft")).toBe(false);
  });
});

describe("the waiting drafts the Draft menu counts", () => {
  it("counts none held by someone else as hidden by the view", async () => {
    // Given one draft to decide, and one held by someone else
    renderGadgets({
      gadgets: [
        gadget("g1", {
          draft: { ...waiting, action: "changed", changed: ["code"] },
        }),
        gadget("g2", {
          draft: { ...waiting, action: "changed", changed: ["code"] },
          heldBy: "Fictional Holder",
        }),
      ],
      approves: ["list"],
      fields: [],
    });

    // When the Draft menu opens
    await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));

    // Then it hides nothing the role could decide
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Waiting drafts")).toBeDefined();
  });
});

describe("a row's details button", () => {
  // Gadgets g1 and g2 in a table that shows their details, with g1's open beside it.
  function renderWithOpen(closeSelected?: (id: string) => void) {
    const showDetails = vi.fn();
    render(
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={[gadget("g1"), gadget("g2")]}
          table={{ ...gadgetTable(), showDetails }}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit={false}
          canEditColumns={false}
          view={emptyView}
          onView={noop}
          actions={actions()}
          selected="g1"
          closeSelected={closeSelected}
        />
      </MantineProvider>,
    );
    return showDetails;
  }
  const detailsButton = (id: string) =>
    screen.getByRole("button", { name: `Show details of Gadget ${id}` });

  it("closes the open row's details, its button read as expanded", async () => {
    // Given g1's details open
    const closeSelected = vi.fn();
    const showDetails = renderWithOpen(closeSelected);
    expect(detailsButton("g1").getAttribute("aria-expanded")).toBe("true");

    // When g1's details button is selected
    await userEvent.click(detailsButton("g1"));

    // Then g1's details close
    expect(closeSelected).toHaveBeenCalledExactlyOnceWith("g1");
    expect(showDetails).not.toHaveBeenCalled();
  });

  it("opens another row's details, its button read as not expanded", async () => {
    // Given g1's details open
    const closeSelected = vi.fn();
    const showDetails = renderWithOpen(closeSelected);
    expect(detailsButton("g2").getAttribute("aria-expanded")).toBe("false");

    // When g2's details button is selected
    await userEvent.click(detailsButton("g2"));

    // Then g2's details open
    expect(showDetails).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "g2" }),
    );
    expect(closeSelected).not.toHaveBeenCalled();
  });

  it("shows the open row's details again where the page can't close them from the table", async () => {
    const showDetails = renderWithOpen();
    await userEvent.click(detailsButton("g1"));
    expect(showDetails).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "g1" }),
    );
  });
});
