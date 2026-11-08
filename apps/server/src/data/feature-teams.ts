// SPDX-License-Identifier: Apache-2.0

// Feature teams, as part of the data access layer: the people working on a set of related features,
// apart from reporting lines, as the Decisions Log sets out, seen by everyone who sees the org chart
// and changed there. A team's name, lead, and members are General; the day each member joined or
// left is Restricted, as reporting lines' dates are, and so are members who have not started, whom
// readers who do not see Restricted details never see. Drafts are details of people, so those who
// do not see people see only approved teams. Someone whose end date has passed is off every team
// from the next day, so a team shows no lead they led until another is chosen, and no draft is held
// up by them; their past records stay. Every change to a team is a draft, its name, lead, and member
// changes making one draft, approved or rejected together; approving one turns its member and lead
// changes into records from a date, which may be planned ahead. Teams can be read as of a chosen day,
// and a team disbands from the first month with no members from then on. A team's colour is how the
// chart is drawn, not a detail of anyone, so it changes at once.

import {
  type Database,
  drafts,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
  inChunks,
  people,
} from "@fathom/db";
import {
  byName,
  disbandedMonth,
  type FeatureTeam,
  type FeatureTeamChange,
  type FeatureTeamDraft,
  type FeatureTeamRequest,
  type FeatureTeams,
  isFirstOfMonth,
  knownColour,
  type PaletteColour,
  type Tier,
} from "@fathom/shared";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  requireAnyPermission,
  requirePermission,
  seesRestrictedDetails,
} from "../access.ts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  stableJson,
  type Transaction,
} from "./changes.ts";
import {
  asDraft,
  clearedRejection,
  type Draft,
  drafted,
  draftFields,
  draftMakers,
  draftTier,
  type Held,
  lockDrafts,
  otherApprover,
  readDrafts,
  readHeld,
  type Recorded,
  refuseHeld,
  refuseHeldDecision,
  refuseRejected,
  rejectedField,
  setRejection,
  tidy,
  writeDraft,
} from "./drafts.ts";
import { recordEvents } from "./history.ts";
import { bySubject, inForceOn, inForceOrLater } from "./in-force.ts";
import { currentOn, notStarted } from "./people.ts";
import { recordNaming } from "./records.ts";
import { readToday } from "./settings.ts";

type Reader = Pick<Database, "select">;

const recordType = "feature-team";
const noTeam = "There is no such feature team";
const nameTaken = "Another feature team already has that name";
const chooseFromPeople = "Choose members from People";

// A team's fields as drafts and the change history hold them: its name, lead, members, by person,
// sorted, the days the members a draft adds or removes join or leave, by person, when given, and
// the day a draft's change of lead takes effect, under the new lead, or the old one if none
// replaces them, when given.
export const featureTeamFields = [
  "name",
  "leadId",
  "members",
  "memberFrom",
  "leadFrom",
] as const;

// The days members join and leave and leads change are Restricted, as reporting lines' are; the
// rest is General.
export const featureTeamTier = (field: string): Tier =>
  field === "memberFrom" || field === "leadFrom" ? "restricted" : "general";

// Everyone who sees the org chart sees a team's General details, whether or not they see people.
const seesTeamField = (actor: Actor) => (field: string) =>
  featureTeamTier(field) === "general" || seesRestrictedDetails(actor);

const textOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const membersOf = (team: Recorded | undefined): string[] =>
  Array.isArray(team?.members) ? team.members.map(String) : [];

const daysIn = (value: unknown): Record<string, string> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, string>)
    : {};

const datesOf = (team: Recorded | undefined): Record<string, string> =>
  daysIn(team?.memberFrom);

const leadDatesOf = (team: Recorded | undefined): Record<string, string> =>
  daysIn(team?.leadFrom);

