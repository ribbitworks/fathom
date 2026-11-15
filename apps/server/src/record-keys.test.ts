// SPDX-License-Identifier: Apache-2.0

// Tests for record keys and the links that open records by them, against a migrated PostgreSQL
// server: how records are numbered, whether added, drafted to be added, removed, or discarded; that
// the application cannot change a number; and what a link finds for every kind and every starting
// role, for a record drafted to be added, one removed, and a planned hire once filled.

import {
  accessHistory,
  customers,
  cyclePatterns,
  features,
  featureTeams,
  fields,
  lists,
  milestones,
  people,
  plannedHires,
  projects,
  proposals,
  recordKeyCounters,
  recordKeys,
  releases,
  releaseStreams,
  roles,
  unpublishedDrafts,
  users,
} from "@fathom/db";
import {
  type Permission,
  type ProjectPlan,
  type RecordKeyKind,
  draftKeyKinds,
  draftKinds,
  permissionSchema,
  recordKeyKinds,
  type RecordLookup,
  type Role,
  roleSchema,
  startingRoles,
  withImplied,
} from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keyNumberOf } from "./data/record-keys.ts";
import { unlessRefused } from "./data/record-links.ts";
import { findStartingRole } from "./data/roles.ts";
import {
  builtInChoice,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

let test: TestApp;
let planner: { id: string; cookie: string };
let approver: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  planner = await test.signedIn("product-manager");
  approver = await test.signedIn("project-manager");
});

afterAll(async () => {
  await test.close();
});

async function keyOf(kind: RecordKeyKind, id: string): Promise<number> {
  const [row] = await test.connection
    .select({ keyNumber: recordKeys.keyNumber })
    .from(recordKeys)
    .where(and(eq(recordKeys.kind, kind), eq(recordKeys.recordId, id)));
  if (row === undefined) throw new Error(`${kind} ${id} has no key`);
  return row.keyNumber;
}

