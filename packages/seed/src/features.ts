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
  fields,
  fieldValues,
  listItems,
  lists,
  recordChanges,
  releaseStreams,
  unpublishedDrafts,
  valueField,
} from "@fathom/db";
import { fictionalId } from "@fathom/fixtures";
import { addMonths, cyclesOf, type Meaning, monthOf } from "@fathom/shared";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { customerId } from "./projects.ts";
import { filledIn, recorded, type SeededChange } from "./recorded.ts";
import { type SeededStream, seededStreams, streamId } from "./releases.ts";

const streamName = "Platform";

const complexitySizes = ["XS", "S", "M", "L", "XL"] as const;
const complexityListId = fictionalId("list:complexity");
const complexityColumnId = fictionalId("field:complexity");
const sizeId = (size: string) => fictionalId(`list-item:complexity:${size}`);

// Each feature's cycle is counted from the one the seed day falls in, before it when negative, or
// null for Later. Its feature team is by its place among the organization's, if it has one. The
// month it is needed by is counted from the seed day's.
export const seededFeatures: readonly {
  key: string;
  name: string;
  status: Meaning;
  neededIn?: number;
  customers?: readonly string[];
  note?: string;
  complexity?: (typeof complexitySizes)[number];
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
    neededIn: 1,
    complexity: "L",
    customers: ["harbour", "clinics"],
    note: "**Field crews** asked for this first.\n\n- Queue changes while offline\n- Show what is waiting to send",
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
    neededIn: 3,
    complexity: "M",
    customers: ["air"],
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
    neededIn: 3,
    complexity: "S",
    customers: ["transit"],
    cycle: 2,
    hours: 560,
    team: 1,
    description: null,
  },
  {
    key: "report-builder",
    name: "Report Builder",
    status: "possible",
    neededIn: 9,
    complexity: "XL",
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
    neededIn: 14,
    customers: ["mining", "transit"],
    cycle: null,
    hours: 2000,
    team: null,
    description: null,
  },
];

export const featureId = (key: string) => fictionalId(`feature:${key}`);

const seededIds = () => seededFeatures.map(({ key }) => featureId(key));

// Adds Complexity, a list of sizes and a column on Features drawing on it, with no link to effort.
async function seedComplexity(
  transaction: Pick<Database, "insert" | "select">,
): Promise<SeededChange[]> {
  const [listHeld] = await transaction
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.id, complexityListId));
  const made: SeededChange[] = [];
  if (listHeld === undefined) {
    const list = {
      name: "Complexity",
      description: "",
      visibility: "general",
      retired: false,
    };
    await transaction.insert(lists).values({ id: complexityListId, ...list });
    made.push(...recorded("list", complexityListId, "created", list));
    for (const [index, label] of complexitySizes.entries()) {
      const id = sizeId(label);
      await transaction.insert(listItems).values({
        id,
        listId: complexityListId,
        label,
        position: index + 1,
      });
      made.push(
        ...recorded("list-item", id, "created", {
          listId: complexityListId,
          label,
          description: "",
          retired: false,
        }),
      );
    }
  }
  const [columnHeld] = await transaction
    .select({ id: fields.id })
    .from(fields)
    .where(eq(fields.id, complexityColumnId));
  if (columnHeld !== undefined) return made;
  const column = {
    tableName: "features",
    name: "Complexity",
    type: "choice",
    listId: complexityListId,
    visibility: null,
    multiple: false,
    required: false,
    onPlannedHires: false,
  };
  await transaction
    .insert(fields)
    .values({ id: complexityColumnId, ...column });
  made.push(...recorded("field", complexityColumnId, "created", column));
  return made;
}

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
    const statuses = await transaction
      .select({ id: listItems.id, meaning: listItems.meaning })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(
        and(
          eq(lists.builtIn, "feature-statuses"),
          eq(listItems.retired, false),
        ),
      )
      .orderBy(asc(listItems.position), asc(listItems.id));
    const statusIdOf = new Map<string | null, string>();
    for (const { id, meaning } of statuses) {
      if (!statusIdOf.has(meaning)) statusIdOf.set(meaning, id);
    }
    const made: SeededChange[] = await seedComplexity(transaction);
    for (const feature of seededFeatures) {
      const id = featureId(feature.key);
      const statusId = statusIdOf.get(feature.status);
      if (statusId === undefined) {
        throw new Error(`No feature status means ${feature.status}`);
      }
      const cycle =
        feature.cycle === null ? undefined : cycles.at(current + feature.cycle);
      const row = {
        name: feature.name,
        statusId,
        neededBy:
          feature.neededIn === undefined
            ? null
            : monthOf(addMonths(today, feature.neededIn)),
        customerIds: (feature.customers ?? []).map(customerId).sort(),
        targetStreamId: cycle === undefined ? null : targetStreamId,
        targetCycle: cycle?.startsOn ?? null,
        estimateHours: feature.hours,
        featureTeamId:
          feature.team === null ? null : (teamIds.at(feature.team) ?? null),
        description: feature.description,
        note: feature.note ?? null,
      };
      await transaction.insert(features).values({ id, ...row });
      const size = feature.complexity;
      if (size !== undefined) {
        await transaction.insert(fieldValues).values({
          fieldId: complexityColumnId,
          featureId: id,
          choiceId: sizeId(size),
        });
      }
      made.push(
        ...recorded("feature", id, "created", {
          ...filledIn(row),
          ...(size === undefined
            ? {}
            : { [valueField(complexityColumnId)]: [sizeId(size)] }),
        }),
      );
    }
    await recordChanges(transaction, null, made);
    return true;
  });
}

