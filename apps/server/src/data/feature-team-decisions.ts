// SPDX-License-Identifier: Apache-2.0

// Deciding feature teams' drafts: checking the Approver may see them, then approving them, making
// the live teams, their leads and their members, or rejecting them. Part of the data access layer.

import {
  drafts,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
  inChunks,
} from "@fathom/db";
import { seesEmployment } from "@fathom/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { type Actor, mostSensitive, requirePermission } from "../access.ts";
import { ForbiddenError, NotFoundError } from "../errors.ts";
import { type Change, type Transaction } from "./changes.ts";
import {
  type Draft,
  drafted,
  draftFields,
  draftTier,
  refuseRejected,
  rejectionChange,
  unseenDraft,
} from "./draft-records.ts";
import { refuseHeldDecision, rejectedIn } from "./drafts.ts";
import {
  membershipChanges,
  peopleOf,
  readLiveTeams,
  readTeamDrafts,
} from "./feature-team-reads.ts";
import { recordType } from "./feature-team-records.ts";
import {
  type DayRefusal,
  type DayRefusals,
  type Everyone,
  leadDatesOf,
  type MemberDay,
} from "./feature-team-rules.ts";
import {
  draftHoldsNotStarted,
  featureTeamTier,
  peopleNamed,
  seesTeamField,
  withoutLeavers,
} from "./feature-team-sight.ts";
import { text } from "./reporting.ts";
import {
  refuseDaysOutOfOrder,
  refuseOutsideEmployment,
  teamChanges,
} from "./feature-teams.ts";

// An Approver has no day to choose, so is told which day no longer fits, and what to do about it.
function refusalsWhenApproving(
  teamNames: ReadonlyMap<string, string>,
  everyone: Everyone,
): DayRefusals {
  const refusal =
    (fact: string): DayRefusal =>
    ({ teamId, personId }) =>
      `${String(everyone.get(personId)?.preferredName)}'s day in the draft of ${String(teamNames.get(teamId))} ${fact}; reject the draft so it can be changed`;
  return {
    outOfOrder: refusal(
      "no longer comes after the last time they joined or left it",
    ),
    beforeStart: refusal("is now before their start date"),
    afterEnd: refusal("is now after their end date"),
  };
}

// Checks the actor may approve or reject the drafts of the teams asked for, and reads them with the
// teams as they are live and everyone they name. A draft holding Personal days, or changing
// someone who has not started, needs an Approver who sees them.
async function seenTeams(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  today: string,
) {
  requirePermission(actor, "feature-teams:view");
  const found = await readTeamDrafts(transaction, ids);
  if (found.size !== ids.length) {
    throw new NotFoundError(
      "One of these feature teams has no draft; refresh to see the latest",
    );
  }
  const live = (await readLiveTeams(transaction, today, { ids })).teams;
  const everyone = await peopleOf(
    transaction,
    [...found].flatMap(([id, draft]) => [
      ...peopleNamed(live.get(id)),
      ...peopleNamed(drafted(live.get(id), draft)),
    ]),
    today,
  );
  const seesPeople = seesEmployment(actor);
  for (const [id, draft] of found) {
    const before = live.get(id);
    if (
      !draftFields(before, draft).every(seesTeamField(actor)) ||
      (!seesPeople &&
        draftHoldsNotStarted(before, drafted(before, draft), everyone))
    ) {
      throw new ForbiddenError(unseenDraft);
    }
  }
  await refuseHeldDecision(transaction, recordType, ids);
  return { found, live, everyone };
}

// Checked before any drafts are approved or rejected.
export async function checkTeamsAsked(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  today: string,
): Promise<void> {
  if (ids.length > 0) await seenTeams(transaction, actor, ids, today);
}

