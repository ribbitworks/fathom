// SPDX-License-Identifier: Apache-2.0

// Tests for the People table on its own: how its columns are put in order, how wide each column is,
// adding people for a user who does not see start and end dates, and the people as they are live.
// The grid it is built on is tested in record-grid.test.tsx, and the page around it in
// people-page.test.tsx.

import type { Field, List, Person } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { act, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { columnsFor, livePeople, PeopleGrid } from "./people-grid.tsx";
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
      "managerFrom",
      "team",
      "teamName",
    ]);
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
  moveColumn: noop,
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
    expect(nameChars()).toBe("14");
    rerender(
      grid([
        person("p1", "Hana Fictional With A Much Longer Name"),
        person("p2", "Ian"),
      ]),
    );
    expect(nameChars()).toBe("14");
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
    expect(screen.getByRole("alert").textContent).toBe("Employee ID needed");
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
    // Named in the row's mark as it is filled in, before what is still needed.
    const mark = screen.getByTitle(
      "New, not saved yet: Someone already has that Employee ID",
    );
    expect(mark.className).not.toContain("newMarkWrong");
    const wrong = within(mark).getByText(
      "Someone already has that Employee ID",
    );
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
      "Someone already has that Employee ID",
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

  it("offers everyone still employed as a manager, and keeps those gone, or not shown, for the people who report to them", () => {
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
    expect(text("p1", "teamName")).toBe("Harbour Crew");
    expect(text("p4", "managerId")).toBe(
      "Fictional p3 Left: their end date has passed",
    );
    expect(text("p4", "team")).toBe("Fictional p3");
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

  it("leaves Manager since out for those who may not see dates", () => {
    expect(columnsFor([], [], [], false, people).map(({ key }) => key)).toEqual(
      [
        "preferredName",
        "employeeId",
        "positionId",
        "managerId",
        "team",
        "teamName",
      ],
    );
  });

  it("shows each person's manager and team, marking a manager who has left", () => {
    render(grid());
    expect(text("p2", "managerId")).toBe("Fictional p1");
    expect(text("p2", "team")).toBe("Harbour Crew");
    expect(text("p1", "teamName")).toBe("Harbour Crew");
    expect(text("p1", "managerId")).toBe("");
    expect(text("p4", "managerId")).toBe(
      "Fictional p3 Left: their end date has passed",
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
      "Fictional p4, draft, live Fictional p1",
    );
    expect(text("p2", "team")).toBe("Fictional p4, draft, live Harbour Crew");
    const liveRow = document
      .getElementById("cell-p2-team")
      ?.closest("tr")?.nextElementSibling;
    const keys = columnsFor([], [], [], true).map(({ key }) => key);
    const liveCells = [...(liveRow?.querySelectorAll("td") ?? [])];
    expect(liveCells[keys.indexOf("managerId")]?.textContent).toBe(
      "Fictional p1",
    );
    expect(liveCells[keys.indexOf("team")]?.textContent).toBe("Harbour Crew");
  });

  it("changes a person's manager, offering only those still employed, and clears it with Delete", async () => {
    const update = vi.fn();
    render(grid({ actions: { ...actions, update } }));
    focus("p2", "managerId");
    await userEvent.keyboard("{Enter}");
    const options = await screen.findAllByRole("option");
    expect(options.map(({ textContent }) => textContent)).toEqual([
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
    expect(screen.getByRole("alert").textContent).toBe("Manager since needed");
    expect(update).not.toHaveBeenCalled();
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

  it("refuses Manager since for someone with no manager and no line, but moves a line with no manager", async () => {
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
      "Choose a manager, or leave Manager since empty",
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
    const team = () =>
      columnsFor([], [], [], true, people).find(({ key }) => key === "team");
    expect(team()).toBe(team());
  });

  it("refuses a new person's Manager since without a manager", async () => {
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
      "Choose a manager, or leave Manager since empty",
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
