// SPDX-License-Identifier: Apache-2.0

// Tests of the databases test files work in: each a migrated copy of the package's template of its
// own, open to the same roles as the database the image sets up, dropped when removed, even while
// connected to, and saying why a superuser query failed.

import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let first: TestDatabase;
let second: TestDatabase;

// Who may do what to a database itself, such as connect to it.
function accessTo(name: string): string {
  return `SELECT string_agg(access.grantee::regrole::text || ' ' || access.privilege_type, ', ' ORDER BY access.grantee::regrole::text, access.privilege_type) FROM pg_database, aclexplode(datacl) AS access WHERE datname = '${name}'`;
}

beforeAll(async () => {
  [first, second] = await Promise.all([
    startTestDatabase(),
    startTestDatabase(),
  ]);
});

afterAll(async () => {
  await Promise.all([first.remove(), second.remove()]);
});

describe("test databases", () => {
  it("are each a database of their own, already migrated", async () => {
    expect(first.app.database).not.toBe(second.app.database);
    expect(
      await first.superuserQuery(
        "SELECT count(*) > 0 FROM fathom_migrations.migrations",
      ),
    ).toBe("t");
  });

  it("are open to the same roles as the database the image sets up", async () => {
    const template = await first.superuserQuery(accessTo("fathom"));
    expect(template).toContain("fathom_app CONNECT");
    expect(await first.superuserQuery(accessTo(first.app.database))).toBe(
      template,
    );
  });

  it("are dropped when removed, ending the connections still open to them", async () => {
    // Given a database with a connection still open to it
    const own = await startTestDatabase();
    const client = new Client(own.app);
    client.on("error", () => undefined);
    await client.connect();
    try {
      // When it is removed
      await own.remove();

      // Then it is gone, and the connection with it
      expect(
        await first.superuserQuery(
          `SELECT count(*) FROM pg_database WHERE datname = '${own.app.database}'`,
        ),
      ).toBe("0");
      await expect(client.query("SELECT 1")).rejects.toThrow();
    } finally {
      await client.end().catch(() => undefined);
    }
  });

  it("say why a superuser query failed", async () => {
    await expect(
      first.superuserQuery("SELECT * FROM fictional_missing_table"),
    ).rejects.toThrow(
      /^Superuser query failed: .*relation "fictional_missing_table" does not exist/s,
    );
  });
});
