// SPDX-License-Identifier: Apache-2.0

// Helpers for the tests of who decides drafts of columns and of the lists made with them: drafting
// them as their tables' editors, and deciding them under a role or permissions.

import { fields, lists } from "@fathom/db";
import type {
  ColumnTable,
  Field,
  List,
  Permission,
  Role,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { expect } from "vitest";
import { startTestApp, type TestApp, unique } from "./test-app.ts";

export const featuresApprover: Permission[] = [
  "features:approve",
  "features:view",
  "people:view",
];
export const peopleApprover: Permission[] = ["people:approve", "people:view"];
export const configurationApprover: Permission[] = [
  "configuration:approve",
  "configuration:view",
  "features:view",
  "people:view",
];

export async function startDeciderTests() {
  const test: TestApp = await startTestApp();
  const featureEditor = await test.signedIn("feature-lead");
  const peopleEditor = await test.signedIn("workforce-administrator");

  // A web link column drafted on a table by one who edits its records.
  async function draftedColumn(table: ColumnTable): Promise<Field> {
    const response = await test.request(
      table === "people" ? peopleEditor.cookie : featureEditor.cookie,
      "POST",
      `/api/${table}/columns`,
      { name: unique("Fictional Link"), type: "link", visibility: "general" },
    );
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ field: Field }>().field;
  }

  // A choice column drafted on Features with a new list made in its dialog.
  async function columnWithNewList(): Promise<Field> {
    const response = await test.request(
      featureEditor.cookie,
      "POST",
      "/api/features/columns",
      {
        name: unique("Fictional Tier"),
        type: "choice",
        newList: {
          name: unique("Fictional Tiers"),
          choices: [{ label: "Fictional Gold" }],
        },
      },
    );
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ field: Field }>().field;
  }

  // A General list drafted on Lists by one who edits configuration.
  async function listMadeOnLists(): Promise<string> {
    const response = await test.request(
      peopleEditor.cookie,
      "POST",
      "/api/lists",
      { name: unique("Fictional Sites"), visibility: "general" },
    );
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ list: { id: string } }>().list.id;
  }

  // A list as one who edits configuration reads it.
  async function listOf(listId: string): Promise<List | undefined> {
    const read = await test.request(peopleEditor.cookie, "GET", "/api/lists");
    return read.json<{ lists: List[] }>().lists.find(({ id }) => id === listId);
  }

  const decide = async (
    permissions: Role | readonly Permission[],
    asking: "approval" | "rejection",
    body: object,
  ) =>
    test.request(
      (await test.signedIn(permissions)).cookie,
      "POST",
      `/api/drafts/${asking}`,
      asking === "rejection" ? { ...body, reason: "Fictional reason" } : body,
    );

  const isLive = async (table: typeof fields | typeof lists, id: string) =>
    (await test.connection.select().from(table).where(eq(table.id, id)))
      .length > 0;

  return {
    test,
    featureEditor,
    peopleEditor,
    draftedColumn,
    columnWithNewList,
    listMadeOnLists,
    listOf,
    decide,
    isLive,
  };
}

export type DeciderTests = Awaited<ReturnType<typeof startDeciderTests>>;
