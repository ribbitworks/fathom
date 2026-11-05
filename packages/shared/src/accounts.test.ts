// SPDX-License-Identifier: Apache-2.0

// Tests for the requests that sign in, create and change accounts, and change passwords, and for
// the responses the browser reads about sessions, accounts, and their history.

import { describe, expect, it } from "vitest";
import {
  accountChangeSchema,
  accountListSchema,
  newAccountSchema,
  passwordChangeSchema,
  passwordLength,
} from "./accounts.ts";
import { greetingResponseSchema } from "./greeting.ts";
import { historyListSchema } from "./history.ts";
import { sessionResponseSchema, signInRequestSchema } from "./session.ts";

const password = "p".repeat(passwordLength.minimum);

describe("account requests", () => {
  const account = {
    name: " Fictional User ",
    email: "user@example.test",
    password,
    roles: ["viewer"],
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
    ["a password too short", { password: password.slice(1) }],
    [
      "a password too long",
      { password: "p".repeat(passwordLength.maximum + 1) },
    ],
    ["a role Fathom does not have", { roles: ["owner"] }],
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

  it("changes any of an account's name, email, and roles, but not its password", () => {
    expect(accountChangeSchema.parse({ roles: ["approver"] })).toEqual({
      roles: ["approver"],
    });
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
        roles: ["administrator"],
        permissions: ["accounts:manage"],
      }).success,
    ).toBe(true);
  });

  it("reads the accounts", () => {
    expect(
      accountListSchema.safeParse({
        accounts: [
          {
            id: "1",
            name: "Fictional User",
            email: "user@example.test",
            roles: [],
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
            details: { roles: ["viewer"], previousRoles: [] },
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
