// SPDX-License-Identifier: Apache-2.0

// A user's private changes and the versions of the records they make, beside everyone else's: how
// each is read, which go with those chosen, and what it is named. Part of the data access layer.

import { changes, changeSets, privateChanges, type Reader } from "@fathom/db";
import {
  columnTableOf,
  columnTablePolicies,
  type DraftKind,
  draftKeysOf,
  draftingPermissions,
  type DraftsRequest,
  hireCalled,
  type Permission,
  type RecordType,
  withNeeded,
  withUsers,
} from "@fathom/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  type Actor,
  requireAnyPermission,
  seesSensitivity,
} from "../access.ts";
import { NotFoundError } from "../errors.ts";
import {
  type ColumnsState,
  draftedField,
  readColumnsState,
} from "./column-state.ts";
import { type Draft, drafted, type Recorded } from "./draft-records.ts";
import { overPublished, readPersonDrafts } from "./drafts.ts";
import {
  draftedChoice,
  draftedList,
  type ListsState,
  readState,
} from "./list-state.ts";
import {
  isRecordType,
  readRecordVersions,
  type RecordVersions,
  recordSubject,
} from "./records.ts";
import { readLive } from "./people-reads.ts";
import { type HireTier, hireIdOf, readHireTier } from "./hire-fields.ts";
import { readHireDrafts, readLiveHires } from "./hire-reads.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { readLiveTeams, readTeamDrafts } from "./feature-team-reads.ts";
import { readToday } from "./settings.ts";
import { type Transaction } from "./changes.ts";
import { chunksByKind, openChangeSets } from "./draft-makers.ts";
import { madeInOrder } from "./history-order.ts";
import { readFills } from "./fills.ts";
import {
  changeKey,
  fillKeys,
  type OwnDrafts,
  usesAmong,
} from "./unpublished-uses.ts";
import type { TableColumns } from "./values.ts";
import { type LiveSince } from "./private-conflicts.ts";
import { readLiveSince } from "./private-removals.ts";

export type Row = typeof privateChanges.$inferSelect;

// Anyone who may make drafts may publish or discard their own changes.
export const requireDrafting = (actor: Actor) => {
  requireAnyPermission(actor, draftingPermissions);
};

// The user's unpublished drafts, in the order they were made.
export const ownRows = async (reader: Reader, userId: string): Promise<Row[]> =>
  overPublished(
    reader,
    await reader
      .select()
      .from(privateChanges)
      .where(eq(privateChanges.userId, userId))
      .orderBy(asc(privateChanges.sequence)),
  );

export const idsOf = (rows: readonly Row[], recordType: DraftKind) =>
  rows
    .filter((row) => row.recordType === recordType)
    .map(({ recordId }) => recordId);

// Everything the user's unpublished drafts change, as the user sees it, and as everyone else does,
// read together.
export interface Versions {
  rows: Row[];
  mine: { lists: ListsState; columns: ColumnsState };
  theirs: { lists: ListsState; columns: ColumnsState };
  people: {
    columns: TableColumns;
    live: Map<string, Recorded>;
    mine: Map<string, Draft>;
    theirs: Map<string, Draft>;
  };
  hires: {
    live: Map<string, Recorded>;
    mine: Map<string, Draft>;
    theirs: Map<string, Draft>;
    tierOf: HireTier;
  };
  teams: {
    live: Map<string, Recorded>;
    mine: Map<string, Draft>;
    theirs: Map<string, Draft>;
  };
  records: RecordVersions;
  // What others made live of each record the user removes or takes back, since each began, by key.
  liveSince: Map<string, LiveSince>;
}

export async function readVersions(
  reader: Reader,
  userId: string,
  rows: Row[],
): Promise<Versions> {
  const personIds = idsOf(rows, "person");
  const hireIds = idsOf(rows, "planned-hire");
  const teamIds = idsOf(rows, "feature-team");
  const columns = await columnsWithAdded(reader, userId);
  return {
    rows,
    mine: {
      lists: await readState(reader, userId),
      columns: await readColumnsState(reader, userId),
    },
    theirs: {
      lists: await readState(reader),
      columns: await readColumnsState(reader),
    },
    people: {
      columns,
      live: await readLive(reader, columns, { ids: personIds }),
      mine: await readPersonDrafts(reader, personIds, userId),
      theirs: await readPersonDrafts(reader, personIds),
    },
    hires: {
      live: await readLiveHires(reader, hireIds),
      mine: await readHireDrafts(reader, hireIds, userId),
      theirs: await readHireDrafts(reader, hireIds),
      tierOf: await readHireTier(reader),
    },
    teams: {
      live: (
        await readLiveTeams(reader, await readToday(reader), { ids: teamIds })
      ).teams,
      mine: await readTeamDrafts(reader, teamIds, userId),
      theirs: await readTeamDrafts(reader, teamIds),
    },
    records: await readRecordVersions(reader, userId),
    liveSince: await readLiveSince(reader, userId, rows),
  };
}

