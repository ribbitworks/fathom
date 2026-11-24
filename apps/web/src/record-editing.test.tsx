// SPDX-License-Identifier: Apache-2.0

// Tests for changing a record's values in a details panel where no case is reached from a page.

import { MantineProvider } from "@mantine/core";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlanChange } from "./plan-table.tsx";
import { cellColumn } from "./grid-columns.tsx";
import type { CellRecord } from "./record-table.ts";
import { useRecordEditing } from "./record-editing.tsx";
import { testTheme } from "./test-support.tsx";

describe("a note column", () => {
  it("cannot be changed where no notes can be written", () => {
    const note = cellColumn<CellRecord, PlanChange>("words", "note", {
      label: "Words",
      required: false,
      multiple: false,
      choices: [],
    });
    const { result } = renderHook(() =>
      useRecordEditing<CellRecord, PlanChange>(),
    );
    const editing = result.current.editingOf({
      id: "a",
      kind: "",
      values: { words: "" },
      save: vi.fn(),
      others: () => [],
      recordProblem: () => undefined,
    });
    expect(editing(note)).toBeUndefined();
  });
});

describe("a value opened for changing", () => {
  const code = cellColumn<CellRecord, PlanChange>("code", "text", {
    label: "Code",
    required: false,
    multiple: false,
    choices: [],
  });

  function CodeRow() {
    const { editingOf } = useRecordEditing<CellRecord, PlanChange>();
    const editing = editingOf({
      id: "a",
      kind: "",
      values: { code: "FX-100" },
      save: vi.fn(),
      others: () => [],
      recordProblem: () => undefined,
    })(code);
    return editing?.open === true ? (
      editing.editor
    ) : (
      <button type="button" onClick={editing?.onStart}>
        Change Code
      </button>
    );
  }

  it("opens with its text selected, so typing replaces it", async () => {
    render(
      <MantineProvider theme={testTheme}>
        <CodeRow />
      </MantineProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Change Code" }));

    const field = await screen.findByRole("textbox", { name: "Code" });
    await waitFor(() => {
      expect(document.activeElement).toBe(field);
    });
    expect([
      (field as HTMLInputElement).selectionStart,
      (field as HTMLInputElement).selectionEnd,
    ]).toEqual([0, "FX-100".length]);
  });
});

describe("a date opened for changing", () => {
  const starts = cellColumn<CellRecord, PlanChange>("starts", "date", {
    label: "Starts",
    required: false,
    multiple: false,
    choices: [],
  });

  function StartsRow() {
    const { editingOf } = useRecordEditing<CellRecord, PlanChange>();
    const editing = editingOf({
      id: "a",
      kind: "",
      values: { starts: "2026-11-08" },
      save: vi.fn(),
      others: () => [],
      recordProblem: () => undefined,
    })(starts);
    return editing?.open === true ? (
      editing.editor
    ) : (
      <button type="button" onClick={editing?.onStart}>
        Change Starts
      </button>
    );
  }

  it("leaves the other digits and the cursor in place when a digit in the middle is deleted", async () => {
    render(
      <MantineProvider theme={testTheme}>
        <StartsRow />
      </MantineProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Change Starts" }),
    );
    const field = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Starts",
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(field);
    });

    field.setSelectionRange("2026".length, "2026".length);
    await userEvent.keyboard("{Backspace}");

    expect([field.value, field.selectionStart]).toEqual(["202-11-08", 3]);
  });
});
