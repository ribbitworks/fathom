// SPDX-License-Identifier: Apache-2.0

// Tests for managers and teams in the People table: the managers offered, the teams and feature
// teams that follow, drafted and live managers, and the live people.

import type { Choice, Person } from "@fathom/shared";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { columnsFor } from "./people-grid.tsx";
import { emptyView } from "./table-view.ts";
import { person, lead, people, grid, text } from "./test-people-grid.tsx";
import { positions } from "./test-support.tsx";
import { livePeople } from "./people-live.ts";

describe("managers and teams", () => {
  const squareIn = (row: string, key: string) =>
    document
      .getElementById(`cell-${row}-${key}`)
      ?.querySelector<HTMLElement>("[data-colour]")?.dataset.colour;
  it("changes nothing through Team, which follows from Manager", () => {
    const team = columnsFor([], [], [], true).find(({ key }) => key === "team");
    expect(team?.readOnly).toBe(true);
    expect(team?.change(["p1"])).toEqual({});
  });

  it("shows a reporting team's colour as its square before its name", () => {
    render(grid({ teamColourOf: (id) => (id === "p1" ? "teal" : null) }));
    expect([
      squareIn("p1", "teamName"),
      text("p1", "teamName"),
      squareIn("p2", "teamName"),
    ]).toEqual(["teal", "Harbour Crew", undefined]);
  });

  it("shows the team a person is in by its manager's team's colour", () => {
    render(grid({ teamColourOf: (id) => (id === "p1" ? "teal" : null) }));
    expect([
      squareIn("p2", "team"),
      text("p2", "team"),
      squareIn("p5", "team"),
      squareIn("p1", "team"),
    ]).toEqual(["teal", "Harbour Crew", undefined, undefined]);
  });

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

  describe("the Feature teams column", () => {
    const sent = [
      person("p1", {
        featureTeams: [
          { id: "t2", name: "Search", colour: null },
          { id: "t1", name: "Payments core", colour: null },
        ],
      }),
      person("p2", {
        featureTeams: [{ id: "t2", name: "Search", colour: null }],
      }),
    ];
    const columnOf = (records: readonly Person[]) =>
      columnsFor([], [], [], false, records).find(
        ({ key }) => key === "featureTeams",
      );

    it("names each of someone's teams after its square, in one line", () => {
      render(
        grid({
          people: [
            person("p1", {
              featureTeams: [
                { id: "t2", name: "Search", colour: "teal" },
                { id: "t1", name: "Payments core", colour: null },
                { id: "t3", name: "Field tools", colour: "grape" },
              ],
            }),
          ],
        }),
      );
      const cell = document.getElementById("cell-p1-featureTeams");
      expect([
        cell?.textContent,
        [...(cell?.querySelectorAll<HTMLElement>("[data-colour]") ?? [])].map(
          (square) => square.dataset.colour,
        ),
      ]).toEqual(["Search, Payments core, Field tools", ["teal", "grape"]]);
    });

    it("comes just after Team", () => {
      const keys = columnsFor([], [], [], false, sent).map(({ key }) => key);
      expect(keys.indexOf("featureTeams")).toBe(keys.indexOf("team") + 1);
    });

    it("isn't offered when people's feature teams aren't sent", () => {
      expect(columnOf(people)).toBeUndefined();
    });

    it("offers every team someone is on as a choice, by name", () => {
      expect(
        columnOf(sent)?.choices.map(({ id, label }) => [id, label]),
      ).toEqual([
        ["t1", "Payments core"],
        ["t2", "Search"],
      ]);
    });

    it("holds each person's teams, and none for someone just added, not yet read back", () => {
      expect(columnOf(sent)?.value(sent[0] as Person)).toEqual(["t2", "t1"]);
      expect(columnOf(sent)?.value(person("p3"))).toEqual([]);
    });

    it("is read only, saving nothing and never in a person's draft, since teams are changed on the teams", () => {
      const column = columnOf(sent);
      expect(column?.readOnly).toBe(true);
      expect(column?.multiple).toBe(true);
      expect(column?.change(["t1"])).toEqual({});
      expect(
        column?.live({
          action: "changed",
          changed: [],
          live: { values: {}, links: {} },
          state: "waiting",
          madeBy: null,
          madeAs: null,
          madeAt: null,
          editors: [],
          changedBy: {},
        }),
      ).toEqual([]);
    });
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

  it("gives the same live people and columns again for the same people", () => {
    expect(livePeople(people)).toBe(livePeople(people));
    const lists = [positions];
    const team = () =>
      columnsFor([], lists, [], true, people).find(({ key }) => key === "team");
    expect(team()).toBe(team());
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
