// SPDX-License-Identifier: Apache-2.0

// Tests for the org chart's tree, its layout, the people each Draft view draws, and its view.

import type { OrgChartPerson } from "@fathom/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cardHeight,
  cardWidth,
  chartAddressOf,
  chartDays,
  chartViewSearch,
  chartPeople,
  heightOf,
  collapsedBelow,
  collapsedTo,
  leadOf,
  levelsOf,
  managersAbove,
  placed,
  nothingFound,
  reportColours,
  teamOf,
  treeOf,
} from "./org-chart.ts";
import { formatDay } from "./day-formats.ts";

const shownDay = "2026-11-10";

const person = (
  id: string,
  managerId: string | null,
  preferredName = id,
): OrgChartPerson => ({
  id,
  keyNumber: 1,
  preferredName,
  employeeId: `E-${id}`,
  position: "Fictional Engineer",
  teamName: null,
  teamColour: null,
  managerId,
});

// A head with two managers below, one of whom has two reports, and someone on their own.
const people = [
  person("head", null, "Quinn"),
  person("m1", "head", "Blake"),
  person("m2", "head", "Avery"),
  person("r1", "m1", "Drew"),
  person("r2", "m1", "Casey"),
  person("solo", null, "Ellis"),
];

describe("the org chart's tree", () => {
  it("puts each person under their manager, by name, with those who have none at the top", () => {
    const tree = treeOf(people);
    expect(tree.roots).toEqual(["solo", "head"]);
    expect(tree.reports.get("head")).toEqual(["m2", "m1"]);
    expect(tree.reports.get("m1")).toEqual(["r2", "r1"]);
    expect(tree.reports.has("r1")).toBe(false);
  });

  it("puts someone whose manager is not on the chart at the top", () => {
    const tree = treeOf([person("lost", "nobody")]);
    expect(tree.roots).toEqual(["lost"]);
  });

  it("puts planned hires after the people under the same manager", () => {
    const tree = treeOf([
      person("head", null, "Quinn"),
      {
        ...person("hire", "head", "Avery"),
        planned: { expected: "2027-03" },
      },
      person("report", "head", "Zane"),
    ]);
    expect(tree.reports.get("head")).toEqual(["report", "hire"]);
  });

  it("orders people with the same name by their identifier", () => {
    const tree = treeOf([person("b", null, "Sam"), person("a", null, "Sam")]);
    expect(tree.roots).toEqual(["a", "b"]);
  });

  it("names the managers above someone, nearest first", () => {
    const tree = treeOf(people);
    expect(managersAbove(tree, "r1")).toEqual(["m1", "head"]);
    expect(managersAbove(tree, "head")).toEqual([]);
    expect(managersAbove(tree, "unknown")).toEqual([]);
  });

  it("leaves out a loop of managers, which nobody at the top leads to", () => {
    const tree = treeOf([
      person("a", "b"),
      person("b", "a"),
      person("c", null),
    ]);
    expect([...tree.people.keys()]).toEqual(["c"]);
    expect(tree.roots).toEqual(["c"]);
  });
});

describe("what the org chart hides", () => {
  it("hides the reports of managers below the levels shown, so each opens one level at a time", () => {
    const tree = treeOf(people);
    expect([...collapsedBelow(tree, 2)]).toEqual(["m1"]);
    expect([...collapsedBelow(tree, 1)].sort()).toEqual(["head", "m1"]);
    expect(collapsedBelow(tree, 3).size).toBe(0);
  });

  it("hides as many levels' reports as chosen, and none for all of them", () => {
    const tree = treeOf(people);
    expect([...collapsedTo(tree, 2)]).toEqual(["m1"]);
    expect(collapsedTo(tree, "all").size).toBe(0);
  });

  it("counts the levels, with the people at the top as the first", () => {
    expect(levelsOf(treeOf(people))).toBe(3);
    expect(levelsOf(treeOf([person("solo", null)]))).toBe(1);
    expect(levelsOf(treeOf([]))).toBe(0);
  });
});

describe("one team alone", () => {
  it("holds the manager, at the top, and everyone below them", () => {
    const team = teamOf(treeOf(people), "m1");
    expect(team.roots).toEqual(["m1"]);
    expect([...team.people.keys()].sort()).toEqual(["m1", "r1", "r2"]);
    expect(team.reports.get("m1")).toEqual(["r2", "r1"]);
    expect(team.reports.has("head")).toBe(false);
  });
});

