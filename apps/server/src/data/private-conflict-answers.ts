// SPDX-License-Identifier: Apache-2.0

// Publishing private changes over fields and records someone else changed meanwhile: refusing until
// the user keeps a side of each, answering each with both sides as the change history shows them
// and who made the other, and giving up what the user's role no longer sees. Part of the data
// access layer.

import {
  type BlindField,
  type DraftKind,
  type PrivateConflict,
  type Resolution,
} from "@fathom/shared";
import { changes, changeSets } from "@fathom/db";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { type Actor } from "../access.ts";
import { RequestError } from "../errors.ts";
import { type StoredChange, type Transaction } from "./changes.ts";
import { shownChanges } from "./change-history.ts";
import { draftMakers, type Maker, openChangeSets } from "./draft-makers.ts";
import { readColumnTables, showsChange } from "./history-visibility.ts";
import {
  askedAbout,
  blindField,
  isBlind,
  otherMaker,
  type SideSeen,
  sideSeen,
} from "./private-asking.ts";
import {
  clashesIn,
  clashKey,
  type RecordClash,
  seenByOthers,
  type Unresolved,
} from "./private-conflicts.ts";
import { type AsShown, resolved } from "./private-resolutions.ts";
import { giveUp } from "./private-give-ups.ts";
import {
  ownRows,
  readVersions,
  type Row,
  subjectOf,
  type Versions,
} from "./private-versions.ts";
import { changeKey } from "./unpublished-uses.ts";

// The refusal answers each clash with no side kept, so the page can show both and ask, and what it
// would give up.
class PrivateConflictsError extends RequestError {
  constructor(conflicts: PrivateConflict[], givenUp: BlindField[]) {
    super(
      409,
      "Someone else changed some of these since they were made; choose which to keep, then publish again",
      {
        details: { conflicts, ...(givenUp.length > 0 ? { givenUp } : {}) },
      },
    );
  }
}

// The change from the value a field started from to another, as the history would record it. It is
// recorded as General, so it is shown as sensitive as its field is now, which the history checks
// beside the tier recorded.
const changeTo = (
  row: Row,
  field: string,
  was: unknown,
  value: unknown,
): StoredChange => ({
  id: 0,
  changeSetId: "",
  recordType: row.recordType,
  recordId: row.recordId,
  action: "changed",
  field,
  tier: "general",
  oldValue: was,
  newValue: value,
  draft: true,
  takesBack: null,
});

const recordKey = (kind: string, id: string) => JSON.stringify([kind, id]);

type Shows = ReturnType<typeof showsChange>;

// A token for each clash's other side as the role is shown it: the change set that last made that
// side, of the published changes the role sees, so it reveals nothing of any value and changes only
// when that side does.
async function readTokens(
  transaction: Transaction,
  clashes: readonly Unresolved[],
  shows: Shows,
): Promise<(each: Unresolved) => string> {
  const published = await transaction
    .select({
      recordType: changes.recordType,
      recordId: changes.recordId,
      field: changes.field,
      action: changes.action,
      tier: changes.tier,
      changeSetId: changes.changeSetId,
    })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(
      and(
        eq(changeSets.private, false),
        inArray(
          changes.recordId,
          clashes.map(({ row }) => row.recordId),
        ),
      ),
    )
    .orderBy(asc(changes.id));
  return (each) => {
    const { kind, row } = each;
    const sides = published.filter(
      (change) =>
        change.recordType === kind &&
        change.recordId === row.recordId &&
        shows(change) &&
        ("conflict" in each
          ? change.field === each.conflict.field
          : each.clash.removedBy === "theirs"
            ? change.action === "deleted"
            : each.clash.fields.includes(change.field)),
    );
    return sides.at(-1)?.changeSetId ?? "none";
  };
}

// Who changed the published drafts of the records given, of the changes the actor may see by the
// history's rules, read once for each kind.
async function publishedMakers(
  transaction: Transaction,
  unresolved: readonly Unresolved[],
  actor: Actor,
  shows: Shows,
): Promise<Map<string, Maker>> {
  const byKind = new Map<DraftKind, Set<string>>();
  for (const { row, kind } of unresolved) {
    byKind.set(kind, (byKind.get(kind) ?? new Set()).add(row.recordId));
  }
  const found = new Map<string, Maker>();
  for (const [kind, ids] of byKind) {
    const makers = await draftMakers(
      transaction,
      kind,
      [...ids],
      (field, tier, recordId) =>
        shows({ recordType: kind, recordId, field, tier }),
      actor,
      new Set(),
    );
    for (const [id, maker] of makers) found.set(recordKey(kind, id), maker);
  }
  return found;
}

// When the user's removal of each record given began: the latest of their changes still private
// that removed it, which their removal holds.
async function beganAt(
  transaction: Transaction,
  userId: string,
  clashes: readonly Unresolved[],
): Promise<Map<string, Date | null>> {
  const rows = await transaction
    .select({
      recordType: changes.recordType,
      recordId: changes.recordId,
      began: max(changeSets.madeAt),
    })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(
      and(
        openChangeSets(userId),
        eq(changes.action, "deleted"),
        inArray(
          changes.recordId,
          clashes.map(({ row }) => row.recordId),
        ),
      ),
    )
    .groupBy(changes.recordType, changes.recordId);
  return new Map(
    rows.map(({ recordType, recordId, began }) => [
      recordKey(recordType, recordId),
      began,
    ]),
  );
}

