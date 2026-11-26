// SPDX-License-Identifier: Apache-2.0

// Tests for recording exports through the API, against a PostgreSQL server of their own.

import { accessHistory, dataClasses } from "@fathom/db";
import type { Field, Permission } from "@fathom/shared";
import { and, desc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, type TestApp, unique } from "./test-app.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

afterEach(async () => {
  await test.connection.delete(dataClasses);
});

const seesPeople: Permission[] = ["people:view"];
const seesPersonal: Permission[] = ["people:view", "personal:view"];
const seesBoth: Permission[] = [...seesPersonal, "confidential:view"];

const name = "preferredName";
const start = "startDate";
const end = "endDate";

const exported = (
  cookie: string,
  columns: readonly string[],
  table = "people",
  details?: readonly string[],
) =>
  test.request(cookie, "POST", "/api/exports", {
    table,
    columns,
    ...(details === undefined ? {} : { details }),
  });

async function exportsBy(actorId: string) {
  return test.connection
    .select()
    .from(accessHistory)
    .where(
      and(
        eq(accessHistory.actorId, actorId),
        eq(accessHistory.action, "data-exported"),
      ),
    )
    .orderBy(desc(accessHistory.id));
}

describe("recording an export", () => {
  it("records one holding Personal columns, naming the table and those columns", async () => {
    // Given a reader of Personal details
    const reader = await test.signedIn(seesPersonal);

    // When they export names with start and end dates
    const response = await exported(reader.cookie, [name, start, end]);

    // Then the export is recorded with its Personal columns alone
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ recorded: true });
    const [entry] = await exportsBy(reader.id);
    expect(entry?.subjectId).toBeNull();
    expect(entry?.details).toEqual({
      exported: "People",
      personalColumns: ["Start", "End"],
    });
  });

  it("names Confidential columns apart, by the class the server holds", async () => {
    // Given start dates moved to Confidential
    const director = await test.signedIn("engineering-director");
    const moved = await test.request(
      director.cookie,
      "PUT",
      "/api/data-classes/startDate",
      { dataClass: "confidential" },
    );
    expect(moved.statusCode).toBe(200);
    const reader = await test.signedIn(seesBoth);

    // When start and end dates are exported
    await exported(reader.cookie, [start, end]);

    // Then each is named under its own class
    const [entry] = await exportsBy(reader.id);
    expect(entry?.details).toEqual({
      exported: "People",
      personalColumns: ["End"],
      confidentialColumns: ["Start"],
    });
  });

  it("finds an added column's class by its key", async () => {
    // Given a Confidential column added to People
    const director = await test.signedIn("engineering-director");
    const added = await test.request(
      director.cookie,
      "POST",
      "/api/people/columns",
      {
        name: unique("Fictional Link"),
        type: "link",
        visibility: "confidential",
        required: false,
      },
    );
    expect(added.statusCode, added.body).toBe(201);
    await test.approveLists();
    const { field } = added.json<{ field: Field }>();
    const reader = await test.signedIn(seesBoth);

    // When it is exported
    await exported(reader.cookie, [name, field.id]);

    // Then it is named as Confidential, by its own name
    const [entry] = await exportsBy(reader.id);
    expect(entry?.details).toEqual({
      exported: "People",
      confidentialColumns: [field.name],
    });
  });

  it("names a detail the rows hold, such as the hiring plan, by its class", async () => {
    const reader = await test.signedIn([...seesBoth, "hiring-plan:view"]);
    await exported(reader.cookie, [name], "people", ["hiringPlan"]);
    const [entry] = await exportsBy(reader.id);
    expect(entry?.details).toEqual({
      exported: "People",
      confidentialColumns: ["Hiring plan"],
    });
  });

  it("refuses the hiring plan to a role that doesn't see Confidential data", async () => {
    const reader = await test.signedIn(seesPersonal);
    const response = await exported(reader.cookie, [name], "people", [
      "hiringPlan",
    ]);
    expect(response.statusCode).toBe(403);
    expect(await exportsBy(reader.id)).toEqual([]);
  });

  it("refuses the hiring plan to a role that sees Confidential data but isn't sent the plan", async () => {
    // Given a reader of Confidential data without View Hiring plan
    const reader = await test.signedIn(seesBoth);

    const response = await exported(reader.cookie, [name], "people", [
      "hiringPlan",
    ]);

    expect(response.statusCode).toBe(403);
    expect(await exportsBy(reader.id)).toEqual([]);
  });

  it("records Start as the hiring plan for a role sent planned hires' target dates but not people's dates", async () => {
    // Given a reader of the hiring plan and Confidential data who doesn't see Personal data, whose
    // Start column holds only planned hires' target dates
    const reader = await test.signedIn([
      ...seesPeople,
      "confidential:view",
      "hiring-plan:view",
    ]);

    const response = await exported(reader.cookie, [name, start], "people", [
      "hiringPlan",
    ]);

    // Then the export is recorded, Start under the hiring plan's class, never refused as Personal
    expect(response.statusCode, response.body).toBe(200);
    const [entry] = await exportsBy(reader.id);
    expect(entry?.details).toEqual({
      exported: "People",
      confidentialColumns: ["Hiring plan", "Start"],
    });
  });

  it("records nothing for an export holding only General columns", async () => {
    const reader = await test.signedIn(seesPeople);
    const response = await exported(reader.cookie, [name, "employeeId"]);
    expect(response.json()).toEqual({ recorded: false });
    expect(await exportsBy(reader.id)).toEqual([]);
  });

  it("refuses a column the table no longer has, whose class can't be checked", async () => {
    const reader = await test.signedIn(seesPersonal);
    const response = await exported(reader.cookie, [
      start,
      "a-column-since-removed",
    ]);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error:
        "The table's columns have changed since the page opened. Reload the page and export again.",
    });
    expect(await exportsBy(reader.id)).toEqual([]);
  });

  it("finds the class of a column only drafted to be added, which the page shows", async () => {
    // Given a Confidential column drafted to be added, not yet approved
    const director = await test.signedIn("engineering-director");
    const added = await test.request(
      director.cookie,
      "POST",
      "/api/people/columns",
      {
        name: unique("Fictional Drafted"),
        type: "link",
        visibility: "confidential",
        required: false,
      },
    );
    expect(added.statusCode, added.body).toBe(201);
    const { field } = added.json<{ field: Field }>();

    // When its maker exports it
    await exported(director.cookie, [name, field.id]);

    // Then it is recorded as Confidential
    const [entry] = await exportsBy(director.id);
    expect(entry?.details).toMatchObject({ confidentialColumns: [field.name] });
  });

  it("reads back in the access history as recorded", async () => {
    const reader = await test.signedIn(seesPersonal);
    await exported(reader.cookie, [start]);
    const administrator = await test.signedIn([
      "administration:view",
      "people:view",
    ]);
    const history = await test.request(
      administrator.cookie,
      "GET",
      "/api/access-history",
    );
    const { entries } = history.json<{
      entries: { action: string; actor: { id: string }; details: object }[];
    }>();
    expect(
      entries.find(
        (entry) =>
          entry.action === "data-exported" && entry.actor.id === reader.id,
      )?.details,
    ).toEqual({ exported: "People", personalColumns: ["Start"] });
  });

  it.each(["features", "activities"] as const)(
    "records nothing for %s, whose columns are all General",
    async (table) => {
      const reader = await test.signedIn(["features:view"]);
      const response = await exported(reader.cookie, ["name"], table);
      expect(response.json()).toEqual({ recorded: false });
    },
  );
});

