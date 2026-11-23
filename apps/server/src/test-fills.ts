// SPDX-License-Identifier: Apache-2.0

// Shared setup for the fill integration tests: a test app with the users they act as, the hiring
// states, and helpers that make people and hires, fill hires, and read the rows a fill makes through
// the routes.

import { listItems, lists, people, plannedHires } from "@fathom/db";
import { type Hire, type Person } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { expect } from "vitest";
import { startTestApp, type TestApp, testPosition } from "./test-app.ts";

export interface User {
  id: string;
  cookie: string;
}

export let test: TestApp;
// A Workforce Administrator, who changes people and the hiring plan.
export let editor: User;
// An Engineering Director, who approves drafts of people and planned hires and sees Personal data.
let approver: User;
export let proposed: string;
export let open: string;

export async function startFillTests(): Promise<void> {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn("engineering-director");
  const states = await test.connection
    .select({ id: listItems.id, label: listItems.label })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "hiring-states"));
  proposed = String(
    states.find(({ label }) => label === "Request to hire")?.id,
  );
  open = String(states.find(({ label }) => label === "Approved to hire")?.id);
}

export async function closeFillTests(): Promise<void> {
  await test.close();
}

export let count = 0;

// A name or ID no other test uses, so tests sharing the database do not collide.
export function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

export const send = (
  who: User,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: object,
  options?: { publish?: boolean },
) => test.request(who.cookie, method, url, payload, options);

export async function ok<T>(
  response: Awaited<ReturnType<typeof send>>,
  status = 200,
): Promise<T> {
  expect(response.statusCode, response.body).toBe(status);
  return Promise.resolve(response.json<T>());
}

export const partOfFill =
  "This is part of filling a planned hire; discard the fill to change it";

export const refusal = (response: Awaited<ReturnType<typeof send>>) =>
  response.json<{ error: string }>().error;

type Records = { people?: string[]; plannedHires?: string[] };

export const approve = (ids: Records, who = approver) =>
  send(who, "POST", "/api/drafts/approval", ids);

export async function approved(ids: Records) {
  await ok(await approve(ids));
}

export const reject = (ids: Records) =>
  send(approver, "POST", "/api/drafts/rejection", {
    ...ids,
    reason: "Fictional reason",
  });

// A fictional person, approved so they are live, started in 2020 and marked as a manager unless
// told otherwise.
export async function person(details: object = {}): Promise<string> {
  const { ids } = await ok<{ ids: string[] }>(
    await send(editor, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("FP"),
          positionId: testPosition,
          startDate: "2020-01-01",
          isManager: true,
          ...details,
        },
      ],
    }),
    201,
  );
  const id = String(ids[0]);
  await approved({ people: [id] });
  return id;
}

// A live planned hire, approved to hire, with a target date, unless told otherwise.
export async function hire(details: object = {}): Promise<string> {
  const { ids } = await ok<{ ids: string[] }>(
    await send(editor, "POST", "/api/planned-hires", {
      hires: [
        {
          positionId: testPosition,
          targetDate: "2099-03-15",
          stateId: open,
          ...details,
        },
      ],
    }),
    201,
  );
  const id = String(ids[0]);
  await approved({ plannedHires: [id] });
  return id;
}

export const fill = (
  id: string,
  body: object,
  who = editor,
  options?: { publish?: boolean },
) => send(who, "POST", `/api/planned-hires/${id}/fill`, body, options);

export const newPerson = (details: object = {}) => ({
  by: "new person",
  preferredName: unique("Fictional Starter"),
  employeeId: unique("FS"),
  startDate: "2099-04-01",
  ...details,
});

export const existing = (personId: string, details: object = {}) => ({
  by: "existing person",
  personId,
  ...details,
});

export async function filled(id: string, body: object): Promise<string> {
  const { changeSetId } = await ok<{ changeSetId: string }>(
    await fill(id, body),
  );
  return changeSetId;
}

async function peopleSeen(who = editor): Promise<Person[]> {
  return (await ok<{ people: Person[] }>(await send(who, "GET", "/api/people")))
    .people;
}

export async function rowOf(
  id: string,
  who = editor,
): Promise<Person | undefined> {
  return (await peopleSeen(who)).find((row) => row.id === id);
}

export async function rowNamed(name: string): Promise<Person | undefined> {
  return (await peopleSeen()).find((row) => row.preferredName === name);
}

export async function hireOf(id: string): Promise<Hire | undefined> {
  const { hires } = await ok<{ hires: Hire[] }>(
    await send(editor, "GET", "/api/planned-hires"),
  );
  return hires.find((one) => one.id === id);
}

export async function liveHire(id: string) {
  const [row] = await test.connection
    .select()
    .from(plannedHires)
    .where(eq(plannedHires.id, id));
  return row;
}

export async function livePerson(name: string) {
  const [row] = await test.connection
    .select()
    .from(people)
    .where(eq(people.preferredName, name));
  return row;
}
