// SPDX-License-Identifier: Apache-2.0

// Tests for allocations, against a PostgreSQL server of their own: changing one as a draft from a
// month, the people, planned hires, and features that can be allocated and when, reading them as
// each reader may, approving and rejecting them, removing what they name, and the change history.

import {
  accessHistory,
  featureTeams,
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
  type ChangeHistory,
  type Meaning,
  monthOf,
  type ProjectPlan,
  type Role,
  startingRoles,
} from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readToday } from "./data/settings.ts";
import {
  generalApprover,
  generalReader,
  builtInChoice,
  errorOf,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

let test: TestApp;
let today: string;
let current: string;
type Account = { id: string; cookie: string };
// Allocations need Personal details, so every account here sees them. The allocator and the
// Engineering Manager edit allocations, the Director and the Project Manager approve them, and the
// viewer only sees them.
let allocator: Account;
let manager: Account;
let director: Account;
let projectManager: Account;
let viewer: Account;

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

const month = (offset: number) => addToMonth(current, offset);

beforeAll(async () => {
  test = await startTestApp();
  today = await readToday(test.connection);
  current = monthOf(today);
  allocator = await test.signedIn([...generalReader, "personal:view"]);
  manager = await test.signedIn("engineering-manager");
  director = await test.signedIn("engineering-director");
  projectManager = await test.signedIn("project-manager");
  viewer = await withPersonal("team-member");
});

afterAll(async () => {
  await test.close();
});

const dayIn = (offset: number) => `${month(offset)}-15`;

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

const nameOfFeature = async (featureId: string) =>
  String(
    (
      await test.connection
        .select({ name: features.name })
        .from(features)
        .where(eq(features.id, featureId))
    )[0]?.name,
  );

async function addPerson(
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

let hireNumber = 950_000;

async function addHire(
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

async function addFeature(meaning: Meaning = "in-progress"): Promise<string> {
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

async function addGeneralFeature(): Promise<{
  projectId: string;
  featureId: string;
}> {
  const projectId = randomUUID();
  const featureId = randomUUID();
  const name = unique("Fictional Project");
  await named("project", projectId, "name", name);
  await test.connection.insert(projects).values({ id: projectId, name });
  await test.connection.insert(features).values({
    id: featureId,
    statusId: await builtInChoice(
      test.connection,
      "feature-statuses",
      "in-progress",
    ),
    generalForProjectId: projectId,
  });
  return { projectId, featureId };
}

type Change = {
  personId?: string;
  plannedHireId?: string;
  featureId: string;
  percentage: number | null;
  from: string;
  to?: string;
};

const change = (body: Change, who = allocator, publish = true) =>
  test.request(who.cookie, "POST", "/api/allocations/changes", body, {
    publish,
  });

async function changed(body: Change, who = allocator): Promise<void> {
  const response = await change(body, who);
  expect(response.statusCode, response.body).toBe(200);
}

async function read(who = allocator): Promise<Allocations> {
  const response = await test.request(who.cookie, "GET", "/api/allocations");
  expect(response.statusCode).toBe(200);
  return response.json<Allocations>();
}

async function allocationOf(
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

const decide = (
  who: Account,
  asking: "approval" | "rejection",
  ids: readonly string[],
) =>
  test.request(who.cookie, "POST", `/api/drafts/${asking}`, {
    records: ids.map((id) => ({ type: "allocation", id })),
    ...(asking === "rejection" ? { reason: "Fictional reason" } : {}),
  });

async function approved(...ids: string[]): Promise<void> {
  const response = await decide(director, "approval", ids);
  expect(response.statusCode, response.body).toBe(200);
}

// An allocation, approved, of a new person on a new feature, from a month with no end.
async function liveAllocation(
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

describe("allocating", () => {
  it("refuses in words to stop an allocation that was never made", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();

    const response = await change({
      personId,
      featureId,
      percentage: null,
      from: month(0),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "There is no allocation to stop on that feature",
    });
  });

  it("saves a range as a draft of its first month and the month it stops, live once approved", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({
      personId,
      featureId,
      percentage: 50,
      from: month(1),
      to: month(3),
    });
    const drafted = await allocationOf({ personId }, featureId);
    expect(drafted?.months).toEqual({});
    expect(drafted?.draft).toMatchObject({
      action: "created",
      state: "waiting",
      months: { [month(1)]: 50, [month(4)]: null },
    });
    await approved(String(drafted?.id));
    const live = await allocationOf({ personId }, featureId);
    expect(live?.months).toEqual({ [month(1)]: 50, [month(4)]: null });
    expect(live?.draft).toBeUndefined();
  });

  it("keeps the months around one month changed within a range, in the allocation's one draft", async () => {
    const { personId, featureId, id } = await liveAllocation({
      from: 0,
      to: 5,
    });
    await changed({
      personId,
      featureId,
      percentage: 100,
      from: month(2),
      to: month(2),
    });
    await changed({
      personId,
      featureId,
      percentage: 25,
      from: month(4),
      to: month(4),
    });
    const allocations = (await read()).allocations.filter(
      (allocation) =>
        allocation.personId === personId && allocation.featureId === featureId,
    );
    expect(allocations.map((allocation) => allocation.id)).toEqual([id]);
    expect(allocations[0]?.draft).toMatchObject({
      action: "changed",
      months: {
        [month(0)]: 50,
        [month(2)]: 100,
        [month(3)]: 50,
        [month(4)]: 25,
        [month(5)]: 50,
        [month(6)]: null,
      },
    });
  });

  it("drafts removing an allocation a change leaves with no months, which can be allocated again", async () => {
    const { personId, featureId, id } = await liveAllocation({
      from: 0,
      to: 1,
    });
    const stop = {
      personId,
      featureId,
      percentage: null,
      from: month(0),
      to: month(1),
    };
    await changed(stop);
    expect((await allocationOf({ personId }, featureId))?.draft?.action).toBe(
      "deleted",
    );
    await changed({ ...stop, percentage: 75 });
    expect((await allocationOf({ personId }, featureId))?.draft).toMatchObject({
      action: "changed",
      months: { [month(0)]: 75, [month(2)]: null },
    });
    await changed(stop);
    await approved(id);
    expect(await allocationOf({ personId }, featureId)).toBeUndefined();
  });

  it("takes away an allocation only drafted to be added once a change leaves it no months", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    await changed({ personId, featureId, percentage: null, from: month(0) });
    expect(await allocationOf({ personId }, featureId)).toBeUndefined();
  });

  it("allocates a planned hire from the month it is expected", async () => {
    const plannedHireId = await addHire({ targetDate: dayIn(2) });
    const featureId = await addFeature();
    const early = await change({
      plannedHireId,
      featureId,
      percentage: 100,
      from: month(1),
    });
    expect(early.statusCode).toBe(400);
    expect(errorOf(early)).toBe(
      `This planned hire is expected in ${month(2)}. Choose a first month from then on.`,
    );
    await changed({
      plannedHireId,
      featureId,
      percentage: 100,
      from: month(2),
    });
    expect(
      (await allocationOf({ plannedHireId }, featureId))?.draft?.months,
    ).toEqual({ [month(2)]: 100 });
  });

  it("expects a planned hire with no target date from the current month", async () => {
    const plannedHireId = await addHire();
    const featureId = await addFeature();
    const early = await change({
      plannedHireId,
      featureId,
      percentage: 100,
      from: month(-1),
    });
    expect(early.statusCode).toBe(400);
    await changed({
      plannedHireId,
      featureId,
      percentage: 100,
      from: month(0),
    });
  });

  it("refuses a planned hire that has been filled", async () => {
    const plannedHireId = await addHire({ filledBy: await addPerson() });
    const response = await change({
      plannedHireId,
      featureId: await addFeature(),
      percentage: 50,
      from: month(0),
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe("This planned hire can't be allocated yet");
  });

  it("refuses filling a planned hire with allocations, which filling can't move yet", async () => {
    const plannedHireId = await addHire();
    await changed({
      plannedHireId,
      featureId: await addFeature(),
      percentage: 50,
      from: month(0),
    });
    const response = await test.request(
      director.cookie,
      "POST",
      `/api/planned-hires/${plannedHireId}/fill`,
      { by: "existing person", personId: await addPerson() },
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This planned hire has allocations, which filling it can't move yet. Remove them first.",
    );
  });

  it("refuses approving a fill once the planned hire has been allocated", async () => {
    const plannedHireId = await addHire();
    const filling = await test.request(
      director.cookie,
      "POST",
      `/api/planned-hires/${plannedHireId}/fill`,
      { by: "existing person", personId: await addPerson() },
    );
    expect(filling.statusCode, filling.body).toBe(200);
    await changed({
      plannedHireId,
      featureId: await addFeature(),
      percentage: 50,
      from: month(0),
    });
    const response = await test.request(
      director.cookie,
      "POST",
      "/api/drafts/approval",
      { plannedHires: [plannedHireId] },
    );
    expect(response.statusCode).toBe(409);
  });

  it.each([
    ["person", { personId: randomUUID() }],
    ["planned hire", { plannedHireId: randomUUID() }],
  ])("refuses a %s who does not exist", async (_, assignee) => {
    const response = await change({
      ...assignee,
      featureId: await addFeature(),
      percentage: 50,
      from: month(0),
    });
    expect(response.statusCode).toBe(404);
    expect(errorOf(response)).toBe("Choose someone from People");
  });

  it("refuses a feature that does not exist", async () => {
    const response = await change({
      personId: await addPerson(),
      featureId: randomUUID(),
      percentage: 50,
      from: month(0),
    });
    expect(response.statusCode).toBe(404);
  });

  it("refuses a feature only drafted to be added", async () => {
    const name = unique("Fictional Feature");
    const response = await test.request(
      director.cookie,
      "POST",
      "/api/features",
      {
        name,
      },
    );
    expect(response.statusCode, response.body).toBe(201);
    const drafted = response
      .json<{ plan: { features: { id: string; name: string }[] } }>()
      .plan.features.find((feature) => feature.name === name);
    const refused = await change({
      personId: await addPerson(),
      featureId: String(drafted?.id),
      percentage: 50,
      from: month(0),
    });
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      "This feature is waiting for approval. Allocate people to it once it's approved.",
    );
  });

  it("refuses changing an allocation someone else holds", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    expect(
      (
        await change(
          { personId, featureId, percentage: 50, from: month(0) },
          manager,
          false,
        )
      ).statusCode,
    ).toBe(200);
    const refused = await change({
      personId,
      featureId,
      percentage: 25,
      from: month(0),
    });
    expect(refused.statusCode).toBe(409);
    await test.request(manager.cookie, "POST", "/api/unpublished/discard");
  });
});

describe("unpublished changes", () => {
  it("are seen as drafts only by their maker, and named by their feature", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    const general = await addGeneralFeature();
    for (const each of [featureId, general.featureId]) {
      expect(
        (
          await change(
            { personId, featureId: each, percentage: 50, from: month(0) },
            manager,
            false,
          )
        ).statusCode,
      ).toBe(200);
    }
    expect(
      (await allocationOf({ personId }, featureId, manager))?.draft
        ?.unpublished,
    ).toBe(true);
    expect(await allocationOf({ personId }, featureId)).toBeUndefined();
    const [feature] = await test.connection
      .select({ name: features.name })
      .from(features)
      .where(eq(features.id, featureId));
    const [project] = await test.connection
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, general.projectId));
    const listed = await test.request(
      manager.cookie,
      "GET",
      "/api/unpublished",
    );
    expect(
      listed
        .json<{ changes: { subject: string }[] }>()
        .changes.map(({ subject }) => subject)
        .sort(),
    ).toEqual(
      [
        `an allocation to the feature ${String(feature?.name)}`,
        `an allocation to the project ${String(project?.name)}`,
      ].sort(),
    );
    await test.request(manager.cookie, "POST", "/api/unpublished/discard");
  });
});

