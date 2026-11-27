// SPDX-License-Identifier: Apache-2.0

// Tests of the planning settings' working week against a real PostgreSQL server: its starting days
// and the checks on the days and the week's start.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { databaseCodes } from "./errors.ts";
import { errorCodeOf, withClient } from "./test-clients.ts";

const { checkViolation } = databaseCodes;

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database.remove();
});

describe("the planning settings' working week", () => {
  it("starts as Monday to Friday, with weeks from Monday", async () => {
    const row = await withClient(database.app, async (client) =>
      client.query<{ working_days: number[]; week_starts_on: number }>(
        "SELECT working_days, week_starts_on FROM planning_settings",
      ),
    );
    expect(row.rows).toEqual([
      { working_days: [0, 1, 2, 3, 4], week_starts_on: 0 },
    ]);
  });

  it.each([
    ["no working day", "working_days = '{}'"],
    ["a day after Sunday", "working_days = '{0,7}'"],
    ["a week starting after Sunday", "week_starts_on = 7"],
  ])("refuses %s", async (_case, setting) => {
    const code = await withClient(database.app, async (client) =>
      errorCodeOf(client.query(`UPDATE planning_settings SET ${setting}`)),
    );
    expect(code).toBe(checkViolation);
  });
});
