// SPDX-License-Identifier: Apache-2.0

// Tests of the values table's ticked boxes, texts, dates and links to other tables' records, and
// each column type's settings, against a real PostgreSQL server.

import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { databaseCodes } from "./errors.ts";
import { linkableTables } from "./schema-columns.ts";
import { errorCodeOf, firstId, withClient } from "./test-clients.ts";

const { uniqueViolation, checkViolation, foreignKeyViolation } = databaseCodes;

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database.remove();
});

const anyOf = (builtIn: string) =>
  `(SELECT i.id FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = '${builtIn}' ORDER BY i.position LIMIT 1)`;

// A statement adding a fictional record to each table a value belongs to or links to, named apart
// by the word given.
const adding: Record<string, (word: string) => string> = {
  people: (word) =>
    `INSERT INTO people (preferred_name, employee_id, position_id) VALUES ('Fictional Person', 'E-${word}', ${anyOf("positions")}) RETURNING id`,
  planned_hires: (word) =>
    `INSERT INTO planned_hires (requisition, position_id, state_id) SELECT 'R-${word}', ${anyOf("positions")}, i.id FROM list_items i JOIN lists l ON l.id = i.list_id AND l.built_in = 'hiring-states' AND i.meaning = 'open' RETURNING id`,
  features: (word) =>
    `INSERT INTO features (name, status_id) VALUES ('Fictional Feature ${word}', ${anyOf("feature-statuses")}) RETURNING id`,
  projects: (word) =>
    `INSERT INTO projects (name) VALUES ('Fictional Project ${word}') RETURNING id`,
  proposals: (word) =>
    `INSERT INTO proposals (name, status_id) SELECT 'Fictional Bid ${word}', i.id FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'proposal-statuses' AND i.label = 'Open' RETURNING id`,
  customers: (word) =>
    `INSERT INTO customers (name) VALUES ('Fictional Customer ${word}') RETURNING id`,
  releases: (word) =>
    `WITH stream AS (INSERT INTO release_streams (name) VALUES ('Fictional Stream ${word}') RETURNING id) INSERT INTO releases (stream_id, name, first_cycle, last_cycle) SELECT id, 'Fictional Release ${word}', '2027-01-01', '2027-04-01' FROM stream RETURNING id`,
  feature_teams: (word) =>
    `INSERT INTO feature_teams (name) VALUES ('Fictional Team ${word}') RETURNING id`,
  activities: (word) =>
    `WITH project AS (INSERT INTO projects (name) VALUES ('Fictional Project for ${word}') RETURNING id) INSERT INTO activities (project_id, name, status_id) SELECT id, 'Fictional Activity ${word}', ${anyOf("feature-statuses")} FROM project RETURNING id`,
};

const addRecord = (client: Client, table: string, word: string) =>
  // Each table named is one of the fixed tables above.
  // eslint-disable-next-line security/detect-object-injection
  firstId(client, (adding[table] as (word: string) => string)(word), []);

// Each kind of record that holds values: its owner column, its table, and the table its columns are
// on.
const owners = [
  { owner: "person_id", table: "people", on: "people" },
  { owner: "planned_hire_id", table: "planned_hires", on: "people" },
  { owner: "feature_id", table: "features", on: "features" },
  { owner: "activity_id", table: "activities", on: "activities" },
] as const;

type Owner = (typeof owners)[number];

// Each column linking to another table's records, with that table.
const links = [
  { column: "linked_person_id", table: "people" },
  { column: "linked_planned_hire_id", table: "planned_hires" },
  { column: "linked_feature_id", table: "features" },
  { column: "linked_project_id", table: "projects" },
  { column: "linked_proposal_id", table: "proposals" },
  { column: "linked_customer_id", table: "customers" },
  { column: "linked_release_id", table: "releases" },
  { column: "linked_feature_team_id", table: "feature_teams" },
  { column: "linked_activity_id", table: "activities" },
] as const;

// A fictional column with the settings given on the owner's table, with a class of its own.
const addColumn = (
  client: Client,
  { on }: Owner,
  word: string,
  settings: Record<string, unknown>,
) => {
  const names = Object.keys(settings);
  return firstId(
    client,
    `INSERT INTO fields (table_name, name, visibility, on_planned_hires${names.map((name) => `, ${name}`).join("")}) VALUES ($1, $2, 'general', $3${names.map((_, index) => `, $${String(index + 4)}`).join("")}) RETURNING id`,
    [on, `Fictional ${word}`, on === "people", ...Object.values(settings)],
  );
};

// Adds an owner's value in a column, holding the values given by the names of their columns.
const insertValue = (
  client: Client,
  fieldId: string,
  { owner }: Owner,
  ownerId: string,
  values: Record<string, unknown>,
) => {
  const names = Object.keys(values);
  return client.query(
    `INSERT INTO field_values (field_id, ${owner}${names.map((name) => `, ${name}`).join("")}) VALUES ($1, $2${names.map((_, index) => `, $${String(index + 3)}`).join("")})`,
    [fieldId, ownerId, ...Object.values(values)],
  );
};

