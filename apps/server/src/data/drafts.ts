// SPDX-License-Identifier: Apache-2.0

// Draft rows: reading, holding and writing the changes waiting for approval, and each user's
// unpublished changes to them. Part of the data access layer.

import {
  type Database,
  drafts,
  inChunks,
  privateChanges,
  privateSetOf,
  type Reader,
  users,
} from "@fathom/db";
import type { DraftKind } from "@fathom/shared";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { ConflictError } from "../errors.ts";
import type { Transaction } from "./changes.ts";
import {
  type Draft,
  draftBetween,
  noDraft,
  type Recorded,
  same,
  tidy,
  toDraft,
  toUnpublished,
  type Viewer,
  wantsNoDraft,
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
// order they were made: the published drafts, with the viewer's own unpublished drafts in their
// place, and the records only the viewer drafts adding after them. A record the viewer wants no
// draft of has none.
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
    if (wantsNoDraft(row)) found.delete(row.recordId);
    else found.set(row.recordId, toUnpublished(row));
  }
  return found;
}

// The drafts of the people given, or of everyone, by person.
export const readPersonDrafts = (
  reader: Reader,
  ids?: readonly string[],
  viewer?: Viewer,
) => readDrafts(reader, "person", ids, viewer);

// A record someone holds by having unpublished changes to it: who, and the draft they intend, which
// wants no draft at all when it changes nothing.
export interface Held {
  holderId: string;
  holder: string;
  draft: Draft;
}

// Who holds a record, to add to it, when someone does.
export const heldByOf = (
  held: ReadonlyMap<string, Held>,
  id: string,
): { heldBy?: string } => {
  const holder = held.get(id)?.holder;
  return holder === undefined ? {} : { heldBy: holder };
};

// The records of one kind given, or of every record of that kind, that users other than the viewer
// hold, or that anyone holds when there is no viewer, by record.
export async function readHeld(
  reader: Reader,
  recordType: DraftKind,
  viewer: Viewer,
  ids?: readonly string[],
): Promise<Map<string, Held>> {
  const rows = await readRows(ids, (chunk) =>
    reader
      .select({ row: privateChanges, holder: users.name })
      .from(privateChanges)
      .innerJoin(users, eq(users.id, privateChanges.userId))
      .where(
        and(
          eq(privateChanges.recordType, recordType),
          viewer === undefined ? undefined : ne(privateChanges.userId, viewer),
          chunk === undefined
            ? undefined
            : inArray(privateChanges.recordId, [...chunk]),
        ),
      ),
  );
  return new Map(
    rows
      .sort((first, second) => bySequence(first.row, second.row))
      .map(({ row, holder }) => [
        row.recordId,
        { holderId: row.userId, holder, draft: toUnpublished(row) },
      ]),
  );
}

export const heldMessage = (holder: string) =>
  `${holder} is changing this; it can be changed once they publish or discard their changes`;

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

// Refuses a change to a record someone holds.
export function refuseHolder(holder: string | undefined): void {
  if (holder !== undefined) throw new ConflictError(heldMessage(holder));
}

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

// Refuses a change to records someone other than the editor holds.
export async function refuseHeld(
  reader: Reader,
  editor: string,
  recordType: DraftKind,
  ids: readonly string[],
): Promise<void> {
  const [held] = (await readHeld(reader, recordType, editor, ids)).values();
  refuseHolder(held?.holder);
}

// Refuses approving or rejecting drafts of records anyone holds, the Approver included, since
// Approvers decide only published drafts that nobody is changing.
export async function refuseHeldDecision(
  reader: Reader,
  recordType: DraftKind,
  ids: readonly string[],
): Promise<void> {
  const [held] = (await readHeld(reader, recordType, undefined, ids)).values();
  if (held !== undefined) {
    throw new ConflictError(
      `${held.holder} is changing one of these drafts; it can be decided once they publish or discard their changes`,
    );
  }
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

// Keeps the draft the editor intends for a record as their unpublished draft: none at all when it
// is the published draft, so the record is no longer held, and one that wants no draft when the
// editor wants none but there is a published one.
async function keepUnpublished(
  transaction: Transaction,
  editor: string,
  recordType: DraftKind,
  id: string,
  draft: Pick<Draft, "action" | "fields"> | undefined,
): Promise<void> {
  await refuseHeld(transaction, editor, recordType, [id]);
  const published = (await readDrafts(transaction, recordType, [id])).get(id);
  if (sameDraft(draft, published)) {
    await transaction
      .delete(privateChanges)
      .where(
        and(
          eq(privateChanges.recordType, recordType),
          eq(privateChanges.recordId, id),
          eq(privateChanges.userId, editor),
        ),
      );
    return;
  }
  const row = draft ?? noDraft;
  const setId = await editorSet(transaction, editor);
  await transaction
    .insert(privateChanges)
    .values({ recordType, recordId: id, userId: editor, setId, ...row })
    .onConflictDoUpdate({
      target: [
        privateChanges.recordType,
        privateChanges.recordId,
        privateChanges.userId,
      ],
      set: { action: row.action, fields: row.fields },
    });
}

export type Rejection = Pick<Draft, "state" | "reason">;

// Keeps the editor's draft of a record as wanted, as their unpublished draft, refusing a record
// someone else holds.
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