export function teamChanges(
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change[] {
  return changesBetween(
    recordType,
    id,
    action,
    before,
    after,
    featureTeamFields,
    featureTeamTier,
  );
}

// Those who propose or edit feature teams change them, seeing the org chart they are on and the
// people in the drafts they are sent.
function requireChanging(actor: Actor): void {
  requirePermission(actor, "org-chart:view");
  requirePermission(actor, "people:view");
  requireAnyPermission(actor, ["feature-teams:propose", "feature-teams:edit"]);
}

interface LiveTeams {
  // Each team as recorded: its name, lead, and members on the day asked for.
  teams: Map<string, Recorded>;
  colours: Map<string, string | null>;
}

// The live teams given, or every team, with their members and lead as of a day, leaving out those
// who have left by the day their employment is judged on, which is that same day unless a reader
// may not learn employment dates from it. A lead who is not a member on the day is no lead.
export async function readLiveTeams(
  reader: Reader,
  day: string,
  {
    ids,
    employmentDay = day,
  }: { ids?: readonly string[]; employmentDay?: string } = {},
): Promise<LiveTeams> {
  const rows: (typeof featureTeams.$inferSelect)[] = [];
  const memberships: (typeof featureTeamMemberships.$inferSelect)[] = [];
  const leadRecords: (typeof featureTeamLeads.$inferSelect)[] = [];
  const read = async (chunk?: readonly string[]) => {
    leadRecords.push(
      ...(await reader
        .select()
        .from(featureTeamLeads)
        .where(
          and(
            chunk === undefined
              ? undefined
              : inArray(featureTeamLeads.teamId, [...chunk]),
            sql`${featureTeamLeads.fromDate} <= ${day}`,
          ),
        )),
    );
    rows.push(
      ...(await reader
        .select()
        .from(featureTeams)
        .where(
          chunk === undefined
            ? undefined
            : inArray(featureTeams.id, [...chunk]),
        )),
    );
    memberships.push(
      ...(await reader
        .select()
        .from(featureTeamMemberships)
        .where(
          and(
            chunk === undefined
              ? undefined
              : inArray(featureTeamMemberships.teamId, [...chunk]),
            sql`${featureTeamMemberships.fromDate} <= ${day}`,
          ),
        )
        .orderBy(asc(featureTeamMemberships.fromDate))),
    );
  };
  if (ids === undefined) await read();
  else for (const chunk of inChunks([...ids])) await read(chunk);
  // Each person's latest record for a team, as of the day, says whether they are on it.
  const latest = new Map<string, Map<string, boolean>>();
  for (const { teamId, personId, member } of memberships) {
    const team = latest.get(teamId) ?? new Map<string, boolean>();
    team.set(personId, member);
    latest.set(teamId, team);
  }
  const leads = bySubject(leadRecords, ({ teamId }) => teamId);
  const everyone = await peopleOf(
    reader,
    [
      ...memberships.map(({ personId }) => personId),
      ...leadRecords.flatMap(({ leadId }) => leadId ?? []),
    ],
    employmentDay,
  );
  const teams = new Map<string, Recorded>();
  for (const row of rows) {
    const onTeam = [...(latest.get(row.id) ?? new Map<string, boolean>())]
      .filter(([, member]) => member)
      .map(([personId]) => personId);
    const leadId = inForceOn(leads.get(row.id) ?? [], day)?.leadId ?? null;
    teams.set(
      row.id,
      withoutLeavers(
        {
          name: row.name,
          leadId: leadId !== null && onTeam.includes(leadId) ? leadId : null,
          members: onTeam.sort(),
        },
        everyone,
      ),
    );
  }
  return {
    teams,
    colours: new Map(rows.map(({ id, colour }) => [id, colour])),
  };
}

export const readTeamDrafts = (
  reader: Reader,
  ids?: readonly string[],
  viewer?: string,
) => readDrafts(reader, recordType, ids, viewer);

// Whether someone's end date has passed by a day.
const leftBy = (person: Recorded, day: string): boolean =>
  !notStarted(person, day) && !currentOn(person, day);

type Person = Recorded & {
  preferredName: string;
  started: boolean;
  left: boolean;
};

type Everyone = ReadonlyMap<string, Person>;

// The people given who are live, with whether each has started and left as of a day.
async function peopleOf(
  reader: Reader,
  ids: readonly string[],
  day: string,
): Promise<Map<string, Person>> {
  const found = new Map<string, Person>();
  for (const chunk of inChunks([...new Set(ids)])) {
    for (const person of await reader
      .select({
        id: people.id,
        preferredName: people.preferredName,
        startDate: people.startDate,
        endDate: people.endDate,
      })
      .from(people)
      .where(inArray(people.id, chunk))) {
      found.set(person.id, {
        preferredName: person.preferredName,
        startDate: person.startDate,
        endDate: person.endDate,
        started: !notStarted(person, day),
        left: leftBy(person, day),
      });
    }
  }
  return found;
}

// A team without those who have left, whether as members, as its lead, or as members given a day.
function withoutLeavers(team: Recorded, everyone: Everyone): Recorded {
  const gone = (id: unknown) =>
    typeof id === "string" && everyone.get(id)?.left === true;
  const days = Object.entries(datesOf(team)).filter(([id]) => !gone(id));
  const leadDays = Object.entries(leadDatesOf(team)).filter(
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

// Those a draft changes something about: the members it adds or removes, and its lead, old and new,
// when it changes the lead.
function peopleDraftChanges(
  before: Recorded | undefined,
  draft: Draft,
): string[] {
  const after = drafted(before, draft);
  const was = membersOf(before);
  const will = membersOf(after);
  return [
    ...was.filter((one) => !will.includes(one)),
    ...will.filter((one) => !was.includes(one)),
    ...(before?.leadId === after?.leadId
      ? []
      : [textOrNull(before?.leadId), textOrNull(after?.leadId)].filter(
          (one) => one !== null,
        )),
  ];
}

// Whether a draft changes anything about someone who has not started.
const draftHoldsNotStarted = (
  before: Recorded | undefined,
  draft: Draft,
  everyone: Everyone,
): boolean =>
  peopleDraftChanges(before, draft).some(
    (one) => everyone.get(one)?.started === false,
  );

// Everyone a team and its draft name.
const peopleNamed = (team: Recorded | undefined): string[] => [
  ...membersOf(team),
  ...Object.keys(datesOf(team)),
  ...Object.keys(leadDatesOf(team)),
  ...[team?.leadId].flatMap((id) => (typeof id === "string" ? [id] : [])),
];

// Whether a reader sees someone on a team: never once they have left, and, before they have started,
// only with Restricted details.
const seenBy =
  (everyone: Everyone, restricted: boolean) =>
  (personId: unknown): personId is string => {
    const person =
      typeof personId === "string" ? everyone.get(personId) : undefined;
    return person?.left === false && (restricted || person.started);
  };

// The month each team disbands from, as the reader may know it. Those who do not see Restricted
// details are told nothing that depends on someone hidden from them, or on anyone's end date: only
// people who are current today count, and only by when they join and leave.
async function readDisbandedMonths(
  reader: Reader,
  restricted: boolean,
  today: string,
): Promise<Map<string, string>> {
  const records = await reader
    .select({
      teamId: featureTeamMemberships.teamId,
      personId: featureTeamMemberships.personId,
      member: featureTeamMemberships.member,
      fromDate: featureTeamMemberships.fromDate,
      startDate: people.startDate,
      endDate: people.endDate,
    })
    .from(featureTeamMemberships)
    .innerJoin(people, eq(people.id, featureTeamMemberships.personId));
  const countable = restricted
    ? records
    : records
        .filter((record) => currentOn(record, today))
        .map((record) => ({ ...record, endDate: null }));
  const disbanded = new Map<string, string>();
  for (const [teamId, rows] of bySubject(countable, ({ teamId }) => teamId)) {
    const month = disbandedMonth([
      ...bySubject(rows, ({ personId }) => personId).values(),
    ]);
    if (month !== undefined) disbanded.set(teamId, month);
  }
  return disbanded;
}

// Every feature team, as the reader's drafts make it, with its draft beside, for those who see the
// org chart. Members and a lead who have not started are left out for readers who do not see
// Restricted details, and those who have left for everyone. Those who do not see people get teams
// as approved, with no drafts.
export async function readFeatureTeams(
  database: Database,
  actor: Actor,
  asOf?: string,
): Promise<FeatureTeams> {
  requirePermission(actor, "org-chart:view");
  const today = asOf ?? (await readToday(database));
  const restricted = seesRestrictedDetails(actor);
  const seesDrafts = actor.permissions.includes("people:view");
  return database.transaction(
    async (transaction) => {
      const live = await readLiveTeams(transaction, today);
      const draftsNow = seesDrafts
        ? await readTeamDrafts(transaction, undefined, actor.user.id)
        : new Map<string, Draft>();
      const held = seesDrafts
        ? await readHeld(transaction, recordType, actor.user.id)
        : new Map<string, Held>();
      const seen = seesTeamField(actor);
      const makers = await draftMakers(
        transaction,
        recordType,
        [...draftsNow.keys()],
        seen,
        actor,
      );
      const ids = [
        ...live.teams.keys(),
        ...[...draftsNow.keys()].filter((id) => !live.teams.has(id)),
      ];
      const versions = ids.map((id) => {
        const before = live.teams.get(id);
        const draft = draftsNow.get(id);
        return {
          id,
          before,
          draft,
          team: (drafted(before, draft) ?? before) as Recorded,
        };
      });
      const everyone = await peopleOf(
        transaction,
        versions.flatMap(({ team, before }) => [
          ...peopleNamed(team),
          ...peopleNamed(before),
        ]),
        today,
      );
      const shown = seenBy(everyone, restricted);
      const disbanded = await readDisbandedMonths(
        transaction,
        restricted,
        today,
      );
      // The names of those on a team, as drafted or live, whom the reader sees.
      const namesOn = (team: Recorded, before: Recorded | undefined) => {
        const named = new Set([...peopleNamed(team), ...peopleNamed(before)]);
        return Object.fromEntries(
          [...everyone]
            .filter(([personId]) => named.has(personId) && shown(personId))
            .map(([personId, { preferredName }]) => [personId, preferredName]),
        );
      };
      // Who of a team's members, or its lead, the reader sees.
      const seenIn = (field: string, team: Recorded | undefined) =>
        field === "members"
          ? membersOf(team).filter(shown).sort()
          : [team?.leadId].filter(shown);
      const teams = versions.map(
        ({ id, before, draft, team }): FeatureTeam => ({
          id,
          name: String(team.name),
          leadId: shown(team.leadId) ? team.leadId : null,
          colour: knownColour(live.colours.get(id)),
          members: membersOf(team).filter(shown),
          names: namesOn(team, before),
          ...(disbanded.has(id) ? { disbandedFrom: disbanded.get(id) } : {}),
          ...shownDraft(id, before, draft, team),
          ...(held.has(id) ? { heldBy: held.get(id)?.holder } : {}),
        }),
      );
      teams.sort(byName);
      return { teams };

      // A team's draft as the reader sees it, or none when it changes nothing they may see.
      function shownDraft(
        id: string,
        before: Recorded | undefined,
        draft: Draft | undefined,
        team: Recorded,
      ): { draft?: FeatureTeamDraft } {
        if (draft === undefined) return {};
        const after = drafted(before, draft);
        const changesWhoIsSeen = (field: string) =>
          !["members", "leadId"].includes(field) ||
          stableJson(seenIn(field, before)) !==
            stableJson(seenIn(field, after));
        const shownDays = (held: Record<string, string>) =>
          restricted
            ? Object.entries(held).filter(([personId]) => shown(personId))
            : [];
        const days = shownDays(datesOf(team));
        const leadDay = shownDays(leadDatesOf(team))[0]?.[1];
        const fields = draftFields(before, draft);
        const changed = fields.filter(
          (field) =>
            seen(field) &&
            changesWhoIsSeen(field) &&
            (field !== "memberFrom" || days.length > 0) &&
            (field !== "leadFrom" || leadDay !== undefined),
        );
        // Nothing left to show those who see Restricted details means only people who have left
        // remain in the draft, so it stays listed for them to clear. For others it may hide someone
        // who has not started.
        if (changed.length === 0 && !restricted) return {};
        const maker = makers.get(id);
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
                      ? {
                          leadId: shown(before.leadId) ? before.leadId : null,
                        }
                      : {}),
                    ...(changed.includes("members")
                      ? { members: membersOf(before).filter(shown) }
                      : {}),
                  },
            ...(days.length === 0 ? {} : { days: Object.fromEntries(days) }),
            ...(leadDay === undefined ? {} : { leadDay }),
            state: draft.state,
            ...(draft.state === "rejected" &&
            draft.reason !== null &&
            fields.every(seen) &&
            (restricted || !draftHoldsNotStarted(before, draft, everyone))
              ? { reason: draft.reason }
              : {}),
            ...(draft.unpublished === true ? { unpublished: true } : {}),
            madeBy: maker?.madeBy ?? null,
            madeAs: maker?.madeAs ?? null,
            madeAt: maker?.madeAt.toISOString() ?? null,
            editors: maker?.editors ?? [],
            ...otherApprover(maker),
            changedBy: Object.fromEntries(
              changed.map((field) => [
                field,
                maker?.fieldEditors.get(field) ?? null,
              ]),
            ),
          },
        };
      }
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// The teams with members on a day, as approved, without drafts, for those who see the org chart.
// Readers who do not see Restricted details ask only for the first day of a month, so no exact day
// anyone joined or left can be worked out, and whether someone has started or left is judged today
// for them, so that no date reveals who has yet to start or an end date still to come.
export async function readFeatureTeamsOn(
  database: Database,
  actor: Actor,
  day: string,
): Promise<FeatureTeams> {
  requirePermission(actor, "org-chart:view");
  const restricted = seesRestrictedDetails(actor);
  if (!restricted && !isFirstOfMonth(day)) {
    throw new BadRequestError("Choose the first day of a month");
  }
  const today = await readToday(database);
  const employmentDay = restricted ? day : today;
  return database.transaction(
    async (transaction) => {
      const live = await readLiveTeams(transaction, day, { employmentDay });
      const everyone = await peopleOf(
        transaction,
        [...live.teams.values()].flatMap(peopleNamed),
        employmentDay,
      );
      const shown = seenBy(everyone, restricted);
      const disbanded = await readDisbandedMonths(
        transaction,
        restricted,
        today,
      );
      const teams = [...live.teams].flatMap(([id, team]): FeatureTeam[] => {
        const members = membersOf(team).filter(shown);
        if (members.length === 0) return [];
        const leadId = shown(team.leadId) ? team.leadId : null;
        return [
          {
            id,
            name: String(team.name),
            leadId,
            colour: knownColour(live.colours.get(id)),
            members,
            names: Object.fromEntries(
              members.map((personId) => [
                personId,
                String(everyone.get(personId)?.preferredName),
              ]),
            ),
            ...(disbanded.has(id) ? { disbandedFrom: disbanded.get(id) } : {}),
          },
        ];
      });
      return { teams: teams.sort(byName) };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Every team's name, live or in a draft, published or not, with its team.
async function readTeamNames(
  transaction: Transaction,
): Promise<[string, string][]> {
  const live = await transaction
    .select({ id: featureTeams.id, name: featureTeams.name })
    .from(featureTeams);
  return [
    ...live.map(({ id, name }): [string, string] => [id, name]),
    ...[...(await readTeamDrafts(transaction))].map(
      ([id, draft]): [string, unknown] => [id, draft.fields.name],
    ),
    ...[...(await readHeld(transaction, recordType, undefined))].map(
      ([id, { draft }]): [string, unknown] => [id, draft.fields.name],
    ),
  ].filter((named): named is [string, string] => typeof named[1] === "string");
}

// Whether another team has a name, ignoring letter case.
function nameIsTaken(
  names: readonly [string, string][],
  name: string,
  except: string,
): boolean {
  const lowered = name.trim().toLowerCase();
  return names.some(
    ([id, other]) => id !== except && other.trim().toLowerCase() === lowered,
  );
}

async function refuseTakenName(
  transaction: Transaction,
  name: string,
  except: string,
): Promise<void> {
  if (nameIsTaken(await readTeamNames(transaction), name, except)) {
    throw new ConflictError(nameTaken);
  }
}

// What is wrong with the members and lead a team is to have: members added who are not live people,
// or who have left, or whom the actor may not see, as People hides them, or a lead who is not one of
// the members; undefined when nothing is.
function membersRefusal(
  actor: Actor,
  added: readonly string[],
  members: readonly string[],
  leadId: unknown,
  everyone: Everyone,
): string | undefined {
  const restricted = seesRestrictedDetails(actor);
  for (const personId of added) {
    const person = everyone.get(personId);
    if (person === undefined || (!restricted && !person.started)) {
      return chooseFromPeople;
    }
    if (person.left) return "Someone who has left can't join a team";
  }
  return typeof leadId === "string" && !members.includes(leadId)
    ? "The feature lead must be one of the members"
    : undefined;
}

function checkMembers(
  actor: Actor,
  added: readonly string[],
  members: readonly string[],
  leadId: unknown,
  everyone: Everyone,
): void {
  const refusal = membersRefusal(actor, added, members, leadId, everyone);
  if (refusal !== undefined) throw new BadRequestError(refusal);
}

// The day members join or leave from: today or later, an earlier day needing the right to change
// Restricted details. Those who do not see Restricted details plan by whole months, so that a day
// they try can tell them no more than a month.
function fromDay(actor: Actor, from: string | undefined, today: string) {
  if (from === undefined || from === today) return undefined;
  if (from < today && !actor.permissions.includes("restricted:edit")) {
    throw new ForbiddenError(
      "Your role can't choose an earlier day, so use today or a later day",
    );
  }
  if (from > today && !seesRestrictedDetails(actor) && !isFirstOfMonth(from)) {
    throw new BadRequestError("Choose the first day of a month");
  }
  return from;
}

interface MemberDay {
  teamId: string;
  personId: string;
  from: string;
}

type DayRefusal = (day: MemberDay) => string;
type OrderRefusal = (day: MemberDay, last: string) => string;

interface DayRefusals {
  outOfOrder: OrderRefusal;
  beforeStart: DayRefusal;
  afterEnd: DayRefusal;
}

// The exact day is Restricted, so only those who see it are told it.
const refusalsWhenDrafting = (seesDays: boolean): DayRefusals => ({
  outOfOrder: (_, last) =>
    seesDays
      ? `This person last joined or left this team on ${last}. Choose a later date.`
      : "This person joined or left this team on that date or later. Choose a later date.",
  beforeStart: () =>
    "Someone can't join or leave a team before their start date",
  afterEnd: () => "Someone can't join or leave a team after their end date",
});

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

// Refuses a day for a change of a team's lead unless it is after the team's latest such change.
async function refuseLeadDayOutOfOrder(
  reader: Reader,
  teamId: string,
  from: string,
  seesDays: boolean,
): Promise<void> {
  const records = await reader
    .select({ fromDate: featureTeamLeads.fromDate })
    .from(featureTeamLeads)
    .where(eq(featureTeamLeads.teamId, teamId));
  const last = records
    .map(({ fromDate }) => fromDate)
    .sort()
    .at(-1);
  if (last !== undefined && from <= last) {
    throw new BadRequestError(
      seesDays
        ? `This team's lead last changed on ${last}. Choose a later date.`
        : "This team's lead changed on that date or later. Choose a later date.",
    );
  }
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
    )
    .orderBy(asc(featureTeamMemberships.fromDate));
  const onTeam =
    joinsOn === undefined
      ? inForceOn(records, from)?.member === true
      : joinsOn <= from;
  if (!onTeam) {
    throw new BadRequestError("Choose a day when the new lead is on this team");
  }
}

// Refuses a day outside someone's employment.
function refuseOutsideEmployment(
  day: MemberDay,
  everyone: Everyone,
  refusals: DayRefusals,
): void {
  const person = { ...everyone.get(day.personId) };
  if (notStarted(person, day.from)) {
    throw new BadRequestError(refusals.beforeStart(day));
  }
  if (leftBy(person, day.from)) {
    throw new BadRequestError(refusals.afterEnd(day));
  }
}

// Refuses days that would never take effect: each must be after the person's latest record on that
// team, and, when the employment dates may be used, between their start and end dates. A proposer
// who does not see those dates is not told of them here; the Approver who does is, on approving.
async function refuseDaysOutOfOrder(
  reader: Reader,
  days: readonly MemberDay[],
  everyone: Everyone,
  refusals: DayRefusals,
  usesEmployment: boolean,
): Promise<void> {
  const latest = new Map<string, string>();
  const key = (teamId: string, personId: string) => `${teamId} ${personId}`;
  for (const chunk of inChunks([...new Set(days.map((day) => day.teamId))])) {
    for (const { teamId, personId, fromDate } of await reader
      .select({
        teamId: featureTeamMemberships.teamId,
        personId: featureTeamMemberships.personId,
        fromDate: featureTeamMemberships.fromDate,
      })
      .from(featureTeamMemberships)
      .where(inArray(featureTeamMemberships.teamId, chunk))
      .orderBy(asc(featureTeamMemberships.fromDate))) {
      latest.set(key(teamId, personId), fromDate);
    }
  }
  for (const day of days) {
    const { teamId, personId, from } = day;
    const last = latest.get(key(teamId, personId));
    if (last !== undefined && from <= last) {
      throw new BadRequestError(refusals.outOfOrder(day, last));
    }
    if (usesEmployment) refuseOutsideEmployment(day, everyone, refusals);
  }
}

// Records, in the access history, the people whose Restricted joining or leaving days changed.
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
      action: "restricted-changed" as const,
      subjectId,
    })),
  );
}

