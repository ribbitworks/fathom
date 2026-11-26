// SPDX-License-Identifier: Apache-2.0

// Tests of Fathom's migrations against a real PostgreSQL server built from Fathom's own image: the
// schema they build, and applying them from code and from the command line.

import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import {
  migrateCommand,
  runMigrations,
  verifyAppliedMigrations,
} from "./migrate.ts";
import * as schema from "./schema.ts";
import { withClient } from "./test-clients.ts";

const migrateScript = fileURLToPath(new URL("./migrate.ts", import.meta.url));

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database.remove();
});

function migratorSettings(passwordFile: string): NodeJS.ProcessEnv {
  return {
    FATHOM_DB_HOST: database.migrator.host,
    FATHOM_DB_PORT: String(database.migrator.port),
    FATHOM_DB_NAME: database.migrator.database,
    FATHOM_DB_USER: database.migrator.user,
    FATHOM_DB_PASSWORD_FILE: passwordFile,
  };
}

async function withPasswordFile<T>(
  password: string,
  action: (passwordFile: string) => T | Promise<T>,
): Promise<T> {
  const folder = mkdtempSync(join(tmpdir(), "fathom-migrate-"));
  try {
    const passwordFile = join(folder, "password");
    writeFileSync(passwordFile, password);
    return await action(passwordFile);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

describe("schema", () => {
  // How PostgreSQL abbreviates what a foreign key does when the row it points to is deleted.
  const onDeleteNames = new Map([
    ["a", "no action"],
    ["c", "cascade"],
    ["r", "restrict"],
    ["n", "set null"],
  ]);
  // Every table the schema module defines, alongside the schema object itself.
  const tables = Object.values(schema as Record<string, unknown>).filter(
    (value) => is(value, PgTable),
  );

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
    });
  });

  it("refuse to be applied as the application role", async () => {
    const reported = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await withPasswordFile(database.app.password, async (passwordFile) => {
        expect(
          await migrateCommand({
            ...migratorSettings(passwordFile),
            FATHOM_DB_USER: database.app.user,
          }),
        ).toBe(1);
      });
      expect(reported).toHaveBeenCalledWith(
        expect.stringMatching(/permission denied for schema fathom_migrations/),
      );
    } finally {
      reported.mockRestore();
    }
  });

  it("are applied from the command line as the migration role", async () => {
    await withPasswordFile(database.migrator.password, (passwordFile) => {
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
