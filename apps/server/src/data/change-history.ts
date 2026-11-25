// SPDX-License-Identifier: Apache-2.0

// Reading the change history: the change sets saved, newest first, each holding only the changes
// the reader may see. Part of the data access layer.

import {
  changes,
  changeSets,
  type Database,
  fieldOfValue,
  inChunks,
  roles,
  users,
} from "@fathom/db";
import {
  type ChangedField,
  type ChangedRecord,
  type ClassAccess,
  type ChangeEntry,
  changeKindSchema,
  matchesWords,
  recordSearchText,
  searchWords,
  seesEmployment,
  opensWith,
  pageNeeds,
  type Tier,
} from "@fathom/shared";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Actor } from "../access.ts";
import { rejectedField } from "./draft-records.ts";
import { hiddenPeople } from "./people-reads.ts";
import { readToday } from "./settings.ts";
import { personTier } from "./person-fields.ts";
import { columnsWithAdded } from "./added-columns.ts";
import {
  belonging,
  nameByParts,
  nameHires,
  namesMembers,
  partsOf,
  readFacts,
  referencedIds,
  unseenValueName,
  seenSets,
  shown,
  strings,
} from "./history-names.ts";
import {
  changesShownTo,
  notCurrentAmong,
  teamRowKey,
  teamRowShowsNoOne,
  visibleRows,
} from "./history-visibility.ts";
import type { StoredChange } from "./changes.ts";

// The most recent change sets shown at once; older ones are read by naming the last one read. When
// change sets read are hidden or, in a search, do not match, reading goes on, up to ten times as
// many for one page.
const shownChangeSets = 200;
const searchedChangeSets = 2000;

// Fields that only tie a record to where it belongs, which the history does not show.
const unshownFields = new Set(["tableName", "createdBy"]);

export interface ReadChangeHistory {
  entries: ChangeEntry[];
  next: string | null;
  // Whether any change shown is to Personal or Confidential data, which the access history
  // records.
  includedSensitive: boolean;
}

// The people a change names, whom a reader who doesn't see start and end dates may not see while
// they haven't started or once they have left: the person changed, a team's members and lead, and a
// hire's manager or filler.
export function peopleNamedBy(row: StoredChange): string[] {
  if (row.recordType === "person") return [row.recordId];
  if (namesMembers(row)) return [row.oldValue, row.newValue].flatMap(strings);
  return (row.recordType === "planned-hire" &&
    (row.field === "managerId" || row.field === "filledBy")) ||
    (row.recordType === "feature-team" && row.field === "leadId")
    ? valuesNamed(row)
    : [];
}

// The owners a change names, whom the plan hides only while they haven't started, naming those who
// have left as retired.
export const ownersNamedBy = (row: StoredChange): string[] =>
  (row.recordType === "project" || row.recordType === "proposal") &&
  row.field === "ownerId"
    ? valuesNamed(row)
    : [];

const valuesNamed = (row: StoredChange) =>
  [row.oldValue, row.newValue].filter(
    (value): value is string => typeof value === "string",
  );