async function saved(
  transaction: Transaction,
  actor: Actor,
  made: Change[],
  kind?: "discard" | "resubmission",
): Promise<string | null> {
  await recordTeamDayChanges(transaction, actor.user.id, made);
  return recordChanges(transaction, actor, made, kind);
}

// Drafts adding a feature team, with its members and lead.
export async function createFeatureTeam(
  database: Database,
  actor: Actor,
  request: FeatureTeamRequest,
  asOf?: string,
): Promise<{ id: string; changeSetId: string | null }> {
  requireChanging(actor);
  const today = asOf ?? (await readToday(database));
  const from = fromDay(actor, request.from, today);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const id = randomUUID();
    await refuseTakenName(transaction, request.name, id);
    // A lead who is not among the members asked for joins the team with them.
    const members = [
      ...new Set([
        ...request.members,
        ...(request.leadId === null ? [] : [request.leadId]),
      ]),
    ].sort();
    const everyone = await peopleOf(transaction, members, today);
    checkMembers(actor, members, members, request.leadId, everyone);
    if (from !== undefined) {
      await refuseDaysOutOfOrder(
        transaction,
        members.map((personId) => ({ teamId: id, personId, from })),
        everyone,
        refusalsWhenDrafting(seesRestrictedDetails(actor)),
        seesRestrictedDetails(actor),
      );
    }
    // A team added with no members records none, rather than an empty list.
    const after = tidy({
      name: request.name,
      leadId: request.leadId,
      ...(from === undefined || request.leadId === null
        ? {}
        : { leadFrom: { [request.leadId]: from } }),
      ...(members.length === 0 ? {} : { members }),
      ...(from === undefined || members.length === 0
        ? {}
        : {
            memberFrom: Object.fromEntries(members.map((one) => [one, from])),
          }),
    });
    await writeDraft(
      transaction,
      actor.user.id,
      recordType,
      id,
      undefined,
      after,
    );
    return {
      id,
      changeSetId: await saved(
        transaction,
        actor,
        asDraft(teamChanges(id, "created", undefined, after)),
      ),
    };
  });
}

