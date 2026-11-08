// SPDX-License-Identifier: Apache-2.0

// The plan's records, whatever their kind, through one set of rules: reading them with their drafts
// in place, drafting records added, changed, and removed, discarding drafts, sending rejected ones
// for approval again, and approving and rejecting them, as the Decisions Log sets out. Each kind is
// described in record-state.ts, and adding a kind adds it to the list below. Part of the data
// access layer; the caller checks the actor's permissions. Every change is a draft, recorded in the
// change history field by field, which reaches the live records only once approved. A draft that
// links to a record only drafted to be added uses that record's draft: approving it approves both,
// discarding the record discards the drafts of records only drafted to be added that belong to it,
// and the record's draft is rejected only together with the drafts that use it.

import type { Database } from "@fathom/db";
import type { RecordDraft, RecordRef, RecordType } from "@fathom/shared";
import { recordTypeSchema } from "@fathom/shared";
import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Actor } from "../access.ts";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  type RequestError,
} from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  type Transaction,
} from "./changes.ts";
import {
  asDraft,
  clearedRejection,
  deleteDrafts,
  discardDrafts,
  type Draft,
  drafted,
  draftFields,
  draftMakers,
  everything,
  heldMessage,
  lockDrafts,
  type Maker,
  otherApprover,
  readDrafts,
  readHeld,
  type Recorded,
  refuseHeldDecision,
  refuseRejected,
  rejectedField,
  setRejection,
  type Viewer,
  wantsNoDraft,
  writeDraft,
} from "./drafts.ts";
import { projectKinds } from "./project-kinds.ts";
import { releaseKinds, releaseProblem } from "./release-kinds.ts";
import {
  addedOnly,
  everyVersion,
  type KindState,
  linkedIds,
  liveOnly,
  type RecordKind,
  recordExists,
  type RecordsState,
  type Referred,
  refKey,
  shownIds,
  stateOf,
  type Touched,
  usesOf,
  takenValue,
  versionOf,
  withVersion,
} from "./record-state.ts";

type Reader = Pick<Database, "select">;

// Every kind, in the order approving adds and changes them, so a record comes after the records it
// links to; removals go the other way.
export const recordKinds: readonly RecordKind[] = [
  ...releaseKinds,
  ...projectKinds,
];

// A record removed while another, as shown, still links to it, such as a customer a project names.
function linkedProblem(
  state: RecordsState,
  touched: readonly Touched[],
): string | undefined {
  for (const removed of touched) {
    if (versionOf(state, removed.type, removed.id) !== undefined) continue;
    for (const kind of recordKinds) {
      const linking = Object.entries(kind.links).filter(
        ([, type]) => type === removed.type,
      );
      if (linking.length === 0) continue;
      const user = shownIds(state, kind.type).find((id) =>
        linking.some(([name]) =>
          linkedIds(versionOf(state, kind.type, id), name).includes(removed.id),
        ),
      );
      if (user !== undefined) {
        return `This is used by ${kind.subject(state, user)}; change that first`;
      }
    }
  }
  return undefined;
}

// The rules across records of several kinds, checked for each change drafted, published, and
// approved: each gives the first way the records break it, if any.
const recordRules: readonly ((
  state: RecordsState,
  touched: readonly Touched[],
) => string | undefined)[] = [linkedProblem, releaseProblem];

const ruleProblem = (state: RecordsState, touched: readonly Touched[]) =>
  recordRules
    .map((rule) => rule(state, touched))
    .find((found) => found !== undefined);

export const kindOf = (type: RecordType): RecordKind =>
  recordKinds.find((kind) => kind.type === type) as RecordKind;

export const isRecordType = (type: string): type is RecordType =>
  recordTypeSchema.safeParse(type).success;

const noRecord = "There is no such record; refresh to see the latest";
const noDraft = "There is no such draft";
const gone = "One of these drafts no longer exists; refresh to see the latest";

// The table's id column, which every kind's table has.
const idOf = (table: PgTable) => (table as unknown as { id: PgColumn }).id;

// The record's own fields, from a row or a version with others beside them.
const ownFields = (kind: RecordKind, from: Recorded): Recorded =>
  Object.fromEntries(
    // The field is one of the kind's own.
    // eslint-disable-next-line security/detect-object-injection
    kind.fields.map((name) => [name, from[name]]),
  );

