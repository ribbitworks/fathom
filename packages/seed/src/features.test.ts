// SPDX-License-Identifier: Apache-2.0

// Tests for the fictional features, against a PostgreSQL server of their own: seeding them once,
// recorded as made by Fathom itself, across a release stream's cycles with some in Later, and
// removing them with their drafts, leaving features added by hand.

import {
  activities,
  changes,
  changeSets,
  createDatabase,
  createPool,
  type Database,
  drafts,
  featureTeams,
  features,
  releaseStreams,
  fields,
  fieldValues,
  listItems,
  lists,
  projects,
  proposals,
} from "@fathom/db";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { addMonths, monthOf } from "@fathom/shared";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { seededFeatures, seedFeatures, unseedFeatures } from "./features.ts";
import { customerId, featureId } from "./projects.ts";
import { fieldAppsKeys } from "./field-apps.ts";
import { seedReleases, streamId, unseedReleases } from "./releases.ts";

const today = "2026-11-08";

let database: TestDatabase;
let pool: ReturnType<typeof createPool>;
let connection: Database;

beforeAll(async () => {
  database = await startTestDatabase();
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
});

afterEach(async () => {
  await connection.delete(drafts);
  await connection.delete(activities);
  await connection.delete(projects);
  await connection.delete(proposals);
  await connection.delete(features);
  await connection.delete(featureTeams);
  await unseedReleases(connection);
});

afterAll(async () => {
  await pool.end();
  await database.remove();
});

const addTeam = async () => {
  const id = randomUUID();
  await connection
    .insert(featureTeams)
    .values({ id, name: `Fictional Team ${id}` });
  return id;
};

const anyStatus = async () => {
  const [found] = await connection
    .select({ id: listItems.id })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "feature-statuses"));
  return String(found?.id);
};

const addHandFeature = async (featureTeamId: string | null = null) => {
  const id = randomUUID();
  await connection.insert(features).values({
    id,
    name: `Fictional Hand ${id}`,
    featureTeamId,
    statusId: await anyStatus(),
  });
  return id;
};

const everyFeature = () => connection.select().from(features);

describe("Kind", () => {
  it("adds its list, a column on Features, and kinds on some features", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    const [column] = await connection
      .select()
      .from(fields)
      .where(eq(fields.tableName, "features"));
    expect(column?.name).toBe("Kind");
    expect(await connection.select().from(fieldValues)).not.toEqual([]);
  });

  it("is removed with the features, with its list", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    expect(await unseedFeatures(connection, [])).toEqual([]);
    expect(
      await connection
        .select()
        .from(fields)
        .where(eq(fields.tableName, "features")),
    ).toEqual([]);
  });

  it("keeps its list when another column uses it, or it has a choice added by hand", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    const [column] = await connection
      .select()
      .from(fields)
      .where(eq(fields.tableName, "features"));
    const listId = String(column?.listId);
    const handColumn = randomUUID();
    await connection.insert(fields).values({
      id: handColumn,
      tableName: "features",
      name: "Fictional Hand Column",
      listId,
    });
    expect(await unseedFeatures(connection, [])).toEqual([
      "The Kind list, which a column uses",
    ]);
    await connection.delete(fields).where(eq(fields.id, handColumn));
    await connection.delete(listItems).where(eq(listItems.listId, listId));
    await connection.delete(lists).where(eq(lists.id, listId));
    await seedFeatures(connection, today, []);
    const [again] = await connection
      .select()
      .from(fields)
      .where(eq(fields.tableName, "features"));
    await connection.insert(listItems).values({
      listId: String(again?.listId),
      label: "Fictional Hand Kind",
      position: 100,
    });
    expect(await unseedFeatures(connection, [])).toEqual([
      "The Kind list, which has choices added by hand",
    ]);
    await connection
      .delete(listItems)
      .where(eq(listItems.listId, String(again?.listId)));
    await connection.delete(lists).where(eq(lists.id, String(again?.listId)));
  });

  it("records a value given to a feature added by hand when the column goes", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    const [held] = await connection.select().from(fieldValues);
    const handFeature = await addHandFeature();
    await connection.insert(fieldValues).values({
      fieldId: String(held?.fieldId),
      featureId: handFeature,
      choiceId: held?.choiceId,
    });
    await unseedFeatures(connection, []);
    expect(
      await connection
        .select()
        .from(fieldValues)
        .where(eq(fieldValues.featureId, handFeature)),
    ).toEqual([]);
  });
});