describe("employment dates", () => {
  it("refuses, to an editor who sees Personal details, months before someone's start", async () => {
    const personId = await addPerson({ startDate: dayIn(2) });
    const response = await change(
      {
        personId,
        featureId: await addFeature(),
        percentage: 50,
        from: month(1),
      },
      manager,
    );
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      `This person starts in ${month(2)}. Choose a first month from then on.`,
    );
  });

  it("refuses, to an editor who sees Personal details, months after someone's end, and no end", async () => {
    const personId = await addPerson({ endDate: dayIn(3) });
    const featureId = await addFeature();
    const ongoing = await change(
      { personId, featureId, percentage: 50, from: month(0) },
      manager,
    );
    expect(ongoing.statusCode).toBe(400);
    expect(errorOf(ongoing)).toBe(
      `This person's last month is ${month(3)}. Choose a last month by then.`,
    );
    await changed(
      { personId, featureId, percentage: 50, from: month(0), to: month(3) },
      manager,
    );
  });

  it("refuses, to any editor, months after an end date that has passed", async () => {
    const personId = await addPerson({ endDate: dayIn(-2) });
    const response = await change({
      personId,
      featureId: await addFeature(),
      percentage: 50,
      from: month(-1),
    });
    expect(response.statusCode).toBe(400);
  });

  it("lets a stop be drafted outside someone's employment", async () => {
    const { personId, featureId } = await liveAllocation({ from: 0 });
    await test.connection
      .update(people)
      .set({ endDate: dayIn(2) })
      .where(eq(people.id, personId));
    await changed(
      { personId, featureId, percentage: null, from: month(3) },
      manager,
    );
  });
});

