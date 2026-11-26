// SPDX-License-Identifier: Apache-2.0

// Tests of each user's set of private changes, against a real PostgreSQL server.

import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createPool, type Database } from "./client.ts";
import { privateSetOf } from "./private-sets.ts";
import { privateSets, users } from "./schema.ts";

let database: TestDatabase;
let pool: ReturnType<typeof createPool>;
let connection: Database;

beforeAll(async () => {
  database = await startTestDatabase();
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
  await connection.insert(users).values([
    {
      id: "fictional-first",
      name: "Fictional First",
      email: "first@example.test",
    },
    {
      id: "fictional-second",
      name: "Fictional Second",
      email: "second@example.test",
    },
  ]);
});

afterAll(async () => {
  await pool.end();
  await database.remove();
});

describe("a user's set of private changes", () => {
  it("is made with the first change, and kept for every later one", async () => {
    const first = await privateSetOf(connection, "fictional-first");

    expect(await privateSetOf(connection, "fictional-first")).toBe(first);
    expect(
      await connection
        .select({ id: privateSets.id })
        .from(privateSets)
        .where(eq(privateSets.userId, "fictional-first")),
    ).toEqual([{ id: first }]);
  });

  it("is each user's own", async () => {
    expect(await privateSetOf(connection, "fictional-second")).not.toBe(
      await privateSetOf(connection, "fictional-first"),
    );
  });
});
