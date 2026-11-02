// SPDX-License-Identifier: Apache-2.0

// Draft rows: the changes waiting for approval, as the Decisions Log sets out. Part of the data
// access layer. Each person, list, and choice has at most one draft, which adds it, changes some of
// its fields, or removes it, and each list's choices have at most one draft of their order; everyone
// who sees the records sees the drafts in place of the live values. A draft is kept as the change
// history records the record, holding all of an added record's fields, only the fields that differ
// from the live record, or none for a removal, and the live record changes only when an Approver
// approves it.

import {
  changes,
  changeSets,
  type Database,
  drafts,
  fieldOfValue,
  inChunks,
  people,
  users,
} from "@fathom/db";
import { type Tier, tierSchema } from "@fathom/shared";
import { and, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { mostSensitive } from "../access.ts";
import type { Change, Transaction } from "./changes.ts";
import type { ColumnInfo } from "./values.ts";

type Reader = Pick<Database, "select">;

// A record as the change history records it, such as a person's details and each column's choices,
// left out when none are chosen.
export type Recorded = Record<string, unknown>;

export type DraftRow = typeof drafts.$inferSelect;

// The kinds of record that have drafts. A list's choice order is one record, named by its list.
export type DraftType = "person" | "list" | "list-item" | "choice-order";

export interface Draft {
  action: Change["action"];
  fields: Recorded;
  state: "waiting" | "rejected";
  reason: string | null;
  // Rises with each draft made, so records drafted to be added keep the order they were drafted in.
  sequence: number;
}

// The history field that holds a rejected draft's reason, which waiting drafts do not have.
export const rejectedField = "rejected";

// Values as stored, so lists of choices compare by what they hold.
const same = (first: unknown, second: unknown) =>
  JSON.stringify(first ?? null) === JSON.stringify(second ?? null);

// A person's choices for a column, cleared when there are none.
const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.length === 0);

// A person with columns that have nothing chosen left out, as the history records them.
export function tidy(record: Recorded): Recorded {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([field, value]) => fieldOfValue(field) === null || !isEmpty(value),
    ),
  );
}

function toDraft(row: DraftRow): Draft {
  return {
    action: row.action as Change["action"],
    fields: row.fields,
    state: row.state === "rejected" ? "rejected" : "waiting",
    reason: row.reason,
    sequence: row.sequence,
  };
}

// The person as their draft makes them: undefined once removed, or before they are added.
export function drafted(
  live: Recorded | undefined,
  draft: Draft | undefined,
): Recorded | undefined {
  if (draft === undefined) return live;
  if (draft.action === "created") return draft.fields;
  // A change or removal of someone no longer live, as when seed data is removed, makes no one.
  if (draft.action === "deleted" || live === undefined) return undefined;
  return tidy({ ...live, ...draft.fields });
}

// The draft that makes a live person, or no one, into the person wanted: undefined when nothing
// differs. A column cleared in a draft holds no choices, so it is not taken for unchanged.
export function draftBetween(
  live: Recorded | undefined,
  wanted: Recorded | undefined,
): Pick<Draft, "action" | "fields"> | undefined {
  if (wanted === undefined) {
    return live === undefined ? undefined : { action: "deleted", fields: {} };
  }
  if (live === undefined) return { action: "created", fields: tidy(wanted) };
  const fields: Recorded = {};
  for (const field of new Set([...Object.keys(live), ...Object.keys(wanted)])) {
    // The fields are the person's own, read just above.
    /* eslint-disable security/detect-object-injection */
    if (!same(live[field], wanted[field])) {
      fields[field] =
        wanted[field] ?? (fieldOfValue(field) === null ? null : []);
    }
    /* eslint-enable security/detect-object-injection */
  }
  return Object.keys(fields).length === 0
    ? undefined
    : { action: "changed", fields };
}

// The fields a draft touches: those an added or removed person has a value in, or those a change
// makes differ, as the change history records them.
export function draftFields(
  live: Recorded | undefined,
  draft: Draft,
): string[] {
  if (draft.action === "changed") return Object.keys(draft.fields);
  return Object.entries(draft.action === "created" ? draft.fields : { ...live })
    .filter(([, value]) => value !== null)
    .map(([field]) => field);
}

// How sensitive a draft is: as its most sensitive field, which a rejection's reason takes too.
export function draftTier(
  tierOf: (field: string) => Tier,
  live: Recorded | undefined,
  draft: Draft,
): Tier {
  return mostSensitive(draftFields(live, draft).map(tierOf));
}