// A team as it is and as the actor's draft makes it, without anyone who has left, once the drafts
// lock is held, refusing one that is neither live nor in a draft the actor sees, or that someone
// else is changing.
async function draftedTeam(
  transaction: Transaction,
  actor: Actor,
  id: string,
  today: string,
) {
  const before = (
    await readLiveTeams(transaction, today, { ids: [id] })
  ).teams.get(id);
  const draft = (await readTeamDrafts(transaction, [id], actor.user.id)).get(
    id,
  );
  if (before === undefined && draft === undefined) {
    throw new NotFoundError(noTeam);
  }
  await refuseHeld(transaction, actor.user.id, recordType, [id]);
  const team = drafted(before, draft);
  return {
    before,
    draft,
    team:
      team &&
      withoutLeavers(
        team,
        await peopleOf(transaction, peopleNamed(team), today),
      ),
  };
}

// The rejection cleared by changing or sending again a draft, as sensitive as what it was made on: a
// draft changing someone who has not started is seen as Restricted.
async function clearedTeamRejection(
  transaction: Transaction,
  id: string,
  before: Recorded | undefined,
  draft: Draft | undefined,
  today: string,
): Promise<Change[]> {
  if (draft?.state !== "rejected") return [];
  const holdsNotStarted = draftHoldsNotStarted(
    before,
    draft,
    await peopleOf(transaction, peopleDraftChanges(before, draft), today),
  );
  return clearedRejection(
    id,
    holdsNotStarted ? () => "restricted" : featureTeamTier,
    before,
    draft,
    recordType,
  );
}

