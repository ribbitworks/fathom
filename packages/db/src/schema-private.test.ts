// SPDX-License-Identifier: Apache-2.0

// Tests of private pages' tables against a real PostgreSQL server, as the application's role: a page
// and its first column made together, columns kept to their page, a value owned by a private row,
// no column key for a private column, random keys made only by their function, and a page removed
// with everything on it.

import type { Client } from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import {
  errorCodeOf,
  firstId,
  insufficientPrivilege,
  withClient,
} from "./test-clients.ts";

const checkViolation = "23514";
const uniqueViolation = "23505";
const foreignKeyViolation = "23503";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database.remove();
});

const asApp = <T>(action: (client: Client) => Promise<T>) =>
  withClient(database.app, action);

async function addUser(client: Client): Promise<string> {
  const id = randomUUID();
  await client.query(
    "INSERT INTO users (id, name, email) VALUES ($1, 'Fictional Maker', $2)",
    [id, `${id}@fathom.test`],
  );
  return id;
}

const addColumn = (client: Client, pageId: string, name: string) =>
  firstId(
    client,
    "INSERT INTO fields (table_name, page_id, name, type, visibility) VALUES ('private', $1, $2, 'number', 'general') RETURNING id",
    [pageId, name],
  );

// A page of the user's, made with its first column in one transaction, as the server makes it.
async function addPage(client: Client, userId: string): Promise<string> {
  const pageId = randomUUID();
  const fieldId = randomUUID();
  await client.query("BEGIN");
  await client.query(
    "INSERT INTO private_pages (id, user_id, name, position, first_field_id) VALUES ($1, $2, $3, 0, $4)",
    [pageId, userId, `Fictional Page ${pageId}`, fieldId],
  );
  await client.query(
    "INSERT INTO fields (id, table_name, page_id, name, type, visibility) VALUES ($1, 'private', $2, 'Code', 'number', 'general')",
    [fieldId, pageId],
  );
  await client.query("COMMIT");
  return pageId;
}

const addRow = (client: Client, pageId: string) =>
  firstId(
    client,
    "INSERT INTO private_rows (page_id, position) VALUES ($1, 0) RETURNING id",
    [pageId],
  );

describe("private pages", () => {
  it("makes a page with its first column in one transaction, and refuses one whose first column never comes", async () => {
    await asApp(async (client) => {
      const userId = await addUser(client);
      expect(await addPage(client, userId)).toBeTruthy();
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO private_pages (user_id, name, position, first_field_id) VALUES ($1, 'Fictional Alone', 1, $2)",
        [userId, randomUUID()],
      );
      expect(await errorCodeOf(client.query("COMMIT"))).toBe(
        foreignKeyViolation,
      );
    });
  });

  it("keeps a private column to its page, its name unique within that page alone", async () => {
    await asApp(async (client) => {
      const userId = await addUser(client);
      const [first, second] = [
        await addPage(client, userId),
        await addPage(client, userId),
      ];
      await addColumn(client, first, "Fictional Due");
      await addColumn(client, second, "Fictional Due");
      expect([
        await errorCodeOf(addColumn(client, first, "fictional due")),
        await errorCodeOf(
          client.query(
            "INSERT INTO fields (table_name, name, type, visibility) VALUES ('private', 'Fictional Loose', 'number', 'general')",
          ),
        ),
        await errorCodeOf(
          client.query(
            "INSERT INTO fields (table_name, page_id, name, type, visibility) VALUES ('people', $1, 'Fictional Stray', 'number', 'general')",
            [first],
          ),
        ),
      ]).toEqual([uniqueViolation, checkViolation, checkViolation]);
    });
  });

  it("gives a private column no column key, as every other column has", async () => {
    await asApp(async (client) => {
      const pageId = await addPage(client, await addUser(client));
      const privateColumn = await addColumn(client, pageId, "Fictional Hidden");
      const peopleColumn = await firstId(
        client,
        "INSERT INTO fields (table_name, name, type, visibility) VALUES ('people', $1, 'number', 'general') RETURNING id",
        [`Fictional Shown ${randomUUID()}`],
      );
      const keyed = await client.query<{ record_id: string }>(
        "SELECT record_id FROM record_keys WHERE kind = 'column' AND record_id = ANY($1)",
        [[privateColumn, peopleColumn]],
      );
      expect(keyed.rows.map(({ record_id }) => record_id)).toEqual([
        peopleColumn,
      ]);
    });
  });

  it("lets a private row own a value, and never with another owner", async () => {
    await asApp(async (client) => {
      const pageId = await addPage(client, await addUser(client));
      const rowId = await addRow(client, pageId);
      const fieldId = await addColumn(client, pageId, "Fictional Count");
      await client.query(
        "INSERT INTO field_values (field_id, private_row_id, number) VALUES ($1, $2, 3)",
        [fieldId, rowId],
      );
      expect(
        await errorCodeOf(
          client.query(
            "INSERT INTO field_values (field_id, private_row_id, feature_id, number) VALUES ($1, $2, $3, 4)",
            [fieldId, rowId, randomUUID()],
          ),
        ),
      ).toBe(checkViolation);
    });
  });

  it("removes a page's rows, columns and values with it", async () => {
    await asApp(async (client) => {
      const pageId = await addPage(client, await addUser(client));
      const rowId = await addRow(client, pageId);
      const fieldId = await addColumn(client, pageId, "Fictional Gone");
      await client.query(
        "INSERT INTO field_values (field_id, private_row_id, number) VALUES ($1, $2, 1)",
        [fieldId, rowId],
      );
      await client.query("DELETE FROM private_pages WHERE id = $1", [pageId]);
      const left = await client.query<{ count: string }>(
        "SELECT (SELECT count(*) FROM private_rows WHERE page_id = $1) + (SELECT count(*) FROM fields WHERE page_id = $1) + (SELECT count(*) FROM field_values WHERE private_row_id = $2) AS count",
        [pageId, rowId],
      );
      expect(left.rows[0]?.count).toBe("0");
    });
  });
});

const alphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

describe("random keys", () => {
  const keyOf = (client: Client, kind: string, recordId: string) =>
    client
      .query<{ code: string }>("SELECT random_key($1, $2) AS code", [
        kind,
        recordId,
      ])
      .then(({ rows }) => rows[0]?.code ?? "");

  it("makes a four-character key from the thirty unmistakable characters, keeping a record's once made", async () => {
    await asApp(async (client) => {
      const recordId = randomUUID();
      const made = await keyOf(client, "row", recordId);
      expect(made).toMatch(/^[2-9ABCDEFGHJKMNPQRSTVWXYZ]{4}$/u);
      expect(await keyOf(client, "row", recordId)).toBe(made);
    });
  });

  it("gives each record of a kind its own key", async () => {
    await asApp(async (client) => {
      const codes = new Set<string>();
      for (let made = 0; made < 50; made += 1) {
        codes.add(await keyOf(client, "page", randomUUID()));
      }
      expect(codes.size).toBe(50);
    });
  });

  it("widens a kind's new keys to five characters once a tenth of its four-character keys are used", async () => {
    const seeded = "00000000-0000-4000-8000-";
    const made = [randomUUID(), randomUUID()];
    // Given a tenth of the row kind's four-character keys, stored as the migrations' role
    await withClient(database.migrator, async (client) => {
      await client.query(
        `INSERT INTO fathom.random_keys (kind, code, record_id)
        SELECT 'row', string_agg(substr('${alphabet}', (n / (30 ^ place)::integer) % 30 + 1, 1), '' ORDER BY place), ('${seeded}' || lpad(n::text, 12, '0'))::uuid
        FROM generate_series(0, 81099) AS n, generate_series(0, 3) AS place
        GROUP BY n
        ON CONFLICT DO NOTHING`,
      );
    });
    try {
      // Then each new row key has five characters, and the page kind's keep four
      await asApp(async (client) => {
        for (const recordId of made) {
          expect(await keyOf(client, "row", recordId)).toMatch(
            /^[2-9ABCDEFGHJKMNPQRSTVWXYZ]{5}$/u,
          );
        }
        expect(await keyOf(client, "page", randomUUID())).toHaveLength(4);
      });
    } finally {
      // So the row kind's keys are four characters again for every other test
      await withClient(database.migrator, (client) =>
        client.query(
          `DELETE FROM fathom.random_keys
          WHERE kind = 'row' AND (record_id::text LIKE '${seeded}%' OR record_id = ANY($1::uuid[]))`,
          [made],
        ),
      );
    }
  });

  it("makes four-character row keys again once the keys that widened them are gone", async () => {
    await asApp(async (client) => {
      expect(await keyOf(client, "row", randomUUID())).toHaveLength(4);
    });
  });

  it("answers a second call for a record, made at the same moment, with the key the first made", async () => {
    const recordId = randomUUID();
    await withClient(database.app, async (first) => {
      await withClient(database.app, async (second) => {
        // Given a first call whose key is not yet saved
        await first.query("BEGIN");
        const made = await keyOf(first, "page", recordId);

        // When a second call for the same record waits on it, and the first is saved
        const waiting = keyOf(second, "page", recordId);
        await first.query("COMMIT");

        // Then the second answers with the first's key
        expect(await waiting).toBe(made);
      });
    });
  });

  it("lets the application's role make keys only through the function, never write one itself", async () => {
    await asApp(async (client) => {
      const code = await keyOf(client, "row", randomUUID());
      expect([
        await errorCodeOf(
          client.query(
            "INSERT INTO random_keys (kind, code, record_id) VALUES ('row', 'ZZZZ', $1)",
            [randomUUID()],
          ),
        ),
        await errorCodeOf(
          client.query("UPDATE random_keys SET code = 'YYYY' WHERE code = $1", [
            code,
          ]),
        ),
        await errorCodeOf(
          client.query("DELETE FROM random_keys WHERE code = $1", [code]),
        ),
      ]).toEqual([
        insufficientPrivilege,
        insufficientPrivilege,
        insufficientPrivilege,
      ]);
    });
  });
});