// A record as the user sees it, or, where their draft removes it, or wants none of a record only
// drafted to be added, as everyone else does.
export function versionOf(
  versions: Versions,
  recordType: DraftKind,
  id: string,
): Recorded | undefined {
  const { mine, theirs } = versions;
  if (recordType === "person") {
    const live = versions.people.live.get(id);
    return (
      drafted(live, versions.people.mine.get(id)) ??
      drafted(live, versions.people.theirs.get(id))
    );
  }
  if (recordType === "planned-hire") {
    const live = versions.hires.live.get(id);
    return (
      drafted(live, versions.hires.mine.get(id)) ??
      drafted(live, versions.hires.theirs.get(id))
    );
  }
  if (recordType === "feature-team") {
    const live = versions.teams.live.get(id);
    return (
      drafted(live, versions.teams.mine.get(id)) ??
      drafted(live, versions.teams.theirs.get(id))
    );
  }
  if (recordType === "list") {
    return draftedList(mine.lists, id) ?? draftedList(theirs.lists, id);
  }
  if (recordType === "list-item") {
    return draftedChoice(mine.lists, id) ?? draftedChoice(theirs.lists, id);
  }
  return draftedField(mine.columns, id) ?? draftedField(theirs.columns, id);
}

export const holds =
  (permission: Permission) =>
  (actor: Actor): boolean =>
    actor.permissions.includes(permission);

// Planned hires are read as the change history reads them: with people, and the hiring plan's class.
const readsHires = (actor: Actor): boolean =>
  holds("people:view")(actor) && seesSensitivity(actor, "hiring-plan");

interface OtherKind {
  reads: (actor: Actor, versions: Versions, id: string) => boolean;
  unseen: string;
}

// A column goes with its table's records, so it is named to those who see them.
const readsColumn = (actor: Actor, versions: Versions, id: string) =>
  holds(
    columnTablePolicies[
      columnTableOf(versionOf(versions, "field", id)?.tableName)
    ].viewNeeds,
  )(actor);

// Who reads each kind of draft kept outside the plan's records, and how a change to one is named to
// a role that doesn't, since the change may have been made under another role.
const otherKinds: Record<Exclude<DraftKind, RecordType>, OtherKind> = {
  person: { reads: holds("people:view"), unseen: "a person" },
  "planned-hire": { reads: readsHires, unseen: "a planned hire" },
  "feature-team": {
    reads: holds("feature-teams:view"),
    unseen: "a feature team",
  },
  list: { reads: holds("configuration:view"), unseen: "a list" },
  "list-item": { reads: holds("configuration:view"), unseen: "a choice" },
  "choice-order": {
    reads: holds("configuration:view"),
    unseen: "the new order for a list",
  },
  field: { reads: readsColumn, unseen: "a column" },
};

const otherKindOf = new Map<string, OtherKind>(Object.entries(otherKinds));

// A change of a kind Fathom no longer has, which no role reads, so one stored row can't keep the user
// from seeing the rest of their changes, or discarding them.
const unknownKind: OtherKind = { reads: () => false, unseen: "a change" };