// Removes the Complexity column, with its values on features added by hand and every draft of it or
// that gives it a value, and its list, unless another column draws on the list or it has choices
// added by hand. Returns what it kept, in words.
async function unseedComplexity(
  transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
): Promise<string[]> {
  const [column] = await transaction
    .select()
    .from(fields)
    .where(eq(fields.id, complexityColumnId));
  if (column === undefined) return [];
  const valueKey = valueField(complexityColumnId);
  const handValues = await transaction
    .select()
    .from(fieldValues)
    .where(eq(fieldValues.fieldId, complexityColumnId));
  const cleared = handValues.map(({ featureId, choiceId }) => ({
    recordType: "feature",
    recordId: String(featureId),
    action: "changed" as const,
    field: valueKey,
    tier: "general",
    oldValue: [choiceId],
    newValue: null,
  }));
  for (const table of [drafts, unpublishedDrafts]) {
    await transaction
      .delete(table)
      .where(
        or(
          and(
            eq(table.recordType, "field"),
            eq(table.recordId, complexityColumnId),
          ),
          and(
            eq(table.recordType, "feature"),
            sql`${table.fields} ? ${valueKey}::text`,
          ),
        ),
      );
  }
  await transaction.delete(fields).where(eq(fields.id, complexityColumnId));
  const { id, ...columnFields } = column;
  const made: SeededChange[] = recorded("field", id, "deleted", columnFields);
  const kept: string[] = [];
  const drawing = await transaction
    .select({ id: fields.id })
    .from(fields)
    .where(eq(fields.listId, complexityListId));
  const choices = await transaction
    .select()
    .from(listItems)
    .where(eq(listItems.listId, complexityListId));
  const seededSizes = complexitySizes.map(sizeId);
  if (drawing.length > 0) kept.push("The Complexity list, which a column uses");
  else if (choices.some(({ id }) => !seededSizes.includes(id))) {
    kept.push("The Complexity list, which has choices added by hand");
  } else {
    const [list] = await transaction
      .select()
      .from(lists)
      .where(eq(lists.id, complexityListId));
    await transaction.delete(lists).where(eq(lists.id, complexityListId));
    made.push(
      ...recorded("list", complexityListId, "deleted", {
        name: list?.name,
        description: list?.description,
        visibility: list?.visibility,
        retired: list?.retired,
      }),
      ...choices.flatMap((choice) =>
        recorded("list-item", choice.id, "deleted", {
          listId: choice.listId,
          label: choice.label,
          description: choice.description,
          retired: choice.retired,
        }),
      ),
    );
  }
  await recordChanges(transaction, null, [...cleared, ...made]);
  return kept;
}

// Removes the features seeding added, every draft of them, and every draft that names the seeded
// feature teams, whose features added by hand then have no feature team.
export async function unseedFeatures(
  database: Database,
  teamIds: readonly string[],
): Promise<string[]> {
  return database.transaction(async (transaction) => {
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
    const sizes = new Map(
      (
        await transaction
          .select()
          .from(fieldValues)
          .where(
            and(
              eq(fieldValues.fieldId, complexityColumnId),
              inArray(fieldValues.featureId, ids),
            ),
          )
      ).map(({ featureId, choiceId }) => [featureId, choiceId]),
    );
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
        recorded("feature", id, "deleted", {
          ...filledIn(values),
          ...(sizes.has(id)
            ? { [valueField(complexityColumnId)]: [sizes.get(id)] }
            : {}),
        }),
      ),
    ]);
    return unseedComplexity(transaction);
  });
}
