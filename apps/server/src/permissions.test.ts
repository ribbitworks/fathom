// SPDX-License-Identifier: Apache-2.0

// Tests that every API route enforces what it needs, against a migrated PostgreSQL server: a table
// of every route and what it needs, checked against the routes the server registers.

import {
  impliedPermissions,
  type Permission,
  permissionSchema,
} from "@fathom/shared";
import { users } from "@fathom/db";
import { eq } from "drizzle-orm";
import type * as Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startTestApp, type TestApp } from "./test-app.ts";
import { findStartingRole } from "./data/roles.ts";
import { id, type Route, setTeamMember } from "./test-permission-needs.ts";
import { routes } from "./test-permission-routes.ts";

// Every method and URL pattern the server registers, recorded by each Fastify instance the server
// creates, since Fastify offers no list of its routes but a printed tree.
const registered = vi.hoisted(() => new Set<string>());

vi.mock("fastify", async (importOriginal) => {
  const fastify = await importOriginal<typeof Fastify>();
  const create = fastify.default as (...options: unknown[]) => FastifyInstance;
  return {
    ...fastify,
    default: (...options: unknown[]) => {
      const app = create(...options);
      app.addHook("onRoute", ({ method, url }) => {
        for (const each of [method].flat()) registered.add(`${each} ${url}`);
      });
      return app;
    },
  };
});

const nameOf = ({ method, pattern, variant }: Route) =>
  `${method} ${pattern}${variant === undefined ? "" : ` (${variant})`}`;

// Every permission except those given, and except those that grant one of them, since editing data
// grants seeing it.
function allExcept(dropped: readonly Permission[]): Permission[] {
  const granting = Object.entries(impliedPermissions)
    .filter(([, implied]) => dropped.includes(implied))
    .map(([permission]) => permissionSchema.parse(permission));
  return permissionSchema.options.filter(
    (permission) =>
      !dropped.includes(permission) && !granting.includes(permission),
  );
}

interface Case {
  name: string;
  route: Route;
  holds: readonly Permission[];
}

// Accounts holding every permission but some of those a route needs, one case for each permission
// it needs all of, and one for each group it needs one of.
const refusals: Case[] = routes.flatMap((route) => {
  if (route.needs.kind !== "permissions") return [];
  const { all, any } = route.needs;
  return [
    ...all.map((permission) => ({
      name: `refuses ${nameOf(route)} without ${permission}`,
      route,
      holds: allExcept([permission]),
    })),
    ...any.map((group) => ({
      name: `refuses ${nameOf(route)} without ${group.join(" or ")}`,
      route,
      holds: allExcept(group),
    })),
  ];
});

// Accounts holding only what a route needs, one case for each permission of each group it needs one
// of, held with the first of every other group.
const allowances: Case[] = routes.flatMap((route) => {
  if (route.needs.kind === "open") return [];
  if (route.needs.kind === "signed-in") {
    return [
      { name: `allows ${nameOf(route)} with no permissions`, route, holds: [] },
    ];
  }
  const { all, any } = route.needs;
  const firsts = (except: number) =>
    any.flatMap((group, at) => (at === except ? [] : group.slice(0, 1)));
  const options =
    any.length === 0
      ? [all]
      : any.flatMap((group, at) =>
          group.map((one) => [...new Set([...all, ...firsts(at), one])].sort()),
        );
  const distinct = new Map(
    options.map((holds) => [holds.join(" and "), holds]),
  );
  return [...distinct].map(([joined, holds]) => ({
    name: `allows ${nameOf(route)} with only ${joined}`,
    route,
    holds,
  }));
});

const signedOut = routes.filter(({ needs }) => needs.kind !== "open");

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
  setTeamMember(await findStartingRole(test.connection, "team-member"));
});

afterAll(async () => {
  await test.close();
});

// The session cookies of accounts holding exactly some permissions, each made once and shared by
// the tests needing the same permissions. Sharing is safe, since no request sent changes an
// account's role or session: those routes are sent random IDs, and are refused or not found.
const holders = new Map<string, string>();

async function holding(permissions: readonly Permission[]): Promise<string> {
  const key = [...permissions].sort().join(" ");
  const known = holders.get(key);
  if (known !== undefined) return known;
  const who = await test.signedIn(permissions);
  holders.set(key, who.cookie);
  return who.cookie;
}

async function send(cookie: string, route: Route) {
  const url = route.url ?? route.pattern.replaceAll(/:[A-Za-z]+/gu, () => id());
  return test.request(cookie, route.method, url, route.body?.(), {
    publish: false,
  });
}

describe("the routes", () => {
  it("lists every route the server registers", () => {
    const served = [...registered].filter(
      (route) => !route.startsWith("HEAD "),
    );
    const listed = routes.map(
      ({ method, pattern: path }) => `${method} ${path}`,
    );
    expect([...new Set(listed)].sort()).toEqual(served.sort());
  });
});

describe("refusing requests", () => {
  it.each(signedOut.map((route) => ({ name: nameOf(route), route })))(
    "refuses $name when signed out",
    async ({ route }) => {
      const response = await send("", route);
      expect(response.statusCode, response.body).toBe(401);
    },
  );

  it.each(refusals)("$name", async ({ route, holds }) => {
    const response = await send(await holding(holds), route);
    expect(response.statusCode, response.body).toBe(403);
  });

  describe("while a generated password is still to be changed", () => {
    let cookie: string;

    beforeAll(async () => {
      const who = await test.signedIn(permissionSchema.options);
      await test.connection
        .update(users)
        .set({ mustChangePassword: true })
        .where(eq(users.id, who.id));
      cookie = who.cookie;
    });

    it.each(signedOut.map((route) => ({ name: nameOf(route), route })))(
      "refuses $name",
      async ({ route }) => {
        const response = await send(cookie, route);
        expect(response.statusCode, response.body).toBe(403);
        expect(response.json()).toEqual({
          error: "The password must be changed before continuing.",
        });
      },
    );
  });
});

describe("allowing requests", () => {
  it.each(allowances)("$name", async ({ route, holds }) => {
    const response = await send(await holding(holds), route);
    // Neither refused, nor refused as invalid, so the requests the refusals send are valid too, nor
    // failed. A random ID is not found.
    expect([200, 201, 204, 404], response.body).toContain(response.statusCode);
  });
});
