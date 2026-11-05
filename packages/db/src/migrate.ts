// SPDX-License-Identifier: Apache-2.0

// Applies the reviewed SQL migrations, refusing to run when an applied migration was edited, removed,
// or skipped. Also runs as a command.

import { createHash } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createDatabase, createPool } from "./client.ts";
import { type DatabaseConfig, loadDatabaseConfig } from "./config.ts";
import { describeError } from "./errors.ts";

const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url),
);
const migrationsSchema = "fathom_migrations";
const migrationsTable = "migrations";

interface JournalEntry {
  when: number;
  tag: string;
}

interface MigrationFile {
  name: string;
  hash: string;
}

// Lists the migration files by creation time, with their names, such as 0001_add_greeting, and the
// hash Drizzle records when it applies them: the SHA-256 of the file's contents.
// Both reads are of the project's own migration folder, which is under source control.
function migrationFiles(): Map<string, MigrationFile> {
  const journal = JSON.parse(
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8"),
  ) as {
    entries: JournalEntry[];
  };
  return new Map(
    journal.entries.map((entry) => [
      String(entry.when),
      {
        name: entry.tag,
        hash: createHash("sha256")
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          .update(readFileSync(`${migrationsFolder}/${entry.tag}.sql`, "utf8"))
          .digest("hex"),
      },
    ]),
  );
}

// Drizzle does not notice when a migration file is edited after it was applied, so every applied
// migration is checked against its file. Applied migrations must never be edited.
export async function verifyAppliedMigrations(
  database: Pick<Pool, "query">,
): Promise<void> {
  const exists = await database.query<{ table: string | null }>(
    `SELECT to_regclass('${migrationsSchema}.${migrationsTable}')::text AS table`,
  );
  if (exists.rows[0]?.table === null) return;

  const files = migrationFiles();
  const applied = await database.query<{ hash: string; created_at: string }>(
    `SELECT hash, created_at::text FROM ${migrationsSchema}.${migrationsTable} ORDER BY created_at`,
  );
  for (const migration of applied.rows) {
    const file = files.get(migration.created_at);
    if (file === undefined) {
      throw new Error(
        `An applied migration from ${migration.created_at} has no migration file`,
      );
    }
    if (file.hash !== migration.hash) {
      throw new Error(
        `The migration ${file.name} was changed after it was applied; applied migrations must never be edited. In development, run 'pnpm db:reset'.`,
      );
    }
  }

  // Drizzle only applies migrations newer than the newest one applied, so a migration with an older
  // timestamp, for example one merged late from another branch, would otherwise be skipped silently.
  const appliedTimes = new Set(
    applied.rows.map((migration) => migration.created_at),
  );
  const newestApplied = Math.max(0, ...[...appliedTimes].map(Number));
  for (const [time, file] of files) {
    if (Number(time) < newestApplied && !appliedTimes.has(time)) {
      throw new Error(
        `The migration ${file.name} is older than the newest applied migration but was never applied; give it a newer timestamp. In development, run 'pnpm db:reset'.`,
      );
    }
  }
}

// Checks that every applied migration matches its file, applies the reviewed migration files as the
// migration role, then checks again.
export async function runMigrations(config: DatabaseConfig): Promise<void> {
  const pool = createPool(config);
  try {
    await verifyAppliedMigrations(pool);
    await migrate(createDatabase(pool), {
      migrationsFolder,
      migrationsSchema,
      migrationsTable,
    });
    await verifyAppliedMigrations(pool);
  } finally {
    await pool.end();
  }
}

// Runs migrations using settings from the environment, and returns the process exit code.
export async function migrateCommand(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  try {
    await runMigrations(loadDatabaseConfig(environment));
    console.log("==> Migrations applied");
    return 0;
  } catch (error) {
    console.error(`error: ${describeError(error)}`);
    return 1;
  }
}

/* v8 ignore start -- Only runs as a separate process; the command-line tests cover it. */
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await migrateCommand();
}
/* v8 ignore stop */
