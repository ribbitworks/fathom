// SPDX-License-Identifier: Apache-2.0

// The check on publishing private changes: the fields someone else changed since a user's private
// change began, or the whole record one of them removed. Part of the data access layer.

import { fieldOfValue } from "@fathom/db";
import { type DraftKind, isDraftKind, type RecordType } from "@fathom/shared";
import {
  type Draft,
  drafted,
  type Recorded,
  same,
  wantsNoDraft,
} from "./draft-records.ts";
import { liveOrder } from "./list-state.ts";
import { isRecordType } from "./records.ts";
import { stateOf } from "./record-state.ts";
import { type Row, type Versions } from "./private-versions.ts";
import { changeKey } from "./unpublished-uses.ts";

// A change approved or otherwise made live, as the history recorded it, with who made it.
export interface LiveChange {
  field: string;
  tier: string;
  madeBy: string | null;
}

// What others made live of a record since the user's removal of it, or their taking back its
// addition, began: whether it was added, and its changes, oldest first.
export interface LiveSince {
  added: boolean;
  changes: LiveChange[];
}

// A record as everyone but the user sees it: live, and its published draft, with, for a removal or
// a take-back, what was made live since it began.
export interface Seen {
  live: Recorded | undefined;
  published: Draft | undefined;
  liveSince?: LiveSince;
  // When the published draft's removal of the record was published, where it removes it.
  removedAt?: Date;
}

// A field of a private change whose value now is no longer the one it started from.
export interface FieldConflict {
  field: string;
  was: unknown;
  mine: unknown;
  theirs: unknown;
  // Where the value now is: in the published draft, as it stands, or live.
  state: Draft["state"] | "live";
}

const nothingSeen: Seen = { live: undefined, published: undefined };

// How everyone else sees each kind of record kept outside the plan's records.
const seenOfKind: Record<
  Exclude<DraftKind, RecordType>,
  (versions: Versions, id: string) => Seen
> = {
  person: ({ people }, id) => ({
    live: people.live.get(id),
    published: people.theirs.get(id),
  }),
  "planned-hire": ({ hires }, id) => ({
    live: hires.live.get(id),
    published: hires.theirs.get(id),
  }),
  "feature-team": ({ teams }, id) => ({
    live: teams.live.get(id),
    published: teams.theirs.get(id),
  }),
  list: ({ theirs }, id) => ({
    live: theirs.lists.lists.get(id),
    published: theirs.lists.listDrafts.get(id),
  }),
  "list-item": ({ theirs }, id) => ({
    live: theirs.lists.choices.get(id)?.record,
    published: theirs.lists.choiceDrafts.get(id),
  }),
  "choice-order": ({ theirs }, id) => ({
    live: { order: liveOrder(theirs.lists, id) },
    published: theirs.lists.orderDrafts.get(id),
  }),
  field: ({ theirs }, id) => ({
    live: theirs.columns.fields.get(id),
    published: theirs.columns.fieldDrafts.get(id),
  }),
};

const seenKindOf = new Map<string, (versions: Versions, id: string) => Seen>(
  Object.entries(seenOfKind),
);

function seenOfAnyKind(versions: Versions, row: Row): Seen {
  if (isRecordType(row.recordType)) {
    const kind = stateOf(versions.records.theirs, row.recordType);
    return {
      live: kind.live.get(row.recordId),
      published: kind.drafts.get(row.recordId),
    };
  }
  return (
    seenKindOf.get(row.recordType)?.(versions, row.recordId) ?? nothingSeen
  );
}

// A record a private change changes, as everyone else sees it, with what was made live since a
// removal began; nothing for a kind Fathom no longer has.
export function seenByOthers(versions: Versions, row: Row): Seen {
  const key = changeKey(row);
  const liveSince = versions.liveSince.get(key);
  const removedAt = versions.removedAt.get(key);
  return {
    ...seenOfAnyKind(versions, row),
    ...(liveSince === undefined ? {} : { liveSince }),
    ...(removedAt === undefined ? {} : { removedAt }),
  };
}

// A field's value in a draft's fields over a record: the draft's where it names the field,
// otherwise the record's, as a private change's own fields started from.
function valueIn(
  fields: Recorded | undefined,
  live: Recorded | undefined,
  field: string,
): unknown {
  // The field is one of the change's own, read from its record.
  /* eslint-disable security/detect-object-injection */
  return fields !== undefined && Object.hasOwn(fields, field)
    ? fields[field]
    : (live?.[field] ?? null);
  /* eslint-enable security/detect-object-injection */
}

// Values alike as stored, an empty list as nothing, as a person's cleared column is.
const alike = (first: unknown, second: unknown) => {
  const emptied = (value: unknown) =>
    Array.isArray(value) && value.length === 0 ? null : value;
  return same(emptied(first), emptied(second));
};

// A change that names no field of its own, such as a record its maker adds or a change from before
// own fields were kept, holds its whole draft, as do a removal and a change of the published
// draft's action, so none is checked field by field: its maker meant the whole record.
const checked = (row: Row, published: Draft | undefined) =>
  Object.keys(row.startedFrom).length > 0 &&
  row.action !== "deleted" &&
  (published === undefined || published.action === row.action);

// The fields of a private change, as it stands over the published draft, that someone else changed
// to another value since it began. A field changed to the user's own value too asks nothing.
export function fieldConflicts(row: Row, seen: Seen): FieldConflict[] {
  const { live, published } = seen;
  if (!checked(row, published)) return [];
  return Object.entries(row.startedFrom).flatMap(([field, was]) => {
    const theirs = valueIn(published?.fields, live, field);
    const mine = valueIn(row.fields, live, field);
    if (alike(theirs, was) || alike(theirs, mine)) return [];
    const inDraft =
      published !== undefined && Object.hasOwn(published.fields, field);
    const state = inDraft ? published.state : "live";
    return [{ field, was, mine, theirs, state }];
  });
}

