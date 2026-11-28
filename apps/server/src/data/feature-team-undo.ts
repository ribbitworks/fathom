// SPDX-License-Identifier: Apache-2.0

// Undoing changes to feature teams' drafts, putting back what a change set changed in them. Part of
// the data access layer.

import { mayDateChange, seesField } from "@fathom/shared";
import { type Actor, requirePermission } from "../access.ts";
import { ConflictError, ForbiddenError } from "../errors.ts";
import { type Change, type Transaction } from "./changes.ts";
import {
  drafted,
  type Recorded,
  rejectedField,
  tidy,
} from "./draft-records.ts";
import { writeDraft } from "./drafts.ts";
import {
  peopleOf,
  readLiveTeams,
  readTeamDrafts,
} from "./feature-team-reads.ts";
import { recordType } from "./feature-team-records.ts";
import {
  datesOf,
  leadDatesOf,
  membersOf,
  membersRefusal,
  nameIsTaken,
} from "./feature-team-rules.ts";
import { peopleNamed, withoutLeavers } from "./feature-team-sight.ts";
import { refuseRemovingNamed } from "./records.ts";
import { readToday } from "./settings.ts";
import { changesDates, requireChanging } from "./feature-teams.ts";
import { readTeamNames } from "./feature-team-reads.ts";

// Refuses putting back a joining, leaving or lead day the actor could not choose today. Those who
// do not see the days are refused any, since which they could choose would say what the day is.
function refuseDaysPutBack(
  actor: Actor,
  wanted: Recorded | undefined,
  now: Recorded | undefined,
  today: string,
): void {
  const seesDays = seesField(actor, "featureTeamDates");
  for (const days of [datesOf, leadDatesOf]) {
    const before = new Map(Object.entries(days(now)));
    for (const [personId, day] of Object.entries(days(wanted))) {
      if (
        before.get(personId) !== day &&
        (!seesDays || !mayDateChange(changesDates(actor), day, today))
      ) {
        throw new ForbiddenError(
          "This change would bring back a date this role can't choose, so it can't be undone.",
        );
      }
    }
  }
}

// Puts back the drafts of the teams a change set changed in their drafts: the team it drafted
// adding taken out, the one it drafted removing put back as it was, and the fields it changed put
// back. A team's name must still be one no other has; a member who has left since is left out, and
// a lead who has left leaves it with no lead. Removing a team, or putting back the removal of a live
// team, needs the right to edit teams, not only to propose; putting back a name, or bringing back a
// discarded draft adding a team, needs only the right to propose, as renaming and adding one do.
export async function undoTeamDrafts(
  transaction: Transaction,
  actor: Actor,
  records: readonly {
    id: string;
    action: Change["action"];
    old: ReadonlyMap<string, unknown>;
  }[],
  changedSince: string,
): Promise<void> {
  requireChanging(actor);
  const today = await readToday(transaction);
  const ids = records.map(({ id }) => id);
  const live = (await readLiveTeams(transaction, today, { ids })).teams;
  const draftsNow = await readTeamDrafts(transaction, ids, actor.user.id);
  if (
    records.some(
      ({ id, action }) =>
        (action === "deleted" && live.has(id)) ||
        (action === "created" && live.has(id)),
    )
  ) {
    requirePermission(actor, "feature-teams:edit");
  }
  const undone = records.map((record) => {
    const old = new Map(record.old);
    old.delete(rejectedField);
    const now = drafted(live.get(record.id), draftsNow.get(record.id));
    let team: Recorded | undefined;
    if (record.action === "deleted") {
      team = tidy(Object.fromEntries(old));
    } else if (record.action === "changed") {
      team = tidy({ ...(now as Recorded), ...Object.fromEntries(old) });
    }
    return { id: record.id, team, now };
  });
  await refuseRemovingNamed(
    transaction,
    "feature-team",
    undone
      .filter(({ id, team }) => team === undefined && live.has(id))
      .map(({ id }) => id),
    actor,
  );
  const names = await readTeamNames(transaction, actor.user.id);
  const everyone = await peopleOf(
    transaction,
    undone.flatMap(({ team }) => peopleNamed(team)),
    today,
  );
  for (const { id, team, now } of undone) {
    refuseDaysPutBack(actor, team, now, today);
    const wanted = team && withoutLeavers(team, everyone);
    if (wanted !== undefined) {
      const name = String(wanted.name);
      const members = membersOf(wanted);
      const already = [...membersOf(now), ...membersOf(live.get(id))];
      if (
        nameIsTaken(names, name, id) ||
        membersRefusal(
          actor,
          members.filter((one) => !already.includes(one)),
          members,
          wanted.leadId,
          everyone,
        ) !== undefined
      ) {
        throw new ConflictError(changedSince);
      }
      names.push([id, name]);
    }
    await writeDraft(
      transaction,
      actor.user.id,
      recordType,
      id,
      live.get(id),
      wanted,
    );
  }
}