// How the Drafts page names the first record, live, in a draft, or in anyone's unpublished
// changes, as the editor sees them, that names any of the people, choices, or feature teams given.
export async function recordNaming(
  reader: Reader,
  named: Referred,
  ids: readonly string[],
  editor?: Viewer,
): Promise<string | undefined> {
  const state = await readRecordsState(reader, editor);
  const wanted = new Set(ids);
  for (const kind of recordKinds) {
    const fields = Object.entries(kind.refers ?? {})
      .filter(([, refersTo]) => refersTo === named)
      .map(([name]) => name);
    const found = everyVersion(state, kind.type).find(([, version]) =>
      fields.some((name) =>
        linkedIds(version, name).some((id) => wanted.has(id)),
      ),
    );
    if (found !== undefined) return kind.subject(state, found[0]);
  }
  return undefined;
}

// Refuses removing people a record names, live or in a draft, published or not.
export async function refuseRemovingNamedPeople(
  reader: Reader,
  ids: readonly string[],
): Promise<void> {
  const naming = await recordNaming(reader, "person", ids);
  if (naming !== undefined) {
    throw new ConflictError(
      `This person is named by ${naming}; change that first`,
    );
  }
}

// Every record of every kind, live and in drafts, as the viewer sees them, with the records others
// hold, or, with no viewer, the published drafts, as Approvers decide them.
export async function readRecordsState(
  reader: Reader,
  viewer?: Viewer,
): Promise<RecordsState> {
  const entries: [RecordType, KindState][] = [];
  for (const kind of recordKinds) {
    const rows = (await reader
      .select()
      .from(kind.table)
      .orderBy(idOf(kind.table))) as unknown as Recorded[];
    entries.push([
      kind.type,
      {
        live: new Map(
          rows.map((row) => [String(row.id), ownFields(kind, row)]),
        ),
        rows: new Map(rows.map((row) => [String(row.id), row])),
        drafts: await readDrafts(reader, kind.type, undefined, viewer),
        held: await readHeld(reader, kind.type, viewer),
      },
    ]);
  }
  return Object.fromEntries(entries) as RecordsState;
}

export type Makers = ReadonlyMap<RecordType, Map<string, Maker>>;

// Who changed each record's draft, and when, as the viewer may see it.
export async function readRecordMakers(
  reader: Reader,
  state: RecordsState,
  viewer: Actor,
): Promise<Makers> {
  const makers = new Map<RecordType, Map<string, Maker>>();
  for (const kind of recordKinds) {
    makers.set(
      kind.type,
      await draftMakers(
        reader,
        kind.type,
        [...stateOf(state, kind.type).drafts.keys()],
        everything,
        viewer,
      ),
    );
  }
  return makers;
}

// A record's draft as the API sends it, or undefined when it has none.
export function recordDraftOut(
  kind: RecordKind,
  state: RecordsState,
  makers: Makers,
  id: string,
): RecordDraft | undefined {
  const draft = stateOf(state, kind.type).drafts.get(id);
  if (draft === undefined) return undefined;
  const live = stateOf(state, kind.type).live.get(id);
  const touched = draftFields(live, draft);
  const changed = kind.fields.filter((name) => touched.includes(name));
  const maker = makers.get(kind.type)?.get(id);
  return {
    action: draft.action,
    changed,
    live:
      live === undefined
        ? {}
        : Object.fromEntries(
            changed.map((name) => [
              name,
              // The fields are the kind's own, named just above.
              // eslint-disable-next-line security/detect-object-injection
              live[name] as string | number | boolean | null,
            ]),
          ),
    uses: usesOf(kind, state, id),
    state: draft.state,
    ...(draft.state === "rejected" && draft.reason !== null
      ? { reason: draft.reason }
      : {}),
    ...(draft.unpublished === true ? { unpublished: true } : {}),
    madeBy: maker?.madeBy ?? null,
    madeAs: maker?.madeAs ?? null,
    madeAt: maker?.madeAt.toISOString() ?? null,
    editors: maker?.editors ?? [],
    ...otherApprover(maker),
    changedBy: Object.fromEntries(
      changed.map((name) => [name, maker?.fieldEditors.get(name) ?? null]),
    ),
  };
}

// Who holds a record, when someone other than the viewer does.
export const recordHeldBy = (
  state: RecordsState,
  type: RecordType,
  id: string,
): { heldBy?: string } => {
  const holder = stateOf(state, type).held.get(id)?.holder;
  return holder === undefined ? {} : { heldBy: holder };
};

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

function refuseHeldIn(state: RecordsState, type: RecordType, id: string) {
  const holder = stateOf(state, type).held.get(id)?.holder;
  if (holder !== undefined) throw new ConflictError(heldMessage(holder));
}

