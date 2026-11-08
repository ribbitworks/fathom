// SPDX-License-Identifier: Apache-2.0

// Feature teams, as part of the data access layer: the people working on a set of related features,
// apart from reporting lines, as the Decisions Log sets out, seen by everyone who sees the org chart
// and changed there. A team's name, lead, and members are General; the day each member joined or
// left is Restricted, as reporting lines' dates are, and so are members who have not started, whom
// readers who do not see Restricted details never see. Drafts are details of people, so those who
// do not see people see only approved teams. Someone whose end date has passed is off every team
// from the next day, so a team shows no lead they led until another is chosen, and no draft is held
// up by them; their past records stay. Every change to a team is a draft, its name, lead, and member
// changes making one draft, approved or rejected together; approving one turns its member changes
// into records of joining and leaving from a date. A team's colour is how the chart is drawn, not a
// detail of anyone, so it changes at once.

import {
  type Database,
  drafts,
  featureTeamMemberships,
  featureTeams,
  inChunks,
  people,
} from "@fathom/db";
import {
  type FeatureTeam,
  type FeatureTeamChange,
  type FeatureTeamDraft,
  type FeatureTeamRequest,
  type FeatureTeams,
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
import { currentOn, notStarted } from "./people.ts";
import { readToday } from "./settings.ts";

type Reader = Pick<Database, "select">;

const recordType = "feature-team";
const noTeam = "There is no such feature team";
const nameTaken = "Another feature team already has that name";

// A team's fields as drafts and the change history hold them: its name, lead, members, by person,
// sorted, and the days the members a draft adds or removes join or leave, by person, when given.
export const featureTeamFields = [
  "name",
  "leadId",
  "members",
  "memberFrom",
] as const;

// The days members join and leave are Restricted, as reporting lines' are; the rest is General.
export const featureTeamTier = (field: string): Tier =>
  field === "memberFrom" ? "restricted" : "general";

// Everyone who sees the org chart sees a team's General details, whether or not they see people.
const seesTeamField = (actor: Actor) => (field: string) =>
  featureTeamTier(field) === "general" || seesRestrictedDetails(actor);

const textOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const membersOf = (team: Recorded | undefined): string[] =>
  Array.isArray(team?.members) ? team.members.map(String) : [];

const datesOf = (team: Recorded | undefined): Record<string, string> =>
  typeof team?.memberFrom === "object" && team.memberFrom !== null
    ? (team.memberFrom as Record<string, string>)
    : {};

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
  // Each team as recorded: its name, lead, and members today.
  teams: Map<string, Recorded>;
  colours: Map<string, string | null>;
}

