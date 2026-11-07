// SPDX-License-Identifier: Apache-2.0

// A Fathom server for tests, against a migrated PostgreSQL server of its own, whose built-in
// Positions list offers two fictional positions, with helpers to sign in fictional accounts holding
// a given role, to send requests as them, and to approve the drafts of lists that tests set up.
// Unless asked not to, each change sent is published straight after, as its maker would, so tests
// of drafts see them as everyone does. Used only by tests.

import {
  changes,
  changeSets,
  drafts,
  createDatabase,
  createPool,
  type Database,
  listItems,
  lists,
  rolePermissions,
  roles as roleTable,
  runMigrations,
} from "@fathom/db";
import type { Permission, Role } from "@fathom/shared";
import {
  createTestCertificate,
  startTestDatabase,
  type TestCertificate,
  type TestDatabase,
} from "@fathom/test-utils";
import { asc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { actorFor } from "./access.ts";
import { type App, buildApp } from "./app.ts";
import { createAccount } from "./data/accounts.ts";
import { type Auth, createAuth } from "./data/auth.ts";
import { createDataAccess } from "./data/index.ts";
import { findStartingRole, giveRole } from "./data/roles.ts";

// A fictional address for Fathom, and a session secret used only by tests.
const publicUrl = "https://fathom.example.test";
const secret = "fictional-session-secret-for-tests-only-0123456789";
const password = "fictional password 1";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// The positions every test app's Positions list offers, for the people and planned hires tests add.
export const testPosition = "00000000-0000-4000-8000-00000000f001";
export const otherTestPosition = "00000000-0000-4000-8000-00000000f002";

export interface TestApp {
  app: App;
  connection: Database;
  // Signs in a new account holding a starting role, or a role made for the test granting just these
  // permissions, and returns its identifier and session cookie.
  signedIn(
    role: Role | readonly Permission[],
  ): Promise<{ id: string; cookie: string }>;
  // Gives the account a role, made for the test, granting just these permissions, in place of the
  // role it held.
  holdOnly(userId: string, permissions: readonly Permission[]): Promise<void>;
  // Publishes the change straight after unless asked not to, or the app was started not to.
  request(
    cookie: string,
    method: Method,
    url: string,
    payload?: object,
    options?: { publish?: boolean },
  ): Promise<Awaited<ReturnType<App["inject"]>>>;
  // The changes recorded for a record, oldest first, with who made them.
  historyOf(id: string): Promise<
    {
      action: string;
      field: string;
      tier: string;
      oldValue: unknown;
      newValue: unknown;
      madeBy: string | null;
    }[]
  >;
  // Approves every draft of a list, a choice, a column, or an order, so the configuration set up for
  // a test is live, as a fictional Approver.
  approveLists(): Promise<void>;
  close(): Promise<void>;
}

// Publishes the user's unpublished changes after a change they send, as they would, so tests of
// published drafts need not; users who make no drafts are refused, which changes nothing.
export async function publishingAfter(
  app: App,
  headers: { cookie: string; origin: string },
  method: Method,
  url: string,
): Promise<void> {
  if (method === "GET" || url.startsWith("/api/unpublished")) return;
  await app.inject({
    method: "POST",
    url: "/api/unpublished/publish",
    headers,
  });
}

export async function startTestApp({
  publishEachChange = true,
} = {}): Promise<TestApp> {
  const certificate: TestCertificate = createTestCertificate();
  const database: TestDatabase = await startTestDatabase();
  await runMigrations(database.migrator);
  const pool = createPool(database.app, () => undefined);
  const connection = createDatabase(pool);
  const [positions] = await connection
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.builtIn, "positions"));
  await connection.insert(listItems).values([
    {
      id: testPosition,
      listId: String(positions?.id),
      label: "Fictional Engineer",
      position: 1,
    },
    {
      id: otherTestPosition,
      listId: String(positions?.id),
      label: "Fictional Lead",
      position: 2,
    },
  ]);
  const auth: Auth = createAuth(connection, { publicUrl, secret });
  const data = createDataAccess(connection);
  const app = await buildApp({
    data,
    database: connection,
    auth: { publicUrl, secret },
    tls: certificate,
    logStream: { write: () => undefined },
    // Many sign-ins from one address; sign-in limits are tested elsewhere.
    requestsPerMinute: 10_000,
  });
  let accountCount = 0;
  let approverId: string | undefined;

  async function holdOnly(
    userId: string,
    permissions: readonly Permission[],
  ): Promise<void> {
    const [role] = await connection
      .insert(roleTable)
      .values({ name: `Fictional Test Role ${randomUUID()}` })
      .returning({ id: roleTable.id });
    const roleId = String(role?.id);
    if (permissions.length > 0) {
      await connection
        .insert(rolePermissions)
        .values(permissions.map((permission) => ({ roleId, permission })));
    }
    await giveRole(connection, userId, roleId);
  }

  return {
    app,
    connection,
    holdOnly,
    async signedIn(role) {
      accountCount += 1;
      const email = `person${String(accountCount)}@example.test`;
      const id = await createAccount(auth, connection, {
        name: `Fictional User ${String(accountCount)}`,
        email,
        password,
        roleId: await findStartingRole(
          connection,
          typeof role === "string" ? role : "team-member",
        ),
      });
      if (typeof role !== "string") await holdOnly(id, role);
      // Each from a fictional address of its own, so sign-in limits never interfere.
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        remoteAddress: `192.0.2.${String(accountCount % 250)}`,
        headers: { origin: publicUrl },
        payload: { email, password },
      });
      const cookie = [response.headers["set-cookie"]]
        .flat()
        .find((value) => value?.includes("session_token="));
      return { id, cookie: cookie?.split(";")[0] ?? "" };
    },
    async request(cookie, method, url, payload, options) {
      const headers = { cookie, origin: publicUrl };
      const response = await app.inject({
        method,
        url,
        headers,
        ...(payload === undefined ? {} : { payload }),
      });
      if (options?.publish ?? publishEachChange) {
        await publishingAfter(app, headers, method, url);
      }
      return response;
    },
    historyOf(id) {
      return connection
        .select({
          action: changes.action,
          field: changes.field,
          tier: changes.tier,
          oldValue: changes.oldValue,
          newValue: changes.newValue,
          madeBy: changeSets.madeBy,
        })
        .from(changes)
        .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
        .where(eq(changes.recordId, id))
        .orderBy(asc(changes.id));
    },
    async approveLists() {
      approverId ??= await createAccount(auth, connection, {
        name: "Fictional Approver of Lists",
        email: "list.approver@example.test",
        password,
        roleId: await findStartingRole(connection, "engineering-director"),
      });
      const waiting = await connection
        .select({ recordType: drafts.recordType, recordId: drafts.recordId })
        .from(drafts)
        .where(
          inArray(drafts.recordType, [
            "list",
            "list-item",
            "choice-order",
            "field",
            "column-order",
          ]),
        );
      if (waiting.length === 0) return;
      const of = (recordType: string) =>
        waiting
          .filter((draft) => draft.recordType === recordType)
          .map(({ recordId }) => recordId);
      await data.drafts.approve(
        actorFor(
          { id: approverId, name: "Fictional Approver of Lists", email: "" },
          "engineering-director",
        ),
        {
          people: [],
          lists: of("list"),
          choices: of("list-item"),
          orders: of("choice-order"),
          columns: of("field"),
          columnOrder: of("column-order").length > 0,
        },
      );
    },
    async close() {
      await app.close();
      await pool.end();
      await database.container.stop();
      certificate.remove();
    },
  };
}
