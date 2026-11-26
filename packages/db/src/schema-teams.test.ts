// SPDX-License-Identifier: Apache-2.0

// Tests of reporting lines, teams and feature teams against a real PostgreSQL server.

import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { databaseCodes } from "./errors.ts";
import {
  addPlannedHire,
  addPosition,
  aPosition,
  errorCodeOf,
  firstId,
  withClient,
} from "./test-clients.ts";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
  await withClient(database.app, addPosition);
});

afterAll(async () => {
  await database.remove();
});

describe("reporting lines and teams", () => {
  const { uniqueViolation, checkViolation, restrictViolation } = databaseCodes;
  let added = 0;

  // Adds fictional people, and gives their ids in order.
  async function addPeople(client: Client, count: number) {
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      added += 1;
      const row = await client.query<{ id: string }>(
        `INSERT INTO people (preferred_name, employee_id, position_id) VALUES ($1, $2, ${aPosition}) RETURNING id`,
        [`Fictional Line Person ${String(added)}`, `RL-${String(added)}`],
      );
      ids.push(row.rows[0]?.id as string);
    }
    return ids;
  }

  const addLine = (
    client: Client,
    personId: string | undefined,
    managerId: string | null | undefined,
    fromDate = "2026-01-01",
  ) =>
    client.query(
      "INSERT INTO reporting_lines (person_id, manager_id, from_date) VALUES ($1, $2, $3)",
      [personId, managerId, fromDate],
    );

  const deletePerson = (client: Client, id: string | undefined) =>
    client.query("DELETE FROM people WHERE id = $1", [id]);

  const countOf = async (client: Client, table: string, id: string) =>
    (
      await client.query(
        `SELECT 1 FROM ${table} WHERE ${table === "teams" ? "manager_id" : "person_id"} = $1`,
        [id],
      )
    ).rowCount;

  it("refuses a person reporting to themselves, but takes a line with no manager", async () => {
    await withClient(database.app, async (client) => {
      const [person] = await addPeople(client, 1);
      expect(await errorCodeOf(addLine(client, person, person))).toBe(
        checkViolation,
      );
      await addLine(client, person, null);
    });
  });

  it("refuses two lines for one person from the same day, but not from another", async () => {
    await withClient(database.app, async (client) => {
      const [person, manager] = await addPeople(client, 2);
      await addLine(client, person, manager);
      expect(await errorCodeOf(addLine(client, person, null))).toBe(
        uniqueViolation,
      );
      await addLine(client, person, null, "2026-02-01");
    });
  });

  it("refuses deleting anyone named as a manager, even on a past line", async () => {
    await withClient(database.app, async (client) => {
      const [person, manager] = await addPeople(client, 2);
      await addLine(client, person, manager);
      await addLine(client, person, null, "2026-02-01");
      expect(await errorCodeOf(deletePerson(client, manager))).toBe(
        restrictViolation,
      );
    });
  });

  it("deletes a person's own lines and team name with them", async () => {
    await withClient(database.app, async (client) => {
      const [person, manager] = await addPeople(client, 2);
      await addLine(client, person, manager);
      await client.query(
        "INSERT INTO teams (manager_id, name) VALUES ($1, $2)",
        [person, "Fictional Deleted Team"],
      );
      await deletePerson(client, person);
      expect(await countOf(client, "reporting_lines", String(person))).toBe(0);
      expect(await countOf(client, "teams", String(person))).toBe(0);
    });
  });

  it("refuses a team name already used, ignoring letter case", async () => {
    await withClient(database.app, async (client) => {
      const [first, second] = await addPeople(client, 2);
      const name = (managerId: string | undefined, text: string) =>
        client.query("INSERT INTO teams (manager_id, name) VALUES ($1, $2)", [
          managerId,
          text,
        ]);
      await name(first, "Fictional Platform Team");
      expect(await errorCodeOf(name(second, "fictional platform team"))).toBe(
        uniqueViolation,
      );
    });
  });
});

