// SPDX-License-Identifier: Apache-2.0

// Tests of lists and their choices against a real PostgreSQL server.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { databaseCodes } from "./errors.ts";
import { errorCodeOf, withClient } from "./test-clients.ts";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database.remove();
});

describe("lists", () => {
  const { uniqueViolation } = databaseCodes;

  it("refuses a list name already used, and a choice already in the same list, ignoring letter case", async () => {
    await withClient(database.app, async (client) => {
      const created = await client.query<{ id: string }>(
        "INSERT INTO lists (name) VALUES ('Fictional Sites'), ('Other Fictional Sites') RETURNING id",
      );
      const [first, second] = created.rows.map(({ id }) => id);
      expect(
        await errorCodeOf(
          client.query("INSERT INTO lists (name) VALUES ('fictional sites')"),
        ),
      ).toBe(uniqueViolation);
      await client.query(
        "INSERT INTO list_items (list_id, label) VALUES ($1, 'Harbour Site')",
        [first],
      );
      expect(
        await errorCodeOf(
          client.query(
            "INSERT INTO list_items (list_id, label) VALUES ($1, 'harbour site')",
            [first],
          ),
        ),
      ).toBe(uniqueViolation);
      await client.query(
        "INSERT INTO list_items (list_id, label) VALUES ($1, 'Harbour Site')",
        [second],
      );
    });
  });

  it("deletes a list's choices with it", async () => {
    await withClient(database.app, async (client) => {
      const created = await client.query<{ id: string }>(
        "INSERT INTO lists (name) VALUES ('Fictional Deleted') RETURNING id",
      );
      const id = created.rows[0]?.id;
      await client.query(
        "INSERT INTO list_items (list_id, label) VALUES ($1, 'Fictional')",
        [id],
      );
      await client.query("DELETE FROM lists WHERE id = $1", [id]);
      const left = await client.query(
        "SELECT 1 FROM list_items WHERE list_id = $1",
        [id],
      );
      expect(left.rows).toHaveLength(0);
    });
  });
});
