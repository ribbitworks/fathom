// SPDX-License-Identifier: Apache-2.0

// The fictional organization's features, added live across the seeded release schedules, and
// removing them. A development-only package, never in the runtime image.

import {
  type ChangeRecord,
  type Database,
  drafts,
  features,
  fields,
  fieldValues,
  listItems,
  lists,
  projects,
  proposals,
  type Reader,
  recordChanges,
  releaseStreams,
  unpublishedDrafts,
  valueField,
} from "@fathom/db";
import { fictionalId } from "@fathom/fixtures";
import {
  addMonths,
  type Cycle,
  cyclesOf,
  featureBuiltInLists,
  horizonFrom,
  type Meaning,
  monthOf,
} from "@fathom/shared";
import { and, arrayOverlaps, asc, eq, inArray, or, sql } from "drizzle-orm";
import { customerId, featureId, linksAny } from "./projects.ts";
import { filledIn, recorded, type SeededChange } from "./recorded.ts";
import { fieldAppsFeatures, fieldAppsKeys } from "./field-apps.ts";
import { type SeededStream, seededStreams, streamId } from "./releases.ts";

const streamNames = ["Platform", fieldAppsKeys.name] as const;
type StreamName = (typeof streamNames)[number];
const defaultStream: StreamName = "Platform";

const kinds = ["New", "Improvement", "Fix"] as const;
const kindListId = fictionalId("list:kind");
const kindColumnId = fictionalId("field:kind");
const kindId = (kind: string) => fictionalId(`list-item:kind:${kind}`);

// Each feature's cycle is counted from the one the seed day falls in, before it when negative, or
// null for Later, in Platform's cycles unless it names another schedule. Its feature team is by its
// place among the organization's, if it has one. The month it is needed by is counted from the seed
// day's. Its priority, size and risk are choices of their built-in lists as Fathom starts them, by
// name.
export interface SeededFeature {
  key: string;
  name: string;
  status: Meaning;
  priority: "Critical" | "High" | "Medium" | "Low";
  size?: "XS" | "S" | "M" | "L" | "XL";
  risk?: "Low" | "Medium" | "High";
  neededIn?: number;
  customers?: readonly string[];
  note?: string;
  kind?: (typeof kinds)[number];
  stream?: StreamName;
  cycle: number | null;
  hours: number | null;
  team: number | null;
  description: string | null;
}

export const seededFeatures: readonly SeededFeature[] = [
  {
    key: "audit-export",
    name: "Audit Export",
    status: "done",
    priority: "High",
    size: "M",
    risk: "Low",
    cycle: -2,
    hours: 316,
    team: 0,
    description: "Download the audit trail as a file.",
  },
  {
    key: "sign-on",
    name: "Single Sign-On Setup",
    status: "done",
    priority: "Critical",
    size: "M",
    risk: "Medium",
    cycle: -1,
    hours: 480,
    team: 1,
    description: null,
  },
  {
    key: "bulk-import",
    name: "Bulk Import",
    status: "cancelled",
    priority: "Low",
    size: "L",
    risk: "High",
    cycle: -1,
    hours: 240,
    team: null,
    description: "Replaced by a smaller import inside each module.",
  },
  {
    key: "offline-sync",
    name: "Offline Sync",
    status: "in-progress",
    priority: "Critical",
    size: "L",
    risk: "High",
    neededIn: 1,
    kind: "New",
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
    priority: "Medium",
    size: "S",
    risk: "Low",
    cycle: 0,
    hours: 424,
    team: 1,
    description: null,
  },
  {
    key: "mobile-approvals",
    name: "Mobile Approvals",
    status: "planned",
    priority: "High",
    size: "M",
    risk: "Medium",
    neededIn: 3,
    kind: "Improvement",
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
    priority: "Medium",
    size: "M",
    risk: "Medium",
    cycle: 1,
    hours: null,
    team: null,
    description: "Let other systems book work through an API.",
  },
  {
    key: "retention-controls",
    name: "Data Retention Controls",
    status: "planned",
    priority: "High",
    size: "S",
    risk: "Low",
    neededIn: 3,
    kind: "Fix",
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
    priority: "Medium",
    size: "XL",
    risk: "High",
    neededIn: 9,
    kind: "New",
    cycle: 3,
    hours: 1200,
    team: null,
    description: null,
  },
  {
    key: "voice-notes",
    name: "Voice Notes",
    status: "possible",
    priority: "Low",
    cycle: null,
    hours: null,
    team: null,
    description: "An idea from the last customer day.",
  },
  {
    key: "partner-portal",
    name: "Partner Portal",
    status: "possible",
    priority: "High",
    size: "XL",
    risk: "High",
    neededIn: 14,
    customers: ["mining", "transit"],
    cycle: null,
    hours: 2000,
    team: null,
    description: null,
  },
  ...fieldAppsFeatures,
];

const seededIds = () => seededFeatures.map(({ key }) => featureId(key));

