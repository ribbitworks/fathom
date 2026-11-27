// SPDX-License-Identifier: Apache-2.0

// Tests for seeding planned hires on the fictional organization's feature teams, recording it, and
// removing them with the seed data.

import {
  changes,
  changeSets,
  type Database,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
  plannedHires,
} from "@fathom/db";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedHires } from "./hires.ts";
import { seed } from "./seed.ts";
import { unseed } from "./unseed.ts";
import {
  organization,
  type SeedTestDatabase,
  startSeedTestDatabase,
} from "./test-seed-command.ts";

let fileDatabase: SeedTestDatabase;
let connection: Database;

beforeAll(async () => {
  fileDatabase = await startSeedTestDatabase();
  ({ connection } = fileDatabase);
});

afterAll(async () => {
  await fileDatabase.remove();
});

describe("planned hires on feature teams", () => {
  // The organization with two of its open hires on its first two feature teams, the second
  // leading its team, as a larger organization puts them on one of its grown teams. A fixture
  // without them stops the tests rather than leaving them nothing to check.
  const present = <Value>(value: Value | undefined, what: string): Value => {
    if (value === undefined) throw new Error(`The fixture has no ${what}`);
    return value;
  };
  const [joining, leading] = organization.hires.filter(
    ({ filledBy }) => filledBy === null,
  );
  const onTeams = structuredClone(organization);
  const [firstTeam, secondTeam] = onTeams.featureTeams;
  const first = present(firstTeam, "first feature team");
  const second = present(secondTeam, "second feature team");
  const joiningId = present(joining, "open planned hire").id;
  const leadingId = present(leading, "second open planned hire").id;
  first.hires = [
    { plannedHireId: joiningId, fromDate: "2026-12-01", leads: false },
  ];
  second.hires = [
    { plannedHireId: leadingId, fromDate: "2027-03-01", leads: true },
  ];
  const firstId = first.id;
  const secondId = second.id;
  const teamChanges = (recordId: string) =>
    connection
      .select({
        field: changes.field,
        action: changes.action,
        tier: changes.tier,
        oldValue: changes.oldValue,
        newValue: changes.newValue,
        madeBy: changeSets.madeBy,
      })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(
        and(eq(changes.recordId, recordId), eq(changes.action, "changed")),
      );

  it("puts them on their teams from their days, one leading, recorded as made by Fathom itself", async () => {
    // Given the people and feature teams, without the planned hires
    await unseed(connection, organization);
    await seed(connection, onTeams);

    // When the planned hires are added
    expect(await seedHires(connection, onTeams)).toBe(true);

    // Then each is on its team from its day, the second leading its team from then
    expect(
      await connection
        .select({
          teamId: featureTeamMemberships.teamId,
          member: featureTeamMemberships.member,
          fromDate: featureTeamMemberships.fromDate,
        })
        .from(featureTeamMemberships)
        .where(isNotNull(featureTeamMemberships.plannedHireId))
        .orderBy(featureTeamMemberships.fromDate),
    ).toEqual([
      { teamId: firstId, member: true, fromDate: "2026-12-01" },
      { teamId: secondId, member: true, fromDate: "2027-03-01" },
    ]);
    expect(
      await connection
        .select({
          teamId: featureTeamLeads.teamId,
          fromDate: featureTeamLeads.fromDate,
        })
        .from(featureTeamLeads)
        .where(eq(featureTeamLeads.leadPlannedHireId, leadingId)),
    ).toEqual([{ teamId: secondId, fromDate: "2027-03-01" }]);

    // And the change history records each team's change, General, as made by Fathom itself
    const joined = await teamChanges(firstId);
    const members = (await teamChanges(secondId)).find(
      ({ field }) => field === "members",
    );
    expect(joined.map(({ field }) => field).sort()).toEqual([
      "hireFrom",
      "members",
    ]);
    expect(joined.every(({ madeBy }) => madeBy === null)).toBe(true);
    expect(joined.every(({ tier }) => tier === "general")).toBe(true);
    expect(joined.find(({ field }) => field === "hireFrom")).toMatchObject({
      oldValue: null,
      newValue: { [joiningId]: "2026-12-01" },
    });
    expect(members?.newValue).toEqual(
      [...(members?.oldValue as string[]), leadingId].sort(),
    );
    expect(
      (await teamChanges(secondId)).filter(({ field }) =>
        ["leadId", "hireLeadFrom"].includes(field),
      ),
    ).toEqual([
      expect.objectContaining({
        field: "leadId",
        oldValue: second.leadId,
        newValue: leadingId,
      }),
      expect.objectContaining({
        field: "hireLeadFrom",
        newValue: { [leadingId]: "2027-03-01" },
      }),
    ]);
  });

  it("are removed, with their teams' records, when the seed data is removed, one leading a team", async () => {
    // Given the hires on their teams, the second leading its team
    const hireLeads = () =>
      connection
        .select({ teamId: featureTeamLeads.teamId })
        .from(featureTeamLeads)
        .where(isNotNull(featureTeamLeads.leadPlannedHireId));
    expect(await hireLeads()).toEqual([{ teamId: secondId }]);

    // When the seed data is removed
    await unseed(connection, organization);

    // Then the hires are gone, and no record names one
    expect(
      await connection
        .select({ id: plannedHires.id })
        .from(plannedHires)
        .where(inArray(plannedHires.id, [joiningId, leadingId])),
    ).toEqual([]);
    expect(await hireLeads()).toEqual([]);
    expect(
      await connection
        .select({ id: featureTeamMemberships.id })
        .from(featureTeamMemberships)
        .where(isNotNull(featureTeamMemberships.plannedHireId)),
    ).toEqual([]);
    expect(await seed(connection, organization)).toBe(true);
  });

  it("put no planned hire on a team removed by hand", async () => {
    // Given the people and feature teams, with the first team removed by hand
    await unseed(connection, organization);
    await seed(connection, onTeams);
    await connection.delete(featureTeams).where(eq(featureTeams.id, firstId));
    const before = await teamChanges(firstId);

    // When the planned hires are added
    await seedHires(connection, onTeams);

    // Then only the second team has one, and only its change is recorded
    expect(
      await connection
        .select({ teamId: featureTeamMemberships.teamId })
        .from(featureTeamMemberships)
        .where(isNotNull(featureTeamMemberships.plannedHireId)),
    ).toEqual([{ teamId: secondId }]);
    expect(await teamChanges(firstId)).toEqual(before);
    await unseed(connection, organization);
    expect(await seed(connection, organization)).toBe(true);
  });
});
