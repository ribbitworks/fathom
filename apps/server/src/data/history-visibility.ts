// SPDX-License-Identifier: Apache-2.0

// Which changes in the change history each reader may see, by the kinds and classes of data their
// roles cover. Part of the data access layer.

import {
  changes,
  type Database,
  drafts,
  fieldOfValue,
  inChunks,
  lists,
  people,
} from "@fathom/db";
import {
  recordTypeSchema,
  seesClass,
  type Tier,
  tierSchema,
} from "@fathom/shared";
import { and, asc, desc, eq, inArray, lt, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  type Actor,
  mostSensitive,
  seesSensitivity,
  type Sensitivity,
  storedTier,
  tierOfSensitivity,
} from "../access.ts";
import {
  isPrivateRecordType,
  type RecordType,
  type StoredChange,
} from "./changes.ts";
import { rejectedField } from "./draft-records.ts";
import { featureTeamTier } from "./feature-team-sight.ts";
import {
  hireSensitivities,
  hiringPlanFields,
  readHireTier,
} from "./hire-fields.ts";
import { currentOn } from "./people-reads.ts";
import { readsKind } from "./record-state.ts";
import { recordKinds } from "./records.ts";
import {
  opensAnyViews,
  readKeptViewChanges,
  seesViewHistory,
  type ViewNow,
  viewsNow,
} from "./views.ts";
import { type Facts, strings } from "./history-names.ts";
import { ownPrivateChanges } from "./private-history.ts";

// Configuration is seen by those who may open the configuration pages, and people by those who may
// see people. Saved views are seen by those who open their table's page.
const configurationKinds: readonly RecordType[] = [
  "list",
  "list-item",
  "choice-order",
  "field",
];
const peopleKinds: readonly RecordType[] = ["person"];

// The hiring plan, by those who see people and the hiring plan.
const hiringKinds: readonly RecordType[] = ["planned-hire"];

// The plan's records, such as release streams, and the planning settings.
const planKinds: readonly RecordType[] = recordTypeSchema.options;

// The kinds of the plan's records the actor sees: General plan data, seen with the permissions each
// kind is read with rather than through the tiers of people's data, and, for a kind that needs one,
// with every class of data its view needs.
const seenPlanKinds = (actor: Actor): RecordType[] =>
  recordKinds.filter((kind) => readsKind(kind, actor)).map((kind) => kind.type);

// Each list's visibility now: as it is, or, for a list deleted since, as it was last recorded. A
// tier the server no longer knows is treated as the most sensitive rather than trusted.
async function listTiersNow(
  database: Database,
  facts: Facts,
): Promise<(listId: string | undefined) => Tier> {
  const ids = [...new Set(facts.lists.values())];
  const tiers = new Map<string, Tier>(
    [...facts.visibilities].map(([id, value]) => [id, storedTier(value)]),
  );
  for (const chunk of inChunks(ids)) {
    const rows = await database
      .select({ id: lists.id, visibility: lists.visibility })
      .from(lists)
      .where(inArray(lists.id, chunk));
    for (const { id, visibility } of rows) {
      tiers.set(id, storedTier(visibility));
    }
  }
  return (listId) =>
    listId === undefined ? "general" : (tiers.get(listId) ?? "general");
}

// Whether the actor sees a change, by the rule of its kind of record. Feature teams' details are
// seen with View Feature teams and the classes they are kept in, whether or not the reader sees
// people, but their drafts only with people.
function seesRowOfKind(
  actor: Actor,
  row: StoredChange,
  tier: Tier,
  sensitivities: readonly Sensitivity[],
  seenPlan: readonly RecordType[],
): boolean {
  // Only the changes to the actor's own pages are read at all; each is seen in every class it was
  // made in and is in now.
  if (isPrivateRecordType(row.recordType)) {
    return sensitivities.every((each) =>
      seesClass(actor.permissions, tierOfSensitivity(actor.dataClasses)(each)),
    );
  }
  if (row.recordType === "feature-team") {
    return (
      (!row.draft || actor.permissions.includes("people:view")) &&
      seesClass(actor.permissions, tier)
    );
  }
  if (planKinds.includes(row.recordType as RecordType)) {
    return (
      seenPlan.includes(row.recordType as RecordType) && tier === "general"
    );
  }
  return sensitivities.every((each) => seesSensitivity(actor, each));
}

