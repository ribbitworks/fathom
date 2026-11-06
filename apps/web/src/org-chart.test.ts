// SPDX-License-Identifier: Apache-2.0

// Tests for the org chart's tree: who sits under whom, the managers above someone, whose reports
// are hidden when it opens, and where the people shown are placed when managers are collapsed.

import type { OrgChartPerson } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  cardWidth,
  collapsedBelow,
  levelsOf,
  managersAbove,
  placed,
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