describe("the colours of the org chart's teams", () => {
  it("draws each manager's reports in their team's colour, reaching down until a team below has its own", () => {
    const tree = treeOf([
      { ...person("head", null), teamColour: "teal" },
      person("m1", "head"),
      { ...person("m2", "head"), teamColour: "grape" },
      person("r1", "m1"),
      person("r2", "m2"),
      person("solo", null),
    ]);
    const colours = reportColours(tree);
    expect(Object.fromEntries(colours)).toEqual({
      head: "teal",
      m1: "teal",
      m2: "grape",
      r1: "teal",
      r2: "grape",
    });
    expect(colours.has("solo")).toBe(false);
  });
});

describe("placing the org chart", () => {
  it("stacks reports who manage nobody under their manager, with the managers among them to the right", () => {
    const { cards, lines } = placed(treeOf(people), new Set());
    expect(
      Object.fromEntries(cards.map(({ id, x, y }) => [id, [x, y]])),
    ).toEqual({
      solo: [0, 0],
      head: [264, 0],
      m2: [288, 160],
      m1: [552, 160],
      r2: [576, 276],
      r1: [576, 392],
    });
    expect(lines).toEqual([
      { from: "head", to: "m2", stacked: true },
      { from: "head", to: "m1", stacked: false },
      { from: "m1", to: "r2", stacked: true },
      { from: "m1", to: "r1", stacked: true },
    ]);
  });

  it("centres a manager over a row of managers", () => {
    const { cards } = placed(
      treeOf([
        person("a", null),
        person("b", "a"),
        person("b1", "b"),
        person("c", "a"),
        person("c1", "c"),
      ]),
      new Set(),
    );
    const at = new Map(cards.map((card) => [card.id, card]));
    expect(at.get("b")?.x).toBe(0);
    expect(at.get("c")?.x).toBe(288);
    expect(at.get("a")?.x).toBe((552 - cardWidth) / 2);
  });

  it("leaves out everyone below a collapsed manager", () => {
    const { cards, lines } = placed(treeOf(people), new Set(["m1"]));
    expect(cards.map(({ id }) => id)).not.toContain("r1");
    expect(cards.map(({ id }) => id)).toContain("m1");
    expect(lines.map(({ to }) => to)).not.toContain("r1");
  });
});

describe("the finder's message when nobody on the chart has the name", () => {
  const outside = [
    person("a", null, "Avery Fictional"),
    person("b", null, "Blake Fictional"),
    person("c", null, "Casey Fictional"),
    person("d", null, "Drew Fictional"),
  ];

  it("names one person outside the team who has it", () => {
    expect(nothingFound(outside, " avery ")).toBe(
      "Avery Fictional is not in this team",
    );
  });

  it("names a few, in order of name", () => {
    expect(nothingFound(outside.slice(0, 3).reverse(), "fictional")).toBe(
      "Avery Fictional, Blake Fictional, and Casey Fictional are not in this team",
    );
  });

  it("finds a name whatever its accents", () => {
    expect(
      nothingFound([person("s", null, "Silje Holm-Schrøder")], "schroder"),
    ).toBe("Silje Holm-Schrøder is not in this team");
  });

  it("counts more than three", () => {
    expect(nothingFound(outside, "fictional")).toBe(
      "4 people with that name are not in this team",
    );
  });

  it("says nobody has it when nobody outside the team has it either", () => {
    expect(nothingFound(outside, "Zz")).toBe("Nobody has that name");
    expect(nothingFound([], "Avery")).toBe("Nobody has that name");
  });
});