describe("reading", () => {
  it("names each feature allocated, a general feature by its project, with its status's meaning", async () => {
    const personId = await addPerson();
    const possible = await addFeature("possible");
    const general = await addGeneralFeature();
    await changed({
      personId,
      featureId: possible,
      percentage: 25,
      from: month(0),
    });
    await changed({
      personId,
      featureId: general.featureId,
      percentage: 50,
      from: month(0),
    });
    const { features: named } = await read(viewer);
    expect(named.find(({ id }) => id === possible)?.meaning).toBe("possible");
    const [project] = await test.connection
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, general.projectId));
    expect(named.find(({ id }) => id === general.featureId)).toEqual({
      id: general.featureId,
      name: project?.name,
      meaning: "in-progress",
      colour: null,
    });
  });

  // A feature of a teal team, and one of no team, each allocated.
  async function tealAndTeamless(): Promise<[string, string]> {
    const personId = await addPerson();
    const [team] = await test.connection
      .insert(featureTeams)
      .values({ name: unique("Fictional Team"), colour: "teal" })
      .returning({ id: featureTeams.id });
    const teamed = await addFeature();
    await test.connection
      .update(features)
      .set({ featureTeamId: team?.id })
      .where(eq(features.id, teamed));
    const teamless = await addFeature();
    for (const featureId of [teamed, teamless]) {
      await changed({ personId, featureId, percentage: 50, from: month(0) });
    }
    return [teamed, teamless];
  }

  const coloursFor = async (
    who: Awaited<ReturnType<typeof test.signedIn>>,
    ids: readonly string[],
  ) => {
    const { features: named } = await read(who);
    return ids.map((id) => named.find((feature) => feature.id === id)?.colour);
  };

  it("gives each feature its feature team's colour, to a role that sees feature teams", async () => {
    const ids = await tealAndTeamless();
    expect(await coloursFor(viewer, ids)).toEqual(["teal", null]);
  });

  it("gives no feature a colour for a role that doesn't see feature teams", async () => {
    // Given a role that reads allocations and Personal details, but not feature teams
    const ids = await tealAndTeamless();
    const noTeams = await test.signedIn(["allocations:view", "personal:view"]);

    // Then neither feature has a colour
    expect(await coloursFor(noTeams, ids)).toEqual([null, null]);
  });

  it("shows someone who has not started, recording a view of Personal details", async () => {
    const personId = await addPerson({ startDate: dayIn(2) });
    const featureId = await addFeature();
    await changed(
      { personId, featureId, percentage: 50, from: month(2) },
      manager,
    );
    expect(await allocationOf({ personId }, featureId, manager)).toBeDefined();
    expect(
      await test.connection
        .select({ id: accessHistory.id })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, manager.id),
            eq(accessHistory.action, "personal-viewed"),
          ),
        ),
    ).not.toEqual([]);
  });
});

