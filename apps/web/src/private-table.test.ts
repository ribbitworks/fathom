// SPDX-License-Identifier: Apache-2.0

// Tests for a private page's table: the row each record names, its key, and its groupings.

import type { List } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { privateTable } from "./private-table.ts";
import { followUps, nameField, row } from "./test-private-pages.ts";

const stages: List = {
  id: "stages",
  keyNumber: 2,
  name: "Stages",
  description: "",
  visibility: "general",
  retired: false,
  choices: [
    { id: "s1", label: "Fictional Open", description: "", retired: false },
  ],
};

describe("a private page's table", () => {
  it("names each row by its first column, and gives a row its key once it has one", () => {
    const table = privateTable({ page: followUps([]), lists: [] });
    const saved = row("r1", "Check offline conflicts");
    expect(table.nameColumn).toBe(nameField);
    expect(table.nameOf(saved)).toBe("Check offline conflicts");
    expect(table.keyOf?.(saved)).toEqual({ kind: "row", code: "KR1" });
    expect(table.keyOf?.({ ...saved, key: null })).toBeUndefined();
    expect(table.groupings).toBeUndefined();
  });

  it("names rows by its first column shown where the reader isn't shown the naming one", () => {
    const table = privateTable({
      page: { ...followUps([]), firstFieldId: null },
      lists: [],
    });
    expect(table.nameColumn).toBe(nameField);
    const empty = privateTable({
      page: { ...followUps([]), firstFieldId: null, columns: [] },
      lists: [],
    });
    expect(empty.nameOf(row("r1", "Check offline conflicts"))).toBe("");
  });

  it("groups its rows by each choice column", () => {
    const page = followUps([]);
    const table = privateTable({
      page: {
        ...page,
        columns: [
          ...page.columns,
          {
            id: "30000000-0000-4000-8000-000000000003",
            name: "Stage",
            type: "choice",
            listId: "stages",
            visibility: null,
            multiple: false,
          },
        ],
      },
      lists: [stages],
    });
    expect(table.groupings?.map(({ label }) => label)).toEqual(["Stage"]);
  });
});
