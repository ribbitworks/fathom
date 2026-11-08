// SPDX-License-Identifier: Apache-2.0

// Tests for the fictional customers, proposals, and projects, against a PostgreSQL server of their
// own: seeding them once, recorded as made by Fathom itself, with proposals in every status and
// milestones on both sides of the seed day, and removing only what nothing added by hand uses.

import {
  changes,
  changeSets,
  createDatabase,
  createPool,
  customers,
  type Database,
  drafts,
  listItems,
  lists,
  milestones,
  people,
  projects,
  proposals,
  runMigrations,
} from "@fathom/db";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  customerId,
  projectId,
  proposalId,
  seededCustomers,
  seededProjects,
  seedProjects,
  unseedProjects,
} from "./projects.ts";

const today = "2026-11-08";

let database: TestDatabase;
let pool: ReturnType<typeof createPool>;
let connection: Database;
let owner: string;

beforeAll(async () => {
  database = await startTestDatabase();
  await runMigrations(database.migrator);
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
  const [position] = await connection
    .select({ id: listItems.id })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "positions"));
  owner = randomUUID();
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
  await connection.delete(projects);
  await connection.delete(proposals);
  await connection.delete(customers);
});

afterAll(async () => {
  await pool.end();
  await database.container.stop();
});

const seed = () => seedProjects(connection, today, [randomUUID(), owner]);

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
      new Set(["customer", "proposal", "project", "milestone"]),
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
    expect(await unseedProjects(connection)).toEqual([]);
    expect(await connection.select().from(customers)).toEqual([]);
    expect(await connection.select().from(milestones)).toEqual([]);
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
      "The project Crane Control, which has milestones added by hand",
      "The proposal Harbour Cranes Upgrade, which a project kept uses",
      "The customer Bluefin Harbour Authority, which a project or proposal kept uses",
      "The customer Kestrel Mining Cooperative, which a project or proposal kept uses",
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

  it("removes nothing when nothing was seeded", async () => {
    expect(await unseedProjects(connection)).toEqual([]);
  });
});