// Drafts a change to a feature team: its name, lead, or members, who join or leave from the day
// given, or from today. Renaming one needs the right to edit feature teams, not only to propose.
export async function updateFeatureTeam(
  database: Database,
  actor: Actor,
  id: string,
  change: FeatureTeamChange,
  asOf?: string,
): Promise<string | null> {
  requireChanging(actor);
  if (change.name !== undefined) requirePermission(actor, "feature-teams:edit");
  const today = asOf ?? (await readToday(database));
  const from = fromDay(actor, change.from, today);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { before, draft, team } = await draftedTeam(
      transaction,
      actor,
      id,
      today,
    );
    if (team === undefined) {
      throw new ConflictError(
        "This feature team's draft removes it; discard the draft to change it",
      );
    }
    if (change.name !== undefined) {
      await refuseTakenName(transaction, change.name, id);
    }
    const current = membersOf(team);
    // A lead chosen from outside the team joins it, so the lead is always a member.
    const asked = [
      ...(change.add ?? []),
      ...(typeof change.leadId === "string" ? [change.leadId] : []),
    ];
    const added = [...new Set(asked)].filter((one) => !current.includes(one));
    const removed = (change.remove ?? []).filter((one) =>
      current.includes(one),
    );
    const members = [
      ...current.filter((one) => !removed.includes(one)),
      ...added,
    ].sort();
    // A lead who leaves the team leaves it with no lead, unless another is chosen.
    const leadId =
      change.leadId !== undefined
        ? change.leadId
        : removed.includes(String(team.leadId))
          ? null
          : textOrNull(team.leadId);
    const everyone = await peopleOf(
      transaction,
      [...added, ...removed, ...(leadId === null ? [] : [leadId])],
      today,
    );
    checkMembers(actor, added, members, leadId, everyone);
    // A day is kept for each member a draft adds or removes, so approving it records when; a change
    // taken back leaves none.
    const days = { ...datesOf(team) };
    if (from !== undefined) {
      // Each is a person the change names.
      // eslint-disable-next-line security/detect-object-injection
      for (const personId of [...added, ...removed]) days[personId] = from;
    }
    const dates = new Map(
      Object.entries(days).filter(
        ([personId]) =>
          members.includes(personId) !== membersOf(before).includes(personId),
      ),
    );
    // A change of lead keeps its own day, set only by the edit that changes the lead, and held
    // under the new lead, or the old one when none replaces them.
    const wasLead = textOrNull(before?.leadId);
    const setsLead =
      change.leadId !== undefined || leadId !== textOrNull(team.leadId);
    const leadChanges = setsLead && leadId !== wasLead;
    const [keptLeadDay] = Object.values(leadDatesOf(team));
    const leadDay = setsLead ? from : keptLeadDay;
    const usesEmployment = seesRestrictedDetails(actor);
    // Someone hidden from the actor gets the same answer whatever day is tried, so no day can tell
    // them about that person's records.
    if (
      from !== undefined &&
      !usesEmployment &&
      [...removed, ...(leadChanges && leadId !== null ? [leadId] : [])].some(
        (one) => everyone.get(one)?.started === false,
      )
    ) {
      throw new BadRequestError(chooseFromPeople);
    }
    if (from !== undefined) {
      await refuseDaysOutOfOrder(
        transaction,
        [...added, ...removed]
          .filter((personId) => dates.has(personId))
          .map((personId) => ({ teamId: id, personId, from })),
        everyone,
        refusalsWhenDrafting(usesEmployment),
        usesEmployment,
      );
      if (leadChanges) {
        await refuseLeadDayOutOfOrder(transaction, id, from, usesEmployment);
      }
    }
    if (leadChanges && leadId !== null) {
      const joinsInDraft = !membersOf(before).includes(leadId);
      await refuseLeadOffTeam(
        transaction,
        id,
        leadId,
        from ?? today,
        joinsInDraft ? (dates.get(leadId) ?? today) : undefined,
      );
      if (from !== undefined && usesEmployment) {
        refuseOutsideEmployment(
          { teamId: id, personId: leadId, from },
          everyone,
          refusalsWhenDrafting(usesEmployment),
        );
      }
    }
    const after = tidy({
      name: change.name ?? team.name,
      leadId,
      members,
      ...(dates.size === 0 ? {} : { memberFrom: Object.fromEntries(dates) }),
      ...(leadId === wasLead || leadDay === undefined
        ? {}
        : { leadFrom: { [String(leadId ?? wasLead)]: leadDay } }),
    });
    const made = teamChanges(id, "changed", team, after);
    if (made.length === 0) return null;
    const cleared = await clearedTeamRejection(
      transaction,
      id,
      before,
      draft,
      today,
    );
    await writeDraft(transaction, actor.user.id, recordType, id, before, after);
    return saved(transaction, actor, [...asDraft(made), ...cleared]);
  });
}

