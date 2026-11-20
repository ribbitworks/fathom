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
