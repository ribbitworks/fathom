// SPDX-License-Identifier: Apache-2.0

// Which changes in the change history each reader may see, by the kinds and classes of data their
// roles cover. Part of the data access layer.

import {
  changes,
  changeSets,
  drafts,
  fieldOfValue,
  inChunks,
  lists,
  people,
} from "@fathom/db";
import {
  type ColumnTable,
  columnTableOf,
  columnTablePolicies,
  columnTables,
  type Permission,
  recordTypeSchema,
  seesClass,
  type Tier,
  tierSchema,
} from "@fathom/shared";
import { and, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import {
  type Actor,
  mostSensitive,
  seesSensitivity,
  type Sensitivity,
  storedTier,
  tierOfSensitivity,
} from "../access.ts";
import type { RecordType, StoredChange } from "./changes.ts";
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
import {
  type Facts,
  type HistoryReader,
  seenSets,
  strings,
} from "./history-names.ts";
import { madeInOrder } from "./history-order.ts";

// Configuration is seen by those who may open the configuration pages, and people by those who may
// see people. A table's columns go with its records, and saved views are seen by those who open
// their table's page.
const configurationKinds: readonly RecordType[] = [
  "list",
  "list-item",
  "choice-order",
];
const columnKinds: readonly RecordType[] = ["field"];
const judgedByClass = new Set<string>([...configurationKinds, ...columnKinds]);
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
  database: HistoryReader,
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
  if (row.recordType === "feature-team") {
    return (
      (!row.draft || actor.permissions.includes("people:view")) &&
      seesClass(actor.permissions, tier)
    );
  }
  // Configuration and columns are General data, seen without people.
  if (judgedByClass.has(row.recordType)) {
    return seesClass(actor.permissions, tier);
  }
  if (planKinds.includes(row.recordType as RecordType)) {
    return (
      seenPlan.includes(row.recordType as RecordType) && tier === "general"
    );
  }
  return sensitivities.every((each) => seesSensitivity(actor, each));
}

