// SPDX-License-Identifier: Apache-2.0

// Tests upgrading a database that already holds data: choices made in the fixed lists before lists
// became user-defined move into lists of their own, keeping their labels and descriptions, in
// alphabetical order, the roles accounts held before roles became editable stay theirs, and everyone
// already named as a manager is flagged as a manager.

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
        ('fictional-2', 'administrator');
       INSERT INTO fathom.people (id, preferred_name, employee_id, start_date) VALUES
        ('00000000-0000-4000-8000-000000000001', 'Current Manager', 'F1', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000002', 'Former Manager', 'F2', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000003', 'Starter Manager', 'F3', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000004', 'Hiring Manager', 'F4', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000005', 'Cancelled Hire Manager', 'F5', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000006', 'Report', 'F6', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000007', 'Future Starter', 'F7', '2099-01-01'),
        ('00000000-0000-4000-8000-000000000008', 'Next Manager', 'F8', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000009', 'Mover', 'F9', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000010', 'Replaced Manager', 'F10', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000011', 'Today Manager', 'F11', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000012', 'Moved Today', 'F12', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000013', 'Proposed Hire Manager', 'F13', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000014', 'Approved Hire Manager', 'F14', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000015', 'Accepted Hire Manager', 'F15', '2019-01-01'),
        ('00000000-0000-4000-8000-000000000016', 'Filled Hire Manager', 'F16', '2019-01-01');
       INSERT INTO fathom.reporting_lines (person_id, manager_id, from_date) VALUES
        ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000002', '2020-01-01'),
        ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '2021-01-01'),
        ('00000000-0000-4000-8000-000000000001', NULL, '2019-01-01'),
        ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000003', '2099-01-01'),
        ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', '2020-01-01'),
        ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000008', '2099-01-01'),
        ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000010', '2020-01-01'),
        ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000011', (now() AT TIME ZONE 'UTC')::date);
       INSERT INTO fathom.planned_hires (title, target_date, state, cancelled_from, manager_id) VALUES
        ('Fictional Open Hire', '2099-01-01', 'recruiting', NULL, '00000000-0000-4000-8000-000000000004'),
        ('Fictional Cancelled Hire', '2099-01-01', 'cancelled', 'approved', '00000000-0000-4000-8000-000000000005'),
        ('Fictional Proposed Hire', '2099-01-01', 'proposed', NULL, '00000000-0000-4000-8000-000000000013'),
        ('Fictional Approved Hire', '2099-01-01', 'approved', NULL, '00000000-0000-4000-8000-000000000014'),
        ('Fictional Accepted Hire', '2099-01-01', 'offer-accepted', NULL, '00000000-0000-4000-8000-000000000015');
       INSERT INTO fathom.planned_hires (title, target_date, state, manager_id, filled_by) VALUES
        ('Fictional Filled Hire', '2020-01-01', 'filled', '00000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000006')`,
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

describe("upgrading to the manager flag", () => {
  it("flags everyone a reporting line in force or yet to start, or an open planned hire, names as manager", async () => {
    const pool = createPool(rolesDatabase.migrator);
    try {
      const rows = await pool.query<{ preferred_name: string }>(
        "SELECT preferred_name FROM fathom.people WHERE is_manager ORDER BY preferred_name",
      );
      expect(rows.rows.map((row) => row.preferred_name)).toEqual([
        "Accepted Hire Manager",
        "Approved Hire Manager",
        "Current Manager",
        "Hiring Manager",
        "Next Manager",
        "Proposed Hire Manager",
        "Starter Manager",
        "Today Manager",
      ]);
    } finally {
      await pool.end();
    }
  });
});
