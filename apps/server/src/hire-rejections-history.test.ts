// SPDX-License-Identifier: Apache-2.0

// Integration tests for who reads a rejected hire draft's reason in the change history: those who
// see the changes it rejected, with the hire's own details judged by the hiring plan.

import { type Choice, type Field, type List } from "@fathom/shared";
import { dataClasses } from "@fathom/db";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { changeEntry, moveClass, ok, unique, type User } from "./test-app.ts";
import {
  approver,
  changed,
  closeHireTests,
  editor,
  liveHire,
  person,
  approved,
  send,
  startHireTests,
  test,
} from "./test-hires.ts";

beforeAll(startHireTests);

afterAll(closeHireTests);

// Puts the hiring plan back in its default class after a test that moves it.
afterEach(async () => {
  await test.connection.delete(dataClasses);
});

async function rejected(id: string): Promise<string> {
  return (
    await ok<{ changeSetId: string }>(
      await send(approver, "POST", "/api/drafts/rejection", {
        plannedHires: [id],
        reason: "Fictional reason",
      }),
    )
  ).changeSetId;
}

const reads = async (who: User, changeSetId: string) =>
  (await changeEntry(test, who.cookie, changeSetId)) !== undefined;

const classify = (url: string, dataClass: string) =>
  moveClass(test, url, dataClass);

it("shows a rejected target date's reason to those who see the hiring plan, in its class now", async () => {
  // Given the hiring plan moved to Personal, and a reader who sees it but not Confidential data
  await classify("/api/data-classes/hiringPlan", "personal");
  const reader = await test.signedIn([
    "people:view",
    "hiring-plan:view",
    "personal:view",
  ]);

  // When a hire's draft changing its target date is rejected
  const id = await liveHire();
  await changed(id, { targetDate: "2027-03-01" });
  const changeSetId = await rejected(id);

  // Then the reader reads the reason
  expect(await reads(reader, changeSetId)).toBe(true);
});

it("hides a rejected hire value's reason once its list has become more sensitive", async () => {
  // Given a hire's draft choosing from a list, rejected, and a reader who sees the hiring plan
  const { list } = await ok<{ list: List }>(
    await send(editor, "POST", "/api/lists", {
      name: unique("Fictional Teams"),
    }),
    201,
  );
  const { choices } = await ok<{ choices: Choice[] }>(
    await send(editor, "POST", `/api/lists/${list.id}/choices`, {
      choices: [{ label: "Fictional Blue" }],
    }),
    201,
  );
  await test.approveLists();
  const { field } = await ok<{ field: Field }>(
    await send(editor, "POST", "/api/people/columns", {
      name: unique("Fictional Team"),
      listId: list.id,
    }),
    201,
  );
  await test.approveLists();
  const id = await liveHire();
  await changed(id, { values: { [field.id]: choices.map(({ id }) => id) } });
  const changeSetId = await rejected(id);
  const reader = await test.signedIn([
    "people:view",
    "hiring-plan:view",
    "confidential:view",
  ]);
  expect(await reads(reader, changeSetId)).toBe(true);

  // When the list moves to Personal
  await classify(`/api/lists/${list.id}/class`, "personal");

  // Then the reader, who doesn't see Personal data, no longer reads the reason
  expect(await reads(reader, changeSetId)).toBe(false);
});

it("hides a rejection naming a manager who has since left from readers who do not see Personal details", async () => {
  // Given a hire's draft naming a current manager, rejected, and a reader who sees the hiring plan
  // but not when people start and leave
  const manager = await person();
  const id = await liveHire();
  await changed(id, { managerId: manager });
  const changeSetId = await rejected(id);
  const reader = await test.signedIn([
    "people:view",
    "hiring-plan:view",
    "confidential:view",
  ]);
  expect(await reads(reader, changeSetId)).toBe(true);

  // When the manager leaves
  expect(
    (
      await send(editor, "PATCH", `/api/people/${manager}`, {
        endDate: "2021-01-01",
      })
    ).statusCode,
  ).toBe(200);
  await approved({ people: [manager] });

  // Then the rejection, whose reason may name them, is hidden from the reader
  expect(await reads(reader, changeSetId)).toBe(false);
});