// A record's draft as a rejection found it, from the latest change to each of the record's fields
// up to the rejection: each that is a change to its draft, other than a rejection's own reason. A
// field changed live since, as by approving the draft or removing an unrelated column, is not the
// draft's. A field whose latest change took a draft's value back, by a discard, still counts, since
// that change holds the value taken back; a reason is never judged as less sensitive than its draft.
export const draftAsRejected = (
  latestByField: readonly StoredChange[],
): StoredChange[] =>
  latestByField.filter(
    (change) => change.draft && change.field !== rejectedField,
  );

// Changes saved with the rejection count too, as undoing a discard restores a rejected draft's reason
// before its values.
export async function readRejected(
  database: Database,
  rows: readonly StoredChange[],
): Promise<Map<number, StoredChange[]>> {
  const rejections = rows.filter((row) => row.field === rejectedField);
  const latest = new Map<number, StoredChange[]>(
    rejections.map(({ id }) => [id, []]),
  );
  const rejection = alias(changes, "rejection");
  for (const chunk of inChunks(rejections.map(({ id }) => id))) {
    const found = await database
      .selectDistinctOn([rejection.id, changes.field], {
        rejectionId: rejection.id,
        change: changes,
      })
      .from(changes)
      .innerJoin(
        rejection,
        and(
          eq(rejection.recordType, changes.recordType),
          eq(rejection.recordId, changes.recordId),
          or(
            lt(changes.id, rejection.id),
            eq(changes.changeSetId, rejection.changeSetId),
          ),
        ),
      )
      .where(inArray(rejection.id, chunk))
      .orderBy(rejection.id, changes.field, desc(changes.id));
    for (const { rejectionId, change } of found) {
      latest.get(rejectionId)?.push(change);
    }
  }
  return new Map(
    [...latest].map(([id, byField]) => [id, draftAsRejected(byField)]),
  );
}

