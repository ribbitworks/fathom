// SPDX-License-Identifier: Apache-2.0

// Integration tests for the access history of accounts against a migrated PostgreSQL server.

import { roleSchema } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import {
  database,
  isSignIn,
  roleId,
  newAccount,
  signedIn,
  request,
  startAccountTests,
  closeAccountTests,
} from "./test-accounts.ts";

beforeAll(startAccountTests);

afterAll(closeAccountTests);

describe("the access history", () => {
  it.each(roleSchema.options)(
    "is shown to a %s only if the role lets them view it",
    async (role) => {
      const { cookie } = await signedIn(role);
      const response = await request(cookie, "GET", "/api/access-history");
      expect(response.statusCode).toBe(
        rolesGranting("administration:view").includes(role) ? 200 : 403,
      );
    },
  );

  it("records each change to accounts, newest first, with who made it and the roles involved, by name, but no passwords", async () => {
    const admin = await signedIn("administrator");
    const created = await request(admin.cookie, "POST", "/api/accounts", {
      name: "Fictional Recorded",
      email: "recorded@example.test",
      roleId: await roleId("team-member"),
    });
    const { id } = created.json<{ account: { id: string } }>().account;
    await request(admin.cookie, "PATCH", `/api/accounts/${id}`, {
      roleId: await roleId("executive"),
    });
    const reset = await request(
      admin.cookie,
      "POST",
      `/api/accounts/${id}/password`,
      {},
    );
    await request(admin.cookie, "PUT", `/api/accounts/${id}/active`, {
      active: false,
    });
    await request(admin.cookie, "PUT", `/api/accounts/${id}/active`, {
      active: true,
    });
    const history = await request(admin.cookie, "GET", "/api/access-history");
    const entries = history
      .json<{ entries: { subject: { id: string } }[] }>()
      .entries.filter((entry) => entry.subject.id === id);
    const actor = { id: admin.id, name: expect.any(String) as unknown };
    const subject = { id, name: "Fictional Recorded" };
    expect(entries).toMatchObject([
      { action: "account-reactivated", actor, subject, details: {} },
      { action: "account-deactivated", actor, subject, details: {} },
      { action: "password-reset", actor, subject, details: {} },
      {
        action: "roles-changed",
        actor,
        subject,
        details: {
          previousRole: "Team Member",
          role: "Executive",
          previousRoles: ["Team Member"],
          roles: ["Executive"],
        },
      },
      {
        action: "account-created",
        actor,
        subject,
        details: { role: "Team Member", roles: ["Team Member"] },
      },
    ]);
    expect(history.body).not.toContain(
      created.json<{ password: string }>().password,
    );
    expect(history.body).not.toContain(
      reset.json<{ password: string }>().password,
    );
  });

  it("records each change to an account's name and email address, without the values, and nothing when neither changes", async () => {
    const admin = await signedIn("administrator");
    const other = await newAccount();
    const url = `/api/accounts/${other.id}`;
    await request(admin.cookie, "PATCH", url, {
      name: "Fictional Before",
      email: other.email,
    });
    await request(admin.cookie, "PATCH", url, {
      name: "Fictional After",
      email: "after@example.test",
    });
    await request(admin.cookie, "PATCH", url, {
      name: "Fictional After",
      email: "after@example.test",
    });
    const history = await request(admin.cookie, "GET", "/api/access-history");
    const entries = history
      .json<{ entries: { subject: { id: string } }[] }>()
      .entries.filter((entry) => entry.subject.id === other.id);
    const actor = { id: admin.id, name: expect.any(String) as unknown };
    expect(entries).toMatchObject([
      { action: "email-changed", actor, details: {} },
      { action: "name-changed", actor, details: {} },
      { action: "name-changed", actor, details: {} },
      { action: "account-created" },
    ]);
    expect(history.body).not.toContain("Fictional Before");
    expect(history.body).not.toContain(other.email);
  });

  it("records every change administrators make to their own account, naming them as both who and whom", async () => {
    await signedIn("administrator");
    const admin = await signedIn("administrator");
    const url = `/api/accounts/${admin.id}`;
    await request(admin.cookie, "PATCH", url, {
      name: "Fictional Myself",
      email: "myself@example.test",
      roleId: await roleId("workforce-administrator"),
    });
    const history = await request(
      (await signedIn("administrator")).cookie,
      "GET",
      "/api/access-history",
    );
    const self = { id: admin.id, name: "Fictional Myself" };
    expect(
      history
        .json<{ entries: { action: string; subject: { id: string } }[] }>()
        .entries.filter(
          (entry) => entry.subject.id === admin.id && !isSignIn(entry),
        ),
    ).toMatchObject([
      {
        action: "roles-changed",
        actor: self,
        subject: self,
        details: {
          previousRole: "Administrator",
          role: "Workforce Administrator",
        },
      },
      { action: "email-changed", actor: self, subject: self },
      { action: "name-changed", actor: self, subject: self },
      { action: "account-created" },
    ]);
  });

  it("stays readable with entries from another version of Fathom, or naming accounts that no longer exist", async () => {
    const admin = await signedIn("administrator");
    await database.superuserQuery(
      `INSERT INTO fathom.access_history (actor_id, action, subject_id, details) VALUES ('removed-actor', 'future-action', 'removed-subject', '{"roles": ["viewer"], "role": 7}')`,
    );
    const history = await request(admin.cookie, "GET", "/api/access-history");
    expect(history.statusCode).toBe(200);
    expect(
      history
        .json<{ entries: { subject: { id: string } }[] }>()
        .entries.find((entry) => entry.subject.id === "removed-subject"),
    ).toMatchObject({
      action: "future-action",
      actor: { id: "removed-actor", name: null },
      subject: { id: "removed-subject", name: null },
      details: {},
    });
  });

  it("names no one for accounts the server's operators created with the account command", async () => {
    const admin = await signedIn("administrator");
    const { id } = await newAccount();
    const history = await request(admin.cookie, "GET", "/api/access-history");
    expect(
      history
        .json<{ entries: { subject: { id: string } }[] }>()
        .entries.find((entry) => entry.subject.id === id),
    ).toMatchObject({ action: "account-created", actor: null });
  });
});
