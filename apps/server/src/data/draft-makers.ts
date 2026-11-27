// SPDX-License-Identifier: Apache-2.0

// Who made each draft, the refusal of an approval of drafts the approver changed, and the rule for
// who may discard a draft that every kind starts from. Part of the data access layer.

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
  type DraftKind,
  endsDraft,
  draftKey,
  type Tier,
} from "@fathom/shared";
import { and, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import { type Actor, storedTier } from "../access.ts";
import { ForbiddenError } from "../errors.ts";

const discardRefusal = "Only someone who changed this draft can discard it.";

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
  // Whether the viewer changed the draft since it was last approved or discarded.
  changedByUser: boolean;
}

// For readers who see every field of a draft, such as those of lists and columns, which are
// General.
export const everything = () => true;

// The change sets holding a user's unpublished changes since they last discarded them all, which
// publishing publishes; those before are discarded, so are never published.
export function openChangeSets(userId: string): SQL {
  return and(
    eq(changeSets.private, true),
    eq(changeSets.madeBy, userId),
    sql`${changeSets.madeAt} > coalesce((SELECT max(withdrawn.made_at) FROM fathom.change_sets AS withdrawn WHERE withdrawn.made_by = ${userId} AND withdrawn.kind = 'withdrawal'), '-infinity')`,
  ) as SQL;
}

// Why a user may not discard a draft, or undefined when they may: only one who changed it since it
// was last approved or discarded discards it, since others who disagree reject it. The plan's
// records add their cycles rule to this one, in record-discards.ts.
export const ownDiscardRefusal = (
  changedByUser: boolean,
): string | undefined => (changedByUser ? undefined : discardRefusal);

// The marks a draft carries for the viewer: whether they may discard it, and, where they changed it
// and may not approve their own, that another approver must.
export const viewerMarks = (
  maker: Maker | undefined,
  discardable: boolean,
) => ({
  ...(discardable ? { discardable: true } : {}),
  ...(maker?.needsOtherApprover === true ? { needsOtherApprover: true } : {}),
});

// The marks of a draft of a kind outside the plan's records, which only the rule for everyone's
// drafts decides.
export const ownMarks = (maker: Maker | undefined) =>
  viewerMarks(
    maker,
    ownDiscardRefusal(maker?.changedByUser === true) === undefined,
  );

// The changes to the records given, of one kind, that tell who changed each draft, in the order they
// were made: changes to drafts and the approvals and discards that end them, published, and the
// viewer's own unpublished changes to the records they still hold them for, which their drafts hold.
async function draftHistory(
  reader: Pick<Database, "select">,
  recordType: DraftKind,
  chunk: readonly string[],
  viewer: Actor,
) {
  const ownRows = await reader
    .select({ id: privateChanges.recordId })
    .from(privateChanges)
    .where(
      and(
        eq(privateChanges.recordType, recordType),
        eq(privateChanges.userId, viewer.user.id),
        inArray(privateChanges.recordId, [...chunk]),
      ),
    );
  const own = new Set(ownRows.map(({ id }) => id));
  const rows = await reader
    .select({
      recordId: changes.recordId,
      field: changes.field,
      tier: changes.tier,
      draft: changes.draft,
      kind: changeSets.kind,
      keepsDraft: changes.keepsDraft,
      unpublished: changeSets.private,
      madeBy: users.name,
      madeAs: roles.name,
      makerId: changeSets.madeBy,
      madeAt: changeSets.madeAt,
    })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .leftJoin(users, eq(users.id, changeSets.madeBy))
    .leftJoin(roles, eq(roles.id, changeSets.madeAsRoleId))
    .where(
      and(
        eq(changes.recordType, recordType),
        inArray(changes.recordId, [...chunk]),
        or(
          eq(changes.draft, true),
          inArray(changeSets.kind, ["approval", "discard"]),
        ),
        or(eq(changeSets.private, false), openChangeSets(viewer.user.id)),
      ),
    )
    .orderBy(changes.id);
  return rows.filter((row) => !row.unpublished || own.has(row.recordId));
}

// Who changed each record's draft, and when, from the changes to it the reader may see, so a hidden
// change reveals nothing: the latest, and everyone since the record's last draft was approved or
// discarded. Rejecting a draft, or sending it for approval again unchanged, does not change it.
// Unpublished changes count only for the viewer's own unpublished drafts, which hold them.
export async function draftMakers(
  reader: Pick<Database, "select">,
  recordType: DraftKind,
  ids: readonly string[],
  seen: (field: string, tier: Tier) => boolean,
  viewer: Actor,
): Promise<Map<string, Maker>> {
  const makers = new Map<string, Maker>();
  const approvesOwn = viewer.permissions.includes("drafts:approve-own");
  for (const chunk of inChunks([...ids])) {
    const counted = await draftHistory(reader, recordType, chunk, viewer);
    // The viewer's changes count whatever their tier, since they made them.
    const mine = draftsChangedBy(counted, viewer.user.id);
    for (const row of counted) {
      if (endsDraft(row)) {
        makers.delete(row.recordId);
        continue;
      }
      const recorded = storedTier(row.tier);
      if (
        row.kind === "rejection" ||
        row.kind === "resubmission" ||
        !seen(row.field, recorded)
      ) {
        continue;
      }
      const maker = makers.get(row.recordId);
      const editors = maker?.editors ?? [];
      makers.set(row.recordId, {
        madeBy: row.madeBy,
        madeAs: row.madeAs,
        madeAt: row.madeAt,
        editors: [
          ...editors.filter((editor) => editor !== row.madeBy),
          row.madeBy,
        ],
        fieldEditors: new Map(maker?.fieldEditors).set(row.field, row.madeBy),
        needsOtherApprover: !approvesOwn && mine.has(row.recordId),
        changedByUser: mine.has(row.recordId),
      });
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
  for (const key of decided) {
    const space = key.indexOf(" ");
    const recordType = key.slice(0, space);
    byType.set(
      recordType,
      (byType.get(recordType) ?? new Set()).add(key.slice(space + 1)),
    );
  }
  for (const [recordType, ids] of byType) {
    for (const chunk of inChunks([...ids])) {
      const rows = await reader
        .select({
          recordId: changes.recordId,
          draft: changes.draft,
          kind: changeSets.kind,
          makerId: changeSets.madeBy,
          keepsDraft: changes.keepsDraft,
        })
        .from(changes)
        .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
        .where(
          and(
            eq(changes.recordType, recordType),
            inArray(changes.recordId, chunk),
            eq(changeSets.private, false),
            or(
              and(
                eq(changes.draft, true),
                eq(changeSets.madeBy, actor.user.id),
              ),
              inArray(changeSets.kind, ["approval", "discard"]),
            ),
          ),
        )
        .orderBy(changes.id);
      if (draftsChangedBy(rows, actor.user.id).size > 0) {
        throw new ForbiddenError(
          "Drafts changed by the approver need another approver",
        );
      }
    }
  }
}

// Whether the actor changed a draft since it was last approved or discarded, their own unpublished
// changes to it counting; never for a draft only Fathom itself changed.
export async function changedByActor(
  reader: Pick<Database, "select">,
  actor: Actor,
  recordType: DraftKind,
  id: string,
): Promise<boolean> {
  const history = await draftHistory(reader, recordType, [id], actor);
  return draftsChangedBy(history, actor.user.id).has(id);
}