// Leaves out the changes the actor may not see: those to kinds of record their role does not cover,
// those kept with another user's personal saved view, and those in tiers they do not see, as sensitive as
// they were when made or are now, whichever is more: a person's choices in a column whose list has
// since become more sensitive, or a saved view on such a column.
export async function visibleRows(
  database: Database,
  actor: Actor,
  rows: readonly StoredChange[],
  facts: Facts,
  tierNow: (field: string) => Tier,
  rejected: ReadonlyMap<number, readonly StoredChange[]>,
): Promise<{ row: StoredChange; tier: Tier }[]> {
  const listTier = await listTiersNow(database, facts);
  const hireTierNow = await readHireTier(database);
  // A person's details are as sensitive as they are now, such as a position as its list, their
  // choices, and a planned hire's, as the lists they come from, and as their column's list, even
  // once the column is deleted or draws on another list, and their links as the web link column's
  // visibility last recorded, even once the column is deleted. A private row's values are judged
  // the same way, by their column's class and list now.
  const valueTiers = (row: StoredChange): Tier[] => {
    const columnId = fieldOfValue(row.field);
    if (columnId === null) return [tierNow(row.field)];
    const visibility = facts.visibilities.get(columnId);
    return [
      tierNow(row.field),
      listTier(facts.lists.get(columnId)),
      ...(visibility === undefined ? [] : [storedTier(visibility)]),
      ...[row.oldValue, row.newValue]
        .flatMap(strings)
        .map((choiceId) => listTier(facts.lists.get(choiceId))),
    ];
  };
  // Every definition each view has had, so a view renamed on a page without its definition still
  // has the tier of the columns it uses.
  const viewIds = [
    ...new Set(
      rows
        .filter((row) => row.recordType === "saved-view")
        .map(({ recordId }) => recordId),
    ),
  ];
  const held = new Map<string, unknown[]>(viewIds.map((id) => [id, []]));
  for (const chunk of inChunks(viewIds)) {
    const definitions = await database
      .select({
        recordId: changes.recordId,
        oldValue: changes.oldValue,
        newValue: changes.newValue,
      })
      .from(changes)
      .where(
        and(
          eq(changes.recordType, "saved-view"),
          eq(changes.field, "definition"),
          inArray(changes.recordId, chunk),
        ),
      );
    for (const { recordId, oldValue, newValue } of definitions) {
      (held.get(recordId) as unknown[]).push(oldValue, newValue);
    }
  }
  const views =
    held.size === 0
      ? new Map<string, ViewNow>()
      : await viewsNow(database, actor, held);
  const keptViewChange = await readKeptViewChanges(database, actor, viewIds);
  const seenPlan = seenPlanKinds(actor);
  const tiersNow = (row: StoredChange): Tier[] => [
    ...(row.recordType === "person" || row.recordType === "private-row"
      ? valueTiers(row)
      : []),
    ...(row.recordType === "feature-team"
      ? [featureTeamTier(actor.dataClasses)(row.field)]
      : []),
    ...(row.recordType === "planned-hire"
      ? [
          hireTierNow(row.field),
          ...(fieldOfValue(row.field) === null ? [] : valueTiers(row)),
        ]
      : []),
  ];
  // What a reader needs to see a change: each tier it was recorded at or has now, since each is its
  // own permission, not only the most sensitive. A tier the server no longer knows is treated as the
  // most sensitive rather than trusted. A hire's own details are seen with the hiring plan, whatever
  // tier they were recorded at.
  const sensitivitiesOf = (
    row: StoredChange,
    also: readonly Tier[] = [],
  ): Sensitivity[] => {
    const tiers = [storedTier(row.tier), ...tiersNow(row), ...also];
    return row.recordType === "planned-hire"
      ? hireSensitivities(row.field, tiers)
      : tiers;
  };
  return rows.flatMap((row) => {
    // A rejection's reason needs what each change it rejected needs too.
    const sensitivities = [
      ...sensitivitiesOf(
        row,
        row.recordType === "saved-view"
          ? // Every view in the rows has its tier, found just above.
            [(views.get(row.recordId) as ViewNow).tier]
          : [],
      ),
      ...(rejected.get(row.id) ?? []).flatMap((change) =>
        sensitivitiesOf(change),
      ),
    ];
    const tier = mostSensitive(
      sensitivities.map(tierOfSensitivity(actor.dataClasses)),
    );
    const seen =
      row.recordType === "saved-view"
        ? !keptViewChange(row) &&
          seesViewHistory(
            actor,
            views.get(row.recordId) as ViewNow,
            sensitivities.map(tierOfSensitivity(actor.dataClasses)),
          )
        : seesRowOfKind(actor, row, tier, sensitivities, seenPlan);
    return seen ? [{ row, tier }] : [];
  });
}

