// SPDX-License-Identifier: Apache-2.0

// Tests for a column's header in the shared table, with a made-up kind of record, gadgets.

import { MantineProvider } from "@mantine/core";
import { useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { droppedAfter } from "./column-header.tsx";
import { RecordGrid } from "./record-grid.tsx";
import { type View, emptyView } from "./table-view.ts";
import {
  actions,
  colour,
  colours,
  gadget,
  gadgetColumns,
  gadgetTable,
  noop,
  renderGadgets,
  testTheme,
} from "./test-support.tsx";

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

  it("groups an added column's menu: its link, sorting, filtering and Metrics, laying out, then changing it", async () => {
    renderViewing(emptyView, noop, {
      given: actions({ removeColumn: vi.fn() }),
      canEditColumns: true,
    });

    const menu = await columnMenu("Colour");
    // The lines between the menu's groups are drawn, not read aloud, so they are found by their kind.
    const groups: string[][] = [[]];
    for (const item of menu.querySelectorAll(
      '[role="menuitem"], .mantine-Menu-divider',
    )) {
      if (item.getAttribute("role") !== "menuitem") groups.push([]);
      // A shortcut's keys follow its name.
      else
        groups.at(-1)?.push(item.textContent.replace(/(Shift|Alt)\+.*$/u, ""));
    }

    expect(groups).toEqual([
      [],
      ["Copy link"],
      ["List order", "Reverse list order"],
      ["Filter…", "Metrics"],
      [
        "Freeze up to this column",
        "Unfreeze columns",
        "Wider",
        "Narrower",
        "Move left",
        "Move right",
        "Hide column",
      ],
      ["Edit column…", "Remove column"],
    ]);
  });

  it("ends a viewer's column menu with its last item, not a line", async () => {
    renderViewing(emptyView);

    const menu = await columnMenu("Colour");
    const parts = [
      ...menu.querySelectorAll('[role="menuitem"], .mantine-Menu-divider'),
    ];

    expect(parts.at(-1)?.textContent).toBe("Hide column");
    expect(
      parts.some(
        (part, place) =>
          part.getAttribute("role") !== "menuitem" &&
          parts[place + 1]?.getAttribute("role") !== "menuitem",
      ),
    ).toBe(false);
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
