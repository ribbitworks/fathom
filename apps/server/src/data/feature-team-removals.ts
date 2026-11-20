// SPDX-License-Identifier: Apache-2.0

// The guards feature teams keep on removing people and on features naming a team. Part of the data
// access layer.

import {
  featureTeamLeads,
  featureTeams,
  inChunks,
  type Reader,
} from "@fathom/db";
import { eq, inArray } from "drizzle-orm";
import { BadRequestError, ConflictError } from "../errors.ts";
import { readHeld } from "./drafts.ts";
import { readTeamDrafts } from "./feature-team-reads.ts";
import { recordType } from "./feature-team-records.ts";
import { membersOf } from "./feature-team-rules.ts";
import { bySubject, inForceOrLater } from "./in-force.ts";
import { readToday } from "./settings.ts";

// Refuses a feature team for a feature unless it is live and no draft, published or not, removes it.
export async function checkTeamForFeature(
  reader: Reader,
  id: string | null,
): Promise<void> {
  if (id === null) return;
  const [team] = await reader
    .select({ id: featureTeams.id })
    .from(featureTeams)
    .where(eq(featureTeams.id, id));
  if (team === undefined) {
    throw new BadRequestError("Choose a feature team that has been approved");
  }
  const removals = [
    (await readTeamDrafts(reader, [id])).get(id),
    (await readHeld(reader, recordType, undefined, [id])).get(id)?.draft,
  ];
  if (removals.some((draft) => draft?.action === "deleted")) {
    throw new ConflictError(
      "This feature team is drafted to be removed; choose another",
    );
  }
}

// Whether any of the people given leads a team today or is planned to later.
async function leadTodayOrLater(
  reader: Reader,
  ids: readonly string[],
  today: string,
): Promise<boolean> {
  const led = await reader
    .select({ teamId: featureTeamLeads.teamId })
    .from(featureTeamLeads)
    .where(inArray(featureTeamLeads.leadId, [...ids]));
  const records = [];
  for (const chunk of inChunks([...new Set(led.map(({ teamId }) => teamId))])) {
    records.push(
      ...(await reader
        .select()
        .from(featureTeamLeads)
        .where(inArray(featureTeamLeads.teamId, chunk))),
    );
  }
  return [...bySubject(records, ({ teamId }) => teamId).values()].some((team) =>
    team.some(
      (record) =>
        record.leadId !== null &&
        ids.includes(record.leadId) &&
        inForceOrLater(record, team, today),
    ),
  );
}

// Refuses removing people who lead a feature team, today, later, or in a draft, or whom a team's
// draft names as a member, published or not.
export async function refuseRemovingPeopleOnTeams(
  reader: Reader,
  ids: readonly string[],
): Promise<void> {
  const today = await readToday(reader);
  const inDrafts = [
    ...(await readTeamDrafts(reader)).values(),
    ...[...(await readHeld(reader, recordType, undefined)).values()].map(
      ({ draft }) => draft,
    ),
  ].map(({ fields }) => fields);
  for (const chunk of inChunks([...ids])) {
    if (
      (await leadTodayOrLater(reader, chunk, today)) ||
      inDrafts.some((fields) => chunk.includes(String(fields.leadId)))
    ) {
      throw new ConflictError(
        "This person leads a feature team; choose another lead first",
      );
    }
    if (
      inDrafts.some((fields) =>
        membersOf(fields).some((one) => chunk.includes(one)),
      )
    ) {
      throw new ConflictError(
        "This person is in a feature team's draft; take them out of it or discard it first",
      );
    }
  }
}
