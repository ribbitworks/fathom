// SPDX-License-Identifier: Apache-2.0

// Tests for saving cells' values and adding new rows in the shared table, with a made-up kind of
// record, gadgets.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { newRecordProblems } from "./grid-saving.ts";
import type { RecordActions } from "./record-table.ts";
import {
  type Gadget,
  type GadgetChange,
  actions,
  gadget,
  gadgetColumns,
  gadgetTable,
  nameThen,
  nextColumn,
  renderGadgets,
  rowActions,
} from "./test-support.tsx";

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

describe("problems with a row", () => {
  it("names a value its first column cannot take in that cell, and marks the editor", async () => {
    const update = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], given: actions({ update }) });
    act(() => {
      document.getElementById("cell-g1-name")?.focus();
    });
    await userEvent.keyboard("Far too long a name{Tab}");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Name is too long");
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
    expect(screen.getByRole("alert").textContent).toBe("Name is too long");
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
