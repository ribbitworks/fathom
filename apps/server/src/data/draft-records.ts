// SPDX-License-Identifier: Apache-2.0

// A draft and the record it makes: the fields it changes, how sensitive it is, and the changes it
// records when its rejection is cleared. Part of the data access layer.

import { drafts, fieldOfValue, privateChanges } from "@fathom/db";
import { type DraftKind, type Tier } from "@fathom/shared";
import { mostSensitive } from "../access.ts";
import { ConflictError } from "../errors.ts";
import { type Change, stableJson } from "./changes.ts";
import { typeOf } from "./column-types.ts";
import type { ColumnInfo } from "./values.ts";

// A record as the change history records it, such as a person's details and each column's choices,
// left out when none are chosen.
export type Recorded = Record<string, unknown>;

export type DraftRow = typeof drafts.$inferSelect;
type UnpublishedRow = typeof privateChanges.$inferSelect;

// The user whose own unpublished drafts are read in place of the published ones, or undefined to
// read the published drafts alone, as Approvers decide them.
export type Viewer = string | undefined;

export interface Draft {
  action: Change["action"];
  fields: Recorded;
  state: "waiting" | "rejected";
  reason: string | null;
  // Rises with each draft made, so records drafted to be added keep the order they were drafted in.
  sequence: number;
  // Whether the draft holds the viewer's own changes, not yet published.
  unpublished?: boolean;
}

// Refuses sending a draft for approval again unless it was rejected.
export function requireRejected(
  draft: Draft | undefined,
): asserts draft is Draft {
  if (draft?.state !== "rejected") {
    throw new ConflictError("Only a rejected draft can be resubmitted");
  }
}

// A rejected draft is back with its makers until they send it again, so it is approved neither
// itself nor with a draft that uses it.
export function refuseRejected(found: Iterable<Draft | undefined>): void {
  for (const draft of found) {
    if (draft?.state === "rejected") {
      throw new ConflictError(
        "One of these drafts, or one it depends on, was rejected; it can be approved once that draft is resubmitted",
      );
    }
  }
}

export const draftUnseen = (what: string) =>
  `One of these drafts ${what} this role can't see, so an Approver who sees them must decide it`;

export const unseenDraft = draftUnseen("holds details");

// The history field that holds a rejected draft's reason, which waiting drafts do not have.
export const rejectedField = "rejected";

// Values as stored, so lists of choices compare by what they hold.
export const same = (first: unknown, second: unknown) =>
  stableJson(first ?? null) === stableJson(second ?? null);

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

export function toDraft(row: DraftRow): Draft {
  return {
    action: row.action as Change["action"],
    fields: row.fields,
    state: row.state === "rejected" ? "rejected" : "waiting",
    reason: row.reason,
    sequence: row.sequence,
  };
}

// An unpublished draft waits for approval once published, whatever the draft it replaces.
export function toUnpublished(row: UnpublishedRow): Draft {
  return {
    action: row.action as Change["action"],
    fields: row.fields,
    state: "waiting",
    reason: null,
    sequence: row.sequence,
    unpublished: true,
  };
}

// The unpublished draft of a record whose user wants no draft of it, so publishing removes the
// published one.
export const noDraft = { action: "changed", fields: {} } as const;

export const wantsNoDraft = (row: { action: string; fields: Recorded }) =>
  row.action === "changed" && Object.keys(row.fields).length === 0;

// For each field a user's private change makes its own, the value it started from: as the
// published draft had it, or the live record where that doesn't change it. Fields kept from before
// stay theirs, from the value they first started from; a field becomes theirs once the draft wanted
// differs in it from the one they saw, a field cleared to nothing included.
export function startedFrom(
  kept: Recorded,
  wanted: Pick<Draft, "fields">,
  seen: Pick<Draft, "fields"> | undefined,
  published: Pick<Draft, "fields"> | undefined,
  live: Recorded | undefined,
): Recorded {
  const from = { ...kept };
  const fields = new Set([
    ...Object.keys(wanted.fields),
    ...Object.keys(seen?.fields ?? {}),
  ]);
  // The fields are the drafts' own, read just above.
  /* eslint-disable security/detect-object-injection */
  for (const field of fields) {
    if (Object.hasOwn(from, field)) continue;
    const both =
      Object.hasOwn(wanted.fields, field) ===
      Object.hasOwn(seen?.fields ?? {}, field);
    if (both && same(wanted.fields[field], seen?.fields[field])) continue;
    from[field] =
      published !== undefined && Object.hasOwn(published.fields, field)
        ? published.fields[field]
        : (live?.[field] ?? null);
  }
  /* eslint-enable security/detect-object-injection */
  return from;
}

// A user's private change over the published draft it started from, or none when it leaves the
// record as it is live. The fields its maker changed are the keys of what they started from; a
// change that names none, such as a record its maker adds, holds the whole draft, as does a change
// of action, such as a removal, and so stands in for the published draft.
export function withOwnFields(
  published: Draft | undefined,
  row: UnpublishedRow,
): Draft | undefined {
  const own = Object.keys(row.startedFrom);
  const whole =
    own.length === 0 ||
    published === undefined ||
    published.action !== row.action;
  const fields = whole
    ? row.fields
    : Object.fromEntries([
        ...Object.entries(published.fields).filter(
          ([field]) => !own.includes(field),
        ),
        ...Object.entries(row.fields).filter(([field]) => own.includes(field)),
      ]);
  const draft = { action: row.action, fields };
  return wantsNoDraft(draft) ? undefined : toUnpublished({ ...row, fields });
}

// The action that takes a record from one version to another.
export function actionTo(
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change["action"] {
  if (before === undefined) return "created";
  return after === undefined ? "deleted" : "changed";
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

// The changes recorded for a rejected draft whose reason is cleared, as when it is changed again or
// discarded, so it waits for approval again.
export function clearedRejection(
  id: string,
  tierOf: (field: string) => Tier,
  live: Recorded | undefined,
  draft: Draft | undefined,
  recordType: DraftKind = "person",
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

// The change rejecting a draft for a reason, at its tier; none when it is already rejected for it.
export function rejectionChange(
  recordType: DraftKind,
  id: string,
  draft: Draft,
  reason: string,
  tier: Tier,
): Change[] {
  return draft.state === "rejected" && draft.reason === reason
    ? []
    : [
        {
          recordType,
          recordId: id,
          action: "changed",
          field: rejectedField,
          tier,
          oldValue: draft.state === "rejected" ? draft.reason : null,
          newValue: reason,
          draft: true,
        },
      ];
}

// Changes marked as changes to drafts.
export const asDraft = (made: readonly Change[]): Change[] =>
  made.map((change) => ({ ...change, draft: true }));

// Whether the columns hold a person as recorded: each value one its column's type holds, as
// column-types.ts sets out, and a value in every required column.
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
      const type = typeOf(column);
      return (
        (!column.required || type.count(value) > 0) &&
        type.fits(column, value, listOf)
      );
    })
  );
}
