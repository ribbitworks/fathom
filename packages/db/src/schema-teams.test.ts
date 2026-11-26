// SPDX-License-Identifier: Apache-2.0

// Tests of reporting lines and teams against a real PostgreSQL server.

import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { databaseCodes } from "./errors.ts";
import {
  addPosition,
  aPosition,
  errorCodeOf,
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