// A record to change as its draft makes it, refusing one that does not exist, that someone else
// holds, or that its draft removes.
export function changeableRecord(
  state: RecordsState,
  type: RecordType,
  id: string,
): Recorded {
  if (!recordExists(state, type, id)) throw new NotFoundError(noRecord);
  refuseHeldIn(state, type, id);
  const version = versionOf(state, type, id);
  if (version === undefined) {
    throw new ConflictError(
      "This record's draft removes it; discard the draft to change it",
    );
  }
  return version;
}

// The action that takes a record from one version to another.
function actionTo(
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change["action"] {
  if (before === undefined) return "created";
  return after === undefined ? "deleted" : "changed";
}

const kindChanges = (
  kind: RecordKind,
  id: string,
  before: Recorded | undefined,
  after: Recorded | undefined,
) =>
  changesBetween(
    kind.type,
    id,
    actionTo(before, after),
    before,
    after,
    kind.fields,
  );

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
            `This links to ${kindOf(type).subject(state, target)}, which is drafted to be removed; discard that draft first`,
          );
        }
      }
    }
  }
  const touched = [{ type: kind.type, id, record: wanted ?? before }];
  const after = withVersion(state, kind.type, id, wanted);
  const problem = ruleProblem(after, touched);
  if (problem !== undefined) return new ConflictError(problem);
  const holder = holderBreaking(kind, after, id, wanted, touched);
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
    if (linkGone || ruleProblem(theirs, touched) !== undefined) {
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

// The records only drafted to be added that belong to one, through the links of their kinds, and
// those that belong to them, and so on.
function addedBelow(state: RecordsState, root: RecordRef): RecordRef[] {
  const found = new Map([[refKey(root), root]]);
  const queue = [root];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const parent = next;
    for (const kind of recordKinds) {
      const linking = Object.entries(kind.links).filter(
        ([, type]) => type === parent.type,
      );
      if (linking.length === 0) continue;
      for (const id of shownIds(state, kind.type)) {
        const version = versionOf(state, kind.type, id);
        const ref = { type: kind.type, id };
        if (
          !addedOnly(state, kind.type, id) ||
          found.has(refKey(ref)) ||
          !linking.some(([name]) =>
            linkedIds(version, name).includes(parent.id),
          )
        ) {
          continue;
        }
        found.set(refKey(ref), ref);
        queue.push(ref);
      }
    }
  }
  return [...found.values()];
}

// Every record with a draft, of every kind, as the viewer sees them.
const draftedRefs = (state: RecordsState): RecordRef[] =>
  recordKinds.flatMap((kind) =>
    [...stateOf(state, kind.type).drafts.keys()].map((id) => ({
      type: kind.type,
      id,
    })),
  );

// A record's draft with the drafts bound to it, which it uses and which use it in turn, such as the
// patterns and moved releases of a change of one cycle's length, which are discarded only together.
function boundWith(state: RecordsState, root: RecordRef): RecordRef[] {
  const users = new Set(usingRecords(state, [root]).map(refKey));
  return withUsedRecords(state, [root]).filter(
    (ref) => refKey(ref) === refKey(root) || users.has(refKey(ref)),
  );
}

