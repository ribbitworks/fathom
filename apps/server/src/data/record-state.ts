// SPDX-License-Identifier: Apache-2.0

// The plan's records as one set of rules handles them, whatever their kind, such as release streams
// and their releases: what each kind of record holds, which fields link it to other records, and
// which value must be unique; and every record, live and in drafts, read together, with the drafts
// others hold. A draft uses the drafts of the records only drafted to be added that it links to, so
// approving it approves them, and they are rejected only together with it, as the Decisions Log
// sets out. Part of the data access layer; records.ts reads and changes the records.

import type { RecordRef, RecordType } from "@fathom/shared";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  draftBetween,
  type Draft,
  drafted,
  type Held,
  type Recorded,
} from "./drafts.ts";

export interface RecordKind {
  type: RecordType;
  // The table the live records are kept in, with a column for each field and an id.
  table: PgTable;
  // The record's fields, as the change history records them, in the order they are shown.
  fields: readonly string[];
  // The fields that link to another record, by the kind of record each links to.
  links: Readonly<Record<string, RecordType>>;
  // A field whose value no other record has, ignoring letter case, among the records with the same
  // value in another field, if one is named.
  unique?: { field: string; within?: string; message: string };
  // The record as the Drafts page names it, such as "the release stream Major".
  subject: (state: RecordsState, id: string) => string;
  // The drafts the record's draft uses beyond the records it links to, such as the cycle patterns
  // drafted that make a release's cycles, asked of a draft that removes the record too.
  alsoUses?: (state: RecordsState, id: string) => RecordRef[];
  // Values a record added is given beside its fields, such as its place at the end of an order,
  // from the kind's rows, including those added before it in the same approval.
  added?: (rows: ReadonlyMap<string, Recorded>) => Recorded;
}

export interface KindState {
  live: Map<string, Recorded>;
  // The live records' rows, with the columns beside their fields, such as a place in an order.
  rows: Map<string, Recorded>;
  // The drafts as the viewer sees them: the published ones, with their own unpublished ones in
  // place.
  drafts: Map<string, Draft>;
  // The records others hold by having unpublished changes to them.
  held: Map<string, Held>;
}

export type RecordsState = Record<RecordType, KindState>;

// The records of one kind.
export const stateOf = (state: RecordsState, type: RecordType): KindState =>
  // The kind is always one of the fixed kinds.
  // eslint-disable-next-line security/detect-object-injection
  state[type];

// A record as its draft makes it: undefined once removed, or before it is added.
export const versionOf = (
  state: RecordsState,
  type: RecordType,
  id: string,
): Recorded | undefined =>
  // The kind is always one of the fixed kinds.
  // eslint-disable-next-line security/detect-object-injection
  drafted(state[type].live.get(id), state[type].drafts.get(id));

// A record as it is shown: as its draft makes it, or, for a draft that removes it, as it is.
export const shownVersion = (
  state: RecordsState,
  type: RecordType,
  id: string,
): Recorded | undefined =>
  // eslint-disable-next-line security/detect-object-injection
  versionOf(state, type, id) ?? state[type].live.get(id);

// Whether a record is live, or drafted to be added.
export const recordExists = (
  state: RecordsState,
  type: RecordType,
  id: string,
): boolean =>
  // eslint-disable-next-line security/detect-object-injection
  state[type].live.has(id) || state[type].drafts.get(id)?.action === "created";

// Whether a record is only drafted to be added.
export const addedOnly = (
  state: RecordsState,
  type: RecordType,
  id: string,
): boolean =>
  // eslint-disable-next-line security/detect-object-injection
  !state[type].live.has(id) && state[type].drafts.get(id)?.action === "created";

// Every record of a kind shown: the live ones, then those drafted to be added, in the order
// drafted.
export const shownIds = (state: RecordsState, type: RecordType): string[] => {
  // eslint-disable-next-line security/detect-object-injection
  const { live, drafts } = state[type];
  return [...live.keys(), ...[...drafts.keys()].filter((id) => !live.has(id))];
};

const field = (record: Recorded | undefined, name: string): unknown =>
  // The field is one of the record's own, named by its kind.
  // eslint-disable-next-line security/detect-object-injection
  record?.[name];

// The drafts a record's draft uses: those of the records only drafted to be added that it links to,
// unless it removes the record, and any others its kind names. A record with no draft uses none.
export function usesOf(
  kind: RecordKind,
  state: RecordsState,
  id: string,
): RecordRef[] {
  if (!state[kind.type].drafts.has(id)) return [];
  const version = versionOf(state, kind.type, id);
  const linked = Object.entries(kind.links).flatMap(([name, type]) => {
    const target = field(version, name);
    return typeof target === "string" && addedOnly(state, type, target)
      ? [{ type, id: target }]
      : [];
  });
  return [...linked, ...(kind.alsoUses?.(state, id) ?? [])];
}

// The value a record has in its kind's unique field, ignoring letter case, and the value it must be
// unique among.
const uniqueKey = (
  unique: NonNullable<RecordKind["unique"]>,
  record: Recorded,
) => ({
  value: String(field(record, unique.field)).trim().toLowerCase(),
  within:
    unique.within === undefined ? undefined : field(record, unique.within),
});

// Whether another record has the record's unique value: live, or in a draft, published or not. A
// live record's value stays taken until a draft that changes it is approved, and an unpublished
// draft's until it is discarded, as the Decisions Log sets out.
export function valueTaken(
  kind: RecordKind,
  state: RecordsState,
  record: Recorded,
  except: string,
): boolean {
  const { unique } = kind;
  if (unique === undefined) return false;
  const { live, drafts, held } = stateOf(state, kind.type);
  const wanted = uniqueKey(unique, record);
  const versions: [string, Recorded | undefined][] = [
    ...live,
    ...[...drafts.keys()].map((id): [string, Recorded | undefined] => [
      id,
      versionOf(state, kind.type, id),
    ]),
    ...[...held].map(([id, { draft }]): [string, Recorded | undefined] => [
      id,
      drafted(live.get(id), draft),
    ]),
  ];
  return versions.some(([id, version]) => {
    if (id === except || version === undefined) return false;
    const key = uniqueKey(unique, version);
    return key.value === wanted.value && key.within === wanted.within;
  });
}

// The state with one record as wanted, as the editor's draft would make it, for checking a change
// before it is saved.
export function withVersion(
  state: RecordsState,
  type: RecordType,
  id: string,
  wanted: Recorded | undefined,
): RecordsState {
  // eslint-disable-next-line security/detect-object-injection
  const kind = state[type];
  const drafts = new Map(kind.drafts);
  const draft = draftBetween(kind.live.get(id), wanted);
  if (draft === undefined) drafts.delete(id);
  else {
    drafts.set(id, {
      ...draft,
      state: "waiting",
      reason: null,
      sequence: drafts.get(id)?.sequence ?? Number.MAX_SAFE_INTEGER,
    });
  }
  return { ...state, [type]: { ...kind, drafts } };
}

// The state with only the live records, as approving leaves them.
export const liveOnly = (state: RecordsState): RecordsState =>
  Object.fromEntries(
    Object.entries(state).map(([type, kind]) => [
      type,
      { live: kind.live, rows: kind.rows, drafts: new Map(), held: new Map() },
    ]),
  ) as RecordsState;

// A record a change touches, with its fields as the change leaves them, or, for one it removes, as
// they were.
export type Touched = RecordRef & { record: Recorded };

export const refKey = ({ type, id }: RecordRef): string => `${type} ${id}`;
