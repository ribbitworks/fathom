// SPDX-License-Identifier: Apache-2.0

// Tests for the People table on its own: how its columns are put in order, where a dragged column
// goes, and adding people for a user who does not see start and end dates. The page around it is
// tested in people-page.test.tsx.

import type { Field, List } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { columnsFor, droppedAfter, PeopleGrid } from "./people-grid.tsx";
import { emptyView } from "./table-view.ts";

const site: Field = {
  id: "f1",
  name: "Site",
  listId: "l1",
  multiple: false,
  required: false,
};
const sites: List = {
  id: "l1",
  name: "Sites",
  description: "",
  visibility: "general",
  retired: false,
  choices: [{ id: "c1", label: "Harbour", description: "", retired: false }],
};

describe("the order of the columns", () => {
  it("follows the order given, putting columns it does not name at the end in their usual order", () => {
    expect(
      columnsFor([site], [sites], ["f1", "employeeId"], true).map(
        ({ key }) => key,
      ),
    ).toEqual(["f1", "employeeId", "preferredName", "startDate", "endDate"]);
  });

  it("offers no choices for a column whose list cannot be found", () => {
    expect(columnsFor([site], [], [], false).at(-1)?.choices).toEqual([]);
  });
});

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

describe("adding people without dates", () => {
  it("leaves dates out for a user who does not see them, and checks Employee IDs against every new row", async () => {
    const add = vi.fn();
    const noop = () => undefined;
    render(
      <MantineProvider>
        <PeopleGrid
          people={[]}
          fields={[site]}
          order={[]}
          lists={[sites]}
          canEdit
          canEditColumns={false}
          showDates={false}
          view={emptyView}
          onView={noop}
          actions={{
            add,
            update: noop,
            remove: noop,
            moveColumn: noop,
            editColumn: noop,
          }}
        />
      </MantineProvider>,
    );
    act(() => {
      document.getElementById("cell-new-0-preferredName")?.focus();
    });
    await userEvent.paste("Hana Fictional\tE1\tHarbour\nIan Fictional");
    expect(add).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Employee ID needed");
    act(() => {
      document.getElementById("cell-new-2-employeeId")?.focus();
    });
    await userEvent.keyboard("E2{Enter}");
    expect(add).toHaveBeenCalledWith(
      [
        {
          preferredName: "Hana Fictional",
          employeeId: "E1",
          values: { f1: ["c1"] },
        },
        {
          preferredName: "Ian Fictional",
          employeeId: "E2",
          values: { f1: [] },
        },
      ],
      expect.any(Function),
      expect.any(Function),
    );
  });
});