describe("approving", () => {
  it("needs Approve allocations, not Approve plan", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    const planApprover = await test.signedIn("product-manager");
    const response = await decide(planApprover, "approval", [id]);
    expect(response.statusCode).toBe(403);
    expect((await decide(projectManager, "approval", [id])).statusCode).toBe(
      200,
    );
  });

  it("refuses, to an Approver who sees Personal details, a draft past someone's end", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    await test.connection
      .update(people)
      .set({ endDate: dayIn(2) })
      .where(eq(people.id, personId));
    const name = (
      await test.connection
        .select({ name: people.preferredName })
        .from(people)
        .where(eq(people.id, personId))
    )[0]?.name;
    const refused = await decide(director, "approval", [id]);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The draft of ${String(name)} on ${await nameOfFeature(featureId)} runs past their last month, ${month(2)}. Reject the draft so it can be changed.`,
    );
  });

  it("refuses a person's draft starting before their first month", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    const [person] = await test.connection
      .update(people)
      .set({ startDate: dayIn(2) })
      .where(eq(people.id, personId))
      .returning({ name: people.preferredName });
    const refused = await decide(director, "approval", [id]);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The draft of ${String(person?.name)} on ${await nameOfFeature(featureId)} starts before their first month, ${month(2)}. Reject the draft so it can be changed.`,
    );
  });

  it("refuses a planned hire's draft starting before the month it is expected", async () => {
    const plannedHireId = await addHire({ targetDate: dayIn(1) });
    const featureId = await addFeature();
    await changed({ plannedHireId, featureId, percentage: 50, from: month(1) });
    const id = String((await allocationOf({ plannedHireId }, featureId))?.id);
    await test.connection
      .update(plannedHires)
      .set({ targetDate: dayIn(3) })
      .where(eq(plannedHires.id, plannedHireId));
    const refused = await decide(projectManager, "approval", [id]);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The draft of TBD-${String(hireNumber)} on ${await nameOfFeature(featureId)} starts before ${month(3)}, the month they're expected. Reject the draft so it can be changed.`,
    );
  });

  it("refuses a planned hire's draft once the hire is filled", async () => {
    const plannedHireId = await addHire();
    const featureId = await addFeature();
    await changed({ plannedHireId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ plannedHireId }, featureId))?.id);
    await test.connection
      .update(plannedHires)
      .set({ filledBy: await addPerson() })
      .where(eq(plannedHires.id, plannedHireId));
    const refused = await decide(projectManager, "approval", [id]);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe("This planned hire can't be allocated yet");
  });

  it("refuses a draft that no longer exists", async () => {
    expect(
      (await decide(director, "approval", [randomUUID()])).statusCode,
    ).toBe(404);
  });

  it("refuses reading, changing and deciding allocations, saying why, to roles that do not see Personal details", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    const why = "Allocations needs Personal access.";
    const reader = await test.signedIn("team-member");
    const read = await test.request(reader.cookie, "GET", "/api/allocations");
    expect(read.statusCode).toBe(403);
    expect(errorOf(read)).toBe(why);
    const editor = await test.signedIn(generalReader);
    const edited = await change(
      { personId, featureId, percentage: 25, from: month(0) },
      editor,
    );
    expect(edited.statusCode).toBe(403);
    expect(errorOf(edited)).toBe(why);
    const approver = await test.signedIn(generalApprover);
    const decided = await decide(approver, "approval", [id]);
    expect(decided.statusCode).toBe(403);
    expect(errorOf(decided)).toBe(why);
  });

  it("rejects a draft, which keeps its months and says why", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    expect((await decide(director, "rejection", [id])).statusCode).toBe(200);
    expect((await allocationOf({ personId }, featureId))?.draft).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
  });

  it("can be discarded by its editor", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ personId }, featureId))?.id);
    const response = await test.request(
      allocator.cookie,
      "DELETE",
      `/api/records/allocation/${id}/draft`,
    );
    expect(response.statusCode).toBe(200);
    expect(await allocationOf({ personId }, featureId)).toBeUndefined();
  });
});

