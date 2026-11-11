// SPDX-License-Identifier: Apache-2.0

// Feature teams, through the server's API, and the chart they make: each team under its feature
// lead, or under a card naming the team while it has none, with its members below, so someone on
// two teams is drawn under each. A team is drawn as its draft makes it, with a member a draft adds
// marked Draft and one it removes drawn where they were, marked Live, as people moved on the org
// chart are; or, when only the approved chart is shown, as it is live.

import {
  type FeatureTeam,
  type FeatureTeamChange,
  type FeatureTeamDraft,
  type FeatureTeamRequest,
  featureTeamsSchema,
  type MemberTeamsChange,
  monthOf,
  type OrgChartPerson,
  type PaletteColour,
  savedSchema,
  type Show,
} from "@fathom/shared";
import { z } from "zod";
import { dayQuery, sendDeleteFor, sendJson, sendJsonFor } from "./api.ts";
import { type ChartPerson, dayUnlessShown } from "./org-chart.ts";
import { formatDayOrMonth, formatMonth } from "./table-view.ts";
import { today } from "./today.ts";

// The teams on a day, today unless another is given, with drafts for those who see them.
export const featureTeamsQueryOn = dayQuery(
  "feature-teams",
  "/api/feature-teams",
  featureTeamsSchema,
);

export const featureTeamsQuery = featureTeamsQueryOn(undefined);

const teamPath = (id: string) => `/api/feature-teams/${encodeURIComponent(id)}`;

export async function createFeatureTeam(
  request: FeatureTeamRequest,
): Promise<{ id: string; changeSetId: string | null }> {
  return sendJsonFor(
    "POST",
    "/api/feature-teams",
    request,
    z.object({ id: z.string(), changeSetId: z.string().nullable() }),
  );
}

export async function updateFeatureTeam(
  id: string,
  change: FeatureTeamChange,
): Promise<string | null> {
  return (await sendJsonFor("PATCH", teamPath(id), change, savedSchema))
    .changeSetId;
}

// Changes the teams someone is on from a day, drafted on each team.
export async function changeMemberTeams(
  personId: string,
  change: MemberTeamsChange,
): Promise<string | null> {
  return (
    await sendJsonFor(
      "PATCH",
      `/api/feature-teams/members/${encodeURIComponent(personId)}`,
      change,
      savedSchema,
    )
  ).changeSetId;
}

// Drafts removing a team, or discards the draft of one only drafted to be added.
export async function deleteFeatureTeam(id: string): Promise<string | null> {
  return (await sendDeleteFor(teamPath(id), savedSchema)).changeSetId;
}

export async function discardFeatureTeamDraft(
  id: string,
): Promise<string | null> {
  return (await sendDeleteFor(`${teamPath(id)}/draft`, savedSchema))
    .changeSetId;
}

// Sends a rejected draft for approval again, unchanged.
export async function resubmitFeatureTeamDraft(
  id: string,
): Promise<string | null> {
  return (await sendDeleteFor(`${teamPath(id)}/draft/rejection`, savedSchema))
    .changeSetId;
}

export async function setFeatureTeamColour(
  id: string,
  colour: PaletteColour | null,
): Promise<void> {
  await sendJson("PUT", `${teamPath(id)}/colour`, { colour });
}

// Names someone a team holds whom the reader cannot be shown.
export const someoneUnseen = "Someone this role can't see";

// Names someone on a team: by the team's own names, which include those who have not started, then
// by the org chart.
export function teamPersonNamer(
  team: FeatureTeam,
  people: readonly OrgChartPerson[],
): (personId: string) => string {
  const names = new Map(Object.entries(team.names));
  return (personId) =>
    names.get(personId) ??
    people.find(({ id }) => id === personId)?.preferredName ??
    someoneUnseen;
}

// A team as it is live: its draft's changes taken back, or none for one only drafted to be added.
export function liveTeam(team: FeatureTeam): FeatureTeam | undefined {
  const { draft } = team;
  if (draft === undefined) return team;
  if (draft.action === "created") return undefined;
  return {
    ...team,
    ...(draft.live.name === undefined ? {} : { name: draft.live.name }),
    ...(draft.live.leadId === undefined ? {} : { leadId: draft.live.leadId }),
    ...(draft.live.members === undefined
      ? {}
      : { members: draft.live.members }),
  };
}

