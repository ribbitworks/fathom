// SPDX-License-Identifier: Apache-2.0

// Tests of the change history against a real PostgreSQL server: change sets and changes kept
// whatever any role tries, and changes recorded as one change set.

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { createDatabase, createPool } from "./client.ts";
import {
  fieldOfValue,
  inChunks,
  recordChanges,
  valueField,
} from "./history.ts";
import * as schema from "./schema.ts";
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

describe("change history", () => {
  const addChange = (setId: string) =>
    `INSERT INTO fathom.changes (change_set_id, record_type, record_id, action, field, tier, new_value) VALUES ('${setId}', 'fictional-record', 'fictional-id', 'created', 'label', 'general', '"Fictional"')`;

  it("lets the application role read and add change sets and changes, but not change, remove, or empty them", async () => {
    await withClient(database.app, async (client) => {
      const added = await client.query<{ id: string }>(
        "INSERT INTO change_sets DEFAULT VALUES RETURNING id",
      );
      const setId = added.rows[0]?.id ?? "";
      await client.query(addChange(setId));
      const read = await client.query(
        `SELECT new_value FROM changes WHERE change_set_id = '${setId}'`,
      );
      expect(read.rows).toEqual([{ new_value: "Fictional" }]);
      for (const change of [
        "UPDATE change_sets SET made_at = now()",
        "DELETE FROM change_sets",
        "TRUNCATE change_sets",
        "UPDATE changes SET field = 'changed'",
        "DELETE FROM changes",
        "TRUNCATE changes",
      ]) {
        expect(await errorCodeOf(client.query(change))).toBe(
          insufficientPrivilege,
        );
      }
    });
  });

  it("publishes a change set when saved, unless it holds private changes", async () => {
    await withClient(database.app, async (client) => {
      const added = await client.query<{ shown: boolean; held: boolean }>(
        "INSERT INTO change_sets (private, published_at) VALUES (false, now() - interval '1 day'), (true, now()) RETURNING published_at = made_at AS shown, published_at IS NULL AS held",
      );
      expect(added.rows).toEqual([
        { shown: true, held: false },
        { shown: null, held: true },
      ]);
    });
  });

  it("lets a change set holding private changes be published, and nothing else", async () => {
    await withClient(database.app, async (client) => {
      const added = await client.query<{ id: string }>(
        "INSERT INTO change_sets (private) VALUES (true) RETURNING id",
      );
      const setId = added.rows[0]?.id ?? "";
      const where = `WHERE id = '${setId}'`;
      expect(
        await errorCodeOf(
          client.query(
            `UPDATE change_sets SET private = false, made_at = now() ${where}`,
          ),
        ),
      ).toBe(insufficientPrivilege);
      expect(
        await errorCodeOf(
          client.query(`UPDATE change_sets SET private = false ${where}`),
        ),
      ).toBe(raisedException);
      await client.query(
        `UPDATE change_sets SET private = false, published_at = clock_timestamp() ${where}`,
      );
      const read = await client.query(
        `SELECT private, published_at > made_at AS later FROM change_sets ${where}`,
      );
      expect(read.rows).toEqual([{ private: false, later: true }]);
      expect(
        await errorCodeOf(
          client.query(`UPDATE change_sets SET private = true ${where}`),
        ),
      ).toBe(raisedException);
      expect(
        await errorCodeOf(
          client.query(
            `UPDATE change_sets SET published_at = clock_timestamp() ${where}`,
          ),
        ),
      ).toBe(raisedException);
      const held = await client.query<{ id: string }>(
        "INSERT INTO change_sets (private) VALUES (true) RETURNING id",
      );
      expect(
        await errorCodeOf(
          client.query(
            `UPDATE change_sets SET published_at = clock_timestamp() WHERE id = '${held.rows[0]?.id ?? ""}'`,
          ),
        ),
      ).toBe(raisedException);
      expect(
        await errorCodeOf(
          client.query(
            `UPDATE change_sets SET private = false, published_at = made_at - interval '1 day' WHERE id = '${held.rows[0]?.id ?? ""}'`,
          ),
        ),
      ).toBe(raisedException);
    });
    await withClient(database.migrator, async (client) => {
      const added = await client.query<{ id: string }>(
        "INSERT INTO fathom.change_sets (private) VALUES (true) RETURNING id",
      );
      expect(
        await errorCodeOf(
          client.query(
            `UPDATE fathom.change_sets SET private = false, kind = 'approval' WHERE id = '${added.rows[0]?.id ?? ""}'`,
          ),
        ),
      ).toBe(raisedException);
    });
  });

  it("refuses changes, removals, and emptying even by the role that owns it", async () => {
    await withClient(database.migrator, async (client) => {
      const added = await client.query<{ id: string }>(
        "INSERT INTO fathom.change_sets DEFAULT VALUES RETURNING id",
      );
      await client.query(addChange(added.rows[0]?.id ?? ""));
      for (const change of [
        "UPDATE fathom.change_sets SET made_at = now()",
        "DELETE FROM fathom.change_sets",
        "TRUNCATE fathom.change_sets CASCADE",
        "UPDATE fathom.changes SET field = 'changed'",
        "DELETE FROM fathom.changes",
        "TRUNCATE fathom.changes",
      ]) {
        expect(await errorCodeOf(client.query(change))).toBe(raisedException);
      }
    });
  });
});

describe("recording changes", () => {
  it("records changes as one change set, and nothing when there are none", async () => {
    const pool = createPool(database.app, () => undefined);
    const connection = createDatabase(pool);
    try {
      expect(await recordChanges(connection, null, [])).toBeNull();
      const recordId = "00000000-0000-4000-8000-0000000000aa";
      const [role] = await connection
        .select({ id: schema.roles.id })
        .from(schema.roles)
        .where(eq(schema.roles.key, "feature-lead"));
      const roleId = role?.id ?? null;
      await connection
        .insert(schema.users)
        .values({
          id: "fictional-maker",
          name: "Fictional Maker",
          email: "maker@example.test",
        })
        .onConflictDoNothing();
      const maker = { userId: "fictional-maker", roleId };
      const changeSetId = await recordChanges(connection, maker, [
        {
          recordType: "person",
          recordId,
          action: "created",
          field: valueField("f1"),
          tier: "general",
          oldValue: null,
          newValue: ["c1"],
        },
      ]);
      const recorded = await connection
        .select()
        .from(schema.changes)
        .where(eq(schema.changes.recordId, recordId));
      expect(recorded).toMatchObject([
        { changeSetId, field: "value:f1", newValue: ["c1"] },
      ]);
      const [set] = await connection
        .select()
        .from(schema.changeSets)
        .where(eq(schema.changeSets.id, changeSetId ?? ""));
      expect(set).toMatchObject({
        madeBy: "fictional-maker",
        madeAsRoleId: roleId,
      });
      const byFathom = await recordChanges(connection, null, [
        {
          recordType: "person",
          recordId,
          action: "changed",
          field: valueField("f1"),
          tier: "general",
          oldValue: ["c1"],
          newValue: null,
        },
      ]);
      const [fathomSet] = await connection
        .select()
        .from(schema.changeSets)
        .where(eq(schema.changeSets.id, byFathom ?? ""));
      expect(fathomSet).toMatchObject({ madeBy: null, madeAsRoleId: null });
      expect(fieldOfValue("value:f1")).toBe("f1");
      expect(inChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(inChunks([])).toEqual([]);
      expect(fieldOfValue("preferredName")).toBeNull();
    } finally {
      await pool.end();
    }
  });
});
