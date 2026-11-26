// SPDX-License-Identifier: Apache-2.0

// Tests of people, planned hires, the built-in lists and the values in their columns against a real
// PostgreSQL server.

import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { databaseCodes } from "./errors.ts";
import {
  addPosition,
  aPosition,
  errorCodeOf,
  withClient,
} from "./test-clients.ts";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
  await withClient(database.app, addPosition);
});

afterAll(async () => {
  await database.remove();
});

describe("planned hires", () => {
  const { uniqueViolation, checkViolation, restrictViolation } = databaseCodes;
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

  it("starts with the built-in lists, Employee and Manager positions, hiring states each with a meaning, and proposal statuses, and keeps them from being retired", async () => {
    await withClient(database.app, async (client) => {
      const lists = await client.query(
        "SELECT name, built_in, visibility FROM lists WHERE built_in IS NOT NULL ORDER BY built_in",
      );
      expect(lists.rows).toEqual([
        {
          name: "Feature priorities",
          built_in: "feature-priorities",
          visibility: "general",
        },
        {
          name: "Feature risks",
          built_in: "feature-risks",
          visibility: "general",
        },
        {
          name: "Feature sizes",
          built_in: "feature-sizes",
          visibility: "general",
        },
        {
          name: "Feature statuses",
          built_in: "feature-statuses",
          visibility: "general",
        },
        {
          name: "Hiring states",
          built_in: "hiring-states",
          visibility: "general",
        },
        { name: "Positions", built_in: "positions", visibility: "general" },
        {
          name: "Proposal statuses",
          built_in: "proposal-statuses",
          visibility: "general",
        },
      ]);
      const statuses = await client.query(
        "SELECT label FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'proposal-statuses' ORDER BY i.position",
      );
      expect(statuses.rows.map(({ label }) => String(label))).toEqual([
        "Open",
        "Won",
        "Lost",
        "Withdrawn",
      ]);
      const states = await client.query(
        "SELECT label, meaning FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'hiring-states' ORDER BY i.position",
      );
      expect(states.rows).toEqual([
        { label: "Request to hire", meaning: "proposed" },
        { label: "Approved to hire", meaning: "open" },
        { label: "Hired", meaning: "hired" },
        { label: "Left", meaning: "left" },
      ]);
      const positions = await client.query(
        "SELECT label, meaning FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'positions' ORDER BY i.position",
      );
      // This file's set-up adds a position of its own.
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

  it("starts features' priorities, sizes and risks with their choices, each size with a weight", async () => {
    await withClient(database.app, async (client) => {
      const choicesOf = async (list: string) =>
        (
          await client.query(
            "SELECT label, weight FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = $1 ORDER BY i.position",
            [list],
          )
        ).rows.map(({ label, weight }) => ({
          label: String(label),
          weight: weight === null ? null : Number(weight),
        }));
      expect(await choicesOf("feature-priorities")).toEqual(
        ["Critical", "High", "Medium", "Low"].map((label) => ({
          label,
          weight: null,
        })),
      );
      expect(await choicesOf("feature-sizes")).toEqual([
        { label: "XS", weight: 0.5 },
        { label: "S", weight: 1 },
        { label: "M", weight: 2 },
        { label: "L", weight: 3 },
        { label: "XL", weight: 4 },
      ]);
      expect(await choicesOf("feature-risks")).toEqual(
        ["Low", "Medium", "High"].map((label) => ({ label, weight: null })),
      );
    });
  });

  it("keeps every choice's weight above zero", async () => {
    await withClient(database.app, async (client) => {
      for (const weight of ["0", "-1", "'NaN'"]) {
        expect(
          await errorCodeOf(
            client.query(
              `UPDATE list_items SET weight = ${weight} WHERE label = 'XS'`,
            ),
          ),
        ).toBe(checkViolation);
      }
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
      const noteField = await client.query<{ id: string }>(
        "INSERT INTO fields (table_name, name, type, visibility) VALUES ('people', 'Fictional Hire Notes', 'note', 'general') RETURNING id",
      );
      const note = (value: string) =>
        client.query(
          "INSERT INTO field_values (field_id, planned_hire_id, note) VALUES ($1, $2, $3)",
          [noteField.rows[0]?.id, hire, value],
        );
      await note("Hiring soon");
      expect(await errorCodeOf(note("Later"))).toBe(uniqueViolation);
      const numberField = await client.query<{ id: string }>(
        "INSERT INTO fields (table_name, name, type, visibility) VALUES ('people', 'Fictional Hire Score', 'number', 'general') RETURNING id",
      );
      const number = (value: number) =>
        client.query(
          "INSERT INTO field_values (field_id, planned_hire_id, number) VALUES ($1, $2, $3)",
          [numberField.rows[0]?.id, hire, value],
        );
      await number(0);
      expect(await errorCodeOf(number(1))).toBe(uniqueViolation);
      expect(
        await errorCodeOf(
          client.query(
            "INSERT INTO field_values (field_id, planned_hire_id, number, note) VALUES ($1, $2, 1, 'Both')",
            [numberField.rows[0]?.id, hire],
          ),
        ),
      ).toBe(checkViolation);
      await client.query("DELETE FROM planned_hires WHERE id = $1", [hire]);
      const left = await client.query(
        "SELECT person_id FROM field_values WHERE field_id = ANY($1)",
        [[fieldId, linkField.rows[0]?.id, noteField.rows[0]?.id]],
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

describe("people and columns", () => {
  const { uniqueViolation, restrictViolation, checkViolation } = databaseCodes;

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

  it("keeps one note for each person and note column, never empty, and never beside a choice or link", async () => {
    await withClient(database.app, async (client) => {
      const { fieldId, personId, choiceId } = await personWithChoice(
        client,
        "Fictional Noted",
      );
      const column = (settings: string) =>
        client.query<{ id: string }>(
          `INSERT INTO fields (table_name, name, type, visibility, list_id, multiple) VALUES ('people', 'Fictional Notes', 'note', ${settings}) RETURNING id`,
        );
      expect(await errorCodeOf(column("NULL, NULL, false"))).toBe(
        checkViolation,
      );
      expect(
        await errorCodeOf(
          column(
            `'general', (SELECT list_id FROM fields WHERE id = '${fieldId}'), false`,
          ),
        ),
      ).toBe(checkViolation);
      expect(await errorCodeOf(column("'general', NULL, true"))).toBe(
        checkViolation,
      );
      const noteField = (await column("'general', NULL, false")).rows[0]?.id;
      const note = (value: string, choice: string | null = null) =>
        client.query(
          "INSERT INTO field_values (field_id, person_id, note, choice_id) VALUES ($1, $2, $3, $4)",
          [noteField, personId, value, choice],
        );
      expect(await errorCodeOf(note(""))).toBe(checkViolation);
      expect(await errorCodeOf(note("*Kind*", choiceId))).toBe(checkViolation);
      await note("*Kind*");
      expect(await errorCodeOf(note("Another"))).toBe(uniqueViolation);
    });
  });
});
