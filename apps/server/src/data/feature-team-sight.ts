// SPDX-License-Identifier: Apache-2.0

// What a reader sees of a feature team and its draft, by their role and the classes of data it
// sees, as pure functions of what the data access layer reads.

import {
  type ClassAccess,
  type DataClasses,
  type FeatureTeam,
  type FeatureTeamDraft,
  hireCalled,
  monthOf,
  type OrgChartPerson,
  seesClass,
  seesEmployment,
  seesField,
  seesView,
  type TeamHire,
  type Tier,
} from "@fathom/shared";
import { stableJson } from "./changes.ts";
import {
  type Draft,
  drafted,
  draftFields,
  type Recorded,
  tidy,
} from "./draft-records.ts";
import { draftStanding, fieldEditorsOf, type Maker } from "./draft-makers.ts";
import {
  datesOf,
  daysIn,
  type Everyone,
  hasLeft,
  leadDatesOf,
  memberChanges,
  membersOf,
  notYetStarted,
  type PlannedHire,
} from "./feature-team-rules.ts";
import { text } from "./reporting.ts";

// The days people join and leave and become leads are in Feature team dates' class; the rest, and
// planned hires' days, which come from no one's Personal details, are General.
export const featureTeamTier =
  (classes: DataClasses) =>
  (field: string): Tier =>
    field === "memberFrom" || field === "leadFrom"
      ? classes.featureTeamDates
      : "general";

// Everyone who sees feature teams sees a team's General details, whether or not they see people.
export const seesTeamField = (access: ClassAccess) => (field: string) =>
  seesClass(access.permissions, featureTeamTier(access.dataClasses)(field));

// Whether a team's draft changes a person's team, or makes a person its lead or no longer, from a
// day of its own.
const dated = (team: Recorded): boolean =>
  Object.keys(daysIn(team.memberFrom)).length > 0 ||
  Object.keys(daysIn(team.leadFrom)).length > 0;

// A draft dating a person's change from another day is held only for those who see the days changes
// take effect from, so no one sees a later change drawn as if it were today's. Planned hires' days
// are General, so dating only them hides nothing.
export const draftShownTo = (access: ClassAccess, draft: Draft): boolean =>
  seesField(access, "featureTeamDates") || !dated(draft.fields);

// A role that does not see future reorganizations is shown people as they are today on a future
// day, as the org chart draws them, so their employment is judged today.
export const peopleAsTodayOn = (
  access: ClassAccess,
  day: string,
  today: string,
): boolean => day > today && !seesView("orgChartFutureDates", access);

// A team without those who have left, whether as members, as its lead, or as members given a day.
// Only people leave, so planned hires' days are kept as they are.
export function withoutLeavers(team: Recorded, everyone: Everyone): Recorded {
  const gone = (id: unknown) =>
    typeof id === "string" && hasLeft(everyone.get(id));
  const days = Object.entries(daysIn(team.memberFrom)).filter(
    ([id]) => !gone(id),
  );
  const leadDays = Object.entries(daysIn(team.leadFrom)).filter(
    ([id]) => !gone(id),
  );
  const rest = { ...team };
  delete rest.memberFrom;
  delete rest.leadFrom;
  return {
    ...rest,
    ...(Array.isArray(team.members)
      ? { members: membersOf(team).filter((id) => !gone(id)) }
      : {}),
    ...(gone(team.leadId) ? { leadId: null } : {}),
    ...(days.length === 0 ? {} : { memberFrom: Object.fromEntries(days) }),
    ...(leadDays.length === 0
      ? {}
      : { leadFrom: Object.fromEntries(leadDays) }),
  };
}

// Those a draft changes something about, from a team to the team as drafted: the members it adds or
// removes, and its lead, old and new, when it changes the lead.
export function peopleDraftChanges(
  before: Recorded | undefined,
  after: Recorded | undefined,
): string[] {
  const { added, removed } = memberChanges(before, after);
  return [
    ...removed,
    ...added,
    ...(before?.leadId === after?.leadId
      ? []
      : [text(before?.leadId), text(after?.leadId)].filter(
          (one) => one !== null,
        )),
  ];
}

// Whether a draft changes anything about someone who has not started, from a team to the team as
// drafted.
export const draftHoldsNotStarted = (
  before: Recorded | undefined,
  after: Recorded | undefined,
  everyone: Everyone,
): boolean =>
  peopleDraftChanges(before, after).some((one) =>
    notYetStarted(everyone.get(one)),
  );

// Everyone a team and its draft name.
export const peopleNamed = (team: Recorded | undefined): string[] => [
  ...membersOf(team),
  ...Object.keys(datesOf(team)),
  ...Object.keys(leadDatesOf(team)),
  ...[team?.leadId].flatMap((id) => (typeof id === "string" ? [id] : [])),
];

