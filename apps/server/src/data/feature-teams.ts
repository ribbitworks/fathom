// SPDX-License-Identifier: Apache-2.0

// Drafting feature teams: adding, changing, removing, discarding and resubmitting teams' drafts and
// their colours, and the steps the other feature team files share. Part of the data access layer.

import { type Database, featureTeams } from "@fathom/db";
import {
  type DataClasses,
  type FeatureTeamChange,
  type FeatureTeamRequest,
  type PaletteColour,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { type Actor, requireFieldEdit } from "../access.ts";
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
  actionTo,
  asDraft,
  clearedRejection,
  type Draft,
  drafted,
  type Recorded,
  requireRejected,
  tidy,
} from "./draft-records.ts";
import {
  lockDrafts,
  readHeld,
  refuseHeld,
  reopened,
  writeDraft,
} from "./drafts.ts";
import {
  peopleOf,
  readLiveTeams,
  readTeamDrafts,
} from "./feature-team-reads.ts";
import { recordType } from "./feature-team-records.ts";
import {
  fromDay,
  recordTeamDayChanges,
  refuseDaysOutOfOrder,
  refuseLeadDayOutOfOrder,
  refuseLeadOffTeam,
  refuseOutsideEmployment,
  refuseWith,
} from "./feature-team-days.ts";
import {
  datesOf,
  type DayRefusals,
  draftingRefusals,
  type Everyone,
  leadDatesOf,
  membersOf,
  membersRefusal,
  nameIsTaken,
  nextTeamDraft,
} from "./feature-team-rules.ts";
import { heldChange } from "./feature-team-held-changes.ts";
import {
  draftHoldsNotStarted,
  featureTeamTier,
  peopleDraftChanges,
  peopleNamed,
  withoutLeavers,
} from "./feature-team-sight.ts";
import { refuseRemovingNamed } from "./records.ts";
import { readToday } from "./settings.ts";

const noTeam = "There is no such feature team";
const nameTaken = "Another feature team has that name";

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

// Those who edit feature teams change them, seeing the org chart they are on and the people in the
// drafts they are sent.
export const changesTeams = (actor: Actor): boolean =>
  actor.permissions.includes("people:view") &&
  actor.permissions.includes("feature-teams:edit");

export function requireChanging(actor: Actor): void {
  if (!changesTeams(actor)) throw new ForbiddenError();
}

// Every team's name, live or in a draft, published or not, with its team.
export async function readTeamNames(
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

function checkMembers(
  actor: Actor,
  added: readonly string[],
  members: readonly string[],
  leadId: unknown,
  everyone: Everyone,
): void {
  refuseWith(membersRefusal(actor, added, members, leadId, everyone));
}

export async function saved(
  transaction: Transaction,
  actor: Actor,
  made: Change[],
  kind?: "discard" | "resubmission",
): Promise<string | null> {
  await recordTeamDayChanges(transaction, actor.user.id, made);
  return recordChanges(transaction, actor, made, kind);
}

// A change of feature teams by someone who may change them, on the day given or today, in a
// transaction of its own with the drafts locked.
export async function changingTeams<Result>(
  database: Database,
  actor: Actor,
  asOf: string | undefined,
  change: (transaction: Transaction, today: string) => Promise<Result>,
): Promise<Result> {
  requireChanging(actor);
  const today = asOf ?? (await readToday(database));
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    return change(transaction, today);
  });
}

// Drafts adding a feature team, with its members and lead.
export async function createFeatureTeam(
  database: Database,
  actor: Actor,
  request: FeatureTeamRequest,
  asOf?: string,
): Promise<{ id: string; changeSetId: string | null }> {
  return changingTeams(database, actor, asOf, async (transaction, today) => {
    const from = fromDay(actor, request.from, today);
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
export async function draftedTeam(
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
  return changingTeams(database, actor, asOf, async (transaction, today) => {
    const from = fromDay(actor, change.from, today);
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
export async function draftTeamChange(
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

// Drafts removing a feature team, which needs the right to edit them; removing one only drafted to
// be added discards that draft.
export async function deleteFeatureTeam(
  database: Database,
  actor: Actor,
  id: string,
  asOf?: string,
): Promise<string | null> {
  return changingTeams(database, actor, asOf, async (transaction, today) => {
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
  return changingTeams(database, actor, asOf, async (transaction, today) => {
    const { before, draft, team } = await draftedTeam(
      transaction,
      actor,
      id,
      today,
    );
    if (draft === undefined) {
      throw new NotFoundError("This feature team has no draft");
    }
    const action = actionTo(team, before);
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
  return changingTeams(database, actor, asOf, async (transaction, today) => {
    const { before, draft, team } = await draftedTeam(
      transaction,
      actor,
      id,
      today,
    );
    requireRejected(draft);
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
    await reopened(transaction, recordType, id);
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