async function go(cookie: string, path: string): Promise<RecordLookup> {
  const response = await test.request(cookie, "GET", `/api/go/${path}`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json<RecordLookup>();
}

const link = (kind: RecordKeyKind, keyNumber: number) =>
  `${kind}/${String(keyNumber)}`;

type Saved = { plan: ProjectPlan };

async function draftCustomer(
  cookie = planner.cookie,
  options?: { publish?: boolean },
) {
  const name = unique("Fictional Customer");
  const response = await test.request(
    cookie,
    "POST",
    "/api/customers",
    { name },
    options,
  );
  expect(response.statusCode, response.body).toBe(201);
  const customer = response
    .json<Saved>()
    .plan.customers.find((each) => each.name === name);
  if (customer === undefined) throw new Error("No customer drafted");
  return customer;
}

async function decide(
  decision: "approval" | "rejection",
  records: { type: string; id: string }[],
) {
  const response = await test.request(
    approver.cookie,
    "POST",
    `/api/drafts/${decision}`,
    decision === "approval" ? { records } : { records, reason: "Not now" },
  );
  expect(response.statusCode, response.body).toBe(200);
}

describe("numbering records", () => {
  it("gives a record drafted to be added its key at once, kept once approved", async () => {
    // Given
    const drafted = await draftCustomer();
    // When
    await decide("approval", [{ type: "customer", id: drafted.id }]);
    // Then
    const response = await test.request(planner.cookie, "GET", "/api/projects");
    const live = response
      .json<ProjectPlan>()
      .customers.find((customer) => customer.id === drafted.id);
    expect(live?.draft).toBeUndefined();
    expect(live?.keyNumber).toBe(drafted.keyNumber);
    expect(await keyOf("customer", drafted.id)).toBe(drafted.keyNumber);
  });

  it("counts each kind's records apart, one after another", async () => {
    // Given
    const first = await draftCustomer();
    const projectId = randomUUID();
    await test.connection
      .insert(projects)
      .values({ id: projectId, name: unique("Fictional Project") });
    // When
    const second = await draftCustomer();
    // Then
    expect(second.keyNumber).toBe(first.keyNumber + 1);
    expect(await keyOf("project", projectId)).toBeGreaterThan(0);
  });

  it.each(draftKinds)(
    "numbers a %s drafted to be added as its kind, if it has keys",
    async (draftKind) => {
      // Given an account of its own, so no other test publishes the draft
      const recordId = randomUUID();
      const drafter = await test.signedIn([]);
      // When
      await test.connection.insert(unpublishedDrafts).values({
        recordType: draftKind,
        recordId,
        userId: drafter.id,
        action: "created",
      });
      // Then
      const numbered = await test.connection
        .select({ kind: recordKeys.kind })
        .from(recordKeys)
        .where(eq(recordKeys.recordId, recordId));
      // The kind is always one of the fixed kinds.
      // eslint-disable-next-line security/detect-object-injection
      const keyKind = draftKeyKinds[draftKind];
      expect(numbered).toEqual(keyKind === null ? [] : [{ kind: keyKind }]);
    },
  );

  it("never gives a removed or discarded record's number again", async () => {
    // Given
    const removed = await draftCustomer();
    await decide("approval", [{ type: "customer", id: removed.id }]);
    await test.request(
      planner.cookie,
      "DELETE",
      `/api/customers/${removed.id}`,
    );
    await decide("approval", [{ type: "customer", id: removed.id }]);
    const discarded = await draftCustomer();
    await test.request(
      planner.cookie,
      "DELETE",
      `/api/records/customer/${discarded.id}/draft`,
    );
    // When
    const next = await draftCustomer();
    // Then
    expect(await keyOf("customer", removed.id)).toBe(removed.keyNumber);
    expect(await keyOf("customer", discarded.id)).toBe(discarded.keyNumber);
    expect(next.keyNumber).toBeGreaterThan(discarded.keyNumber);
  });

  it("keeps numbers the application cannot add, change or delete", async () => {
    const customer = await draftCustomer();
    await expect(
      test.connection
        .insert(recordKeys)
        .values({ kind: "customer", keyNumber: 1, recordId: randomUUID() }),
    ).rejects.toThrow();
    await expect(
      test.connection
        .update(recordKeyCounters)
        .set({ lastNumber: 0 })
        .where(eq(recordKeyCounters.kind, "customer")),
    ).rejects.toThrow();
    await expect(
      test.connection
        .update(recordKeys)
        .set({ keyNumber: 1 })
        .where(eq(recordKeys.recordId, customer.id)),
    ).rejects.toThrow();
    await expect(
      test.connection
        .delete(recordKeys)
        .where(eq(recordKeys.recordId, customer.id)),
    ).rejects.toThrow();
  });

  it("numbers what the migrations add, such as the starting roles and built-in lists", async () => {
    const role = await findStartingRole(test.connection, "administrator");
    const [positions] = await test.connection
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.builtIn, "positions"));
    expect(await keyOf("role", role)).toBeGreaterThan(0);
    expect(await keyOf("list", String(positions?.id))).toBeGreaterThan(0);
  });
});

