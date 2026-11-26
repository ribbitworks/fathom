// SPDX-License-Identifier: Apache-2.0

// Tests of the access history and of roles against a real PostgreSQL server: the history kept
// whatever any role tries, and roles' keys and defaults.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { databaseCodes } from "./errors.ts";
import {
  errorCodeOf,
  insufficientPrivilege,
  raisedException,
  withClient,
} from "./test-clients.ts";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database.remove();
});

describe("access history", () => {
  it("lets the application role read and add entries, but not change, remove, or empty them", async () => {
    await withClient(database.app, async (client) => {
      await client.query(
        "INSERT INTO access_history (action, subject_id) VALUES ('fictional-action', 'fictional-subject')",
      );
      const added = await client.query(
        "SELECT action FROM access_history WHERE subject_id = 'fictional-subject'",
      );
      expect(added.rows).toEqual([{ action: "fictional-action" }]);
      for (const change of [
        "UPDATE access_history SET action = 'changed'",
        "DELETE FROM access_history",
        "TRUNCATE access_history",
      ]) {
        expect(await errorCodeOf(client.query(change))).toBe(
          insufficientPrivilege,
        );
      }
    });
  });

  it("refuses changes, removals, and emptying even by the role that owns it", async () => {
    await withClient(database.migrator, async (client) => {
      await client.query(
        "INSERT INTO fathom.access_history (action) VALUES ('fictional-action')",
      );
      for (const change of [
        "UPDATE fathom.access_history SET action = 'changed'",
        "DELETE FROM fathom.access_history",
        "TRUNCATE fathom.access_history",
      ]) {
        expect(await errorCodeOf(client.query(change))).toBe(raisedException);
      }
    });
  });
});

describe("roles", () => {
  it("lets the application rename and describe roles, but never change a role's key", async () => {
    await withClient(database.app, async (client) => {
      expect(
        await errorCodeOf(
          client.query(
            "UPDATE roles SET key = 'fictional-key' WHERE key = 'team-member'",
          ),
        ),
      ).toBe(insufficientPrivilege);
      expect(
        await errorCodeOf(
          client.query(
            "INSERT INTO roles (key, name) VALUES ('administrator', 'Fictional Keyed Role')",
          ),
        ),
      ).toBe(databaseCodes.uniqueViolation);
      const added = await client.query<{ id: string }>(
        "INSERT INTO roles (name, description) VALUES ('Fictional Unkeyed Role', 'For a test.') RETURNING id",
      );
      const where = `WHERE id = '${added.rows[0]?.id ?? ""}'`;
      await client.query(
        `UPDATE roles SET name = 'Fictional Renamed Role', description = '', updated_at = now() ${where}`,
      );
      const read = await client.query(`SELECT key, name FROM roles ${where}`);
      expect(read.rows).toEqual([
        { key: null, name: "Fictional Renamed Role" },
      ]);
      await client.query(`DELETE FROM roles ${where}`);
    });
  });

  it("gives an account several roles, with at most one default", async () => {
    await withClient(database.app, async (client) => {
      const user = "fictional-several-roles";
      await client.query(
        `INSERT INTO users (id, name, email) VALUES ('${user}', 'Fictional Several', 'several@example.test')`,
      );
      const give = (key: string, isDefault: boolean) =>
        client.query(
          `INSERT INTO user_roles (user_id, role_id, is_default) SELECT '${user}', id, ${String(isDefault)} FROM roles WHERE key = '${key}'`,
        );
      await give("feature-lead", true);
      await give("executive", false);
      expect(await errorCodeOf(give("team-member", true))).toBe(
        databaseCodes.uniqueViolation,
      );
      expect(await errorCodeOf(give("executive", false))).toBe(
        databaseCodes.uniqueViolation,
      );
      const held = await client.query(
        `SELECT count(*)::int AS count FROM user_roles WHERE user_id = '${user}'`,
      );
      expect(held.rows).toEqual([{ count: 2 }]);
      await client.query(`DELETE FROM users WHERE id = '${user}'`);
    });
  });
});
