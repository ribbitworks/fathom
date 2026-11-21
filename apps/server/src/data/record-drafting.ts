// SPDX-License-Identifier: Apache-2.0

// Drafting the plan's records: checking a change against the records as the editor sees them,
// saving it as their draft, and whether a draft still fits once published. Part of the data access
// layer.

import type { Database } from "@fathom/db";
import type { Permission, RecordType } from "@fathom/shared";
import type { Actor } from "../access.ts";
import { ConflictError, NotFoundError, type RequestError } from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  type Transaction,
} from "./changes.ts";
import {
  asDraft,
  clearedRejection,
  type Draft,
  heldMessage,
  lockDrafts,
  type Recorded,
  wantsNoDraft,
  writeDraft,
} from "./drafts.ts";
import {
  linkedIds,
  type RecordKind,
  recordExists,
  type RecordsState,
  stateOf,
  subjectFor,
  type Touched,
  takenValue,
  versionOf,
  withVersion,
} from "./record-state.ts";
import { valueFieldsIn } from "./values.ts";
import {
  kindOf,
  noRecord,
  readRecordsState,
  recordKinds,
  type RecordVersions,
  ruleProblem,
} from "./records.ts";

// Runs a change to the editor's drafts of the plan's records, after every other change to drafts,
// with the records as they see them.
export async function drafting<Result>(
  database: Database,
  editor: string,
  change: (transaction: Transaction, state: RecordsState) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    return change(transaction, await readRecordsState(transaction, editor));
  });
}

const holderOf = (
  state: RecordsState,
  type: RecordType,
  id: string,
): string | undefined => stateOf(state, type).held.get(id)?.holder;

export function refuseHeldIn(
  state: RecordsState,
  type: RecordType,
  id: string,
) {
  const holder = holderOf(state, type, id);
  if (holder !== undefined) throw new ConflictError(heldMessage(holder));
}

// Why a record can't be changed: it isn't there to change, someone else holds it, or its draft
// removes it.
export type RecordRefusal =
  | { reason: "missing" }
  | { reason: "held"; holder: string }
  | { reason: "removed" };

export type RecordToChange = { record: Recorded } | { refusal: RecordRefusal };

// A record to change as its draft makes it, or why it can't be: one that does not exist, or that
// Fathom keeps, is missing; one someone else holds is theirs until they publish or discard it; and
// one its draft removes can't be changed until the draft is discarded.
export function recordToChange(
  state: RecordsState,
  type: RecordType,
  id: string,
): RecordToChange {
  if (
    !recordExists(state, type, id) ||
    kindOf(type).keptByFathom?.(state, id) === true
  ) {
    return { refusal: { reason: "missing" } };
  }
  const holder = holderOf(state, type, id);
  if (holder !== undefined) return { refusal: { reason: "held", holder } };
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
    case "held":
      return new ConflictError(heldMessage(refusal.holder));
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

// The action that takes a record from one version to another.
function actionTo(
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change["action"] {
  if (before === undefined) return "created";
  return after === undefined ? "deleted" : "changed";
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
  permissions: readonly Permission[],
): RequestError | undefined {
  if (wanted !== undefined) {
    const taken = takenValue(kind, state, wanted, id);
    if (taken !== undefined) return new ConflictError(taken);
    for (const [name, type] of Object.entries(kind.links)) {
      for (const target of linkedIds(wanted, name)) {
        if (!recordExists(state, type, target)) {
          return new NotFoundError(noRecord);
        }
        if (versionOf(state, type, target) === undefined) {
          return new ConflictError(
            `This links to ${subjectFor(kindOf(type), state, target, permissions)}, which is drafted to be removed; discard that draft first`,
          );
        }
      }
    }
  }
  const touched = [{ type: kind.type, id, record: wanted ?? before }];
  const after = withVersion(state, kind.type, id, wanted);
  const problem = ruleProblem(after, touched, permissions);
  if (problem !== undefined) return new ConflictError(problem);
  const holder = holderBreaking(kind, after, id, wanted, touched, permissions);
  return holder === undefined
    ? undefined
    : new ConflictError(heldConflictMessage(holder));
}

const heldConflictMessage = (holder: string) =>
  `This conflicts with changes ${holder} has not yet published; it can be saved once they publish or discard them`;

interface Holding {
  holder: string;
  changes: { type: RecordType; id: string; draft: Draft }[];
}

// The changes each other user holds, by user.
function holdings(state: RecordsState): Holding[] {
  const found = new Map<string, Holding>();
  for (const kind of recordKinds) {
    for (const [id, held] of stateOf(state, kind.type).held) {
      const holding = found.get(held.holderId) ?? {
        holder: held.holder,
        changes: [],
      };
      holding.changes.push({ type: kind.type, id, draft: held.draft });
      found.set(held.holderId, holding);
    }
  }
  return [...found.values()];
}

// The records as they would be once one user publishes the changes they hold.
function withHolding(state: RecordsState, { changes }: Holding): RecordsState {
  const after = Object.fromEntries(
    recordKinds.map((kind) => {
      const kindState = stateOf(state, kind.type);
      return [kind.type, { ...kindState, drafts: new Map(kindState.drafts) }];
    }),
  ) as RecordsState;
  for (const { type, id, draft } of changes) {
    const { drafts } = stateOf(after, type);
    if (wantsNoDraft(draft)) drafts.delete(id);
    else drafts.set(id, draft);
  }
  return after;
}

// Who else holds changes that, once published, would leave a record as wanted linking to a record
// that is gone, or breaking a rule across records, so that its draft cannot be saved or published
// meanwhile. A change they hold that breaks nothing, such as a new name, holds nothing up.
function holderBreaking(
  kind: RecordKind,
  state: RecordsState,
  id: string,
  wanted: Recorded | undefined,
  touched: readonly Touched[],
  permissions: readonly Permission[],
): string | undefined {
  for (const holding of holdings(state)) {
    const theirs = withHolding(state, holding);
    const linkGone =
      wanted !== undefined &&
      Object.entries(kind.links).some(([name, type]) =>
        linkedIds(wanted, name).some(
          (target) => versionOf(theirs, type, target) === undefined,
        ),
      );
    if (linkGone || ruleProblem(theirs, touched, permissions) !== undefined) {
      return holding.holder;
    }
  }
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
    refuseHeldIn(state, type, id);
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
      maker.permissions,
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

// Whether a record as the user's draft makes it still fits the data as it is now, so it can be
// published.
export function recordFits(
  { mine }: RecordVersions,
  type: RecordType,
  id: string,
): boolean {
  const version = versionOf(mine, type, id);
  const before = (version ?? stateOf(mine, type).live.get(id)) as Recorded;
  // Only whether it fits is asked, so whoever would read a refusal's words doesn't matter.
  return misfitOf(kindOf(type), mine, id, version, before, []) === undefined;
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