describe("seeding features", () => {
  it("adds them once, recorded as made by Fathom itself", async () => {
    await seedReleases(connection, today);
    expect(await seedFeatures(connection, today, [])).toBe(true);
    expect(await seedFeatures(connection, today, [])).toBe(false);
    expect(await everyFeature()).toHaveLength(seededFeatures.length);
    const made = await connection
      .select({ recordId: changes.recordId })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(isNull(changeSets.madeBy));
    expect(made.map(({ recordId }) => recordId)).toContain(
      featureId("offline-sync"),
    );
  });

  it("adds none without the release stream they target", async () => {
    expect(await seedFeatures(connection, today, [])).toBe(false);
    expect(await everyFeature()).toEqual([]);
  });

  it("spreads them across several cycles, with some in Later", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    const found = await everyFeature();
    expect(
      new Set(found.flatMap(({ targetCycle }) => targetCycle ?? [])).size,
    ).toBeGreaterThan(2);
    expect(
      found.filter(({ targetCycle }) => targetCycle === null),
    ).toHaveLength(seededFeatures.filter(({ cycle }) => cycle === null).length);
  });

  it("adds none when a schedule they target is missing", async () => {
    await connection.insert(releaseStreams).values({
      id: streamId({ name: "Platform" }),
      name: "Platform",
    });
    expect(await seedFeatures(connection, today, [])).toBe(false);
    expect(await everyFeature()).toEqual([]);
  });

  it("places Field Apps' features in its own cycles, one needed by last month", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    const [next, signature] = await Promise.all(
      ["work-order-sync", "signature-capture"].map(async (key) => {
        const [found] = await connection
          .select()
          .from(features)
          .where(eq(features.id, featureId(key)));
        return found;
      }),
    );
    expect(next).toMatchObject({
      targetStreamId: streamId({ name: fieldAppsKeys.name }),
      targetCycle: "2027-01-01",
    });
    expect(signature?.neededBy).toBe(monthOf(addMonths(today, -1)));
  });

  it("targets the cycle the seed day falls in for work in progress", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    const [inProgress] = await connection
      .select()
      .from(features)
      .where(eq(features.id, featureId("offline-sync")));
    expect(inProgress?.targetCycle).toBe("2026-10-01");
  });

  it("gives each feature its priority, size and risk from the built-in lists, or none", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    const labels = new Map(
      (
        await connection
          .select({ id: listItems.id, label: listItems.label })
          .from(listItems)
      ).map(({ id, label }) => [id, label]),
    );
    const labelOf = (id: string | null) =>
      id === null ? null : labels.get(id);
    const [offline] = await connection
      .select()
      .from(features)
      .where(eq(features.id, featureId("offline-sync")));
    expect(labelOf(offline?.priorityId ?? null)).toBe("Critical");
    expect(labelOf(offline?.sizeId ?? null)).toBe("L");
    expect(labelOf(offline?.riskId ?? null)).toBe("High");
    const [voice] = await connection
      .select()
      .from(features)
      .where(eq(features.id, featureId("voice-notes")));
    expect(labelOf(voice?.priorityId ?? null)).toBe("Low");
    expect(voice?.sizeId).toBeNull();
    expect(voice?.riskId).toBeNull();
  });

  it("gives a feature no priority when its choice has been renamed", async () => {
    await seedReleases(connection, today);
    const [critical] = await connection
      .select({ id: listItems.id })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(
        and(
          eq(lists.builtIn, "feature-priorities"),
          eq(listItems.label, "Critical"),
        ),
      );
    const criticalId = String(critical?.id);
    await connection
      .update(listItems)
      .set({ label: "Fictional Urgent" })
      .where(eq(listItems.id, criticalId));
    try {
      await seedFeatures(connection, today, []);
      const [offline] = await connection
        .select()
        .from(features)
        .where(eq(features.id, featureId("offline-sync")));
      expect(offline?.priorityId).toBeNull();
    } finally {
      await connection
        .update(listItems)
        .set({ label: "Critical" })
        .where(eq(listItems.id, criticalId));
    }
  });

  it("uses every status a feature can have", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    const held = new Set((await everyFeature()).map((row) => row.statusId));
    const meanings = await connection
      .select({ meaning: listItems.meaning })
      .from(listItems)
      .where(inArray(listItems.id, [...held]));
    expect(new Set(meanings.map(({ meaning }) => meaning))).toEqual(
      new Set(["possible", "planned", "in-progress", "done", "cancelled"]),
    );
  });

  it("gives each feature the first status offered for its meaning", async () => {
    await seedReleases(connection, today);
    const [possible] = await connection
      .select()
      .from(listItems)
      .where(eq(listItems.meaning, "possible"));
    const [later] = await connection
      .insert(listItems)
      .values({
        listId: String(possible?.listId),
        label: "Fictional Later Possible",
        position: 100,
        meaning: "possible",
      })
      .returning();
    await seedFeatures(connection, today, []);
    const held = (await everyFeature()).map(({ statusId }) => statusId);
    expect(held).toContain(possible?.id);
    expect(held).not.toContain(later?.id);
    await connection
      .delete(listItems)
      .where(eq(listItems.id, String(later?.id)));
  });

  it("says so when no status is offered for a meaning", async () => {
    await seedReleases(connection, today);
    await connection
      .update(listItems)
      .set({ retired: true })
      .where(eq(listItems.meaning, "possible"));
    await expect(seedFeatures(connection, today, [])).rejects.toThrow(
      "No status means possible",
    );
    await connection
      .update(listItems)
      .set({ retired: false })
      .where(eq(listItems.meaning, "possible"));
  });

  it("dates what is needed from the seed day's month, and names customers", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    const [offlineSync] = await connection
      .select()
      .from(features)
      .where(eq(features.id, featureId("offline-sync")));
    expect(offlineSync?.neededBy).toBe(monthOf(addMonths(today, 1)));
    expect(offlineSync?.customerIds).toEqual(
      [customerId("harbour"), customerId("clinics")].sort(),
    );
    expect(offlineSync?.note).toContain("Field crews");
  });

  it("gives features the feature teams there are, and none past those", async () => {
    await seedReleases(connection, today);
    const team = await addTeam();
    await seedFeatures(connection, today, [team]);
    const teamed = (await everyFeature()).flatMap(
      ({ featureTeamId }) => featureTeamId ?? [],
    );
    expect(new Set(teamed)).toEqual(new Set([team]));
  });
});

