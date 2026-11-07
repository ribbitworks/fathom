// SPDX-License-Identifier: Apache-2.0

// Tests for the org chart's shape: what a person on it holds, and that the mark of a manager who
// has left is sent only when set.

import { describe, expect, it } from "vitest";
import { orgChartSchema } from "./org-chart.ts";

const person = {
  id: "p1",
  preferredName: "Robin Fictional",
  employeeId: "FX-1",
  position: "Fictional Lead",
  teamName: "Fictional team",
  teamColour: "teal",
  managerId: null,
};

describe("the org chart", () => {
  it("holds each person with their General details, and a manager who has left marked as such", () => {
    const chart = orgChartSchema.parse({
      people: [person, { ...person, id: "p2", teamName: null, left: true }],
    });
    expect(chart.people[0]).toEqual(person);
    expect(chart.people[1]?.left).toBe(true);
  });

  it("holds a manager who has left by name alone, for readers who may not see more", () => {
    const named = {
      ...person,
      employeeId: null,
      position: null,
      managerId: null,
    };
    expect(orgChartSchema.parse({ people: [named] }).people[0]).toEqual(named);
  });

  it("drops anything else the server might send", () => {
    const chart = orgChartSchema.parse({
      people: [{ ...person, startDate: "2020-01-01" }],
    });
    expect(chart.people[0]).not.toHaveProperty("startDate");
  });

  it("holds a team's colour only from the palette", () => {
    expect(() =>
      orgChartSchema.parse({ people: [{ ...person, teamColour: "beige" }] }),
    ).toThrow();
  });
});
