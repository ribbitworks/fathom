// SPDX-License-Identifier: Apache-2.0

// Tests for editing the shared table's cells, with a made-up kind of record, gadgets.

import type { Field } from "@fathom/shared";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RecordActions } from "./record-table.ts";
import { formatDay } from "./day-formats.ts";
import {
  type Gadget,
  type GadgetChange,
  actions,
  gadget,
  gadgetTable,
  nameThen,
  nextColumn,
  renderGadgets,
} from "./test-support.tsx";

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

  it("leaves a date's other digits and the cursor in place when a digit in the middle is deleted", async () => {
    renderGadgets({
      gadgets: [],
      fields: [],
      table: nameThen(nextColumn("date")),
    });
    act(() => {
      document.getElementById("cell-new-0-next")?.focus();
    });
    await userEvent.keyboard("20261108");
    const editor = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Next",
    });
    editor.setSelectionRange("2026".length, "2026".length);
    await userEvent.keyboard("{Backspace}");
    expect([editor.value, editor.selectionStart]).toEqual(["202-11-08", 3]);
    await userEvent.keyboard("7");
    expect([editor.value, editor.selectionStart]).toEqual(["2027-11-08", 4]);
  });

  it("ignores a digit typed in the middle of a date that holds all its digits", async () => {
    renderGadgets({
      gadgets: [],
      fields: [],
      table: nameThen(nextColumn("date")),
    });
    act(() => {
      document.getElementById("cell-new-0-next")?.focus();
    });
    await userEvent.keyboard("20261108");
    const editor = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Next",
    });
    editor.setSelectionRange("2026-1".length, "2026-1".length);
    await userEvent.keyboard("0");
    expect([editor.value, editor.selectionStart]).toEqual(["2026-11-08", 6]);
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

describe("typing in a cell", () => {
  it("draws only the cell being typed in, not the table's other rows", async () => {
    // Given a table of two gadgets, watching when the second's name is read to be drawn
    const otherRowReads = vi.fn();
    const base = gadgetTable();
    const table = {
      ...base,
      columnsFor: (...given: Parameters<typeof base.columnsFor>) =>
        base.columnsFor(...given).map((column) =>
          column.key === "name"
            ? {
                ...column,
                value: (record: Gadget) => {
                  if (record.id === "g2") otherRowReads();
                  return column.value(record);
                },
              }
            : column,
        ),
    };
    renderGadgets({ gadgets: [gadget("g1"), gadget("g2")], fields: [], table });
    act(() => {
      document.getElementById("cell-g1-name")?.focus();
    });
    await userEvent.keyboard("{Enter}");
    otherRowReads.mockClear();

    // When several keys are typed into the first gadget's name
    await userEvent.keyboard("abc");

    // Then the second gadget's row isn't drawn again
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty(
      "value",
      "Gadget g1abc",
    );
    expect(otherRowReads).not.toHaveBeenCalled();
  });

  it("keeps what is typed when the editor is double-clicked, and saves it", async () => {
    // Given a gadget's name being typed
    const update = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1")],
      fields: [],
      given: actions({ update }),
    });
    act(() => {
      document.getElementById("cell-g1-name")?.focus();
    });
    await userEvent.keyboard("{Enter}{Control>}a{/Control}Gizmo");

    // When the editor is double-clicked, then Enter is pressed
    await userEvent.dblClick(screen.getByRole("textbox", { name: "Name" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty(
      "value",
      "Gizmo",
    );
    await userEvent.keyboard("{Enter}");

    // Then what was typed is saved
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }), {
      name: "Gizmo",
    });
  });

  it("keeps what is typed in a refused value's editor, and saves it whole once more is typed", async () => {
    // Given a code another gadget has typed and refused
    const update = vi.fn();
    renderGadgets({
      gadgets: [gadget("g1"), gadget("g2")],
      fields: [],
      table: gadgetTable((values, others, changed) =>
        changed === "code" && others().some(({ code }) => code === values.code)
          ? { message: "Another gadget has that code" }
          : undefined,
      ),
      given: actions({ update }),
    });
    act(() => {
      document.getElementById("cell-g1-code")?.focus();
    });
    await userEvent.keyboard("G2{Enter}");
    expect(screen.getByRole("alert").textContent).toBe(
      "Another gadget has that code",
    );
    expect(screen.getByRole("textbox", { name: "Code" })).toHaveProperty(
      "value",
      "G2",
    );

    // When more is typed and Enter is pressed
    await userEvent.keyboard("X{Enter}");

    // Then the whole of it is saved
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }), {
      code: "G2X",
    });
  });

describe("typing fast into a cell", () => {
  it.each([
    ["Name", "name", "Wid", "Wid"],
    ["Next", "next", "203009", "2030-09"],
  ])(
    "keeps the keys typed into %s before its editor has focus, after the first",
    async (name, key, typed, shown) => {
      renderGadgets({
        gadgets: [],
        fields: [],
        table: nameThen(nextColumn("date")),
      });
      const cell = document.getElementById(`cell-new-0-${key}`) as HTMLElement;
      act(() => {
        cell.focus();
      });
      for (const one of typed) fireEvent.keyDown(cell, { key: one });
      await waitFor(() => {
        expect(
          screen.getByRole<HTMLInputElement>("textbox", { name }).value,
        ).toBe(shown);
      });
    },
  );
});
