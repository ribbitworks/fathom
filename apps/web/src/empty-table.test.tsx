// SPDX-License-Identifier: Apache-2.0

// Tests for what an empty table says, and what shows under it.

import { MantineProvider, Table } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EmptyTableRow,
  emptyTableWords,
  leavesOutRecords,
} from "./empty-table.tsx";
import { emptyView } from "./table-view.ts";
import { testTheme } from "./test-support.tsx";

describe("what an empty table says", () => {
  it("says it has none yet, by its noun", () => {
    expect(emptyTableWords({ noun: "releases" }, false)).toBe(
      "No releases yet",
    );
  });

  it("says it in its own words where it has them", () => {
    expect(emptyTableWords({ noun: "drafts", none: "No drafts" }, false)).toBe(
      "No drafts",
    );
  });

  it("says none match while the view leaves records out, whatever its own words", () => {
    expect(emptyTableWords({ noun: "drafts", none: "No drafts" }, true)).toBe(
      "No matching drafts",
    );
  });
});

describe("a view leaving records out", () => {
  it("leaves none out with no search, filter or choice doing so", () => {
    expect(leavesOutRecords(emptyView, undefined, [{ leavesOut: false }])).toBe(
      false,
    );
  });

  it("leaves some out by its search", () => {
    expect(
      leavesOutRecords({ ...emptyView, search: "Harbour" }, undefined),
    ).toBe(true);
  });

  it("leaves some out by the page's own filter", () => {
    expect(leavesOutRecords(emptyView, { keeps: () => true })).toBe(true);
  });

  it("leaves some out by a choice of which records show", () => {
    expect(leavesOutRecords(emptyView, undefined, [{ leavesOut: true }])).toBe(
      true,
    );
  });
});

describe("the line an empty table shows", () => {
  const line = (leavesOut: boolean) =>
    render(
      <MantineProvider theme={testTheme}>
        <Table>
          <Table.Tbody>
            <EmptyTableRow
              span={3}
              table={{ noun: "releases" }}
              leavesOut={leavesOut}
              below={<a href="#schedules">Make a schedule first</a>}
            />
          </Table.Tbody>
        </Table>
      </MantineProvider>,
    );

  it("spans the table, with what goes under its words while none are left out", () => {
    line(false);
    const cell = screen.getByRole("cell");
    expect(cell.getAttribute("colspan")).toBe("3");
    expect(cell.textContent).toBe("No releases yetMake a schedule first");
  });

  it("leaves out what goes under its words while the view leaves records out", () => {
    line(true);
    expect(screen.getByRole("cell").textContent).toBe("No matching releases");
  });
});