// Makes the live teams as their drafts make them, and returns the changes recorded: each member
// added joins, and each removed leaves, from the day their draft gives, or from today. Anyone among
// a draft's members or its lead who has left by now is left out.
export async function approveTeamsIn(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  today: string,
): Promise<Change[]> {
  if (ids.length === 0) return [];
  const { found, live, everyone } = await seenTeams(
    transaction,
    actor,
    ids,
    today,
  );
  refuseRejected(found.values());
  const made: Change[] = [];
  const records: (typeof featureTeamMemberships.$inferInsert)[] = [];
  const leadRecords: (typeof featureTeamLeads.$inferInsert)[] = [];
  const leadDays: MemberDay[] = [];
  const days: MemberDay[] = [];
  const teamNames = new Map<string, string>();
  for (const id of ids) {
    const before = live.get(id);
    const draft = found.get(id) as Draft;
    const after = drafted(before, draft);
    const team = after && withoutLeavers(after, everyone);
    made.push(
      ...teamChanges(id, draft.action, before, team, actor.dataClasses),
    );
    if (team === undefined) {
      await transaction.delete(featureTeams).where(eq(featureTeams.id, id));
      continue;
    }
    const row = { name: String(team.name) };
    teamNames.set(id, row.name);
    if (before === undefined) {
      await transaction.insert(featureTeams).values({ id, ...row });
    } else {
      await transaction
        .update(featureTeams)
        .set(row)
        .where(eq(featureTeams.id, id));
    }
    const leadId = text(team.leadId);
    const wasLead = text(before?.leadId);
    if (leadId !== wasLead) {
      const [leadDay] = Object.values(leadDatesOf(team));
      leadRecords.push({ teamId: id, leadId, fromDate: leadDay ?? today });
      if (leadId !== null && leadDay !== undefined) {
        leadDays.push({ teamId: id, personId: leadId, from: leadDay });
      }
    }
    const joiningAndLeaving = membershipChanges(id, before, team, today);
    records.push(...joiningAndLeaving.records);
    days.push(...joiningAndLeaving.days);
  }
  const refusals = refusalsWhenApproving(teamNames, everyone);
  await refuseDaysOutOfOrder(transaction, days, everyone, refusals);
  for (const day of leadDays) refuseOutsideEmployment(day, everyone, refusals);
  for (const chunk of inChunks(records)) {
    await transaction
      .insert(featureTeamMemberships)
      .values(chunk)
      .onConflictDoUpdate({
        target: [
          featureTeamMemberships.teamId,
          featureTeamMemberships.personId,
          featureTeamMemberships.fromDate,
        ],
        set: { member: sql`excluded.member` },
      });
  }
  for (const chunk of inChunks(leadRecords)) {
    await transaction
      .insert(featureTeamLeads)
      .values(chunk)
      .onConflictDoUpdate({
        target: [featureTeamLeads.teamId, featureTeamLeads.fromDate],
        set: {
          leadId: sql`excluded.lead_id`,
          leadPlannedHireId: sql`excluded.lead_planned_hire_id`,
        },
      });
  }
  for (const chunk of inChunks([...ids])) {
    await transaction
      .delete(drafts)
      .where(
        and(eq(drafts.recordType, recordType), inArray(drafts.recordId, chunk)),
      );
  }
  return made;
}

// Rejects the drafts of the teams asked for, with a reason, and returns the changes recorded.
export async function rejectTeamsIn(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  reason: string,
  today: string,
): Promise<Change[]> {
  if (ids.length === 0) return [];
  const { found, live, everyone } = await seenTeams(
    transaction,
    actor,
    ids,
    today,
  );
  const made: Change[] = [];
  for (const id of ids) {
    const draft = found.get(id) as Draft;
    const before = live.get(id);
    const tier = mostSensitive([
      draftTier(featureTeamTier(actor.dataClasses), before, draft),
      draftHoldsNotStarted(before, drafted(before, draft), everyone)
        ? actor.dataClasses.startDate
        : "general",
    ]);
    made.push(...rejectionChange(recordType, id, draft, reason, tier));
  }
  await rejectedIn(transaction, recordType, ids, reason);
  return made;
}
