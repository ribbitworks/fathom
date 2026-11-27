// SPDX-License-Identifier: Apache-2.0

// Tests for where the shared table's columns sit, frozen or not, and how wide they are, with a
// made-up kind of record, gadgets.

import type { Field, List } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cellColumn } from "./grid-columns.tsx";
import { columnWidth } from "./grid-layout.ts";
import { RecordGrid } from "./record-grid.tsx";
import { type View, emptyView } from "./table-view.ts";
import { noop, testTheme } from "./test-support.tsx";
import {
  type Gadget,
  actions,
  colour,
  colours,
  gadget,
  gadgetColumns,
  gadgetTable,
  renderGadgets,
} from "./test-gadgets.tsx";

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

  it("draws nothing of the table again on a resize that changes only its faded edges", () => {
    // Given a table whose code column counts each value it reads, frozen up to Colour
    let resized: (() => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe = noop;
        disconnect = noop;
      },
    );
    const room = { width: 1000 };
    measuredAs(room);
    const read = vi.fn((one: Gadget) => one.code);
    const counting = gadgetTable();
    renderGadgets({
      gadgets: [gadget("g1"), gadget("g2")],
      table: {
        ...counting,
        columnsFor: (...given) => {
          const [name, code, ...rest] = counting.columnsFor(...given);
          return [name, { ...code, value: read }, ...rest] as ReturnType<
            typeof counting.columnsFor
          >;
        },
      },
      view: { ...emptyView, frozen: 3 },
    });
    const scroll = screen.getByRole("grid").parentElement as HTMLElement;
    read.mockClear();

    // When the table narrows, as a side panel beside it widens, with every column still fitting
    room.width = 980;
    act(() => {
      resized?.();
    });

    // Then nothing was drawn again
    expect(read).not.toHaveBeenCalled();
    expect(leftOf("Colour")).toBe("200px");

    // When it narrows until columns lie beyond its right edge
    Object.defineProperty(scroll, "scrollWidth", {
      value: 1200,
      configurable: true,
    });
    act(() => {
      resized?.();
    });

    // Then that edge fades, with the table not drawn again
    expect(read).not.toHaveBeenCalled();
    expect(document.querySelector('[data-side="after"]')).not.toBeNull();
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

    it("fades the right edge again once a resize leaves columns beyond it, after scrolling to the end", () => {
      // Given a table measured while scrolled to the middle, then scrolled to its right end
      let resized: (() => void) | undefined;
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(callback: () => void) {
            resized = callback;
          }
          observe = noop;
          disconnect = noop;
        },
      );
      renderGadgets({
        gadgets: [gadget("g1")],
        view: { ...emptyView, frozen: 0 },
      });
      const scroll = screen.getByRole("grid").parentElement as HTMLElement;
      scrolledTo(scroll, 300);
      act(() => {
        resized?.();
      });
      scrolledTo(scroll, 600);
      expect(fade("after")).toBeNull();

      // When a side panel widens, narrowing the table
      Object.defineProperty(scroll, "clientWidth", {
        value: 250,
        configurable: true,
      });
      act(() => {
        resized?.();
      });

      // Then the right edge fades again
      expect(fade("after")).not.toBeNull();
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
