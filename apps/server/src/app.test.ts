// SPDX-License-Identifier: Apache-2.0

// Tests for the application against a migrated PostgreSQL server, connected as the application's
// database role: the greeting, the built front end, security headers, the request time limit, rate
// limiting, the check that requests changing data come from Fathom's own pages, error responses that
// reveal no internal details, and logs without personal data other than the client's address.

import { appInfo, createDatabase, createPool } from "@fathom/db";
import {
  createTestCertificate,
  startTestDatabase,
  type TestCertificate,
  type TestDatabase,
} from "@fathom/test-utils";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type App, buildApp } from "./app.ts";
import { createAccount } from "./data/accounts.ts";
import { findStartingRole } from "./data/roles.ts";
import { createAuth } from "./data/auth.ts";
import { readGreeting } from "./data/greeting.ts";
import { createDataAccess, type DataAccess } from "./data/index.ts";
import { actorFor, rolesGranting } from "./access.ts";
import { ForbiddenError } from "./errors.ts";
import { roleSchema } from "@fathom/shared";

type Pool = ReturnType<typeof createPool>;

let database: TestDatabase;
let certificate: TestCertificate;
const pools: Pool[] = [];
const apps: App[] = [];
// A fictional address for Fathom, and a session secret used only by these tests.
const publicUrl = "https://fathom.example.test";
const secret = "fictional-session-secret-for-tests-only-0123456789";

function poolFor(password = database.app.password): Pool {
  const pool = createPool({ ...database.app, password }, () => undefined);
  pools.push(pool);
  return pool;
}

async function appFor(
  options: {
    password?: string;
    data?: DataAccess;
    requestsPerMinute?: number;
    webRoot?: string;
  } = {},
  logLines: string[] = [],
): Promise<App> {
  // A wrong password breaks only the data access layer, so sign-in still works.
  const app = await buildApp({
    data:
      options.data ??
      createDataAccess(createDatabase(poolFor(options.password))),
    database: createDatabase(poolFor()),
    auth: { publicUrl, secret },
    tls: certificate,
    logStream: { write: (line) => logLines.push(line) },
    ...(options.requestsPerMinute
      ? { requestsPerMinute: options.requestsPerMinute }
      : {}),
    webRoot: options.webRoot,
  });
  apps.push(app);
  return app;
}

beforeAll(async () => {
  certificate = createTestCertificate();
  database = await startTestDatabase();
});

afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
  await Promise.all(pools.map((pool) => pool.end()));
  await database.remove();
  certificate.remove();
});

const fictionalUser = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Fictional Person",
  email: "person@example.test",
};

let accounts = 0;
// Creates a fictional account, signs it in, and returns the session cookie.
async function signedIn(app: App): Promise<string> {
  accounts += 1;
  const email = `person${String(accounts)}@example.test`;
  const connection = createDatabase(poolFor());
  await createAccount(
    createAuth(connection, { publicUrl, secret }),
    connection,
    {
      name: `Fictional Person ${String(accounts)}`,
      email,
      password: "fictional password 1",
      roleId: await findStartingRole(connection, "team-member"),
    },
  );
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    remoteAddress: `192.0.2.${String(100 + accounts)}`,
    headers: { origin: publicUrl },
    payload: { email, password: "fictional password 1" },
  });
  const cookie = [response.headers["set-cookie"]]
    .flat()
    .find((value) => value?.includes("session_token="));
  return String(cookie).split(";")[0] ?? "";
}

