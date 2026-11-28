// SPDX-License-Identifier: Apache-2.0

// Feature teams, through the server's API, and the cards the org chart draws for them, with their
// drafts.

import {
  byName,
  capitalized,
  type FeatureTeam,
  type FeatureTeamChange,
  type FeatureTeamDraft,
  type FeatureTeamRequest,
  featureTeamsSchema,
  type MemberTeamsChange,
  type OrgChart,
  type OrgChartPerson,
  type PaletteColour,
  savedSchema,
  type Show,
  type TeamHire,
} from "@fathom/shared";
import { z } from "zod";
import { dayQuery, sendDeleteFor, sendJson, sendJsonFor } from "./api.ts";
import { expectedWords, formatDay } from "./day-formats.ts";
import {
  type ChartPerson,
  dayUnlessShown,
  type FillerWords,
  liveCopyId,
} from "./org-chart.ts";
import { today } from "./today.ts";
import { besideLive } from "./status-mark.tsx";

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

// Someone on a team as it names them, and, for a planned hire, what the team says of it.
export interface TeamPerson {
  name: string;
  hire?: TeamHire;
}

// Finds someone on a team: anyone it names by the team's own names, which include those who have not
// started and planned hires as People names them, then by the org chart. The team says which are
// planned hires, and what its details show of each.
export function teamPersonOf(
  team: FeatureTeam,
  people: readonly OrgChartPerson[],
): (personId: string) => TeamPerson {
  const names = new Map(Object.entries(team.names));
  const cards = new Map(people.map((person) => [person.id, person]));
  const hires = new Map(Object.entries(team.hires ?? {}));
  return (personId) => {
    const name =
      names.get(personId) ??
      cards.get(personId)?.preferredName ??
      someoneUnseen;
    const hire = hires.get(personId);
    return hire === undefined ? { name } : { name, hire };
  };
}

export const filledByWords = "Filled by";

export const fillerWords = ({
  name,
  starts,
}: NonNullable<TeamHire["filledBy"]>): FillerWords => ({
  name,
  ...(starts === undefined ? {} : { starts: `starts ${formatDay(starts)}` }),
});

// When a planned hire on a team starts: by whom it's filled, from the day they start where given;
// otherwise the month it's expected, or that it has no target date.
export function teamHireWords(hire: TeamHire): string {
  const { filledBy } = hire;
  if (filledBy === undefined) return capitalized(expectedWords(hire));
  const { name, starts } = fillerWords(filledBy);
  return [
    `${filledByWords} ${name}`,
    ...(starts === undefined ? [] : [starts]),
  ].join(", ");
}

type HireStart = "filled" | "expected" | "undated";

// Filled hires first, then those expected, with no target date last.
const startRank: Record<HireStart, number> = {
  filled: 0,
  expected: 1,
  undated: 2,
};

const startOf = ({ filledBy, undated }: TeamHire): HireStart => {
  if (filledBy !== undefined) return "filled";
  return undated === true ? "undated" : "expected";
};

// Planned hires on a team by when they start, then by name.
export const plannedHireOrder = (
  a: { name: string; hire: TeamHire },
  b: { name: string; hire: TeamHire },
): number =>
  startRank[startOf(a.hire)] - startRank[startOf(b.hire)] ||
  a.hire.expected.localeCompare(b.hire.expected) ||
  byName(a, b);

export function teamPersonNamer(
  team: FeatureTeam,
  people: readonly OrgChartPerson[],
): (personId: string) => string {
  const personOf = teamPersonOf(team, people);
  return (personId) => personOf(personId).name;
}