// What a change is to, as the Drafts page names drafts, by name only to a role that reads its kind.
export function subjectOf(versions: Versions, row: Row, actor: Actor): string {
  const id = row.recordId;
  // A list's name is always text.
  const listName = (listId: string) =>
    (versionOf(versions, "list", listId)?.name as string | undefined) ??
    "a removed list";
  if (isRecordType(row.recordType)) {
    return recordSubject(versions.records, row.recordType, id, actor);
  }
  const other = otherKindOf.get(row.recordType) ?? unknownKind;
  if (!other.reads(actor, versions, id)) return other.unseen;
  if (row.recordType === "person") {
    return String(versionOf(versions, "person", id)?.preferredName);
  }
  if (row.recordType === "planned-hire") {
    // A hire is named by its name, or, while it has none, by its position and ID, such as
    // "Software Engineer, TBD-7", or by its ID alone to those who cannot see the Positions list's
    // tier. A hire whose draft is listed is live or drafted, so has a version.
    const hire = versionOf(versions, "planned-hire", id) as Recorded;
    const { requisition, temporaryId } = hireIdOf(hire);
    const position = seesSensitivity(actor, versions.hires.tierOf("positionId"))
      ? String(versionOf(versions, "list-item", String(hire.positionId))?.label)
      : undefined;
    return `the planned hire ${hireCalled(
      typeof hire.name === "string" ? hire.name : null,
      String(requisition ?? temporaryId),
      position,
    )}`;
  }
  if (row.recordType === "feature-team") {
    // A team whose draft is listed is live or drafted, so has a version.
    return `the feature team ${String(versionOf(versions, "feature-team", id)?.name)}`;
  }
  if (row.recordType === "list") return `the list ${listName(id)}`;
  if (row.recordType === "list-item") {
    const choice = versionOf(versions, "list-item", id);
    return `the choice ${String(choice?.label)} in ${listName(String(choice?.listId))}`;
  }
  if (row.recordType === "choice-order") {
    return `the new order for ${listName(id)}`;
  }
  return `the column ${String(versionOf(versions, "field", id)?.name)}`;
}

export const orders = new Set(["choice-order"]);

export async function removeRows(
  transaction: Transaction,
  userId: string,
  rows: readonly Row[],
): Promise<void> {
  for (const [recordType, chunks] of chunksByKind(rows)) {
    for (const chunk of chunks) {
      await transaction
        .delete(privateChanges)
        .where(
          and(
            eq(privateChanges.userId, userId),
            eq(privateChanges.recordType, recordType),
            inArray(privateChanges.recordId, chunk),
          ),
        );
    }
  }
}

const notOwn =
  "One of these changes is no longer unpublished; refresh to see the latest";

// The user's changes to drafts in their open change sets, each with its change set and the role it
// was made as.
export const openDraftChanges = (reader: Reader, userId: string) =>
  reader
    .select({
      changeSetId: changes.changeSetId,
      recordType: changes.recordType,
      recordId: changes.recordId,
      madeAsRoleId: changeSets.madeAsRoleId,
    })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(and(openChangeSets(userId), eq(changes.draft, true)))
    .orderBy(...madeInOrder);

export type OpenDraftChange = Awaited<
  ReturnType<typeof openDraftChanges>
>[number];

// The records whose drafts each of the user's open change sets changes, by key, which are
// published only together, since a change set is published whole.
function savedTogether(rows: readonly OpenDraftChange[]): string[][] {
  const sets = new Map<string, Set<string>>();
  for (const row of rows) {
    sets.set(
      row.changeSetId,
      (sets.get(row.changeSetId) ?? new Set()).add(changeKey(row)),
    );
  }
  return [...sets.values()].map((keys) => [...keys]);
}

// The drafts as the user's own changes make them, with the changes that go together whole when
// publishing, those of a fill and those saved together, or, when discarding, those of a fill.
export async function ownDrafts(
  reader: Reader,
  userId: string,
  versions: Versions,
  sending: "publish" | "discard",
  open?: readonly OpenDraftChange[],
): Promise<OwnDrafts> {
  const fills = fillKeys(await readFills(reader, userId));
  return {
    lists: versions.mine.lists,
    columns: versions.mine.columns,
    people: versions.people.mine,
    hires: versions.hires.mine,
    records: versions.records.mine,
    together:
      sending === "publish"
        ? [
            ...fills,
            ...savedTogether(open ?? (await openDraftChanges(reader, userId))),
          ]
        : fills,
  };
}

// The actor's unpublished drafts, with what they change, and those a request chooses, with those
// that go with them, or all of them when it chooses none: those they use, and those that go together
// with them, when publishing; those that use them, and the rest of a fill, when discarding. A change
// that is not the user's own unpublished change is answered as one that does not exist, so asking
// reveals nothing of anyone else's.
export async function readGoing(
  transaction: Transaction,
  userId: string,
  chosen: DraftsRequest | undefined,
  sending: "publish" | "discard",
) {
  const all = await ownRows(transaction, userId);
  const versions = await readVersions(transaction, userId, all);
  if (chosen === undefined) return { versions, rows: all };
  const asked = draftKeysOf(chosen);
  const own = new Set(all.map(changeKey));
  if (asked.some((key) => !own.has(key))) throw new NotFoundError(notOwn);
  const uses = usesAmong(
    await ownDrafts(transaction, userId, versions, sending),
    all,
  );
  const going = (sending === "publish" ? withNeeded : withUsers)(uses, asked);
  return { versions, rows: all.filter((row) => going.has(changeKey(row))) };
}