// Drafts removing a feature team, which needs the right to edit them; removing one only drafted to
// be added discards that draft.
export async function deleteFeatureTeam(
  database: Database,
  actor: Actor,
  id: string,
  asOf?: string,
): Promise<string | null> {
  requireChanging(actor);
  requirePermission(actor, "feature-teams:edit");
  const today = asOf ?? (await readToday(database));
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { before, draft, team } = await draftedTeam(
      transaction,
      actor,
      id,
      today,
    );
    if (team === undefined) return null;
    await refuseRemovingNamedTeams(transaction, [id]);
    const cleared = await clearedTeamRejection(
      transaction,
      id,
      before,
      draft,
      today,
    );
    await writeDraft(
      transaction,
      actor.user.id,
      recordType,
      id,
      before,
      undefined,
    );
    return saved(
      transaction,
      actor,
      [...asDraft(teamChanges(id, "deleted", team, undefined)), ...cleared],
      before === undefined ? "discard" : undefined,
    );
  });
}

// Discards a team's draft, so it is as it is live, or, for one only drafted to be added, gone.
export async function discardFeatureTeamDraft(
  database: Database,
  actor: Actor,
  id: string,
  asOf?: string,
): Promise<string | null> {
  requireChanging(actor);
  const today = asOf ?? (await readToday(database));
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { before, draft, team } = await draftedTeam(
      transaction,
      actor,
      id,
      today,
    );
    if (draft === undefined) {
      throw new NotFoundError("This feature team has no draft");
    }
    let action: Change["action"] = "changed";
    if (team === undefined) action = "created";
    else if (before === undefined) action = "deleted";
    const cleared = await clearedTeamRejection(
      transaction,
      id,
      before,
      draft,
      today,
    );
    await writeDraft(
      transaction,
      actor.user.id,
      recordType,
      id,
      before,
      before,
    );
    return saved(
      transaction,
      actor,
      [...asDraft(teamChanges(id, action, team, before)), ...cleared],
      "discard",
    );
  });
}

