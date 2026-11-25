// SPDX-License-Identifier: Apache-2.0

// Tests for the fictional customers, proposals, and projects with their milestones and activities,
// against a PostgreSQL server of their own.

import {
  activities,
  changes,
  changeSets,
  createDatabase,
  createPool,
  customers,
  type Database,
  drafts,
  featureTeams,
  listItems,
  lists,
  milestones,
  people,
  projects,
  proposals,
  features,
} from "@fathom/db";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { eq, isNotNull, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityId,
  releaseActivityId,
  seededActivities,
  seededReleaseActivities,
} from "./activities.ts";
import { seedReleases, unseedReleases } from "./releases.ts";
import { seededFeatures } from "./features.ts";
import {
  customerId,
  projectId,
  proposalId,
  seededCustomers,
  seededProjects,
  seededProposals,
  seedProjects,
  unseedProjects,
} from "./projects.ts";

const today = "2026-11-08";

let database: TestDatabase;
let pool: ReturnType<typeof createPool>;
let connection: Database;
let owner: string;
const teamIds = [randomUUID(), randomUUID(), randomUUID()];

beforeAll(async () => {
  database = await startTestDatabase();
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
  const [position] = await connection
    .select({ id: listItems.id })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "positions"));
  owner = randomUUID();
  await connection.insert(featureTeams).values(
    teamIds.map((id, place) => ({
      id,
      name: `Fictional Team ${String(place)}`,
    })),
  );
  await connection.insert(people).values({
    id: owner,
    preferredName: "Fictional Owner",
    employeeId: "FO-1",
    positionId: String(position?.id),
  });
});

afterEach(async () => {
  await connection.delete(drafts);
  await connection.delete(milestones);
  await connection.delete(activities);
  await connection.delete(features);
  await connection.delete(projects);
  await connection.delete(proposals);
  await connection.delete(customers);
});

afterAll(async () => {
  await pool.end();
  await database.remove();
});

const seed = () =>
  seedProjects(connection, today, [randomUUID(), owner], teamIds);

describe("seeding projects", () => {
  it("adds the records once, recorded as made by Fathom itself", async () => {
    expect(await seed()).toBe(true);
    expect(await seed()).toBe(false);
    const made = await connection
      .select({ recordType: changes.recordType })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(isNull(changeSets.madeBy));
    expect(new Set(made.map(({ recordType }) => recordType))).toEqual(
      new Set(["customer", "proposal", "project", "milestone", "activity"]),
    );
    expect(await connection.select().from(customers)).toHaveLength(
      seededCustomers.length,
    );
  });

  it("has proposals in every status, some linked from projects", async () => {
    await seed();
    const statuses = await connection
      .select({ label: listItems.label })
      .from(proposals)
      .innerJoin(listItems, eq(listItems.id, proposals.statusId));
    expect(new Set(statuses.map(({ label }) => label))).toEqual(
      new Set(["Open", "Won", "Lost", "Withdrawn"]),
    );
    const linked = (await connection.select().from(projects)).flatMap(
      (project) => project.proposalIds,
    );
    expect(linked.length).toBeGreaterThan(0);
  });

  it("names seeded features from projects and proposals, leaving some unnamed as ideas", () => {
    const named = new Set(
      [...seededProjects, ...seededProposals].flatMap(
        (record) => record.features,
      ),
    );
    const keys = seededFeatures.map(({ key }) => key);
    expect(keys).toEqual(expect.arrayContaining([...named]));
    expect(keys.filter((key) => !named.has(key)).length).toBeGreaterThan(0);
  });

  it("gives owners only to people there, and dates milestones on both sides of the seed day", async () => {
    await seed();
    const owners = (await connection.select().from(projects)).map(
      ({ ownerId }) => ownerId,
    );
    expect(owners).toContain(owner);
    expect(owners.filter((id) => id !== null && id !== owner)).toEqual([]);
    const deliveries = await connection
      .select({ date: milestones.date })
      .from(milestones)
      .where(eq(milestones.customerDelivery, true));
    expect(deliveries.some(({ date }) => date < today)).toBe(true);
    expect(deliveries.some(({ date }) => date > today)).toBe(true);
  });

  it("gives a proposal the first status when its own was renamed", async () => {
    const [won] = await connection
      .select({ id: listItems.id })
      .from(listItems)
      .where(eq(listItems.label, "Won"));
    await connection
      .update(listItems)
      .set({ label: "Fictional Won" })
      .where(eq(listItems.id, String(won?.id)));
    await seed();
    await connection
      .update(listItems)
      .set({ label: "Won" })
      .where(eq(listItems.id, String(won?.id)));
    const [cranes] = await connection
      .select({ label: listItems.label })
      .from(proposals)
      .innerJoin(listItems, eq(listItems.id, proposals.statusId))
      .where(eq(proposals.id, proposalId("cranes")));
    expect(cranes?.label).toBe("Open");
  });

  it("adds each project's activities, and only theirs", async () => {
    await seed();
    const added = await connection
      .select({
        id: activities.id,
        projectId: activities.projectId,
        name: activities.name,
      })
      .from(activities);
    expect(added.sort((one, other) => one.id.localeCompare(other.id))).toEqual(
      seededActivities
        .map(({ project, key, name }) => ({
          id: activityId(project, key),
          projectId: projectId(project),
          name,
        }))
        .sort((one, other) => one.id.localeCompare(other.id)),
    );
  });

  it("adds the releases' activities once the releases are there, and removes them with the projects", async () => {
    await seedReleases(connection, today);
    await seed();
    const releaseActivities = async () =>
      (
        await connection
          .select({ id: activities.id })
          .from(activities)
          .where(isNotNull(activities.releaseId))
      ).map(({ id }) => id);
    expect((await releaseActivities()).sort()).toEqual(
      seededReleaseActivities.map(releaseActivityId).sort(),
    );

    await unseedProjects(connection);
    expect(await releaseActivities()).toEqual([]);
    expect(await unseedReleases(connection)).toEqual([]);
  });

  it("adds no release's activities without the releases", async () => {
    await seed();
    expect(
      await connection
        .select({ id: activities.id })
        .from(activities)
        .where(isNotNull(activities.releaseId)),
    ).toEqual([]);
  });

  it("gives each activity its status, team and planning values", async () => {
    await seed();
    const [migration] = await connection
      .select()
      .from(activities)
      .where(eq(activities.id, activityId("crane-control", "data-migration")));
    const choiceOf = async (id: string | null | undefined) => {
      const [choice] = await connection
        .select({ label: listItems.label, meaning: listItems.meaning })
        .from(listItems)
        .where(eq(listItems.id, String(id)));
      return choice;
    };
    expect(await choiceOf(migration?.statusId)).toMatchObject({
      meaning: "in-progress",
    });
    expect(await choiceOf(migration?.priorityId)).toMatchObject({
      label: "Critical",
    });
    expect(await choiceOf(migration?.sizeId)).toMatchObject({ label: "XL" });
    expect(await choiceOf(migration?.riskId)).toMatchObject({ label: "High" });
    expect(migration).toMatchObject({
      featureTeamId: teamIds[1],
      neededBy: "2027-01",
    });
    const [warranty] = await connection
      .select({ featureTeamId: activities.featureTeamId })
      .from(activities)
      .where(
        eq(activities.id, activityId("transit-displays", "warranty-support")),
      );
    expect(warranty).toEqual({ featureTeamId: null });
  });
});