describe("removing features", () => {
  const seeded = async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
  };

  it("removes those seeded, with their drafts, and keeps those added by hand", async () => {
    await seeded();
    const hand = await addHandFeature();
    await connection.insert(drafts).values({
      recordType: "feature",
      recordId: featureId("offline-sync"),
      action: "changed",
      fields: { name: "Fictional Draft" },
    });
    await unseedFeatures(connection, []);
    expect((await everyFeature()).map(({ id }) => id)).toEqual([hand]);
    expect(await connection.select().from(drafts)).toEqual([]);
  });

  it("takes them off projects and proposals, and discards drafts of those naming them", async () => {
    // Given a project and a proposal added by hand naming a seeded feature, and a draft naming it
    await seeded();
    const hand = await addHandFeature();
    const seededOne = featureId("offline-sync");
    const projectId = randomUUID();
    const proposalId = randomUUID();
    await connection.insert(projects).values({
      id: projectId,
      name: "Fictional Hand Project",
      featureIds: [seededOne, hand],
    });
    await connection.insert(proposals).values({
      id: proposalId,
      name: "Fictional Hand Proposal",
      statusId: await anyStatus(),
      featureIds: [seededOne],
    });
    await connection.insert(drafts).values({
      recordType: "proposal",
      recordId: proposalId,
      action: "changed",
      fields: { featureIds: [seededOne, hand] },
    });
    // When the seeded features are removed
    await unseedFeatures(connection, []);
    // Then each loses the seeded feature, recorded in the change history, and the draft is gone
    const [project] = await connection.select().from(projects);
    const [proposal] = await connection.select().from(proposals);
    expect(project?.featureIds).toEqual([hand]);
    expect(proposal?.featureIds).toEqual([]);
    expect(await connection.select().from(drafts)).toEqual([]);
    const recorded = await connection
      .select({ oldValue: changes.oldValue, newValue: changes.newValue })
      .from(changes)
      .where(eq(changes.recordId, projectId));
    expect(recorded).toEqual([
      { oldValue: [seededOne, hand], newValue: [hand] },
    ]);
  });

  it("discards the milestones' drafts of a project only drafted to be added that names them", async () => {
    // Given a project drafted to be added, naming a seeded feature, with a milestone drafted on it
    await seeded();
    const projectId = randomUUID();
    await connection.insert(drafts).values([
      {
        recordType: "project",
        recordId: projectId,
        action: "created",
        fields: {
          name: "Fictional Drafted",
          featureIds: [featureId("offline-sync")],
        },
      },
      {
        recordType: "milestone",
        recordId: randomUUID(),
        action: "created",
        fields: { projectId, name: "Fictional Kickoff" },
      },
    ]);
    // When the seeded features are removed
    await unseedFeatures(connection, []);
    // Then both drafts are gone
    expect(await connection.select().from(drafts)).toEqual([]);
  });

  it("takes the seeded feature teams off features added by hand and out of drafts", async () => {
    const team = await addTeam();
    const hand = await addHandFeature(team);
    const other = await addHandFeature();
    await connection.insert(drafts).values({
      recordType: "feature",
      recordId: other,
      action: "changed",
      fields: { featureTeamId: team },
    });
    await unseedFeatures(connection, [team]);
    const [kept] = await connection
      .select()
      .from(features)
      .where(eq(features.id, hand));
    expect(kept?.featureTeamId).toBeNull();
    expect(await connection.select().from(drafts)).toEqual([]);
  });

  it("takes the seeded feature teams off activities and out of their drafts", async () => {
    // Given an activity of a project added by hand on a seeded team, and a draft naming it
    const team = await addTeam();
    const projectId = randomUUID();
    await connection
      .insert(projects)
      .values({ id: projectId, name: `Fictional Project ${projectId}` });
    const activityId = randomUUID();
    await connection.insert(activities).values({
      id: activityId,
      projectId,
      name: "Fictional Hand Activity",
      statusId: await anyStatus(),
      featureTeamId: team,
    });
    await connection.insert(drafts).values({
      recordType: "activity",
      recordId: randomUUID(),
      action: "created",
      fields: { projectId, featureTeamId: team },
    });
    // When the features are removed with their teams
    await unseedFeatures(connection, [team]);
    await connection.delete(featureTeams).where(eq(featureTeams.id, team));
    // Then the activity has no team, the change is recorded, and the draft is gone
    const [kept] = await connection
      .select()
      .from(activities)
      .where(eq(activities.id, activityId));
    expect(kept?.featureTeamId).toBeNull();
    const recorded = await connection
      .select({ field: changes.field, oldValue: changes.oldValue })
      .from(changes)
      .where(
        and(
          eq(changes.recordType, "activity"),
          eq(changes.recordId, activityId),
        ),
      );
    expect(recorded).toEqual([{ field: "featureTeamId", oldValue: team }]);
    expect(await connection.select().from(drafts)).toEqual([]);
  });

  it("does nothing to feature teams when there are none to remove", async () => {
    const team = await addTeam();
    const hand = await addHandFeature(team);
    await unseedFeatures(connection, []);
    const [kept] = await connection
      .select()
      .from(features)
      .where(eq(features.id, hand));
    expect(kept?.featureTeamId).toBe(team);
  });

  it("leaves a release stream that a feature added by hand targets", async () => {
    await seedReleases(connection, today);
    const [stream] = await connection.select().from(releaseStreams);
    await connection.insert(features).values({
      statusId: await anyStatus(),
      name: "Fictional Targeting",
      targetStreamId: stream?.id,
      targetCycle: today,
    });
    expect(await unseedReleases(connection)).toEqual([
      expect.stringContaining("added by hand"),
    ]);
    await connection.delete(features);
  });
});