describe("a feature's staffing on the plan", () => {
  // Seen by everyone who sees features, though the allocations themselves aren't.
  const staffingOf = async (
    featureId: string,
    who: Account,
  ): Promise<[boolean, boolean]> => {
    const response = await test.request(who.cookie, "GET", "/api/projects");
    expect(response.statusCode).toBe(200);
    const feature = response
      .json<ProjectPlan>()
      .features.find(({ id }) => id === featureId);
    return [Boolean(feature?.staffed), Boolean(feature?.staffedLive)];
  };

  it("is not staffed with no allocation, to a role that doesn't see allocations", async () => {
    const featureLead = await test.signedIn("feature-lead");
    const featureId = await addFeature();
    expect(await staffingOf(featureId, featureLead)).toEqual([false, false]);
  });

  it("is staffed as drafted while an allocation's draft waits, and live once approved", async () => {
    const featureLead = await test.signedIn("feature-lead");
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    expect(await staffingOf(featureId, featureLead)).toEqual([true, false]);
    const id = String((await allocationOf({ personId }, featureId))?.id);
    expect((await decide(projectManager, "approval", [id])).statusCode).toBe(
      200,
    );
    expect(await staffingOf(featureId, featureLead)).toEqual([true, true]);
  });

  it("is staffed only to its maker while the change is unpublished", async () => {
    const featureLead = await test.signedIn("feature-lead");
    const personId = await addPerson();
    const featureId = await addFeature();
    const response = await change(
      { personId, featureId, percentage: 50, from: month(0) },
      allocator,
      false,
    );
    expect(response.statusCode).toBe(200);
    expect(await staffingOf(featureId, allocator)).toEqual([true, false]);
    expect(await staffingOf(featureId, featureLead)).toEqual([false, false]);
  });

  it("is not staffed by an allocation drafted to stop from its first month", async () => {
    const featureLead = await test.signedIn("feature-lead");
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    await changed({ personId, featureId, percentage: null, from: month(0) });
    expect(await staffingOf(featureId, featureLead)).toEqual([false, false]);
  });
});

