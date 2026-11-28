// SPDX-License-Identifier: Apache-2.0

// The rules a feature team as a change makes it goes through, shared by drafting a change and by
// publishing a private one. Part of the data access layer.

import {
  featureTeamLeads,
  featureTeamMemberships,
  inChunks,
  type Reader,
} from "@fathom/db";
import { and, eq, inArray } from "drizzle-orm";
import { type Actor } from "../access.ts";
import { BadRequestError, ConflictError } from "../errors.ts";
import { type Transaction } from "./changes.ts";
import { type Recorded, same } from "./draft-records.ts";
import { peopleOf, readTeamNames } from "./feature-team-reads.ts";
import {
  datesOf,
  type DayRefusals,
  daysRefusal,
  employmentDayRefusal,
  type Everyone,
  leadDatesOf,
  leadDayRefusal,
  leadOffTeamRefusal,
  type MemberDay,
  type MemberRecord,
  membersOf,
  membersRefusal,
  nameIsTaken,
} from "./feature-team-rules.ts";
import { text } from "./reporting.ts";

const nameTaken = "Another feature team has that name";

export async function refuseTakenName(
  transaction: Transaction,
  name: string,
  except: string,
  editor: string,
): Promise<void> {
  if (nameIsTaken(await readTeamNames(transaction, editor), name, except)) {
    throw new ConflictError(nameTaken);
  }
}

function refuseWith(refusal: string | undefined): void {
  if (refusal !== undefined) throw new BadRequestError(refusal);
}

export function checkMembers(
  actor: Actor,
  added: readonly string[],
  members: readonly string[],
  leadId: unknown,
  everyone: Everyone,
): void {
  refuseWith(membersRefusal(actor, added, members, leadId, everyone));
}

// Refuses a day for a change of a team's lead unless it is after the team's latest such change.
async function refuseLeadDayOutOfOrder(
  reader: Reader,
  teamId: string,
  from: string,
): Promise<void> {
  const records = await reader
    .select({ fromDate: featureTeamLeads.fromDate })
    .from(featureTeamLeads)
    .where(eq(featureTeamLeads.teamId, teamId));
  refuseWith(
    leadDayRefusal(
      from,
      records.map(({ fromDate }) => fromDate),
    ),
  );
}

// Refuses a new lead on a day they are not on the team: the day they join in this draft, if they
// do, or otherwise as their records say.
async function refuseLeadOffTeam(
  reader: Reader,
  teamId: string,
  leadId: string,
  from: string,
  joinsOn: string | undefined,
): Promise<void> {
  const records = await reader
    .select({
      member: featureTeamMemberships.member,
      fromDate: featureTeamMemberships.fromDate,
    })
    .from(featureTeamMemberships)
    .where(
      and(
        eq(featureTeamMemberships.teamId, teamId),
        eq(featureTeamMemberships.personId, leadId),
      ),
    );
  refuseWith(leadOffTeamRefusal(records, from, joinsOn));
}

// Refuses a day outside someone's employment.
export function refuseOutsideEmployment(
  day: MemberDay,
  everyone: Everyone,
  refusals: DayRefusals,
): void {
  refuseWith(employmentDayRefusal(day, everyone, refusals));
}

// Refuses days that would never take effect, as daysRefusal sets out.
export async function refuseDaysOutOfOrder(
  reader: Reader,
  days: readonly MemberDay[],
  everyone: Everyone,
  refusals: DayRefusals,
): Promise<void> {
  const records: MemberRecord[] = [];
  for (const chunk of inChunks([...new Set(days.map((day) => day.teamId))])) {
    records.push(
      ...(await reader
        .select({
          teamId: featureTeamMemberships.teamId,
          personId: featureTeamMemberships.personId,
          fromDate: featureTeamMemberships.fromDate,
        })
        .from(featureTeamMemberships)
        .where(inArray(featureTeamMemberships.teamId, chunk))),
    );
  }
  refuseWith(daysRefusal(days, records, everyone, refusals));
}

// Refuses a feature team as a change makes it, from the team before it and as it is live: a name
// another team has, members who can't join, days that would never take effect or fall outside
// someone's employment, and a new lead who isn't on the team on the day, or whose day comes before
// the team's latest change of lead.
export async function checkTeamDraft(
  transaction: Transaction,
  actor: Actor,
  id: string,
  { live, team }: { live: Recorded | undefined; team: Recorded | undefined },
  after: Recorded,
  { today, dayRefusals }: { today: string; dayRefusals: DayRefusals },
): Promise<void> {
  if (!same(after.name, team?.name)) {
    await refuseTakenName(transaction, String(after.name), id, actor.user.id);
  }
  const members = membersOf(after);
  const were = membersOf(team);
  const added = members.filter((one) => !were.includes(one));
  const removed = were.filter((one) => !members.includes(one));
  const days = datesOf(after);
  const wereDays = datesOf(team);
  // The days are the team's own, by the people they name.
  /* eslint-disable security/detect-object-injection */
  const dated = Object.keys(days).filter(
    (personId) => days[personId] !== wereDays[personId],
  );
  const leadId = text(after.leadId);
  const everyone = await peopleOf(
    transaction,
    [
      ...new Set([
        ...added,
        ...removed,
        ...dated,
        ...(leadId === null ? [] : [leadId]),
      ]),
    ],
    today,
  );
  checkMembers(actor, added, members, leadId, everyone);
  await refuseDaysOutOfOrder(
    transaction,
    dated.map((personId) => ({
      teamId: id,
      personId,
      from: days[personId] as string,
    })),
    everyone,
    dayRefusals,
  );
  /* eslint-enable security/detect-object-injection */
  // A lead the team has live is no change; one the draft already had is checked again only where
  // the change gives it another day.
  const leadKept =
    leadId === text(team?.leadId) && same(after.leadFrom, team?.leadFrom);
  if (leadKept || leadId === text(live?.leadId)) return;
  const [leadDay] = Object.values(leadDatesOf(after));
  if (leadDay !== undefined) {
    await refuseLeadDayOutOfOrder(transaction, id, leadDay);
  }
  if (leadId === null) return;
  // A lead not on the team live joins it on their day in the draft, or today.
  const joinsOn = membersOf(live).includes(leadId)
    ? undefined
    : // The lead is one of the team's members, by whom its days are kept.
      // eslint-disable-next-line security/detect-object-injection
      (days[leadId] ?? today);
  await refuseLeadOffTeam(transaction, id, leadId, leadDay ?? today, joinsOn);
  if (leadDay !== undefined) {
    refuseOutsideEmployment(
      { teamId: id, personId: leadId, from: leadDay },
      everyone,
      dayRefusals,
    );
  }
}