// When a drafted change takes effect, for someone it adds or removes, or for its change of lead,
// unless that is the day shown: its day, or its month for readers who do not see days, or today for
// a change given no day.
export function takesEffect(
  draft: FeatureTeamDraft,
  personId: string | undefined,
  shown: string,
  seesDays: boolean,
): string | undefined {
  const heldFor = (
    held: Record<string, string> | undefined,
    lead: string | undefined,
  ) =>
    personId === undefined
      ? lead
      : new Map(Object.entries(held ?? {})).get(personId);
  const day = heldFor(draft.days, draft.leadDay);
  const month = heldFor(draft.months, draft.leadMonth);
  if (day !== undefined) return dayUnlessShown(day, shown);
  if (month !== undefined) {
    return month === monthOf(shown) ? undefined : formatMonth(month);
  }
  const now = today();
  return shown === now ? undefined : formatDayOrMonth(now, seesDays);
}

// The card id of a person on a team, since someone on two teams has a card under each.
export const memberCardId = (teamId: string, personId: string) =>
  `${teamId} ${personId}`;

// The id of a team's own card while it has no lead.
export const teamCardId = (teamId: string) => `${teamId} team`;

// The chart's people as feature teams: each team's lead, or a card naming it while it has none,
// with its members under it, from the people the org chart draws. A team's colour reaches its lead's
// card, which names it as a manager's team is named. With drafts beside live, members a draft adds
// are marked as drafted there and those it removes are drawn where they were, marked Live.
export function featureTeamPeople(
  teams: readonly FeatureTeam[],
  everyone: readonly OrgChartPerson[],
  show: Show,
): ChartPerson[] {
  const byId = new Map(everyone.map((person) => [person.id, person]));
  return teams.flatMap((team): ChartPerson[] => {
    const shown = show === "live" ? liveTeam(team) : team;
    if (shown === undefined) return [];
    const live = liveTeam(team);
    const draft = show === "both" ? team.draft : undefined;
    const lead = shown.leadId === null ? undefined : byId.get(shown.leadId);
    const rootId =
      lead === undefined ? teamCardId(team.id) : memberCardId(team.id, lead.id);
    const root: ChartPerson =
      lead === undefined
        ? {
            id: rootId,
            preferredName: shown.name,
            employeeId: null,
            position: "No feature lead",
            teamName: shown.name,
            teamColour: team.colour,
            managerId: null,
            approvedTeamName: live?.name ?? null,
            featureTeam: shown.name,
            featureTeamId: team.id,
            teamCard: true,
          }
        : {
            ...lead,
            id: rootId,
            teamName: shown.name,
            teamColour: team.colour,
            managerId: null,
            approvedTeamName: live?.name ?? null,
            featureTeam: shown.name,
            featureTeamId: team.id,
          };
    const wasMember = new Set(live?.members ?? []);
    const members = shown.members.flatMap((personId): ChartPerson[] => {
      const person = byId.get(personId);
      if (person === undefined || personId === lead?.id) return [];
      return [
        {
          ...person,
          id: memberCardId(team.id, personId),
          teamName: null,
          teamColour: null,
          managerId: rootId,
          featureTeam: shown.name,
          featureTeamId: team.id,
          ...(draft !== undefined && !wasMember.has(personId)
            ? {
                moved: {
                  managerId: rootId,
                  state: draft.state,
                  unpublished: draft.unpublished === true,
                },
              }
            : {}),
        },
      ];
    });
    // Members a draft takes off the team are drawn where they were, marked Live.
    const leaving =
      draft === undefined
        ? []
        : [...wasMember].flatMap((personId): ChartPerson[] => {
            const person = byId.get(personId);
            if (
              person === undefined ||
              shown.members.includes(personId) ||
              personId === lead?.id
            ) {
              return [];
            }
            return [
              {
                ...person,
                id: `${memberCardId(team.id, personId)} live`,
                employeeId: null,
                teamName: null,
                teamColour: null,
                managerId: rootId,
                liveCopyOf: memberCardId(team.id, personId),
              },
            ];
          });
    return [root, ...members, ...leaving];
  });
}
