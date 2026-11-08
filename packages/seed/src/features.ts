// SPDX-License-Identifier: Apache-2.0

// The fictional organization's features, added live and placed relative to the cycle the seed day
// falls in, across the cycles of the Platform release stream, some in Later, each recorded in the
// change history as made by Fathom itself. Removing them discards every draft of them, and takes
// the seeded feature teams off features added by hand, so the teams can go. A development-only
// package, never included in the runtime image.

import {
  type Database,
  drafts,
  features,
  recordChanges,
  releaseStreams,
  unpublishedDrafts,
} from "@fathom/db";
import { fictionalId } from "@fathom/fixtures";
import { cyclesOf, type FeatureStatus } from "@fathom/shared";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { filledIn, recorded, type SeededChange } from "./recorded.ts";
import { type SeededStream, seededStreams, streamId } from "./releases.ts";

const streamName = "Platform";

// Each feature's cycle is counted from the one the seed day falls in, before it when negative, or
// null for Later. Its feature team is by its place among the organization's, if it has one.
export const seededFeatures: readonly {
  key: string;
  name: string;
  status: FeatureStatus;
  cycle: number | null;
  hours: number | null;
  team: number | null;
  description: string | null;
}[] = [
  {
    key: "audit-export",
    name: "Audit Export",
    status: "done",
    cycle: -2,
    hours: 320,
    team: 0,
    description: "Download the audit trail as a file.",
  },
  {
    key: "sign-on",
    name: "Single Sign-On Setup",
    status: "done",
    cycle: -1,
    hours: 480,
    team: 1,
    description: null,
  },
  {
    key: "bulk-import",
    name: "Bulk Import",
    status: "cancelled",
    cycle: -1,
    hours: 240,
    team: null,
    description: "Replaced by a smaller import inside each module.",
  },
  {
    key: "offline-sync",
    name: "Offline Sync",
    status: "in-progress",
    cycle: 0,
    hours: 960,
    team: 0,
    description: "Keep working through a dropped connection.",
  },
  {
    key: "usage-alerts",
    name: "Usage Alerts",
    status: "in-progress",
    cycle: 0,
    hours: 400,
    team: 1,
    description: null,
  },
  {
    key: "mobile-approvals",
    name: "Mobile Approvals",
    status: "planned",
    cycle: 1,
    hours: 640,
    team: 0,
    description: null,
  },
  {
    key: "scheduler-api",
    name: "Scheduler API",
    status: "planned",
    cycle: 1,
    hours: null,
    team: null,
    description: "Let other systems book work through an API.",
  },
  {
    key: "retention-controls",
    name: "Data Retention Controls",
    status: "planned",
    cycle: 2,
    hours: 560,
    team: 1,
    description: null,
  },
  {
    key: "report-builder",
    name: "Report Builder",
    status: "possible",
    cycle: 3,
    hours: 1200,
    team: null,
    description: null,
  },
  {
    key: "voice-notes",
    name: "Voice Notes",
    status: "possible",
    cycle: null,
    hours: null,
    team: null,
    description: "An idea from the last customer day.",
  },
  {
    key: "partner-portal",
    name: "Partner Portal",
    status: "possible",
    cycle: null,
    hours: 2000,
    team: null,
    description: null,
  },
];

export const featureId = (key: string) => fictionalId(`feature:${key}`);

const seededIds = () => seededFeatures.map(({ key }) => featureId(key));

// Adds the features, once, if the Platform stream is there to target. Returns whether it added
// them.
export async function seedFeatures(
  database: Database,
  today: string,
  teamIds: readonly string[],
): Promise<boolean> {
  const stream = seededStreams(today).find(
    ({ name }) => name === streamName,
  ) as SeededStream;
  const targetStreamId = streamId({ name: streamName });
  return database.transaction(async (transaction) => {
    const [present] = await transaction
      .select({ id: features.id })
      .from(features)
      .where(inArray(features.id, seededIds()));
    const [streamRow] = await transaction
      .select({ id: releaseStreams.id })
      .from(releaseStreams)
      .where(eq(releaseStreams.id, targetStreamId));
    if (present !== undefined || streamRow === undefined) return false;
    const cycles = cyclesOf(stream.patterns, stream.cyclesUntil);
    const current = cycles.findIndex(
      ({ startsOn, endsOn }) => startsOn <= today && today <= endsOn,
    );
    const made: SeededChange[] = [];
    for (const feature of seededFeatures) {
      const id = featureId(feature.key);
      const cycle =
        feature.cycle === null ? undefined : cycles.at(current + feature.cycle);
      const row = {
        name: feature.name,
        status: feature.status,
        targetStreamId: cycle === undefined ? null : targetStreamId,
        targetCycle: cycle?.startsOn ?? null,
        estimateHours: feature.hours,
        featureTeamId:
          feature.team === null ? null : (teamIds.at(feature.team) ?? null),
        description: feature.description,
      };
      await transaction.insert(features).values({ id, ...row });
      made.push(...recorded("feature", id, "created", filledIn(row)));
    }
    await recordChanges(transaction, null, made);
    return true;
  });
}

// Removes the features seeding added, every draft of them, and every draft that names the seeded
// feature teams, whose features added by hand then have no feature team.
export async function unseedFeatures(
  database: Database,
  teamIds: readonly string[],
): Promise<void> {
  await database.transaction(async (transaction) => {
    const ids = seededIds();
    for (const table of [drafts, unpublishedDrafts]) {
      await transaction
        .delete(table)
        .where(
          and(
            eq(table.recordType, "feature"),
            or(
              inArray(table.recordId, ids),
              inArray(sql`${table.fields}->>'featureTeamId'`, [...teamIds]),
            ),
          ),
        );
    }
    const unteamed = await transaction
      .select({ id: features.id, teamId: features.featureTeamId })
      .from(features)
      .where(inArray(features.featureTeamId, [...teamIds]));
    await transaction
      .update(features)
      .set({ featureTeamId: null })
      .where(inArray(features.featureTeamId, [...teamIds]));
    const removed = await transaction
      .delete(features)
      .where(inArray(features.id, ids))
      .returning();
    await recordChanges(transaction, null, [
      ...unteamed.map(({ id, teamId }) => ({
        recordType: "feature",
        recordId: id,
        action: "changed" as const,
        field: "featureTeamId",
        tier: "general",
        oldValue: teamId,
        newValue: null,
      })),
      ...removed.flatMap(({ id, ...values }) =>
        recorded("feature", id, "deleted", filledIn(values)),
      ),
    ]);
  });
}