describe("feature teams", () => {
  const { uniqueViolation, checkViolation } = databaseCodes;
  let added = 0;

  // A fictional feature team, a person and a planned hire, by their ids.
  async function addTeamPersonAndHire(client: Client) {
    added += 1;
    const n = String(added);
    const team = await firstId(
      client,
      "INSERT INTO feature_teams (name) VALUES ($1) RETURNING id",
      [`Fictional Feature Team ${n}`],
    );
    const person = await firstId(
      client,
      `INSERT INTO people (preferred_name, employee_id, position_id) VALUES ($1, $2, ${aPosition}) RETURNING id`,
      [`Fictional Team Person ${n}`, `FT-${n}`],
    );
    const hire = await addPlannedHire(client, `FT-REQ-${n}`);
    return { team, person, hire };
  }

  const join = (
    client: Client,
    team: string,
    member: { person?: string | null; hire?: string | null },
    fromDate = "2027-01-04",
  ) =>
    client.query(
      "INSERT INTO feature_team_memberships (team_id, person_id, planned_hire_id, member, from_date) VALUES ($1, $2, $3, true, $4)",
      [team, member.person ?? null, member.hire ?? null, fromDate],
    );

  const lead = (
    client: Client,
    team: string,
    by: { person?: string | null; hire?: string | null },
    fromDate = "2027-01-04",
  ) =>
    client.query(
      "INSERT INTO feature_team_leads (team_id, lead_id, lead_planned_hire_id, from_date) VALUES ($1, $2, $3, $4)",
      [team, by.person ?? null, by.hire ?? null, fromDate],
    );

  it("puts a person or a planned hire on a team, never both or neither", async () => {
    await withClient(database.app, async (client) => {
      const { team, person, hire } = await addTeamPersonAndHire(client);
      await join(client, team, { person });
      await join(client, team, { hire });
      expect(
        await errorCodeOf(join(client, team, { person, hire }, "2027-02-01")),
      ).toBe(checkViolation);
      expect(await errorCodeOf(join(client, team, {}, "2027-02-01"))).toBe(
        checkViolation,
      );
    });
  });

  it("puts two planned hires on a team from the same day", async () => {
    await withClient(database.app, async (client) => {
      const { team, hire } = await addTeamPersonAndHire(client);
      added += 1;
      const other = await addPlannedHire(client, `FT-REQ-${String(added)}`);
      await join(client, team, { hire });
      await join(client, team, { hire: other });
      expect(
        (
          await client.query(
            "SELECT 1 FROM feature_team_memberships WHERE team_id = $1",
            [team],
          )
        ).rowCount,
      ).toBe(2);
    });
  });

  it("refuses a planned hire's two records for a team from the same day, but not from another", async () => {
    await withClient(database.app, async (client) => {
      const { team, hire } = await addTeamPersonAndHire(client);
      await join(client, team, { hire });
      expect(await errorCodeOf(join(client, team, { hire }))).toBe(
        uniqueViolation,
      );
      await join(client, team, { hire }, "2027-03-01");
    });
  });

  it("deletes a planned hire's memberships with it, and clears it from the leads it held", async () => {
    await withClient(database.app, async (client) => {
      const { team, hire } = await addTeamPersonAndHire(client);
      await join(client, team, { hire });
      await lead(client, team, { hire });

      await client.query("DELETE FROM planned_hires WHERE id = $1", [hire]);

      expect(
        (
          await client.query(
            "SELECT 1 FROM feature_team_memberships WHERE team_id = $1",
            [team],
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await client.query(
            "SELECT lead_id, lead_planned_hire_id FROM feature_team_leads WHERE team_id = $1",
            [team],
          )
        ).rows,
      ).toEqual([{ lead_id: null, lead_planned_hire_id: null }]);
    });
  });

  it("names a team's lead as a person, a planned hire or none, never both", async () => {
    await withClient(database.app, async (client) => {
      const { team, person, hire } = await addTeamPersonAndHire(client);
      await lead(client, team, { person }, "2027-01-04");
      await lead(client, team, { hire }, "2027-02-01");
      await lead(client, team, {}, "2027-03-01");
      expect(
        await errorCodeOf(lead(client, team, { person, hire }, "2027-04-05")),
      ).toBe(checkViolation);
    });
  });
});