// Who a choice of a team's members adds and takes off, given its members now and those the picker
// offered: someone it did not offer, such as a member the reader does not see, stays. Nothing, when
// the choice changes no one.
export function membersChanged(
  current: readonly string[],
  wanted: readonly string[],
  offered: ReadonlySet<string>,
): { add: string[]; remove: string[] } | undefined {
  const add = wanted.filter((personId) => !current.includes(personId));
  const remove = current.filter(
    (personId) => offered.has(personId) && !wanted.includes(personId),
  );
  return add.length === 0 && remove.length === 0 ? undefined : { add, remove };
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
// unless that is the day shown: its day, or today for a change given no day.
export function takesEffect(
  draft: FeatureTeamDraft,
  personId: string | undefined,
  shown: string,
): string | undefined {
  const heldFor = (held: Record<string, string>, lead: string | undefined) =>
    personId === undefined ? lead : new Map(Object.entries(held)).get(personId);
  // A planned hire's days are held apart from people's.
  const day = heldFor(
    { ...draft.days, ...draft.hireDays },
    draft.leadDay ?? draft.hireLeadDay,
  );
  if (day !== undefined) return dayUnlessShown(day, shown);
  const now = today();
  return shown === now ? undefined : formatDay(now);
}

// The card id of a person on a team, since someone on two teams has a card under each.
export const memberCardId = (teamId: string, personId: string) =>
  `${teamId} ${personId}`;

// The id of a team's own card while it has no lead.
export const teamCardId = (teamId: string) => `${teamId} team`;

// The cards feature teams are drawn from: the chart's people, and the filled hires it draws on their
// teams alone.
export const teamCardPeople = ({
  people,
  filled = [],
}: Pick<OrgChart, "people" | "filled">): OrgChartPerson[] => [
  ...people,
  ...filled,
];

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
    const liveName = live?.name ?? null;
    // The team's draft, whatever the view, for its marks, which the Draft view decides.
    const draft = team.draft;
    const marked =
      draft === undefined
        ? undefined
        : { state: draft.state, unpublished: draft.unpublished === true };
    const hires = new Map(Object.entries(team.hires ?? {}));
    // A planned hire's card says who fills it, as its team's details do, where the team names them.
    const onTeam = (person: OrgChartPerson): ChartPerson => {
      const hire = hires.get(person.id);
      return hire?.filledBy === undefined
        ? person
        : { ...person, filled: fillerWords(hire.filledBy) };
    };
    const found = shown.leadId === null ? undefined : byId.get(shown.leadId);
    const lead = found === undefined ? undefined : onTeam(found);
    const rootId =
      lead === undefined ? teamCardId(team.id) : memberCardId(team.id, lead.id);
    const card: ChartPerson =
      lead === undefined
        ? {
            id: rootId,
            keyNumber: team.keyNumber,
            preferredName: shown.name,
            employeeId: null,
            position: "No feature lead",
            teamName: shown.name,
            teamColour: team.colour,
            managerId: null,
            approvedTeamName: liveName,
            featureTeam: shown.name,
            featureTeamId: team.id,
            teamKeyNumber: team.keyNumber,
            teamCard: true,
          }
        : {
            ...lead,
            id: rootId,
            teamName: shown.name,
            teamColour: team.colour,
            managerId: null,
            approvedTeamName: liveName,
            featureTeam: shown.name,
            featureTeamId: team.id,
            teamKeyNumber: team.keyNumber,
          };
    // A draft renaming the team, in any Draft view, which decides how it shows, with the live name
    // drawn under it beside live, and who holds the team, all marked on its root card's team name.
    const renaming =
      team.draft?.action === "changed" && team.draft.changed.includes("name")
        ? team.draft
        : undefined;
    const teamMarks: Partial<ChartPerson> = {
      ...(renaming === undefined
        ? {}
        : {
            renamed: {
              live: besideLive(show) ? liveName : null,
              draft: {
                teamName: shown.name,
                state: renaming.state,
                unpublished: renaming.unpublished === true,
              },
            },
          }),
      ...(team.heldBy === undefined ? {} : { teamHeldBy: team.heldBy }),
    };
    const root: ChartPerson = { ...card, ...teamMarks };
    const wasMember = new Set(live?.members ?? []);
    const members = shown.members.flatMap((personId): ChartPerson[] => {
      const person = byId.get(personId);
      if (person === undefined || personId === lead?.id) return [];
      return [
        {
          ...onTeam(person),
          id: memberCardId(team.id, personId),
          teamName: null,
          teamColour: null,
          managerId: rootId,
          featureTeam: shown.name,
          featureTeamId: team.id,
          ...(marked !== undefined && !wasMember.has(personId)
            ? { added: marked }
            : {}),
          // Live only, a member the draft takes off the team is drawn where they are, marked.
          ...(marked !== undefined && !team.members.includes(personId)
            ? { leaving: marked }
            : {}),
        },
      ];
    });
    // Members a draft takes off the team are drawn where they were, marked Live.
    const leaving =
      draft === undefined || show !== "both"
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
                ...onTeam(person),
                id: liveCopyId(memberCardId(team.id, personId)),
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
