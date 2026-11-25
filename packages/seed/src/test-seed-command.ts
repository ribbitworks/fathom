// SPDX-License-Identifier: Apache-2.0

// Helpers for the seeding tests, used only by them: the seed command's settings against a test
// database, with fictional secrets and a clean start; a test database of a test's own; and the
// organization they seed, with a table's row count.

import {
  createDatabase,
  createPool,
  type Database,
  type fields,
  type lists,
  type people,
  type Reader,
  type reportingLines,
  type teams,
} from "@fathom/db";
import { fictionalOrganization } from "@fathom/fixtures";
import { count } from "drizzle-orm";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, vi } from "vitest";
import { seedCommand } from "./seed.ts";

// A session secret and an account password used only by tests.
const sessionSecret = "fictional-session-secret-for-tests-only-0123456789";
const accountPassword = "fictional-seed-password";

export interface TestSeedCommand {
  // A folder of the tests' own, for files a test adds.
  folder: string;
  environment(): Record<string, string>;
  // Removes the seed data, saying nothing; the personas' accounts are added first, since removing
  // the data needs them, and are left deactivated.
  startClean(): Promise<void>;
  remove(): void;
}

export function testSeedCommand(database: TestDatabase): TestSeedCommand {
  const folder = mkdtempSync(join(tmpdir(), "fathom-seed-"));
  writeFileSync(join(folder, "password"), database.app.password);
  writeFileSync(join(folder, "secret"), sessionSecret);
  writeFileSync(join(folder, "accounts"), `${accountPassword}\n`);
  const environment = () => ({
    FATHOM_PUBLIC_URL: "https://fathom.example.test",
    FATHOM_AUTH_SECRET_FILE: join(folder, "secret"),
    FATHOM_SEED_PASSWORD_FILE: join(folder, "accounts"),
    FATHOM_DB_HOST: database.app.host,
    FATHOM_DB_PORT: String(database.app.port),
    FATHOM_DB_NAME: database.app.database,
    FATHOM_DB_USER: database.app.user,
    FATHOM_DB_PASSWORD_FILE: join(folder, "password"),
  });
  return {
    folder,
    environment,
    async startClean() {
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      try {
        expect(await seedCommand(["accounts"], environment())).toBe(0);
        expect(await seedCommand(["unseed"], environment())).toBe(0);
      } finally {
        log.mockRestore();
      }
    },
    remove() {
      rmSync(folder, { recursive: true, force: true });
    },
  };
}

export interface SeedTestDatabase {
  connection: Database;
  command: TestSeedCommand;
  remove(): Promise<void>;
}

export async function startSeedTestDatabase(): Promise<SeedTestDatabase> {
  const database = await startTestDatabase();
  const pool = createPool(database.app, () => undefined);
  const command = testSeedCommand(database);
  return {
    connection: createDatabase(pool),
    command,
    // Dropped first, which ends every connection to it, so work still going on from a test that ran
    // out of time stops there rather than holding the pool open.
    async remove() {
      await database.remove();
      await pool.end();
      command.remove();
    },
  };
}

// The fictional organization the seeding tests seed.
export const organization = fictionalOrganization({ size: 20 });

// How many rows a table holds.
export async function totalOf(
  reader: Reader,
  table:
    | typeof people
    | typeof lists
    | typeof fields
    | typeof reportingLines
    | typeof teams,
) {
  const [row] = await reader.select({ total: count() }).from(table);
  return row?.total;
}
