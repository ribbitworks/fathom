// SPDX-License-Identifier: Apache-2.0

// Shared setup for the data class integration tests: a test app with a classifier who sees both
// classes, and helpers that move data to another class and read the session's classes and the
// moves the access history records.

import { accessHistory, dataClasses } from "@fathom/db";
import { type DataClasses, type Permission } from "@fathom/shared";
import { and, desc, eq } from "drizzle-orm";
import { startTestApp, type TestApp } from "./test-app.ts";

export let test: TestApp;
export let classifier: { id: string; cookie: string };

export const seesBoth: Permission[] = [
  "people:view",
  "personal:view",
  "confidential:view",
];

export async function startDataClassTests(): Promise<void> {
  test = await startTestApp();
  classifier = await test.signedIn("engineering-director");
}

export async function closeDataClassTests(): Promise<void> {
  await test.close();
}

// Puts every built-in detail back in its default class, after each test that moves one.
export async function clearDataClasses(): Promise<void> {
  await test.connection.delete(dataClasses);
}

export const move = (
  url: string,
  dataClass: string,
  cookie: string = classifier.cookie,
) => test.request(cookie, "PUT", url, { dataClass });

export async function sessionClasses(cookie: string): Promise<DataClasses> {
  return (await test.request(cookie, "GET", "/api/session")).json<{
    settings: { dataClasses: DataClasses };
  }>().settings.dataClasses;
}

export async function latestMove(actorId: string) {
  const [entry] = await test.connection
    .select()
    .from(accessHistory)
    .where(
      and(
        eq(accessHistory.actorId, actorId),
        eq(accessHistory.action, "data-class-moved"),
      ),
    )
    .orderBy(desc(accessHistory.id))
    .limit(1);
  return entry;
}