// Changes to drafts of every kind wait for one another, as do approvals, rejections, undoing, and
// deleting a choice, so two cannot update the same draft, take the same Employee ID or name, or
// remove a choice a draft is being given, at once. It is taken before any row is locked.
export async function lockDrafts(transaction: Transaction) {
  await transaction.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended('fathom.drafts', 0))`,
  );
}

// The drafts of the records of one kind given, or of every record of that kind, by record, in the
// order they were made.
export async function readDrafts(
  reader: Reader,
  recordType: DraftType,
  ids?: readonly string[],
): Promise<Map<string, Draft>> {
  const rows: DraftRow[] = [];
  const read = async (chunk?: readonly string[]) => {
    rows.push(
      ...(await reader
        .select()
        .from(drafts)
        .where(
          and(
            eq(drafts.recordType, recordType),
            chunk === undefined
              ? undefined
              : inArray(drafts.recordId, [...chunk]),
          ),
        )),
    );
  };
  if (ids === undefined) await read();
  else for (const chunk of inChunks([...ids])) await read(chunk);
  rows.sort((first, second) => first.sequence - second.sequence);
  return new Map(rows.map((row) => [row.recordId, toDraft(row)]));
}

// The drafts of the people given, or of everyone, by person.
export const readPersonDrafts = (reader: Reader, ids?: readonly string[]) =>
  readDrafts(reader, "person", ids);

export type Rejection = Pick<Draft, "state" | "reason">;

const waiting: Rejection = { state: "waiting", reason: null };

// Keeps a record's draft as wanted, or removes it when the record wanted is the live one.
export async function writeDraft(
  transaction: Transaction,
  recordType: DraftType,
  id: string,
  live: Recorded | undefined,
  wanted: Recorded | undefined,
  rejection: Rejection = waiting,
): Promise<void> {
  const draft = draftBetween(live, wanted);
  if (draft === undefined) {
    await deleteDrafts(transaction, recordType, [id]);
    return;
  }
  const row = { ...draft, ...rejection };
  await transaction
    .insert(drafts)
    .values({ recordType, recordId: id, ...row })
    .onConflictDoUpdate({
      target: [drafts.recordType, drafts.recordId],
      set: row,
    });
}

export const writePersonDraft = (
  transaction: Transaction,
  id: string,
  live: Recorded | undefined,
  wanted: Recorded | undefined,
  rejection: Rejection = waiting,
) => writeDraft(transaction, "person", id, live, wanted, rejection);

// Removes the drafts of the records of one kind given.
export async function deleteDrafts(
  transaction: Transaction,
  recordType: DraftType,
  ids: readonly string[],
): Promise<void> {
  for (const chunk of inChunks([...ids])) {
    await transaction
      .delete(drafts)
      .where(
        and(eq(drafts.recordType, recordType), inArray(drafts.recordId, chunk)),
      );
  }
}

// Marks the drafts of the records of one kind given as waiting again, or as rejected for a reason.
export async function setRejection(
  transaction: Transaction,
  recordType: DraftType,
  ids: readonly string[],
  rejection: Rejection,
): Promise<void> {
  for (const chunk of inChunks([...ids])) {
    await transaction
      .update(drafts)
      .set(rejection)
      .where(
        and(eq(drafts.recordType, recordType), inArray(drafts.recordId, chunk)),
      );
  }
}

export interface Maker {
  madeBy: string | null;
  madeAt: Date;
  // Everyone who changed the draft, by name, first to last, null for Fathom itself.
  editors: (string | null)[];
  // Who last changed each field of the draft, by field as the change history names it.
  fieldEditors: Map<string, string | null>;
}

// Who changed each record's draft, and when, from the changes to it the reader may see, so a hidden
// change reveals nothing: the latest, and everyone since the record's last draft was approved or
// discarded. Rejecting a draft, or sending it for approval again unchanged, does not change it.
export async function draftMakers(
  reader: Pick<Database, "select">,
  recordType: DraftType,
  ids: readonly string[],
  seen: (field: string, tier: Tier) => boolean = () => true,
): Promise<Map<string, Maker>> {
  const makers = new Map<string, Maker>();
  for (const chunk of inChunks([...ids])) {
    const rows = await reader
      .select({
        recordId: changes.recordId,
        field: changes.field,
        tier: changes.tier,
        draft: changes.draft,
        kind: changeSets.kind,
        madeBy: users.name,
        madeAt: changeSets.madeAt,
      })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .leftJoin(users, eq(users.id, changeSets.madeBy))
      .where(
        and(
          eq(changes.recordType, recordType),
          inArray(changes.recordId, chunk),
          or(
            eq(changes.draft, true),
            inArray(changeSets.kind, ["approval", "discard"]),
          ),
        ),
      )
      .orderBy(changes.id);
    for (const row of rows) {
      if (row.kind === "approval" || row.kind === "discard") {
        makers.delete(row.recordId);
        continue;
      }
      const recorded = tierSchema.catch("confidential").parse(row.tier);
      if (
        row.kind === "rejection" ||
        row.kind === "resubmission" ||
        !seen(row.field, recorded)
      ) {
        continue;
      }
      const maker = makers.get(row.recordId);
      const editors = maker?.editors ?? [];
      makers.set(row.recordId, {
        madeBy: row.madeBy,
        madeAt: row.madeAt,
        editors: [
          ...editors.filter((editor) => editor !== row.madeBy),
          row.madeBy,
        ],
        fieldEditors: new Map(maker?.fieldEditors).set(row.field, row.madeBy),
      });
    }
  }
  return makers;
}

// Adds drafts for people added together, such as pasted rows, in as few statements as PostgreSQL
// allows.
export async function addPersonDrafts(
  transaction: Transaction,
  added: readonly { id: string; fields: Recorded }[],
): Promise<void> {
  for (const chunk of inChunks([...added])) {
    await transaction.insert(drafts).values(
      chunk.map(({ id, fields }) => ({
        recordType: "person",
        recordId: id,
        action: "created",
        fields: tidy(fields),
      })),
    );
  }
}

// The Employee IDs asked for that someone else already has, ignoring letter case: a live person, or
// a person as their draft makes them. A live person's Employee ID stays taken until a draft that
// changes it is approved, so approving drafts one at a time never finds two people with the same one.
export async function takenEmployeeIds(
  reader: Reader,
  employeeIds: readonly string[],
  except: readonly string[],
): Promise<string[]> {
  const lowered = [...new Set(employeeIds.map((id) => id.toLowerCase()))];
  const taken = new Set<string>();
  for (const chunk of inChunks(lowered)) {
    const live = await reader
      .select({ employeeId: people.employeeId })
      .from(people)
      .where(
        and(
          inArray(sql`lower(${people.employeeId})`, chunk),
          except.length === 0 ? undefined : notInArray(people.id, [...except]),
        ),
      );
    const draftedIds = await reader
      .select({ employeeId: sql<string>`${drafts.fields}->>'employeeId'` })
      .from(drafts)
      .where(
        and(
          eq(drafts.recordType, "person"),
          inArray(sql`lower(${drafts.fields}->>'employeeId')`, chunk),
          except.length === 0
            ? undefined
            : notInArray(drafts.recordId, [...except]),
        ),
      );
    for (const { employeeId } of [...live, ...draftedIds]) {
      taken.add(employeeId.toLowerCase());
    }
  }
  return employeeIds.filter((id) => taken.has(id.toLowerCase()));
}

// Whether any person's draft changes the column, even to clear it, or has the choice, given.
export async function draftsUse(
  reader: Reader,
  use: { column: string } | { choice: string },
): Promise<boolean> {
  const found = await reader
    .select({ one: sql`1` })
    .from(drafts)
    .where(
      and(
        eq(drafts.recordType, "person"),
        "column" in use
          ? sql`${drafts.fields} ? ${`value:${use.column}`}::text`
          : sql`EXISTS (SELECT 1 FROM jsonb_each(${drafts.fields}) AS held(field, value) WHERE jsonb_typeof(held.value) = 'array' AND held.value @> ${JSON.stringify([use.choice])}::jsonb)`,
      ),
    )
    .limit(1);
  return found.length > 0;
}

// The changes recorded for a rejected draft whose reason is cleared, as when it is changed again or
// discarded, so it waits for approval again.
export function clearedRejection(
  id: string,
  tierOf: (field: string) => Tier,
  live: Recorded | undefined,
  draft: Draft | undefined,
  recordType: DraftType = "person",
): Change[] {
  return draft?.state === "rejected"
    ? [
        {
          recordType,
          recordId: id,
          action: "changed",
          field: rejectedField,
          tier: draftTier(tierOf, live, draft),
          oldValue: draft.reason,
          newValue: null,
          draft: true,
        },
      ]
    : [];
}

// Changes marked as changes to drafts.
export const asDraft = (made: readonly Change[]): Change[] =>
  made.map((change) => ({ ...change, draft: true }));

// The columns' values as a draft holds them, for checking that a column's settings fit the drafts
// too: each draft that adds or changes a person, with its choices by column, as the person will
// have them.
export async function draftedValues(
  reader: Reader,
  columnId: string,
): Promise<{ adds: boolean; chosen: string[] | undefined }[]> {
  const rows = await reader
    .select({
      action: drafts.action,
      chosen: sql<unknown>`${drafts.fields} -> ${`value:${columnId}`}::text`,
    })
    .from(drafts)
    .where(
      and(
        eq(drafts.recordType, "person"),
        inArray(drafts.action, ["created", "changed"]),
      ),
    );
  return rows.map(({ action, chosen }) => ({
    adds: action === "created",
    chosen: Array.isArray(chosen) ? chosen.map(String) : undefined,
  }));
}

// Whether the columns hold a person as recorded: each value from its column's list, one choice
// unless the column takes several, and a value in every required column.
export function fitsColumns(
  columns: readonly ColumnInfo[],
  listOf: ReadonlyMap<string, string>,
  person: Recorded,
): boolean {
  const known = new Set(columns.map(({ id }) => id));
  const strayValue = Object.keys(person).some((field) => {
    const columnId = fieldOfValue(field);
    return columnId !== null && !known.has(columnId);
  });
  return (
    !strayValue &&
    columns.every((column) => {
      const value = person[`value:${column.id}`];
      const chosen = Array.isArray(value) ? value.map(String) : [];
      return (
        (!column.required || chosen.length > 0) &&
        (column.multiple || chosen.length <= 1) &&
        chosen.every((choiceId) => listOf.get(choiceId) === column.listId)
      );
    })
  );
}
