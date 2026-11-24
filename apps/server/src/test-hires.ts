// SPDX-License-Identifier: Apache-2.0

// Shared setup for the planned hire integration tests: a test app with the users they act as, a
// fixed clock, the hiring states, and helpers that draft, approve, change and read hires through
// the routes.

import { listItems, lists, plannedHires } from "@fathom/db";
import { type Hire, type Hires } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import {
  approvedPerson,
  generalReader,
  ok,
  sender,
  startTestApp,
  type TestApp,
  testPosition,
  type User,
} from "./test-app.ts";

// The server takes today's date from the clock, so the tests fix it, to give the same days on every
// run.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

export let test: TestApp;
// A Workforce Administrator, who changes the hiring plan.
export let editor: User;
// An Approver who sees the hiring plan, so decides hires' drafts.
export let approver: User;
// A reader who sees people, so the hiring plan's placeholders.
export let planner: User;
// The hiring states: Proposed, Open, and Hired, as Fathom starts them, and a second state meaning
// Open.
export let proposed: string;
export let open: string;
export let hired: string;
export let recruiting: string;
// A position no longer offered.
export const retiredPosition = "00000000-0000-4000-8000-00000000f003";

export async function startHireTests(): Promise<void> {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn("engineering-director");
  planner = await test.signedIn(generalReader);
  const states = await test.connection
    .select({ id: listItems.id, label: listItems.label, listId: lists.id })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "hiring-states"));
  proposed = String(
    states.find(({ label }) => label === "Request to hire")?.id,
  );
  open = String(states.find(({ label }) => label === "Approved to hire")?.id);
  hired = String(states.find(({ label }) => label === "Hired")?.id);
  const [added] = await test.connection
    .insert(listItems)
    .values({
      listId: String(states[0]?.listId),
      label: "Fictional Recruiting",
      position: 4,
      meaning: "open",
    })
    .returning({ id: listItems.id });
  recruiting = String(added?.id);
  const [positions] = await test.connection
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.builtIn, "positions"));
  await test.connection.insert(listItems).values({
    id: retiredPosition,
    listId: String(positions?.id),
    label: "Fictional Retired Position",
    position: 3,
    retired: true,
  });
}

export async function closeHireTests(): Promise<void> {
  await test.close();
  vi.useRealTimers();
}

export const send = sender(() => test);

export async function approve(ids: {
  people?: string[];
  plannedHires?: string[];
}) {
  return send(approver, "POST", "/api/drafts/approval", ids);
}

export async function approved(ids: {
  people?: string[];
  plannedHires?: string[];
}) {
  await ok(await approve(ids));
}

// A fictional person, approved so they are live and marked as a manager unless told otherwise.
export const person = (details: object = {}) =>
  approvedPerson(test, editor.cookie, (id) => approved({ people: [id] }), {
    isManager: true,
    ...details,
  });

// The request adding a hire with a temporary ID, the test position, and a target date unless told
// otherwise.
export const hireRequest = (details: object = {}) => ({
  hires: [{ positionId: testPosition, targetDate: "2027-03-15", ...details }],
});

export async function draftHire(
  details: object = {},
  who = editor,
): Promise<{ id: string; changeSetId: string }> {
  const { ids, changeSetId } = await ok<{
    ids: string[];
    changeSetId: string;
  }>(await send(who, "POST", "/api/planned-hires", hireRequest(details)), 201);
  return { id: String(ids[0]), changeSetId };
}

// A planned hire, drafted and approved, so it is live.
export async function liveHire(details: object = {}): Promise<string> {
  const { id } = await draftHire(details);
  await approved({ plannedHires: [id] });
  return id;
}

export async function hiresSeen(who: User): Promise<Hires> {
  return ok(await send(who, "GET", "/api/planned-hires"));
}

export async function hireSeen(
  id: string,
  who = editor,
): Promise<Hire | undefined> {
  return (await hiresSeen(who)).hires.find((hire) => hire.id === id);
}

export const change = (id: string, body: object, who = editor) =>
  send(who, "PATCH", `/api/planned-hires/${id}`, body);

export async function changed(
  id: string,
  body: object,
): Promise<string | null> {
  return (await ok<{ changeSetId: string | null }>(await change(id, body)))
    .changeSetId;
}

export async function liveRow(id: string) {
  const [row] = await test.connection
    .select()
    .from(plannedHires)
    .where(eq(plannedHires.id, id));
  return row;
}
