// SPDX-License-Identifier: Apache-2.0

// The plan's records: their kinds and the rules across them, reading them with their drafts, and
// showing each draft. Part of the data access layer.

import { fields, type Reader } from "@fathom/db";
import {
  type ClassAccess,
  draftKeyKinds,
  noteProblem,
  type RecordDraft,
  type RecordType,
  recordTypeSchema,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Actor } from "../access.ts";
import { BadRequestError, ConflictError } from "../errors.ts";
import { draftFields, type Recorded, type Viewer } from "./draft-records.ts";
import {
  draftMakers,
  everything,
  type Maker,
  viewerMarks,
} from "./draft-makers.ts";
import { heldByOf, readDrafts, readHeld } from "./drafts.ts";
import { activityKind } from "./activity-kinds.ts";
import { allocationKind, allocationProblem } from "./allocation-kinds.ts";
import { planningSettingsKind } from "./planning-settings-kind.ts";
import { keyNumberOf, readKindsKeyNumbers } from "./record-keys.ts";
import { projectKinds } from "./project-kinds.ts";
import { releaseKinds } from "./release-kinds.ts";
import { releaseProblem, retiredTargetProblem } from "./release-problems.ts";
import {
  everyVersion,
  type KindState,
  linkedIds,
  type RecordKind,
  type RecordsState,
  type Referred,
  shownIds,
  stateOf,
  subjectFor,
  type Touched,
  usesOf,
  versionOf,
} from "./record-state.ts";
import { readValues, recordedValues, valueFieldsIn } from "./values.ts";

// Every kind, in the order approving adds and changes them, so a record comes after the records it
// links to; removals go the other way.
export const recordKinds: readonly RecordKind[] = [
  ...releaseKinds,
  ...projectKinds,
  activityKind,
  allocationKind,
  planningSettingsKind,
];

// A record removed while another, as shown, still links to it, such as a customer a project names.
function linkedProblem(
  state: RecordsState,
  touched: readonly Touched[],
  access: ClassAccess,
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
        return `This is used by ${subjectFor(kind, state, user, access)}; change that first`;
      }
    }
  }
  return undefined;
}

// The rules across records of several kinds, checked for each change drafted, published, and
// approved: each gives the first way the records break it, if any, the more telling first, in words
// the role acting can see.
const recordRules: readonly ((
  state: RecordsState,
  touched: readonly Touched[],
  access: ClassAccess,
) => string | undefined)[] = [
  allocationProblem,
  linkedProblem,
  releaseProblem,
  retiredTargetProblem,
];

export const ruleProblem = (
  state: RecordsState,
  touched: readonly Touched[],
  access: ClassAccess,
) =>
  recordRules
    .map((rule) => rule(state, touched, access))
    .find((found) => found !== undefined);

export const kindOf = (type: RecordType): RecordKind =>
  recordKinds.find((kind) => kind.type === type) as RecordKind;

export const isRecordType = (type: string): type is RecordType =>
  recordTypeSchema.safeParse(type).success;

export const noRecord = "There is no such record; refresh to see the latest";
export const noDraft = "There is no such draft";
export const gone =
  "One of these drafts no longer exists; refresh to see the latest";

// The table's id column, which every kind's table has.
export const idOf = (table: PgTable) =>
  (table as unknown as { id: PgColumn }).id;

// The record's own fields, from a row or a version with others beside them.
export const ownFields = (kind: RecordKind, from: Recorded): Recorded =>
  Object.fromEntries(
    // The field is one of the kind's own.
    // eslint-disable-next-line security/detect-object-injection
    kind.fields.map((name) => [name, from[name]]),
  );

// The first record, live, in a draft, or in anyone's unpublished changes, as the editor sees them,
// that names any of the people, choices, or feature teams given, with the records it was found in.
async function namingRecord(
  reader: Reader,
  named: Referred,
  ids: readonly string[],
  editor?: Viewer,
): Promise<{ kind: RecordKind; state: RecordsState; id: string } | undefined> {
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
    if (found !== undefined) return { kind, state, id: found[0] };
  }
  return undefined;
}

export const isNamedByRecord = async (
  reader: Reader,
  named: Referred,
  ids: readonly string[],
  editor: Viewer,
): Promise<boolean> =>
  (await namingRecord(reader, named, ids, editor)) !== undefined;

const removedWords: Record<Exclude<Referred, "choice">, string> = {
  person: "This person",
  "feature-team": "This feature team",
};

// Refuses removing people or feature teams a record names, live or in a draft, published or not,
// anyone's unpublished changes included, naming that record only to a role that reads its kind.
export async function refuseRemovingNamed(
  reader: Reader,
  named: Exclude<Referred, "choice">,
  ids: readonly string[],
  actor: Actor,
): Promise<void> {
  const naming = await namingRecord(reader, named, ids, actor.user.id);
  if (naming !== undefined) {
    const { kind, state, id } = naming;
    throw new ConflictError(
      // The kind of record removed is one of the two named above.
      // eslint-disable-next-line security/detect-object-injection
      `${removedWords[named]} is named by ${subjectFor(kind, state, id, actor)}; change that first`,
    );
  }
}

