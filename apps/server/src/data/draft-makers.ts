// SPDX-License-Identifier: Apache-2.0

// Who made each draft, and the refusal of an approval of drafts the approver changed. Part of the
// data access layer.

import {
  changes,
  changeSets,
  type Database,
  drafts,
  inChunks,
  privateChanges,
  roles,
  users,
} from "@fathom/db";
import {
  draftsChangedBy,
  inCountedOrder,
  standingChanges,
  type DraftKind,
  draftKey,
  fromDraftKey,
  type Tier,
} from "@fathom/shared";
import { and, eq, inArray, not, or, type SQL, sql } from "drizzle-orm";
import { type Actor, storedTier } from "../access.ts";
import { ForbiddenError } from "../errors.ts";
import { kindsWhere, listedKinds, makerKinds } from "./change-set-kinds.ts";
import { closedByGone } from "./gone-sets.ts";
import { madeInOrder, timesOf, whenPublished } from "./history-order.ts";

export interface Maker {
  madeBy: string | null;
  // The role the last maker was acting as, null for Fathom itself.
  madeAs: string | null;
  madeAt: Date;
  // Everyone who changed the draft, by name, first to last, null for Fathom itself.
  editors: (string | null)[];
  // Who last changed each field of the draft, by field as the change history names it.
  fieldEditors: Map<string, string | null>;
  // Whether the viewer changed the draft since it was last approved or discarded, and their role
  // does not let them approve their own, so another approver must approve it.
  needsOtherApprover: boolean;
}

// For readers who see every field of a draft, such as those of lists and columns, which are
// General.
export const everything = () => true;

const publishedNext = kindsWhere((rules) => rules.publishedNext);
const endingOpen = listedKinds(({ endsOpen }) => endsOpen);
const resetting = kindsWhere(({ resetsMakers }) => resetsMakers);

// The change sets holding a user's unpublished changes since they last discarded them all, which
// publishing publishes; those before are discarded, so are never published, and so is one that
// changed a record gone, whose changes to it were withdrawn with it. Fields given up on publishing,
// and changes withdrawn because their record went, stay in their maker's own history, never
// published and never counted as changing a draft; withdrawing those closes no other set.
export function openChangeSets(userId: string): SQL {
  return and(
    eq(changeSets.private, true),
    eq(changeSets.madeBy, userId),
    inArray(changeSets.kind, publishedNext),
    sql`${changeSets.madeAt} > coalesce((SELECT max(withdrawn.made_at) FROM fathom.change_sets AS withdrawn WHERE withdrawn.made_by = ${userId} AND withdrawn.kind IN (${endingOpen})), '-infinity')`,
    not(closedByGone),
  ) as SQL;
}

// A change to a draft, or a decision on it, as draftMakers reads it for a viewer.
export interface MakerRow {
  id: number;
  takesBack: number | null;
  recordType: string;
  recordId: string;
  field: string;
  tier: string;
  draft: boolean;
  kind: string;
  unpublished: boolean;
  // Whether it is in one of the viewer's open change sets.
  open: boolean;
  madeBy: string | null;
  madeAs: string | null;
  makerId: string | null;
  madeAt: Date;
  madeAtMicros: number;
  publishedAtMicros: number | null;
}

// Who changed each record's draft, from the rows of its history read for a viewer, as draftMakers
// sets out, given the records the viewer's own unpublished drafts change.
export function makersOf(
  rows: readonly MakerRow[],
  own: ReadonlySet<string>,
  viewer: { userId: string; approvesOwn: boolean },
  seen: (field: string, tier: Tier, recordId: string) => boolean,
): Map<string, Maker> {
  const makers = new Map<string, Maker>();
  // Private changes are read only to pair the changes given up with them. Unpublished changes
  // count only for the viewer's own unpublished drafts, which hold them.
  const marked = inCountedOrder(rows, makerKinds).map((row) => ({
    ...row,
    counts: !row.unpublished || (row.open && own.has(row.recordId)),
  }));
  // The viewer's changes count whatever their tier, since they made them.
  const mine = viewer.approvesOwn
    ? new Set<string>()
    : draftsChangedBy(marked, viewer.userId, makerKinds);
  const made = standingChanges(
    marked.map((row) => ({
      ...row,
      // A decision starts the draft's history again even when it names no field the reader sees.
      counts:
        row.counts &&
        (makerKinds.resets.has(row.kind) ||
          seen(row.field, storedTier(row.tier), row.recordId)),
    })),
    makerKinds,
  );
  for (const changesMade of made.values()) {
    for (const change of changesMade.filter(({ counts }) => counts)) {
      const maker = makers.get(change.recordId);
      makers.set(change.recordId, {
        madeBy: change.madeBy,
        madeAs: change.madeAs,
        madeAt: change.madeAt,
        editors: [
          ...(maker?.editors ?? []).filter(
            (editor) => editor !== change.madeBy,
          ),
          change.madeBy,
        ],
        fieldEditors: new Map(maker?.fieldEditors).set(
          change.field,
          change.madeBy,
        ),
        needsOtherApprover: mine.has(change.recordId),
      });
    }
  }
  return makers;
}

// The marker a draft carries when the reader changed it and may not approve their own.
export const otherApprover = (maker: Maker | undefined) =>
  maker?.needsOtherApprover === true ? { needsOtherApprover: true } : {};

