// SPDX-License-Identifier: Apache-2.0

// Tests for the password settings through the API: every signed-in user receives them with their
// session, only those who may edit settings change them, a recipe that would break the rules is
// refused, each change is recorded in the access history, every password a person chooses must
// meet the rules and not be too common or easy to guess, and every password Fathom makes follows
// the recipe.

import { appInfo } from "@fathom/db";
import {
  defaultPasswordSettings,
  guessablePasswordMessage,
  type PasswordRecipe,
  type PasswordSettings,
  roleSchema,
} from "@fathom/shared";
import { guessScore } from "@fathom/shared/guessable-passwords";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { generatePassword } from "./data/accounts.ts";
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

  it.each([
    [
      "a recipe with no kind of character",
      withRecipe({ uppercase: false, lowercase: false, digits: false }),
      "Select at least one character type for generated passwords.",
    ],
    [
      "a recipe shorter than the rules ask",
      withRules({ minimumLength: 24 }),
      "Generated passwords must have at least 24 characters to meet the minimum length.",
    ],
    [
      "a recipe without a kind the rules need",
      withRules({ symbols: true }),
      "Generated passwords must include symbols, because passwords must contain a symbol.",
    ],
  ])("refuse %s, changing nothing", async (_, passwords, error) => {
    const before = await latestEntry();
    const response = await save(passwords);
    expect([response.statusCode, response.json()]).toEqual([400, { error }]);
    expect(await sessionPasswords()).toEqual(defaultPasswordSettings);
    expect(await latestEntry()).toEqual(before);
  });

  it.each([
    ["a minimum below 8", withRules({ minimumLength: 7 })],
    ["a minimum above 128", withRules({ minimumLength: 129 })],
    ["a length below 12", withRecipe({ length: 11 })],
  ])("refuse %s", async (_, passwords) => {
    expect((await save(passwords)).statusCode).toBe(400);
  });
});

describe("a password a person chooses", () => {
  it.each([
    [
      "at least 22 characters",
      { minimumLength: 22 },
      "The password must have at least 22 characters.",
    ],
    [
      "an uppercase letter",
      { uppercase: true },
      "The password must include an uppercase letter.",
    ],
    ["a symbol", { symbols: true }, "The password must include a symbol."],
  ])(
    "is refused without %s when the rules need it, and the old one still works",
    async (_, rules, error) => {
      expect((await save(meeting(rules))).statusCode).toBe(200);
      const user = await test.signedIn("team-member");
      const response = await changePassword(
        user.cookie,
        password,
        "fictional password 2",
      );
      expect([response.statusCode, response.json()]).toEqual([400, { error }]);
      expect(
        (await test.request(user.cookie, "GET", "/api/session")).statusCode,
      ).toBe(200);
    },
  );

  it.each([
    ["a lowercase letter", { lowercase: true }, "FICTIONAL PASSWORD 2"],
    ["a digit", { digits: true }, "fictional password two"],
  ])(
    "is refused without %s when the rules need it",
    async (_, rules, newPassword) => {
      await save(meeting(rules));
      const user = await test.signedIn("team-member");
      const response = await changePassword(user.cookie, password, newPassword);
      expect(response.statusCode).toBe(400);
    },
  );

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

  it("is checked only after the rules, which are named first", async () => {
    await save(meeting({ symbols: true }));
    const user = await test.signedIn("team-member");
    const response = await changePassword(
      user.cookie,
      password,
      "test12345678",
    );
    expect(response.json()).toEqual({
      error: "The password must include a symbol.",
    });
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

describe("generatePassword", () => {
  const every: PasswordRecipe = {
    length: 12,
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
    avoidLookAlikes: true,
  };

  it("has the recipe's length, from only the kinds it uses", () => {
    expect(generatePassword(defaultPasswordSettings.recipe)).toMatch(
      /^[A-Za-z\d]{20}$/u,
    );
    expect(
      generatePassword({ ...every, length: 128, uppercase: false }),
    ).toMatch(/^[a-z\d!#$%&*+\-=?@^_~]{128}$/u);
  });

  it("has at least one character of each kind the recipe uses, anywhere in it", () => {
    const firsts = new Set<string>();
    for (let tries = 0; tries < 200; tries += 1) {
      const made = generatePassword(every);
      expect(made).toMatch(/[A-Z]/u);
      expect(made).toMatch(/[a-z]/u);
      expect(made).toMatch(/\d/u);
      expect(made).toMatch(/[!#$%&*+\-=?@^_~]/u);
      firsts.add(/[A-Z]/u.test(made.charAt(0)) ? "uppercase" : "other");
    }
    expect(firsts.size).toBe(2);
  });

  it("is never too easy to guess with the default recipe, though it is not checked", () => {
    const owner = { name: "Fictional Person", email: "person@example.test" };
    for (let tries = 0; tries < 50; tries += 1) {
      expect(
        guessScore(generatePassword(defaultPasswordSettings.recipe), owner),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("leaves out characters that look alike, unless asked not to", () => {
    const made = Array.from({ length: 50 }, () =>
      generatePassword({ ...every, length: 128 }),
    ).join("");
    expect(made).not.toMatch(/[ILOilo01]/u);
    const mixed = Array.from({ length: 50 }, () =>
      generatePassword({ ...every, length: 128, avoidLookAlikes: false }),
    ).join("");
    for (const character of "ILOilo01") expect(mixed).toContain(character);
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