// Discards the editor's draft of a record, so the record is as it is live, or, for one only drafted
// to be added, gone, with the drafts bound to it and the drafts of the records only drafted to be
// added that belong to any of them. Refused while other drafts, published or not, use any of them,
// and, to an editor who may not change cycles, when it would discard a draft of a stream's cycles.
export async function discardRecordDraft(
  database: Database,
  maker: Actor,
  type: RecordType,
  id: string,
  mayChangeCycles: boolean,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    if (!recordExists(state, type, id)) throw new NotFoundError(noRecord);
    refuseHeldIn(state, type, id);
    if (!stateOf(state, type).drafts.has(id)) throw new NotFoundError(noDraft);
    const discarded = [
      ...new Map(
        boundWith(state, { type, id })
          .flatMap((ref) =>
            addedOnly(state, ref.type, ref.id) ? addedBelow(state, ref) : [ref],
          )
          .map((ref) => [refKey(ref), ref]),
      ).values(),
    ];
    if (
      !mayChangeCycles &&
      discarded.some((ref) => ref.type === "cycle-pattern")
    ) {
      throw new ForbiddenError(
        "Only someone who changes cycles can discard this.",
      );
    }
    const keys = new Set(discarded.map(refKey));
    const added = discarded.filter((ref) => addedOnly(state, ref.type, ref.id));
    const addedKeys = new Set(added.map(refKey));
    const usedElsewhere =
      draftedRefs(state).some(
        (ref) =>
          !keys.has(refKey(ref)) &&
          usesOf(kindOf(ref.type), state, ref.id).some((used) =>
            addedKeys.has(refKey(used)),
          ),
      ) ||
      recordKinds.some((kind) =>
        [...stateOf(state, kind.type).held].some(([heldId, { draft }]) => {
          const version = drafted(
            stateOf(state, kind.type).live.get(heldId),
            draft,
          );
          return Object.entries(kind.links).some(([name, linked]) =>
            linkedIds(version, name).some((target) =>
              addedKeys.has(refKey({ type: linked, id: target })),
            ),
          );
        }),
      );
    if (usedElsewhere) {
      throw new ConflictError(
        "This draft can't be discarded while other drafts depend on it. Discard those drafts, or change them so they no longer use it, then try again.",
      );
    }
    // Going back to the live record must keep the rules for the drafts that rely on it, such as a
    // release on the cycles a change of pattern makes.
    let after = state;
    for (const ref of discarded) {
      after = withVersion(
        after,
        ref.type,
        ref.id,
        stateOf(state, ref.type).live.get(ref.id),
      );
    }
    const problem = ruleProblem(
      after,
      discarded
        .filter((ref) => !addedOnly(state, ref.type, ref.id))
        .map((ref) => ({
          ...ref,
          record: stateOf(state, ref.type).live.get(ref.id) as Recorded,
        })),
    );
    if (problem !== undefined) throw new ConflictError(problem);
    const made: Change[] = [];
    for (const ref of discarded) {
      const kind = kindOf(ref.type);
      const live = stateOf(state, ref.type).live.get(ref.id);
      made.push(
        ...asDraft(
          kindChanges(kind, ref.id, versionOf(state, ref.type, ref.id), live),
        ),
        ...clearedRejection(
          ref.id,
          () => "general",
          live,
          stateOf(state, ref.type).drafts.get(ref.id),
          ref.type,
        ),
      );
      await discardDrafts(transaction, maker.user.id, ref.type, [ref.id]);
    }
    return recordChanges(transaction, maker, made, "discard");
  });
}

// Sends a rejected draft of a record for approval again, unchanged.
export async function resubmitRecordDraft(
  database: Database,
  maker: Actor,
  type: RecordType,
  id: string,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    if (!recordExists(state, type, id)) throw new NotFoundError(noRecord);
    refuseHeldIn(state, type, id);
    const draft = stateOf(state, type).drafts.get(id);
    if (draft === undefined) throw new NotFoundError(noDraft);
    if (draft.state !== "rejected") {
      throw new ConflictError("Only a rejected draft can be resubmitted");
    }
    await setRejection(transaction, type, [id], {
      state: "waiting",
      reason: null,
    });
    return recordChanges(
      transaction,
      maker,
      clearedRejection(id, () => "general", undefined, draft, type),
      "resubmission",
    );
  });
}

// The records asked for, with every draft they use, and those those use, and so on.
function withUsedRecords(
  state: RecordsState,
  asked: readonly RecordRef[],
): RecordRef[] {
  const found = new Map(asked.map((ref) => [refKey(ref), ref]));
  const queue = [...asked];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const used of usesOf(kindOf(next.type), state, next.id)) {
      if (!found.has(refKey(used))) {
        found.set(refKey(used), used);
        queue.push(used);
      }
    }
  }
  return [...found.values()];
}

// The drafts that use any of those given, and those that use them, and so on.
function usingRecords(
  state: RecordsState,
  given: readonly RecordRef[],
): RecordRef[] {
  const found = new Set(given.map(refKey));
  const dependents: RecordRef[] = [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const ref of draftedRefs(state)) {
      if (found.has(refKey(ref))) continue;
      if (
        usesOf(kindOf(ref.type), state, ref.id).some((used) =>
          found.has(refKey(used)),
        )
      ) {
        found.add(refKey(ref));
        dependents.push(ref);
        grew = true;
      }
    }
  }
  return dependents;
}

function requireRecordDrafts(state: RecordsState, asked: readonly RecordRef[]) {
  if (asked.some(({ type, id }) => !stateOf(state, type).drafts.has(id))) {
    throw new NotFoundError(gone);
  }
}

async function refuseHeldRecords(
  transaction: Transaction,
  refs: readonly RecordRef[],
): Promise<void> {
  for (const kind of recordKinds) {
    await refuseHeldDecision(
      transaction,
      kind.type,
      refs.filter(({ type }) => type === kind.type).map(({ id }) => id),
    );
  }
}

