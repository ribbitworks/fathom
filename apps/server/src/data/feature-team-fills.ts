// SPDX-License-Identifier: Apache-2.0

// Filling a planned hire on feature teams: refusing a fill while a draft of the hire's teams, or one
// naming it, waits, and, on approval, carrying the hire's teams and leads to its person. Part of the
// data access layer.

import {
  featureTeamLeads,
  featureTeamMemberships,
  inChunks,
  type Reader,
} from "@fathom/db";
import { and, eq, gte, sql } from "drizzle-orm";
import type { Actor } from "../access.ts";
import { ConflictError } from "../errors.ts";
import type { Change, Transaction } from "./changes.ts";
import type { Recorded } from "./draft-records.ts";
import {
  readLeadsOfTeamsLedBy,
  readLiveTeams,
  teamDraftsOf,
  teamsOfHires,
} from "./feature-team-reads.ts";
import {
  carriedOnFill,
  type CarriedOnFill,
  type HireOnTeam,
  joinsAfterEnd,
  leadsWhileOn,
  membersOf,
  teamDraftsBlockingFill,
} from "./feature-team-rules.ts";
import { teamChanges } from "./feature-teams.ts";

export const inTeamDraftRefusal =
  "A feature team's draft names this planned hire, or changes a team it's on or leads; approve or discard the draft before filling the hire";

// The hire's records on teams, as a member, and the records of the teams it leads, each the hire's
// or another lead's.
async function readHireRows(
  reader: Reader,
  hireId: string,
): Promise<{ memberships: HireOnTeam[]; leads: HireOnTeam[] }> {
  const memberships = await reader
    .select({
      teamId: featureTeamMemberships.teamId,
      member: featureTeamMemberships.member,
      fromDate: featureTeamMemberships.fromDate,
    })
    .from(featureTeamMemberships)
    .where(eq(featureTeamMemberships.plannedHireId, hireId));
  const leads = (await readLeadsOfTeamsLedBy(reader, [hireId])).map(
    ({ teamId, leadId, fromDate }) => ({
      teamId,
      member: leadId === hireId,
      fromDate,
    }),
  );
  return { memberships, leads };
}

// The team drafts, published or not, a fill of the hire waits on, as teamDraftsBlockingFill sets
// out. A team the hire leads is one it is on.
export async function teamDraftsBeforeFill(
  reader: Reader,
  hireId: string,
  today: string,
): Promise<string[]> {
  const hireTeams = [...(await teamsOfHires(reader, [hireId], today)).keys()];
  return teamDraftsBlockingFill(await teamDraftsOf(reader), hireTeams, hireId);
}

// Refuses filling a planned hire while a team draft it waits on remains.
export async function refuseFillingInTeamDrafts(
  reader: Reader,
  hireId: string,
  today: string,
): Promise<void> {
  if ((await teamDraftsBeforeFill(reader, hireId, today)).length > 0) {
    throw new ConflictError(inTeamDraftRefusal);
  }
}

// Whether filling the hire carries a team to its person: it is on one today or later, as it is
// whenever it leads one.
export const carriesTeams = async (
  reader: Reader,
  hireId: string,
  today: string,
): Promise<boolean> => (await teamsOfHires(reader, [hireId], today)).size > 0;

// What a fill carries to its person: their membership records, the hire's that end, and the lead
// records written for them.
interface Carried {
  memberships: CarriedOnFill;
  leadsEnded: CarriedOnFill["ended"];
  leads: { teamId: string; fromDate: string; leadId: string | null }[];
}

// The changes recording what a fill carries, one for each team whose membership it carries or
// ends, as a team's draft records the same change: the person joining as the hire leaves, from the
// day they do, unless they are on it only by their own records, and the lead from its first day.
// A team the hire leads is one it is on.
function carriedChanges(
  actor: Actor,
  hireId: string,
  personId: string,
  teams: ReadonlyMap<string, Recorded>,
  { memberships, leads }: Carried,
): Change[] {
  return memberships.ended.flatMap(({ teamId, fromDate }) => {
    // A membership's team is live, since removing a team removes its memberships.
    const before = teams.get(teamId) as Recorded;
    const leaves = membersOf(before).includes(hireId);
    const joins = memberships.person.some((one) => one.teamId === teamId);
    const lead = leads.find((one) => one.teamId === teamId);
    const days = {
      ...(joins ? { [personId]: fromDate } : {}),
      ...(leaves ? { [hireId]: fromDate } : {}),
    };
    const after = {
      ...before,
      members: [
        ...new Set([
          ...membersOf(before).filter((one) => one !== hireId),
          ...(joins ? [personId] : []),
        ]),
      ].sort(),
      ...(Object.keys(days).length === 0 ? {} : { memberFrom: days }),
      ...(lead === undefined
        ? {}
        : {
            leadId: lead.leadId,
            leadFrom: { [lead.leadId ?? hireId]: lead.fromDate },
          }),
    };
    return teamChanges(teamId, "changed", before, after, actor.dataClasses);
  });
}