// Sends a rejected draft for approval again, unchanged, clearing its reason.
export async function resubmitFeatureTeamDraft(
  database: Database,
  actor: Actor,
  id: string,
  asOf?: string,
): Promise<string | null> {
  requireChanging(actor);
  const today = asOf ?? (await readToday(database));
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { before, draft, team } = await draftedTeam(
      transaction,
      actor,
      id,
      today,
    );
    if (draft?.state !== "rejected") {
      throw new ConflictError("Only a rejected draft can be resubmitted");
    }
    const fields = draftFields(before, draft);
    // A day before today needs the right to change Restricted details, as choosing one does.
    if (
      [
        ...Object.values(datesOf(team)),
        ...Object.values(leadDatesOf(team)),
      ].some((day) => day < today)
    ) {
      requirePermission(actor, "restricted:edit");
    }
    // Renaming or removing a team needs the right to edit teams, whoever first drafted it.
    if (
      draft.action === "deleted" ||
      (before !== undefined && fields.includes("name"))
    ) {
      requirePermission(actor, "feature-teams:edit");
    }
    const made = await clearedTeamRejection(
      transaction,
      id,
      before,
      draft,
      today,
    );
    await transaction
      .update(drafts)
      .set({ state: "waiting", reason: null })
      .where(and(eq(drafts.recordType, recordType), eq(drafts.recordId, id)));
    return saved(transaction, actor, made, "resubmission");
  });
}