// The records a change set changed, in the order first changed, each with the fields it changed.
function recordsOf(
  rows: readonly StoredChange[],
  names: Map<string, string>,
  listOf: Map<string, string>,
  hidden: ReadonlySet<string>,
  seesPersonal: boolean,
  access: ClassAccess,
): ChangedRecord[] {
  const name = (id: string) => names.get(id);
  // People the reader does not see are named nowhere, such as a hire's manager. Who fills a hire is
  // named only to readers who see Personal details, since it tells of their reporting line to
  // come.
  const valueName = (row: StoredChange) => {
    const unseen = unseenValueName(row, access);
    return (id: string) =>
      hidden.has(id) ||
      (!seesPersonal &&
        row.recordType === "planned-hire" &&
        row.field === "filledBy")
        ? undefined
        : (unseen ?? name(id));
  };
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
        belonging.has(row.recordType) && listId !== undefined
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
      belonging.get(row.recordType) === row.field
    ) {
      continue;
    }
    const columnId = fieldOfValue(row.field);
    const column = columnId === null ? undefined : name(columnId);
    const field: ChangedField = {
      field: columnId === null ? row.field : "value",
      ...(column === undefined ? {} : { column }),
      oldValue: shown(row, row.oldValue, valueName(row)),
      newValue: shown(row, row.newValue, valueName(row)),
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
      madeAs: roles.name,
    })
    .from(changeSets)
    .leftJoin(users, eq(users.id, changeSets.madeBy))
    .leftJoin(roles, eq(roles.id, changeSets.madeAsRoleId))
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
  // A hire's manager may be a planned hire too, named as any hire is.
  const hireRows = rows.filter((row) => row.recordType === "planned-hire");
  await nameHires(
    database,
    actor,
    [
      ...hireRows.map((row) => row.recordId),
      ...hireRows
        .filter((row) => row.field === "managerId")
        .flatMap((row) => [row.oldValue, row.newValue])
        .filter((value): value is string => typeof value === "string"),
    ],
    facts,
  );
  const parts = await partsOf(database, rows);
  await nameByParts(database, actor, rows, parts, facts);
  // Lists named only through their choices and columns.
  await readFacts(
    database,
    actor,
    [...facts.lists.values()].filter((id) => !facts.names.has(id)),
    facts,
  );
  // Readers who do not see start and end dates see nobody who has not started or has left, as People
  // hides them: neither a person's own changes, nor records about them, nor a hire's manager or
  // filler, a team's lead, or a project's or proposal's owner naming them, an owner only while not
  // yet started, as the plan names one who has left as retired.
  const seesPersonal = seesEmployment(actor);
  const today = await readToday(database);
  const hidden = seesPersonal
    ? new Set<string>()
    : new Set([
        ...(await notCurrentAmong(
          database,
          [...new Set(rows.flatMap(peopleNamedBy))],
          today,
        )),
        ...(await hiddenPeople(
          database,
          actor,
          rows.flatMap(ownersNamedBy),
          today,
        )),
      ]);
  const seenRows = (
    await visibleRows(database, actor, rows, facts, tierNow)
  ).filter(
    ({ row }) => !(row.recordType === "person" && hidden.has(row.recordId)),
  );
  // A change to a team's members or lead that only those the reader does not see are part of shows
  // nothing to them, and neither does the rejection cleared with it.
  const nothingSeen = new Set(
    seenRows
      .filter(({ row }) => teamRowShowsNoOne(row, hidden))
      .map(({ row }) => teamRowKey(row)),
  );
  const visible = seenRows.filter(
    ({ row }) =>
      !teamRowShowsNoOne(row, hidden) &&
      !(row.field === rejectedField && nothingSeen.has(teamRowKey(row))),
  );
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
                // Unpublished changes all discarded at once are shown as drafts discarded, and a
                // kind the server no longer knows as saved changes.
                kind: changeKindSchema
                  .catch("edit")
                  .parse(set.kind === "withdrawal" ? "discard" : set.kind),
                madeAt: set.madeAt.toISOString(),
                madeBy: set.madeBy,
                madeAs: set.madeAs,
                records: recordsOf(
                  held.rows,
                  facts.names,
                  facts.lists,
                  hidden,
                  seesPersonal,
                  actor,
                ),
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

// The text a search looks in: who saved the change set, and the names and values of what it
// changed.
function searchedText(entry: ChangeEntry): string {
  return [
    entry.madeBy ?? "Fathom",
    ...entry.records.map(recordSearchText),
  ].join(" ");
}

// Whether the change history shows the actor a record's removal, as the History page would, with
// nothing since: undoing a removal puts the record back, live, as a later change.
export async function historyShowsRemoval(
  database: Database,
  actor: Actor,
  recordId: string,
): Promise<boolean> {
  const mayShow = opensWith(pageNeeds.changes, actor)
    ? changesShownTo(actor)
    : undefined;
  if (mayShow === undefined) return false;
  const [latest] = await database
    .select({ action: changes.action, changeSetId: changes.changeSetId })
    .from(changes)
    .where(and(eq(changes.recordId, recordId), eq(changes.draft, false)))
    .orderBy(desc(changes.id))
    .limit(1);
  if (latest?.action !== "deleted") return false;
  const [shown] = await database
    .select({ id: changes.id })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(
      and(
        eq(changes.changeSetId, latest.changeSetId),
        eq(changes.recordId, recordId),
        eq(changes.action, "deleted"),
        mayShow,
        seenSets(actor),
      ),
    )
    .limit(1);
  return shown !== undefined;
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
  const mayShow = changesShownTo(actor);
  if (mayShow === undefined) {
    return { entries: [], next: null, includedSensitive: false };
  }
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
