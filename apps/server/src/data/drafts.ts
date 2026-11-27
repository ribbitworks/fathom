// SPDX-License-Identifier: Apache-2.0

// Draft rows: reading and writing the changes waiting for approval, and each user's private changes
// to them. Part of the data access layer.

import {
  type Database,
  drafts,
  inChunks,
  privateChanges,
  privateSetOf,
  type Reader,
} from "@fathom/db";
import type { DraftKind } from "@fathom/shared";
import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { Transaction } from "./changes.ts";
import {
  type Draft,
  draftBetween,
  noDraft,
  type Recorded,
  same,
  startedFrom,
  tidy,
  toDraft,
  type Viewer,
  withOwnFields,
} from "./draft-records.ts";

// Changes to drafts of every kind wait for one another, as do approvals, rejections, undoing,
// publishing and discarding unpublished changes, and deleting a choice, so two cannot update the
// same draft, take the same Employee ID or name, or remove a choice a draft is being given, at
// once. It is taken before any row is locked.
export async function lockDrafts(transaction: Transaction) {
  await transaction.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended('fathom.drafts', 0))`,
  );
}

// Rows of one table for the records of one kind given, or of every record of that kind, read in
// chunks small enough for one statement each.
async function readRows<Row>(
  ids: readonly string[] | undefined,
  read: (chunk: readonly string[] | undefined) => Promise<Row[]>,
): Promise<Row[]> {
  if (ids === undefined) return read(undefined);
  const rows: Row[] = [];
  for (const chunk of inChunks([...ids])) rows.push(...(await read(chunk)));
  return rows;
}

const bySequence = (
  first: { sequence: number },
  second: { sequence: number },
) => first.sequence - second.sequence;

// The drafts of the records of one kind given, or of every record of that kind, by record, in the
// order they were made: the published drafts, with the viewer's own unpublished drafts over them,
// and the records only the viewer drafts adding after them. A record the viewer wants no draft of
// has none.
export async function readDrafts(
  reader: Reader,
  recordType: DraftKind,
  ids?: readonly string[],
  viewer?: Viewer,
): Promise<Map<string, Draft>> {
  const published = await readRows(ids, (chunk) =>
    reader
      .select()
      .from(drafts)
      .where(
        and(
          eq(drafts.recordType, recordType),
          chunk === undefined
            ? undefined
            : inArray(drafts.recordId, [...chunk]),
        ),
      ),
  );
  const found = new Map(
    published.sort(bySequence).map((row) => [row.recordId, toDraft(row)]),
  );
  if (viewer === undefined) return found;
  const own = await readRows(ids, (chunk) =>
    reader
      .select()
      .from(privateChanges)
      .where(
        and(
          eq(privateChanges.recordType, recordType),
          eq(privateChanges.userId, viewer),
          chunk === undefined
            ? undefined
            : inArray(privateChanges.recordId, [...chunk]),
        ),
      ),
  );
  for (const row of own.sort(bySequence)) {
    const draft = withOwnFields(found.get(row.recordId), row);
    if (draft === undefined) found.delete(row.recordId);
    else found.set(row.recordId, draft);
  }
  return found;
}

// A user's private changes as they stand over the published drafts now: each holds the fields its
// maker changed over the published draft's others, or wants no draft when that leaves none.
export async function overPublished<
  Row extends typeof privateChanges.$inferSelect,
>(reader: Reader, rows: readonly Row[]): Promise<Row[]> {
  const published = new Map<string, Draft>();
  for (const recordType of new Set(rows.map((row) => row.recordType))) {
    const ids = rows
      .filter((row) => row.recordType === recordType)
      .map(({ recordId }) => recordId);
    for (const [id, draft] of await readDrafts(
      reader,
      recordType as DraftKind,
      ids,
    )) {
      published.set(`${recordType}\n${id}`, draft);
    }
  }
  return rows.map((row) => {
    const draft = withOwnFields(
      published.get(`${row.recordType}\n${row.recordId}`),
      row,
    );
    const { action, fields }: Pick<Draft, "action" | "fields"> =
      draft ?? noDraft;
    return { ...row, action, fields };
  });
}

// Rows of either table as an editor sees them in the field given, or in the whole record without
// one, as reads put a private change over the published draft: a published draft unless the
// editor's own change holds that field or the whole draft, and the editor's own changes where they
// do. Nobody else's private changes count for anyone; with no editor, the published drafts alone.
export function asSeenBy(
  table: typeof drafts | typeof privateChanges,
  editor: string | undefined,
  field?: string,
): SQL | undefined {
  const whole = (own: typeof privateChanges, action: SQL) =>
    field === undefined
      ? sql`true`
      : sql`(${own.startedFrom} = '{}'::jsonb OR ${own.startedFrom} ? ${field} OR ${own.action} IS DISTINCT FROM ${action})`;
  if (table === privateChanges) {
    if (editor === undefined) return sql`false`;
    return and(
      eq(privateChanges.userId, editor),
      whole(
        privateChanges,
        sql`(SELECT ${drafts.action} FROM ${drafts} WHERE ${drafts.recordType} = ${privateChanges.recordType} AND ${drafts.recordId} = ${privateChanges.recordId})`,
      ),
    );
  }
  if (editor === undefined) return undefined;
  return sql`NOT EXISTS (SELECT 1 FROM ${privateChanges} WHERE ${privateChanges.userId} = ${editor} AND ${privateChanges.recordType} = ${drafts.recordType} AND ${privateChanges.recordId} = ${drafts.recordId} AND ${whole(privateChanges, sql`${drafts.action}`)})`;
}

// The fields a private change holds as its maker sees them: all of them where it holds the whole
// draft, with no own fields or another action than the published draft's, otherwise its own alone,
// since the rest are copies of the published draft taken when it was made.
export const ownFieldsSeen: SQL = sql`CASE WHEN ${privateChanges.startedFrom} = '{}'::jsonb OR ${privateChanges.action} IS DISTINCT FROM (SELECT ${drafts.action} FROM ${drafts} WHERE ${drafts.recordType} = ${privateChanges.recordType} AND ${drafts.recordId} = ${privateChanges.recordId}) THEN ${privateChanges.fields} ELSE (SELECT coalesce(jsonb_object_agg(own.key, own.value), '{}'::jsonb) FROM jsonb_each(${privateChanges.fields}) AS own WHERE ${privateChanges.startedFrom} ? own.key) END`;

// The fields of a published draft an editor still sees: none where their own private change holds
// the whole draft, otherwise those their change doesn't hold; every field with no editor.
export const publishedFieldsSeen = (editor: string | undefined): SQL =>
  editor === undefined
    ? sql`${drafts.fields}`
    : sql`CASE WHEN EXISTS (SELECT 1 FROM ${privateChanges} WHERE ${privateChanges.userId} = ${editor} AND ${privateChanges.recordType} = ${drafts.recordType} AND ${privateChanges.recordId} = ${drafts.recordId} AND (${privateChanges.startedFrom} = '{}'::jsonb OR ${privateChanges.action} IS DISTINCT FROM ${drafts.action})) THEN '{}'::jsonb ELSE ${drafts.fields} - coalesce((SELECT array_agg(own.field) FROM ${privateChanges}, jsonb_object_keys(${privateChanges.startedFrom}) AS own(field) WHERE ${privateChanges.userId} = ${editor} AND ${privateChanges.recordType} = ${drafts.recordType} AND ${privateChanges.recordId} = ${drafts.recordId}), '{}'::text[]) END`;

// The drafts of the people given, or of everyone, by person.
export const readPersonDrafts = (
  reader: Reader,
  ids?: readonly string[],
  viewer?: Viewer,
) => readDrafts(reader, "person", ids, viewer);

// Rejects drafts for a reason.
export const rejectedIn = (
  transaction: Transaction,
  recordType: DraftKind,
  ids: readonly string[],
  reason: string,
) => setRejection(transaction, recordType, ids, { state: "rejected", reason });

// Sends a rejected draft for approval again, its rejection cleared.
export const reopened = (
  transaction: Transaction,
  recordType: DraftKind,
  id: string,
) =>
  setRejection(transaction, recordType, [id], {
    state: "waiting",
    reason: null,
  });

// A change of drafts in a transaction of its own, the drafts locked, given the state of the records
// of its kind as the editor sees them.
export async function draftingWith<State, Result>(
  database: Database,
  editor: string,
  readState: (transaction: Transaction, editor: string) => Promise<State>,
  change: (transaction: Transaction, state: State) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    return change(transaction, await readState(transaction, editor));
  });
}

// Whether two drafts make the same change, field for field.
function sameDraft(
  first: Pick<Draft, "action" | "fields"> | undefined,
  second: Pick<Draft, "action" | "fields"> | undefined,
): boolean {
  if (first === undefined || second === undefined) return first === second;
  const keys = Object.keys(first.fields);
  return (
    first.action === second.action &&
    keys.length === Object.keys(second.fields).length &&
    keys.every(
      (key) =>
        Object.hasOwn(second.fields, key) &&
        // The keys are the drafts' own, read just above.
        // eslint-disable-next-line security/detect-object-injection
        same(first.fields[key], second.fields[key]),
    )
  );
}

// Each transaction's editors' sets, so a change of many records, such as several hires, looks
// each up once.
const setsIn = new WeakMap<Transaction, Map<string, Promise<string>>>();

function editorSet(transaction: Transaction, editor: string): Promise<string> {
  const sets = setsIn.get(transaction) ?? new Map<string, Promise<string>>();
  setsIn.set(transaction, sets);
  const set = sets.get(editor) ?? privateSetOf(transaction, editor);
  sets.set(editor, set);
  return set;
}

// When a private change begins: once the drafts lock is held, not when the transaction began, so a
// discard by choice committed while this request waited for the lock comes before it. No test can
// make two requests wait on each other in turn.
const sinceNow = sql`clock_timestamp()`;

// Keeps the draft the editor intends for a record as their unpublished draft: none at all when it
// is the published draft, and one that wants no draft when the
// editor wants none but there is a published one. It keeps, for each field the editor changes,
// the value it started from.
async function keepUnpublished(
  transaction: Transaction,
  editor: string,
  recordType: DraftKind,
  id: string,
  draft: Pick<Draft, "action" | "fields"> | undefined,
  live?: Recorded,
): Promise<void> {
  const published = (await readDrafts(transaction, recordType, [id])).get(id);
  const editors = and(
    eq(privateChanges.recordType, recordType),
    eq(privateChanges.recordId, id),
    eq(privateChanges.userId, editor),
  );
  if (sameDraft(draft, published)) {
    await transaction.delete(privateChanges).where(editors);
    return;
  }
  const row = draft ?? noDraft;
  const [kept] = await transaction.select().from(privateChanges).where(editors);
  // A change kept from before own fields were recorded holds its whole draft, so what its maker saw
  // is taken as the published draft, and every field they changed from it becomes theirs.
  const seen =
    kept === undefined || Object.keys(kept.startedFrom).length === 0
      ? published
      : withOwnFields(published, kept);
  const values = {
    action: row.action,
    fields: row.fields,
    startedFrom: startedFrom(
      kept?.startedFrom ?? {},
      row,
      seen,
      published,
      live,
    ),
  };
  const setId = await editorSet(transaction, editor);
  await transaction
    .insert(privateChanges)
    .values({
      recordType,
      recordId: id,
      userId: editor,
      setId,
      since: sinceNow,
      ...values,
    })
    .onConflictDoUpdate({
      target: [
        privateChanges.recordType,
        privateChanges.recordId,
        privateChanges.userId,
      ],
      set: values,
    });
}

export type Rejection = Pick<Draft, "state" | "reason">;

// Keeps the editor's draft of a record as wanted, as their unpublished draft.
export async function writeDraft(
  transaction: Transaction,
  editor: string,
  recordType: DraftKind,
  id: string,
  live: Recorded | undefined,
  wanted: Recorded | undefined,
): Promise<void> {
  await keepUnpublished(
    transaction,
    editor,
    recordType,
    id,
    draftBetween(live, wanted),
    live,
  );
}

export const writePersonDraft = (
  transaction: Transaction,
  editor: string,
  id: string,
  live: Recorded | undefined,
  wanted: Recorded | undefined,
) => writeDraft(transaction, editor, "person", id, live, wanted);

// Discards the editor's drafts of the records of one kind given, so that, once they publish, the
// records are as they are live.
export async function discardDrafts(
  transaction: Transaction,
  editor: string,
  recordType: DraftKind,
  ids: readonly string[],
): Promise<void> {
  for (const id of ids) {
    await keepUnpublished(transaction, editor, recordType, id, undefined);
  }
}

// Removes the published drafts of the records of one kind given, as approving them does.
export async function deleteDrafts(
  transaction: Transaction,
  recordType: DraftKind,
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

// Marks the published drafts of the records of one kind given as waiting again, or as rejected for
// a reason.
export async function setRejection(
  transaction: Transaction,
  recordType: DraftKind,
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

// Adds the editor's unpublished drafts of records of one kind drafted to be added together, such
// as pasted rows, in as few statements as PostgreSQL allows, keeping the order given.
export async function addDrafts(
  transaction: Transaction,
  editor: string,
  recordType: DraftKind,
  added: readonly { id: string; fields: Recorded }[],
): Promise<void> {
  const setId = await editorSet(transaction, editor);
  for (const chunk of inChunks([...added])) {
    await transaction.insert(privateChanges).values(
      chunk.map(({ id, fields }) => ({
        recordType,
        recordId: id,
        userId: editor,
        setId,
        since: sinceNow,
        action: "created",
        fields,
      })),
    );
  }
}

export const addPersonDrafts = (
  transaction: Transaction,
  editor: string,
  added: readonly { id: string; fields: Recorded }[],
) =>
  addDrafts(
    transaction,
    editor,
    "person",
    added.map(({ id, fields }) => ({ id, fields: tidy(fields) })),
  );