describe("the people the Draft menu draws", () => {
  const draft = { state: "waiting", unpublished: false } as const;
  const chart = {
    people: [
      person("head", null, "Quinn"),
      person("m1", "head", "Blake"),
      person("m2", "head", "Avery"),
      { ...person("r1", "m1", "Drew"), draft: { ...draft, managerId: "m2" } },
      {
        ...person("m3", "head", "Casey"),
        teamName: "Fictional team",
        draft: { ...draft, teamName: "Fictional crew" },
      },
      {
        ...person("r2", "m3", "Finley"),
        draft: { ...draft, position: "Fictional Lead" },
      },
      {
        ...person("r3", "m3", "Harper"),
        position: null,
        draft: { ...draft, position: "Fictional Lead" },
      },
      {
        ...person("m4", "head", "Gray"),
        teamName: "Fictional band",
        draft: {
          ...draft,
          position: "Fictional Lead",
          teamName: "Fictional troupe",
        },
      },
    ],
    drafted: [person("head", null, "Quinn"), person("new", "head", "Ellis")],
  };

  it("draws a moved person under their new manager, with a Live copy under their current one", () => {
    const tree = treeOf(chartPeople(chart, "both", shownDay));
    expect(tree.reports.get("m2")).toEqual(["r1"]);
    expect(tree.reports.get("m1")).toEqual(["r1 live"]);
    expect(tree.people.get("r1")?.moved).toEqual({ ...draft, managerId: "m2" });
    expect(tree.people.get("r1 live")).toMatchObject({
      liveCopyOf: "r1",
      employeeId: null,
    });
  });

  it("says on a taller card when a move takes effect, only when it is not the day shown", () => {
    const moved = (managerFrom: string) =>
      chartPeople(
        {
          ...chart,
          people: [
            person("m1", null, "Blake"),
            person("m2", null, "Avery"),
            {
              ...person("r1", "m1", "Drew"),
              draft: { ...draft, managerId: "m2", managerFrom },
            },
          ],
        },
        "both",
        shownDay,
      ).find(({ id }) => id === "r1");
    const earlier = moved("2026-10-01");
    expect(earlier?.movedFrom).toBe(formatDay("2026-10-01"));
    expect(heightOf(earlier)).toBeGreaterThan(cardHeight);
    const onTheDay = moved(shownDay);
    expect(onTheDay?.movedFrom).toBeUndefined();
    expect(heightOf(onTheDay)).toBe(cardHeight);
  });

  it("draws a drafted team name, with the live one, on a taller card", () => {
    const shown = chartPeople(chart, "both", shownDay).find(
      ({ id }) => id === "m3",
    );
    expect(shown?.teamName).toBe("Fictional crew");
    expect(shown?.renamed?.live).toBe("Fictional team");
    expect(heightOf(shown)).toBeGreaterThan(cardHeight);
  });

  it("draws a drafted position, with the live one, on a taller card", () => {
    const shown = chartPeople(chart, "both", shownDay).find(
      ({ id }) => id === "r2",
    );
    expect(shown?.position).toBe("Fictional Lead");
    expect(shown?.repositioned?.live).toBe("Fictional Engineer");
    expect(shown?.renamed).toBeUndefined();
    expect(heightOf(shown)).toBe(
      heightOf(
        chartPeople(chart, "both", shownDay).find(({ id }) => id === "m3"),
      ),
    );
  });

  it("gives a planned hire's card heading a feature team a line for the team's name", () => {
    const planned = {
      ...person("h1", null, "Fictional Tester, TBD-1"),
      planned: { expected: "2027-02", shownId: "TBD-1" },
    };
    expect(heightOf(planned)).toBe(cardHeight);
    expect(heightOf({ ...planned, teamName: "Fictional Harbour" })).toBe(
      heightOf({
        ...person("m1", null),
        teamName: "Fictional Harbour",
        movedFrom: "Nov 1, 2026",
      }),
    );
  });

  it("draws no drafted position beside a position not shown", () => {
    const shown = chartPeople(chart, "both", shownDay).find(
      ({ id }) => id === "r3",
    );
    expect(shown?.position).toBeNull();
    expect(shown?.repositioned).toBeUndefined();
    expect(heightOf(shown)).toBe(cardHeight);
  });

  it("makes a card taller still for both a drafted position and a drafted team name", () => {
    const shown = chartPeople(chart, "both", shownDay);
    const height = (id: string) => heightOf(shown.find((one) => one.id === id));
    expect(height("m4") - height("r2")).toBe(height("r2") - cardHeight);
  });

  it("draws the chart as drafts make it, and the live chart alone", () => {
    expect(chartPeople(chart, "drafts", shownDay).map(({ id }) => id)).toEqual([
      "head",
      "new",
    ]);
    const live = chartPeople(chart, "live", shownDay);
    expect(live.find(({ id }) => id === "r1")?.managerId).toBe("m1");
    expect(live.some(({ id }) => id === "r1 live")).toBe(false);
  });

  it("keeps each card's draft live only, in place, with no Live lines, so its marks show", () => {
    const live = chartPeople(chart, "live", shownDay);
    const card = (id: string) => live.find((one) => one.id === id);
    expect(card("r1")?.moved).toEqual({ ...draft, managerId: "m2" });
    expect(card("r2")?.position).toBe("Fictional Engineer");
    expect(card("r2")?.repositioned).toEqual({
      draft: { ...draft, position: "Fictional Lead" },
    });
    expect(card("m3")?.teamName).toBe("Fictional team");
    expect(card("m3")?.renamed?.live).toBeNull();
    expect(heightOf(card("m4"))).toBe(cardHeight);
  });

  it("keeps each card's draft with the drafts applied, and marks someone a draft adds", () => {
    const applied = chartPeople(
      {
        people: chart.people,
        drafted: [
          person("m1", null, "Blake"),
          person("m2", null, "Avery"),
          person("r1", "m2", "Drew"),
          { ...person("new", "m1", "Ellis"), draft },
        ],
      },
      "drafts",
      shownDay,
    );
    const card = (id: string) => applied.find((one) => one.id === id);
    expect(card("r1")?.moved).toEqual({ ...draft, managerId: "m2" });
    expect(card("new")?.added).toEqual(draft);
    expect(card("m1")?.moved).toBeUndefined();
    expect(heightOf(card("r1"))).toBe(cardHeight);
  });
});