describe("reading a link", () => {
  it("finds a record by its link, or by its key typed in any case, with or without the #", async () => {
    const customer = await draftCustomer();
    const found = {
      result: "found",
      kind: "customer",
      id: customer.id,
    } satisfies RecordLookup;
    const number = String(customer.keyNumber);
    expect(await go(planner.cookie, `CUSTOMER/${number}`)).toEqual(found);
    expect(await go(planner.cookie, `customer-${number}`)).toEqual(found);
    expect(await go(planner.cookie, `%23Customer-${number}`)).toEqual(found);
  });

  it.each([
    "customer/2147483647",
    "customer/0",
    "cycle/1",
    "customer/one",
    "CUSTOMER-",
    "nonsense",
  ])("finds nothing for %j", async (path) => {
    expect(await go(planner.cookie, path)).toEqual({ result: "nothing" });
  });

  it("refuses a reader who isn't signed in", async () => {
    const response = await test.app.inject({
      method: "GET",
      url: "/api/go/customer/1",
    });
    expect(response.statusCode).toBe(401);
  });

  it("finds a record drafted to be added only for those who see the draft", async () => {
    // Given
    const other = await test.signedIn("product-manager");
    const unpublished = await draftCustomer(planner.cookie, { publish: false });
    const path = link("customer", unpublished.keyNumber);
    // Then
    expect((await go(planner.cookie, path)).result).toBe("found");
    expect(await go(other.cookie, path)).toEqual({ result: "nothing" });
  });

  it("says a record was removed only to those who see its history", async () => {
    // Given
    const customer = await draftCustomer();
    await decide("approval", [{ type: "customer", id: customer.id }]);
    await test.request(
      planner.cookie,
      "DELETE",
      `/api/customers/${customer.id}`,
    );
    await decide("approval", [{ type: "customer", id: customer.id }]);
    const outsider = await test.signedIn(["people:view"]);
    const seesNoHistory = await test.signedIn([]);
    const path = link("customer", customer.keyNumber);
    // Then
    expect(await go(planner.cookie, path)).toEqual({
      result: "removed",
      kind: "customer",
      id: customer.id,
    });
    expect(await go(outsider.cookie, path)).toEqual({ result: "nothing" });
    expect(await go(seesNoHistory.cookie, path)).toEqual({
      result: "nothing",
    });
  });

  it("opens the person who filled a planned hire", async () => {
    // Given
    const personId = randomUUID();
    await test.connection.insert(people).values({
      id: personId,
      preferredName: unique("Fictional Filler"),
      employeeId: unique("E-FILL"),
      positionId: testPosition,
      startDate: "2020-01-01",
    });
    const hireId = randomUUID();
    await test.connection.insert(plannedHires).values({
      id: hireId,
      requisition: unique("REQ-FILLED"),
      positionId: testPosition,
      stateId: await builtInChoice(test.connection, "hiring-states", "hired"),
      filledBy: personId,
    });
    const reader = await test.signedIn("engineering-manager");
    // When
    const found = await go(
      reader.cookie,
      link("hire", await keyOf("hire", hireId)),
    );
    // Then
    expect(found).toEqual({ result: "found", kind: "person", id: personId });
  });

  it("opens a filled planned hire itself while its person isn't seen yet", async () => {
    // Given
    const personId = randomUUID();
    await test.connection.insert(people).values({
      id: personId,
      preferredName: unique("Fictional Starter"),
      employeeId: unique("E-START"),
      positionId: testPosition,
      startDate: "2099-01-01",
    });
    const hireId = randomUUID();
    await test.connection.insert(plannedHires).values({
      id: hireId,
      requisition: unique("REQ-STARTING"),
      positionId: testPosition,
      stateId: await builtInChoice(test.connection, "hiring-states", "hired"),
      filledBy: personId,
    });
    const path = link("hire", await keyOf("hire", hireId));
    const general = await test.signedIn("team-member");
    const personal = await test.signedIn("engineering-manager");
    // Then
    expect(await go(general.cookie, path)).toEqual({
      result: "found",
      kind: "hire",
      id: hireId,
    });
    expect(await go(personal.cookie, path)).toEqual({
      result: "found",
      kind: "person",
      id: personId,
    });
  });

  it("finds a column only for those who see its class", async () => {
    // Given
    const listId = randomUUID();
    await test.connection.insert(lists).values({
      id: listId,
      name: unique("Fictional Private List"),
      visibility: "personal",
    });
    const columnId = randomUUID();
    await test.connection.insert(fields).values({
      id: columnId,
      tableName: "people",
      name: unique("Fictional Private Column"),
      listId,
    });
    const path = link("column", await keyOf("column", columnId));
    const general = await test.signedIn("team-member");
    const personal = await test.signedIn("engineering-manager");
    // Then
    expect(await go(general.cookie, path)).toEqual({ result: "nothing" });
    expect(await go(personal.cookie, path)).toEqual({
      result: "found",
      kind: "column",
      id: columnId,
      table: "people",
    });
  });

  it("records nothing in the access history, whatever it finds", async () => {
    // Given
    const reader = await test.signedIn("workforce-administrator");
    const personId = randomUUID();
    await test.connection.insert(people).values({
      id: personId,
      preferredName: unique("Fictional Private Person"),
      employeeId: unique("E-PRIVATE"),
      positionId: testPosition,
      startDate: "2099-01-01",
    });
    // Its first request after signing in is recorded on its own.
    await go(reader.cookie, link("person", 1));
    const before = await test.connection.$count(accessHistory);
    // When
    const found = await go(
      reader.cookie,
      link("person", await keyOf("person", personId)),
    );
    // Then
    expect(found.result).toBe("found");
    expect(await test.connection.$count(accessHistory)).toBe(before);
  });
});

