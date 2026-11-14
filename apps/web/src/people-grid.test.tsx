// SPDX-License-Identifier: Apache-2.0

// Tests for the People table on its own: how its columns are put in order, how wide each column is,
// adding people for a user who does not see start and end dates, and the people as they are live.
// The grid it is built on is tested in record-grid.test.tsx, and the page around it in
// people-page.test.tsx.

import type { Choice, Field, List, Person } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { act, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { countRows } from "./metrics.ts";
import {
  type Column,
  columnsFor,
  livePeople,
  PeopleGrid,
  peopleAsShown,
} from "./people-grid.tsx";
import { columnWidth } from "./record-grid.tsx";
import { emptyView, formatDay } from "./table-view.ts";
import { testTheme } from "./test-support.tsx";

const site: Field = {
  id: "f1",
  name: "Site",
  type: "choice" as const,
  listId: "l1",
  visibility: null,
  multiple: false,
  required: false,
  onPlannedHires: true,
};
// The built-in Positions list, with the one position the people below have.
const positions: List = {
  id: "positions",
  name: "Positions",
  description: "",
  visibility: "general",
  retired: false,
  builtIn: "positions",
  choices: [
    {
      id: "position-1",
      label: "Fictional Engineer",
      description: "",
      retired: false,
    },
  ],
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

const noop = () => undefined;
const actions = {
  add: noop,
  update: noop,
  remove: noop,
  discard: noop,
  resubmit: noop,
  decide: noop,
  editColumn: noop,
  discardColumn: noop,
  resubmitColumn: noop,
};

describe("how wide each column is", () => {
  const person = (id: string, preferredName: string): Person => ({
    id,
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
        actions={actions}
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
    const noop = () => undefined;
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
          actions={{ ...actions, add }}
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

describe("the live people", () => {
  const draft = {
    state: "waiting" as const,
    madeBy: null,
    madeAt: null,
    changed: [],
    live: { values: {}, links: {} },
  };
  const person = (id: string, more: Partial<Person> = {}): Person => ({
    id,
    preferredName: `Fictional ${id}`,
    employeeId: id,
    positionId: "position-1",
    startDate: "2024-01-01",
    endDate: null,
    values: {},
    links: {},
    ...more,
  });

  it("leaves out those only drafted to be added, and puts back what drafts change", () => {
    expect(
      livePeople([
        person("p1"),
        person("p2", { draft: { ...draft, action: "created" } }),
        person("p3", { draft: { ...draft, action: "deleted" } }),
        person("p4", {
          preferredName: "Fictional Renamed",
          endDate: "2027-01-01",
          values: { f1: ["c2"], f2: ["c9"], f3: ["c5"] },
          draft: {
            ...draft,
            action: "changed",
            changed: ["preferredName", "endDate", "f1", "f2", "f4"],
            live: {
              preferredName: "Fictional p4",
              values: { f1: ["c1"], f2: [] },
              links: {},
            },
          },
        }),
      ]),
    ).toEqual([
      person("p1"),
      person("p3"),
      person("p4", { endDate: null, values: { f3: ["c5"], f1: ["c1"] } }),
    ]);
  });
});

describe("the live links", () => {
  it("puts back each link a draft changes, keeping the rest", () => {
    const kept = { address: "https://kept.example.test/", text: "" };
    const live = { address: "https://live.example.test/", text: "Live" };
    const [person] = livePeople([
      {
        id: "p1",
        preferredName: "Fictional p1",
        employeeId: "p1",
        positionId: "position-1",
        values: {},
        links: {
          f1: { address: "https://drafted.example.test/", text: "" },
          f2: kept,
          f3: { address: "https://added.example.test/", text: "" },
        },
        draft: {
          action: "changed",
          changed: ["f1", "f3"],
          live: { values: {}, links: { f1: live } },
          state: "waiting",
          madeBy: null,
          madeAt: null,
        },
      },
    ]);
    expect(person?.links).toEqual({ f2: kept, f1: live });
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
          actions={{ ...actions, add }}
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
          actions={actions}
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

describe("managers and teams", () => {
  const person = (id: string, more: Partial<Person> = {}): Person => ({
    id,
    preferredName: `Fictional ${id}`,
    employeeId: id,
    positionId: "position-1",
    startDate: "2024-01-01",
    endDate: null,
    isManager: true,
    values: {},
    links: {},
    ...more,
  });
  const lead = (id: string) => ({ id, preferredName: `Fictional ${id}` });
  const people = [
    person("p1", { teamName: "Harbour Crew", manager: null }),
    person("p2", { manager: lead("p1"), team: "Harbour Crew" }),
    person("p3", { endDate: "2025-01-01", manager: lead("p1") }),
    person("p4", {
      manager: lead("p3"),
      team: null,
      managerLeft: true,
      managerFrom: "2024-02-01",
    }),
    person("p5", { manager: { id: "p9", preferredName: "Fictional p9" } }),
  ];
  const grid = (more: Partial<Parameters<typeof PeopleGrid>[0]> = {}) => (
    <MantineProvider theme={testTheme}>
      <PeopleGrid
        people={people}
        fields={[]}
        order={[]}
        lists={[positions]}
        canEdit
        canEditColumns={false}
        showDates
        view={emptyView}
        onView={noop}
        actions={actions}
        {...more}
      />
    </MantineProvider>
  );
  const focus = (row: string, key: string) => {
    act(() => {
      document.getElementById(`cell-${row}-${key}`)?.focus();
    });
  };
  const text = (row: string, key: string) =>
    document.getElementById(`cell-${row}-${key}`)?.textContent;

  it("offers everyone marked as a manager and still employed, and keeps those gone, or not shown, for the people who report to them", () => {
    const manager = columnsFor([], [], [], true, people).find(
      ({ key }) => key === "managerId",
    );
    expect(
      manager?.choices.map(({ id, label, retired }) => [id, label, retired]),
    ).toEqual([
      ["p1", "Fictional p1", false],
      ["p2", "Fictional p2", false],
      ["p3", "Fictional p3", true],
      ["p4", "Fictional p4", false],
      ["p5", "Fictional p5", false],
      ["p9", "Fictional p9", true],
    ]);
    expect(manager?.retiredLabel).toBe("No longer offered");
  });

  it("offers planned managers, named as their rows are, only on planned hires' rows and never to the hire itself", () => {
    const hire = (id: string, more: Partial<Person> = {}): Person =>
      person(id, {
        kind: "planned-hire",
        preferredName: "",
        employeeId: `TBD-${id}`,
        ...more,
      });
    const rows = [
      person("p1"),
      hire("h1"),
      hire("h2", { isManager: false }),
      hire("h3", { preferredName: "Fictional Lead Hire" }),
    ];
    const manager = columnsFor([], [positions], [], true, rows).find(
      ({ key }) => key === "managerId",
    );
    expect(manager?.choices.map(({ id, label }) => [id, label])).toEqual([
      ["h1", "Fictional Engineer, TBD-h1"],
      ["h3", "Fictional Lead Hire"],
      ["p1", "Fictional p1"],
    ]);
    const choiceOf = (id: string) =>
      manager?.choices.find((offered) => offered.id === id) as Choice;
    const pickable = (id: string, row: Person) =>
      manager?.pickableOn?.(choiceOf(id), row, row.kind ?? "person");
    expect(pickable("h1", rows[0] as Person)).toBe(false);
    expect(pickable("p1", rows[0] as Person)).toBe(true);
    expect(pickable("h1", rows[3] as Person)).toBe(true);
    expect(pickable("h1", rows[1] as Person)).toBe(false);
    expect(pickable("p1", rows[1] as Person)).toBe(true);
  });

  it("offers Manager? on planned hires as on people", () => {
    const marked = columnsFor([], [], [], true).find(
      ({ key }) => key === "isManager",
    );
    expect(marked?.offeredOn?.("planned-hire") ?? true).toBe(true);
  });

  it("offers nobody drafted to be added or removed, or still being added", () => {
    const draft = { state: "waiting" as const, madeBy: null, madeAt: null };
    const manager = columnsFor([], [], [], true, [
      person("p1"),
      person("p2", {
        draft: {
          ...draft,
          action: "created",
          changed: [],
          live: { values: {}, links: {} },
        },
      }),
      person("p3", {
        draft: {
          ...draft,
          action: "deleted",
          changed: [],
          live: { values: {}, links: {} },
        },
      }),
      person("pending-p4"),
    ]).find(({ key }) => key === "managerId");
    expect(manager?.choices.map(({ id }) => id)).toEqual(["p1"]);
  });

  it("shows live managers, teams and Left marks when only live people are shown", () => {
    const draft = { state: "waiting" as const, madeBy: null, madeAt: null };
    render(
      grid({
        view: { ...emptyView, show: "live" },
        people: [
          person("p1", {
            teamName: "Drafted Crew",
            draft: {
              ...draft,
              action: "changed",
              changed: ["teamName"],
              live: { teamName: "Harbour Crew", values: {}, links: {} },
            },
          }),
          person("p2", {
            manager: lead("p1"),
            team: "Drafted Crew",
            managerFrom: null,
          }),
          person("p3", { endDate: "2025-01-01" }),
          person("p4", {
            manager: lead("p1"),
            team: "Drafted Crew",
            managerFrom: "2024-01-01",
            draft: {
              ...draft,
              action: "changed",
              changed: ["managerId"],
              live: { managerId: "p3", values: {}, links: {} },
            },
          }),
        ],
      }),
    );
    expect(text("p2", "team")).toBe("Harbour Crew");
    expect(text("p1", "teamName")).toBe(
      "Harbour Crew, Live. A change is waiting for approval.",
    );
    expect(text("p4", "managerId")).toBe(
      "Fictional p3Left, their end date has passed, Live. A change is waiting for approval.",
    );
    expect(text("p4", "team")).toBe(
      "Fictional p3, Live. A change is waiting for approval.",
    );
  });

  it("marks a live manager who has left in the Live row under a drafted move", () => {
    render(
      grid({
        people: [
          person("p1", { teamName: "Harbour Crew", manager: null }),
          person("p3", { endDate: "2025-01-01", manager: lead("p1") }),
          person("p4", {
            manager: lead("p1"),
            team: "Harbour Crew",
            draft: {
              state: "waiting",
              madeBy: null,
              madeAt: null,
              action: "changed",
              changed: ["managerId"],
              live: { managerId: "p3", values: {}, links: {} },
            },
          }),
        ],
      }),
    );
    expect(text("p4", "managerId")).not.toContain("Left");
    const liveRow = document
      .getElementById("cell-p4-managerId")
      ?.closest("tr")?.nextElementSibling;
    expect(liveRow?.textContent).toContain(
      "Fictional p3Left, their end date has passed",
    );
  });

  it("names each team by its name, or by its manager's while it has none, and shows only the managers' teams", () => {
    const team = columnsFor([], [], [], true, people).find(
      ({ key }) => key === "team",
    );
    expect(team?.choices.map(({ id, label }) => [id, label])).toEqual([
      ["p3", "Fictional p3"],
      ["p9", "Fictional p9"],
      ["p1", "Harbour Crew"],
    ]);
    expect(team?.readOnly).toBe(true);
  });

  it("breaks people down by manager, counting each manager's direct reports", () => {
    const manager = columnsFor([], [], [], true, people).find(
      ({ key }) => key === "managerId",
    ) as Column;
    expect(manager.breaksDown).not.toBe(false);
    const counts = countRows(people, [manager]);
    expect(counts.of(["p1"])).toBe(2);
    expect(counts.of(["p3"])).toBe(1);
  });

  it("leaves Manager assigned out for those who may not see dates", () => {
    expect(columnsFor([], [], [], false, people).map(({ key }) => key)).toEqual(
      [
        "preferredName",
        "employeeId",
        "positionId",
        "managerId",
        "isManager",
        "team",
        "teamName",
        "expected",
      ],
    );
  });

  it("offers only those marked as managers live, keeping a manager no longer marked for their reports", () => {
    const draft = (live: boolean): Person["draft"] => ({
      action: "changed",
      changed: ["isManager"],
      live: { isManager: live, values: {}, links: {} },
      state: "waiting",
      madeBy: null,
      madeAt: null,
    });
    const choices = columnsFor([], [], [], true, [
      person("p1", { isManager: false }),
      person("p2", { isManager: false, draft: draft(true) }),
      person("p3", { isManager: true, draft: draft(false) }),
      person("p4", { isManager: false, manager: lead("p5") }),
      person("p5", { isManager: false }),
    ]).find(({ key }) => key === "managerId")?.choices;
    expect(choices?.map(({ id, retired }) => [id, retired])).toEqual([
      ["p2", false],
      ["p5", true],
    ]);
  });

  it("shows whether each person is marked as a manager as a checkbox, and filters by it", () => {
    render(
      grid({
        people: [person("p1"), person("p2", { isManager: false })],
        view: { ...emptyView, filters: { isManager: { empty: true } } },
      }),
    );
    expect(text("p2", "isManager")).toBe("No");
    expect(document.getElementById("cell-p1-isManager")).toBeNull();
  });

  it("shows each person's manager and team, marking a manager who has left", () => {
    render(grid());
    expect(text("p2", "managerId")).toBe("Fictional p1");
    expect(text("p2", "team")).toBe("Harbour Crew");
    expect(text("p1", "teamName")).toBe("Harbour Crew");
    expect(text("p1", "managerId")).toBe("");
    expect(text("p4", "managerId")).toBe(
      "Fictional p3Left, their end date has passed",
    );
    expect(text("p4", "team")).toBe("Fictional p3");
    expect(text("p5", "managerId")).toBe("Fictional p9");
  });

  it("marks a drafted manager, and the team that follows, with the live ones", () => {
    const drafted = person("p2", {
      manager: lead("p4"),
      team: null,
      draft: {
        state: "waiting",
        madeBy: null,
        madeAt: null,
        action: "changed",
        changed: ["managerId", "managerFrom"],
        live: { managerId: "p1", values: {}, links: {} },
      },
    });
    render(
      grid({
        people: people.map((other) => (other.id === "p2" ? drafted : other)),
      }),
    );
    expect(text("p2", "managerId")).toBe(
      "Fictional p4, Draft: changed from “Fictional p1”, draft, live Fictional p1",
    );
    expect(text("p2", "team")).toBe(
      "Fictional p4, Draft: changed from “Harbour Crew”, draft, live Harbour Crew",
    );
    const liveRow = document
      .getElementById("cell-p2-team")
      ?.closest("tr")?.nextElementSibling;
    const keys = columnsFor([], [], [], true).map(({ key }) => key);
    const liveCells = [...(liveRow?.querySelectorAll("td") ?? [])];
    expect(liveCells[keys.indexOf("managerId")]?.textContent).toBe(
      "Fictional p1, live",
    );
    expect(liveCells[keys.indexOf("team")]?.textContent).toBe(
      "Harbour Crew, live",
    );
  });

  it("changes a person's manager, offering No manager first and only those still employed, and clears it with Delete", async () => {
    const update = vi.fn();
    render(grid({ actions: { ...actions, update } }));
    focus("p2", "managerId");
    await userEvent.keyboard("{Enter}");
    const options = await screen.findAllByRole("option");
    expect(options.map(({ textContent }) => textContent)).toEqual([
      "No manager",
      "Fictional p1",
      "Fictional p2",
      "Fictional p4",
      "Fictional p5",
    ]);
    await userEvent.click(screen.getByRole("option", { name: "Fictional p4" }));
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p2" }),
      { managerId: "p4" },
    );
    focus("p2", "managerId");
    await userEvent.keyboard("{Delete}");
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p2" }),
      { managerId: null },
    );
  });

  it("keeps the Team column read only, since a team follows from its manager", async () => {
    const update = vi.fn();
    render(grid({ actions: { ...actions, update } }));
    focus("p2", "team");
    await userEvent.keyboard("{Enter}x{Delete}");
    expect(screen.queryByRole("option")).toBeNull();
    expect(within(screen.getByRole("grid")).queryByRole("textbox")).toBeNull();
    expect(update).not.toHaveBeenCalled();
    expect(
      document.getElementById("cell-p2-team")?.getAttribute("aria-readonly"),
    ).toBe("true");
  });

  it("names a team, and moves the date a manager is someone's from, but never clears that date", async () => {
    const update = vi.fn();
    render(grid({ actions: { ...actions, update } }));
    focus("p1", "teamName");
    await userEvent.keyboard("{Enter}{Control>}a{/Control}Quay Crew{Enter}");
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p1" }),
      { teamName: "Quay Crew" },
    );
    focus("p4", "managerFrom");
    await userEvent.keyboard("{Enter}{Control>}a{/Control}2024-03-01{Enter}");
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p4" }),
      { managerFrom: "2024-03-01" },
    );
    update.mockClear();
    focus("p4", "managerFrom");
    await userEvent.keyboard("{Delete}");
    expect(update).not.toHaveBeenCalled();
    expect(text("p4", "managerFrom")).toBe(formatDay("2024-02-01"));
    await userEvent.keyboard("{Enter}{Control>}a{/Control}{Backspace}{Enter}");
    expect(screen.getByRole("alert").textContent).toBe("Date needed");
    expect(update).not.toHaveBeenCalled();
  });

  it("checks and unchecks Manager? with one click, Space, or Enter, but not by typing", async () => {
    const update = vi.fn();
    render(
      grid({
        people: [person("p1", { isManager: false }), person("p2")],
        actions: { ...actions, update },
      }),
    );
    await userEvent.click(
      document.getElementById("cell-p1-isManager") as HTMLElement,
    );
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p1" }),
      { isManager: true },
    );
    focus("p2", "isManager");
    await userEvent.keyboard(" ");
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p2" }),
      { isManager: false },
    );
    await userEvent.keyboard("{Enter}");
    expect(update).toHaveBeenCalledTimes(3);
    await userEvent.keyboard("y");
    expect(update).toHaveBeenCalledTimes(3);
    await userEvent.dblClick(
      document.getElementById("cell-p2-isManager") as HTMLElement,
    );
    expect(update).toHaveBeenCalledTimes(5);
    expect(document.getElementById("cell-p2-isManager-editor")).toBeNull();
  });

  it("says what Manager? was live beside a draft that changes it", () => {
    const changing = (live: boolean): Person["draft"] => ({
      action: "changed",
      changed: ["isManager"],
      live: { isManager: live, values: {}, links: {} },
      state: "waiting",
      madeBy: null,
      madeAt: null,
    });
    render(
      grid({
        people: [
          person("p1", { isManager: false, draft: changing(true) }),
          person("p2", { isManager: true, draft: changing(false) }),
        ],
      }),
    );
    expect(text("p1", "isManager")).toBe(
      "No, Draft: changed from “Yes”, draft, live Yes",
    );
    expect(text("p2", "isManager")).toBe(
      "Yes, Draft: changed from “No”, draft, live No",
    );
  });

  it("adds people pasted as managers or not, and refuses a Manager? that is neither", async () => {
    const add = vi.fn();
    render(
      grid({
        actions: { ...actions, add },
        order: ["preferredName", "employeeId", "positionId", "isManager"],
      }),
    );
    focus("new-0", "preferredName");
    await userEvent.paste(
      "Fictional p6\tp6\tFictional Engineer\tYes\nFictional p7\tp7\tFictional Engineer\tno",
    );
    const requests = (add.mock.calls[0]?.[0] ?? []) as {
      request: { isManager?: boolean };
    }[];
    expect(requests.map(({ request }) => request.isManager)).toEqual([
      true,
      undefined,
    ]);
    focus("new-0", "preferredName");
    await userEvent.paste("Fictional p8\tp8\tFictional Engineer\tmaybe");
    expect(add).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Manager?: use Yes or No");
  });

  it("adds people with managers pasted by name, and their team's name, but not a team pasted", async () => {
    const add = vi.fn();
    render(
      grid({
        actions: { ...actions, add },
        order: [
          "preferredName",
          "employeeId",
          "positionId",
          "managerId",
          "team",
          "teamName",
          "managerFrom",
        ],
      }),
    );
    focus("new-0", "preferredName");
    await userEvent.paste(
      "Fictional p6\tp6\tFictional Engineer\tFictional p1\tHarbour Crew\tQuay Crew\t2024-05-01\nFictional p7\tp7\tFictional Engineer\tFictional p2",
    );
    expect(add).toHaveBeenCalledWith(
      [
        {
          id: expect.stringMatching(/^pending-/) as string,
          request: {
            preferredName: "Fictional p6",
            employeeId: "p6",
            positionId: "position-1",
            startDate: null,
            endDate: null,
            managerId: "p1",
            managerFrom: "2024-05-01",
            teamName: "Quay Crew",
            values: {},
            links: {},
          },
        },
        {
          id: expect.stringMatching(/^pending-/) as string,
          request: {
            preferredName: "Fictional p7",
            employeeId: "p7",
            positionId: "position-1",
            startDate: null,
            endDate: null,
            managerId: "p2",
            values: {},
            links: {},
          },
        },
      ],
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("refuses Manager assigned for someone with no manager and no line, but moves a line with no manager", async () => {
    const update = vi.fn();
    render(
      grid({
        actions: { ...actions, update },
        people: [
          ...people,
          person("p6", { manager: null, managerFrom: "2024-03-01" }),
        ],
      }),
    );
    focus("p1", "managerFrom");
    await userEvent.keyboard("{Enter}2024-05-01{Enter}");
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose a manager, or leave Manager assigned empty",
    );
    expect(update).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    focus("p6", "managerFrom");
    await userEvent.keyboard("{Enter}{Control>}a{/Control}2024-04-01{Enter}");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: "p6" }), {
      managerFrom: "2024-04-01",
    });
  });

  it("gives the same live people and columns again for the same people", () => {
    expect(livePeople(people)).toBe(livePeople(people));
    const lists = [positions];
    const team = () =>
      columnsFor([], lists, [], true, people).find(({ key }) => key === "team");
    expect(team()).toBe(team());
  });

  it("refuses a new person's Manager assigned without a manager", async () => {
    const add = vi.fn();
    render(
      grid({
        actions: { ...actions, add },
        order: ["preferredName", "employeeId", "managerFrom"],
      }),
    );
    focus("new-0", "preferredName");
    await userEvent.paste("Fictional p6\tp6\t2024-05-01");
    expect(add).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose a manager, or leave Manager assigned empty",
    );
  });

  it("puts back each person's live manager, and their team as the manager's live team name has it", () => {
    const draft = {
      state: "waiting" as const,
      madeBy: null,
      madeAt: null,
    };
    expect(
      livePeople([
        person("p1", {
          teamName: "Drafted Crew",
          draft: {
            ...draft,
            action: "changed",
            changed: ["teamName"],
            live: { teamName: "Harbour Crew", values: {}, links: {} },
          },
        }),
        person("p2", {
          manager: lead("p1"),
          team: "Drafted Crew",
          managerFrom: "2026-01-01",
          draft: {
            ...draft,
            action: "changed",
            changed: ["managerId", "managerFrom"],
            live: {
              managerId: "p4",
              managerFrom: "2024-01-01",
              values: {},
              links: {},
            },
          },
        }),
        person("p3", {
          manager: lead("p1"),
          team: "Drafted Crew",
        }),
        person("p4"),
        person("p5", {
          manager: lead("p1"),
          draft: {
            ...draft,
            action: "changed",
            changed: ["managerId"],
            live: { managerId: null, values: {}, links: {} },
          },
        }),
        person("p6", {
          manager: null,
          draft: {
            ...draft,
            action: "changed",
            changed: ["managerId"],
            live: { managerId: "p9", values: {}, links: {} },
          },
        }),
      ]),
    ).toEqual([
      person("p1", { teamName: "Harbour Crew" }),
      person("p2", {
        manager: lead("p4"),
        team: null,
        managerFrom: "2024-01-01",
      }),
      person("p3", { manager: lead("p1"), team: "Harbour Crew" }),
      person("p4"),
      person("p5", { manager: null }),
      person("p6", {
        manager: { id: "p9", preferredName: "Someone not shown in People" },
      }),
    ]);
  });
});

describe("planned hires beside people", () => {
  const states: List = {
    id: "states",
    name: "Hiring states",
    description: "",
    visibility: "general",
    retired: false,
    builtIn: "hiring-states",
    choices: [
      {
        id: "s-proposed",
        label: "Request to hire",
        description: "",
        retired: false,
        meaning: "proposed",
      },
      {
        id: "s-hired",
        label: "Hired",
        description: "",
        retired: false,
        meaning: "hired",
      },
      {
        id: "s-left",
        label: "Fictional Resigned",
        description: "",
        retired: false,
        meaning: "left",
      },
    ],
  };
  const rows: Person[] = [
    {
      id: "p1",
      preferredName: "Avery Fictional",
      employeeId: "E1",
      positionId: "position-1",
      stateId: "s-hired",
      values: {},
      links: {},
    },
    {
      id: "h1",
      kind: "planned-hire",
      preferredName: "",
      employeeId: "TBD-1",
      positionId: "position-1",
      stateId: "s-proposed",
      expected: "2027-03",
      values: {},
      links: {},
    },
  ];

  it("offers a hire the added columns switched on for planned hires, never required of it", () => {
    const required = { ...site, required: true };
    const off = { ...site, id: "f2", name: "Office", onPlannedHires: false };
    const [offered, notOffered] = ["f1", "f2"].map(
      (key) =>
        columnsFor([required, off], [positions], [], true, rows).find(
          (column) => column.key === key,
        ) as Column,
    );
    expect(offered?.offeredOn?.("planned-hire") ?? true).toBe(true);
    expect(offered?.requiredOn?.("planned-hire")).toBe(false);
    expect(offered?.requiredOn?.("person")).toBe(true);
    expect(notOffered?.offeredOn?.("planned-hire")).toBe(false);
    expect(notOffered?.offeredOn?.("person")).toBe(true);
  });

  it("offers a hire a column by its live setting while a draft switches it", () => {
    const draft = {
      action: "changed" as const,
      changed: ["onPlannedHires"],
      state: "waiting" as const,
      madeBy: null,
      madeAt: null,
    };
    const switchingOn = {
      ...site,
      draft: { ...draft, live: { onPlannedHires: false } },
    };
    const added = {
      ...site,
      id: "f2",
      name: "Office",
      draft: { ...draft, action: "created" as const, changed: [], live: {} },
    };
    const [live, drafted] = ["f1", "f2"].map(
      (key) =>
        columnsFor([switchingOn, added], [positions], [], true, rows).find(
          (column) => column.key === key,
        ) as Column,
    );
    expect(live?.offeredOn?.("planned-hire")).toBe(false);
    expect(drafted?.offeredOn?.("planned-hire") ?? true).toBe(true);
  });

  it("offers a person states of the meaning they show, a new person Hired or Left, and a hire only Proposed or Open", () => {
    const state = columnsFor([], [positions, states], [], true, rows).find(
      ({ key }) => key === "stateId",
    ) as Column;
    const offered = (record: Person | undefined, kind: string) =>
      states.choices
        .filter((option) => state.pickableOn?.(option, record, kind))
        .map(({ id }) => id);
    expect(state.readOnlyOn).toBeUndefined();
    expect(offered(rows[0], "person")).toEqual(["s-hired"]);
    expect(
      offered({ ...(rows[0] as Person), stateId: "s-left" }, "person"),
    ).toEqual(["s-left"]);
    expect(offered(undefined, "person")).toEqual(["s-hired", "s-left"]);
    expect(offered(rows[1], "planned-hire")).toEqual(["s-proposed"]);
    expect(state.newRowValue?.("planned-hire")).toEqual(["s-proposed"]);
    expect(state.newRowValue?.("person")).toEqual(["s-hired"]);
    expect(state.required).toBe(true);
    const proposedOnly = { ...states, choices: states.choices.slice(0, 1) };
    const bare = columnsFor([], [positions, proposedOnly], [], true, rows).find(
      ({ key }) => key === "stateId",
    ) as Column;
    expect(bare.newRowValue?.("person")).toEqual([]);
  });

  it("shows the month a hire is expected, which nobody changes, and refuses a typed ID that looks temporary", async () => {
    const expected = columnsFor([], [positions, states], [], true, rows).find(
      ({ key }) => key === "expected",
    ) as Column;
    expect(expected.choices.map(({ label }) => label)).toEqual(["Mar 2027"]);
    expect(
      expected.live({
        action: "changed",
        changed: [],
        live: { values: {}, links: {} },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      }),
    ).toEqual([]);
    expect(expected.change(["2027-03"])).toEqual({});
    render(
      <MantineProvider theme={testTheme}>
        <PeopleGrid
          people={rows}
          fields={[]}
          order={[]}
          lists={[positions, states]}
          canEdit
          canEditColumns={false}
          canEditHires
          showDates
          view={emptyView}
          onView={noop}
          actions={actions}
        />
      </MantineProvider>,
    );
    act(() => {
      document.getElementById("cell-p1-employeeId")?.focus();
    });
    await userEvent.keyboard("tbd-5{Enter}");
    expect(screen.getByRole("alert").textContent).toBe(
      "An ID cannot start with TBD-, which temporary IDs use",
    );
  });

  it.each([
    ["one of each", [0, 1], "1 person and 1 planned hire"],
    ["planned hires alone", [1, 1], "2 planned hires"],
    ["people alone", [0, 0], "2 people"],
  ])(
    "counts %s by kind, above the table and in Metrics",
    (_case, picked, line) => {
      render(
        <MantineProvider theme={testTheme}>
          <PeopleGrid
            people={picked.map((index, at) => ({
              ...(rows.at(index) as Person),
              id: `r${String(at)}`,
              employeeId: `X${String(at)}`,
            }))}
            fields={[]}
            order={[]}
            lists={[positions, states]}
            canEdit={false}
            canEditColumns={false}
            showDates
            view={{ ...emptyView, breakdown: ["positionId"] }}
            onView={noop}
            actions={actions}
          />
        </MantineProvider>,
      );
      const panel = screen.getByRole("region", { name: "Metrics" });
      expect(panel.textContent).toContain(line);
      expect(
        screen.getAllByRole("status").map(({ textContent }) => textContent),
      ).toContain(line);
      expect(
        within(panel)
          .getAllByRole("columnheader")
          .map((th) => th.textContent),
      ).toContain("Count");
    },
  );

  it("names a hire by its live position and ID on its Live row while a draft names it", () => {
    const named: Person = {
      ...(rows[1] as Person),
      preferredName: "Fictional test lead",
      draft: {
        action: "changed",
        changed: ["preferredName"],
        live: { preferredName: "", values: {}, links: {} },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
    };
    render(
      <MantineProvider theme={testTheme}>
        <PeopleGrid
          people={[named]}
          fields={[]}
          order={[]}
          lists={[positions, states]}
          canEdit
          canEditColumns={false}
          canEditHires
          showDates
          view={emptyView}
          onView={noop}
          actions={actions}
        />
      </MantineProvider>,
    );
    expect(
      document.getElementById("cell-h1-preferredName")?.textContent,
    ).toContain("Fictional test lead");
    const liveRow = document.querySelector("tr[aria-hidden='true']");
    expect(liveRow?.querySelector("td")?.textContent).toBe(
      "Fictional Engineer, TBD-1, live",
    );
  });

  it("names a hire with no name by its position and ID, which sorts it", () => {
    render(
      <MantineProvider theme={testTheme}>
        <PeopleGrid
          people={rows}
          fields={[]}
          order={[]}
          lists={[positions, states]}
          canEdit
          canEditColumns={false}
          canEditHires
          showDates
          view={{
            ...emptyView,
            sort: [{ key: "preferredName", descending: true }],
          }}
          onView={noop}
          actions={actions}
        />
      </MantineProvider>,
    );
    const nameCell = document.getElementById("cell-h1-preferredName");
    expect(nameCell?.textContent).toBe("Fictional Engineer, TBD-1");
    expect(
      document.getElementById("cell-p1-stateId")?.getAttribute("aria-readonly"),
    ).toBeNull();
    expect(
      document.getElementById("cell-h1-stateId")?.getAttribute("aria-readonly"),
    ).toBeNull();
    const names = [...document.querySelectorAll("[id$='-preferredName']")]
      .map((cell) => cell.id)
      .filter((id) => !id.includes("new"));
    expect(names).toEqual(["cell-h1-preferredName", "cell-p1-preferredName"]);
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

describe("people as the Draft menu shows them", () => {
  const someone = (id: string, details: Partial<Person> = {}): Person => ({
    id,
    preferredName: `Fictional ${id}`,
    employeeId: `E${id}`,
    values: {},
    links: {},
    ...details,
  });
  const drafted = (
    action: "created" | "changed" | "deleted",
    state: "waiting" | "rejected" = "waiting",
    changes: Partial<Person> = {},
  ): Partial<Person> => ({
    ...changes,
    draft: {
      action,
      changed: Object.keys(changes),
      live: { preferredName: "Fictional live", values: {}, links: {} },
      state,
      madeBy: null,
      madeAt: null,
    },
  });
  const people = [
    someone("1"),
    someone("2", drafted("changed", "waiting", { preferredName: "Renamed" })),
    someone("3", drafted("changed", "rejected", { preferredName: "Refused" })),
    someone("4", drafted("deleted")),
    someone("5", drafted("created")),
    someone("6", drafted("created", "rejected")),
  ];
  const names = (show: "both" | "drafts" | "live") =>
    peopleAsShown(people, show).map(({ preferredName }) => preferredName);

  it("shows everyone as drafted beside live", () => {
    expect(names("both")).toEqual([
      "Fictional 1",
      "Renamed",
      "Refused",
      "Fictional 4",
      "Fictional 5",
      "Fictional 6",
    ]);
  });

  it("applies waiting drafts, takes rejected ones back, and leaves out those removed or only refused", () => {
    expect(names("drafts")).toEqual([
      "Fictional 1",
      "Renamed",
      "Fictional live",
      "Fictional 5",
    ]);
  });

  it("shows those live as they are", () => {
    expect(names("live")).toEqual([
      "Fictional 1",
      "Fictional live",
      "Fictional live",
      "Fictional 4",
    ]);
  });
});
