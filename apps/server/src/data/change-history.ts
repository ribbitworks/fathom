// SPDX-License-Identifier: Apache-2.0

// Reads the change history: the change sets saved, newest first, each holding only the changes the
// reader's roles let them see. Part of the data access layer. A change set holding none is left out
// altogether, so its timing reveals nothing, as is one holding another user's unpublished changes,
// until they publish them. Records are named by the latest name the history the reader sees holds
// for them, so a deleted record keeps its name, and identifiers in values are replaced by names.

import {
  changes,
  changeSets,
  type Database,
  fieldOfValue,
  inChunks,
  lists,
  users,
} from "@fathom/db";
import {
  builtInColumnNames,
  type ChangedField,
  type ChangedRecord,
  type ChangeEntry,
  changeKindSchema,
  type ChangeValue,
  isLink,
  linkInWords,
  matchesWords,
  recordSearchText,
  searchWords,
  type Tier,
  tierSchema,
} from "@fathom/shared";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { type Actor, mostSensitive, seesTier, storedTier } from "../access.ts";
import type { RecordType } from "./changes.ts";
import { rejectedField } from "./drafts.ts";
import { personTier } from "./people.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { viewTiersNow } from "./views.ts";

// The most recent change sets shown at once; older ones are read by naming the last one read. When
// change sets read are hidden or, in a search, do not match, reading goes on, up to ten times as many
// for one page.
const shownChangeSets = 200;
const searchedChangeSets = 2000;

// Configuration is seen by those who may open the configuration pages, and people and their saved
// views by those who may see people.
const configurationKinds: readonly RecordType[] = [
  "list",
  "list-item",
  "choice-order",
  "field",
  "column-order",
];
const peopleKinds: readonly RecordType[] = ["person", "saved-view"];

// The fields that name a record.
const nameFields = ["name", "label", "preferredName"];

// Fields that only tie a record to where it belongs, which the history does not show.
const unshownFields = new Set(["tableName", "createdBy"]);

type StoredChange = typeof changes.$inferSelect;

