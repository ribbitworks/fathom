// SPDX-License-Identifier: Apache-2.0

// Changing the teams someone is on from a month, as a cell of the monthly grid does, on each team's
// draft. Part of the data access layer.

import { type Database } from "@fathom/db";
import { type MemberTeamsChange } from "@fathom/shared";
import { type Actor, requireView } from "../access.ts";
import { BadRequestError, NotFoundError } from "../errors.ts";
import { type Change } from "./changes.ts";
import { lockDrafts } from "./drafts.ts";
import { peopleOf, readLiveTeams } from "./feature-team-reads.ts";
import { membersOf } from "./feature-team-rules.ts";
import { heldTeamChange, monthRefusals } from "./feature-team-held-changes.ts";
import { noPerson } from "./people.ts";
import { readToday } from "./settings.ts";
import {
  draftedTeam,
  draftTeamChange,
  fromDay,
  requireChanging,
  saved,
} from "./feature-teams.ts";

// Drafts someone joining the teams added and leaving those removed, from the day given, or from
// today, as editing a month of the monthly grid does, on each team's draft and in one change set.
export async function changeMemberTeams(
  database: Database,
  actor: Actor,
  personId: string,
  change: MemberTeamsChange,
  asOf?: string,
): Promise<string | null> {
  requireChanging(actor);
  requireView(actor, "featureAssignments");
  const today = asOf ?? (await readToday(database));
  const from = fromDay(actor, change.from, today);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const person = (await peopleOf(transaction, [personId], today)).get(
      personId,
    );
    if (person === undefined) {
      throw new NotFoundError(noPerson);
    }
    if (person.left) {
      throw new BadRequestError(
        "Someone who has left can't join or leave a team",
      );
    }
    const made: Change[] = [];
    for (const [teamIds, member] of [
      [change.add, true],
      [change.remove, false],
    ] as const) {
      for (const id of teamIds) {
        const now = await draftedTeam(transaction, actor, id, today);
        const names = {
          personName: person.preferredName,
          teamName: String((now.team ?? now.before)?.name),
        };
        const day = from ?? today;
        const onDay = (await readLiveTeams(transaction, day, { ids: [id] }))
          .teams;
        const liveOnDay = membersOf(onDay.get(id)).includes(personId);
        const held = heldTeamChange(
          now,
          personId,
          { member, liveOnDay },
          { day, today, period: "month" },
          names,
        );
        if ("refusal" in held) throw new BadRequestError(held.refusal);
        if (!held.changes) continue;
        made.push(
          ...(await draftTeamChange(
            transaction,
            actor,
            {
              id,
              change: member ? { add: [personId] } : { remove: [personId] },
              from,
              today,
            },
            now,
            monthRefusals(names.personName, names.teamName),
          )),
        );
      }
    }
    return made.length === 0 ? null : saved(transaction, actor, made);
  });
}
