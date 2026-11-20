// SPDX-License-Identifier: Apache-2.0

// Feature teams: reading, drafting and approving teams, their leads and their members, as of a
// chosen day. Part of the data access layer.

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
  type DataClasses,
  disbandedMonth,
  editsField,
  type FeatureTeam,
  type FeatureTeamChange,
  type FeatureTeamRequest,
  type FeatureTeams,
  knownColour,
  mayDateChange,
  type MemberTeamsChange,
  type PaletteColour,
  seesEmployment,
  seesField,
} from "@fathom/shared";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  mostSensitive,
  requireFieldEdit,
  requirePermission,
  requireView,
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
  heldByOf,
  lockDrafts,
  readDrafts,
  readHeld,
  type Recorded,
  refuseHeld,
  refuseHeldDecision,
  refuseRejected,
  rejectedField,
  setRejection,
  tidy,
  unseenDraft,
  writeDraft,
} from "./drafts.ts";
import {
  datesOf,
  type DayRefusal,
  type DayRefusals,
  daysIn,
  daysRefusal,
  draftingRefusals,
  employmentDayRefusal,
  type Everyone,
  leadDatesOf,
  leadDayRefusal,
  leadOffTeamRefusal,
  leftBy,
  memberChanges,
  type MemberDay,
  type MemberRecord,
  membersOf,
  membersRefusal,
  nameIsTaken,
  nextTeamDraft,
  type Person,
} from "./feature-team-rules.ts";
import {
  heldChange,
  heldTeamChange,
  monthRefusals,
} from "./feature-team-held-changes.ts";
import {
  draftAsSeen,
  draftedOn,
  draftHoldsNotStarted,
  draftShownTo,
  featureTeamTier,
  namesSeen,
  peopleAsTodayOn,
  peopleDraftChanges,
  peopleNamed,
  seesTeamField,
  teamSight,
  withoutLeavers,
} from "./feature-team-sight.ts";
import { recordEvents } from "./history.ts";
import { bySubject, inForceOn, inForceOrLater } from "./in-force.ts";
import { noPerson, notStarted } from "./people.ts";
import { keyNumberOf, readKeyNumbers } from "./record-keys.ts";
import { refuseRemovingNamed } from "./records.ts";
import { text } from "./reporting.ts";
import { readToday } from "./settings.ts";

type Reader = Pick<Database, "select">;

const recordType = "feature-team";
const noTeam = "There is no such feature team";
const nameTaken = "Another feature team already has that name";

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

export function teamChanges(
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
  classes: DataClasses,
): Change[] {
  return changesBetween(
    recordType,
    id,
    action,
    before,
    after,
    featureTeamFields,
    featureTeamTier(classes),
  );
}

// Those who propose or edit feature teams change them, seeing the org chart they are on and the
// people in the drafts they are sent.
function requireChanging(actor: Actor): void {
  requirePermission(actor, "people:view");
  requirePermission(actor, "feature-teams:edit");
}

interface LiveTeams {
  // Each team as recorded: its name, lead, and members on the day asked for.
  teams: Map<string, Recorded>;
  colours: Map<string, string | null>;
}

// The live teams given, or every team, with their members and lead as of a day, leaving out those
// who have left by the day their employment is judged on, which is that same day unless the reader
// is shown people as they are today. A lead who is not a member on the day is no lead.
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

// The live teams each person is on as of a day, by name, by person.
export async function readTeamsOfPeople(
  reader: Reader,
  day: string,
): Promise<Map<string, { id: string; name: string }[]>> {
  const { teams } = await readLiveTeams(reader, day);
  const teamsOf = new Map<string, { id: string; name: string }[]>();
  for (const [id, team] of teams) {
    for (const personId of membersOf(team)) {
      teamsOf.set(personId, [
        ...(teamsOf.get(personId) ?? []),
        { id, name: String(team.name) },
      ]);
    }
  }
  for (const held of teamsOf.values()) held.sort(byName);
  return teamsOf;
}

export const readTeamDrafts = (
  reader: Reader,
  ids?: readonly string[],
  viewer?: string,
) => readDrafts(reader, recordType, ids, viewer);

// A record approving a team's draft would make: someone joining or leaving the team from the day the
// draft gives them, or from today.
export interface DraftedMembership {
  teamId: string;
  personId: string;
  member: boolean;
  fromDate: string;
}

export interface DraftedTeam {
  teamId: string;
  name: string;
  action: Draft["action"];
  state: Draft["state"];
  unpublished: boolean;
}