describe("greeting", () => {
  it("returns the greeting stored in the database to a signed-in user", async () => {
    const app = await appFor();
    const response = await app.inject({
      url: "/api/greeting",
      headers: { cookie: await signedIn(app) },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ greeting: "Hello, Fathom" });
  });

  // The access control pattern: every role on its own, allowed exactly when it grants the permission.
  it.each(roleSchema.options)(
    "is read by a %s only if the role lets them view the plan",
    async (role) => {
      const data = createDataAccess(createDatabase(poolFor()));
      const reading = data.readGreeting(actorFor(fictionalUser, role));
      if (rolesGranting("plan:view").includes(role)) {
        await expect(reading).resolves.toBe("Hello, Fathom");
      } else {
        await expect(reading).rejects.toBeInstanceOf(ForbiddenError);
      }
    },
  );

  it("answers a request the actor's roles do not allow with a plain forbidden", async () => {
    const realData = createDataAccess(createDatabase(poolFor()));
    const app = await appFor({
      data: {
        ...realData,
        readGreeting: () => Promise.reject(new ForbiddenError()),
      },
    });
    const response = await app.inject({
      url: "/api/greeting",
      headers: { cookie: await signedIn(app) },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Forbidden" });
  });

  it.each(["40P01", "40001"])(
    "asks the user to try again when a change met another saved at the same moment (%s)",
    async (code) => {
      const realData = createDataAccess(createDatabase(poolFor()));
      const app = await appFor({
        data: {
          ...realData,
          readGreeting: () =>
            Promise.reject(
              new Error("query failed", {
                cause: Object.assign(new Error("stopped"), { code }),
              }),
            ),
        },
      });
      const response = await app.inject({
        url: "/api/greeting",
        headers: { cookie: await signedIn(app) },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: "Someone else saved a change at the same moment. Try again.",
      });
    },
  );

  it("needs sign-in, like every API request", async () => {
    const response = await (await appFor()).inject("/api/greeting");
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
  });

  it("fails clearly when the migrations have not stored the greeting", async () => {
    const stored = await database.superuserQuery(
      "SELECT value FROM fathom.app_info WHERE key = 'greeting'",
    );
    await database.superuserQuery(
      "DELETE FROM fathom.app_info WHERE key = 'greeting'",
    );
    try {
      await expect(readGreeting(createDatabase(poolFor()))).rejects.toThrow(
        "The greeting is missing; apply the migrations",
      );
    } finally {
      await database.superuserQuery(
        `INSERT INTO fathom.app_info (key, value) VALUES ('greeting', $stored$${stored}$stored$)`,
      );
    }
  });
});

describe("front end", () => {
  // The web root sits inside a folder named assets, so caching cannot depend on the folders above
  // it, and that folder holds a file the server must never serve.
  let folder: string;
  let webRoot: string;

  beforeAll(() => {
    folder = mkdtempSync(join(tmpdir(), "fathom-web-"));
    writeFileSync(join(folder, "outside.txt"), "fictional-outside-marker");
    // A fictional build, laid out as Vite lays out its output.
    webRoot = join(folder, "site");
    mkdirSync(join(webRoot, "assets"), { recursive: true });
    writeFileSync(
      join(webRoot, "index.html"),
      "<!doctype html><title>Fathom</title>",
    );
    writeFileSync(join(webRoot, "assets", "index-fictional.js"), "export {};");
    writeFileSync(join(webRoot, ".hidden"), "fictional-hidden-marker");
  });

  afterAll(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  it("serves the page, which browsers check for a new release on every visit", async () => {
    const response = await (await appFor({ webRoot })).inject("/");
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^text\/html/);
    expect(response.body).toContain("<title>Fathom</title>");
    expect(response.headers["cache-control"]).toBe("no-cache");
    expect(response.headers["content-security-policy"]).toContain(
      "script-src 'self'",
    );
  });

  it("serves built scripts, which browsers may keep for a year", async () => {
    const response = await (
      await appFor({ webRoot })
    ).inject("/assets/index-fictional.js");
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("decides caching from the folders inside the web root only", async () => {
    const assetsParent = join(folder, "assets");
    const nestedRoot = join(assetsParent, "site");
    mkdirSync(nestedRoot, { recursive: true });
    writeFileSync(join(nestedRoot, "index.html"), "<!doctype html>");
    const response = await (await appFor({ webRoot: nestedRoot })).inject("/");
    expect(response.headers["cache-control"]).toBe("no-cache");
  });

  it.each(["/sign-in", "/people/fictional?tab=details"])(
    "answers a browser asking for the front end's page %s with the front end's page",
    async (url) => {
      const response = await (
        await appFor({ webRoot })
      ).inject({ url, headers: { accept: "text/html,application/xhtml+xml" } });
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("<title>Fathom</title>");
      expect(response.headers["cache-control"]).toBe("no-cache");
      expect(response.headers["content-security-policy"]).toContain(
        "script-src 'self'",
      );
    },
  );

  it.each([
    [
      "an unknown API path",
      { url: "/api/unknown", headers: { accept: "text/html" } },
    ],
    [
      "a missing file",
      { url: "/assets/missing.js", headers: { accept: "text/html" } },
    ],
    [
      "a request for JSON",
      { url: "/sign-in", headers: { accept: "application/json" } },
    ],
    ["a request that does not ask for a page", { url: "/sign-in" }],
    [
      "a request that changes data",
      {
        method: "DELETE" as const,
        url: "/sign-in",
        headers: { accept: "text/html", origin: publicUrl },
      },
    ],
  ])("answers %s with a plain not found", async (_case, request) => {
    const response = await (await appFor({ webRoot })).inject(request);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Not Found" });
  });

  it("answers unknown files with a plain not found", async () => {
    const response = await (await appFor({ webRoot })).inject("/missing.js");
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Not Found" });
  });

  it("serves nothing outside its folder", async () => {
    const app = await appFor({ webRoot });
    for (const url of [
      "/../outside.txt",
      "/%2e%2e/outside.txt",
      "/%2e%2e%2foutside.txt",
      "/assets/..%2f..%2foutside.txt",
    ]) {
      const response = await app.inject(url);
      expect(response.statusCode).toBe(404);
      expect(response.body).not.toContain("fictional-outside-marker");
    }
  });

  it("does not serve hidden files", async () => {
    const response = await (await appFor({ webRoot })).inject("/.hidden");
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain("fictional-hidden-marker");
  });

  it("serves only the API when there is no built front end", async () => {
    const response = await (await appFor()).inject("/");
    expect(response.statusCode).toBe(404);
  });
});

describe("database connection check", () => {
  it("passes when the database can be queried", async () => {
    await expect(
      createDataAccess(createDatabase(poolFor())).checkConnection(),
    ).resolves.toBeUndefined();
  });

  it("fails with a message naming the settings to check", async () => {
    await expect(
      createDataAccess(
        createDatabase(poolFor("wrong-password")),
      ).checkConnection(),
    ).rejects.toThrow(
      /^Could not query the database; check the FATHOM_DB_\* settings$/,
    );
  });
});

describe("responses", () => {
  it("send security headers, allowing content only from Fathom itself, and inline styles but never inline scripts", async () => {
    const response = await (await appFor()).inject("/api/greeting");
    expect(response.headers["strict-transport-security"]).toMatch(
      /max-age=\d+/,
    );
    const policy = String(response.headers["content-security-policy"]);
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self';");
    expect(policy).toContain("script-src-attr 'none';");
    expect(policy).toContain("style-src 'self' 'unsafe-inline';");
    expect(policy).toContain("font-src 'self';");
    expect(policy).not.toContain("https:");
    expect(policy.match(/unsafe-inline/g)).toHaveLength(1);
    expect(policy).not.toContain("unsafe-eval");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("set a 30-second time limit for each request", async () => {
    expect((await appFor()).server.requestTimeout).toBe(30_000);
  });

  it("answer unknown paths with a plain not found", async () => {
    const response = await (await appFor()).inject("/api/unknown");
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Not Found" });
  });

  it("answer malformed URLs with a plain bad request that does not echo the URL", async () => {
    const response = await (
      await appFor()
    ).inject("/api/%zz?name=fictional-person");
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Bad Request" });
    expect(response.headers["content-security-policy"]).toContain(
      "default-src 'none'",
    );
    expect(response.headers["strict-transport-security"]).toMatch(
      /max-age=\d+/,
    );
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("hide internal details when the server fails, and log the failure", async () => {
    const logLines: string[] = [];
    const app = await appFor({ password: "wrong-password" }, logLines);
    const response = await app.inject({
      url: "/api/greeting",
      headers: { cookie: await signedIn(app) },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal Server Error" });
    expect(logLines.join("")).toContain('"code":"28P01"');
  });
});

describe("requests that change data", () => {
  const post = (app: App, origin?: string) =>
    app.inject({
      method: "POST",
      url: "/api/unknown",
      headers: origin === undefined ? {} : { origin },
    });

  it("are refused unless they come from Fathom's own pages", async () => {
    const app = await appFor();
    for (const origin of [undefined, "https://another.example.test", "null"]) {
      const response = await post(app, origin);
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "Forbidden" });
    }
  });

  it("are handled when they come from Fathom's own pages", async () => {
    expect((await post(await appFor(), publicUrl)).statusCode).toBe(404);
  });
});

describe("rate limiting", () => {
  it("limits how many requests a client can make each minute", async () => {
    const app = await appFor({ requestsPerMinute: 2 });
    await app.inject("/api/greeting");
    await app.inject("/api/greeting");
    const response = await app.inject("/api/greeting");
    expect(response.statusCode).toBe(429);
    expect(response.json<{ error: string }>().error).toMatch(/rate limit/i);
  });

  it("counts requests to unknown paths with bodies that cannot be read", async () => {
    const app = await appFor({ requestsPerMinute: 2 });
    const badRequest = () =>
      app.inject({
        method: "POST",
        url: "/api/unknown",
        headers: { "content-type": "application/json", origin: publicUrl },
        payload: "{not json",
      });
    await badRequest();
    await badRequest();
    expect((await badRequest()).statusCode).toBe(429);
  });
});

describe("logs", () => {
  it("record each request's path and client address, without its query string", async () => {
    const logLines: string[] = [];
    const app = await appFor({}, logLines);
    await app.inject({
      url: "/api/greeting?name=fictional-person",
      remoteAddress: "192.0.2.55",
    });
    const logs = logLines.join("");
    expect(logs).toContain('"path":"/api/greeting"');
    expect(logs).toContain('"clientAddress":"192.0.2.55"');
    expect(logs).not.toContain("fictional-person");
  });

  it("leave out the machine's name", async () => {
    const logLines: string[] = [];
    const app = await appFor({}, logLines);
    await app.inject("/api/greeting");
    expect(logLines.join("")).not.toContain(hostname());
  });

  it("record database errors by code, without the query's values", async () => {
    const logLines: string[] = [];
    const app = await appFor({}, logLines);
    const error: unknown = await createDatabase(poolFor())
      .insert(appInfo)
      .values({ key: "greeting", value: "fictional-marker" })
      .catch((caught: unknown) => caught);
    app.log.error({ err: error });
    const logs = logLines.join("");
    expect(logs).toContain('"code":"23505"');
    expect(logs).not.toContain("fictional-marker");
    expect(logs).not.toContain("already exists");
  });

  it("record other errors with their message", async () => {
    const logLines: string[] = [];
    const app = await appFor({}, logLines);
    app.log.error({ err: new Error("A fictional failure") });
    expect(logLines.join("")).toContain("A fictional failure");
  });

  it("redact passwords and credentials passed to the logger", async () => {
    const logLines: string[] = [];
    const app = await appFor({}, logLines);
    app.log.info({
      password: "fictional-password",
      headers: { authorization: "fictional-token", cookie: "fictional-cookie" },
    });
    const logs = logLines.join("");
    expect(logs).toContain("[redacted]");
    expect(logs).not.toMatch(/fictional-(password|token|cookie)/);
  });
});
