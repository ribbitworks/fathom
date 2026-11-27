// SPDX-License-Identifier: Apache-2.0

// Tests for the shared table on its own, with a made-up kind of record, gadgets.

import { draftFilterKey, decidedKinds } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { act, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { noDrafts } from "./drafts.ts";
import { fieldColumn } from "./grid-columns.tsx";
import { useTableScroll } from "./grid-layout.ts";
import { RecordGrid } from "./record-grid.tsx";
import type { Column, RecordTable } from "./record-table.ts";
import { type View, emptyView } from "./table-view.ts";
import { noop, rowActions, testTheme, waiting } from "./test-support.tsx";
import {
  type Gadget,
  type GadgetChange,
  actions,
  gadget,
  gadgetColumns,
  gadgetTable,
  renderGadgets,
} from "./test-gadgets.tsx";

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

  it("says it has none yet above the empty row it may add in", () => {
    renderGadgets({ gadgets: [] });
    const rows = screen.getAllByRole("row");
    const none = screen.getByText("No gadgets yet").closest("tr");
    const empty = screen.getByRole("row", { name: "New gadget" });
    expect(rows.indexOf(none as HTMLElement)).toBe(rows.indexOf(empty) - 1);
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
      approves: decidedKinds,
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
    expect(screen.getByRole("alert").textContent).toBe("Name is too long");
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
          fieldColumn<Gadget, GadgetChange>("later", "text", {
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
            fieldColumn<Gadget, GadgetChange>("later", "text", {
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

  describe("the count above the table, with a record drafted to be removed", () => {
    const removing = (state: "waiting" | "rejected" = "waiting") => [
      gadget("a"),
      gadget("b", { draft: { ...waiting, state, action: "deleted" } }),
    ];
    const counting = (view: View, gadgets = removing()) => {
      renderTable(gadgetTable(), gadgets, { view });
      return screen.getByRole("status").textContent;
    };

    it("leaves it out with drafts beside live, as the metrics do", () => {
      expect(counting({ ...emptyView, show: "both", breakdown: [] })).toBe(
        "1 gadget",
      );
      expect(
        screen.getByRole("region", { name: "Metrics" }).textContent,
      ).toContain("1 gadget with drafts, 2 live");
    });

    it("leaves it out of what a search keeps, though its row shows", () => {
      expect(counting({ ...emptyView, show: "both", search: "Gadget b" })).toBe(
        "0 of 1",
      );
      expect(screen.getByText("Gadget b")).toBeTruthy();
    });

    it("counts it live only, as it is still live", () => {
      expect(counting({ ...emptyView, show: "live" })).toBe("2 gadgets");
    });

    it("counts it once its removal is rejected, as the metrics do", () => {
      expect(
        counting(
          { ...emptyView, show: "both", breakdown: [] },
          removing("rejected"),
        ),
      ).toBe("2 gadgets");
      expect(
        screen.getByRole("region", { name: "Metrics" }).textContent,
      ).toContain("2 gadgets");
    });
  });
});