// The team drafts a viewer sees, and the membership records approving them would make, judged
// against the teams as they are today, as a draft is made. Approving a team's removal takes its
// past records with it.
export async function readDraftedMemberships(
  reader: Reader,
  viewer: string,
  today: string,
): Promise<{ teams: DraftedTeam[]; records: DraftedMembership[] }> {
  const draftsNow = await readTeamDrafts(reader, undefined, viewer);
  const live = await readLiveTeams(reader, today, {
    ids: [...draftsNow.keys()],
  });
  const versions = [...draftsNow].map(([teamId, draft]) => {
    const before = live.teams.get(teamId);
    return { teamId, draft, before, after: drafted(before, draft) };
  });
  const everyone = await peopleOf(
    reader,
    versions.flatMap(({ after }) => peopleNamed(after)),
    today,
  );
  const teams: DraftedTeam[] = [];
  const records: DraftedMembership[] = [];
  for (const { teamId, draft, before, after } of versions) {
    // A draft adds a team, or changes or removes a live one.
    const named = (after ?? before) as Recorded;
    teams.push({
      teamId,
      name: String(named.name),
      action: draft.action,
      state: draft.state,
      unpublished: draft.unpublished === true,
    });
    if (after === undefined) continue;
    records.push(
      ...membershipChanges(
        teamId,
        before,
        withoutLeavers(after, everyone),
        today,
      ).records,
    );
  }
  return { teams, records };
}

// The records approving a team's draft makes: each member it adds joins, and each it removes
// leaves, from the day the draft gives them, or from today, with the days it gives.
function membershipChanges(
  teamId: string,
  before: Recorded | undefined,
  team: Recorded,
  today: string,
): { records: DraftedMembership[]; days: MemberDay[] } {
  const { added, removed } = memberChanges(before, team);
  const dates = new Map(Object.entries(datesOf(team)));
  const records: DraftedMembership[] = [];
  const days: MemberDay[] = [];
  for (const [personIds, member] of [
    [added, true],
    [removed, false],
  ] as const) {
    for (const personId of personIds) {
      const from = dates.get(personId);
      records.push({ teamId, personId, member, fromDate: from ?? today });
      if (from !== undefined) days.push({ teamId, personId, from });
    }
  }
  return { records, days };
}

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

// The month each team disbands from, which depends on when people join and leave teams and on end
// dates, so only those who see Personal details are told it.
async function readDisbandedMonths(
  reader: Reader,
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
  const disbanded = new Map<string, string>();
  for (const [teamId, rows] of bySubject(records, ({ teamId }) => teamId)) {
    const month = disbandedMonth([
      ...bySubject(rows, ({ personId }) => personId).values(),
    ]);
    if (month !== undefined) disbanded.set(teamId, month);
  }
  return disbanded;
}