export interface ReadChangeHistory {
  entries: ChangeEntry[];
  next: string | null;
  // Whether any change shown is to Restricted or Confidential data, which the access history records.
  includedSensitive: boolean;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

// The identifiers a change's values refer to, which are named in its place.
function referencedIds(row: StoredChange): string[] {
  const values = [row.oldValue, row.newValue];
  if (fieldOfValue(row.field) !== null) {
    return [fieldOfValue(row.field) as string, ...values.flatMap(strings)];
  }
  if (row.recordType === "column-order" || row.recordType === "choice-order") {
    return values.flatMap(strings);
  }
  if (row.field === "listId" || row.field === "order") {
    return values.filter((value) => typeof value === "string");
  }
  return [];
}

interface Facts {
  // The latest name of each record.
  names: Map<string, string>;
  // The list each choice and column belongs to, latest first.
  lists: Map<string, string>;
  // The latest visibility recorded for each list, for lists deleted since.
  visibilities: Map<string, unknown>;
}

// The change sets the actor may see: all but those holding other users' unpublished changes.
const seenSets = (actor: Actor) =>
  or(eq(changeSets.unpublished, false), eq(changeSets.madeBy, actor.user.id));

// What the history the actor may see last recorded about each record: its name, its list, and a
// list's visibility.
async function readFacts(
  database: Database,
  actor: Actor,
  ids: readonly string[],
  facts: Facts = {
    names: new Map(),
    lists: new Map(),
    visibilities: new Map(),
  },
): Promise<Facts> {
  for (const chunk of inChunks([...new Set(ids)])) {
    const rows = await database
      .selectDistinctOn([changes.recordId, changes.field], {
        recordId: changes.recordId,
        field: changes.field,
        value: changes.newValue,
      })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(
        and(
          inArray(changes.recordId, chunk),
          inArray(changes.field, [...nameFields, "listId", "visibility"]),
          sql`${changes.newValue} IS NOT NULL`,
          seenSets(actor),
        ),
      )
      .orderBy(changes.recordId, changes.field, desc(changes.id));
    // Names, labels, and lists are always recorded as text.
    for (const { recordId, field, value } of rows) {
      if (field === "listId") facts.lists.set(recordId, String(value));
      else if (field === "visibility") facts.visibilities.set(recordId, value);
      else facts.names.set(recordId, String(value));
    }
  }
  return facts;
}

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

// What a value shows: text, yes or no, or several names, with identifiers named.
function shown(
  row: StoredChange,
  value: unknown,
  name: (id: string) => string | undefined,
): ChangeValue {
  const named = (ids: string[]) =>
    ids.flatMap((id) => {
      const found = builtInColumnNames.get(id) ?? name(id);
      return found === undefined ? [] : [found];
    });
  if (fieldOfValue(row.field) !== null && isLink(value)) {
    return linkInWords(value);
  }
  if (
    fieldOfValue(row.field) !== null ||
    row.recordType === "column-order" ||
    row.recordType === "choice-order"
  ) {
    return value === null ? null : named(strings(value));
  }
  if (row.field === "definition") return null;
  if (row.field === "listId" || row.field === "order") {
    return typeof value === "string" ? (name(value) ?? null) : null;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  return null;
}

// Leaves out the changes the actor may not see: those to kinds of record their roles do not cover,
// and those in tiers they do not see, as sensitive as they were when made or are now, whichever is
// more: a person's choices in a column whose list has since become more sensitive, or a saved view
// on such a column.
async function visibleRows(
  database: Database,
  actor: Actor,
  rows: readonly StoredChange[],
  facts: Facts,
  tierNow: (field: string) => Tier,
): Promise<{ row: StoredChange; tier: Tier }[]> {
  const listTier = await listTiersNow(database, facts);
  // A person's choices are as sensitive as the lists they come from, and as their column's list,
  // even once the column is deleted or draws on another list, and their links as the web link
  // column's visibility last recorded, even once the column is deleted.
  const valueTiers = (row: StoredChange): Tier[] => {
    const columnId = fieldOfValue(row.field);
    if (columnId === null) return [];
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
  const viewTiers =
    held.size === 0
      ? new Map<string, Tier>()
      : await viewTiersNow(database, held);
  return rows.flatMap((row) => {
    // A tier the server no longer knows is treated as the most sensitive rather than trusted.
    const recorded = storedTier(row.tier);
    const tier = mostSensitive([
      recorded,
      ...(row.recordType === "person" ? valueTiers(row) : []),
      ...(row.recordType === "saved-view"
        ? // Every view in the rows has its tier, found just above.
          [viewTiers.get(row.recordId) as Tier]
        : []),
    ]);
    return seesTier(actor, tier) ? [{ row, tier }] : [];
  });
}

// The records a change set changed, in the order first changed, each with the fields it changed.
function recordsOf(
  rows: readonly StoredChange[],
  names: Map<string, string>,
  listOf: Map<string, string>,
): ChangedRecord[] {
  const name = (id: string) => names.get(id);
  const records = new Map<string, ChangedRecord>();
  for (const row of rows) {
    const key = `${row.recordType} ${row.recordId} ${String(row.draft)}`;
    const listId = listOf.get(row.recordId);
    const record = records.get(key) ?? {
      kind: row.recordType,
      action: row.action,
      draft: row.draft,
      name: name(row.recordId) ?? null,
      list:
        row.recordType === "list-item" && listId !== undefined
          ? (name(listId) ?? null)
          : null,
      fields: [],
    };
    records.set(key, record);
    // Only a change says what changed; an added or deleted record is named alone.
    if (
      row.action !== "changed" ||
      unshownFields.has(row.field) ||
      (row.field === rejectedField && row.newValue === null) ||
      (row.recordType === "list-item" && row.field === "listId")
    ) {
      continue;
    }
    const columnId = fieldOfValue(row.field);
    const column = columnId === null ? undefined : name(columnId);
    const field: ChangedField = {
      field: columnId === null ? row.field : "value",
      ...(column === undefined ? {} : { column }),
      oldValue: shown(row, row.oldValue, name),
      newValue: shown(row, row.newValue, name),
    };
    record.fields.push(field);
  }
  return [...records.values()];
}

interface Batch {
  entries: { entry: ChangeEntry; sensitive: boolean }[];
  // The last change set read, to read on from, or null when there are no more.
  next: string | null;
}

// Up to a number of change sets saved before the one named, or the latest, holding a change the
// actor may see.
async function readBatch(
  database: Database,
  actor: Actor,
  mayShow: SQL | undefined,
  before: string | undefined,
  limit: number,
  tierNow: (field: string) => Tier,
): Promise<Batch> {
  const sets = await database
    .select({
      id: changeSets.id,
      kind: changeSets.kind,
      madeAt: changeSets.madeAt,
      madeBy: users.name,
    })
    .from(changeSets)
    .leftJoin(users, eq(users.id, changeSets.madeBy))
    .where(
      and(
        seenSets(actor),
        exists(
          database
            .select({ one: sql`1` })
            .from(changes)
            .where(and(eq(changes.changeSetId, changeSets.id), mayShow)),
        ),
        before === undefined
          ? undefined
          : // The inner query's columns name its own change set, the one asked for.
            sql`(${changeSets.madeAt}, ${changeSets.id}) < (${database
              .select({ madeAt: changeSets.madeAt, id: changeSets.id })
              .from(changeSets)
              .where(eq(changeSets.id, before))})`,
      ),
    )
    .orderBy(desc(changeSets.madeAt), desc(changeSets.id))
    .limit(limit + 1);
  const page = sets.slice(0, limit);
  const rows: StoredChange[] = [];
  for (const chunk of inChunks(page.map(({ id }) => id))) {
    rows.push(
      ...(await database
        .select()
        .from(changes)
        .where(and(inArray(changes.changeSetId, chunk), mayShow))
        .orderBy(asc(changes.id))),
    );
  }
  const facts = await readFacts(database, actor, [
    ...rows.map((row) => row.recordId),
    ...rows.flatMap((row) => referencedIds(row)),
  ]);
  // Lists named only through their choices and columns.
  await readFacts(
    database,
    actor,
    [...facts.lists.values()].filter((id) => !facts.names.has(id)),
    facts,
  );
  const visible = await visibleRows(database, actor, rows, facts, tierNow);
  const bySet = new Map<string, { rows: StoredChange[]; sensitive: boolean }>();
  for (const { row, tier } of visible) {
    const held = bySet.get(row.changeSetId) ?? { rows: [], sensitive: false };
    held.rows.push(row);
    held.sensitive ||= tier !== "general";
    bySet.set(row.changeSetId, held);
  }
  return {
    entries: page.flatMap((set) => {
      const held = bySet.get(set.id);
      return held === undefined
        ? []
        : [
            {
              entry: {
                id: set.id,
                // Unpublished changes all discarded at once are shown as drafts discarded, and a kind
                // the server no longer knows as saved changes.
                kind: changeKindSchema
                  .catch("edit")
                  .parse(set.kind === "withdrawal" ? "discard" : set.kind),
                madeAt: set.madeAt.toISOString(),
                madeBy: set.madeBy,
                records: recordsOf(held.rows, facts.names, facts.lists),
              },
              sensitive: held.sensitive,
            },
          ];
    }),
    // Older entries start after the last change set read, which a full batch always has. A change
    // set read but hidden since, because what it changed has become more sensitive, is skipped.
    next: sets.length > limit ? (page.at(-1) as { id: string }).id : null,
  };
}

// The text a search looks in: who saved the change set, and the names and values of what it changed.
function searchedText(entry: ChangeEntry): string {
  return [
    entry.madeBy ?? "Fathom",
    ...entry.records.map(recordSearchText),
  ].join(" ");
}

// The change sets saved before the one named, or the latest, holding a change the actor may see,
// and, when searching, holding every word searched for. Reading goes on until there is a page of
// entries or as many change sets have been read as one request may, and the next page goes on from
// there.
export async function readChangeHistory(
  database: Database,
  actor: Actor,
  before?: string,
  search = "",
): Promise<ReadChangeHistory> {
  const kinds = [
    ...(actor.permissions.includes("configuration:view")
      ? configurationKinds
      : []),
    ...(actor.permissions.includes("people:view") ? peopleKinds : []),
  ];
  const tiers = tierSchema.options.filter((tier) => seesTier(actor, tier));
  if (kinds.length === 0) {
    return { entries: [], next: null, includedSensitive: false };
  }
  const mayShow = and(
    inArray(changes.recordType, [...kinds]),
    inArray(changes.tier, tiers),
  );
  const words = searchWords(search);
  // Each column's tier now, read once for every batch.
  const tierNow = personTier(await columnsWithAdded(database, undefined));
  const found: Batch["entries"] = [];
  let next: string | null = before ?? null;
  let read = 0;
  do {
    const batch = await readBatch(
      database,
      actor,
      mayShow,
      next ?? undefined,
      shownChangeSets,
      tierNow,
    );
    found.push(
      ...batch.entries.filter(({ entry }) =>
        matchesWords(searchedText(entry), words),
      ),
    );
    next = batch.next;
    read += shownChangeSets;
  } while (
    next !== null &&
    found.length < shownChangeSets &&
    read < searchedChangeSets
  );
  return {
    entries: found.map(({ entry }) => entry),
    next,
    includedSensitive: found.some(({ sensitive }) => sensitive),
  };
}