// Who fills a hire, as approving or drafting the fill reads them.
export interface Filler {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
}

// What the fill of the hire carries to the person who fills it.
async function readCarried(
  reader: Reader,
  hireId: string,
  filler: Filler,
  today: string,
): Promise<Carried> {
  const rows = await readHireRows(reader, hireId);
  const own = await reader
    .select({
      teamId: featureTeamMemberships.teamId,
      member: featureTeamMemberships.member,
      fromDate: featureTeamMemberships.fromDate,
    })
    .from(featureTeamMemberships)
    .where(eq(featureTeamMemberships.personId, filler.id));
  const memberships = carriedOnFill(
    rows.memberships,
    filler.id,
    filler.startDate,
    today,
    own,
  );
  const leads = carriedOnFill(rows.leads, filler.id, filler.startDate, today);
  return {
    memberships,
    leadsEnded: leads.ended,
    leads: leadsWhileOn(leads, memberships, own, filler.id),
  };
}

// Refuses a fill that would put its person on one of the hire's teams, or leading one, after their
// end date.
export async function refuseJoiningAfterEnd(
  reader: Reader,
  hireId: string,
  filler: Filler,
  today: string,
): Promise<void> {
  const { memberships, leads } = await readCarried(
    reader,
    hireId,
    filler,
    today,
  );
  const leading = leads.map(({ teamId, fromDate, leadId }) => ({
    teamId,
    fromDate,
    memberId: filler.id,
    member: leadId !== null,
  }));
  if (
    joinsAfterEnd(memberships, filler.endDate) ||
    joinsAfterEnd({ person: leading }, filler.endDate)
  ) {
    throw new ConflictError(
      `${filler.name} leaves before they would join or lead one of the planned hire's feature teams; change the hire's team days or ${filler.name}'s end date first`,
    );
  }
}

// Carries the filled hire's teams and leads to its person, from the latest of the hire's days,
// their start date and today, the lead only while they are on the team, ends the hire's own from
// those days, and returns the changes recording it.
export async function carryTeamsOnFill(
  transaction: Transaction,
  actor: Actor,
  hireId: string,
  filler: Filler,
  today: string,
): Promise<Change[]> {
  await refuseJoiningAfterEnd(transaction, hireId, filler, today);
  const personId = filler.id;
  const carried = await readCarried(transaction, hireId, filler, today);
  const { memberships, leadsEnded, leads } = carried;
  if (memberships.ended.length === 0) return [];
  const { teams } = await readLiveTeams(transaction, today, {
    ids: memberships.ended.map(({ teamId }) => teamId),
  });
  for (const { teamId, fromDate } of memberships.ended) {
    await transaction
      .delete(featureTeamMemberships)
      .where(
        and(
          eq(featureTeamMemberships.teamId, teamId),
          eq(featureTeamMemberships.plannedHireId, hireId),
          gte(featureTeamMemberships.fromDate, fromDate),
        ),
      );
  }
  const hireLeaves = memberships.ended.filter(({ wasOn }) => wasOn);
  for (const chunk of inChunks(hireLeaves)) {
    await transaction.insert(featureTeamMemberships).values(
      chunk.map(({ teamId, fromDate }) => ({
        teamId,
        plannedHireId: hireId,
        member: false,
        fromDate,
      })),
    );
  }
  for (const { teamId, fromDate } of leadsEnded) {
    await transaction
      .delete(featureTeamLeads)
      .where(
        and(
          eq(featureTeamLeads.teamId, teamId),
          eq(featureTeamLeads.leadPlannedHireId, hireId),
          gte(featureTeamLeads.fromDate, fromDate),
        ),
      );
  }
  for (const chunk of inChunks(memberships.person)) {
    await transaction
      .insert(featureTeamMemberships)
      .values(
        chunk.map(({ teamId, member, fromDate }) => ({
          teamId,
          personId,
          member,
          fromDate,
        })),
      )
      .onConflictDoUpdate({
        target: [
          featureTeamMemberships.teamId,
          featureTeamMemberships.personId,
          featureTeamMemberships.fromDate,
        ],
        set: { member: sql`excluded.member` },
      });
  }
  for (const chunk of inChunks(leads)) {
    await transaction
      .insert(featureTeamLeads)
      .values(
        chunk.map(({ teamId, fromDate, leadId }) => ({
          teamId,
          leadId,
          leadPlannedHireId: null,
          fromDate,
        })),
      )
      .onConflictDoUpdate({
        target: [featureTeamLeads.teamId, featureTeamLeads.fromDate],
        set: {
          leadId: sql`excluded.lead_id`,
          leadPlannedHireId: sql`excluded.lead_planned_hire_id`,
        },
      });
  }
  return carriedChanges(actor, hireId, personId, teams, carried);
}
