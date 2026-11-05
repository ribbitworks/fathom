// SPDX-License-Identifier: Apache-2.0

// Tests upgrading a database that already holds data: choices made in the fixed lists before lists
// became user-defined move into lists of their own, keeping their labels and descriptions, in
// alphabetical order, the roles accounts held before roles became editable stay theirs, everyone
// already named as a manager is flagged as a manager, and the Position column and planned hires'
// states carry over to the built-in Positions and hiring states lists.

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
let hiringDatabase: TestDatabase;
let beforeHiring: string;
let namedDatabase: TestDatabase;

// The migration that builds in Positions and the hiring states.
const hiringRows = "0022_hiring_rows";

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

  hiringDatabase = await startTestDatabase();
  beforeHiring = migrationsBefore(hiringRows);
  const hiringPool = createPool(hiringDatabase.migrator);
  try {
    await migrate(createDatabase(hiringPool), {
      migrationsFolder: beforeHiring,
      migrationsSchema: "fathom_migrations",
      migrationsTable: "migrations",
    });
    await hiringPool.query(
      `INSERT INTO fathom.lists (id, name, visibility) VALUES
        ('00000000-0000-4000-8000-0000000000a1', 'Job titles', 'restricted'),
        ('00000000-0000-4000-8000-0000000000a2', 'Levels', 'general');
       INSERT INTO fathom.list_items (id, list_id, label, position) VALUES
        ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'Fictional Engineer', 1),
        ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', 'Fictional Lead', 2),
        ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a2', 'Fictional P2', 1);
       INSERT INTO fathom.fields (id, table_name, name, list_id, multiple, on_planned_hires) VALUES
        ('00000000-0000-4000-8000-0000000000c1', 'people', 'Position', '00000000-0000-4000-8000-0000000000a1', true, true),
        ('00000000-0000-4000-8000-0000000000c2', 'people', 'Level', '00000000-0000-4000-8000-0000000000a2', false, true),
        ('00000000-0000-4000-8000-0000000000c3', 'people', 'Previous job title', '00000000-0000-4000-8000-0000000000a1', false, false);
       INSERT INTO fathom.users (id, name, email) VALUES
        ('fictional-hiring', 'Fictional Editor', 'hiring-editor@example.com');
       INSERT INTO fathom.saved_views (table_name, name, definition, created_by) VALUES
        ('people', 'Fictional by position', '{"sort": ["-00000000-0000-4000-8000-0000000000c1"], "filters": {"00000000-0000-4000-8000-0000000000c1": {"in": ["00000000-0000-4000-8000-0000000000b1"]}}, "breakdown": ["00000000-0000-4000-8000-0000000000c1", "00000000-0000-4000-8000-0000000000c3"]}', 'fictional-hiring');
       INSERT INTO fathom.column_orders (table_name, keys) VALUES
        ('people', '["preferredName", "employeeId", "00000000-0000-4000-8000-0000000000c1", "00000000-0000-4000-8000-0000000000c2", "startDate"]');
       INSERT INTO fathom.people (id, preferred_name, employee_id) VALUES
        ('00000000-0000-4000-8000-0000000000d1', 'Fictional Positioned', 'H1'),
        ('00000000-0000-4000-8000-0000000000d2', 'Fictional Unpositioned', 'H2'),
        ('00000000-0000-4000-8000-0000000000d3', 'Fictional Lookalike', 'tbd-9');
       INSERT INTO fathom.planned_hires (id, title, target_date, state, cancelled_from, filled_by) VALUES
        ('00000000-0000-4000-8000-0000000000e1', 'Fictional Proposed', '2099-01-01', 'proposed', NULL, NULL),
        ('00000000-0000-4000-8000-0000000000e2', 'Fictional Recruiting', '2099-01-01', 'recruiting', NULL, NULL),
        ('00000000-0000-4000-8000-0000000000e3', 'Fictional Cancelled', '2099-01-01', 'cancelled', 'approved', NULL),
        ('00000000-0000-4000-8000-0000000000e4', 'Fictional Filled', '2020-01-01', 'filled', NULL, '00000000-0000-4000-8000-0000000000d1');
       INSERT INTO fathom.field_values (field_id, person_id, planned_hire_id, choice_id) VALUES
        ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000d1', NULL, '00000000-0000-4000-8000-0000000000b2'),
        ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000d1', NULL, '00000000-0000-4000-8000-0000000000b1'),
        ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000d1', NULL, '00000000-0000-4000-8000-0000000000b3'),
        ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000d2', NULL, '00000000-0000-4000-8000-0000000000b2'),
        ('00000000-0000-4000-8000-0000000000c1', NULL, '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000b2');
       INSERT INTO fathom.drafts (record_type, record_id, action, fields) VALUES
        ('person', '00000000-0000-4000-8000-0000000000f1', 'created', '{"preferredName": "Fictional Newcomer", "employeeId": "H3", "value:00000000-0000-4000-8000-0000000000c1": ["00000000-0000-4000-8000-0000000000b1"], "value:00000000-0000-4000-8000-0000000000c2": ["00000000-0000-4000-8000-0000000000b3"]}'),
        ('person', '00000000-0000-4000-8000-0000000000f2', 'created', '{"preferredName": "Fictional Other Newcomer", "employeeId": "H4"}'),
        ('field', '00000000-0000-4000-8000-0000000000c1', 'changed', '{"name": "Role"}'),
        ('column-order', 'people', 'changed', '{"keys": ["00000000-0000-4000-8000-0000000000c1", "preferredName"]}'),
        ('planned-hire', '00000000-0000-4000-8000-0000000000e2', 'changed', '{"title": "Fictional Renamed"}'),
        ('list', '00000000-0000-4000-8000-0000000000a1', 'changed', '{"description": "Fictional jobs.", "retired": true}'),
        ('list', '00000000-0000-4000-8000-0000000000a2', 'deleted', '{}');
       INSERT INTO fathom.unpublished_drafts (record_type, record_id, user_id, action, fields) VALUES
        ('person', '00000000-0000-4000-8000-0000000000d2', 'fictional-hiring', 'changed', '{"value:00000000-0000-4000-8000-0000000000c1": ["00000000-0000-4000-8000-0000000000b2", "00000000-0000-4000-8000-0000000000b1"]}');`,
    );
  } finally {
    await hiringPool.end();
  }
  await runMigrations(hiringDatabase.migrator);

  // A Positions list no column draws on, which becomes the built-in one by its name.
  namedDatabase = await startTestDatabase();
  const namedPool = createPool(namedDatabase.migrator);
  try {
    await migrate(createDatabase(namedPool), {
      migrationsFolder: beforeHiring,
      migrationsSchema: "fathom_migrations",
      migrationsTable: "migrations",
    });
    await namedPool.query(
      `INSERT INTO fathom.lists (id, name, visibility, retired) VALUES
        ('00000000-0000-4000-8000-0000000000a9', 'positions', 'confidential', true),
        ('00000000-0000-4000-8000-0000000000aa', 'Hiring States', 'general', false)`,
    );
  } finally {
    await namedPool.end();
  }
  await runMigrations(namedDatabase.migrator);
}, 240_000);