// One live record of every kind, the table it is kept in, whether a role holding some permissions
// finds it, and what its link finds for a role that does.
interface KindCase {
  kind: RecordKeyKind;
  id: string;
  table: PgTable & { id: PgColumn };
  seenBy: (granted: readonly Permission[]) => boolean;
  found?: Partial<Extract<RecordLookup, { result: "found" }>>;
}

async function recordOfEveryKind(): Promise<KindCase[]> {
  const id = () => randomUUID();
  const ids = {
    customer: id(),
    project: id(),
    proposal: id(),
    feature: id(),
    milestone: id(),
    schedule: id(),
    release: id(),
    person: id(),
    hire: id(),
    team: id(),
    list: id(),
    peopleColumn: id(),
    featuresColumn: id(),
  };
  const { connection } = test;
  await connection
    .insert(customers)
    .values({ id: ids.customer, name: unique("Fictional Customer") });
  await connection
    .insert(projects)
    .values({ id: ids.project, name: unique("Fictional Project") });
  await connection.insert(proposals).values({
    id: ids.proposal,
    name: unique("Fictional Proposal"),
    statusId: await builtInChoice(connection, "proposal-statuses"),
  });
  await connection.insert(features).values({
    id: ids.feature,
    name: unique("Fictional Feature"),
    statusId: await builtInChoice(connection, "feature-statuses", "planned"),
  });
  await connection.insert(milestones).values({
    id: ids.milestone,
    projectId: ids.project,
    name: unique("Fictional Milestone"),
    date: "2027-03-01",
  });
  await connection.insert(releaseStreams).values({
    id: ids.schedule,
    name: unique("Fictional Stream"),
  });
  await connection.insert(cyclePatterns).values({
    streamId: ids.schedule,
    startsOn: "2027-01-01",
    length: 3,
    unit: "months",
    naming: "{YY}.{N}",
  });
  await connection.insert(releases).values({
    id: ids.release,
    streamId: ids.schedule,
    name: unique("Fictional Release"),
    firstCycle: "2027-01-01",
    lastCycle: "2027-01-01",
  });
  await connection.insert(people).values({
    id: ids.person,
    preferredName: unique("Fictional Person"),
    employeeId: unique("E-KEY"),
    positionId: testPosition,
    startDate: "2020-01-01",
  });
  await connection.insert(plannedHires).values({
    id: ids.hire,
    requisition: unique("REQ-KEY"),
    positionId: testPosition,
    stateId: await builtInChoice(connection, "hiring-states", "open"),
  });
  await connection
    .insert(featureTeams)
    .values({ id: ids.team, name: unique("Fictional Team") });
  await connection
    .insert(lists)
    .values({ id: ids.list, name: unique("Fictional List") });
  await connection.insert(fields).values([
    {
      id: ids.peopleColumn,
      tableName: "people",
      name: unique("Fictional Column"),
      listId: ids.list,
    },
    {
      id: ids.featuresColumn,
      tableName: "features",
      name: unique("Fictional Score"),
      type: "number",
      visibility: "general",
    },
  ]);
  const accountId = randomUUID();
  await connection.insert(users).values({
    id: accountId,
    name: unique("Fictional Account"),
    email: `${randomUUID()}@example.test`,
  });
  const roleId = randomUUID();
  await connection
    .insert(roles)
    .values({ id: roleId, name: unique("Fictional Role") });
  const anyOf =
    (...needed: Permission[]) =>
    (granted: readonly Permission[]) =>
      needed.some((permission) => granted.includes(permission));
  const plan = anyOf("plan:view");
  const administration = anyOf("administration:view");
  // Each comes before what it belongs to, so the cases can be removed in order.
  return [
    { kind: "milestone", id: ids.milestone, table: milestones, seenBy: plan },
    { kind: "customer", id: ids.customer, table: customers, seenBy: plan },
    { kind: "project", id: ids.project, table: projects, seenBy: plan },
    { kind: "proposal", id: ids.proposal, table: proposals, seenBy: plan },
    {
      kind: "feature",
      id: ids.feature,
      table: features,
      seenBy: anyOf("features:view"),
    },
    {
      kind: "release",
      id: ids.release,
      table: releases,
      seenBy: anyOf("features:view"),
    },
    {
      kind: "schedule",
      id: ids.schedule,
      table: releaseStreams,
      seenBy: anyOf("features:view", "configuration:view"),
    },
    {
      kind: "person",
      id: ids.person,
      table: people,
      seenBy: anyOf("people:view"),
    },
    {
      kind: "hire",
      id: ids.hire,
      table: plannedHires,
      seenBy: anyOf("people:view"),
    },
    {
      kind: "team",
      id: ids.team,
      table: featureTeams,
      seenBy: (granted) =>
        granted.includes("people:view") &&
        granted.includes("feature-teams:view"),
    },
    {
      kind: "column",
      id: ids.peopleColumn,
      table: fields,
      seenBy: anyOf("people:view"),
      found: { table: "people" },
    },
    {
      kind: "column",
      id: ids.featuresColumn,
      table: fields,
      seenBy: anyOf("features:view"),
      found: { table: "features" },
    },
    {
      kind: "list",
      id: ids.list,
      table: lists,
      seenBy: anyOf("configuration:view"),
    },
    { kind: "account", id: accountId, table: users, seenBy: administration },
    { kind: "role", id: roleId, table: roles, seenBy: administration },
  ];
}