// The values each record holds in the columns added to its kind's table, for a kind that has them.
async function addedValues(
  reader: Reader,
  kind: RecordKind,
  rows: readonly Recorded[],
): Promise<Map<string, Recorded>> {
  if (kind.addedColumns === undefined) return new Map();
  const { owner, table } = kind.addedColumns;
  const columns = await reader
    .select({ id: fields.id })
    .from(fields)
    .where(eq(fields.tableName, table));
  const values = await readValues(
    reader,
    rows.map(({ id }) => String(id)),
    columns.map(({ id }) => id),
    owner,
  );
  return new Map(
    [...values].map(([id, held]) => [id, recordedValues(held) as Recorded]),
  );
}

// Every record of every kind, live and in drafts, as the viewer sees them, with the records others
// hold, or, with no viewer, the published drafts, as Approvers decide them.
export async function readRecordsState(
  reader: Reader,
  viewer?: Viewer,
): Promise<RecordsState> {
  const entries: [RecordType, KindState][] = [];
  const keys = await readKindsKeyNumbers(
    reader,
    recordKinds.flatMap((kind) => draftKeyKinds[kind.type] ?? []),
  );
  for (const kind of recordKinds) {
    const keyKind = draftKeyKinds[kind.type];
    const rows = (await reader
      .select()
      .from(kind.table)
      .orderBy(idOf(kind.table))) as unknown as Recorded[];
    const added = await addedValues(reader, kind, rows);
    entries.push([
      kind.type,
      {
        live: new Map(
          rows.map((row) => [
            String(row.id),
            { ...ownFields(kind, row), ...added.get(String(row.id)) },
          ]),
        ),
        rows: new Map(rows.map((row) => [String(row.id), row])),
        drafts: await readDrafts(reader, kind.type, undefined, viewer),
        held: await readHeld(reader, kind.type, viewer),
        keys: (keyKind === null ? undefined : keys.get(keyKind)) ?? new Map(),
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
// A record's draft as read, which always says who last changed each field.
export type RecordDraftOut = RecordDraft & {
  changedBy: NonNullable<RecordDraft["changedBy"]>;
};

export function recordDraftOut(
  kind: RecordKind,
  state: RecordsState,
  makers: Makers,
  id: string,
): RecordDraftOut | undefined {
  const draft = stateOf(state, kind.type).drafts.get(id);
  if (draft === undefined) return undefined;
  const live = stateOf(state, kind.type).live.get(id);
  const touched = draftFields(live, draft);
  const together = kind.changedTogether ?? [];
  const changed = [...kind.fields, ...valueFieldsIn(live, draft.fields)].filter(
    (name) =>
      touched.includes(name) ||
      (together.includes(name) &&
        together.some((other) => touched.includes(other))),
  );
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
              (live[name] ?? null) as string | number | boolean | null,
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
    ...viewerMarks(maker),
    changedBy: Object.fromEntries(
      changed.map((name) => [
        name,
        [name, ...together]
          .map((field) => maker?.fieldEditors.get(field))
          .find((editor) => editor !== undefined) ?? null,
      ]),
    ),
  };
}

// Who holds a record, when someone other than the viewer does.
export const recordHeldBy = (
  state: RecordsState,
  type: RecordType,
  id: string,
): { heldBy?: string } => heldByOf(stateOf(state, type).held, id);

// A record's draft and who holds it, as the API sends them beside its fields.
export const recordExtras = (
  state: RecordsState,
  makers: Makers,
  type: RecordType,
  id: string,
) => {
  const draft = recordDraftOut(kindOf(type), state, makers, id);
  return {
    ...(draft === undefined ? {} : { draft }),
    ...recordHeldBy(state, type, id),
  };
};

// A record's key number, live or drafted to be added.
export const recordKeyNumber = (
  state: RecordsState,
  type: RecordType,
  id: string,
): number => keyNumberOf(stateOf(state, type).keys, id);

// A record's note as it is kept: null when empty, refusing one a note may not hold.
export function keptNote(note: string | null): string | null {
  const kept = note === null || note.trim() === "" ? null : note;
  if (kept !== null) {
    const problem = noteProblem(kept);
    if (problem !== undefined) throw new BadRequestError(problem);
  }
  return kept;
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
// where their draft removes it, as everyone else does. Their drafts may be of records the role
// they act as can't read, made under another role or by a change that moves them, which are named
// without the record's own name.
export function recordSubject(
  { mine, theirs }: RecordVersions,
  type: RecordType,
  id: string,
  access: ClassAccess,
): string {
  const seen = versionOf(mine, type, id) ?? stateOf(mine, type).live.get(id);
  return subjectFor(
    kindOf(type),
    seen === undefined ? theirs : mine,
    id,
    access,
  );
}