// A side of a clash, or a field of a private change, by a key that names it.
const sideKey = (each: Unresolved, side: string) =>
  JSON.stringify([clashKey(each), side]);
const ownKey = (row: Row, field: string) =>
  JSON.stringify([row.recordType, row.recordId, "own", field]);

// The changes the history is asked to show for each clash, by key: a field's change from the value
// both started from to each side; for a whole record, each field changed since the user's removal
// began, and each field of the user's own change.
function changesShownFor(each: Unresolved): [string, StoredChange][] {
  const { row } = each;
  if ("conflict" in each) {
    const { field, was, mine, theirs } = each.conflict;
    return [
      [sideKey(each, "mine"), changeTo(row, field, was, mine)],
      [sideKey(each, "theirs"), changeTo(row, field, was, theirs)],
    ];
  }
  const values = new Map(Object.entries(row.fields));
  const started = new Map(Object.entries(row.startedFrom));
  return [
    ...each.clash.fields.map((field): [string, StoredChange] => [
      sideKey(each, `since ${field}`),
      changeTo(row, field, started.get(field), null),
    ]),
    ...[...started].map(([field, was]): [string, StoredChange] => [
      ownKey(row, field),
      changeTo(row, field, was, values.get(field)),
    ]),
  ];
}

// What the role sees of each clash, by the history's rules: the token for its other side, its
// sides, whether it is blind, and, of a private change, the fields it no longer sees.
async function asShownTo(
  transaction: Transaction,
  actor: Actor,
  clashes: readonly Unresolved[],
) {
  const tables = await readColumnTables(
    transaction,
    clashes
      .filter(({ kind }) => kind === "field")
      .map(({ row }) => row.recordId),
  );
  const shows = showsChange(actor, tables);
  const asked = clashes.flatMap(changesShownFor);
  const shownChange = await shownChanges(
    transaction,
    actor,
    asked.map(([, change]) => change),
    tables,
  );
  const shown = new Map(
    asked
      .filter(([, change]) => shownChange.has(change))
      .map(([key, change]) => [key, shownChange.get(change)]),
  );
  // Whether the role sees a whole record's clash: its kind, and, for the user's own removal, every
  // field changed since it began, so a removal never takes away a change the role can't see.
  const recordSeen = (each: Unresolved & { clash: RecordClash }): SideSeen =>
    shows({
      recordType: each.kind,
      recordId: each.row.recordId,
      field: "",
      tier: "general",
    }) &&
    each.clash.fields.every((field) =>
      shown.has(sideKey(each, `since ${field}`)),
    )
      ? "unshown"
      : "unseen";
  const sides = (each: Unresolved) =>
    "conflict" in each
      ? {
          mine: sideSeen(shown, sideKey(each, "mine")),
          theirs: sideSeen(shown, sideKey(each, "theirs")),
        }
      : { mine: recordSeen(each), theirs: recordSeen(each) };
  const asShown: AsShown = {
    token: await readTokens(transaction, clashes, shows),
    unseenFields: (row) =>
      new Set(
        Object.keys(row.startedFrom).filter(
          (field) => !shown.has(ownKey(row, field)),
        ),
      ),
    blind: (each) => isBlind(sides(each)),
  };
  return { shows, sides, asShown };
}

// The private changes going, as they publish once the sides kept are applied, with the versions they
// make and what was given up unseen, refusing them all while a clash the user's role sees has no
// side kept. A field or record the role no longer sees is given up rather than asked about, so
// nobody overwrites what they can't see. A change left with nothing of its own publishes nothing.
export async function withValuesKept(
  transaction: Transaction,
  actor: Actor,
  versions: Versions,
  rows: readonly Row[],
  resolutions: readonly Resolution[],
): Promise<{ versions: Versions; rows: Row[]; givenUp: BlindField[] }> {
  const seenOf = (row: Row) => seenByOthers(versions, row);
  const clashes = clashesIn(rows, seenOf);
  if (clashes.length === 0) return { versions, rows: [...rows], givenUp: [] };
  const { shows, sides, asShown } = await asShownTo(
    transaction,
    actor,
    clashes,
  );
  const going = resolved(rows, seenOf, resolutions, asShown);
  const blind = clashes
    .filter(asShown.blind)
    .map((each) => blindField(each, subjectOf(versions, each.row, actor)));
  if (going.unresolved.length > 0) {
    const { unresolved } = going;
    const makers = await publishedMakers(transaction, unresolved, actor, shows);
    const began = await beganAt(transaction, actor.user.id, unresolved);
    throw new PrivateConflictsError(
      unresolved.map((each) => {
        const key = recordKey(each.kind, each.row.recordId);
        return askedAbout(
          each,
          subjectOf(versions, each.row, actor),
          sides(each),
          otherMaker(each, makers.get(key), began.get(key)),
          asShown.token(each),
        );
      }),
      blind,
    );
  }
  const givenUp = going.rows.filter(
    ({ givenUp: fields, whole }) => whole || fields.size > 0,
  );
  if (givenUp.length === 0) return { versions, rows: [...rows], givenUp: [] };
  await giveUp(transaction, actor, versions, givenUp);
  const publishing = new Set(
    going.rows.flatMap(({ publishing: row }) =>
      row === undefined ? [] : [changeKey(row)],
    ),
  );
  const all = await ownRows(transaction, actor.user.id);
  return {
    versions: await readVersions(transaction, actor.user.id, all),
    rows: all.filter((row) => publishing.has(changeKey(row))),
    givenUp: blind,
  };
}