// Who changed each record's draft, and when, from the changes to it the reader may see, so a hidden
// change reveals nothing: the latest, and everyone since the record's last draft was approved or
// discarded. Rejecting a draft, or sending it for approval again unchanged, does not change it.
// Unpublished changes count only for the viewer's own unpublished drafts, which hold them: those
// given, such as none for the published drafts as everyone else sees them, or else the viewer's.
export async function draftMakers(
  reader: Pick<Database, "select">,
  recordType: DraftKind,
  ids: readonly string[],
  seen: (field: string, tier: Tier, recordId: string) => boolean,
  viewer: Actor,
  ownRecords?: ReadonlySet<string>,
): Promise<Map<string, Maker>> {
  const makers = new Map<string, Maker>();
  const approvesOwn = viewer.permissions.includes("drafts:approve-own");
  for (const chunk of inChunks([...ids])) {
    const own =
      ownRecords ??
      new Set(
        (
          await reader
            .select({ id: privateChanges.recordId })
            .from(privateChanges)
            .where(
              and(
                eq(privateChanges.recordType, recordType),
                eq(privateChanges.userId, viewer.user.id),
                inArray(privateChanges.recordId, chunk),
              ),
            )
        ).map(({ id }) => id),
      );
    const rows = await reader
      .select({
        id: changes.id,
        takesBack: changes.takesBack,
        recordType: changes.recordType,
        recordId: changes.recordId,
        field: changes.field,
        tier: changes.tier,
        draft: changes.draft,
        kind: changeSets.kind,
        unpublished: changeSets.private,
        open: sql<boolean>`${openChangeSets(viewer.user.id)}`,
        madeBy: users.name,
        madeAs: roles.name,
        makerId: changeSets.madeBy,
        // When others could first see it, as the order counts it.
        madeAt: whenPublished,
        ...timesOf,
      })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .leftJoin(users, eq(users.id, changeSets.madeBy))
      .leftJoin(roles, eq(roles.id, changeSets.madeAsRoleId))
      .where(
        and(
          eq(changes.recordType, recordType),
          inArray(changes.recordId, chunk),
          or(eq(changes.draft, true), inArray(changeSets.kind, resetting)),
        ),
      )
      .orderBy(...madeInOrder);
    for (const [recordId, maker] of makersOf(
      rows,
      own,
      {
        userId: viewer.user.id,
        approvesOwn,
      },
      seen,
    )) {
      makers.set(recordId, maker);
    }
  }
  return makers;
}

// The identifiers of the records given, by kind, in chunks small enough for one statement each.
export function chunksByKind(
  records: readonly { recordType: string; recordId: string }[],
): [string, string[][]][] {
  const ids = new Map<string, string[]>();
  for (const { recordType, recordId } of records) {
    const kind = ids.get(recordType) ?? [];
    kind.push(recordId);
    ids.set(recordType, kind);
  }
  return [...ids].map(([recordType, kind]) => [recordType, inChunks(kind)]);
}

// Every draft waiting or rejected, by kind and record, so an approval can tell which it decided, or
// those of the records given.
export async function draftKeys(
  reader: Pick<Database, "select">,
  of?: readonly { recordType: string; recordId: string }[],
): Promise<Set<string>> {
  const keyed = (rows: readonly { recordType: string; recordId: string }[]) =>
    rows.map((row) => draftKey(row.recordType, row.recordId));
  const columns = { recordType: drafts.recordType, recordId: drafts.recordId };
  if (of === undefined) {
    return new Set(keyed(await reader.select(columns).from(drafts)));
  }
  const found = new Set<string>();
  for (const [recordType, chunks] of chunksByKind(of)) {
    for (const chunk of chunks) {
      const rows = await reader
        .select(columns)
        .from(drafts)
        .where(
          and(
            eq(drafts.recordType, recordType),
            inArray(drafts.recordId, chunk),
          ),
        );
      for (const key of keyed(rows)) found.add(key);
    }
  }
  return found;
}

// Refuses an approval that applied drafts the approver changed since each was last approved or
// discarded, of any kind, those approved with the drafts asked for included, unless their role lets
// them approve their own. Given the drafts the approval removed, before it is saved, so its own
// change set is not yet in the history.
export async function refuseOwnDrafts(
  reader: Pick<Database, "select">,
  actor: Actor,
  decided: readonly string[],
): Promise<void> {
  if (actor.permissions.includes("drafts:approve-own")) return;
  const byType = new Map<string, Set<string>>();
  for (const { recordType, recordId } of decided.map(fromDraftKey)) {
    byType.set(recordType, (byType.get(recordType) ?? new Set()).add(recordId));
  }
  for (const [recordType, ids] of byType) {
    for (const chunk of inChunks([...ids])) {
      const rows = await reader
        .select({
          id: changes.id,
          takesBack: changes.takesBack,
          recordType: changes.recordType,
          recordId: changes.recordId,
          field: changes.field,
          draft: changes.draft,
          kind: changeSets.kind,
          makerId: changeSets.madeBy,
          ...timesOf,
          counts: sql<boolean>`NOT ${changeSets.private}`,
        })
        .from(changes)
        .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
        .where(
          and(
            eq(changes.recordType, recordType),
            inArray(changes.recordId, chunk),
            // Everyone's changes, so each change given up pairs with what it gives up.
            or(eq(changes.draft, true), inArray(changeSets.kind, resetting)),
          ),
        )
        .orderBy(...madeInOrder);
      if (
        draftsChangedBy(
          inCountedOrder(rows, makerKinds),
          actor.user.id,
          makerKinds,
        ).size > 0
      ) {
        throw new ForbiddenError(
          "Drafts changed by the approver need another approver",
        );
      }
    }
  }
}
