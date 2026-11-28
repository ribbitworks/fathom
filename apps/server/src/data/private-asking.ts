// SPDX-License-Identifier: Apache-2.0

// What a user is asked about a clash on publishing their private changes, as their role sees it:
// both sides and who made the other, or nothing, where the role doesn't see it, which is given up.
// Part of the data access layer.

import {
  type BlindField,
  type ChangedField,
  type PrivateConflict,
} from "@fathom/shared";
import { type Maker } from "./draft-makers.ts";
import {
  fieldOf,
  type LiveChange,
  type LiveSince,
  type Unresolved,
} from "./private-conflicts.ts";

// How the role sees one side of a field: as the history shows it, in a field the history doesn't
// show, or not at all, where it doesn't see the record's kind or the field's class.
export type SideSeen = ChangedField | "unshown" | "unseen";

// How the role sees a side, from the sides the history shows it.
export const sideSeen = <Side>(
  shown: ReadonlyMap<Side, ChangedField | undefined>,
  side: Side,
): SideSeen => (shown.has(side) ? (shown.get(side) ?? "unshown") : "unseen");

// Who made the latest change made live since a removal began that the role is shown, by the
// history's rules.
export const liveMaker = (
  liveSince: LiveSince | undefined,
  shows: (change: LiveChange) => boolean,
): string | null => liveSince?.changes.filter(shows).at(-1)?.madeBy ?? null;

// Who made the other side of a clash: who last changed the field, or, for a record, who last
// changed it, though for the user's own removal only someone whose change came after it began,
// and, where the record's change is live, who made it live.
export function otherMaker(
  each: Unresolved,
  maker: Maker | undefined,
  began: Date | null | undefined,
  live: string | null,
): string | null | undefined {
  if ("conflict" in each) return maker?.fieldEditors.get(each.conflict.field);
  if (each.clash.state === "live") return live;
  const later =
    each.clash.removedBy === "theirs" ||
    (maker !== undefined && began instanceof Date && maker.madeAt > began);
  return later ? maker?.madeBy : null;
}

// Where the role doesn't see a side, by the record's kind or the field's class, the clash is given
// up, so nobody overwrites what they can't see. For a whole record, both sides are the record.
export const isBlind = ({
  mine,
  theirs,
}: {
  mine: SideSeen;
  theirs: SideSeen;
}): boolean => mine === "unseen" || theirs === "unseen";

// A clash given up as the answer names it: the record, and the field, if any, alone.
export const blindField = (each: Unresolved, subject: string): BlindField => {
  const field = fieldOf(each);
  return {
    recordType: each.kind,
    recordId: each.row.recordId,
    subject,
    ...(field === undefined ? {} : { field }),
  };
};

// A clash the role sees, as it is asked about: a field with both sides where the history shows them
// both, and who made the other value only then, while it is in the published draft; or a whole
// record, with who changed it.
export function askedAbout(
  each: Unresolved,
  subject: string,
  { mine, theirs }: { mine: SideSeen; theirs: SideSeen },
  by: string | null | undefined,
  token: string,
): PrivateConflict {
  const record = {
    recordType: each.kind,
    recordId: each.row.recordId,
    subject,
  };
  if ("clash" in each) {
    const { removedBy, state } = each.clash;
    return { ...record, removedBy, state, by: by ?? null, token };
  }
  const { field, state } = each.conflict;
  const shown = typeof mine !== "string" && typeof theirs !== "string";
  return {
    ...record,
    field,
    ...(shown ? { mine, theirs } : {}),
    state,
    by: shown && state !== "live" ? (by ?? null) : null,
    token,
  };
}