describe("removing projects", () => {
  it("removes everything seeding added, with its drafts", async () => {
    await seed();
    const project = seededProjects[0];
    await connection.insert(drafts).values({
      recordType: "milestone",
      recordId: randomUUID(),
      action: "created",
      fields: { projectId: projectId(String(project?.key)) },
    });
    await connection.insert(drafts).values({
      recordType: "activity",
      recordId: randomUUID(),
      action: "created",
      fields: { projectId: projectId(String(project?.key)) },
    });
    expect(await unseedProjects(connection)).toEqual([]);
    expect(await connection.select().from(customers)).toEqual([]);
    expect(await connection.select().from(milestones)).toEqual([]);
    expect(await connection.select().from(activities)).toEqual([]);
    expect(await connection.select().from(drafts)).toEqual([]);
  });

  it("keeps what something added by hand uses", async () => {
    await seed();
    const [crane] = seededProjects;
    await connection.insert(milestones).values({
      projectId: projectId(String(crane?.key)),
      name: "Fictional Hand Milestone",
      date: today,
    });
    await connection.insert(proposals).values({
      name: "Fictional Hand Proposal",
      customerIds: [customerId("mining")],
      statusId: String(
        (await connection.select().from(proposals))[0]?.statusId,
      ),
    });
    const kept = await unseedProjects(connection);
    expect(kept).toEqual([
      "The project Crane Control, which has milestones or activities added by hand",
      "The proposal Harbour Cranes Upgrade, which a project kept uses",
      "The customer Bluefin Harbour Authority, which a project, proposal, or feature kept uses",
      "The customer Kestrel Mining Cooperative, which a project, proposal, or feature kept uses",
    ]);
    expect(
      (await connection.select().from(projects)).map(({ name }) => name),
    ).toEqual(["Crane Control"]);
  });

  it("discards drafts made by hand that link to a record removed, and keeps others", async () => {
    await seed();
    const linking = (recordId: string, fields: Record<string, unknown>) => ({
      recordType: "project",
      recordId,
      action: "created",
      fields,
    });
    const keptId = randomUUID();
    await connection
      .insert(drafts)
      .values([
        linking(randomUUID(), { customerIds: [customerId("air")] }),
        linking(randomUUID(), { proposalIds: [proposalId("wifi")] }),
        linking(keptId, { customerIds: [randomUUID()] }),
      ]);
    await unseedProjects(connection);
    expect(
      (await connection.select().from(drafts)).map(({ recordId }) => recordId),
    ).toEqual([keptId]);
  });

  it("keeps a customer a feature added by hand names", async () => {
    await seed();
    const [status] = await connection
      .select({ id: listItems.id })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(eq(lists.builtIn, "feature-statuses"));
    await connection.insert(features).values({
      name: "Fictional Hand Feature",
      statusId: String(status?.id),
      customerIds: [customerId("air")],
    });
    expect(await unseedProjects(connection)).toContain(
      "The customer Orchid Regional Air, which a project, proposal, or feature kept uses",
    );
    await connection.delete(features);
  });

  it("discards a feature's draft that names a customer removed", async () => {
    await seed();
    await connection.insert(drafts).values({
      recordType: "feature",
      recordId: randomUUID(),
      action: "created",
      fields: { customerIds: [customerId("air")] },
    });
    await unseedProjects(connection);
    expect(await connection.select().from(drafts)).toEqual([]);
  });

  it("keeps a project with an activity added by hand", async () => {
    await seed();
    const [status] = await connection
      .select({ id: listItems.id })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(eq(lists.builtIn, "feature-statuses"));
    await connection.insert(activities).values({
      projectId: projectId("depot-operations"),
      name: "Fictional Hand Activity",
      statusId: String(status?.id),
    });
    expect(await unseedProjects(connection)).toContain(
      "The project Depot Operations, which has milestones or activities added by hand",
    );
  });

  it("removes nothing when nothing was seeded", async () => {
    expect(await unseedProjects(connection)).toEqual([]);
  });
});