describe("what a link finds for each starting role", () => {
  let cases: KindCase[];
  const readers = new Map<Role, string>();

  beforeAll(async () => {
    cases = await recordOfEveryKind();
    for (const role of roleSchema.options) {
      readers.set(role, (await test.signedIn(role)).cookie);
    }
  });

  it.each(roleSchema.options)(
    "finds each kind's record for a %s only when its page shows it",
    async (role) => {
      const cookie = readers.get(role) ?? "";
      // The role is always one of the starting roles.
      // eslint-disable-next-line security/detect-object-injection
      const granted = withImplied(startingRoles[role].permissions);
      for (const { kind, id, seenBy, found } of cases) {
        const seen = seenBy(granted);
        const lookup = await go(cookie, link(kind, await keyOf(kind, id)));
        expect(lookup, `${kind} ${id}`).toEqual(
          seen
            ? { result: "found", kind, id, ...found }
            : { result: "nothing" },
        );
      }
    },
  );
});

describe("a key whose record isn't kept", () => {
  let removed: KindCase[];
  let everything: string;

  beforeAll(async () => {
    everything = (await test.signedIn(permissionSchema.options)).cookie;
    removed = await recordOfEveryKind();
    const stream = removed.find((each) => each.kind === "schedule");
    await test.connection
      .delete(cyclePatterns)
      .where(eq(cyclePatterns.streamId, String(stream?.id)));
    for (const { table, id } of removed) {
      await test.connection.delete(table).where(eq(table.id, id));
    }
  });

  it.each(recordKeyKinds)(
    "finds nothing for a %s, even for a role that sees everything",
    async (kind) => {
      for (const each of removed.filter((one) => one.kind === kind)) {
        const path = link(kind, await keyOf(kind, each.id));
        expect(await go(everything, path)).toEqual({ result: "nothing" });
      }
    },
  );

  it("is refused when read as a record's own number", () => {
    expect(() => keyNumberOf(new Map(), "unnumbered")).toThrow(
      "Record unnumbered has no key number",
    );
  });
});

describe("a page refusing the reader", () => {
  it("still fails on any failure but a refusal", async () => {
    await expect(
      unlessRefused(async () => Promise.reject(new Error("Down"))),
    ).rejects.toThrow("Down");
  });
});
