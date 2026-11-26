// SPDX-License-Identifier: Apache-2.0

// A user's private changes and the versions of the records they make, beside everyone else's: how
// each is read, and what it is named. Part of the data access layer.

import { privateChanges, type Reader } from "@fathom/db";
import {
  type DraftKind,
  draftingPermissions,
  hireCalled,
  type Permission,
  type RecordType,
} from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import {
  type Actor,
  requireAnyPermission,
  seesSensitivity,
} from "../access.ts";
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
import type { TableColumns } from "./values.ts";

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
  reads: (actor: Actor) => boolean;
  unseen: string;
}

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
  field: { reads: holds("configuration:view"), unseen: "a column" },
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
  if (!other.reads(actor)) return other.unseen;
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