afterAll(async () => {
  rmSync(earlier, { recursive: true, force: true });
  rmSync(beforeRoles, { recursive: true, force: true });
  rmSync(beforeHiring, { recursive: true, force: true });
  await database.container.stop();
  await rolesDatabase.container.stop();
  await hiringDatabase.container.stop();
  await namedDatabase.container.stop();
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
         WHERE l.built_in IS NULL
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

describe("upgrading to planned hires as rows of People", () => {
  const query = async <T extends object>(text: string) => {
    const pool = createPool(hiringDatabase.migrator);
    try {
      return (await pool.query<T>(text)).rows;
    } finally {
      await pool.end();
    }
  };
  const engineer = "00000000-0000-4000-8000-0000000000b1";
  const lead = "00000000-0000-4000-8000-0000000000b2";
  const notSet = async () =>
    (
      await query<{ id: string }>(
        "SELECT id FROM fathom.list_items WHERE label = 'Position not set'",
      )
    )[0]?.id;

  it("makes the list the Position column draws on the built-in Positions, always General, and removes the column", async () => {
    expect(
      await query(
        "SELECT id, name, built_in, visibility FROM fathom.lists WHERE built_in IS NOT NULL ORDER BY built_in",
      ),
    ).toEqual([
      {
        id: expect.any(String) as string,
        name: "Hiring states",
        built_in: "hiring-states",
        visibility: "confidential",
      },
      {
        id: "00000000-0000-4000-8000-0000000000a1",
        name: "Job titles",
        built_in: "positions",
        visibility: "general",
      },
    ]);
    // Another column drawing on the list keeps its values.
    expect(await query("SELECT name FROM fathom.fields ORDER BY name")).toEqual(
      [{ name: "Level" }, { name: "Previous job title" }],
    );
    expect(
      await query(
        "SELECT choice_id FROM fathom.field_values WHERE field_id = '00000000-0000-4000-8000-0000000000c3'",
      ),
    ).toEqual([{ choice_id: lead }]);
    expect(
      await query("SELECT definition FROM fathom.saved_views ORDER BY name"),
    ).toEqual([
      {
        definition: {
          sort: ["-positionId"],
          filters: { positionId: { in: [engineer] } },
          breakdown: ["positionId", "00000000-0000-4000-8000-0000000000c3"],
        },
      },
    ]);
    expect(
      await query(
        "SELECT keys FROM fathom.column_orders WHERE table_name = 'people'",
      ),
    ).toEqual([
      {
        keys: [
          "preferredName",
          "employeeId",
          "positionId",
          "00000000-0000-4000-8000-0000000000c2",
          "startDate",
        ],
      },
    ]);
  });

  it("gives people the first position they had, in list order, Position not set to anyone without one, and Employee IDs that cannot pass for temporary IDs", async () => {
    expect(
      await query(
        "SELECT preferred_name, employee_id, position_id FROM fathom.people ORDER BY preferred_name",
      ),
    ).toEqual([
      {
        preferred_name: "Fictional Lookalike",
        employee_id: "ID-tbd-9",
        position_id: await notSet(),
      },
      {
        preferred_name: "Fictional Positioned",
        employee_id: "H1",
        position_id: engineer,
      },
      {
        preferred_name: "Fictional Unpositioned",
        employee_id: "H2",
        position_id: await notSet(),
      },
    ]);
  });

  it("keeps open hires in the state each maps to, with temporary numbers and positions, and removes cancelled and filled ones", async () => {
    expect(
      await query(
        `SELECT h.id, h.position_id, i.label AS state, h.requisition, h.temporary_number IS NOT NULL AS numbered
         FROM fathom.planned_hires h JOIN fathom.list_items i ON i.id = h.state_id ORDER BY h.id`,
      ),
    ).toEqual([
      {
        id: "00000000-0000-4000-8000-0000000000e1",
        position_id: lead,
        state: "Proposed",
        requisition: null,
        numbered: true,
      },
      {
        id: "00000000-0000-4000-8000-0000000000e2",
        position_id: await notSet(),
        state: "Open",
        requisition: null,
        numbered: true,
      },
    ]);
  });

  it("carries drafts over: positions from the column, the column's own drafts, hires' drafts, and what a built-in list cannot do removed", async () => {
    expect(
      await query(
        "SELECT record_type, record_id, action, fields FROM fathom.drafts ORDER BY record_type, record_id",
      ),
    ).toEqual([
      {
        record_type: "column-order",
        action: "changed",
        record_id: "people",
        fields: { keys: ["positionId", "preferredName"] },
      },
      {
        record_type: "list",
        record_id: "00000000-0000-4000-8000-0000000000a1",
        action: "changed",
        fields: { description: "Fictional jobs." },
      },
      {
        record_type: "list",
        record_id: "00000000-0000-4000-8000-0000000000a2",
        action: "deleted",
        fields: {},
      },
      {
        record_type: "person",
        record_id: "00000000-0000-4000-8000-0000000000f1",
        action: "created",
        fields: {
          preferredName: "Fictional Newcomer",
          employeeId: "H3",
          positionId: engineer,
          "value:00000000-0000-4000-8000-0000000000c2": [
            "00000000-0000-4000-8000-0000000000b3",
          ],
        },
      },
      {
        record_type: "person",
        record_id: "00000000-0000-4000-8000-0000000000f2",
        action: "created",
        fields: {
          preferredName: "Fictional Other Newcomer",
          employeeId: "H4",
          positionId: await notSet(),
        },
      },
    ]);
  });

  it("gives an unpublished change to the Position column the first position in list order", async () => {
    expect(
      await query(
        "SELECT record_id, fields FROM fathom.unpublished_drafts ORDER BY record_id",
      ),
    ).toEqual([
      {
        record_id: "00000000-0000-4000-8000-0000000000d2",
        fields: { positionId: engineer },
      },
    ]);
  });
});

describe("upgrading to built-in lists where no column is named Position", () => {
  it("builds in the list named Positions, General and offered, and names the hiring states apart from a list already called that", async () => {
    const pool = createPool(namedDatabase.migrator);
    try {
      const rows = await pool.query(
        "SELECT id, name, visibility, retired, built_in FROM fathom.lists ORDER BY name",
      );
      expect(rows.rows).toEqual([
        {
          id: "00000000-0000-4000-8000-0000000000aa",
          name: "Hiring States",
          visibility: "general",
          retired: false,
          built_in: null,
        },
        {
          id: expect.any(String) as string,
          name: "Hiring states (built in)",
          visibility: "confidential",
          retired: false,
          built_in: "hiring-states",
        },
        {
          id: "00000000-0000-4000-8000-0000000000a9",
          name: "positions",
          visibility: "general",
          retired: false,
          built_in: "positions",
        },
      ]);
    } finally {
      await pool.end();
    }
  });
});