// Approves the drafts of the records asked for, and those they use, applying them to the live
// records, and returns the changes made, for approvals.ts to record with the other drafts approved
// at the same time. The live records must still keep every rule once they are applied.
export async function approveRecordDrafts(
  transaction: Transaction,
  asked: readonly RecordRef[],
): Promise<Change[]> {
  if (asked.length === 0) return [];
  const state = await readRecordsState(transaction);
  requireRecordDrafts(state, asked);
  const approved = withUsedRecords(state, asked);
  await refuseHeldRecords(transaction, approved);
  refuseRejected(
    approved.map(({ type, id }) => stateOf(state, type).drafts.get(id)),
  );
  const made: Change[] = [];
  const touched: Touched[] = [];
  const removed: { kind: RecordKind; id: string }[] = [];
  for (const kind of recordKinds) {
    const live = stateOf(state, kind.type).live;
    const rows = new Map(stateOf(state, kind.type).rows);
    const table = kind.table;
    for (const id of shownIds(state, kind.type)) {
      if (!approved.some((ref) => ref.type === kind.type && ref.id === id)) {
        continue;
      }
      const before = live.get(id);
      const after = versionOf(state, kind.type, id);
      touched.push({
        type: kind.type,
        id,
        record: (after ?? before) as Recorded,
      });
      if (after === undefined) {
        removed.push({ kind, id });
        continue;
      }
      const values = ownFields(kind, after);
      if (before === undefined) {
        const row = { ...values, ...kind.added?.(rows) };
        await transaction.insert(table).values({ id, ...row } as never);
        rows.set(id, row);
      } else {
        await transaction
          .update(table)
          .set(values)
          .where(eq(idOf(table), id));
      }
      made.push(...kindChanges(kind, id, before, after));
    }
  }
  for (const { kind, id } of removed.reverse()) {
    made.push(
      ...kindChanges(
        kind,
        id,
        stateOf(state, kind.type).live.get(id),
        undefined,
      ),
    );
    await transaction.delete(kind.table).where(eq(idOf(kind.table), id));
  }
  for (const kind of recordKinds) {
    await deleteDrafts(
      transaction,
      kind.type,
      approved.filter(({ type }) => type === kind.type).map(({ id }) => id),
    );
  }
  const problem = ruleProblem(
    liveOnly(await readRecordsState(transaction)),
    touched,
  );
  if (problem !== undefined) throw new ConflictError(problem);
  return made;
}

// Rejects the drafts of the records asked for with a reason, refusing a draft that others use
// unless they are rejected too, and returns the changes to record.
export async function rejectRecordDrafts(
  transaction: Transaction,
  asked: readonly RecordRef[],
  reason: string,
): Promise<Change[]> {
  if (asked.length === 0) return [];
  const state = await readRecordsState(transaction);
  requireRecordDrafts(state, asked);
  await refuseHeldRecords(transaction, asked);
  if (usingRecords(state, asked).length > 0) {
    throw new ConflictError(
      "Other drafts depend on these drafts. Reject them together, or wait until those drafts no longer depend on these.",
    );
  }
  const made: Change[] = [];
  for (const kind of recordKinds) {
    const ids = asked
      .filter(({ type }) => type === kind.type)
      .map(({ id }) => id);
    for (const id of ids) {
      const draft = stateOf(state, kind.type).drafts.get(id) as Draft;
      if (draft.state === "rejected" && draft.reason === reason) continue;
      made.push({
        recordType: kind.type,
        recordId: id,
        action: "changed",
        field: rejectedField,
        tier: "general",
        oldValue: draft.state === "rejected" ? draft.reason : null,
        newValue: reason,
        draft: true,
      });
    }
    await setRejection(transaction, kind.type, ids, {
      state: "rejected",
      reason,
    });
  }
  return made;
}

// The records one user's unpublished changes touch, as they see them, and as everyone else does.
export interface RecordVersions {
  mine: RecordsState;
  theirs: RecordsState;
}

export async function readRecordVersions(
  reader: Reader,
  userId: string,
): Promise<RecordVersions> {
  return {
    mine: await readRecordsState(reader, userId),
    theirs: await readRecordsState(reader),
  };
}

// What a user's change to a record is to, as the Drafts page names it: as they see the record, or,
// where their draft removes it, as everyone else does.
export function recordSubject(
  { mine, theirs }: RecordVersions,
  type: RecordType,
  id: string,
): string {
  const seen = versionOf(mine, type, id) ?? stateOf(mine, type).live.get(id);
  return kindOf(type).subject(seen === undefined ? theirs : mine, id);
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
  return misfitOf(kindOf(type), mine, id, version, before) === undefined;
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
