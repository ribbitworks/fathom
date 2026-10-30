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

beforeAll(async () => {
  database = await startTestDatabase();
  await runMigrations(database.migrator);
});

afterAll(async () => {
  await database.container.stop();
});

describe("schema", () => {
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
              `${row.name} ${row.on_delete === "c" ? "cascade" : row.on_delete}`,
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
