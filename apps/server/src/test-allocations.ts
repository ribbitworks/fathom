// SPDX-License-Identifier: Apache-2.0

// Shared setup for the allocation integration tests: a test app with the accounts they act as, and
// helpers that add people, planned hires, features and allocations to activities, and change, read and decide allocations
// through the routes.

import {
  activities,
  allocations,
  features,
  people,
  plannedHires,
  projects,
  recordChanges,
} from "@fathom/db";
import {
  addToMonth,
  type Allocation,
  type Allocations,
  type Meaning,
  monthOf,
  type Role,
  startingRoles,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { readToday } from "./data/settings.ts";
import {
  generalReader,
  builtInChoice,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

export let test: TestApp;
let today: string;
let current: string;
export type Account = { id: string; cookie: string };
// Allocations need Personal details, so every account here sees them. The allocator and the
// Engineering Manager edit allocations, the Director and the Project Manager approve them, and the
// viewer only sees them.
export let allocator: Account;
export let manager: Account;
export let director: Account;
export let projectManager: Account;
export let viewer: Account;

const withPersonal = (role: Role) =>
  test.signedIn([
    ...new Set([
      // The role is always one of the fixed roles.
      // eslint-disable-next-line security/detect-object-injection
      ...startingRoles[role].permissions,
      "people:view" as const,
      "personal:view" as const,
    ]),
  ]);

export const month = (offset: number) => addToMonth(current, offset);

export async function startAllocationTests(): Promise<void> {
  test = await startTestApp();
  today = await readToday(test.connection);
  current = monthOf(today);
  allocator = await test.signedIn([...generalReader, "personal:view"]);
  manager = await test.signedIn("engineering-manager");
  director = await test.signedIn("engineering-director");
  projectManager = await test.signedIn("project-manager");
  viewer = await withPersonal("team-member");
}

export async function closeAllocationTests(): Promise<void> {
  await test.close();
}

export const dayIn = (offset: number) => `${month(offset)}-15`;

// Records a name as Fathom does when a record is added, so the change history names it.
const named = (
  recordType: string,
  recordId: string,
  field: string,
  name: string,
) =>
  recordChanges(test.connection, null, [
    {
      recordType,
      recordId,
      action: "created",
      field,
      tier: "general",
      oldValue: null,
      newValue: name,
    },
  ]);

export const nameOfFeature = async (featureId: string) =>
  String(
    (
      await test.connection
        .select({ name: features.name })
        .from(features)
        .where(eq(features.id, featureId))
    )[0]?.name,
  );

export async function addPerson(
  dates: { startDate?: string | null; endDate?: string | null } = {},
): Promise<string> {
  const id = randomUUID();
  const preferredName = unique("Fictional Person");
  await named("person", id, "preferredName", preferredName);
  await test.connection.insert(people).values({
    id,
    preferredName,
    employeeId: unique("ALLOC"),
    positionId: testPosition,
    startDate: dates.startDate ?? dayIn(-24),
    endDate: dates.endDate ?? null,
  });
  return id;
}

export let hireNumber = 950_000;

export async function addHire(
  details: { targetDate?: string | null; filledBy?: string } = {},
): Promise<string> {
  const id = randomUUID();
  hireNumber += 1;
  await test.connection.insert(plannedHires).values({
    id,
    temporaryNumber: hireNumber,
    positionId: testPosition,
    stateId: await builtInChoice(test.connection, "hiring-states", "open"),
    targetDate: details.targetDate ?? null,
    filledBy: details.filledBy ?? null,
  });
  return id;
}

export async function addFeature(
  meaning: Meaning = "in-progress",
): Promise<string> {
  const id = randomUUID();
  const name = unique("Fictional Feature");
  await named("feature", id, "name", name);
  await test.connection.insert(features).values({
    id,
    name,
    statusId: await builtInChoice(test.connection, "feature-statuses", meaning),
  });
  return id;
}

// A person allocated to a project's activity, added directly, since activities aren't drafted yet.
export async function activityAllocation(): Promise<{
  personId: string;
  id: string;
  activityId: string;
}> {
  const personId = await addPerson();
  const projectId = randomUUID();
  await test.connection
    .insert(projects)
    .values({ id: projectId, name: unique("Fictional Project") });
  const [activity] = await test.connection
    .insert(activities)
    .values({
      projectId,
      name: "Fictional Activity",
      statusId: await builtInChoice(
        test.connection,
        "feature-statuses",
        "in-progress",
      ),
    })
    .returning({ id: activities.id });
  const id = randomUUID();
  await test.connection.insert(allocations).values({
    id,
    personId,
    activityId: activity?.id,
    months: { [month(0)]: 50 },
  });
  return { personId, id, activityId: String(activity?.id) };
}

type Change = {
  personId?: string;
  plannedHireId?: string;
  featureId: string;
  percentage: number | null;
  from: string;
  to?: string;
};

export const change = (body: Change, who = allocator, publish = true) =>
  test.request(who.cookie, "POST", "/api/allocations/changes", body, {
    publish,
  });

export async function changed(body: Change, who = allocator): Promise<void> {
  const response = await change(body, who);
  expect(response.statusCode, response.body).toBe(200);
}

export async function read(who = allocator): Promise<Allocations> {
  const response = await test.request(who.cookie, "GET", "/api/allocations");
  expect(response.statusCode).toBe(200);
  return response.json<Allocations>();
}

export async function allocationOf(
  assignee: { personId?: string; plannedHireId?: string },
  featureId: string,
  who = allocator,
): Promise<Allocation | undefined> {
  return (await read(who)).allocations.find(
    (allocation) =>
      allocation.featureId === featureId &&
      (assignee.personId === undefined
        ? allocation.plannedHireId === assignee.plannedHireId
        : allocation.personId === assignee.personId),
  );
}

export const decide = (
  who: Account,
  asking: "approval" | "rejection",
  ids: readonly string[],
) =>
  test.request(who.cookie, "POST", `/api/drafts/${asking}`, {
    records: ids.map((id) => ({ type: "allocation", id })),
    ...(asking === "rejection" ? { reason: "Fictional reason" } : {}),
  });

export async function approved(...ids: string[]): Promise<void> {
  const response = await decide(director, "approval", ids);
  expect(response.statusCode, response.body).toBe(200);
}

// An allocation, approved, of a new person on a new feature, from a month with no end.
export async function liveAllocation(
  months: { from: number; to?: number; percentage?: number } = { from: 0 },
): Promise<{ personId: string; featureId: string; id: string }> {
  const personId = await addPerson();
  const featureId = await addFeature();
  await changed({
    personId,
    featureId,
    percentage: months.percentage ?? 50,
    from: month(months.from),
    ...(months.to === undefined ? {} : { to: month(months.to) }),
  });
  const id = String((await allocationOf({ personId }, featureId))?.id);
  await approved(id);
  return { personId, featureId, id };
}
