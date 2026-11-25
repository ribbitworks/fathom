// SPDX-License-Identifier: Apache-2.0

// Tests for the People table on its own: the order and width of its columns, adding people for a
// user who does not see start and end dates, refusals of a taken Employee ID and of dates out of
// order, and the buttons over a Name cell.

import type { Field, List, Person } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { columnsFor, PeopleGrid } from "./people-grid.tsx";
import { columnWidth } from "./grid-layout.ts";
import { emptyView } from "./table-view.ts";
import { formatDay } from "./day-formats.ts";
import { noop, positions, testTheme } from "./test-support.tsx";
import { peopleActions, site, sites } from "./test-people-grid.tsx";

describe("the order of the columns", () => {
  it("follows the order given, putting columns it does not name at the end in their usual order", () => {
    expect(
      columnsFor([site], [sites], ["f1", "employeeId"], true).map(
        ({ key }) => key,
      ),
    ).toEqual([
      "f1",
      "employeeId",
      "preferredName",
      "positionId",
      "startDate",
      "endDate",
      "managerId",
      "isManager",
      "managerFrom",
      "team",
      "teamName",
      "expected",
    ]);
  });

  it("leaves Position out for those who cannot see positions, and shows none for a person read without one", () => {
    expect(
      columnsFor([site], [sites], [], true, [], false).map(({ key }) => key),
    ).not.toContain("positionId");
    const position = columnsFor([site], [sites], [], true).find(
      ({ key }) => key === "positionId",
    );
    expect(
      position?.value({
        id: "p9",
        keyNumber: 1,
        preferredName: "Fictional Person",
        employeeId: "E9",
        isManager: false,
        manager: null,
        team: null,
        teamName: null,
        values: {},
        links: {},
      }),
    ).toEqual([]);
  });

  it("shows Start only on planned hires to those who see the hiring plan but not people's dates", () => {
    const keys = (showDates: boolean, showHireDates: boolean) =>
      columnsFor([], [], [], showDates, [], true, showHireDates).map(
        ({ key }) => key,
      );
    expect(keys(false, false)).not.toContain("startDate");
    expect(keys(true, false)).toContain("endDate");
    expect(keys(false, true)).not.toContain("endDate");
    const start = columnsFor([], [], [], false, [], true, true).find(
      ({ key }) => key === "startDate",
    );
    expect(start?.offeredOn?.("planned-hire")).toBe(true);
    expect(start?.offeredOn?.("person")).toBe(false);
    expect(
      columnsFor([], [], [], true, [], true, true).find(
        ({ key }) => key === "startDate",
      )?.offeredOn,
    ).toBeUndefined();
  });

  it("offers no choices for a column whose list cannot be found", () => {
    expect(columnsFor([site], [], [], false).at(-1)?.choices).toEqual([]);
  });
});

describe("how wide each column is", () => {
  const person = (id: string, preferredName: string): Person => ({
    id,
    keyNumber: 1,
    preferredName,
    employeeId: "E1",
    positionId: "position-1",
    startDate: null,
    endDate: null,
    values: {},
    links: {},
  });
  const grid = (people: Person[]) => (
    <MantineProvider theme={testTheme}>
      <PeopleGrid
        people={people}
        fields={[site]}
        order={[]}
        lists={[sites]}
        canEdit={false}
        canEditColumns={false}
        showDates
        view={emptyView}
        onView={noop}
        actions={peopleActions()}
      />
    </MantineProvider>
  );
  const nameChars = () =>
    document.querySelector("col")?.style.getPropertyValue("--cell-chars");
  const choice = (label: string, retired = false) => ({
    id: label,
    label,
    description: "",
    retired,
  });
  const widthOf = (field: Field, list: List) => {
    const column = columnsFor([field], [list], [], false).find(
      ({ key }) => key === field.id,
    );
    return column && columnWidth(column, new Map());
  };

  it("fits a text column to the longest value it held when the page opened, and keeps it while values change", () => {
    const { rerender } = render(
      grid([person("p1", "Hana Fictional"), person("p2", "Ian")]),
    );
    expect(nameChars()).toBe("18");
    rerender(
      grid([
        person("p1", "Hana Fictional With A Much Longer Name"),
        person("p2", "Ian"),
      ]),
    );
    expect(nameChars()).toBe("18");
  });

  it("fits a column drawing on a list to its longest choice, retired ones included, however many a cell may hold", () => {
    const list = {
      ...sites,
      choices: [choice("Harbour"), choice("Lighthouse Point", true)],
    };
    expect(widthOf(site, list)).toEqual({ cells: 16, header: 4 });
    expect(widthOf({ ...site, multiple: true }, list)).toEqual({
      cells: 16,
      header: 4,
    });
  });

  it("fits a date column to the longest date", () => {
    const start = columnsFor([], [], [], true).find(
      ({ key }) => key === "startDate",
    );
    const width = start && columnWidth(start, new Map());
    const longest = Math.max(
      ...Array.from(
        { length: 12 },
        (_, month) =>
          formatDay(`2026-${String(month + 1).padStart(2, "0")}-28`).length,
      ),
    );
    expect(width?.cells).toBe(longest);
    expect(width?.header).toBe(5);
  });

  it("fits a header to its name and its draft's dot, however long the draft's reason", () => {
    const column = (draft: object) =>
      columnsFor(
        [
          {
            id: "f1",
            keyNumber: 1,
            name: "Score",
            type: "number",
            listId: null,
            visibility: "general",
            multiple: false,
            required: false,
            draft,
          } as unknown as Field,
        ],
        [],
        [],
        false,
      ).find(({ key }) => key === "f1");
    const header = (draft: object) => {
      const found = column(draft);
      return found && columnWidth(found, new Map()).header;
    };
    expect(header({ action: "created", state: "waiting" })).toBe(
      "Score".length + 2,
    );
    expect(
      header({
        action: "created",
        state: "rejected",
        reason: "Too long ".repeat(9),
      }),
    ).toBe("Score".length + 2);
  });

  it("fits a text column with no values to its header", () => {
    const [name] = columnsFor([], [], [], false);
    expect(name && columnWidth(name, new Map())).toEqual({
      cells: 0,
      header: 4,
    });
  });

  it("stops at the widest a column may be", () => {
    const long = "L".repeat(40);
    expect(
      widthOf({ ...site, name: long }, { ...sites, choices: [choice(long)] }),
    ).toEqual({ cells: 30, header: 30 });
  });
});