// Every feature team on a day, today unless another is given, as the reader's drafts make it, with
// its draft beside, for those who see feature teams. Members and a lead who have not started are
// left out for readers who do not see Personal details, and those who have left for everyone.
// Those who do not see people get teams as approved, with no drafts. Another day needs every class
// of data other dates need. On another day, only teams with members then, or with a draft, are
// listed.
export async function readFeatureTeams(
  database: Database,
  actor: Actor,
  on?: string,
): Promise<FeatureTeams> {
  requirePermission(actor, "feature-teams:view");
  const today = await readToday(database);
  if (on !== undefined && on !== today) {
    requireView(actor, "orgChartOtherDates");
  }
  const day = on ?? today;
  const employmentDay = peopleAsTodayOn(actor, day, today) ? today : day;
  const seesDrafts = actor.permissions.includes("people:view");
  return database.transaction(
    async (transaction) => {
      const live = await readLiveTeams(transaction, day, { employmentDay });
      const draftsNow = seesDrafts
        ? new Map(
            [
              ...(await readTeamDrafts(transaction, undefined, actor.user.id)),
            ].filter(([, draft]) => draftShownTo(actor, draft)),
          )
        : new Map<string, Draft>();
      const liveToday =
        day === today
          ? live
          : await readLiveTeams(transaction, today, {
              ids: [...draftsNow.keys()],
            });
      const held = seesDrafts
        ? await readHeld(transaction, recordType, actor.user.id)
        : new Map<string, Held>();
      const makers = await draftMakers(
        transaction,
        recordType,
        [...draftsNow.keys()],
        seesTeamField(actor),
        actor,
      );
      const ids = [
        ...live.teams.keys(),
        ...[...draftsNow.keys()].filter((id) => !live.teams.has(id)),
      ];
      const versions = ids.map((id) => {
        const before = live.teams.get(id);
        const teamToday = liveToday.teams.get(id);
        const draft = draftsNow.get(id);
        const after = draftedOn(before, teamToday, draft);
        return { id, before, teamToday, draft, after, team: after ?? before };
      });
      const everyone = await peopleOf(
        transaction,
        versions.flatMap(({ team, before, teamToday }) => [
          ...peopleNamed(team),
          ...peopleNamed(before),
          ...peopleNamed(teamToday),
        ]),
        employmentDay,
      );
      const sight = teamSight(actor, everyone, { day, today });
      const { shown } = sight;
      // Disbanded months are worked out from the days members leave.
      const disbanded =
        sight.seesPeople && sight.seesDays
          ? await readDisbandedMonths(transaction)
          : new Map<string, string>();
      const keys = await readKeyNumbers(transaction, "team");
      const teams = versions.flatMap(
        ({ id, before, teamToday, draft, after, team }): FeatureTeam[] => {
          // A draft changing a team that is not live, as when seed data is removed, makes none.
          if (team === undefined) return [];
          const members = membersOf(team).filter(shown);
          const withDraft = draftAsSeen(
            sight,
            { before, teamToday, after, team },
            draft,
            makers.get(id),
          );
          if (on !== undefined && members.length === 0 && !withDraft.draft) {
            return [];
          }
          return [
            {
              id,
              keyNumber: keyNumberOf(keys, id),
              name: String(team.name),
              leadId: shown(team.leadId) ? team.leadId : null,
              colour: knownColour(live.colours.get(id)),
              members,
              names: namesSeen(sight, team, before),
              ...(disbanded.has(id)
                ? { disbandedFrom: disbanded.get(id) }
                : {}),
              ...withDraft,
              ...heldByOf(held, id),
            },
          ];
        },
      );
      teams.sort(byName);
      return { teams };
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

async function refuseTakenName(
  transaction: Transaction,
  name: string,
  except: string,
): Promise<void> {
  if (nameIsTaken(await readTeamNames(transaction), name, except)) {
    throw new ConflictError(nameTaken);
  }
}

function refuseWith(refusal: string | undefined): void {
  if (refusal !== undefined) throw new BadRequestError(refusal);
}

function checkMembers(
  actor: Actor,
  added: readonly string[],
  members: readonly string[],
  leadId: unknown,
  everyone: Everyone,
): void {
  refuseWith(membersRefusal(actor, added, members, leadId, everyone));
}

const changesDates = (actor: Actor) => editsField(actor, "featureTeamDates");

// The day members join or leave from: today, or another day for those who see the classes of data
// other dates need, an earlier day needing the right to change feature team dates' class too.
function fromDay(actor: Actor, from: string | undefined, today: string) {
  if (from === undefined || from === today) return undefined;
  requireView(actor, "orgChartOtherDates");
  if (!mayDateChange(changesDates(actor), from, today)) {
    throw new ForbiddenError(
      "This role can't choose an earlier date. Use today or a later date.",
    );
  }
  return from;
}

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
    );
  refuseWith(leadOffTeamRefusal(records, from, joinsOn));
}

// Refuses a day outside someone's employment.
function refuseOutsideEmployment(
  day: MemberDay,
  everyone: Everyone,
  refusals: DayRefusals,
): void {
  refuseWith(employmentDayRefusal(day, everyone, refusals));
}

// Refuses days that would never take effect, as daysRefusal sets out.
async function refuseDaysOutOfOrder(
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
          personId: featureTeamMemberships.personId,
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
        draftingRefusals,
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
        asDraft(
          teamChanges(id, "created", undefined, after, actor.dataClasses),
        ),
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
// draft changing someone who has not started is seen as Personal.
async function clearedTeamRejection(
  transaction: Transaction,
  id: string,
  before: Recorded | undefined,
  draft: Draft | undefined,
  today: string,
  classes: DataClasses,
): Promise<Change[]> {
  if (draft?.state !== "rejected") return [];
  const after = drafted(before, draft);
  const holdsNotStarted = draftHoldsNotStarted(
    before,
    after,
    await peopleOf(transaction, peopleDraftChanges(before, after), today),
  );
  return clearedRejection(
    id,
    holdsNotStarted ? () => classes.startDate : featureTeamTier(classes),
    before,
    draft,
    recordType,
  );
}

// Drafts a change to a feature team: its name, lead, or members, who join or leave from the day
// given, or from today. Proposing feature teams is enough to rename one, as it is to add one.
export async function updateFeatureTeam(
  database: Database,
  actor: Actor,
  id: string,
  change: FeatureTeamChange,
  asOf?: string,
): Promise<string | null> {
  requireChanging(actor);
  const today = asOf ?? (await readToday(database));
  const from = fromDay(actor, change.from, today);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const now = await draftedTeam(transaction, actor, id, today);
    const made = await draftTeamChange(
      transaction,
      actor,
      {
        id,
        change:
          from === undefined
            ? change
            : await heldMembers(transaction, now, id, change, {
                day: from,
                today,
              }),
        from,
        today,
      },
      now,
      draftingRefusals,
    );
    return made.length === 0 ? null : saved(transaction, actor, made);
  });
}