// Whether a reader sees someone on a team: never once they have left, and, before they have started,
// only with Personal details.
export const seenBy =
  (everyone: Everyone, seesPersonal: boolean) =>
  (memberId: unknown): memberId is string => {
    const member =
      typeof memberId === "string" ? everyone.get(memberId) : undefined;
    return (
      member !== undefined &&
      !hasLeft(member) &&
      (seesPersonal || !notYetStarted(member))
    );
  };

// A team on a day, with its draft's changes, judged against the team today, laid over it: those the
// draft adds or removes are on or off the team, and a lead it changes is its lead. A draft adding
// the team makes it as drafted, and one removing it makes none.
export function draftedOn(
  onDay: Recorded | undefined,
  today: Recorded | undefined,
  draft: Draft | undefined,
): Recorded | undefined {
  const draftedToday = drafted(today, draft);
  if (draft === undefined || draft.action !== "changed") return draftedToday;
  if (draftedToday === undefined) return undefined;
  const { added, removed } = memberChanges(today, draftedToday);
  const members = [
    ...new Set([
      ...membersOf(onDay).filter((one) => !removed.includes(one)),
      ...added,
    ]),
  ].sort();
  const leadChanged = text(draftedToday.leadId) !== text(today?.leadId);
  const leadId = leadChanged ? text(draftedToday.leadId) : text(onDay?.leadId);
  // As on any day, a lead who is not a member then is no lead.
  return tidy({
    ...draftedToday,
    members,
    leadId: leadId !== null && members.includes(leadId) ? leadId : null,
  });
}

// What a reader sees of feature teams on a day: whom of the people read, which of a team's fields,
// and whether the days changes take effect from.
export interface TeamSight {
  everyone: Everyone;
  seesPeople: boolean;
  seesDays: boolean;
  seesTier: (tier: Tier) => boolean;
  seen: (field: string) => boolean;
  shown: (personId: unknown) => personId is string;
}

export function teamSight(
  access: ClassAccess,
  everyone: Everyone,
  { day, today }: { day: string; today: string },
): TeamSight {
  const seesPeople = seesEmployment(access);
  return {
    everyone,
    seesPeople,
    seesDays: seesField(access, "featureTeamDates"),
    seesTier: (tier) => seesClass(access.permissions, tier),
    seen: seesTeamField(access),
    shown: seenBy(everyone, seesPeople && !peopleAsTodayOn(access, day, today)),
  };
}

// The names of those on a team, as drafted or live, whom the reader sees.
export function namesSeen(
  { everyone, shown }: TeamSight,
  team: Recorded,
  before: Recorded | undefined,
): Record<string, string> {
  const named = new Set([...peopleNamed(team), ...peopleNamed(before)]);
  return Object.fromEntries(
    [...everyone]
      .filter(([personId]) => named.has(personId) && shown(personId))
      .map(([personId, { preferredName }]) => [personId, preferredName]),
  );
}

// A team as live today, on the day read, and as its draft makes it then.
export interface TeamVersions {
  before: Recorded | undefined;
  teamToday: Recorded | undefined;
  after: Recorded | undefined;
  team: Recorded;
}

// A team's draft as the reader sees it, or none when it changes nothing they may see. Readers who do
// not see the days changes take effect from are not told them. A draft holding someone who has not
// started is judged as it was made, against the team today.
export function draftAsSeen(
  { everyone, seesPeople, seesDays, seen, shown }: TeamSight,
  { before, teamToday, after, team }: TeamVersions,
  draft: Draft | undefined,
  maker: Maker | undefined,
): { draft?: FeatureTeamDraft } {
  if (draft === undefined) return {};
  // Who of a team's members, or its lead, the reader sees.
  const seenIn = (field: string, version: Recorded | undefined) =>
    field === "members"
      ? membersOf(version).filter(shown).sort()
      : [version?.leadId].filter(shown);
  const changesWhoIsSeen = (field: string) =>
    !["members", "leadId"].includes(field) ||
    stableJson(seenIn(field, before)) !== stableJson(seenIn(field, after));
  const shownDays = (held: unknown) =>
    Object.entries(daysIn(held)).filter(([personId]) => shown(personId));
  const days = seesDays ? shownDays(team.memberFrom) : [];
  const leadDay = seesDays ? shownDays(team.leadFrom)[0]?.[1] : undefined;
  const hireDays = shownDays(team.hireFrom);
  const hireLeadDay = shownDays(team.hireLeadFrom)[0]?.[1];
  const fields = draftFields(before, draft);
  const changed = fields.filter(
    (field) =>
      seen(field) &&
      changesWhoIsSeen(field) &&
      (field !== "memberFrom" || days.length > 0) &&
      (field !== "leadFrom" || leadDay !== undefined) &&
      (field !== "hireFrom" || hireDays.length > 0) &&
      (field !== "hireLeadFrom" || hireLeadDay !== undefined),
  );
  // Nothing left to show those who see start and end dates means only people who have left remain
  // in the draft, so it stays listed for them to clear. For others it may hide someone who has not
  // started.
  if (changed.length === 0 && !seesPeople) return {};
  return {
    draft: {
      action: draft.action,
      changed,
      live:
        before === undefined
          ? {}
          : {
              ...(changed.includes("name")
                ? { name: String(before.name) }
                : {}),
              ...(changed.includes("leadId")
                ? { leadId: shown(before.leadId) ? before.leadId : null }
                : {}),
              ...(changed.includes("members")
                ? { members: membersOf(before).filter(shown) }
                : {}),
            },
      ...(days.length === 0 ? {} : { days: Object.fromEntries(days) }),
      ...(leadDay === undefined ? {} : { leadDay }),
      ...(hireDays.length === 0
        ? {}
        : { hireDays: Object.fromEntries(hireDays) }),
      ...(hireLeadDay === undefined ? {} : { hireLeadDay }),
      ...draftStanding(draft, maker, {
        reasonShown: () =>
          fields.every(seen) &&
          (seesPeople ||
            !draftHoldsNotStarted(
              teamToday,
              drafted(teamToday, draft),
              everyone,
            )),
      }),
      changedBy: fieldEditorsOf(maker, changed),
    },
  };
}

