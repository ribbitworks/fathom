// SPDX-License-Identifier: Apache-2.0

// The plan's records as one set of rules handles them, whatever their kind, such as release streams
// and their releases: what each kind of record holds, which fields link it to other records, and
// which value must be unique; and every record, live and in drafts, read together, with the drafts
// others hold. A draft uses the drafts of the records only drafted to be added that it links to, so
// approving it approves them, and they are rejected only together with it, as the Decisions Log
// sets out. Part of the data access layer; records.ts reads and changes the records.

import type {
  ClassifiedView,
  ColumnTable,
  Permission,
  RecordRef,
  RecordType,
} from "@fathom/shared";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Transaction } from "./changes.ts";
import {
  draftBetween,
  type Draft,
  drafted,
  type Held,
  type Recorded,
} from "./drafts.ts";
import type { ValueOwner } from "./values.ts";

export interface RecordKind {
  type: RecordType;
  // The table the live records are kept in, with a column for each field and an id.
  table: PgTable;
  // The record's fields, as the change history records them, in the order they are shown.
  fields: readonly string[];
  // The fields that link to other records, by the kind of record each links to. A field links to
  // one record, by its identifier, or to several, by a list of them, or to none when empty.
  links: Readonly<Record<string, RecordType>>;
  // The link naming the record this one belongs to, such as a release's stream, which the change
  // history names it by.
  belongsTo?: string;
  // Fields whose value no other record has, ignoring letter case, among the records with the same
  // value in another field, if one is named. A record with no value in such a field takes none.
  unique?: readonly UniqueValue[];
  // Fields naming something other than the plan's records: a person, a choice in a list, or a
  // feature team.
  refers?: Readonly<Record<string, Referred>>;
  // The permissions any of which lets someone read records of the kind, and their history.
  readWith: readonly Permission[];
  // The view whose classes of data reading the kind also needs, for a kind that needs one.
  view?: ClassifiedView;
  // The kind of owner holding values in the columns added to the kind's table, for a kind that can
  // have them, and the table.
  addedColumns?: { owner: ValueOwner; table: ColumnTable };
  // The record as the Drafts page names it, such as "the release stream Major".
  subject: (state: RecordsState, id: string) => string;
  // The record as named to its draft's maker when the role they act as can't read the kind, such
  // as "a release", for a kind such a draft can be made of.
  unseenSubject?: string;
  // The drafts the record's draft uses beyond the records it links to, such as the cycle patterns
  // drafted that make a release's cycles, asked of a draft that removes the record too.
  alsoUses?: (state: RecordsState, id: string) => RecordRef[];
  // Fields that mean one thing together, so a draft changing any of them shows them all.
  changedTogether?: readonly string[];
  // Values a record added is given beside its fields, such as its place at the end of an order,
  // from the kind's rows, including those added before it in the same approval.
  added?: (rows: ReadonlyMap<string, Recorded>) => Recorded;
  // Whether Fathom keeps the record itself, so nobody can change or remove it through a draft.
  keptByFathom?: (state: RecordsState, id: string) => boolean;
  // How the change history names a record with no name of its own: from the records its addition
  // named in these fields, each as the history names it, such as an allocation by who it puts on
  // which feature.
  historyName?: {
    fields: readonly string[];
    name: (
      named: Readonly<Record<string, string | undefined>>,
    ) => string | undefined;
  };
  // A field's value as the history says it, for a field it cannot show as it is kept, such as an
  // allocation's months, with the records its value names by the names idsInValue asks for.
  valueInWords?: (
    field: string,
    value: unknown,
    name: (id: string) => string | undefined,
  ) => string[] | undefined;
  // The records a field's value names that valueInWords names, beyond the kind's links.
  idsInValue?: (field: string, value: unknown) => string[];
  // What approving does beyond a record's own row, once the row is added and before it is removed.
  onAdded?: (transaction: Transaction, id: string) => Promise<void>;
  onRemoving?: (transaction: Transaction, id: string) => Promise<void>;
}

export type Referred = "person" | "choice" | "feature-team";

export interface UniqueValue {
  field: string;
  within?: string;
  message: string;
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

// The records a link field names: one, several, or none.
export function linkedIds(
  record: Recorded | undefined,
  name: string,
): string[] {
  const value = field(record, name);
  if (typeof value === "string") return [value];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

// The drafts a record's draft uses: those of the records only drafted to be added that it links to,
// unless it removes the record, and any others its kind names. A record with no draft uses none.
export function usesOf(
  kind: RecordKind,
  state: RecordsState,
  id: string,
): RecordRef[] {
  if (!state[kind.type].drafts.has(id)) return [];
  const version = versionOf(state, kind.type, id);
  const linked = Object.entries(kind.links).flatMap(([name, type]) =>
    linkedIds(version, name)
      .filter((target) => addedOnly(state, type, target))
      .map((target) => ({ type, id: target })),
  );
  return [...linked, ...(kind.alsoUses?.(state, id) ?? [])];
}

// Every version of the records of a kind: live, as drafts make them, and as others' unpublished
// changes would, each with its record's identifier.
export function everyVersion(
  state: RecordsState,
  type: RecordType,
): [string, Recorded | undefined][] {
  const { live, drafts, held } = stateOf(state, type);
  return [
    ...live,
    ...[...drafts.keys()].map((id): [string, Recorded | undefined] => [
      id,
      versionOf(state, type, id),
    ]),
    ...[...held].map(([id, { draft }]): [string, Recorded | undefined] => [
      id,
      drafted(live.get(id), draft),
    ]),
  ];
}

// The value a record has in a unique field, ignoring letter case, or undefined when it has none,
// and the value it must be unique among.
const uniqueKey = (unique: UniqueValue, record: Recorded) => {
  const held = field(record, unique.field);
  const value = typeof held === "string" ? held.trim().toLowerCase() : "";
  return {
    value: value === "" ? undefined : value,
    within:
      unique.within === undefined ? undefined : field(record, unique.within),
  };
};

// Why the record cannot have its unique values: the message of the first another record has, live
// or in a draft, published or not, or undefined when none is taken. A live record's value stays
// taken until a draft that changes it is approved, and an unpublished draft's until it is
// discarded, as the Decisions Log sets out.
export function takenValue(
  kind: RecordKind,
  state: RecordsState,
  record: Recorded,
  except: string,
): string | undefined {
  const versions = everyVersion(state, kind.type);
  return (kind.unique ?? []).find((unique) => {
    const wanted = uniqueKey(unique, record);
    if (wanted.value === undefined) return false;
    return versions.some(([id, version]) => {
      if (id === except || version === undefined) return false;
      const key = uniqueKey(unique, version);
      return key.value === wanted.value && key.within === wanted.within;
    });
  })?.message;
}

export const valueTaken = (
  kind: RecordKind,
  state: RecordsState,
  record: Recorded,
  except: string,
): boolean => takenValue(kind, state, record, except) !== undefined;

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