// A private change with the fields given up for the values others see: no longer its own,
// each takes the published draft's value, or the live one where the draft doesn't change it.
// Undefined once no field of its own is left, when it changes nothing over what is there.
export function givenUp(
  row: Row,
  seen: Seen,
  fields: ReadonlySet<string>,
): Row | undefined {
  if (fields.size === 0) return row;
  const startedFrom = Object.fromEntries(
    Object.entries(row.startedFrom).filter(([field]) => !fields.has(field)),
  );
  if (Object.keys(startedFrom).length === 0) return undefined;
  const published = seen.published?.fields ?? {};
  const kept = Object.entries(row.fields).filter(
    ([field]) => !fields.has(field),
  );
  const theirs = Object.entries(published).filter(([field]) =>
    fields.has(field),
  );
  return {
    ...row,
    fields: Object.fromEntries([...kept, ...theirs]),
    startedFrom,
  };
}

// A private change to a record only drafted to be added, as it publishes once the addition is
// approved: its own fields as a change to the live record, or, where it took the addition back, the
// live record's removal. Any other change is as it was. A field emptied holds nothing, as a
// person's cleared column does.
export function overApproved(row: Row, seen: Seen): Row {
  if (seen.live === undefined) return row;
  const own = Object.keys(row.startedFrom);
  if (row.action === "created" && own.length > 0) {
    const fields = Object.fromEntries(
      own.map((field) => [
        field,
        // The field is one of the change's own, named just above.
        // eslint-disable-next-line security/detect-object-injection
        row.fields[field] ?? (fieldOfValue(field) === null ? null : []),
      ]),
    );
    return { ...row, action: "changed", fields };
  }
  return wantsNoDraft(row) && seen.liveSince?.added === true
    ? { ...row, action: "deleted", fields: {} }
    : row;
}

// A clash on a whole record: a private change to a record someone else's published change removes,
// or a private removal of a record someone else changed since, by whom the record is removed.
export interface RecordClash {
  removedBy: "theirs" | "mine";
  // Where the other change is: in the published draft, as it stands, or live.
  state: Draft["state"] | "live";
  // For the user's own removal, the fields changed since it began, which make the clash.
  fields: string[];
}

// Whether a private change clashes with someone else's on the whole record: a change over a
// removal published since, or a removal of a record whose values, in the published draft or live,
// are no longer those it started from, or that has a field made live since that it never started
// from. Taking a published draft back is a change too: over a removal published since, or a
// removal where it takes back a record's addition. Only a take-back naming no field of its own,
// such as undoing a removal, means whatever the published draft holds. A removal of a record
// others no longer have asks nothing.
export function recordClash(row: Row, seen: Seen): RecordClash | undefined {
  const { live, published, liveSince } = seen;
  const takesBack = wantsNoDraft(row);
  if (takesBack && Object.keys(row.startedFrom).length === 0) return undefined;
  // A removal published before the change began is one its maker changed over, not one since.
  const removedSince =
    published?.action === "deleted" &&
    !(seen.removedAt !== undefined && seen.removedAt < row.since);
  if (row.action === "changed" && removedSince) {
    const state = published.state;
    return { removedBy: "theirs", state, fields: [] };
  }
  const removes =
    row.action === "deleted" ||
    (takesBack && published !== undefined && published.action !== row.action);
  if (!removes || drafted(live, published) === undefined) return undefined;
  const fields = new Set([
    ...Object.keys(row.startedFrom),
    ...Object.keys(published?.fields ?? {}),
  ]);
  const changedSince = [
    ...[...fields].filter(
      (field) =>
        !alike(
          valueIn(published?.fields, live, field),
          valueIn(row.startedFrom, live, field),
        ),
    ),
    ...new Set(
      (liveSince?.changes ?? [])
        .map(({ field }) => field)
        .filter((field) => !fields.has(field)),
    ),
  ];
  const state = published?.state ?? "live";
  return changedSince.length > 0
    ? { removedBy: "mine", state, fields: changedSince }
    : undefined;
}

// A field, or with none the whole record, of a private change: the key a value kept names it by.
export const keyOf = (recordType: string, recordId: string, field?: string) =>
  JSON.stringify([recordType, recordId, field ?? null]);

// A field, or a whole record, someone else changed that no value is kept for yet, of a kind of record
// Fathom has.
export type Unresolved = { row: Row; kind: DraftKind } & (
  { conflict: FieldConflict } | { clash: RecordClash }
);

// The clashes of one private change: on the whole record, or else field by field.
function clashesOf(row: Row, kind: DraftKind, seen: Seen): Unresolved[] {
  const clash = recordClash(row, seen);
  return clash === undefined
    ? fieldConflicts(row, seen).map((conflict) => ({ row, kind, conflict }))
    : [{ row, kind, clash }];
}

// Every clash of the private changes given, before any side is kept. A change of a kind Fathom no
// longer has is not checked, since nothing names its fields.
export const clashesIn = (
  rows: readonly Row[],
  seenOf: (row: Row) => Seen,
): Unresolved[] =>
  rows.flatMap((row) => {
    const kind = row.recordType;
    return isDraftKind(kind) ? clashesOf(row, kind, seenOf(row)) : [];
  });

export const fieldOf = (each: Unresolved) =>
  "conflict" in each ? each.conflict.field : undefined;

// A clash's key, as a side kept for it names it.
export const clashKey = (each: Unresolved) =>
  keyOf(each.kind, each.row.recordId, fieldOf(each));
