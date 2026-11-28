// SPDX-License-Identifier: Apache-2.0

// Shared setup for the account integration tests: a migrated PostgreSQL server and app of their
// own, a Better Auth for creating accounts directly, and helpers that make accounts and roles and
// sign in.

import {
  createDatabase,
  createPool,
  type Database,
  rolePermissions,
  roles as roleTable,
  userRoles,
} from "@fathom/db";
import { type Role } from "@fathom/shared";
import {
  createTestCertificate,
  startTestDatabase,
  type TestCertificate,
  type TestDatabase,
} from "@fathom/test-utils";
import { eq } from "drizzle-orm";
import { findStartingRole } from "./data/roles.ts";
import { type App, buildApp } from "./app.ts";
import { productionLimits } from "./config.ts";
import { createAccount } from "./data/accounts.ts";
import { type Auth, createAuth } from "./data/auth.ts";
import { createDataAccess } from "./data/index.ts";

export let database: TestDatabase;
let certificate: TestCertificate;
let pool: ReturnType<typeof createPool>;
export let connection: Database;
export let auth: Auth;
export let app: App;
// A fictional address for Fathom, and a session secret used only by these tests.
export const publicUrl = "https://fathom.example.test";
const secret = "fictional-session-secret-for-tests-only-0123456789";
export const password = "fictional password 1";
export const newPassword = "fictional password 2";

export async function startAccountTests(): Promise<void> {
  certificate = createTestCertificate();
  database = await startTestDatabase();
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
  // A second Better Auth for creating accounts directly, as the account command does.
  auth = createAuth(connection, { publicUrl, secret });
  app = await buildApp({
    data: createDataAccess(connection),
    database: connection,
    auth: { publicUrl, secret },
    tls: certificate,
    logStream: { write: () => undefined },
    // Many sign-ins from one address; sign-in limits are tested elsewhere.
    limits: { ...productionLimits, requestsPerMinute: 10_000 },
  });
}

export async function closeAccountTests(): Promise<void> {
  await app.close();
  await pool.end();
  await database.remove();
  certificate.remove();
}

let accountCount = 0;
let addressCount = 10;

// A number no other account in the run has, for its name and email address.
export function nextAccountNumber(): number {
  accountCount += 1;
  return accountCount;
}

// An address sign-ins and requests come from, varied so no one address reaches a request limit.
export function nextAddress(): string {
  addressCount += 1;
  return `192.0.2.${String(addressCount % 250)}`;
}

interface TestAccount {
  id: string;
  email: string;
}

// Whether an access history entry records a sign-in, which tests of other entries leave out.
export const isSignIn = ({ action }: { action: string }) =>
  action === "signed-in";

// The ID of a starting role, as the Accounts page sends it.
export const roleId = (key: Role) => findStartingRole(connection, key);

export async function newAccount(
  role: Role = "team-member",
): Promise<TestAccount> {
  const number = nextAccountNumber();
  const email = `person${String(number)}@example.test`;
  const id = await createAccount(auth, connection, {
    name: `Fictional Person ${String(number)}`,
    email,
    password,
    roleId: await roleId(role),
  });
  return { id, email };
}

// A role made later, granting just these permissions.
export async function madeRole(
  name: string,
  permissions: string[],
): Promise<string> {
  const [made] = await connection
    .insert(roleTable)
    .values({ name })
    .returning({ id: roleTable.id });
  if (made === undefined) throw new Error("No role was made");
  if (permissions.length > 0) {
    await connection
      .insert(rolePermissions)
      .values(
        permissions.map((permission) => ({ roleId: made.id, permission })),
      );
  }
  return made.id;
}

// Gives an account a role directly, as only a test may, in place of the one it holds.
export async function holdRole(userId: string, id: string): Promise<void> {
  await connection
    .update(userRoles)
    .set({ roleId: id })
    .where(eq(userRoles.userId, userId));
}

// Signs in from a fictional address of its own, so sign-in limits never interfere, and returns the
// session cookie, or "" when sign-in is refused.
export async function signIn(
  email: string,
  withPassword = password,
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    remoteAddress: nextAddress(),
    headers: { origin: publicUrl },
    payload: { email, password: withPassword },
  });
  const cookie = [response.headers["set-cookie"]]
    .flat()
    .find((value) => value?.includes("session_token="));
  return cookie?.split(";")[0] ?? "";
}

export async function signedIn(role: Role) {
  const account = await newAccount(role);
  return { ...account, cookie: await signIn(account.email) };
}

// Each from a fictional address of its own, so Better Auth's limits on changing passwords never
// interfere.
export function request(
  cookie: string,
  method: "GET" | "POST" | "PUT" | "PATCH",
  url: string,
  payload?: object,
) {
  return app.inject({
    method,
    url,
    remoteAddress: nextAddress(),
    headers: { cookie, origin: publicUrl },
    ...(payload === undefined ? {} : { payload }),
  });
}
