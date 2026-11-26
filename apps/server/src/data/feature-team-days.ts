// SPDX-License-Identifier: Apache-2.0

// The days feature team changes take effect from: who may choose one, the checks each day passes,
// and the access history of people's Personal days. Part of the data access layer.

import {
  type Database,
  featureTeamLeads,
  featureTeamMemberships,
  inChunks,
  type Reader,
} from "@fathom/db";
import { editsField, mayDateChange } from "@fathom/shared";
import { and, eq, inArray } from "drizzle-orm";
import { type Actor, requireView } from "../access.ts";
import { BadRequestError, ForbiddenError } from "../errors.ts";
import type { Change } from "./changes.ts";
import { memberColumn } from "./feature-team-reads.ts";
import { recordType } from "./feature-team-records.ts";
import {
  type DayRefusals,
  daysIn,
  daysRefusal,
  employmentDayRefusal,
  type Everyone,
  leadDayRefusal,
  leadOffTeamRefusal,
  type MemberDay,
  type MemberRecord,
} from "./feature-team-rules.ts";
import { recordEvents } from "./history.ts";

export function refuseWith(refusal: string | undefined): void {
  if (refusal !== undefined) throw new BadRequestError(refusal);
}

export const changesDates = (actor: Actor) =>
  editsField(actor, "featureTeamDates");

// The day members join or leave from: today, or another day for those who see the classes of data
// other dates need, an earlier day needing the right to change feature team dates' class too.
export function fromDay(actor: Actor, from: string | undefined, today: string) {
  if (from === undefined || from === today) return undefined;
  requireView(actor, "orgChartOtherDates");
  if (!mayDateChange(changesDates(actor), from, today)) {
    throw new ForbiddenError(
      "This role can't choose an earlier date. Use today or a later date.",
    );
  }
  return from;
}

// Refuses a day for a change of a team's lead unless it is after the team's latest such change.
export async function refuseLeadDayOutOfOrder(
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
export async function refuseLeadOffTeam(
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
          memberId: memberColumn,
          fromDate: featureTeamMemberships.fromDate,
        })
        .from(featureTeamMemberships)
        .where(inArray(featureTeamMemberships.teamId, chunk))),
    );
  }
  refuseWith(daysRefusal(days, records, everyone, refusals));
}

// Records, in the access history, the people whose Personal joining or leaving days changed.
export async function recordTeamDayChanges(
  transaction: Pick<Database, "insert">,
  actorId: string,
  made: readonly Change[],
): Promise<void> {
  const subjects = new Set(
    made
      .filter(
        (change) =>
          change.recordType === recordType &&
          (change.field === "memberFrom" || change.field === "leadFrom"),
      )
      .flatMap((change) => [
        ...Object.keys(daysIn(change.oldValue)),
        ...Object.keys(daysIn(change.newValue)),
      ]),
  );
  await recordEvents(
    transaction,
    [...subjects].map((subjectId) => ({
      actorId,
      action: "personal-changed" as const,
      subjectId,
    })),
  );
}
