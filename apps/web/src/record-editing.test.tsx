// SPDX-License-Identifier: Apache-2.0

// Tests for changing a record's values in a details panel where no case is reached from a page.

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlanChange } from "./project-grids.tsx";
import { cellColumn, type CellRecord } from "./record-grid.tsx";
import { useRecordEditing } from "./record-editing.tsx";

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