describe("who may record an export", () => {
  it("refuses an export naming a column the role can't see, recording nothing", async () => {
    const reader = await test.signedIn(seesPeople);
    const response = await exported(reader.cookie, [name, start]);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "This file holds Personal data, which this role can't see",
    });
    expect(await exportsBy(reader.id)).toEqual([]);
  });

  it("refuses a Confidential column to a role that sees only Personal data", async () => {
    // Given start dates moved to Confidential
    const director = await test.signedIn("engineering-director");
    await test.request(director.cookie, "PUT", "/api/data-classes/startDate", {
      dataClass: "confidential",
    });
    const reader = await test.signedIn(seesPersonal);

    // When they export start and end dates
    const response = await exported(reader.cookie, [start, end]);

    // Then the export is refused for its Confidential data
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "This file holds Confidential data, which this role can't see",
    });
    expect(await exportsBy(reader.id)).toEqual([]);
  });

  it.each([
    ["people", ["plan:view"]],
    ["features", ["plan:view"]],
    ["activities", ["plan:view"]],
  ] as const)(
    "refuses an export of %s to a role that doesn't see it",
    async (table, permissions) => {
      const reader = await test.signedIn(permissions);
      const response = await exported(reader.cookie, [name], table);
      expect(response.statusCode).toBe(403);
    },
  );

  it.each([
    ["a table it doesn't know", [name], "salaries"],
    ["a column named twice", [start, start], "people"],
  ] as const)("refuses an export of %s", async (_case, columns, table) => {
    const reader = await test.signedIn(seesPersonal);
    const response = await exported(reader.cookie, columns, table);
    expect(response.statusCode).toBe(400);
    expect(await exportsBy(reader.id)).toEqual([]);
  });
});

describe("recording an export of Accounts", () => {
  const accountsColumns = ["name", "email", "roles", "status", "created"];

  it("records accounts' names and email addresses as Personal, for a role that sees no one's Personal details", async () => {
    // Given an Administrator, who reads accounts but not people's Personal details
    const administrator = await test.signedIn(["administration:view"]);

    // When they export every column of Accounts
    const response = await exported(
      administrator.cookie,
      accountsColumns,
      "accounts",
    );

    // Then the export is recorded with its Personal columns, not refused for their class
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ recorded: true });
    const [entry] = await exportsBy(administrator.id);
    expect(entry?.details).toEqual({
      exported: "Accounts",
      personalColumns: ["Name", "Email address"],
    });
  });

  it("refuses a role that doesn't see accounts", async () => {
    const reader = await test.signedIn(seesBoth);

    const response = await exported(reader.cookie, accountsColumns, "accounts");

    expect(response.statusCode).toBe(403);
    expect(await exportsBy(reader.id)).toEqual([]);
  });

  it("records nothing for one holding only General columns", async () => {
    const administrator = await test.signedIn(["administration:view"]);

    const response = await exported(
      administrator.cookie,
      ["roles", "status"],
      "accounts",
    );

    expect(response.json()).toEqual({ recorded: false });
    expect(await exportsBy(administrator.id)).toEqual([]);
  });

  it("refuses details, since accounts' rows hold none apart from their columns", async () => {
    const administrator = await test.signedIn(["administration:view"]);

    const response = await exported(
      administrator.cookie,
      accountsColumns,
      "accounts",
      ["hiringPlan"],
    );

    expect(response.statusCode).toBe(400);
    expect(await exportsBy(administrator.id)).toEqual([]);
  });

  it("refuses a column Accounts doesn't have", async () => {
    const administrator = await test.signedIn(["administration:view"]);

    const response = await exported(
      administrator.cookie,
      ["name", "salary"],
      "accounts",
    );

    expect(response.statusCode).toBe(409);
    expect(await exportsBy(administrator.id)).toEqual([]);
  });
});
