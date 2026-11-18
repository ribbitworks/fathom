// SPDX-License-Identifier: Apache-2.0

// Tests for the password settings through the API: every signed-in user receives them with their
// session, only those who may edit settings change them, settings the rules refuse are refused,
// each change is recorded in the access history, a password a person chooses is refused when it
// breaks the rules or is too common or easy to guess, and every password Fathom makes follows the
// recipe. Each rule's variations are unit-tested in the shared package's passwords.test.ts.

import { appInfo } from "@fathom/db";
import {
  defaultPasswordSettings,
  guessablePasswordMessage,
  type PasswordRecipe,
  type PasswordSettings,
  roleSchema,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { readPasswordSettings } from "./data/settings.ts";
import { startTestApp, type TestApp } from "./test-app.ts";

let test: TestApp;
let cookie: string;
let editorId: string;
let signIns = 0;

// The password every test account signs in with, which has lowercase letters, digits, and spaces.
const password = "fictional password 1";
const publicUrl = "https://fathom.example.test";

beforeAll(async () => {
  test = await startTestApp();
  ({ cookie, id: editorId } = await test.signedIn("administrator"));
});

afterAll(async () => {
  await test.close();
});

afterEach(async () => {
  await save(defaultPasswordSettings);
});

const save = (passwords: object, as = cookie) =>
  test.request(as, "PUT", "/api/settings/passwords", passwords);

const withRules = (rules: Partial<PasswordSettings["rules"]>) => ({
  ...defaultPasswordSettings,
  rules: { ...defaultPasswordSettings.rules, ...rules },
});

// Rules, with a recipe that meets them.
const meeting = (rules: Partial<PasswordSettings["rules"]>) => {
  const { rules: full, recipe } = withRules(rules);
  return {
    rules: full,
    recipe: {
      ...recipe,
      symbols: full.symbols,
      length: Math.max(full.minimumLength, recipe.length),
    },
  };
};

const withRecipe = (recipe: Partial<PasswordRecipe>) => ({
  ...defaultPasswordSettings,
  recipe: { ...defaultPasswordSettings.recipe, ...recipe },
});

async function sessionPasswords(as = cookie): Promise<PasswordSettings> {
  return (await test.request(as, "GET", "/api/session")).json<{
    settings: { passwords: PasswordSettings };
  }>().settings.passwords;
}

async function latestEntry() {
  // Each account's sign-ins are recorded too, which these tests do not look at.
  return (await test.request(cookie, "GET", "/api/access-history"))
    .json<{
      entries: { action: string; details: object; actor: { id: string } }[];
    }>()
    .entries.find(({ action }) => action !== "signed-in");
}

let changes = 0;

// Each from a fictional address of its own, so the limits on changing a password never interfere.
const changePassword = (
  as: string,
  currentPassword: string,
  newPassword: string,
) => {
  changes += 1;
  return test.app.inject({
    method: "POST",
    url: "/api/auth/change-password",
    remoteAddress: `203.0.113.${String(changes)}`,
    headers: { cookie: as, origin: publicUrl },
    payload: { currentPassword, newPassword },
  });
};

async function signIn(email: string, given: string): Promise<string> {
  signIns += 1;
  const response = await test.app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    remoteAddress: `198.51.100.${String(signIns)}`,
    headers: { origin: publicUrl },
    payload: { email, password: given },
  });
  const session = [response.headers["set-cookie"]]
    .flat()
    .find((value) => value?.includes("session_token="));
  return session?.split(";")[0] ?? "";
}

