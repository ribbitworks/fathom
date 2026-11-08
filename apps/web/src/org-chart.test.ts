// SPDX-License-Identifier: Apache-2.0

// Tests for the org chart's tree: who sits under whom, the managers above someone, whose reports
// are hidden when it opens, where the people shown are placed when managers are collapsed, and the
// people the Draft menu's choice draws.

import type { OrgChartPerson } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  cardHeight,
  cardWidth,
  chartPeople,
  heightOf,
  collapsedBelow,
  levelsOf,
  managersAbove,
  placed,
  nothingFound,
  reportColours,
  teamOf,
  treeOf,
} from "./org-chart.ts";

const person = (
  id: string,
  managerId: string | null,
  preferredName = id,
): OrgChartPerson => ({
  id,
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
    const tree = treeOf(chartPeople(chart, "both"));
    expect(tree.reports.get("m2")).toEqual(["r1"]);
    expect(tree.reports.get("m1")).toEqual(["r1 live"]);
    expect(tree.people.get("r1")?.moved).toEqual({ ...draft, managerId: "m2" });
    expect(tree.people.get("r1 live")).toMatchObject({
      liveCopyOf: "r1",
      employeeId: null,
    });
  });

  it("draws a drafted team name, with the live one, on a taller card", () => {
    const shown = chartPeople(chart, "both").find(({ id }) => id === "m3");
    expect(shown?.teamName).toBe("Fictional crew");
    expect(shown?.renamed?.live).toBe("Fictional team");
    expect(heightOf(shown)).toBeGreaterThan(cardHeight);
  });

  it("draws a drafted position, with the live one, on a taller card", () => {
    const shown = chartPeople(chart, "both").find(({ id }) => id === "r2");
    expect(shown?.position).toBe("Fictional Lead");
    expect(shown?.repositioned?.live).toBe("Fictional Engineer");
    expect(shown?.renamed).toBeUndefined();
    expect(heightOf(shown)).toBe(
      heightOf(chartPeople(chart, "both").find(({ id }) => id === "m3")),
    );
  });

  it("draws no drafted position beside a position not shown", () => {
    const shown = chartPeople(chart, "both").find(({ id }) => id === "r3");
    expect(shown?.position).toBeNull();
    expect(shown?.repositioned).toBeUndefined();
    expect(heightOf(shown)).toBe(cardHeight);
  });

  it("makes a card taller still for both a drafted position and a drafted team name", () => {
    const shown = chartPeople(chart, "both");
    const height = (id: string) => heightOf(shown.find((one) => one.id === id));
    expect(height("m4") - height("r2")).toBe(height("r2") - cardHeight);
  });

  it("draws the chart as drafts make it, and the live chart alone", () => {
    expect(chartPeople(chart, "drafts").map(({ id }) => id)).toEqual([
      "head",
      "new",
    ]);
    const live = chartPeople(chart, "live");
    expect(live.find(({ id }) => id === "r1")?.managerId).toBe("m1");
    expect(live.some(({ id }) => id === "r1 live")).toBe(false);
  });
});
