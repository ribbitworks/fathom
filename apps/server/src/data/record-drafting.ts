// SPDX-License-Identifier: Apache-2.0

// Drafting the plan's records: checking a change against the records as the editor sees them,
// saving it as their draft, and whether a draft still fits once published. Part of the data access
// layer.

import type { Database } from "@fathom/db";
import { type ClassAccess, type RecordType } from "@fathom/shared";
import type { Actor } from "../access.ts";
import { ConflictError, NotFoundError, type RequestError } from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  type Transaction,
} from "./changes.ts";
import {
  actionTo,
  asDraft,
  clearedRejection,
  type Recorded,
} from "./draft-records.ts";
import { draftingWith, writeDraft } from "./drafts.ts";
import {
  linkedIds,
  type RecordKind,
  recordExists,
  type RecordsState,
  stateOf,
  subjectFor,
  takenValue,
  versionOf,
  withVersion,
} from "./record-state.ts";
import { valueFieldsIn } from "./values.ts";
import {
  kindOf,
  noRecord,
  readRecordsState,
  type RecordVersions,
  ruleProblem,
} from "./records.ts";

// Runs a change to the editor's drafts of the plan's records, after every other change to drafts,
// with the records as they see them.
export const drafting = <Result>(
  database: Database,
  editor: string,
  change: (transaction: Transaction, state: RecordsState) => Promise<Result>,
) => draftingWith(database, editor, readRecordsState, change);

// Why a record can't be changed: it isn't there to change, or its draft removes it.
export type RecordRefusal = { reason: "missing" } | { reason: "removed" };

export type RecordToChange = { record: Recorded } | { refusal: RecordRefusal };

// A record to change as its draft makes it, or why it can't be: one that does not exist is
// missing, and one its draft removes can't be changed until the draft is discarded.
export function recordToChange(
  state: RecordsState,
  type: RecordType,
  id: string,
): RecordToChange {
  if (!recordExists(state, type, id)) {
    return { refusal: { reason: "missing" } };
  }
  const version = versionOf(state, type, id);
  return version === undefined
    ? { refusal: { reason: "removed" } }
    : { record: version };
}

// The error a refusal to change a record is sent as.
export function refusalError(refusal: RecordRefusal): RequestError {
  switch (refusal.reason) {
    case "missing":
      return new NotFoundError(noRecord);
    case "removed":
      return new ConflictError(
        "This record's draft removes it; discard the draft to change it",
      );
  }
}

// A record to change as its draft makes it, refusing one that can't be changed, as recordToChange
// sets out.
export function changeableRecord(
  state: RecordsState,
  type: RecordType,
  id: string,
): Recorded {
  const found = recordToChange(state, type, id);
  if ("refusal" in found) throw refusalError(found.refusal);
  return found.record;
}

export const kindChanges = (
  kind: RecordKind,
  id: string,
  before: Recorded | undefined,
  after: Recorded | undefined,
) =>
  changesBetween(kind.type, id, actionTo(before, after), before, after, [
    ...kind.fields,
    ...valueFieldsIn(before, after),
  ]);

// Why a record as wanted breaks a rule, or undefined when it keeps them all: a unique value someone
// else has, a link to a record that does not exist or is drafted to be removed, or a rule across
// records, as the records are now or once someone else publishes the changes they hold. A removal
// is judged by the record as it was.
function misfitOf(
  kind: RecordKind,
  state: RecordsState,
  id: string,
  wanted: Recorded | undefined,
  before: Recorded,
  access: ClassAccess,
): RequestError | undefined {
  if (wanted !== undefined) {
    const taken = takenValue(kind, state, wanted, id);
    if (taken !== undefined)
      return new ConflictError(taken.message, taken.field);
    for (const [name, type] of Object.entries(kind.links)) {
      for (const target of linkedIds(wanted, name)) {
        if (!recordExists(state, type, target)) {
          return new NotFoundError(noRecord);
        }
        if (versionOf(state, type, target) === undefined) {
          return new ConflictError(
            `This links to ${subjectFor(kindOf(type), state, target, access)}, which is drafted to be removed; discard that draft first`,
          );
        }
      }
    }
  }
  const touched = [{ type: kind.type, id, record: wanted ?? before }];
  const after = withVersion(state, kind.type, id, wanted);
  const problem = ruleProblem(after, touched, access);
  if (problem !== undefined) return new ConflictError(problem);
  return undefined;
}

// A record as one change wants it, or undefined to remove it.
export interface Wanted {
  type: RecordType;
  id: string;
  record: Recorded | undefined;
}

// Keeps the editor's draft of a record as wanted, or of its removal when nothing is wanted, and
// records the changes, clearing a rejection; refuses a record that breaks a rule. Returns the
// change set, or null when nothing changed.
export async function saveRecordDraft(
  transaction: Transaction,
  maker: Actor,
  state: RecordsState,
  type: RecordType,
  id: string,
  wanted: Recorded | undefined,
): Promise<string | null> {
  return saveRecordDrafts(transaction, maker, state, [
    { type, id, record: wanted },
  ]);
}

// Keeps the editor's drafts of several records as wanted, in one change set, judging each against
// the others as they will all be, so a change that needs them all is not refused part way.
export async function saveRecordDrafts(
  transaction: Transaction,
  maker: Actor,
  state: RecordsState,
  wanted: readonly Wanted[],
): Promise<string | null> {
  let after = state;
  for (const { type, id, record } of wanted) {
    after = withVersion(after, type, id, record);
  }
  const made: Change[] = [];
  for (const { type, id, record } of wanted) {
    const kind = kindOf(type);
    const live = stateOf(state, type).live.get(id);
    const before = versionOf(state, type, id);
    const misfit = misfitOf(
      kind,
      after,
      id,
      record,
      (before ?? record) as Recorded,
      maker,
    );
    if (misfit !== undefined) throw misfit;
    const changes = asDraft(kindChanges(kind, id, before, record));
    if (changes.length === 0) continue;
    await writeDraft(transaction, maker.user.id, type, id, live, record);
    made.push(
      ...changes,
      ...clearedRejection(
        id,
        () => "general",
        live,
        stateOf(state, type).drafts.get(id),
        type,
      ),
    );
  }
  return made.length === 0 ? null : recordChanges(transaction, maker, made);
}

// Why a record as the user's draft makes it breaks a rule as the data is now, in words the role
// acting can see, or undefined when it can be published.
export function recordMisfit(
  mine: RecordsState,
  type: RecordType,
  id: string,
  access: ClassAccess,
): RequestError | undefined {
  const version = versionOf(mine, type, id);
  const before = (version ?? stateOf(mine, type).live.get(id)) as Recorded;
  return misfitOf(kindOf(type), mine, id, version, before, access);
}

// The changes that take a record back from the user's draft to the published one, or the live
// record.
export function takingBackRecord(
  { mine, theirs }: RecordVersions,
  type: RecordType,
  id: string,
): Change[] {
  return kindChanges(
    kindOf(type),
    id,
    versionOf(mine, type, id),
    versionOf(theirs, type, id),
  );
}
