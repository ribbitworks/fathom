// SPDX-License-Identifier: Apache-2.0

// Tests upgrading a database that already holds data: choices made in the fixed lists before lists
// became user-defined move into lists of their own, keeping their labels and descriptions, in
// alphabetical order, and the roles accounts held before roles became editable stay theirs.

import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, createPool } from "./client.ts";
import { migrationsFolder, runMigrations } from "./migrate.ts";

let database: TestDatabase;
let earlier: string;
let rolesDatabase: TestDatabase;
let beforeRoles: string;

// A copy of the migrations that stops before lists became user-defined.
function migrationsBefore(tag: string): string {
  const folder = mkdtempSync(join(tmpdir(), "fathom-migrations-"));
  cpSync(migrationsFolder, folder, { recursive: true });
  const journalFile = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalFile, "utf8")) as {
    entries: { tag: string }[];
  };
  const stop = journal.entries.findIndex((entry) => entry.tag === tag);
  journal.entries = journal.entries.slice(0, stop);
  writeFileSync(journalFile, JSON.stringify(journal));
  return folder;
}

beforeAll(async () => {
  database = await startTestDatabase();
  earlier = migrationsBefore("0007_user_defined_lists");
  const pool = createPool(database.migrator);
  try {
    await migrate(createDatabase(pool), {
      migrationsFolder: earlier,
      migrationsSchema: "fathom_migrations",
      migrationsTable: "migrations",
    });
    await pool.query(
      `INSERT INTO fathom.list_items (list, label, description) VALUES
        ('sites', 'Northmere', ''),
        ('sites', 'Kestrel Bay', 'Head office.'),
        ('levels', 'Fictional Level', '')`,
    );
  } finally {
    await pool.end();
  }
  await runMigrations(database.migrator);

  rolesDatabase = await startTestDatabase();
  beforeRoles = migrationsBefore("0020_editable_roles");
  const rolesPool = createPool(rolesDatabase.migrator);
  try {
    await migrate(createDatabase(rolesPool), {
      migrationsFolder: beforeRoles,
      migrationsSchema: "fathom_migrations",
      migrationsTable: "migrations",
    });
    await rolesPool.query(
      `INSERT INTO fathom.users (id, name, email) VALUES
        ('fictional-1', 'Fictional Planner', 'planner@example.com'),
        ('fictional-2', 'Fictional Admin', 'admin@example.com');
       INSERT INTO fathom.user_roles (user_id, role) VALUES
        ('fictional-1', 'viewer'),
        ('fictional-1', 'project-planner'),
        ('fictional-1', 'retired-role'),
        ('fictional-2', 'administrator')`,
    );
  } finally {
    await rolesPool.end();
  }
  await runMigrations(rolesDatabase.migrator);
}, 120_000);

afterAll(async () => {
  rmSync(earlier, { recursive: true, force: true });
  rmSync(beforeRoles, { recursive: true, force: true });
  await database.container.stop();
  await rolesDatabase.container.stop();
});

describe("upgrading to user-defined lists", () => {
  it("moves choices into lists named after their fixed lists, in alphabetical order", async () => {
    const pool = createPool(database.migrator);
    try {
      const rows = await pool.query<{
        name: string;
        label: string;
        description: string;
        position: number;
        retired: boolean;
      }>(
        `SELECT l.name, i.label, i.description, i.position, i.retired
         FROM fathom.list_items i JOIN fathom.lists l ON l.id = i.list_id
         ORDER BY l.name, i.position`,
      );
      expect(rows.rows).toEqual([
        {
          name: "Levels",
          label: "Fictional Level",
          description: "",
          position: 1,
          retired: false,
        },
        {
          name: "Sites",
          label: "Kestrel Bay",
          description: "Head office.",
          position: 1,
          retired: false,
        },
        {
          name: "Sites",
          label: "Northmere",
          description: "",
          position: 2,
          retired: false,
        },
      ]);
    } finally {
      await pool.end();
    }
  });
});

describe("upgrading to editable roles", () => {
  it("keeps every role an account held, and drops a role name the server no longer knew", async () => {
    const pool = createPool(rolesDatabase.migrator);
    try {
      const rows = await pool.query<{ user_id: string; key: string }>(
        `SELECT ur.user_id, r.key
         FROM fathom.user_roles ur JOIN fathom.roles r ON r.id = ur.role_id
         ORDER BY ur.user_id, r.key`,
      );
      expect(rows.rows).toEqual([
        { user_id: "fictional-1", key: "project-planner" },
        { user_id: "fictional-1", key: "viewer" },
        { user_id: "fictional-2", key: "administrator" },
      ]);
    } finally {
      await pool.end();
    }
  });
});
