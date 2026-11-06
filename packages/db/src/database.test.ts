// SPDX-License-Identifier: Apache-2.0

// Tests against a real PostgreSQL server built from Fathom's own image: migrations, the client, the
// permissions of each database role, and the server's security settings.

import { eq, getTableName, isTable } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase, createPool } from "./client.ts";
import type { DatabaseConfig } from "./config.ts";
import {
  migrateCommand,
  runMigrations,
  verifyAppliedMigrations,
} from "./migrate.ts";
import * as schema from "./schema.ts";
import {
  fieldOfValue,
  inChunks,
  recordChanges,
  valueField,
} from "./history.ts";
import { appInfo } from "./schema.ts";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";

const insufficientPrivilege = "42501";
const invalidPassword = "28P01";
const rejectedByAccessRules = "28000";
const migrateScript = fileURLToPath(new URL("./migrate.ts", import.meta.url));

let database: TestDatabase;

async function withClient<T>(
  config: DatabaseConfig,
  action: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client(config);
  await client.connect();
  try {
    return await action(client);
  } finally {
    await client.end();
  }
}

async function errorCodeOf(
  promise: Promise<unknown>,
): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

function connectionErrorCode(
  config: DatabaseConfig,
): Promise<string | undefined> {
  return errorCodeOf(withClient(config, () => Promise.resolve()));
}

function migratorSettings(passwordFile: string): NodeJS.ProcessEnv {
  return {
    FATHOM_DB_HOST: database.migrator.host,
    FATHOM_DB_PORT: String(database.migrator.port),
    FATHOM_DB_NAME: database.migrator.database,
    FATHOM_DB_USER: database.migrator.user,
    FATHOM_DB_PASSWORD_FILE: passwordFile,
  };
}