describe("chartDays", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-03-10T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const later = "2028-03-15";
  it.each([
    [
      "draws people on a later day for a role that sees future lines",
      { otherDates: true, futureLines: true, featureTeams: false },
      { day: later, peopleDay: later },
    ],
    [
      "draws people as today on feature teams' later day without future lines",
      { otherDates: true, futureLines: false, featureTeams: true },
      { day: later, peopleDay: undefined },
    ],
    [
      "draws no later day on reporting teams without future lines",
      { otherDates: true, futureLines: false, featureTeams: false },
      { day: undefined, peopleDay: undefined },
    ],
  ])("%s", (_, sees, expected) => {
    expect(chartDays(later, sees)).toEqual(expected);
  });
});

describe("the chart's view", () => {
  it("keeps the levels as a word in the view, and a count in the address", () => {
    const search = { teams: "feature" as const, levels: 3, team: "FX-p2" };

    const inView = chartViewSearch(search);

    expect(inView).toEqual({
      ...search,
      levels: "3",
      show: undefined,
      view: undefined,
    });
    expect(chartAddressOf(inView)).toEqual({
      ...search,
      show: undefined,
      view: undefined,
    });
  });

  it("keeps every level as all, and leaves out levels it can't count", () => {
    expect(chartAddressOf({ levels: "all" }).levels).toBe("all");
    expect(chartAddressOf({ levels: "0" }).levels).toBeUndefined();
    expect(chartViewSearch({}).levels).toBeUndefined();
  });

  it("leaves out choices of other kinds than the chart's", () => {
    expect(chartAddressOf({ teams: "reporting", team: ["FX-p2"] })).toEqual({
      show: undefined,
      view: undefined,
      teams: undefined,
      team: undefined,
      levels: undefined,
    });
  });
});

describe("the team shown alone", () => {
  const tree = treeOf(people);

  it("is led by the manager named by Fathom's own ID, or by Employee ID from an old address", () => {
    expect(leadOf(tree, "m1")?.id).toBe("m1");
    expect(leadOf(tree, "E-m1")?.id).toBe("m1");
  });

  it("is no one's for someone with no reports, someone not on the chart, or none asked", () => {
    expect(leadOf(tree, "r1")).toBeUndefined();
    expect(leadOf(tree, "nobody")).toBeUndefined();
    expect(leadOf(tree, undefined)).toBeUndefined();
  });

  it("is never a Live copy's", () => {
    const moved = treeOf([
      ...people,
      { ...person("copy", "head"), liveCopyOf: "m1" },
      person("r3", "copy"),
    ] as OrgChartPerson[]);
    expect(leadOf(moved, "copy")).toBeUndefined();
  });
});

describe("the levels the chart opens on", () => {
  it("are left out of the view and the address, as the chart starts with them", () => {
    expect(chartViewSearch({ levels: 2 }).levels).toBeUndefined();
    expect(chartAddressOf({ levels: "2" }).levels).toBeUndefined();
  });
});