const deleteRecords = (client: Client, table: string, ids: string[]) =>
  client.query(`DELETE FROM ${table} WHERE id = ANY($1)`, [ids]);

describe("a column's settings", () => {
  const column = (client: Client, settings: Record<string, unknown>) =>
    addColumn(client, owners[0], JSON.stringify(settings), settings);

  it.each<[string, Record<string, unknown>]>([
    ["a checkbox", { type: "flag" }],
    ["a date", { type: "date" }],
    ["text on one line", { type: "text" }],
    ["text on several lines", { type: "text", multiline: true }],
    [
      "links to several features",
      { type: "record", linked_table: "features", multiple: true },
    ],
    ...linkableTables.map((table): [string, Record<string, unknown>] => [
      `a link to ${table}`,
      { type: "record", linked_table: table },
    ]),
  ])("take %s", async (_, settings) => {
    await withClient(database.app, async (client) => {
      expect(await errorCodeOf(column(client, settings))).toBeUndefined();
    });
  });

  it.each<[string, Record<string, unknown>]>([
    ["a checkbox with several values", { type: "flag", multiple: true }],
    ["text with several values", { type: "text", multiple: true }],
    ["several lines on another type", { type: "note", multiline: true }],
    [
      "several lines on a link",
      { type: "record", linked_table: "people", multiline: true },
    ],
    ["a link naming no table", { type: "record" }],
    ["a link to another table", { type: "record", linked_table: "teams" }],
    ["a table on another type", { type: "text", linked_table: "people" }],
  ])("refuse %s", async (_, settings) => {
    await withClient(database.app, async (client) => {
      expect(await errorCodeOf(column(client, settings))).toBe(checkViolation);
    });
  });

  it.each<[string, Record<string, unknown>]>([
    ["a checkbox", { type: "flag" }],
    ["text", { type: "text" }],
    ["a date", { type: "date" }],
    ["a link", { type: "record", linked_table: "people" }],
  ])("refuse %s with a list, or with no class", async (word, settings) => {
    await withClient(database.app, async (client) => {
      const list = await firstId(
        client,
        "SELECT id FROM lists WHERE built_in = 'positions'",
        [],
      );
      expect(
        await errorCodeOf(column(client, { ...settings, list_id: list })),
      ).toBe(checkViolation);
      const names = Object.keys(settings);
      expect(
        await errorCodeOf(
          client.query(
            `INSERT INTO fields (table_name, name${names.map((name) => `, ${name}`).join("")}) VALUES ('people', $1${names.map((_, index) => `, $${String(index + 2)}`).join("")})`,
            [`Fictional unclassed ${word}`, ...Object.values(settings)],
          ),
        ),
      ).toBe(checkViolation);
    });
  });
});

describe("the values table's kinds of value", () => {
  it.each(owners)(
    "holds a ticked box, a text and a date once for each $table record and column, and the same value for another",
    async (owner) => {
      await withClient(database.app, async (client) => {
        for (const [type, one, other] of [
          ["flag", { flag: true }, { flag: true }],
          ["text", { text: "North 4-12" }, { text: "South 2-07" }],
          ["date", { date: "2026-03-14" }, { date: "2026-06-02" }],
        ] as const) {
          const word = `${owner.table} ${type}`;
          const fieldId = await addColumn(client, owner, word, { type });
          const ownerId = await addRecord(client, owner.table, word);
          const otherId = await addRecord(client, owner.table, `${word} 2`);
          await insertValue(client, fieldId, owner, ownerId, one);
          expect(
            await errorCodeOf(
              insertValue(client, fieldId, owner, ownerId, other),
            ),
          ).toBe(uniqueViolation);
          expect(
            await errorCodeOf(
              insertValue(client, fieldId, owner, otherId, one),
            ),
          ).toBeUndefined();
        }
      });
    },
  );

  it("holds a box only while ticked, and no empty text", async () => {
    await withClient(database.app, async (client) => {
      const fieldId = await addColumn(client, owners[0], "Unticked", {
        type: "flag",
      });
      const personId = await addRecord(client, "people", "Unticked");
      expect(
        await errorCodeOf(
          insertValue(client, fieldId, owners[0], personId, { flag: false }),
        ),
      ).toBe(checkViolation);
      expect(
        await errorCodeOf(
          insertValue(client, fieldId, owners[0], personId, { text: "" }),
        ),
      ).toBe(checkViolation);
    });
  });

  it("holds exactly one kind of value in a row", async () => {
    await withClient(database.app, async (client) => {
      const fieldId = await addColumn(client, owners[0], "Both", {
        type: "flag",
      });
      const personId = await addRecord(client, "people", "Both");
      const featureId = await addRecord(client, "features", "Both");
      for (const values of [
        { flag: true, date: "2026-03-14" },
        { text: "North 4-12", linked_feature_id: featureId },
        { linked_person_id: personId, linked_feature_id: featureId },
        {},
      ]) {
        expect(
          await errorCodeOf(
            insertValue(client, fieldId, owners[0], personId, values),
          ),
        ).toBe(checkViolation);
      }
    });
  });
});

