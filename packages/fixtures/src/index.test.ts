// SPDX-License-Identifier: Apache-2.0

// Tests for the fictional organization: the same records every time, identifiers that are valid and
// unique, and people whose details are consistent and drawn from the lists their columns name.

import { describe, expect, it } from "vitest";
import { fictionalId, fictionalOrganization } from "./index.ts";

const version5 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("fictional identifiers", () => {
  it("are version 5 UUIDs, the same for the same name and different for others", () => {
    expect(fictionalId("person:1")).toMatch(version5);
    expect(fictionalId("person:1")).toBe(fictionalId("person:1"));
    expect(fictionalId("person:1")).not.toBe(fictionalId("person:2"));
  });
});

describe("a fictional organization", () => {
  const organization = fictionalOrganization({ size: 150 });

  it("comes out the same every time, and differently from another seed", () => {
    expect(fictionalOrganization({ size: 150 })).toEqual(organization);
    expect(fictionalOrganization({ size: 150, seed: 7 }).people).not.toEqual(
      organization.people,
    );
  });

  it("has unique identifiers and Employee IDs, and end dates after start dates", () => {
    const ids = [
      ...organization.lists.flatMap((list) => [
        list.id,
        ...list.choices.map(({ id }) => id),
      ]),
      ...organization.columns.map(({ id }) => id),
      ...organization.people.map(({ id }) => id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    const employeeIds = organization.people.map(({ employeeId }) => employeeId);
    expect(new Set(employeeIds).size).toBe(employeeIds.length);
    for (const person of organization.people) {
      if (person.endDate !== null) {
        expect(person.endDate >= String(person.startDate)).toBe(true);
      }
    }
  });

  it("includes current and former staff, and people who start after the reference date", () => {
    const { people } = organization;
    expect(people.some(({ endDate }) => endDate !== null)).toBe(true);
    expect(
      people.some(({ startDate }) => String(startDate) > "2026-11-01"),
    ).toBe(true);
    expect(
      people.filter(({ endDate }) => endDate === null).length,
    ).toBeGreaterThan(people.length / 2);
  });

  it("gives each person choices from the lists their columns draw on, one each unless a column takes several", () => {
    for (const person of organization.people) {
      for (const [columnId, chosen] of Object.entries(person.values)) {
        const column = organization.columns.find(({ id }) => id === columnId);
        const list = organization.lists.find(({ id }) => id === column?.listId);
        const offered = list?.choices.map(({ id }) => id) ?? [];
        expect(chosen.every((id) => offered.includes(id))).toBe(true);
        if (!column?.multiple) expect(chosen).toHaveLength(1);
      }
    }
  });
});
