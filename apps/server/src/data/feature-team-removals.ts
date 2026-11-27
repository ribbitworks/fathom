// SPDX-License-Identifier: Apache-2.0

// The guards feature teams keep on removing their people and planned hires, and on features naming a
// team, and the team changes removing a planned hire makes. Part of the data access layer.

import { featureTeams, inChunks, type Reader } from "@fathom/db";
import { bySubject, inForceOrLater } from "@fathom/shared";
import { inArray } from "drizzle-orm";
import type { Actor } from "../access.ts";
import { BadRequestError, ConflictError } from "../errors.ts";
import type { Change, Transaction } from "./changes.ts";
import type { Recorded } from "./draft-records.ts";
import { readHeld } from "./drafts.ts";
import {
  readLeadsOfTeamsLedBy,
  readLiveTeams,
  readTeamDrafts,
  teamDraftsOf,
  teamsOfHires,
} from "./feature-team-reads.ts";
import { recordType } from "./feature-team-records.ts";
import { membersOf } from "./feature-team-rules.ts";
import { readToday } from "./settings.ts";
import { teamChanges } from "./feature-teams.ts";

// Refuses the feature teams named for features unless each is live and no draft, published or not,
// removes it.
export async function checkTeamsForFeatures(
  reader: Reader,
  named: readonly (string | null)[],
): Promise<void> {
  const ids = [...new Set(named.filter((id): id is string => id !== null))];
  if (ids.length === 0) return;
  const live = new Set<string>();
  for (const chunk of inChunks(ids)) {
    for (const { id } of await reader
      .select({ id: featureTeams.id })
      .from(featureTeams)
      .where(inArray(featureTeams.id, chunk))) {
      live.add(id);
    }
  }
  if (ids.some((id) => !live.has(id))) {
    throw new BadRequestError("Choose a feature team that has been approved");
  }
  const drafts = await readTeamDrafts(reader, ids);
  const held = await readHeld(reader, recordType, undefined, ids);
  const removing = (id: string) =>
    [drafts.get(id), held.get(id)?.draft].some(
      (draft) => draft?.action === "deleted",
    );
  if (ids.some(removing)) {
    throw new ConflictError(
      "This feature team is drafted to be removed; choose another",
    );
  }
}

// Whether any of the people or planned hires given leads a team today or is planned to later.
async function leadTodayOrLater(
  reader: Reader,
  ids: readonly string[],
  today: string,
): Promise<boolean> {
  const records = await readLeadsOfTeamsLedBy(reader, ids);
  return [...bySubject(records, ({ teamId }) => teamId).values()].some((team) =>
    team.some(
      (record) =>
        record.leadId !== null &&
        ids.includes(record.leadId) &&
        inForceOrLater(record, team, today),
    ),
  );
}

// The fields of every team's draft, published or not.
async function draftedTeams(reader: Reader) {
  return (await teamDraftsOf(reader)).map(({ fields }) => fields);
}

// Why removing someone on a team is refused: a person, or a planned hire.
export const onTeamsRefusals = {
  person: {
    leads: "This person leads a feature team; choose another lead first",
    drafted:
      "This person is in a feature team's draft; take them out of it or discard it first",
  },
  plannedHire: {
    leads: "This planned hire leads a feature team; choose another lead first",
    drafted:
      "This planned hire is in a feature team's draft; take it out of the draft or discard the draft first",
  },
};

// Refuses removing people, or planned hires, who lead a feature team, today, later, or in a draft,
// or whom a team's draft names as a member, published or not.
export async function refuseRemovingOnTeams(
  reader: Reader,
  ids: readonly string[],
  refusals: (typeof onTeamsRefusals)[keyof typeof onTeamsRefusals],
): Promise<void> {
  const today = await readToday(reader);
  const inDrafts = await draftedTeams(reader);
  for (const chunk of inChunks([...ids])) {
    if (
      (await leadTodayOrLater(reader, chunk, today)) ||
      inDrafts.some((fields) => chunk.includes(String(fields.leadId)))
    ) {
      throw new ConflictError(refusals.leads);
    }
    if (
      inDrafts.some((fields) =>
        membersOf(fields).some((one) => chunk.includes(one)),
      )
    ) {
      throw new ConflictError(refusals.drafted);
    }
  }
}

// Takes the planned hires being removed off the teams they are on today or will be, and returns the
// changes recording it: each team's members as last recorded, which name those joining later, then
// without them. Their records go with them, and a team they once led has no lead then, since
// removing a hire that leads a team today or later is refused.
export async function teamChangesRemoving(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  today: string,
): Promise<Change[]> {
  if (ids.length === 0) return [];
  const onTeams = await teamsOfHires(transaction, ids, today);
  const { teams } = await readLiveTeams(transaction, today, {
    ids: [...onTeams.keys()],
  });
  return [...onTeams].flatMap(([id, going]) => {
    // A membership's team is live, since removing a team removes its memberships.
    const team = teams.get(id) as Recorded;
    const staying = membersOf(team).filter((one) => !going.includes(one));
    return teamChanges(
      id,
      "changed",
      { ...team, members: [...staying, ...going].sort() },
      { ...team, members: staying },
      actor.dataClasses,
    );
  });
}