// Which of the people and planned hires given are people not current today, who have not started
// or have left: by their dates when live, by the draft adding them when only drafted, and otherwise
// by the last dates recorded for them, such as for someone removed. Planned hires are never among
// them.
export async function notCurrentAmong(
  database: Database,
  ids: readonly string[],
  today: string,
): Promise<Set<string>> {
  const dates = new Map<string, { startDate?: unknown; endDate?: unknown }>();
  for (const chunk of inChunks([...ids])) {
    for (const { id, startDate, endDate } of await database
      .select({
        id: people.id,
        startDate: people.startDate,
        endDate: people.endDate,
      })
      .from(people)
      .where(inArray(people.id, chunk))) {
      dates.set(id, { startDate, endDate });
    }
  }
  const unknown = () => ids.filter((id) => !dates.has(id));
  for (const chunk of inChunks(unknown())) {
    for (const { recordId, fields } of await database
      .select({ recordId: drafts.recordId, fields: drafts.fields })
      .from(drafts)
      .where(
        and(
          eq(drafts.recordType, "person"),
          eq(drafts.action, "created"),
          inArray(drafts.recordId, chunk),
        ),
      )) {
      dates.set(recordId, fields);
    }
  }
  for (const chunk of inChunks(unknown())) {
    for (const { recordId, action, field, oldValue, newValue } of await database
      .select({
        recordId: changes.recordId,
        action: changes.action,
        field: changes.field,
        oldValue: changes.oldValue,
        newValue: changes.newValue,
      })
      .from(changes)
      .where(
        and(
          eq(changes.recordType, "person"),
          inArray(changes.field, ["startDate", "endDate"]),
          inArray(changes.recordId, chunk),
        ),
      )
      .orderBy(asc(changes.id))) {
      // Removing someone records the dates they had; any other change records the dates it set.
      dates.set(recordId, {
        ...dates.get(recordId),
        [field]: action === "deleted" ? oldValue : newValue,
      });
    }
  }
  return new Set(
    [...dates].flatMap(([id, recorded]) =>
      currentOn(recorded, today) ? [] : [id],
    ),
  );
}

export const teamRowKey = (row: StoredChange) =>
  `${row.changeSetId} ${row.recordId} ${String(row.draft)}`;

// Whether a change to a team's members or lead changes no one the reader sees, once those hidden
// from them are taken out of its old and new values.
export function teamRowShowsNoOne(
  row: StoredChange,
  hidden: ReadonlySet<string>,
): boolean {
  if (
    hidden.size === 0 ||
    row.recordType !== "feature-team" ||
    row.action !== "changed" ||
    (row.field !== "members" && row.field !== "leadId")
  ) {
    return false;
  }
  const seenOf = (value: unknown) =>
    (typeof value === "string" ? [value] : strings(value))
      .filter((id) => !hidden.has(id))
      .sort()
      .join();
  return seenOf(row.oldValue) === seenOf(row.newValue);
}

// Which changes the actor may see: those of the kinds and classes each area they see shows, or none.
export function changesShownTo(actor: Actor): SQL | undefined {
  const kinds = [
    ...(actor.permissions.includes("configuration:view")
      ? configurationKinds
      : []),
    ...(actor.permissions.includes("people:view") ? peopleKinds : []),
  ];
  const teams = actor.permissions.includes("feature-teams:view");
  const hiring =
    actor.permissions.includes("people:view") &&
    seesSensitivity(actor, "hiring-plan");
  const plan = seenPlanKinds(actor);
  const tiers = tierSchema.options.filter((tier) =>
    seesSensitivity(actor, tier),
  );
  const views = opensAnyViews(actor);
  return or(
    kinds.length === 0
      ? undefined
      : and(
          inArray(changes.recordType, [...kinds]),
          inArray(changes.tier, tiers),
        ),
    // A hire's own details are recorded as Confidential, but seen with the hiring plan.
    hiring
      ? and(
          inArray(changes.recordType, [...hiringKinds]),
          or(
            inArray(changes.tier, tiers),
            inArray(changes.field, [...hiringPlanFields]),
          ),
        )
      : undefined,
    teams
      ? and(
          eq(changes.recordType, "feature-team"),
          or(eq(changes.tier, "general"), inArray(changes.tier, tiers)),
        )
      : undefined,
    plan.length > 0
      ? and(inArray(changes.recordType, plan), eq(changes.tier, "general"))
      : undefined,
    // Which table's views, and the classes they use now, are checked change by change.
    views
      ? and(
          eq(changes.recordType, "saved-view"),
          inArray(
            changes.tier,
            tierSchema.options.filter((tier) =>
              seesClass(actor.permissions, tier),
            ),
          ),
        )
      : undefined,
    ownPrivateChanges(actor),
  );
}
