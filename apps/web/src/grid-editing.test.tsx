// SPDX-License-Identifier: Apache-2.0

// Tests for editing the shared table's cells, with a made-up kind of record, gadgets.

import type { Field } from "@fathom/shared";
import { act, screen, waitFor } from "@testing-library/react";
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
