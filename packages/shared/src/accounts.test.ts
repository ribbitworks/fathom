// SPDX-License-Identifier: Apache-2.0

// Tests for the requests that sign in, create and change accounts, and change passwords, and for
// the responses the browser reads about sessions, accounts, and their history.

import { describe, expect, it } from "vitest";
import {
  accountChangeSchema,
  accountListSchema,
  createdAccountSchema,
  newAccountSchema,
  passwordChangeSchema,
  passwordLength,
} from "./accounts.ts";
import { greetingResponseSchema } from "./greeting.ts";
import { historyListSchema } from "./history.ts";
import { defaultClasses } from "./data-classes.ts";
import { defaultPasswordSettings } from "./passwords.ts";
import {
  roleSwitchSchema,
  sessionResponseSchema,
  signInRequestSchema,
} from "./session.ts";

const password = "p".repeat(passwordLength.minimum);
const accountId = "10000000-0000-4000-8000-000000000001";
const roleId = "00000000-0000-4000-8000-0000000000a1";
const otherRoleId = "00000000-0000-4000-8000-0000000000a2";

describe("account requests", () => {
  const account = {
    name: " Fictional User ",
    email: "user@example.test",
    roleId,
  };

  it("creates an account with a trimmed name", () => {
    expect(newAccountSchema.parse(account).name).toBe("Fictional User");
  });

  it("keeps each run of spaces in a name as one", () => {
    expect(
      newAccountSchema.parse({ ...account, name: "Fictional \t \uFEFF User" })
        .name,
    ).toBe("Fictional User");
  });

  it.each([
    ["an empty name", { name: " " }],
    ["an address that is not an email", { email: "not an email" }],
    ["a role that is not an ID", { roleId: "team-member" }],
    ["no role", { roleId: undefined }],
    ["an empty set of roles", { roleIds: [] }],
    ["a role in the set that is not an ID", { roleIds: ["team-member"] }],
    ["a name longer than 100 characters", { name: "n".repeat(101) }],
    ["a name holding a control character", { name: "A\u0007B" }],
    ["a name holding a zero-width space", { name: "A\u200BB" }],
    ["a name holding a word joiner", { name: "A\u2060B" }],
    ["a name holding a soft hyphen", { name: "A\u00ADB" }],
  ])("refuses an account with %s", (_, refused) => {
    expect(newAccountSchema.safeParse({ ...account, ...refused }).success).toBe(
      false,
    );
  });

  it("creates an account without a password, which Fathom generates", () => {
    expect(newAccountSchema.parse({ ...account, password })).not.toHaveProperty(
      "password",
    );
  });

  it("creates an account with several roles, one of them its default", () => {
    expect(
      newAccountSchema.parse({ ...account, roleIds: [roleId, otherRoleId] })
        .roleIds,
    ).toEqual([roleId, otherRoleId]);
  });

  it("changes any of an account's name, email, roles, and default role, but not its password", () => {
    expect(accountChangeSchema.parse({ roleId })).toEqual({ roleId });
    expect(accountChangeSchema.parse({ roleIds: [otherRoleId] })).toEqual({
      roleIds: [otherRoleId],
    });
    expect(accountChangeSchema.safeParse({ roleIds: [] }).success).toBe(false);
    expect(accountChangeSchema.parse({ password })).toEqual({});
  });

  it("changes a password given the current one", () => {
    expect(
      passwordChangeSchema.safeParse({
        currentPassword: "x",
        newPassword: password,
      }).success,
    ).toBe(true);
    expect(
      passwordChangeSchema.safeParse({
        currentPassword: "",
        newPassword: password,
      }).success,
    ).toBe(false);
  });

  it.each([
    ["too short", password.slice(1)],
    ["too long", "p".repeat(passwordLength.maximum + 1)],
  ])("refuses a new password %s", (_, newPassword) => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: "x", newPassword })
        .success,
    ).toBe(false);
  });

  it("refuses a new password that is the current one, naming the new password", () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword: password,
      newPassword: password,
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["newPassword"],
        message: "The new password must differ from the current password",
      }),
    ]);
  });

  it("switches to a role given by its ID", () => {
    expect(roleSwitchSchema.safeParse({ roleId }).success).toBe(true);
    expect(roleSwitchSchema.safeParse({ roleId: "executive" }).success).toBe(
      false,
    );
  });

  it("signs in with an email address and a password", () => {
    expect(
      signInRequestSchema.safeParse({
        email: "user@example.test",
        password: "x",
      }).success,
    ).toBe(true);
    expect(
      signInRequestSchema.safeParse({
        email: "user@example.test",
        password: "",
      }).success,
    ).toBe(false);
  });
});

describe("responses", () => {
  it("reads a session", () => {
    expect(
      sessionResponseSchema.safeParse({
        user: { id: "1", name: "Fictional User", email: "user@example.test" },
        role: {
          id: roleId,
          key: "administrator",
          name: "Administrator",
          description: "Fictional description.",
        },
        roles: [
          { id: roleId, name: "Administrator" },
          { id: otherRoleId, name: "Fictional Role" },
        ],
        defaultRoleId: otherRoleId,
        permissions: ["administration:edit"],
        mustChangePassword: true,
        settings: {
          timeZone: "America/Vancouver",
          passwords: defaultPasswordSettings,
          dataClasses: defaultClasses,
        },
      }).success,
    ).toBe(true);
  });

  it("reads a new account with the password Fathom generated for it", () => {
    expect(
      createdAccountSchema.safeParse({
        account: {
          id: accountId,
          keyNumber: 1,
          name: "Fictional User",
          email: "user@example.test",
          role: { id: roleId, name: "Fictional Role" },
          roles: [{ id: roleId, name: "Fictional Role" }],
          active: true,
          createdAt: "2026-11-03T12:00:00+00:00",
        },
        password: "fictionalGeneratedPw",
      }).success,
    ).toBe(true);
  });

  it("refuses an account whose ID isn't a UUID", () => {
    expect(
      accountListSchema.safeParse({
        accounts: [
          {
            id: "1",
            keyNumber: 1,
            name: "Fictional User",
            email: "user@example.test",
            role: null,
            roles: [],
            active: true,
            createdAt: "2026-11-03T12:00:00+00:00",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("reads the accounts", () => {
    expect(
      accountListSchema.safeParse({
        accounts: [
          {
            id: accountId,
            keyNumber: 1,
            name: "Fictional User",
            email: "user@example.test",
            role: { id: roleId, name: "Fictional Role" },
            roles: [
              { id: roleId, name: "Fictional Role" },
              { id: otherRoleId, name: "Fictional Other Role" },
            ],
            active: true,
            createdAt: "2026-11-03T12:00:00+00:00",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("reads the access history", () => {
    expect(
      historyListSchema.safeParse({
        entries: [
          {
            id: 1,
            occurredAt: "2026-11-03T12:00:00Z",
            actor: null,
            action: "roles-changed",
            subject: { id: "1", name: null },
            details: {
              role: "Team Member",
              previousRole: "Planner",
              roles: ["Team Member", "Executive"],
              previousRoles: ["Planner"],
            },
          },
          {
            id: 2,
            occurredAt: "2026-11-03T12:05:00Z",
            actor: { id: "1", name: "Fictional User" },
            action: "role-switched",
            subject: { id: "1", name: "Fictional User" },
            details: { role: "Executive", previousRole: "Team Member" },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("reads the greeting", () => {
    expect(greetingResponseSchema.parse({ greeting: "Hello" })).toEqual({
      greeting: "Hello",
    });
  });
});
