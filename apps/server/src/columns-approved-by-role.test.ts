// SPDX-License-Identifier: Apache-2.0

// Access control tests of every starting role deciding drafts of each table's columns, and of a list
// and a choice made with a column, against a PostgreSQL server of their own.

import { fields, lists } from "@fathom/db";
import { type ColumnTable, columnTables, type Role } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type DeciderTests,
  startDeciderTests,
} from "./test-column-deciders.ts";

let deciders: DeciderTests;

beforeAll(async () => {
  deciders = await startDeciderTests();
});

afterAll(async () => {
  await deciders.test.close();
});

// The starting roles that decide each table's columns, and the lists and choices made with them.
const decidersOf: Readonly<Record<ColumnTable, readonly Role[]>> = {
  people: ["project-manager", "engineering-director"],
  features: ["product-manager", "project-manager", "engineering-director"],
  activities: ["product-manager", "project-manager", "engineering-director"],
};

const roles: readonly Role[] = [
  "team-member",
  "product-manager",
  "feature-lead",
  "project-manager",
  "engineering-manager",
  "engineering-director",
  "workforce-administrator",
  "executive",
  "administrator",
];

const askings = ["approval", "rejection"] as const;

const status = (allowed: boolean) => (allowed ? 200 : 403);

describe.each(columnTables)("a column on %s", (table) => {
  it.each(
    roles.flatMap((role) => askings.map((asking) => [role, asking] as const)),
  )("%s, asking %s", async (role, asking) => {
    // Given a column drafted by one who edits the table's records
    const column = await deciders.draftedColumn(table);

    // When the role decides it
    const response = await deciders.decide(role, asking, {
      columns: [column.id],
    });

    // Then only the table's Approvers may
    // eslint-disable-next-line security/detect-object-injection
    const allowed = decidersOf[table].includes(role);
    expect(response.statusCode, response.body).toBe(status(allowed));
    expect(await deciders.isLive(fields, column.id)).toBe(
      allowed && asking === "approval",
    );
  });
});

describe("a list made with a column on Features", () => {
  it.each(
    roles.flatMap((role) => askings.map((asking) => [role, asking] as const)),
  )("%s, asking %s", async (role, asking) => {
    const column = await deciders.columnWithNewList();
    const listId = String(column.listId);
    const list = await deciders.listOf(listId);

    // A list a column draws on is rejected only with the column and its choices.
    const response = await deciders.decide(
      role,
      asking,
      asking === "approval"
        ? { lists: [listId] }
        : {
            columns: [column.id],
            lists: [listId],
            choices: list?.choices.map(({ id }) => id) ?? [],
          },
    );

    const allowed = decidersOf.features.includes(role);
    expect(response.statusCode, response.body).toBe(status(allowed));
    expect(await deciders.isLive(lists, listId)).toBe(
      allowed && asking === "approval",
    );
  });
});

describe("a choice made with a column on Features", () => {
  it.each(
    roles.flatMap((role) => askings.map((asking) => [role, asking] as const)),
  )("%s, asking %s", async (role, asking) => {
    const column = await deciders.columnWithNewList();
    const list = await deciders.listOf(String(column.listId));

    const response = await deciders.decide(role, asking, {
      choices: list?.choices.map(({ id }) => id) ?? [],
    });

    expect(response.statusCode, response.body).toBe(
      status(decidersOf.features.includes(role)),
    );
  });
});
