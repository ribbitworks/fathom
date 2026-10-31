// SPDX-License-Identifier: Apache-2.0

// A Fathom server for tests, against a migrated PostgreSQL server of its own, with helpers to sign in
// fictional accounts holding given roles and to send requests as them. Used only by tests.

import {
  changes,
  changeSets,
  createDatabase,
  createPool,
  type Database,
  runMigrations,
} from "@fathom/db";
import type { Role } from "@fathom/shared";
import {
  createTestCertificate,
  startTestDatabase,
  type TestCertificate,
  type TestDatabase,
} from "@fathom/test-utils";
import { asc, eq } from "drizzle-orm";
import { type App, buildApp } from "./app.ts";
import { createAccount } from "./data/accounts.ts";
import { type Auth, createAuth } from "./data/auth.ts";
import { createDataAccess } from "./data/index.ts";

// A fictional address for Fathom, and a session secret used only by tests.
const publicUrl = "https://fathom.example.test";
const secret = "fictional-session-secret-for-tests-only-0123456789";
const password = "fictional password 1";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface TestApp {
  app: App;
  connection: Database;
  // Signs in a new account holding the given roles, and returns its identifier and session cookie.
  signedIn(roles: Role[]): Promise<{ id: string; cookie: string }>;
  request(
    cookie: string,
    method: Method,
    url: string,
    payload?: object,
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
  close(): Promise<void>;
}

export async function startTestApp(): Promise<TestApp> {
  const certificate: TestCertificate = createTestCertificate();
  const database: TestDatabase = await startTestDatabase();
  await runMigrations(database.migrator);
  const pool = createPool(database.app, () => undefined);
  const connection = createDatabase(pool);
  const auth: Auth = createAuth(connection, { publicUrl, secret });
  const app = await buildApp({
    data: createDataAccess(connection),
    database: connection,
    auth: { publicUrl, secret },
    tls: certificate,
    logStream: { write: () => undefined },
    // Many sign-ins from one address; sign-in limits are tested elsewhere.
    requestsPerMinute: 10_000,
  });
  let accountCount = 0;

  return {
    app,
    connection,
    async signedIn(roles) {
      accountCount += 1;
      const email = `person${String(accountCount)}@example.test`;
      const id = await createAccount(auth, connection, {
        name: `Fictional User ${String(accountCount)}`,
        email,
        password,
        roles,
      });
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
    async request(cookie, method, url, payload) {
      return app.inject({
        method,
        url,
        headers: { cookie, origin: publicUrl },
        ...(payload === undefined ? {} : { payload }),
      });
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
    async close() {
      await app.close();
      await pool.end();
      await database.container.stop();
      certificate.remove();
    },
  };
}