// Adds Kind, a list and a column on Features drawing on it, as an organization adds its own.
async function seedKind(
  transaction: Pick<Database, "insert" | "select">,
): Promise<SeededChange[]> {
  const [listHeld] = await transaction
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.id, kindListId));
  const made: SeededChange[] = [];
  if (listHeld === undefined) {
    const list = {
      name: "Kind",
      description: "",
      visibility: "general",
      retired: false,
    };
    await transaction.insert(lists).values({ id: kindListId, ...list });
    made.push(...recorded("list", kindListId, "created", list));
    for (const [index, label] of kinds.entries()) {
      const id = kindId(label);
      await transaction.insert(listItems).values({
        id,
        listId: kindListId,
        label,
        position: index + 1,
      });
      made.push(
        ...recorded("list-item", id, "created", {
          listId: kindListId,
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
    .where(eq(fields.id, kindColumnId));
  if (columnHeld !== undefined) return made;
  const column = {
    tableName: "features",
    name: "Kind",
    type: "choice",
    listId: kindListId,
    visibility: null,
    multiple: false,
    required: false,
    onPlannedHires: false,
  };
  await transaction.insert(fields).values({ id: kindColumnId, ...column });
  made.push(...recorded("field", kindColumnId, "created", column));
  return made;
}

// The choices of the lists the seeded features draw on, by list and name, as Fathom starts them.
async function builtInChoiceIds(
  reader: Reader,
): Promise<(list: string, name: string | undefined) => string | null> {
  const choices = await reader
    .select({ id: listItems.id, label: listItems.label, list: lists.builtIn })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(inArray(lists.builtIn, [...featureBuiltInLists]));
  const ids = new Map(
    choices.map(({ id, label, list }) => [`${String(list)}:${label}`, id]),
  );
  return (list, name) =>
    name === undefined ? null : (ids.get(`${list}:${name}`) ?? null);
}

// A schedule's id and cycles, and the place among them of the cycle the seed day falls in.
interface StreamPlacing {
  id: string;
  cycles: Cycle[];
  current: number;
}

function placingIn(name: StreamName, today: string): StreamPlacing {
  const stream = seededStreams(today).find(
    (seeded) => seeded.name === name,
  ) as SeededStream;
  const cycles = cyclesOf(stream.patterns, horizonFrom(today));
  const current = cycles.findIndex(
    ({ startsOn, endsOn }) => startsOn <= today && today <= endsOn,
  );
  return { id: streamId({ name }), cycles, current };
}

// Adds the features, once, if the schedules they target are there. Returns whether it added them.
export async function seedFeatures(
  database: Database,
  today: string,
  teamIds: readonly string[],
): Promise<boolean> {
  const placing = new Map(
    streamNames.map((name) => [name, placingIn(name, today)]),
  );
  return database.transaction(async (transaction) => {
    const [present] = await transaction
      .select({ id: features.id })
      .from(features)
      .where(inArray(features.id, seededIds()));
    const streamRows = await transaction
      .select({ id: releaseStreams.id })
      .from(releaseStreams)
      .where(
        inArray(
          releaseStreams.id,
          streamNames.map((name) => streamId({ name })),
        ),
      );
    if (present !== undefined || streamRows.length < streamNames.length) {
      return false;
    }
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
    const choiceIdOf = await builtInChoiceIds(transaction);
    const made: SeededChange[] = await seedKind(transaction);
    for (const feature of seededFeatures) {
      const id = featureId(feature.key);
      const statusId = statusIdOf.get(feature.status);
      if (statusId === undefined) {
        throw new Error(`No feature status means ${feature.status}`);
      }
      const {
        id: targetStreamId,
        cycles,
        current,
      } = placing.get(feature.stream ?? defaultStream) as StreamPlacing;
      const cycle =
        feature.cycle === null ? undefined : cycles.at(current + feature.cycle);
      const row = {
        name: feature.name,
        statusId,
        priorityId: choiceIdOf("feature-priorities", feature.priority),
        sizeId: choiceIdOf("feature-sizes", feature.size),
        riskId: choiceIdOf("feature-risks", feature.risk),
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
      const { kind } = feature;
      if (kind !== undefined) {
        await transaction.insert(fieldValues).values({
          fieldId: kindColumnId,
          featureId: id,
          choiceId: kindId(kind),
        });
      }
      made.push(
        ...recorded("feature", id, "created", {
          ...filledIn(row),
          ...(kind === undefined
            ? {}
            : { [valueField(kindColumnId)]: [kindId(kind)] }),
        }),
      );
    }
    await recordChanges(transaction, null, made);
    return true;
  });
}

// Removes the Kind column, with its values on features added by hand and every draft of it or
// that gives it a value, and its list, unless another column draws on the list or it has choices
// added by hand. Returns what it kept, in words.
async function unseedKind(
  transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
): Promise<string[]> {
  const [column] = await transaction
    .select()
    .from(fields)
    .where(eq(fields.id, kindColumnId));
  if (column === undefined) return [];
  const valueKey = valueField(kindColumnId);
  const handValues = await transaction
    .select()
    .from(fieldValues)
    .where(eq(fieldValues.fieldId, kindColumnId));
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
          and(eq(table.recordType, "field"), eq(table.recordId, kindColumnId)),
          and(
            eq(table.recordType, "feature"),
            sql`${table.fields} ? ${valueKey}::text`,
          ),
        ),
      );
  }
  await transaction.delete(fields).where(eq(fields.id, kindColumnId));
  const { id, ...columnFields } = column;
  const made: SeededChange[] = recorded("field", id, "deleted", columnFields);
  const kept: string[] = [];
  const drawing = await transaction
    .select({ id: fields.id })
    .from(fields)
    .where(eq(fields.listId, kindListId));
  const choices = await transaction
    .select()
    .from(listItems)
    .where(eq(listItems.listId, kindListId));
  const seededKinds = kinds.map(kindId);
  if (drawing.length > 0) kept.push("The Kind list, which a column uses");
  else if (choices.some(({ id }) => !seededKinds.includes(id))) {
    kept.push("The Kind list, which has choices added by hand");
  } else {
    const [list] = await transaction
      .select()
      .from(lists)
      .where(eq(lists.id, kindListId));
    await transaction.delete(lists).where(eq(lists.id, kindListId));
    made.push(
      ...recorded("list", kindListId, "deleted", {
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

// Takes the seeded features off every project and proposal that names them, including those kept
// for what was added by hand, each table in one update, returning the changes for the change
// history.
async function takeOffProjectsAndProposals(
  transaction: Pick<Database, "select" | "update">,
  ids: readonly string[],
): Promise<ChangeRecord[]> {
  const removed = sql`ARRAY[${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )}]::uuid[]`;
  const changed: ChangeRecord[] = [];
  for (const [recordType, table] of [
    ["project", projects],
    ["proposal", proposals],
  ] as const) {
    const naming = arrayOverlaps(table.featureIds, [...ids]);
    const before = await transaction
      .select({ id: table.id, featureIds: table.featureIds })
      .from(table)
      .where(naming);
    if (before.length === 0) continue;
    await transaction
      .update(table)
      .set({
        featureIds: sql`array(select kept from unnest(${table.featureIds}) with ordinality as named(kept, place) where kept <> all(${removed}) order by place)`,
      })
      .where(naming);
    changed.push(
      ...before.map(({ id, featureIds }) => ({
        recordType,
        recordId: id,
        action: "changed" as const,
        field: "featureIds",
        tier: "general",
        oldValue: featureIds,
        newValue: featureIds.filter((featureId) => !ids.includes(featureId)),
      })),
    );
  }
  return changed;
}

// Removes the features seeding added, every draft of them, every draft that names the seeded
// feature teams, whose features added by hand then have no feature team, and every draft of a
// project or proposal naming them, with the milestones of a project only drafted to be added; the
// features are taken off every project and proposal.
export async function unseedFeatures(
  database: Database,
  teamIds: readonly string[],
): Promise<string[]> {
  return database.transaction(async (transaction) => {
    const ids = seededIds();
    for (const table of [drafts, unpublishedDrafts]) {
      const naming = and(
        inArray(table.recordType, ["project", "proposal"]),
        linksAny(table.fields, "featureIds", ids),
      );
      // A project only drafted to be added goes with its draft, so the drafts of its milestones go
      // too.
      const addedProjects = (
        await transaction
          .select({ id: table.recordId })
          .from(table)
          .where(
            and(
              naming,
              eq(table.recordType, "project"),
              eq(table.action, "created"),
            ),
          )
      ).map(({ id }) => id);
      await transaction
        .delete(table)
        .where(
          or(
            and(
              eq(table.recordType, "feature"),
              or(
                inArray(table.recordId, ids),
                inArray(sql`${table.fields}->>'featureTeamId'`, [...teamIds]),
              ),
            ),
            naming,
            and(
              eq(table.recordType, "milestone"),
              inArray(sql`${table.fields}->>'projectId'`, addedProjects),
            ),
          ),
        );
    }
    const unlinked = await takeOffProjectsAndProposals(transaction, ids);
    const unteamed = await transaction
      .select({ id: features.id, teamId: features.featureTeamId })
      .from(features)
      .where(inArray(features.featureTeamId, [...teamIds]));
    await transaction
      .update(features)
      .set({ featureTeamId: null })
      .where(inArray(features.featureTeamId, [...teamIds]));
    const kindsOf = new Map(
      (
        await transaction
          .select()
          .from(fieldValues)
          .where(
            and(
              eq(fieldValues.fieldId, kindColumnId),
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
      ...unlinked,
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
          ...(kindsOf.has(id)
            ? { [valueField(kindColumnId)]: [kindsOf.get(id)] }
            : {}),
        }),
      ),
    ]);
    return unseedKind(transaction);
  });
}
