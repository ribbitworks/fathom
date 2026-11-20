// SPDX-License-Identifier: Apache-2.0

// Tests for a row's menu and controls in the shared table, with a made-up kind of record, gadgets.

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
import { describe, expect, it, vi } from "vitest";
import { RecordGrid } from "./record-grid.tsx";
import type { RecordActions, RecordTable } from "./record-table.ts";
import { type View, emptyView } from "./table-view.ts";
import {
  type Gadget,
  type GadgetChange,
  actions,
  gadget,
  gadgetTable,
  noop,
  renderGadgets,
  rowActions,
  testTheme,
  waiting,
} from "./test-support.tsx";

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