// A new account's generated password, from the Accounts page's request.
async function createdPassword(name: string): Promise<string> {
  const [role] = (await test.request(cookie, "GET", "/api/roles")).json<{
    roles: { id: string }[];
  }>().roles;
  const response = await test.request(cookie, "POST", "/api/accounts", {
    name: `Fictional ${name}`,
    email: `${name.toLowerCase()}@example.test`,
    roleId: role?.id,
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ password: string }>().password;
}

describe("the password settings", () => {
  it("start on the defaults, for everyone signed in", async () => {
    const viewer = await test.signedIn("team-member");
    expect(await sessionPasswords(viewer.cookie)).toEqual(
      defaultPasswordSettings,
    );
  });

  it.each(roleSchema.options.filter((role) => role !== "administrator"))(
    "refuse a change from %s, which cannot edit settings",
    async (role) => {
      const other = await test.signedIn(role);
      const response = await save(withRules({ digits: true }), other.cookie);
      expect(response.statusCode).toBe(403);
      expect(await sessionPasswords()).toEqual(defaultPasswordSettings);
    },
  );

  it("are changed for everyone by an Administrator, and recorded", async () => {
    const viewer = await test.signedIn("team-member");
    const changed = {
      rules: { ...withRules({ minimumLength: 14, symbols: true }).rules },
      recipe: { ...defaultPasswordSettings.recipe, symbols: true, length: 24 },
    };
    const response = await save(changed);
    expect([response.statusCode, response.json()]).toEqual([200, changed]);
    expect(await sessionPasswords(viewer.cookie)).toEqual(changed);
    expect(await latestEntry()).toMatchObject({
      action: "password-settings-changed",
      actor: { id: editorId },
      details: {
        passwords: changed,
        previousPasswords: defaultPasswordSettings,
      },
    });
  });

  it("record nothing when nothing changed", async () => {
    const before = await latestEntry();
    expect((await save(defaultPasswordSettings)).statusCode).toBe(200);
    expect(await latestEntry()).toEqual(before);
  });

  it("refuse a recipe the rules refuse, saying why, changing and recording nothing", async () => {
    const before = await latestEntry();
    const response = await save(withRules({ symbols: true }));
    expect([response.statusCode, response.json()]).toEqual([
      400,
      {
        error:
          "Generated passwords must include symbols, because passwords must contain a symbol.",
      },
    ]);
    expect(await sessionPasswords()).toEqual(defaultPasswordSettings);
    expect(await latestEntry()).toEqual(before);
  });

  it("refuse settings outside their limits", async () => {
    expect((await save(withRules({ minimumLength: 7 }))).statusCode).toBe(400);
  });
});

describe("a password a person chooses", () => {
  it("is refused when it breaks the rules, saying why, and the old one still works", async () => {
    expect((await save(meeting({ symbols: true }))).statusCode).toBe(200);
    const user = await test.signedIn("team-member");
    const response = await changePassword(
      user.cookie,
      password,
      "fictional password 2",
    );
    expect([response.statusCode, response.json()]).toEqual([
      400,
      { error: "The password must include a symbol." },
    ]);
    expect(
      (await test.request(user.cookie, "GET", "/api/session")).statusCode,
    ).toBe(200);
  });

  it("is not checked against the rules for someone signed out, who is refused as before", async () => {
    await save(meeting({ symbols: true }));
    const response = await changePassword("", password, "fictional password 2");
    expect(response.statusCode).toBe(401);
    expect(JSON.stringify(response.json())).not.toContain(
      "The password must include a symbol",
    );
  });

  it("is accepted once it meets every rule, while the old one needs no change", async () => {
    const user = await test.signedIn("team-member");
    await save(
      meeting({
        minimumLength: 16,
        uppercase: true,
        lowercase: true,
        digits: true,
        symbols: true,
      }),
    );
    expect(
      (await test.request(user.cookie, "GET", "/api/session")).statusCode,
    ).toBe(200);
    expect(
      (await changePassword(user.cookie, password, "Fictional-password-2"))
        .statusCode,
    ).toBe(200);
  });

  it("must meet the rules when changing a password Fathom made, which it must still change", async () => {
    await save(meeting({ symbols: true }));
    const generated = await createdPassword("Chooser");
    const session = await signIn("chooser@example.test", generated);
    const refused = await changePassword(
      session,
      generated,
      "fictional password 2",
    );
    expect(refused.statusCode).toBe(400);
    expect(
      (await test.request(session, "GET", "/api/session")).json(),
    ).toMatchObject({ mustChangePassword: true });
    expect(
      (await changePassword(session, generated, "fictional password 2!"))
        .statusCode,
    ).toBe(200);
  });
});

describe("a password too common or easy to guess", () => {
  it("is refused whatever the settings, and the old one still works", async () => {
    const user = await test.signedIn("team-member");
    const response = await changePassword(
      user.cookie,
      password,
      "test12345678",
    );
    expect([response.statusCode, response.json()]).toEqual([
      400,
      { error: guessablePasswordMessage },
    ]);
    expect(
      (await test.request(user.cookie, "GET", "/api/session")).statusCode,
    ).toBe(200);
    expect(
      (await changePassword(user.cookie, password, "fictional password 2"))
        .statusCode,
    ).toBe(200);
  });

  it("is refused when built from the person's own name, and only then", async () => {
    const generated = await createdPassword("Newcomer");
    const session = await signIn("newcomer@example.test", generated);
    const refused = await changePassword(session, generated, "Newcomer2026!");
    expect([refused.statusCode, refused.json()]).toEqual([
      400,
      { error: guessablePasswordMessage },
    ]);
    expect(
      (await test.request(session, "GET", "/api/session")).json(),
    ).toMatchObject({ mustChangePassword: true });
    const other = await test.signedIn("team-member");
    expect(
      (await changePassword(other.cookie, password, "Newcomer2026!"))
        .statusCode,
    ).toBe(200);
  });

  it("is not checked for someone signed out, who is refused as before", async () => {
    const response = await changePassword("", password, "test12345678");
    expect(response.statusCode).toBe(401);
    expect(JSON.stringify(response.json())).not.toContain(
      guessablePasswordMessage,
    );
  });
});

describe("a password Fathom makes", () => {
  it("follows the recipe for a new account and a reset", async () => {
    await save(
      withRecipe({
        length: 32,
        uppercase: false,
        lowercase: false,
        digits: true,
        symbols: true,
        avoidLookAlikes: false,
      }),
    );
    expect(await createdPassword("Recipe")).toMatch(
      /^[\d!#$%&*+\-=?@^_~]{32}$/u,
    );
    const [account] = (await test.request(cookie, "GET", "/api/accounts"))
      .json<{ accounts: { id: string; email: string }[] }>()
      .accounts.filter(({ email }) => email === "recipe@example.test");
    const reset = await test.request(
      cookie,
      "POST",
      `/api/accounts/${String(account?.id)}/password`,
    );
    expect(reset.json<{ password: string }>().password).toMatch(
      /^[\d!#$%&*+\-=?@^_~]{32}$/u,
    );
  });
});

describe("a database the migrations have not given password settings", () => {
  it("fails clearly", async () => {
    const [stored] = await test.connection
      .select({ value: appInfo.value })
      .from(appInfo)
      .where(eq(appInfo.key, "password-settings"));
    await test.connection
      .delete(appInfo)
      .where(eq(appInfo.key, "password-settings"));
    try {
      await expect(readPasswordSettings(test.connection)).rejects.toThrow(
        "The password settings are missing; apply the migrations",
      );
    } finally {
      await test.connection
        .insert(appInfo)
        .values({ key: "password-settings", value: String(stored?.value) });
    }
  });
});