// The live teams given, or every team, with their members as of today, leaving out those who have
// left, and a lead who has.
export async function readLiveTeams(
  reader: Reader,
  today: string,
  ids?: readonly string[],
): Promise<LiveTeams> {
  const rows: (typeof featureTeams.$inferSelect)[] = [];
  const memberships: (typeof featureTeamMemberships.$inferSelect)[] = [];
  const read = async (chunk?: readonly string[]) => {
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
            sql`${featureTeamMemberships.fromDate} <= ${today}`,
          ),
        )
        .orderBy(asc(featureTeamMemberships.fromDate))),
    );
  };
  if (ids === undefined) await read();
  else for (const chunk of inChunks([...ids])) await read(chunk);
  // Each person's latest record for a team, as of today, says whether they are on it.
  const latest = new Map<string, Map<string, boolean>>();
  for (const { teamId, personId, member } of memberships) {
    const team = latest.get(teamId) ?? new Map<string, boolean>();
    team.set(personId, member);
    latest.set(teamId, team);
  }
  const everyone = await peopleOf(
    reader,
    [
      ...memberships.map(({ personId }) => personId),
      ...rows.flatMap(({ leadId }) => leadId ?? []),
    ],
    today,
  );
  const teams = new Map<string, Recorded>();
  for (const row of rows) {
    const onTeam = [...(latest.get(row.id) ?? new Map<string, boolean>())]
      .filter(([, member]) => member)
      .map(([personId]) => personId);
    teams.set(
      row.id,
      withoutLeavers(
        { name: row.name, leadId: row.leadId, members: onTeam.sort() },
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

// The people given who are live, with whether each has started and left as of today.
async function peopleOf(
  reader: Reader,
  ids: readonly string[],
  today: string,
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
        started: !notStarted(person, today),
        left: leftBy(person, today),
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
  const rest = { ...team };
  delete rest.memberFrom;
  return {
    ...rest,
    ...(Array.isArray(team.members)
      ? { members: membersOf(team).filter((id) => !gone(id)) }
      : {}),
    ...(gone(team.leadId) ? { leadId: null } : {}),
    ...(days.length === 0 ? {} : { memberFrom: Object.fromEntries(days) }),
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
  ...[team?.leadId].flatMap((id) => (typeof id === "string" ? [id] : [])),
];

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
      const shown = (personId: unknown): personId is string => {
        const person =
          typeof personId === "string" ? everyone.get(personId) : undefined;
        return person?.left === false && (restricted || person.started);
      };
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
          ...shownDraft(id, before, draft, team),
          ...(held.has(id) ? { heldBy: held.get(id)?.holder } : {}),
        }),
      );
      teams.sort((first, second) =>
        first.name.localeCompare(second.name, undefined, {
          sensitivity: "base",
        }),
      );
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
        const days = restricted
          ? Object.entries(datesOf(team)).filter(([personId]) =>
              shown(personId),
            )
          : [];
        const fields = draftFields(before, draft);
        const changed = fields.filter(
          (field) =>
            seen(field) &&
            changesWhoIsSeen(field) &&
            (field !== "memberFrom" || days.length > 0),
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
      return "Choose members from People";
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

// The day members join or leave from: today, or an earlier day given by someone who may change
// Restricted details.
function fromDay(actor: Actor, from: string | undefined, today: string) {
  if (from === undefined) return undefined;
  if (!actor.permissions.includes("restricted:edit")) {
    throw new ForbiddenError(
      "Your role can't set a date, so leave it as today",
    );
  }
  if (from > today) {
    throw new BadRequestError(
      "Members join or leave from today or an earlier day",
    );
  }
  return from;
}

interface MemberDay {
  teamId: string;
  personId: string;
  from: string;
}

type DayRefusal = (day: MemberDay) => string;

interface DayRefusals {
  outOfOrder: DayRefusal;
  beforeStart: DayRefusal;
  afterEnd: DayRefusal;
}

const refusalsWhenDrafting: DayRefusals = {
  outOfOrder: () =>
    "Choose a day after the last time this person joined or left this team",
  beforeStart: () =>
    "Someone can't join or leave a team before their start date",
  afterEnd: () => "Someone can't join or leave a team after their end date",
};

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

// Refuses days that would never take effect: each must be after the person's latest record on that
// team, and between their start and end dates.
async function refuseDaysOutOfOrder(
  reader: Reader,
  days: readonly MemberDay[],
  everyone: Everyone,
  refusals: DayRefusals = refusalsWhenDrafting,
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
      throw new BadRequestError(refusals.outOfOrder(day));
    }
    const person = everyone.get(personId) ?? {};
    if (notStarted(person, from)) {
      throw new BadRequestError(refusals.beforeStart(day));
    }
    if (leftBy(person, from)) {
      throw new BadRequestError(refusals.afterEnd(day));
    }
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
          change.recordType === recordType && change.field === "memberFrom",
      )
      .flatMap((change) => [
        ...Object.keys(datesOf({ memberFrom: change.oldValue })),
        ...Object.keys(datesOf({ memberFrom: change.newValue })),
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
    if (from !== undefined) {
      await refuseDaysOutOfOrder(
        transaction,
        members.map((personId) => ({ teamId: id, personId, from })),
        everyone,
      );
    }
    checkMembers(actor, members, members, request.leadId, everyone);
    // A team added with no members records none, rather than an empty list.
    const after = tidy({
      name: request.name,
      leadId: request.leadId,
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
  const before = (await readLiveTeams(transaction, today, [id])).teams.get(id);
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
    const everyone = await peopleOf(transaction, [...added, ...removed], today);
    // A day is kept for each member a draft adds or removes, so approving it records when; a change
    // taken back leaves none.
    const days = { ...datesOf(team) };
    if (from !== undefined) {
      // Each is a person the change names.
      // eslint-disable-next-line security/detect-object-injection
      for (const personId of [...added, ...removed]) days[personId] = from;
    }
    const dates = Object.fromEntries(
      Object.entries(days).filter(
        ([personId]) =>
          members.includes(personId) !== membersOf(before).includes(personId),
      ),
    );
    if (from !== undefined) {
      await refuseDaysOutOfOrder(
        transaction,
        [...added, ...removed]
          .filter((personId) => Object.hasOwn(dates, personId))
          .map((personId) => ({ teamId: id, personId, from })),
        everyone,
      );
    }
    checkMembers(actor, added, members, leadId, everyone);
    const after = tidy({
      name: change.name ?? team.name,
      leadId,
      members,
      ...(Object.keys(dates).length === 0 ? {} : { memberFrom: dates }),
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
    const { before, draft } = await draftedTeam(transaction, actor, id, today);
    if (draft?.state !== "rejected") {
      throw new ConflictError("Only a rejected draft can be resubmitted");
    }
    const fields = draftFields(before, draft);
    if (fields.includes("memberFrom")) {
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
  const live = (await readLiveTeams(transaction, today, ids)).teams;
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
    const row = { name: String(team.name), leadId: textOrNull(team.leadId) };
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
  await refuseDaysOutOfOrder(
    transaction,
    days,
    everyone,
    refusalsWhenApproving(teamNames, everyone),
  );
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
      draftFields(before, draft).includes("memberFrom") ||
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
  const live = (await readLiveTeams(transaction, today, ids)).teams;
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

// Refuses removing people who lead a feature team, live or in a draft, or whom a team's draft names
// as a member, published or not.
export async function refuseRemovingPeopleOnTeams(
  reader: Reader,
  ids: readonly string[],
): Promise<void> {
  const inDrafts = [
    ...(await readTeamDrafts(reader)).values(),
    ...[...(await readHeld(reader, recordType, undefined)).values()].map(
      ({ draft }) => draft,
    ),
  ].map(({ fields }) => fields);
  for (const chunk of inChunks([...ids])) {
    const [lead] = await reader
      .select({ id: featureTeams.id })
      .from(featureTeams)
      .where(inArray(featureTeams.leadId, chunk))
      .limit(1);
    if (
      lead !== undefined ||
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
