// SPDX-License-Identifier: Apache-2.0

// Changing the teams someone, a person or a planned hire, is on from a month, as a cell of the monthly
// grid does, on each team's draft. Part of the data access layer.

import { type Database } from "@fathom/db";
import { type MemberTeamsChange } from "@fathom/shared";
import { type Actor, requireView } from "../access.ts";
import { BadRequestError, NotFoundError } from "../errors.ts";
import { type Change } from "./changes.ts";
import { readLiveTeams, readMembers } from "./feature-team-reads.ts";
import { hasLeft, membersOf } from "./feature-team-rules.ts";
import { fromDay } from "./feature-team-days.ts";
import { heldTeamChange, monthRefusals } from "./feature-team-held-changes.ts";
import { noPerson } from "./person-fields.ts";
import {
  changingTeams,
  draftedTeam,
  draftTeamChange,
  readNamedIn,
  saved,
  teamToChange,
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
  return changingTeams(database, actor, asOf, async (transaction, today) => {
    requireView(actor, "featureAssignments");
    const from = fromDay(actor, change.from, today);
    const person = (await readMembers(transaction, [personId], today)).get(
      personId,
    );
    if (person === undefined) {
      throw new NotFoundError(noPerson);
    }
    if (hasLeft(person)) {
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
        const teamChange = member
          ? { add: [personId] }
          : { remove: [personId] };
        const everyone = await readNamedIn(transaction, now, teamChange, today);
        const names = {
          personName: person.preferredName,
          teamName: String(teamToChange(now).name),
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
            { id, change: teamChange, from, today },
            now,
            {
              refusals: monthRefusals(names.personName, names.teamName),
              everyone,
            },
          )),
        );
      }
    }
    return made.length === 0 ? null : saved(transaction, actor, made);
  });
}