// Leaves out the changes the actor may not see: those to kinds of record their role does not cover,
// those kept with another user's personal saved view, and those in tiers they do not see, as sensitive as
// they were when made or are now, whichever is more: a person's choices in a column whose list has
// since become more sensitive, or a saved view on such a column.
export async function visibleRows(
  database: HistoryReader,
  actor: Actor,
  rows: readonly StoredChange[],
  facts: Facts,
  tierNow: (field: string) => Tier,
): Promise<{ row: StoredChange; tier: Tier }[]> {
  const listTier = await listTiersNow(database, facts);
  const hireTierNow = await readHireTier(database);
  // A person's details are as sensitive as they are now, such as a position as its list, their
  // choices, and a planned hire's, as the lists they come from, and as their column's list, even
  // once the column is deleted or draws on another list, and their links as the web link column's
  // visibility last recorded, even once the column is deleted.
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
  return rows.flatMap((row) => {
    // A tier the server no longer knows is treated as the most sensitive rather than trusted.
    const recorded = storedTier(row.tier);
    // Each tier is its own permission, so the reader must see every one of them, not only the most
    // sensitive.
    const tiers = [
      recorded,
      ...(row.recordType === "person" ? valueTiers(row) : []),
      ...(row.recordType === "feature-team"
        ? [featureTeamTier(actor.dataClasses)(row.field)]
        : []),
      ...(row.recordType === "planned-hire"
        ? [
            hireTierNow(row.field),
            ...(fieldOfValue(row.field) === null ? [] : valueTiers(row)),
          ]
        : []),
      ...(row.recordType === "saved-view"
        ? // Every view in the rows has its tier, found just above.
          [(views.get(row.recordId) as ViewNow).tier]
        : []),
    ];
    // A hire's own details are seen with the hiring plan, whatever tier they were recorded at.
    const sensitivities =
      row.recordType === "planned-hire"
        ? hireSensitivities(row.field, tiers)
        : tiers;
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
// by the last dates recorded for them that the actor may see, such as for someone removed, never
// another user's private change. Planned hires are never among them.
export async function notCurrentAmong(
  database: HistoryReader,
  actor: Actor,
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
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(
        and(
          eq(changes.recordType, "person"),
          inArray(changes.field, ["startDate", "endDate"]),
          inArray(changes.recordId, chunk),
          seenSets(actor),
        ),
      )
      .orderBy(...madeInOrder)) {
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

// The changes of some kinds an area the actor sees shows: those at a tier the actor sees, or to one
// of some fields whatever their tier, and, for columns, those of the tables given.
interface ShownChanges {
  kinds: readonly string[];
  tiers: readonly Tier[];
  fields?: readonly string[];
  tables?: readonly ColumnTable[];
}

// The tables whose columns' changes the actor sees: those whose records they see.
const seenColumnTables = (actor: Actor): ColumnTable[] =>
  columnTables.filter((table) =>
    // The table is always one of the fixed tables.
    // eslint-disable-next-line security/detect-object-injection
    actor.permissions.includes(columnTablePolicies[table].viewNeeds),
  );

// The changes each area the actor sees shows. Configuration and columns are General data whether
// or not the role sees people, so each area shows the classes the role sees.
function shownAreas(actor: Actor): ShownChanges[] {
  const has = (permission: Permission) =>
    actor.permissions.includes(permission);
  const tiers = tierSchema.options.filter((tier) =>
    seesClass(actor.permissions, tier),
  );
  const plan = seenPlanKinds(actor);
  const tables = seenColumnTables(actor);
  const areas: (ShownChanges | false)[] = [
    has("configuration:view") && { kinds: configurationKinds, tiers },
    tables.length > 0 && { kinds: columnKinds, tiers, tables },
    has("people:view") && { kinds: peopleKinds, tiers },
    // A hire's own details are recorded as Confidential, but seen with the hiring plan.
    has("people:view") &&
      seesSensitivity(actor, "hiring-plan") && {
        kinds: hiringKinds,
        tiers,
        fields: hiringPlanFields,
      },
    has("feature-teams:view") && { kinds: ["feature-team"], tiers },
    plan.length > 0 && { kinds: plan, tiers: ["general"] },
    // Which table's views, and the classes they use now, are checked change by change.
    opensAnyViews(actor) && { kinds: ["saved-view"], tiers },
  ];
  return areas.filter((area) => area !== false);
}

const columnKind: RecordType = "field";
const tableField = "tableName";

// The table of the column a change is to, as its history last recorded it, or People for one
// recorded before columns had tables, as columnTableOf has it. One expression for the history's
// filter and for readColumnTables.
function columnTableOfChange(): SQL {
  const recorded = (column: { name: string }) =>
    sql`recorded.${sql.identifier(column.name)}`;
  return sql`coalesce((
    SELECT ${recorded(changes.newValue)} #>> '{}'
    FROM ${changes} AS recorded
    WHERE ${recorded(changes.recordType)} = ${columnKind}
      AND ${recorded(changes.recordId)} = ${changes.recordId}
      AND ${recorded(changes.field)} = ${tableField}
      AND ${recorded(changes.newValue)} IS NOT NULL
    ORDER BY ${recorded(changes.id)} DESC
    LIMIT 1
  ), ${columnTableOf(undefined)})`;
}

// Which changes the actor may see: those of the kinds and classes each area they see shows, or none.
export function changesShownTo(actor: Actor): SQL | undefined {
  return or(
    ...shownAreas(actor).map(({ kinds, tiers, fields, tables }) =>
      and(
        inArray(changes.recordType, [...kinds]),
        fields === undefined
          ? inArray(changes.tier, [...tiers])
          : or(
              inArray(changes.tier, [...tiers]),
              inArray(changes.field, [...fields]),
            ),
        tables === undefined
          ? undefined
          : inArray(columnTableOfChange(), [...tables]),
      ),
    ),
  );
}

// The table of each column given, as its history last recorded it, for showsChange.
export async function readColumnTables(
  reader: HistoryReader,
  ids: readonly string[],
): Promise<Map<string, ColumnTable>> {
  const found = new Map<string, ColumnTable>();
  for (const chunk of inChunks([...new Set(ids)])) {
    const rows = await reader
      .selectDistinctOn([changes.recordId], {
        recordId: changes.recordId,
        table: sql<string>`${columnTableOfChange()}`,
      })
      .from(changes)
      .where(
        and(
          eq(changes.recordType, columnKind),
          inArray(changes.recordId, chunk),
        ),
      );
    for (const { recordId, table } of rows) {
      found.set(recordId, columnTableOf(table));
    }
  }
  return found;
}

// The same rule as changesShownTo, for a change not read from the history, such as a value not yet
// saved, given the tables of the columns it may be to.
export function showsChange(
  actor: Actor,
  tablesOf: ReadonlyMap<string, ColumnTable>,
): (
  change: Pick<StoredChange, "recordType" | "recordId" | "field" | "tier">,
) => boolean {
  const areas = shownAreas(actor);
  return ({ recordType, recordId, field, tier }) =>
    areas.some(
      (area) =>
        area.kinds.includes(recordType) &&
        (area.tiers.includes(storedTier(tier)) ||
          (area.fields ?? []).includes(field)) &&
        (area.tables === undefined ||
          area.tables.includes(
            tablesOf.get(recordId) ?? columnTableOf(undefined),
          )),
    );
}