function withPasswordFile<T>(
  password: string,
  action: (passwordFile: string) => T,
): T {
  const folder = mkdtempSync(join(tmpdir(), "fathom-migrate-"));
  try {
    const passwordFile = join(folder, "password");
    writeFileSync(passwordFile, password);
    return action(passwordFile);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

// A position every fictional person and hire below is given, in the built-in Positions list.
const aPosition =
  "(SELECT id FROM list_items WHERE label = 'Fictional Position')";

beforeAll(async () => {
  database = await startTestDatabase();
  await runMigrations(database.migrator);
  await withClient(database.app, (client) =>
    client.query(
      "INSERT INTO list_items (list_id, label) SELECT id, 'Fictional Position' FROM lists WHERE built_in = 'positions'",
    ),
  );
});

afterAll(async () => {
  await database.container.stop();
});

describe("schema", () => {
  // How PostgreSQL abbreviates what a foreign key does when the row it points to is deleted.
  const onDeleteNames = new Map([
    ["a", "no action"],
    ["c", "cascade"],
    ["r", "restrict"],
  ]);
  // Every table the schema module defines, alongside the schema object itself.
  const tables = Object.values(schema as Record<string, unknown>).filter(
    (value) => isTable(value),
  ) as PgTable[];

  it("matches the tables the migrations build: columns, foreign keys, and indexes", async () => {
    expect(tables.length).toBeGreaterThan(1);
    for (const table of tables) {
      const config = getTableConfig(table);
      const name = getTableName(table);
      // One query at a time, since a connection runs only one at once.
      const [columns, foreignKeys, indexes] = await withClient(
        database.migrator,
        async (client) =>
          [
            await client.query<{ column_name: string }>(
              "SELECT column_name FROM information_schema.columns WHERE table_schema = 'fathom' AND table_name = $1",
              [name],
            ),
            await client.query<{ name: string; on_delete: string }>(
              "SELECT conname AS name, confdeltype AS on_delete FROM pg_constraint WHERE contype = 'f' AND conrelid = $1::regclass",
              [`fathom.${name}`],
            ),
            await client.query<{ indexname: string }>(
              "SELECT indexname FROM pg_indexes WHERE schemaname = 'fathom' AND tablename = $1",
              [name],
            ),
          ] as const,
      );
      expect(columns.rows.map((row) => row.column_name).sort()).toEqual(
        config.columns.map((column) => column.name).sort(),
      );
      expect(
        foreignKeys.rows
          .map(
            (row) =>
              `${row.name} ${onDeleteNames.get(row.on_delete) ?? row.on_delete}`,
          )
          .sort(),
      ).toEqual(
        config.foreignKeys
          .map((key) => `${key.getName()} ${String(key.onDelete)}`)
          .sort(),
      );
      const indexNames = indexes.rows.map((row) => row.indexname);
      for (const index of config.indexes) {
        expect(indexNames).toContain(index.config.name);
      }
    }
  });
});

describe("migrations", () => {
  it("can be applied again without changing anything", async () => {
    await runMigrations(database.migrator);
    const result = await withClient(database.migrator, (client) =>
      client.query(
        "SELECT count(*)::int AS total FROM fathom_migrations.migrations",
      ),
    );
    const migrationFiles = readdirSync(
      new URL("../migrations/", import.meta.url),
    ).filter((name) => name.endsWith(".sql"));
    expect(result.rows[0]).toEqual({ total: migrationFiles.length });
  });

  it("refuse to continue when an applied migration file was edited", async () => {
    const original = await withClient(database.migrator, (client) =>
      client.query<{ hash: string }>(
        "SELECT hash FROM fathom_migrations.migrations ORDER BY created_at LIMIT 1",
      ),
    );
    const originalHash = original.rows[0]?.hash;
    await withClient(database.migrator, (client) =>
      client.query(
        "UPDATE fathom_migrations.migrations SET hash = 'edited' WHERE hash = $1",
        [originalHash],
      ),
    );
    try {
      await expect(runMigrations(database.migrator)).rejects.toThrow(
        /migration 0000_create_app_info was changed after it was applied/,
      );
    } finally {
      await withClient(database.migrator, (client) =>
        client.query(
          "UPDATE fathom_migrations.migrations SET hash = $1 WHERE hash = 'edited'",
          [originalHash],
        ),
      );
    }
  });

  it("skip the check when no migration has been applied yet", async () => {
    await withClient(database.migrator, async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(
          "ALTER TABLE fathom_migrations.migrations RENAME TO hidden_for_test",
        );
        await expect(verifyAppliedMigrations(client)).resolves.toBeUndefined();
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });

  it("refuse to continue when an older migration was never applied", async () => {
    await withClient(database.migrator, async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(
          "DELETE FROM fathom_migrations.migrations WHERE created_at = (SELECT min(created_at) FROM fathom_migrations.migrations)",
        );
        await expect(verifyAppliedMigrations(client)).rejects.toThrow(
          /migration 0000_create_app_info is older than the newest applied migration but was never applied/,
        );
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });

  it("refuse to continue when an applied migration has no file", async () => {
    await withClient(database.migrator, (client) =>
      client.query(
        "INSERT INTO fathom_migrations.migrations (hash, created_at) VALUES ('unknown', 1)",
      ),
    );
    try {
      await expect(runMigrations(database.migrator)).rejects.toThrow(
        "has no migration file",
      );
    } finally {
      await withClient(database.migrator, (client) =>
        client.query(
          "DELETE FROM fathom_migrations.migrations WHERE hash = 'unknown'",
        ),
      );
    }
  });

  it("report success or failure as an exit code", async () => {
    await withPasswordFile(database.migrator.password, async (passwordFile) => {
      const settings = migratorSettings(passwordFile);
      expect(await migrateCommand(settings)).toBe(0);
      expect(await migrateCommand({ ...settings, FATHOM_DB_HOST: "" })).toBe(1);
      expect(
        await migrateCommand({ ...settings, FATHOM_DB_USER: "fathom_app" }),
      ).toBe(1);
    });
  });

  it("are applied from the command line as the migration role", () => {
    withPasswordFile(database.migrator.password, (passwordFile) => {
      const result = spawnSync(process.execPath, [migrateScript], {
        encoding: "utf8",
        env: { ...process.env, ...migratorSettings(passwordFile) },
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Migrations applied");
    });
  });

  it("fail from the command line with a clear message when configuration is missing", () => {
    const result = spawnSync(process.execPath, [migrateScript], {
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid database configuration");
  });
});

describe("database client", () => {
  it("reads data as the application role", async () => {
    const pool = createPool(database.app);
    try {
      const rows = await createDatabase(pool)
        .select()
        .from(appInfo)
        .where(eq(appInfo.key, "greeting"));
      expect(rows).toEqual([{ key: "greeting", value: "Hello, Fathom" }]);
    } finally {
      await pool.end();
    }
  });

  it("passes idle connection errors to the given handler instead of ending the process", async () => {
    const handler = vi.fn();
    const pool = createPool(database.app, handler);
    try {
      pool.emit("error", new Error("example failure"));
      expect(handler).toHaveBeenCalledWith(new Error("example failure"));
    } finally {
      await pool.end();
    }
  });

  it("logs idle connection errors by default", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pool = createPool(database.app);
    try {
      pool.emit("error", new Error("example failure"));
      expect(log).toHaveBeenCalledWith(
        "error: an idle database connection failed: example failure",
      );
    } finally {
      log.mockRestore();
      await pool.end();
    }
  });
});

describe("access history", () => {
  const raisedException = "P0001";

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

describe("change history", () => {
  const raisedException = "P0001";
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

  it("lets a change set holding unpublished changes be published, and nothing else", async () => {
    await withClient(database.app, async (client) => {
      const added = await client.query<{ id: string }>(
        "INSERT INTO change_sets (unpublished) VALUES (true) RETURNING id",
      );
      const setId = added.rows[0]?.id ?? "";
      const where = `WHERE id = '${setId}'`;
      expect(
        await errorCodeOf(
          client.query(
            `UPDATE change_sets SET unpublished = false, made_at = now() ${where}`,
          ),
        ),
      ).toBe(insufficientPrivilege);
      await client.query(`UPDATE change_sets SET unpublished = false ${where}`);
      const read = await client.query(
        `SELECT unpublished FROM change_sets ${where}`,
      );
      expect(read.rows).toEqual([{ unpublished: false }]);
      expect(
        await errorCodeOf(
          client.query(`UPDATE change_sets SET unpublished = true ${where}`),
        ),
      ).toBe(raisedException);
    });
    await withClient(database.migrator, async (client) => {
      const added = await client.query<{ id: string }>(
        "INSERT INTO fathom.change_sets (unpublished) VALUES (true) RETURNING id",
      );
      expect(
        await errorCodeOf(
          client.query(
            `UPDATE fathom.change_sets SET unpublished = false, kind = 'approval' WHERE id = '${added.rows[0]?.id ?? ""}'`,
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

describe("lists", () => {
  const uniqueViolation = "23505";

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

describe("release streams", () => {
  const uniqueViolation = "23505";
  const checkViolation = "23514";
  const restrictViolation = "23001";
  const notNullViolation = "23502";

  // Adds fictional streams with the names given, and gives their ids in order.
  async function addStreams(client: Client, ...names: string[]) {
    const ids: string[] = [];
    for (const name of names) {
      const added = await client.query<{ id: string }>(
        "INSERT INTO release_streams (name, cycles_until) VALUES ($1, '2029-01-01') RETURNING id",
        [name],
      );
      ids.push(added.rows[0]?.id as string);
    }
    return ids;
  }

  const addPattern = (
    client: Client,
    streamId: string | undefined,
    length = 3,
    unit = "months",
  ) =>
    client.query(
      "INSERT INTO cycle_patterns (stream_id, starts_on, length, unit, naming) VALUES ($1, '2027-01-01', $2, $3, '{YY}.{N}')",
      [streamId, length, unit],
    );

  const addRelease = (
    client: Client,
    streamId: string | undefined,
    name = "Fictional One",
    lastCycle = "2027-04-01",
    shipsOn: string | null = null,
  ) =>
    client.query(
      "INSERT INTO releases (stream_id, name, first_cycle, last_cycle, ships_on) VALUES ($1, $2, '2027-01-01', $3, $4)",
      [streamId, name, lastCycle, shipsOn],
    );

  it("refuses a stream name already used, ignoring letter case", async () => {
    await withClient(database.app, async (client) => {
      await addStreams(client, "Fictional Majors");
      expect(await errorCodeOf(addStreams(client, "fictional majors"))).toBe(
        uniqueViolation,
      );
    });
  });

  it("refuses a release name already in the same stream, ignoring letter case, but not in another", async () => {
    await withClient(database.app, async (client) => {
      const [first, second] = await addStreams(
        client,
        "Fictional Named",
        "Other Fictional Named",
      );
      await addRelease(client, first);
      expect(
        await errorCodeOf(addRelease(client, first, "fictional one")),
      ).toBe(uniqueViolation);
      await addRelease(client, second);
    });
  });

  it("refuses two patterns starting on the same day in the same stream, but not in another", async () => {
    await withClient(database.app, async (client) => {
      const [first, second] = await addStreams(
        client,
        "Fictional Patterned",
        "Other Fictional Patterned",
      );
      await addPattern(client, first);
      expect(await errorCodeOf(addPattern(client, first))).toBe(
        uniqueViolation,
      );
      await addPattern(client, second);
    });
  });

  it("refuses a pattern of no length", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional Lengthless");
      expect(await errorCodeOf(addPattern(client, id, 0))).toBe(checkViolation);
    });
  });

  it("refuses a pattern in a unit other than weeks or months", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional Unknown Unit");
      expect(await errorCodeOf(addPattern(client, id, 2, "days"))).toBe(
        checkViolation,
      );
    });
  });

  it("refuses a release whose last cycle comes before its first", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional Backwards");
      expect(
        await errorCodeOf(addRelease(client, id, "Fictional", "2026-10-01")),
      ).toBe(checkViolation);
    });
  });

  it("refuses a stream without the date its cycles are made until", async () => {
    await withClient(database.app, async (client) => {
      expect(
        await errorCodeOf(
          client.query(
            "INSERT INTO release_streams (name) VALUES ('Fictional Endless')",
          ),
        ),
      ).toBe(notNullViolation);
    });
  });

  it("refuses a release that ships before its first cycle starts", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional Early");
      expect(
        await errorCodeOf(
          addRelease(client, id, "Fictional", "2027-04-01", "2026-12-31"),
        ),
      ).toBe(checkViolation);
    });
  });

  it("refuses deleting a stream that has a pattern", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional With Pattern");
      await addPattern(client, id);
      expect(
        await errorCodeOf(
          client.query("DELETE FROM release_streams WHERE id = $1", [id]),
        ),
      ).toBe(restrictViolation);
    });
  });

  it("refuses deleting a stream that has a release", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional With Release");
      await addRelease(client, id);
      expect(
        await errorCodeOf(
          client.query("DELETE FROM release_streams WHERE id = $1", [id]),
        ),
      ).toBe(restrictViolation);
    });
  });
});

describe("reporting lines and teams", () => {
  const uniqueViolation = "23505";
  const checkViolation = "23514";
  const restrictViolation = "23001";
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

describe("planned hires", () => {
  const uniqueViolation = "23505";
  const checkViolation = "23514";
  const restrictViolation = "23001";
  let added = 0;

  // Adds a fictional person, and gives their id.
  async function addPerson(client: Client) {
    added += 1;
    const row = await client.query<{ id: string }>(
      `INSERT INTO people (preferred_name, employee_id, position_id) VALUES ($1, $2, ${aPosition}) RETURNING id`,
      [`Fictional Hire Person ${String(added)}`, `PH-${String(added)}`],
    );
    return row.rows[0]?.id as string;
  }

  // Adds a fictional planned hire, open unless told otherwise, with a temporary number of its own
  // unless given a requisition, and gives its id.
  async function addHire(
    client: Client,
    hire: {
      requisition?: string | null;
      temporaryNumber?: number | null;
      stateId?: string;
      managerId?: string | null;
      filledBy?: string | null;
    } = {},
  ) {
    const row = await client.query<{ id: string }>(
      `INSERT INTO planned_hires (requisition, temporary_number, position_id, state_id, manager_id, filled_by)
       VALUES ($1, $2, ${aPosition}, coalesce($3, (SELECT i.id FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'hiring-states' AND i.meaning = 'open')), $4, $5) RETURNING id`,
      [
        hire.requisition ?? null,
        hire.requisition === undefined
          ? (hire.temporaryNumber ??
            Number(
              (
                await client.query<{ number: string }>(
                  "SELECT nextval('planned_hire_temporary_numbers') AS number",
                )
              ).rows[0]?.number,
            ))
          : (hire.temporaryNumber ?? null),
        hire.stateId ?? null,
        hire.managerId ?? null,
        hire.filledBy ?? null,
      ],
    );
    return row.rows[0]?.id as string;
  }

  it("starts with the built-in lists, Employee and Manager positions, hiring states each with a meaning, and keeps them from being retired", async () => {
    await withClient(database.app, async (client) => {
      const lists = await client.query(
        "SELECT name, built_in, visibility FROM lists WHERE built_in IS NOT NULL ORDER BY built_in",
      );
      expect(lists.rows).toEqual([
        {
          name: "Hiring states",
          built_in: "hiring-states",
          visibility: "general",
        },
        { name: "Positions", built_in: "positions", visibility: "general" },
      ]);
      const states = await client.query(
        "SELECT label, meaning FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'hiring-states' ORDER BY i.position",
      );
      expect(states.rows).toEqual([
        { label: "Request to hire", meaning: "proposed" },
        { label: "Approved to hire", meaning: "open" },
      ]);
      const positions = await client.query(
        "SELECT label, meaning FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'positions' ORDER BY i.position",
      );
      // Earlier tests add positions of their own.
      expect(
        positions.rows.filter(({ label }) =>
          ["Employee", "Manager"].includes(String(label)),
        ),
      ).toEqual([
        { label: "Employee", meaning: null },
        { label: "Manager", meaning: null },
      ]);
      for (const change of [
        "UPDATE lists SET retired = true WHERE built_in = 'hiring-states'",
        "UPDATE lists SET built_in = 'skills' WHERE built_in = 'positions'",
        "UPDATE list_items SET meaning = 'filled' WHERE label = 'Approved to hire'",
      ]) {
        expect(await errorCodeOf(client.query(change))).toBe(checkViolation);
      }
      expect(
        await errorCodeOf(
          client.query(
            "INSERT INTO lists (name, built_in) VALUES ('Fictional Positions', 'positions')",
          ),
        ),
      ).toBe(uniqueViolation);
    });
  });

  it("knows a hire by exactly one of a requisition and a temporary number, each used once", async () => {
    await withClient(database.app, async (client) => {
      await addHire(client, { requisition: "Fictional-REQ-1" });
      expect(
        await errorCodeOf(addHire(client, { requisition: "fictional-req-1" })),
      ).toBe(uniqueViolation);
      expect(
        await errorCodeOf(
          addHire(client, {
            requisition: "Fictional-REQ-2",
            temporaryNumber: 9001,
          }),
        ),
      ).toBe(checkViolation);
      expect(await errorCodeOf(addHire(client, { requisition: null }))).toBe(
        checkViolation,
      );
      expect(
        await errorCodeOf(addHire(client, { requisition: "TBD-12" })),
      ).toBe(checkViolation);
      await addHire(client, { temporaryNumber: 9002 });
      expect(
        await errorCodeOf(addHire(client, { temporaryNumber: 9002 })),
      ).toBe(uniqueViolation);
    });
  });

  it("lets one person fill several hires over time, and keeps a hire's choices from being deleted", async () => {
    await withClient(database.app, async (client) => {
      const person = await addPerson(client);
      await addHire(client, { filledBy: person });
      await addHire(client, { filledBy: person });
      for (const label of ["Approved to hire", "Fictional Position"]) {
        expect(
          await errorCodeOf(
            client.query("DELETE FROM list_items WHERE label = $1", [label]),
          ),
        ).toBe(restrictViolation);
      }
    });
  });

  it("refuses deleting a hire's manager or the person who filled it", async () => {
    await withClient(database.app, async (client) => {
      const manager = await addPerson(client);
      const person = await addPerson(client);
      await addHire(client, { managerId: manager });
      await addHire(client, { filledBy: person });
      for (const id of [manager, person]) {
        expect(
          await errorCodeOf(
            client.query("DELETE FROM people WHERE id = $1", [id]),
          ),
        ).toBe(restrictViolation);
      }
    });
  });

  it("keeps a hire's values in columns apart from people's, with exactly one owner, and deletes them with the hire", async () => {
    await withClient(database.app, async (client) => {
      const list = await client.query<{ id: string }>(
        "INSERT INTO lists (name) VALUES ('Fictional Hire Levels') RETURNING id",
      );
      const choice = await client.query<{ id: string }>(
        "INSERT INTO list_items (list_id, label) VALUES ($1, 'Fictional P3') RETURNING id",
        [list.rows[0]?.id],
      );
      const field = await client.query<{ id: string }>(
        "INSERT INTO fields (table_name, name, list_id, on_planned_hires) VALUES ('people', 'Fictional Hire Level', $1, true) RETURNING id",
        [list.rows[0]?.id],
      );
      const fieldId = field.rows[0]?.id;
      const choiceId = choice.rows[0]?.id;
      const person = await addPerson(client);
      const hire = await addHire(client);
      const value = (personId: string | null, hireId: string | null) =>
        client.query(
          "INSERT INTO field_values (field_id, person_id, planned_hire_id, choice_id) VALUES ($1, $2, $3, $4)",
          [fieldId, personId, hireId, choiceId],
        );
      expect(await errorCodeOf(value(person, hire))).toBe(checkViolation);
      expect(await errorCodeOf(value(null, null))).toBe(checkViolation);
      await value(null, hire);
      await value(person, null);
      expect(await errorCodeOf(value(null, hire))).toBe(uniqueViolation);
      const linkField = await client.query<{
        id: string;
        on_planned_hires: boolean;
      }>(
        "INSERT INTO fields (table_name, name, type, visibility) VALUES ('people', 'Fictional Hire Page', 'link', 'general') RETURNING id, on_planned_hires",
      );
      // Offered on planned hires only once chosen.
      expect(linkField.rows[0]?.on_planned_hires).toBe(false);
      const link = (address: string) =>
        client.query(
          "INSERT INTO field_values (field_id, planned_hire_id, link_address, link_text) VALUES ($1, $2, $3, '')",
          [linkField.rows[0]?.id, hire, address],
        );
      await link("https://wiki.example.test/hire");
      expect(await errorCodeOf(link("https://wiki.example.test/other"))).toBe(
        uniqueViolation,
      );
      await client.query("DELETE FROM planned_hires WHERE id = $1", [hire]);
      const left = await client.query(
        "SELECT person_id FROM field_values WHERE field_id = ANY($1)",
        [[fieldId, linkField.rows[0]?.id]],
      );
      expect(left.rows).toEqual([{ person_id: person }]);
    });
  });

  it("offers only People's columns on planned hires", async () => {
    await withClient(database.app, async (client) => {
      expect(
        await errorCodeOf(
          client.query(
            "INSERT INTO fields (table_name, name, type, visibility, on_planned_hires) VALUES ('projects', 'Fictional Project Page', 'link', 'general', true)",
          ),
        ),
      ).toBe(checkViolation);
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
      const changeSetId = await recordChanges(connection, null, [
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
      expect(fieldOfValue("value:f1")).toBe("f1");
      expect(inChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(inChunks([])).toEqual([]);
      expect(fieldOfValue("preferredName")).toBeNull();
    } finally {
      await pool.end();
    }
  });
});

describe("people and columns", () => {
  const uniqueViolation = "23505";
  const restrictViolation = "23001";
  const checkViolation = "23514";

  // A list with one choice, a column on people drawing on it, and a person with that choice.
  async function personWithChoice(client: Client, name: string) {
    const list = await client.query<{ id: string }>(
      "INSERT INTO lists (name) VALUES ($1) RETURNING id",
      [name],
    );
    const listId = list.rows[0]?.id;
    const choice = await client.query<{ id: string }>(
      "INSERT INTO list_items (list_id, label) VALUES ($1, 'Fictional Choice') RETURNING id",
      [listId],
    );
    const field = await client.query<{ id: string }>(
      "INSERT INTO fields (table_name, name, list_id) VALUES ('people', $1, $2) RETURNING id",
      [name, listId],
    );
    const person = await client.query<{ id: string }>(
      `INSERT INTO people (preferred_name, employee_id, position_id) VALUES ('Fictional Person', $1, ${aPosition}) RETURNING id`,
      [`id-${name}`],
    );
    const ids = {
      listId: listId ?? "",
      choiceId: choice.rows[0]?.id ?? "",
      fieldId: field.rows[0]?.id ?? "",
      personId: person.rows[0]?.id ?? "",
    };
    await client.query(
      "INSERT INTO field_values (field_id, person_id, choice_id) VALUES ($1, $2, $3)",
      [ids.fieldId, ids.personId, ids.choiceId],
    );
    return ids;
  }

  it("refuses an employee ID already used, ignoring letter case, and an end date before the start date", async () => {
    await withClient(database.app, async (client) => {
      await client.query(
        `INSERT INTO people (preferred_name, employee_id, position_id) VALUES ('Fictional One', 'E-100', ${aPosition})`,
      );
      expect(
        await errorCodeOf(
          client.query(
            `INSERT INTO people (preferred_name, employee_id, position_id) VALUES ('Fictional Two', 'e-100', ${aPosition})`,
          ),
        ),
      ).toBe(uniqueViolation);
      expect(
        await errorCodeOf(
          client.query(
            `INSERT INTO people (preferred_name, employee_id, position_id, start_date, end_date) VALUES ('Fictional Three', 'E-101', ${aPosition}, '2026-05-01', '2026-04-30')`,
          ),
        ),
      ).toBe(checkViolation);
    });
  });

  it("refuses deleting a choice a value uses, or a list a column uses", async () => {
    await withClient(database.app, async (client) => {
      const { listId, choiceId } = await personWithChoice(
        client,
        "Fictional Used",
      );
      expect(
        await errorCodeOf(
          client.query("DELETE FROM list_items WHERE id = $1", [choiceId]),
        ),
      ).toBe(restrictViolation);
      expect(
        await errorCodeOf(
          client.query("DELETE FROM lists WHERE id = $1", [listId]),
        ),
      ).toBe(restrictViolation);
    });
  });

  it("deletes values with their person or column, and refuses a value with no owner or the same choice twice", async () => {
    await withClient(database.app, async (client) => {
      const { fieldId, personId, choiceId } = await personWithChoice(
        client,
        "Fictional Owned",
      );
      expect(
        await errorCodeOf(
          client.query(
            "INSERT INTO field_values (field_id, person_id, choice_id) VALUES ($1, $2, $3)",
            [fieldId, personId, choiceId],
          ),
        ),
      ).toBe(uniqueViolation);
      expect(
        await errorCodeOf(
          client.query(
            "INSERT INTO field_values (field_id, choice_id) VALUES ($1, $2)",
            [fieldId, choiceId],
          ),
        ),
      ).toBe(checkViolation);
      await client.query("DELETE FROM people WHERE id = $1", [personId]);
      const byPerson = await client.query(
        "SELECT 1 FROM field_values WHERE field_id = $1",
        [fieldId],
      );
      expect(byPerson.rows).toHaveLength(0);
      const other = await personWithChoice(client, "Fictional Column");
      await client.query("DELETE FROM fields WHERE id = $1", [other.fieldId]);
      const byField = await client.query(
        "SELECT 1 FROM field_values WHERE person_id = $1",
        [other.personId],
      );
      expect(byField.rows).toHaveLength(0);
    });
  });
});

describe("application role", () => {
  it("can read, add, change, and remove data in Fathom's tables", async () => {
    await withClient(database.app, async (client) => {
      await client.query(
        "INSERT INTO app_info (key, value) VALUES ('example', 'fictional')",
      );
      await client.query(
        "UPDATE app_info SET value = 'changed' WHERE key = 'example'",
      );
      const changed = await client.query(
        "SELECT value FROM app_info WHERE key = 'example'",
      );
      expect(changed.rows).toEqual([{ value: "changed" }]);
      await client.query("DELETE FROM app_info WHERE key = 'example'");
    });
  });

  it("cannot create, change, empty, or drop tables", async () => {
    await withClient(database.app, async (client) => {
      expect(
        await errorCodeOf(client.query("CREATE TABLE fathom.example (id int)")),
      ).toBe(insufficientPrivilege);
      expect(
        await errorCodeOf(
          client.query("ALTER TABLE app_info ADD COLUMN example text"),
        ),
      ).toBe(insufficientPrivilege);
      expect(await errorCodeOf(client.query("TRUNCATE app_info"))).toBe(
        insufficientPrivilege,
      );
      expect(await errorCodeOf(client.query("DROP TABLE app_info"))).toBe(
        insufficientPrivilege,
      );
    });
  });

  it("cannot create schemas, temporary tables, or functions, or use the public schema", async () => {
    await withClient(database.app, async (client) => {
      expect(await errorCodeOf(client.query("CREATE SCHEMA example"))).toBe(
        insufficientPrivilege,
      );
      expect(
        await errorCodeOf(
          client.query("CREATE TEMPORARY TABLE example (id int)"),
        ),
      ).toBe(insufficientPrivilege);
      expect(
        await errorCodeOf(
          client.query(
            "CREATE FUNCTION fathom.example() RETURNS int LANGUAGE sql AS 'SELECT 1'",
          ),
        ),
      ).toBe(insufficientPrivilege);
      expect(
        await errorCodeOf(client.query("CREATE TABLE public.example (id int)")),
      ).toBe(insufficientPrivilege);
    });
  });

  it("cannot store data outside Fathom's schema in large objects", async () => {
    await withClient(database.app, async (client) => {
      expect(await errorCodeOf(client.query("SELECT lo_create(0)"))).toBe(
        insufficientPrivilege,
      );
    });
  });

  it("cannot read or change the record of applied migrations", async () => {
    await withClient(database.app, async (client) => {
      for (const statement of [
        "SELECT * FROM fathom_migrations.migrations",
        "INSERT INTO fathom_migrations.migrations (hash, created_at) VALUES ('example', 1)",
        "UPDATE fathom_migrations.migrations SET hash = 'example'",
        "DELETE FROM fathom_migrations.migrations",
        "SELECT nextval('fathom_migrations.migrations_id_seq')",
      ]) {
        expect(await errorCodeOf(client.query(statement)), statement).toBe(
          insufficientPrivilege,
        );
      }
    });
  });

  it("cannot create roles or act as a superuser", async () => {
    await withClient(database.app, async (client) => {
      expect(await errorCodeOf(client.query("CREATE ROLE example"))).toBe(
        insufficientPrivilege,
      );
      const role = await client.query(
        "SELECT rolsuper, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = current_user",
      );
      expect(role.rows[0]).toEqual({
        rolsuper: false,
        rolcreaterole: false,
        rolcreatedb: false,
      });
    });
  });

  it("cannot connect to other databases", async () => {
    for (const other of ["postgres", "template1"]) {
      expect(
        await connectionErrorCode(
          database.configFor("fathom_app", database.app.password, other),
        ),
        other,
      ).toBe(insufficientPrivilege);
    }
  });

  it("is refused with the wrong password", async () => {
    expect(
      await connectionErrorCode(
        database.configFor("fathom_app", "wrong-password"),
      ),
    ).toBe(invalidPassword);
  });
});

describe("migration role", () => {
  it("is not a superuser and cannot use the public schema", async () => {
    await withClient(database.migrator, async (client) => {
      const role = await client.query(
        "SELECT rolsuper, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = current_user",
      );
      expect(role.rows[0]).toEqual({
        rolsuper: false,
        rolcreaterole: false,
        rolcreatedb: false,
      });
      expect(
        await errorCodeOf(client.query("CREATE TABLE public.example (id int)")),
      ).toBe(insufficientPrivilege);
    });
  });

  it("cannot connect to other databases", async () => {
    for (const other of ["postgres", "template1"]) {
      expect(
        await connectionErrorCode(
          database.configFor(
            "fathom_migrator",
            database.migrator.password,
            other,
          ),
        ),
        other,
      ).toBe(insufficientPrivilege);
    }
  });
});

describe("database server", () => {
  it("sorts names with international rules, regardless of case and accents", async () => {
    const sorted = await withClient(database.app, (client) =>
      client.query<{ name: string }>(
        "SELECT name FROM (VALUES ('Zoe'), ('éva'), ('Bob'), ('Øyvind'), ('adam'), ('Ólafur'), ('Émile')) AS names(name) ORDER BY name",
      ),
    );
    expect(sorted.rows.map((row) => row.name)).toEqual([
      "adam",
      "Bob",
      "Émile",
      "éva",
      "Ólafur",
      "Øyvind",
      "Zoe",
    ]);
  });

  it("does not let everyone call functions the migration role creates", async () => {
    await withClient(database.migrator, async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(
          "CREATE FUNCTION fathom.example() RETURNS int LANGUAGE sql AS 'SELECT 1'",
        );
        const access = await client.query<{ allowed: boolean }>(
          "SELECT has_function_privilege('fathom_app', 'fathom.example()', 'EXECUTE') AS allowed",
        );
        expect(access.rows[0]?.allowed).toBe(false);
      } finally {
        await client.query("ROLLBACK");
      }
    });
  });

  it("refuses superuser replication connections over the network, even from inside the container", async () => {
    const result = await database.superuserCommand([
      "psql",
      "host=127.0.0.1 user=postgres dbname=replication replication=true",
      "--command",
      "IDENTIFY_SYSTEM",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain("rejects replication connection");
  });

  it("stores passwords with SCRAM-SHA-256", async () => {
    const methods = await database.superuserQuery(
      "SELECT rolname || ' ' || left(rolpassword, 14) FROM pg_authid WHERE rolname IN ('postgres', 'fathom_app', 'fathom_migrator') ORDER BY rolname",
    );
    expect(methods.split("\n")).toEqual([
      "fathom_app SCRAM-SHA-256$",
      "fathom_migrator SCRAM-SHA-256$",
      "postgres SCRAM-SHA-256$",
    ]);
  });

  it("requires a password even over the local socket", async () => {
    const result = await database.container.exec([
      "psql",
      "--username",
      "fathom_app",
      "--dbname",
      "fathom",
      "--no-password",
      "--command",
      "SELECT 1",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain("password");
  });

  it("refuses superuser logins over the network", async () => {
    expect(
      await connectionErrorCode(database.configFor("postgres", "any-password")),
    ).toBe(rejectedByAccessRules);
  });
});

describe("roles", () => {
  it("lets the application rename and describe roles, but never change a role's key", async () => {
    await withClient(database.app, async (client) => {
      expect(
        await errorCodeOf(
          client.query(
            "UPDATE roles SET key = 'fictional-key' WHERE key = 'viewer'",
          ),
        ),
      ).toBe(insufficientPrivilege);
      expect(
        await errorCodeOf(
          client.query(
            "INSERT INTO roles (key, name) VALUES ('administrator', 'Fictional Keyed Role')",
          ),
        ),
      ).toBe("23505");
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
});
