// SPDX-License-Identifier: Apache-2.0

// Tests for the fictional allocations, against a PostgreSQL server of their own. Adding and removing
// them with the rest of the seed data is tested with the seed command.

import { createDatabase, createPool, type Database } from "@fathom/db";
import { fictionalOrganization } from "@fathom/fixtures";
import { addToMonth, monthOf, percentageIn } from "@fathom/shared";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  allocationId,
  seedAllocations,
  seededAllocationRows,
  unseedAllocations,
} from "./allocations.ts";
import { activityId } from "./activities.ts";
import { seededFeatures } from "./features.ts";
import { featureId } from "./projects.ts";

let database: TestDatabase;
let pool: ReturnType<typeof createPool>;
let connection: Database;

beforeAll(async () => {
  database = await startTestDatabase();
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
});

afterAll(async () => {
  await pool.end();
  await database.remove();
});

const organization = fictionalOrganization({ size: 20 });

describe("seeding allocations", () => {
  it("adds none before the people, planned hires, and activities they name are there", async () => {
    expect(await seedAllocations(connection, organization)).toBe(false);
  });

  it("adds none when the organization has no open planned hire with a target date", async () => {
    expect(
      await seedAllocations(connection, { ...organization, hires: [] }),
    ).toBe(false);
  });

  it("adds none when the organization has no feature teams", async () => {
    expect(
      await seedAllocations(connection, { ...organization, featureTeams: [] }),
    ).toBe(false);
  });

  it("leaves out an allocation of a planned hire by name when the organization has no such hire", () => {
    const without = {
      ...organization,
      hires: organization.hires.filter(
        ({ name }) => name !== "Mobile developer",
      ),
    };
    expect(seededAllocationRows(without).map(({ id }) => id)).not.toContain(
      allocationId("hire-alone"),
    );
    expect(seededAllocationRows(organization).map(({ id }) => id)).toContain(
      allocationId("hire-alone"),
    );
  });

  it("removes nothing, and records nothing, when there are none", async () => {
    await expect(
      unseedAllocations(connection, organization),
    ).resolves.toBeUndefined();
  });
});

describe("the seeded allocations", () => {
  const general = activityId("crane-control", "general");
  const rows = seededAllocationRows(organization);
  const current = monthOf(organization.referenceDate);
  const meaningOf = new Map<string | null, string>([
    ...seededFeatures.map(({ key, status }): [string, string] => [
      featureId(key),
      status,
    ]),
  ]);
  const people = [...new Set(rows.flatMap(({ personId }) => personId ?? []))];
  const onPerson = (personId: string) =>
    rows.filter((row) => row.personId === personId);
  // What a person is allocated in a month, counting every feature but Possible ones and every
  // activity, and how many features and activities they are on.
  const monthOfPerson = (personId: string, month: string) => {
    const inForce = onPerson(personId).flatMap((row) => {
      const percentage = percentageIn(row.months, month);
      return percentage === null ? [] : [{ ...row, percentage }];
    });
    return {
      total: inForce
        .filter(({ featureId: id }) => meaningOf.get(id) !== "possible")
        .reduce((sum, { percentage }) => sum + percentage, 0),
      assignments: inForce.length,
    };
  };

  it("start no earlier than each person's start, for people still employed", () => {
    for (const personId of people) {
      const person = organization.people.find(({ id }) => id === personId);
      expect(person?.endDate).toBeNull();
      for (const row of onPerson(personId)) {
        const first = Object.keys(row.months).sort()[0];
        expect(String(first) >= monthOf(String(person?.startDate))).toBe(true);
      }
    }
  });

  it("start the planned hire in the month it is expected", () => {
    const [hire] = rows.filter(({ plannedHireId }) => plannedHireId !== null);
    const expected = organization.hires.find(
      ({ id }) => id === hire?.plannedHireId,
    );
    expect(Object.keys(hire?.months ?? {}).sort()[0]).toBe(
      monthOf(String(expected?.targetDate)),
    );
  });

  it("over-allocate someone and under-allocate someone this month", () => {
    const totals = people.map((personId) => monthOfPerson(personId, current));
    expect(totals.some(({ total }) => total > 100)).toBe(true);
    expect(totals.some(({ total }) => total > 0 && total < 100)).toBe(true);
  });

  it("give someone more than two assignments in a month", () => {
    expect(
      people.some(
        (personId) =>
          monthOfPerson(personId, addToMonth(current, 1)).assignments > 2,
      ),
    ).toBe(true);
  });

  it("allocate a done feature only in months past, a cancelled one in months to come, and an activity", () => {
    const of = (meaning: string) =>
      rows.filter(({ featureId: id }) => meaningOf.get(id) === meaning);
    for (const row of of("done")) {
      expect(percentageIn(row.months, current)).toBeNull();
    }
    expect(
      of("cancelled").some(
        (row) => percentageIn(row.months, addToMonth(current, 1)) !== null,
      ),
    ).toBe(true);
    expect(rows.some(({ activityId: id }) => id === general)).toBe(true);
  });

  it("are none for an organization with no feature teams", () => {
    expect(seededAllocationRows({ ...organization, featureTeams: [] })).toEqual(
      [],
    );
  });
});