describe("adding people without dates", () => {
  it("leaves dates out for a user who does not see them, and checks Employee IDs against every new row", async () => {
    const add = vi.fn();
    render(
      <MantineProvider theme={testTheme}>
        <PeopleGrid
          people={[]}
          fields={[site]}
          order={["preferredName", "employeeId", "positionId", "f1"]}
          lists={[sites, positions]}
          canEdit
          canEditColumns={false}
          showDates={false}
          view={emptyView}
          onView={noop}
          actions={peopleActions({ add })}
        />
      </MantineProvider>,
    );
    act(() => {
      document.getElementById("cell-new-0-preferredName")?.focus();
    });
    await userEvent.paste(
      "Hana Fictional\tE1\tFictional Engineer\tHarbour\nIan Fictional\t\tFictional Engineer",
    );
    expect(add).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("ID needed");
    act(() => {
      document.getElementById("cell-new-2-employeeId")?.focus();
    });
    await userEvent.keyboard("E2{Enter}");
    expect(add).toHaveBeenCalledWith(
      [
        {
          id: expect.stringMatching(/^pending-/) as string,
          request: {
            preferredName: "Hana Fictional",
            employeeId: "E1",
            positionId: "position-1",
            values: { f1: ["c1"] },
            links: {},
          },
        },
        {
          id: expect.stringMatching(/^pending-/) as string,
          request: {
            preferredName: "Ian Fictional",
            employeeId: "E2",
            positionId: "position-1",
            values: { f1: [] },
            links: {},
          },
        },
      ],
      expect.any(Function),
      expect.any(Function),
    );
  });
});

describe("adding someone with an Employee ID already taken", () => {
  it("names the Employee ID taken before the name still needed, as the row is filled in and when it is added", async () => {
    const add = vi.fn();
    render(
      <MantineProvider theme={testTheme}>
        <PeopleGrid
          people={[
            {
              id: "p1",
              keyNumber: 1,
              preferredName: "Jo Fictional",
              employeeId: "E1",
              positionId: "position-1",
              values: {},
              links: {},
            },
          ]}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit
          canEditColumns={false}
          showDates={false}
          view={emptyView}
          onView={noop}
          actions={peopleActions({ add })}
        />
      </MantineProvider>,
    );
    act(() => {
      document.getElementById("cell-new-0-employeeId")?.focus();
    });
    await userEvent.keyboard("e1{Tab}{Escape}");
    // Named in the row's mark's words as it is filled in, before what is still needed, and in red
    // after the value.
    expect(
      screen.getByText(", New, not saved yet: Someone already has that ID"),
    ).toBeDefined();
    const wrong = screen.getByText("Someone already has that ID");
    expect(wrong.className).toContain("newMarkWrong");
    expect(wrong.parentElement?.getAttribute("aria-live")).toBe("polite");
    // The Employee ID itself is marked, not the name still needed.
    expect(
      document.getElementById("cell-new-0-employeeId")?.className,
    ).toContain("recordProblemCell");
    expect(
      document.getElementById("cell-new-0-preferredName")?.className,
    ).not.toContain("recordProblemCell");
    act(() => {
      document.getElementById("cell-new-0-employeeId")?.focus();
    });
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("alert").textContent).toBe(
      "Someone already has that ID",
    );
    expect(add).not.toHaveBeenCalled();
  });
});

describe("a start date after the end date", () => {
  it.each([
    ["startDate", "Start", "2025-01-01"],
    ["endDate", "End", "2023-01-01"],
  ])("marks the date changed, %s", async (key, label, day) => {
    render(
      <MantineProvider theme={testTheme}>
        <PeopleGrid
          people={[
            {
              id: "p1",
              keyNumber: 1,
              preferredName: "Jo Fictional",
              employeeId: "E1",
              positionId: "position-1",
              startDate: "2024-01-01",
              endDate: "2024-06-01",
              values: {},
              links: {},
            },
          ]}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit
          canEditColumns={false}
          showDates
          view={emptyView}
          onView={noop}
          actions={peopleActions()}
        />
      </MantineProvider>,
    );
    act(() => {
      document.getElementById(`cell-p1-${key}`)?.focus();
    });
    await userEvent.keyboard(`{Enter}{Control>}a{/Control}${day}{Tab}`);
    expect(screen.getByRole("alert").textContent).toBe(
      "The end date cannot be before the start date",
    );
    expect(screen.getByRole("textbox", { name: label }).className).toContain(
      "recordEditorInvalid",
    );
  });
});

describe("the buttons over a Name cell", () => {
  // The simulated browser neither lays out the page nor applies :active, so the stylesheet is read.
  it("are not placed with a transform, which Mantine replaces while a button is pressed", () => {
    const stylesheet = readFileSync(
      join(import.meta.dirname, "row-controls.module.css"),
      "utf8",
    );
    const rule = /\.rowControls,\s*\.fillHire\s*\{([^}]*)\}/.exec(
      stylesheet,
    )?.[1];
    expect(rule).toContain("position: absolute");
    expect(stylesheet).not.toMatch(/\btransform\s*:/);
  });
});