describe("links to other tables' records", () => {
  it.each(links)(
    "link $table from each owner, each once, and keep it from being deleted",
    async ({ column, table }) => {
      await withClient(database.app, async (client) => {
        const linkedId = await addRecord(client, table, `Linked ${column}`);
        for (const owner of owners) {
          const word = `${column} from ${owner.table}`;
          const fieldId = await addColumn(client, owner, word, {
            type: "record",
            linked_table: table === "planned_hires" ? "people" : table,
            multiple: true,
          });
          const ownerId = await addRecord(client, owner.table, word);
          const otherId = await addRecord(client, owner.table, `${word} 2`);
          const linking = { [column]: linkedId };
          await insertValue(client, fieldId, owner, ownerId, linking);
          expect(
            await errorCodeOf(
              insertValue(client, fieldId, owner, ownerId, linking),
            ),
          ).toBe(uniqueViolation);
          expect(
            await errorCodeOf(
              insertValue(client, fieldId, owner, otherId, linking),
            ),
          ).toBeUndefined();
        }
        expect(
          await errorCodeOf(deleteRecords(client, table, [linkedId])),
        ).toBe(foreignKeyViolation);
      });
    },
  );

  it.each([
    { owner: owners[0], column: "linked_person_id" },
    { owner: owners[1], column: "linked_planned_hire_id" },
    { owner: owners[2], column: "linked_feature_id" },
    { owner: owners[3], column: "linked_activity_id" },
  ])(
    "let a $owner.table record that links itself be deleted",
    async ({ owner, column }) => {
      await withClient(database.app, async (client) => {
        const word = `Self ${owner.table}`;
        const fieldId = await addColumn(client, owner, word, {
          type: "record",
          linked_table: owner.on,
        });
        const id = await addRecord(client, owner.table, word);
        await insertValue(client, fieldId, owner, id, { [column]: id });
        expect(
          await errorCodeOf(deleteRecords(client, owner.table, [id])),
        ).toBeUndefined();
      });
    },
  );

  it("let records that link each other be deleted together", async () => {
    await withClient(database.app, async (client) => {
      const hire = owners[1];
      const fieldId = await addColumn(client, hire, "Pair", {
        type: "record",
        linked_table: "people",
      });
      const one = await addRecord(client, "planned_hires", "Pair One");
      const other = await addRecord(client, "planned_hires", "Pair Two");
      await insertValue(client, fieldId, hire, one, {
        linked_planned_hire_id: other,
      });
      await insertValue(client, fieldId, hire, other, {
        linked_planned_hire_id: one,
      });
      expect(
        await errorCodeOf(deleteRecords(client, "planned_hires", [one])),
      ).toBe(foreignKeyViolation);
      expect(
        await errorCodeOf(deleteRecords(client, "planned_hires", [one, other])),
      ).toBeUndefined();
    });
  });

  it("free a linked record once its column is deleted", async () => {
    await withClient(database.app, async (client) => {
      const fieldId = await addColumn(client, owners[0], "Freed", {
        type: "record",
        linked_table: "customers",
      });
      const personId = await addRecord(client, "people", "Freed");
      const customerId = await addRecord(client, "customers", "Freed");
      await insertValue(client, fieldId, owners[0], personId, {
        linked_customer_id: customerId,
      });
      await client.query("DELETE FROM fields WHERE id = $1", [fieldId]);
      expect(
        await errorCodeOf(deleteRecords(client, "customers", [customerId])),
      ).toBeUndefined();
    });
  });

  // The migration makes these keys deferred by hand, since drizzle can't, so a migration drizzle
  // makes later could drop it unseen; this fails if it does.
  it("are each checked when the change is saved, and link only to linkable tables", async () => {
    await withClient(database.migrator, async (client) => {
      const keys = await client.query<{
        column: string;
        table: string;
        deferrable: boolean;
        deferred: boolean;
      }>(
        `SELECT a.attname AS column, t.relname AS table, c.condeferrable AS deferrable, c.condeferred AS deferred
         FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
         JOIN pg_class t ON t.oid = c.confrelid
         WHERE c.contype = 'f' AND c.conrelid = 'fathom.field_values'::regclass AND a.attname LIKE 'linked\\_%'`,
      );
      expect(
        keys.rows.filter(
          ({ deferrable, deferred }) => !deferrable || !deferred,
        ),
      ).toEqual([]);
      expect(
        keys.rows
          .map(({ column, table }) => ({ column, table }))
          .sort((one, other) => one.column.localeCompare(other.column)),
      ).toEqual(
        links
          .map(({ column, table }) => ({ column, table }))
          .sort((one, other) => one.column.localeCompare(other.column)),
      );
      expect(
        [...new Set(links.map(({ table }) => table))].filter(
          (table) => table !== "planned_hires",
        ),
      ).toEqual([...linkableTables]);
    });
  });
});