// Sets a team's colour, or removes it, at once, as a manager's team's is.
export async function setFeatureTeamColour(
  database: Database,
  id: string,
  colour: PaletteColour | null,
): Promise<void> {
  const changed = await database
    .update(featureTeams)
    .set({ colour })
    .where(eq(featureTeams.id, id))
    .returning({ id: featureTeams.id });
  if (changed.length === 0) {
    throw new NotFoundError(
      "This feature team is not approved yet, so it cannot have a colour",
    );
  }
}

// Checks the actor may approve or reject the drafts of the teams asked for, and reads them with the
// teams as they are live and everyone they name. A draft holding Restricted days, or changing
// someone who has not started, needs an Approver who sees them.
async function seenTeams(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  today: string,
) {
  requirePermission(actor, "org-chart:view");
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
  const restricted = seesRestrictedDetails(actor);
  for (const [id, draft] of found) {
    const before = live.get(id);
    if (
      !draftFields(before, draft).every(seesTeamField(actor)) ||
      (!restricted && draftHoldsNotStarted(before, draft, everyone))
    ) {
      throw new ForbiddenError(
        "One of these drafts holds details your role does not let you see, so an Approver who sees them must decide it",
      );
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
    made.push(...teamChanges(id, draft.action, before, team));
    if (team === undefined) {
      await transaction.delete(featureTeams).where(eq(featureTeams.id, id));
      continue;
    }
    const members = membersOf(team);
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
    const dates = new Map(Object.entries(datesOf(team)));
    const leadId = textOrNull(team.leadId);
    const wasLead = textOrNull(before?.leadId);
    if (leadId !== wasLead) {
      const [leadDay] = Object.values(leadDatesOf(team));
      leadRecords.push({ teamId: id, leadId, fromDate: leadDay ?? today });
      if (leadId !== null && leadDay !== undefined) {
        leadDays.push({ teamId: id, personId: leadId, from: leadDay });
      }
    }
    const was = membersOf(before);
    for (const [personIds, member] of [
      [members.filter((one) => !was.includes(one)), true],
      [was.filter((one) => !members.includes(one)), false],
    ] as const) {
      for (const personId of personIds) {
        const from = dates.get(personId);
        records.push({
          teamId: id,
          personId,
          member,
          fromDate: from ?? today,
        });
        if (from !== undefined) days.push({ teamId: id, personId, from });
      }
    }
  }
  const refusals = refusalsWhenApproving(teamNames, everyone);
  await refuseDaysOutOfOrder(transaction, days, everyone, refusals, true);
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
        set: { leadId: sql`excluded.lead_id` },
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
    if (draft.state === "rejected" && draft.reason === reason) continue;
    const before = live.get(id);
    const restrictedDetails =
      draftTier(featureTeamTier, before, draft) === "restricted" ||
      draftHoldsNotStarted(before, draft, everyone);
    made.push({
      recordType,
      recordId: id,
      action: "changed",
      field: rejectedField,
      tier: restrictedDetails ? "restricted" : "general",
      oldValue: draft.state === "rejected" ? draft.reason : null,
      newValue: reason,
      draft: true,
    });
  }
  await setRejection(transaction, recordType, ids, {
    state: "rejected",
    reason,
  });
  return made;
}

// Puts back the drafts of the teams a change set changed in their drafts: the team it drafted
// adding taken out, the one it drafted removing put back as it was, and the fields it changed put
// back. A team's name must still be one no other has; a member who has left since is left out, and
// a lead who has left leaves it with no lead. Renaming a team, removing one, or putting back the
// removal of a live team needs the right to edit teams, not only to propose; bringing back a discarded
// draft adding a team needs only the right to propose, as adding one does.
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
      ({ id, action, old }) =>
        (action === "deleted" && live.has(id)) ||
        (action === "changed" && old.has("name")) ||
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
  await refuseRemovingNamedTeams(
    transaction,
    undone
      .filter(({ id, team }) => team === undefined && live.has(id))
      .map(({ id }) => id),
  );
  const names = await readTeamNames(transaction);
  const everyone = await peopleOf(
    transaction,
    undone.flatMap(({ team }) => peopleNamed(team)),
    today,
  );
  for (const { id, team, now } of undone) {
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

// Refuses removing feature teams a record names, live or in a draft, published or not.
async function refuseRemovingNamedTeams(
  reader: Reader,
  ids: readonly string[],
): Promise<void> {
  const naming = await recordNaming(reader, "feature-team", ids);
  if (naming !== undefined) {
    throw new ConflictError(
      `This feature team is named by ${naming}; change that first`,
    );
  }
}

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