describe("removing what allocations name", () => {
  it("refuses removing a feature with allocations, and says to cancel it", async () => {
    const { featureId } = await liveAllocation();
    const response = await test.request(
      director.cookie,
      "DELETE",
      `/api/features/${featureId}`,
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toMatch(
      /^The feature Fictional Feature \d+ has allocations, so it can't be removed\. Allocations are time spent, so cancel the feature instead\.$/,
    );
  });

  it("leaves out how many allocations a feature has, since some can be of people not shown", async () => {
    const { featureId } = await liveAllocation();
    await changed(
      {
        personId: await addPerson({ startDate: dayIn(2) }),
        featureId,
        percentage: 25,
        from: month(2),
      },
      manager,
    );
    const response = await test.request(
      director.cookie,
      "DELETE",
      `/api/features/${featureId}`,
    );
    expect(errorOf(response)).toMatch(
      / has allocations, so it can't be removed\./,
    );
  });

  it("refuses removing a project whose general feature has allocations", async () => {
    const general = await addGeneralFeature();
    const personId = await addPerson();
    await changed({
      personId,
      featureId: general.featureId,
      percentage: 50,
      from: month(0),
    });
    const response = await test.request(
      director.cookie,
      "DELETE",
      `/api/projects/${general.projectId}`,
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toMatch(
      /has allocations, so it can't be removed\. Allocations are time spent, so the project stays\.$/,
    );
  });

  it("refuses allocating to a project's general feature once the project is drafted to be removed", async () => {
    const general = await addGeneralFeature();
    const removing = await test.request(
      director.cookie,
      "DELETE",
      `/api/projects/${general.projectId}`,
    );
    expect(removing.statusCode, removing.body).toBe(200);
    const refused = await change({
      personId: await addPerson(),
      featureId: general.featureId,
      percentage: 50,
      from: month(0),
    });
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toMatch(
      /^This links to the project Fictional Project \d+, which is drafted to be removed; discard that draft first$/,
    );
  });

  it("names no project drafted to be removed to a role that can't see the plan", async () => {
    const general = await addGeneralFeature();
    const removing = await test.request(
      director.cookie,
      "DELETE",
      `/api/projects/${general.projectId}`,
    );
    expect(removing.statusCode, removing.body).toBe(200);
    const allocating = await test.signedIn([
      "allocations:edit",
      "features:view",
      "feature-teams:view",
      "people:view",
      "personal:view",
      "confidential:view",
    ]);
    const refused = await change(
      {
        personId: await addPerson(),
        featureId: general.featureId,
        percentage: 50,
        from: month(0),
      },
      allocating,
    );
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      "This links to a project, which is drafted to be removed; discard that draft first",
    );
  });

  it("refuses allocating to a project's general feature while another holds the project's removal", async () => {
    const general = await addGeneralFeature();
    const removing = await test.request(
      director.cookie,
      "DELETE",
      `/api/projects/${general.projectId}`,
      undefined,
      { publish: false },
    );
    expect(removing.statusCode, removing.body).toBe(200);
    const refused = await change({
      personId: await addPerson(),
      featureId: general.featureId,
      percentage: 50,
      from: month(0),
    });
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toMatch(/has not yet published/);
    await test.request(director.cookie, "POST", "/api/unpublished/discard");
  });

  it("removes a person's allocations with them, recording it", async () => {
    const { personId, id } = await liveAllocation();
    await test.request(director.cookie, "DELETE", `/api/people/${personId}`);
    const response = await test.request(
      director.cookie,
      "POST",
      "/api/drafts/approval",
      { people: [personId] },
    );
    expect(response.statusCode, response.body).toBe(200);
    expect((await read()).allocations.some((one) => one.id === id)).toBe(false);
    expect(
      (await test.historyOf(id)).filter(({ action }) => action === "deleted"),
    ).not.toHaveLength(0);
  });

  it("refuses removing a person while any of their allocations has a draft", async () => {
    const { personId, featureId } = await liveAllocation();
    await changed({ personId, featureId, percentage: 25, from: month(1) });
    await test.request(director.cookie, "DELETE", `/api/people/${personId}`);
    const response = await test.request(
      director.cookie,
      "POST",
      "/api/drafts/approval",
      { people: [personId] },
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "Someone being removed has allocations with drafts. Approve, reject, or discard those drafts first.",
    );
  });

  it("removes a planned hire's allocations with it", async () => {
    const plannedHireId = await addHire();
    const featureId = await addFeature();
    await changed({ plannedHireId, featureId, percentage: 50, from: month(0) });
    const id = String((await allocationOf({ plannedHireId }, featureId))?.id);
    await approved(id);
    await test.request(
      director.cookie,
      "DELETE",
      `/api/planned-hires/${plannedHireId}`,
    );
    const response = await test.request(
      director.cookie,
      "POST",
      "/api/drafts/approval",
      { plannedHires: [plannedHireId] },
    );
    expect(response.statusCode, response.body).toBe(200);
    expect((await read()).allocations.some((one) => one.id === id)).toBe(false);
  });
});

describe("the change history", () => {
  async function allocationRecords(who: Account) {
    const response = await test.request(who.cookie, "GET", "/api/changes");
    expect(response.statusCode).toBe(200);
    return response
      .json<ChangeHistory>()
      .entries.flatMap(({ records }) => records)
      .filter(({ kind }) => kind === "allocation");
  }

  async function nameOf(personId: string): Promise<string> {
    const [person] = await test.connection
      .select({ name: people.preferredName })
      .from(people)
      .where(eq(people.id, personId));
    return String(person?.name);
  }

  it("names an allocation by who is on which feature, and gives its months in words", async () => {
    const { personId, featureId } = await liveAllocation({ from: 0, to: 1 });
    await changed({ personId, featureId, percentage: 25, from: month(2) });
    const [feature] = await test.connection
      .select({ name: features.name })
      .from(features)
      .where(eq(features.id, featureId));
    const name = `${await nameOf(personId)} on ${String(feature?.name)}`;
    const records = (await allocationRecords(director)).filter(
      (record) => record.name === name,
    );
    expect(records.map(({ action }) => action)).toContain("created");
    expect(
      records.find(({ action }) => action === "changed")?.fields,
    ).toContainEqual({
      field: "months",
      oldValue: [`50% from ${month(0)}`, `0% from ${month(2)}`],
      newValue: [`50% from ${month(0)}`, `25% from ${month(2)}`],
    });
  });

  it("names a general feature's allocation by its project", async () => {
    const general = await addGeneralFeature();
    const personId = await addPerson();
    await changed({
      personId,
      featureId: general.featureId,
      percentage: 50,
      from: month(0),
    });
    const [project] = await test.connection
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, general.projectId));
    expect(
      (await allocationRecords(director)).map(({ name }) => name),
    ).toContain(`${await nameOf(personId)} on ${String(project?.name)}`);
  });

  it("keeps every allocation from readers who do not see Personal details, even of someone employed today", async () => {
    const personId = await addPerson();
    await changed(
      {
        personId,
        featureId: await addFeature(),
        percentage: 50,
        from: month(0),
        to: month(0),
      },
      manager,
    );
    const name = await nameOf(personId);
    const naming = (records: { name: string | null }[]) =>
      records.filter((record) => record.name?.startsWith(`${name} on `));
    expect(naming(await allocationRecords(director))).not.toHaveLength(0);
    const reader = await test.signedIn(generalReader);
    expect(naming(await allocationRecords(reader))).toHaveLength(0);
  });
});