type DraftedTeamNow = Awaited<ReturnType<typeof draftedTeam>>;

// Writes a team's draft with a change made, once the drafts lock is held, as updateFeatureTeam
// describes, returning the changes to record; none when it changes nothing.
async function draftTeamChange(
  transaction: Transaction,
  actor: Actor,
  {
    id,
    change,
    from,
    today,
  }: {
    id: string;
    change: FeatureTeamChange;
    from: string | undefined;
    today: string;
  },
  { before, draft, team }: DraftedTeamNow,
  dayRefusals: DayRefusals,
): Promise<Change[]> {
  if (team === undefined) {
    throw new ConflictError(
      "This feature team's draft removes it; discard the draft to change it",
    );
  }
  if (change.name !== undefined) {
    await refuseTakenName(transaction, change.name, id);
  }
  const {
    after,
    added,
    members,
    leadId,
    dayPeople,
    dated,
    leadChanges,
    leadJoinsOn,
  } = nextTeamDraft({ before, team }, change, { from, today });
  const everyone = await peopleOf(
    transaction,
    [...dayPeople, ...(leadId === null ? [] : [leadId])],
    today,
  );
  checkMembers(actor, added, members, leadId, everyone);
  // A day other than today is chosen only by those who see employment dates, as fromDay requires.
  if (from !== undefined) {
    await refuseDaysOutOfOrder(
      transaction,
      dated.map((personId) => ({ teamId: id, personId, from })),
      everyone,
      dayRefusals,
    );
    if (leadChanges) {
      await refuseLeadDayOutOfOrder(transaction, id, from);
    }
  }
  if (leadChanges && leadId !== null) {
    await refuseLeadOffTeam(
      transaction,
      id,
      leadId,
      from ?? today,
      leadJoinsOn,
    );
    if (from !== undefined) {
      refuseOutsideEmployment(
        { teamId: id, personId: leadId, from },
        everyone,
        draftingRefusals,
      );
    }
  }
  const made = teamChanges(id, "changed", team, after, actor.dataClasses);
  if (made.length === 0) return [];
  const cleared = await clearedTeamRejection(
    transaction,
    id,
    before,
    draft,
    today,
    actor.dataClasses,
  );
  await writeDraft(transaction, actor.user.id, recordType, id, before, after);
  return [...asDraft(made), ...cleared];
}

// A change of a team's members from another day than today, without those it changes nothing about,
// refusing those the team's draft can't hold, as heldChange sets out. Only those who see employment
// dates choose another day, as fromDay requires.
async function heldMembers(
  transaction: Transaction,
  { before, team }: DraftedTeamNow,
  id: string,
  change: FeatureTeamChange,
  when: { day: string; today: string },
): Promise<FeatureTeamChange> {
  const asked = [...(change.add ?? []), ...(change.remove ?? [])];
  // A team its draft removes is refused when the change is drafted.
  if (asked.length === 0 || team === undefined) return change;
  const everyone = await peopleOf(transaction, asked, when.today);
  const onDay = membersOf(
    (await readLiveTeams(transaction, when.day, { ids: [id] })).teams.get(id),
  );
  const held = heldChange({ before, team }, change, { everyone, onDay }, when);
  if ("refusal" in held) throw new BadRequestError(held.refusal);
  return held.change;
}

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
    await refuseRemovingNamed(transaction, "feature-team", [id], actor);
    const cleared = await clearedTeamRejection(
      transaction,
      id,
      before,
      draft,
      today,
      actor.dataClasses,
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
      [
        ...asDraft(
          teamChanges(id, "deleted", team, undefined, actor.dataClasses),
        ),
        ...cleared,
      ],
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
      actor.dataClasses,
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
      [
        ...asDraft(teamChanges(id, action, team, before, actor.dataClasses)),
        ...cleared,
      ],
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
    // A day before today needs the right to change Personal details, as choosing one does.
    if (
      [
        ...Object.values(datesOf(team)),
        ...Object.values(leadDatesOf(team)),
      ].some((day) => day < today)
    ) {
      requireFieldEdit(actor, "featureTeamDates");
    }
    const made = await clearedTeamRejection(
      transaction,
      id,
      before,
      draft,
      today,
      actor.dataClasses,
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
    const tier = mostSensitive([
      draftTier(featureTeamTier(actor.dataClasses), before, draft),
      draftHoldsNotStarted(before, drafted(before, draft), everyone)
        ? actor.dataClasses.startDate
        : "general",
    ]);
    made.push({
      recordType,
      recordId: id,
      action: "changed",
      field: rejectedField,
      tier,
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
  const names = await readTeamNames(transaction);
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
