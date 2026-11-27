// SPDX-License-Identifier: Apache-2.0

// Tests for the ⋯ at the top of a record's details panel, beside the shared table, with a made-up
// kind of record, gadgets.

import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordPanel } from "./record-details.tsx";
import { RecordGrid } from "./record-grid.tsx";
import type { RecordActions, RecordTable } from "./record-table.ts";
import { emptyView } from "./table-view.ts";
import {
  type Gadget,
  type GadgetChange,
  actions,
  gadget,
  gadgetTable,
  noop,
  rowActions,
  testTheme,
  waiting,
} from "./test-support.tsx";

const changed = {
  ...waiting,
  changedByUser: true,
  action: "changed" as const,
  changed: ["code"],
  live: { code: "OLD", values: {}, links: {} },
};

const keyed = (
  more: Partial<RecordTable<Gadget, GadgetChange, GadgetChange>> = {},
): RecordTable<Gadget, GadgetChange, GadgetChange> => ({
  ...gadgetTable(),
  showDetails: noop,
  keyOf: () => ({ kind: "feature", keyNumber: 7 }),
  ...more,
});

function renderPanel({
  gadgets,
  shown = "g1",
  table = keyed(),
  given = actions(),
  canEdit = true,
}: {
  gadgets: Gadget[];
  // The record whose details the panel shows.
  shown?: string;
  table?: RecordTable<Gadget, GadgetChange, GadgetChange>;
  given?: RecordActions<Gadget, GadgetChange, GadgetChange>;
  canEdit?: boolean;
}) {
  return render(
    <MantineProvider theme={testTheme}>
      <RecordGrid
        records={gadgets}
        table={table}
        fields={[]}
        order={[]}
        lists={[]}
        canEdit={canEdit}
        canEditColumns={false}
        view={emptyView}
        onView={noop}
        actions={given}
        panels={[
          {
            key: "details",
            id: "gadget-panel",
            name: "details",
            node: (
              <RecordPanel
                id="gadget-panel"
                titleId="gadget-panel-title"
                recordId={shown}
                title={`Gadget ${shown}`}
                narrow={false}
                onClose={noop}
              >
                Details
              </RecordPanel>
            ),
          },
        ]}
      />
    </MantineProvider>,
  );
}

const panel = () => document.getElementById("gadget-panel") as HTMLElement;

const panelActions = (name: string) =>
  within(panel()).getByRole("button", { name: `Actions for ${name}` });

const itemsOf = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);

describe("a details panel's menu", () => {
  it("offers what the record's row does, in the same order, less Show details", async () => {
    // Given a record with a draft, shown beside its table
    renderPanel({ gadgets: [gadget("g1", { draft: changed })] });

    // When its row's menu and its panel's menu are each opened
    await userEvent.click(rowActions("Gadget g1"));
    const inRow = itemsOf(await screen.findByRole("menu"));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(panelActions("Gadget g1"));
    const inPanel = itemsOf(await screen.findByRole("menu"));

    // Then the panel's are the row's, Show details left out
    expect([inRow, inPanel]).toEqual([
      ["Show details", "Copy link", "Discard draft", "Remove gadget"],
      ["Copy link", "Discard draft", "Remove gadget"],
    ]);
  });

  it("sits before the panel's close button", () => {
    renderPanel({ gadgets: [gadget("g1")] });

    expect(
      within(panel())
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Actions for Gadget g1", "Close details"]);
  });

  it("discards the record's draft from the panel, keeping focus in the panel", async () => {
    const discard = vi.fn();
    renderPanel({
      gadgets: [gadget("g1", { draft: changed })],
      given: actions({ discard }),
    });

    await userEvent.click(panelActions("Gadget g1"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Discard draft" }),
    );

    expect(discard).toHaveBeenCalledWith(
      expect.objectContaining({ id: "g1" }),
      changed,
    );
    await waitFor(() => {
      expect(panel().contains(document.activeElement)).toBe(true);
    });
  });

  it("puts focus on the table once discarding takes away a record its draft added", async () => {
    const added = {
      ...waiting,
      changedByUser: true,
      action: "created" as const,
    };
    renderPanel({ gadgets: [gadget("g1", { draft: added })] });

    await userEvent.click(panelActions("Gadget g1"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Discard draft" }),
    );

    await waitFor(() => {
      expect(document.activeElement?.id).toMatch(/^cell-g1-/);
    });
  });

  it("removes the record from the panel", async () => {
    const remove = vi.fn();
    renderPanel({
      gadgets: [gadget("g1")],
      given: actions({ remove }),
    });

    await userEvent.click(panelActions("Gadget g1"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove gadget" }),
    );

    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }));
  });

  it("keeps the panel open when Esc closes its menu", async () => {
    renderPanel({ gadgets: [gadget("g1")] });
    await userEvent.click(panelActions("Gadget g1"));
    await screen.findByRole("menu");

    await userEvent.keyboard("{Escape}");

    expect(panel()).not.toBeNull();
    expect(panelActions("Gadget g1").getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("keeps the menu open while moving through its items from the keyboard", async () => {
    renderPanel({ gadgets: [gadget("g1")] });
    await userEvent.click(panelActions("Gadget g1"));
    await screen.findByRole("menu");

    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("menu")).toBeDefined();
  });

  it("offers a viewer only what the row offers besides its details", async () => {
    renderPanel({
      gadgets: [gadget("g1", { draft: changed })],
      canEdit: false,
    });

    await userEvent.click(panelActions("Gadget g1"));

    expect(itemsOf(await screen.findByRole("menu"))).toEqual(["Copy link"]);
  });

  it("has no ⋯ where the record's row offers only its details", () => {
    renderPanel({
      gadgets: [gadget("g1")],
      table: { ...gadgetTable(), showDetails: noop },
      canEdit: false,
    });

    expect(
      within(panel()).queryByRole("button", { name: "Actions for Gadget g1" }),
    ).toBeNull();
  });

  it("has no ⋯ for a record the table doesn't hold", () => {
    renderPanel({ gadgets: [gadget("g1")], shown: "g2" });

    expect(
      within(panel()).queryByRole("button", { name: "Actions for Gadget g2" }),
    ).toBeNull();
  });

  it("has no ⋯ for a record still being added", () => {
    renderPanel({
      gadgets: [gadget("pending-g1")],
      shown: "pending-g1",
    });

    expect(
      within(panel()).queryByRole("button", {
        name: "Actions for Gadget pending-g1",
      }),
    ).toBeNull();
  });
});