// A team's lead record: whom it names, a person or a planned hire, or null for no lead, and that
// lead again when a person.
export interface LeadRecord {
  leadId: string | null;
  personId: string | null;
  fromDate: string;
}

// When the lead in force took over: the day its run of records naming it began, so a repeated
// record keeps the first day, and whether it took over from a person.
export interface LeadRun {
  from: string;
  afterPerson: boolean;
}

// The lead's run, from a team's lead records, earliest first, ending with the one in force.
export function leadRunOf(
  records: readonly LeadRecord[],
  inForce: LeadRecord,
): LeadRun {
  let first = inForce;
  let previous: LeadRecord | undefined;
  for (const record of records.slice(0, records.indexOf(inForce)).reverse()) {
    if (record.leadId !== inForce.leadId) {
      previous = record;
      break;
    }
    first = record;
  }
  return {
    from: first.fromDate,
    afterPerson: (previous?.personId ?? null) !== null,
  };
}

// The day a planned hire leading a team started to, as a reader sees it: General, as a planned
// hire's days are, unless it took over from a person, when it is also the day the person stopped
// leading, a Feature team date.
export const hireLeadDaySeen = (
  run: LeadRun | undefined,
  seesDays: boolean,
): string | undefined =>
  run !== undefined && (seesDays || !run.afterPerson) ? run.from : undefined;

// Who sees those who fill planned hires, judged as anyone on a team is.
export type FillerSight = Pick<
  TeamSight,
  "everyone" | "seesPeople" | "seesTier" | "shown"
>;

// A planned hire as a team's details name it, as People does: by its name, or by its position and
// ID, the position only for a reader who sees the Positions list's class. Who fills it, someone not
// yet started while the hire is on a team, reveals a reporting line to come, so is named only to a
// reader who sees Personal details, with the day they start; to anyone else the hire shows as not
// yet filled, as its placeholder does.
export function hireOnTeamSeen(
  hire: PlannedHire,
  { keyNumber, positionTier }: { keyNumber: number; positionTier: Tier },
  { everyone, seesPeople, seesTier, shown }: FillerSight,
): { name: string; hire: TeamHire } {
  const filler =
    seesPeople && hire.filledBy !== null && shown(hire.filledBy)
      ? everyone.get(hire.filledBy)
      : undefined;
  const starts = filler?.kind === "person" ? text(filler.startDate) : null;
  return {
    name: hireCalled(
      hire.name,
      hire.shownId,
      seesTier(positionTier) ? hire.position : undefined,
    ),
    hire: {
      keyNumber,
      ...(hire.name === null ? { shownId: hire.shownId } : {}),
      expected: monthOf(hire.firstDay),
      ...(hire.dated ? {} : { undated: true as const }),
      ...(filler === undefined
        ? {}
        : {
            filledBy: {
              name: filler.preferredName,
              ...(starts === null ? {} : { starts }),
            },
          }),
    },
  };
}

// Whether a reader is shown hires filled by people yet to start, which tells them something of
// their start dates, while start dates are above General: a view of Personal details the access
// history records, whichever page shows them.
export const showsFillsAbovePersonal = (
  access: ClassAccess,
  fills: readonly (TeamHire | OrgChartPerson)[],
): boolean => access.dataClasses.startDate !== "general" && fills.length > 0;

// Whether a reader is told who fills a hire on a team, a view of Personal details as any fill shown
// is.
export const namesFillerAbovePersonal = (
  access: ClassAccess,
  teams: readonly FeatureTeam[],
): boolean =>
  showsFillsAbovePersonal(
    access,
    teams.flatMap(({ hires }) =>
      Object.values(hires ?? {}).filter(
        ({ filledBy }) => filledBy !== undefined,
      ),
    ),
  );
