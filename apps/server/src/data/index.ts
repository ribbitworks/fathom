// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface: functions bound to a database, which are all that the rest of
// the server receives, so no other code can query the database directly. Functions that read or
// change Fathom's data take the actor making the request, and refuse when the actor's roles do not
// allow it.

import type { Database } from "@fathom/db";
import type {
  EffortConversions,
  ChangeHistory,
  Choice,
  ChoiceRequest,
  CycleLengthRequest,
  CyclePatternRequest,
  CyclesUntilRequest,
  DraftsAsked,
  Field,
  FieldRequest,
  FeatureProjectsRequest,
  FeatureTeamChange,
  MemberTeamsChange,
  FeatureTeamRequest,
  FeatureTeams,
  HireChange,
  HireFill,
  HireRequest,
  Hires,
  HistoryEntry,
  List,
  ListRequest,
  MilestoneRequest,
  MonthRange,
  OrgChart,
  PaletteColour,
  Permission,
  Person,
  PersonChange,
  PersonRequest,
  PlanChoices,
  ProjectPlan,
  RecordType,
  ReleaseNoteRequest,
  ReleaseRequest,
  ReleaseStream,
  ReleaseStreamRequest,
  ReleaseStreams,
  RetiredRequest,
  SavedView,
  SavedViewChange,
  SavedViewRequest,
  PasswordOwner,
  PasswordSettings,
  Settings,
  TeamMonths,
  TimeZoneSetting,
  Unpublished,
} from "@fathom/shared";
import {
  type AllocationChange,
  type Allocations,
  draftsRequestSchema,
} from "@fathom/shared";
import { sql } from "drizzle-orm";
import {
  type Actor,
  requireAnyPermission,
  requirePermission,
  seesPersonalDetails,
} from "../access.ts";
import { approveDrafts, rejectDrafts } from "./approvals.ts";
import { changeEffortConversions, readEffortConversions } from "./effort.ts";
import { changeAllocation, readAllocations } from "./allocations.ts";
import { readGreeting } from "./greeting.ts";
import * as columnDrafts from "./column-drafts.ts";
import { readColumnsOut } from "./column-drafts.ts";
import { readChangeHistory } from "./change-history.ts";
import * as lists from "./lists.ts";
import * as peopleData from "./people.ts";
import { readOrgChart, readOrgChartOn, setTeamColour } from "./org-chart.ts";
import * as hireData from "./hires.ts";
import * as fills from "./fills.ts";
import * as featureTeamData from "./feature-teams.ts";
import { readTeamMonths } from "./team-months.ts";
import { readHistory, recordPersonalView } from "./history.ts";
import { discardRecordDraft, resubmitRecordDraft } from "./records.ts";
import * as projectData from "./projects.ts";
import type { PlanKind, PlanRecordRequest } from "./projects.ts";
import * as releases from "./releases.ts";
import type { Saved } from "./changes.ts";
import { undoChangeSet } from "./undo.ts";
import {
  discardUnpublished,
  publishUnpublished,
  readUnpublished,
} from "./unpublished.ts";
import {
  type ActorAccess,
  keepSessionRole,
  readActorAccess,
  switchRole,
} from "./roles.ts";
import {
  changePasswordSettings,
  changeTimeZone,
  checkChosenPassword,
  readSettings,
  readTimeZone,
} from "./settings.ts";
import * as views from "./views.ts";

export interface DataAccess {
  // Fails, with a message naming the settings to check, unless the database can be queried.
  checkConnection(): Promise<void>;
  // The roles of the signed-in user making a request, the one their session acts as, and what it
  // grants, or null if their account is deactivated. The server needs them to know who is asking,
  // so it checks no permission. The remembered role is the browser's last choice, which a session
  // starts as if the account holds it.
  readActorAccess(
    userId: string,
    sessionId: string,
    rememberedRoleId?: string,
  ): Promise<ActorAccess | null>;
  // Switches the actor's session to another of their roles, which needs no permission, recording it
  // in the access history; a role they do not hold is refused.
  switchRole(actor: Actor, sessionId: string, roleId: string): Promise<void>;
  // Gives the session with this token, which a password change starts, the role the session it
  // replaces acted as.
  keepSessionRole(token: string, roleId: string | null): Promise<void>;
  readGreeting(actor: Actor): Promise<string>;
  // Settings for the whole of Fathom, which every signed-in user's screens follow, so reading them
  // checks no permission.
  readSettings(): Promise<Settings>;
  changeTimeZone(actor: Actor, timeZone: string): Promise<TimeZoneSetting>;
  changePasswordSettings(
    actor: Actor,
    passwords: PasswordSettings,
  ): Promise<PasswordSettings>;
  // Refuses a password a person chose that the rules in the password settings do not allow, or that
  // is too common or easy to guess for its owner. Anyone may ask, since the rules are no secret.
  checkChosenPassword(password: string, owner: PasswordOwner): Promise<void>;
  // The conversions between units of effort, seen with the plan and changed by those who change
  // configuration.
  readEffortConversions(actor: Actor): Promise<EffortConversions>;
  changeEffortConversions(
    actor: Actor,
    conversions: EffortConversions,
  ): Promise<Saved<EffortConversions>>;
  // The most recent entries in the access history.
  readHistory(actor: Actor): Promise<HistoryEntry[]>;
  // The change sets saved before the one named, or the latest, holding only the changes the actor
  // may see, and every word of a search, if any. Seeing Personal or Confidential changes is
  // recorded in the access history.
  readChanges(
    actor: Actor,
    before?: string,
    search?: string,
  ): Promise<ChangeHistory>;
  // Lists of choices, which everyone who sees planning configuration may read, and only those who
  // may edit it may change.
  lists: ListAccess;
  // Approving and rejecting drafts of every kind, several kinds at once; neither can be undone.
  drafts: DraftAccess;
  // People, and the columns on the People table.
  people: PeopleAccess;
  // Planned hires: the hiring plan, or its placeholders.
  hires: HireAccess;
  // Feature teams, seen by everyone who sees the org chart, and drafted by those who propose or edit
  // them.
  featureTeams: FeatureTeamAccess;
  // The actor's own unpublished changes to drafts, which only they see until they publish them.
  unpublished: UnpublishedAccess;
  // Release streams, their cycle patterns, and their releases, which everyone who sees the plan or
  // planning configuration may read.
  releases: ReleaseAccess;
  // Customers, projects with their milestones, proposals, and features, which everyone who sees the
  // plan may read.
  projects: ProjectAccess;
  // Discarding and resubmitting drafts of the plan's records, whatever their kind.
  records: RecordAccess;
  // Who is put on which feature, month by month, seen by those who see allocations, and changed as
  // drafts by those who edit them.
  allocations: AllocationAccess;
  // Undoes a change set the actor made, returning the change set that undid it.
  undo(actor: Actor, changeSetId: string): Promise<ChangeSetId>;
}

// Every change to release streams, patterns, and releases is a draft. Streams and their patterns
// are planning configuration, edited by those who edit it; releases are part of the plan.
export interface ReleaseAccess {
  read(actor: Actor): Promise<ReleaseStreams>;
  createStream(
    actor: Actor,
    request: ReleaseStreamRequest,
  ): Promise<Saved<ReleaseStream>>;
  updateStream(
    actor: Actor,
    id: string,
    change: Partial<ReleaseStreamRequest & RetiredRequest & CyclesUntilRequest>,
  ): Promise<Saved<ReleaseStream>>;
  addPattern(
    actor: Actor,
    streamId: string,
    request: CyclePatternRequest,
  ): Promise<Saved<ReleaseStream>>;
  updatePattern(
    actor: Actor,
    streamId: string,
    id: string,
    request: CyclePatternRequest,
  ): Promise<Saved<ReleaseStream>>;
  deletePattern(
    actor: Actor,
    streamId: string,
    id: string,
  ): Promise<ChangeSetId>;
  addRelease(
    actor: Actor,
    streamId: string,
    request: ReleaseRequest,
  ): Promise<Saved<ReleaseStream>>;
  updateRelease(
    actor: Actor,
    streamId: string,
    id: string,
    request: ReleaseRequest,
  ): Promise<Saved<ReleaseStream>>;
  deleteRelease(
    actor: Actor,
    streamId: string,
    id: string,
  ): Promise<ChangeSetId>;
  updateReleaseNote(
    actor: Actor,
    streamId: string,
    id: string,
    request: ReleaseNoteRequest,
  ): Promise<Saved<ReleaseStream>>;
  // Changing one cycle's length changes the stream's patterns, and moves the releases on cycles
  // that move, which those who change cycles may do, as the Decisions Log sets out.
  changeCycleLength(
    actor: Actor,
    streamId: string,
    startsOn: string,
    request: CycleLengthRequest,
  ): Promise<Saved<ReleaseStream>>;
}

export type { PlanKind, PlanRecordRequest } from "./projects.ts";
export { firstOffered } from "./built-in-lists.ts";

// Every change to customers, projects, milestones, proposals, and features is a draft, made by those
// who edit the plan, or, for features, those who edit features. Each answers with every record as
// the editor now sees them.
export interface ProjectAccess {
  read(actor: Actor): Promise<ProjectPlan>;
  // What the plan's records can be given, which everyone who sees the plan may read, though they
  // may not see People or Lists.
  readChoices(actor: Actor): Promise<PlanChoices>;
  // Drafts adding, changing, and removing the columns added to Features.
  createFeatureColumn(
    actor: Actor,
    request: FieldRequest,
  ): Promise<Saved<Field>>;
  updateFeatureColumn(
    actor: Actor,
    id: string,
    request: FieldRequest,
  ): Promise<Saved<Field>>;
  deleteFeatureColumn(actor: Actor, id: string): Promise<ChangeSetId>;
  discardFeatureColumnDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  resubmitFeatureColumnDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  add(actor: Actor, added: PlanRecordRequest): Promise<Saved<ProjectPlan>>;
  change(
    actor: Actor,
    id: string,
    changed: PlanRecordRequest,
  ): Promise<Saved<ProjectPlan>>;
  remove(actor: Actor, type: PlanKind, id: string): Promise<ChangeSetId>;
  // Changes which projects need a feature and which proposals propose it, drafting each project
  // and proposal, so it takes those who edit the plan.
  changeFeatureProjects(
    actor: Actor,
    featureId: string,
    request: FeatureProjectsRequest,
  ): Promise<Saved<ProjectPlan>>;
  addMilestone(
    actor: Actor,
    projectId: string,
    request: MilestoneRequest,
  ): Promise<Saved<ProjectPlan>>;
  changeMilestone(
    actor: Actor,
    projectId: string,
    id: string,
    request: MilestoneRequest,
  ): Promise<Saved<ProjectPlan>>;
  removeMilestone(
    actor: Actor,
    projectId: string,
    id: string,
  ): Promise<ChangeSetId>;
}

export interface AllocationAccess {
  read(actor: Actor): Promise<Allocations>;
  change(actor: Actor, change: AllocationChange): Promise<ChangeSetId>;
}

export interface RecordAccess {
  discardDraft(
    actor: Actor,
    type: RecordType,
    id: string,
  ): Promise<ChangeSetId>;
  resubmitDraft(
    actor: Actor,
    type: RecordType,
    id: string,
  ): Promise<ChangeSetId>;
}

// The change set a change was saved in, which undoing it names; null when nothing changed.
export type ChangeSetId = string | null;

export type { Saved } from "./changes.ts";

export interface DraftAccess {
  approve(actor: Actor, asked: DraftsAsked): Promise<ChangeSetId>;
  reject(
    actor: Actor,
    asked: DraftsAsked,
    reason: string,
  ): Promise<ChangeSetId>;
}

// Each user's changes to drafts are theirs alone until they publish them, all at once, or discard
// them, all at once; both answer how many records' changes they took.
export interface UnpublishedAccess {
  read(actor: Actor): Promise<Unpublished>;
  publish(actor: Actor): Promise<number>;
  discard(actor: Actor): Promise<number>;
}

// Which draft of a list: the list's own, one of its choices', or that of its choices' order.
export type ListDraftTarget =
  | { kind: "list"; listId: string }
  | { kind: "choice"; listId: string; choiceId: string }
  | { kind: "order"; listId: string };

// Every change to lists and choices is a draft, which reaches the live lists once approved.
export interface ListAccess {
  read(actor: Actor): Promise<List[]>;
  create(actor: Actor, request: ListRequest): Promise<Saved<List>>;
  update(actor: Actor, id: string, request: ListRequest): Promise<Saved<List>>;
  setRetired(
    actor: Actor,
    id: string,
    request: RetiredRequest,
  ): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
  addChoices(
    actor: Actor,
    listId: string,
    requests: readonly ChoiceRequest[],
  ): Promise<Saved<Choice[]>>;
  updateChoice(
    actor: Actor,
    listId: string,
    id: string,
    request: ChoiceRequest,
  ): Promise<Saved<Choice>>;
  // Moves a choice to just after another, or to the top when there is none.
  moveChoice(
    actor: Actor,
    listId: string,
    id: string,
    after: string | null,
  ): Promise<ChangeSetId>;
  setChoiceRetired(
    actor: Actor,
    listId: string,
    id: string,
    request: RetiredRequest,
  ): Promise<ChangeSetId>;
  deleteChoice(actor: Actor, listId: string, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, target: ListDraftTarget): Promise<ChangeSetId>;
  // Sends a rejected draft for approval again, unchanged.
  resubmitDraft(actor: Actor, target: ListDraftTarget): Promise<ChangeSetId>;
}

export interface PeopleAccess {
  // Everyone the actor may see, with the columns whose values they may see, and the saved views
  // they may see. Reading anyone's Personal details is recorded in the access history.
  read(actor: Actor): Promise<{
    people: Person[];
    fields: Field[];
    order: string[];
    positionHidden?: true;
    views: SavedView[];
  }>;
  // Today's reporting lines as approved, with General details only, each person's draft of their
  // manager and team name beside, and the chart as drafts make it, as the reader may see them.
  // Telling anyone that a manager has left, or showing them a draft's Personal details, such as
  // its manager, its dates, or someone it adds, is recorded in the access history.
  readOrgChart(actor: Actor, on?: string): Promise<OrgChart>;
  // Sets the colour of a manager's named team, or removes it, at once rather than as a draft.
  setTeamColour(
    actor: Actor,
    managerId: string,
    colour: PaletteColour | null,
  ): Promise<void>;
  // Changes to people are drafts, which reach the live people once approved.
  create(
    actor: Actor,
    requests: readonly PersonRequest[],
  ): Promise<Saved<string[]>>;
  update(actor: Actor, id: string, change: PersonChange): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  // Sends a rejected draft for approval again, unchanged.
  resubmitDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  createField(actor: Actor, request: FieldRequest): Promise<Saved<Field>>;
  updateField(
    actor: Actor,
    id: string,
    request: FieldRequest,
  ): Promise<Saved<Field>>;
  deleteField(actor: Actor, id: string): Promise<ChangeSetId>;
  // Discards a draft of a column, or sends a rejected one for approval again.
  discardColumnDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  resubmitColumnDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  // Saved views of the People table, which anyone who sees people may save, and only their maker,
  // or someone who may change planning configuration, may change or delete.
  createView(
    actor: Actor,
    request: SavedViewRequest,
  ): Promise<Saved<SavedView>>;
  updateView(
    actor: Actor,
    id: string,
    change: SavedViewChange,
  ): Promise<Saved<SavedView>>;
  deleteView(actor: Actor, id: string): Promise<ChangeSetId>;
}

// Every change to planned hires is a draft, which reaches the live hires once approved. Reading the
// whole hiring plan is recorded in the access history, as is reading placeholders whose position or
// state is more sensitive than General.
export interface HireAccess {
  read(actor: Actor): Promise<Hires>;
  create(
    actor: Actor,
    requests: readonly HireRequest[],
  ): Promise<Saved<string[]>>;
  update(actor: Actor, id: string, change: HireChange): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  resubmitDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  fill(actor: Actor, id: string, fill: HireFill): Promise<ChangeSetId>;
}

export interface FeatureTeamAccess {
  read(actor: Actor, on?: string): Promise<FeatureTeams>;
  readMonths(actor: Actor, range: MonthRange): Promise<TeamMonths>;
  create(actor: Actor, request: FeatureTeamRequest): Promise<Saved<string>>;
  update(
    actor: Actor,
    id: string,
    change: FeatureTeamChange,
  ): Promise<ChangeSetId>;
  // Changes the teams someone is on from a day, drafted on each team.
  changeMemberTeams(
    actor: Actor,
    personId: string,
    change: MemberTeamsChange,
  ): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  resubmitDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  setColour(
    actor: Actor,
    id: string,
    colour: PaletteColour | null,
  ): Promise<void>;
}

function createFeatureTeamAccess(database: Database): FeatureTeamAccess {
  return {
    read: async (actor, on) => {
      const read = await featureTeamData.readFeatureTeams(database, actor, on);
      // The days members join or leave are Personal, so seeing them is recorded: those a draft
      // gives, and those a reader who sees Personal details can tell from teams on a chosen day, or
      // from the month a team disbands, which may draw on end dates.
      const sawDays =
        on === undefined
          ? read.teams.some(
              ({ draft, disbandedFrom }) =>
                draft?.days !== undefined ||
                draft?.leadDay !== undefined ||
                (disbandedFrom !== undefined && seesPersonalDetails(actor)),
            )
          : seesPersonalDetails(actor);
      if (sawDays) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      return read;
    },
    readMonths: async (actor, range) => {
      const read = await readTeamMonths(database, actor, range);
      // Rows and shaded months follow employment dates, which are Personal.
      if (seesPersonalDetails(actor)) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      return read;
    },
    create: async (actor, request) => {
      const { id, changeSetId } = await featureTeamData.createFeatureTeam(
        database,
        actor,
        request,
      );
      return { result: id, changeSetId };
    },
    update: async (actor, id, change) =>
      featureTeamData.updateFeatureTeam(database, actor, id, change),
    changeMemberTeams: async (actor, personId, change) =>
      featureTeamData.changeMemberTeams(database, actor, personId, change),
    delete: async (actor, id) =>
      featureTeamData.deleteFeatureTeam(database, actor, id),
    discardDraft: async (actor, id) =>
      featureTeamData.discardFeatureTeamDraft(database, actor, id),
    resubmitDraft: async (actor, id) =>
      featureTeamData.resubmitFeatureTeamDraft(database, actor, id),
    setColour: async (actor, id, colour) => {
      requirePermission(actor, "org-chart:view");
      requirePermission(actor, "team-colours:edit");
      await featureTeamData.setFeatureTeamColour(database, id, colour);
    },
  };
}

function createHireAccess(database: Database): HireAccess {
  return {
    read: async (actor) => {
      const { includedPersonal, ...read } = await hireData.readHires(
        database,
        actor,
      );
      if (read.wholePlan && read.hires.length > 0) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
          "hiring-plan-viewed",
        );
      } else if (includedPersonal) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      return read;
    },
    create: async (actor, requests) => {
      const { ids, changeSetId } = await hireData.createHires(
        database,
        actor,
        requests,
      );
      return { result: ids, changeSetId };
    },
    update: async (actor, id, change) =>
      hireData.updateHire(database, actor, id, change),
    delete: async (actor, id) => hireData.deleteHire(database, actor, id),
    discardDraft: async (actor, id) =>
      fills.discardDraft(database, actor, { kind: "planned-hire", id }),
    resubmitDraft: async (actor, id) =>
      fills.resubmitDraft(database, actor, { kind: "planned-hire", id }),
    fill: async (actor, id, fill) => fills.fillHire(database, actor, id, fill),
  };
}

// Checks the actor may change lists, and returns who to record as making the change.
function editor(actor: Actor): Actor {
  requirePermission(actor, "configuration:edit");
  return actor;
}

function createListAccess(database: Database): ListAccess {
  return {
    // Lists' choices are also read by those who see People, whose columns draw on them.
    read: async (actor) => {
      requireAnyPermission(actor, ["configuration:view", "people:view"]);
      return lists.readLists(database, actor);
    },
    create: async (actor, request) => {
      editor(actor);
      return lists.createList(database, actor, request);
    },
    update: async (actor, id, request) => {
      editor(actor);
      return lists.updateList(database, actor, id, request);
    },
    setRetired: async (actor, id, { retired }) =>
      lists.setListRetired(database, editor(actor), id, retired),
    delete: async (actor, id) => lists.deleteList(database, editor(actor), id),
    addChoices: async (actor, listId, requests) =>
      lists.addChoices(database, editor(actor), listId, requests),
    updateChoice: async (actor, listId, id, request) =>
      lists.updateChoice(database, editor(actor), listId, id, request),
    moveChoice: async (actor, listId, id, after) =>
      lists.moveChoice(database, editor(actor), listId, id, after),
    setChoiceRetired: async (actor, listId, id, { retired }) =>
      lists.setChoiceRetired(database, editor(actor), listId, id, retired),
    deleteChoice: async (actor, listId, id) =>
      lists.deleteChoice(database, editor(actor), listId, id),
    discardDraft: async (actor, target) =>
      lists.discardListDraft(
        database,
        editor(actor),
        target.kind,
        target.listId,
        target.kind === "choice" ? target.choiceId : undefined,
      ),
    resubmitDraft: async (actor, target) =>
      lists.resubmitListDraft(
        database,
        editor(actor),
        target.kind,
        target.listId,
        target.kind === "choice" ? target.choiceId : undefined,
      ),
  };
}

// Who may change each kind of the plan's records.
const recordEditors: Record<RecordType, Permission> = {
  "release-stream": "configuration:edit",
  "cycle-pattern": "configuration:edit",
  release: "plan:edit",
  feature: "features:edit",
  customer: "plan:edit",
  proposal: "plan:edit",
  project: "plan:edit",
  milestone: "plan:edit",
  allocation: "allocations:edit",
};

function recordEditor(actor: Actor, type: RecordType): Actor {
  // The kind is always one of the fixed kinds listed above.
  // eslint-disable-next-line security/detect-object-injection
  requirePermission(actor, recordEditors[type]);
  return actor;
}

function createReleaseAccess(database: Database): ReleaseAccess {
  const streams = (actor: Actor) => recordEditor(actor, "release-stream");
  const plan = (actor: Actor) => recordEditor(actor, "release");
  return {
    // Planning configuration is seen with the plan, as Roles proposes.
    read: async (actor) => {
      requireAnyPermission(actor, ["plan:view", "configuration:view"]);
      return {
        streams: await releases.readReleaseStreams(database, actor),
        canEditStreams: actor.permissions.includes("configuration:edit"),
        canEditReleases: actor.permissions.includes("plan:edit"),
      };
    },
    createStream: async (actor, request) =>
      releases.createStream(database, streams(actor), request),
    updateStream: async (actor, id, change) =>
      releases.updateStream(database, streams(actor), id, change),
    addPattern: async (actor, streamId, request) =>
      releases.addToStream(database, streams(actor), streamId, {
        type: "cycle-pattern",
        request,
      }),
    updatePattern: async (actor, streamId, id, request) =>
      releases.changeInStream(database, streams(actor), streamId, id, {
        type: "cycle-pattern",
        request,
      }),
    deletePattern: async (actor, streamId, id) =>
      releases.removeFromStream(
        database,
        streams(actor),
        streamId,
        "cycle-pattern",
        id,
        true,
      ),
    addRelease: async (actor, streamId, request) =>
      releases.addToStream(database, plan(actor), streamId, {
        type: "release",
        request,
      }),
    updateRelease: async (actor, streamId, id, request) =>
      releases.changeInStream(database, plan(actor), streamId, id, {
        type: "release",
        request,
      }),
    deleteRelease: async (actor, streamId, id) =>
      releases.removeFromStream(
        database,
        plan(actor),
        streamId,
        "release",
        id,
        actor.permissions.includes(recordEditors["cycle-pattern"]),
      ),
    updateReleaseNote: async (actor, streamId, id, request) =>
      releases.changeReleaseNote(
        database,
        plan(actor),
        streamId,
        id,
        request.note,
      ),
    changeCycleLength: async (actor, streamId, startsOn, request) =>
      releases.changeCycleLength(
        database,
        streams(actor),
        streamId,
        startsOn,
        request,
      ),
  };
}

// Which of the plan's records the actor may change.
const planAbilities = (actor: Actor) => ({
  canEdit: actor.permissions.includes("plan:edit"),
  canEditFeatures: actor.permissions.includes("features:edit"),
});

const edited = async (
  actor: Actor,
  saved: Promise<Saved<projectData.PlanRecords>>,
): Promise<Saved<ProjectPlan>> => {
  const { result, changeSetId } = await saved;
  return { result: { ...result, ...planAbilities(actor) }, changeSetId };
};

// How each kind of record is added and changed.
const planChanges = {
  customer: {
    add: projectData.addCustomer,
    change: projectData.changeCustomer,
  },
  project: { add: projectData.addProject, change: projectData.changeProject },
  proposal: {
    add: projectData.addProposal,
    change: projectData.changeProposal,
  },
  feature: { add: projectData.addFeature, change: projectData.changeFeature },
} as const;

function createProjectAccess(database: Database): ProjectAccess {
  return {
    read: async (actor) => {
      requirePermission(actor, "plan:view");
      return {
        ...(await projectData.readPlanRecords(database, actor)),
        ...planAbilities(actor),
      };
    },
    readChoices: async (actor) => {
      requirePermission(actor, "plan:view");
      return projectData.readPlanChoices(database);
    },
    createFeatureColumn: async (actor, request) =>
      columnDrafts.createField(database, editor(actor), request, "features"),
    updateFeatureColumn: async (actor, id, request) =>
      columnDrafts.updateField(
        database,
        editor(actor),
        id,
        request,
        "features",
      ),
    deleteFeatureColumn: async (actor, id) =>
      columnDrafts.deleteField(database, editor(actor), id, "features"),
    discardFeatureColumnDraft: async (actor, id) =>
      columnDrafts.discardColumnDraft(database, editor(actor), {
        id,
        table: "features",
      }),
    resubmitFeatureColumnDraft: async (actor, id) =>
      columnDrafts.resubmitColumnDraft(database, editor(actor), {
        id,
        table: "features",
      }),
    // The kind is one of the fixed kinds above, and the request the one it takes, as
    // PlanRecordRequest pairs them.
    add: async (actor, { type, request }) =>
      edited(
        actor,
        // eslint-disable-next-line security/detect-object-injection
        planChanges[type].add(
          database,
          recordEditor(actor, type),
          request as never,
        ),
      ),
    change: async (actor, id, { type, request }) =>
      edited(
        actor,
        // eslint-disable-next-line security/detect-object-injection
        planChanges[type].change(
          database,
          recordEditor(actor, type),
          id,
          request as never,
        ),
      ),
    remove: async (actor, type, id) =>
      projectData.removeRecord(database, recordEditor(actor, type), type, id),
    changeFeatureProjects: async (actor, featureId, request) =>
      edited(
        actor,
        projectData.changeFeatureProjects(
          database,
          recordEditor(actor, "project"),
          featureId,
          request,
        ),
      ),
    addMilestone: async (actor, projectId, request) =>
      edited(
        actor,
        projectData.addMilestone(
          database,
          recordEditor(actor, "milestone"),
          projectId,
          request,
        ),
      ),
    changeMilestone: async (actor, projectId, id, request) =>
      edited(
        actor,
        projectData.changeMilestone(
          database,
          recordEditor(actor, "milestone"),
          projectId,
          id,
          request,
        ),
      ),
    removeMilestone: async (actor, projectId, id) =>
      projectData.removeMilestone(
        database,
        recordEditor(actor, "milestone"),
        projectId,
        id,
      ),
  };
}

function createPeopleAccess(database: Database): PeopleAccess {
  return {
    read: async (actor) => {
      requirePermission(actor, "people:view");
      const read = await peopleData.readPeople(database, actor);
      if (read.includedPersonal) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      if (read.hiringPlanViewed) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
          "hiring-plan-viewed",
        );
      }
      // The columns as their drafts make them, and their order, as the actor may see them.
      // Read as of one moment, so an approval saved meanwhile is seen whole or not at all.
      const columns = await database.transaction(
        (transaction) => readColumnsOut(transaction, actor),
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
      return {
        people: read.people,
        ...columns,
        ...(read.positionHidden ? { positionHidden: true as const } : {}),
        views: await views.readViews(database, actor),
      };
    },
    readOrgChart: async (actor, on) => {
      requirePermission(actor, "org-chart:view");
      const { includedPersonal, includedHiringPlan, ...chart } = await (on ===
      undefined
        ? readOrgChart(database, actor)
        : readOrgChartOn(database, actor, on));
      if (includedPersonal) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      if (includedHiringPlan) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
          "hiring-plan-viewed",
        );
      }
      return chart;
    },
    setTeamColour: async (actor, managerId, colour) => {
      requirePermission(actor, "org-chart:view");
      requirePermission(actor, "team-colours:edit");
      await setTeamColour(database, managerId, colour);
    },
    create: async (actor, requests) => {
      const { ids, changeSetId } = await peopleData.createPeople(
        database,
        actor,
        requests,
      );
      return { result: ids, changeSetId };
    },
    update: async (actor, id, change) =>
      peopleData.updatePerson(database, actor, id, change),
    delete: async (actor, id) => peopleData.deletePerson(database, actor, id),
    discardDraft: async (actor, id) =>
      fills.discardDraft(database, actor, { kind: "person", id }),
    resubmitDraft: async (actor, id) =>
      fills.resubmitDraft(database, actor, { kind: "person", id }),
    createField: async (actor, request) => {
      editor(actor);
      return columnDrafts.createField(database, actor, request);
    },
    updateField: async (actor, id, request) => {
      editor(actor);
      return columnDrafts.updateField(database, actor, id, request);
    },
    deleteField: async (actor, id) => {
      editor(actor);
      return columnDrafts.deleteField(database, actor, id);
    },
    discardColumnDraft: async (actor, id) =>
      columnDrafts.discardColumnDraft(database, editor(actor), { id }),
    resubmitColumnDraft: async (actor, id) =>
      columnDrafts.resubmitColumnDraft(database, editor(actor), { id }),
    createView: async (actor, request) => {
      requirePermission(actor, "people:view");
      return views.createView(database, actor, request);
    },
    updateView: async (actor, id, change) => {
      requirePermission(actor, "people:view");
      return views.updateView(database, actor, id, change);
    },
    deleteView: async (actor, id) => {
      requirePermission(actor, "people:view");
      return views.deleteView(database, actor, id);
    },
  };
}

export function createDataAccess(database: Database): DataAccess {
  return {
    async checkConnection() {
      try {
        await database.execute(sql`SELECT 1`);
      } catch (error) {
        throw new Error(
          "Could not query the database; check the FATHOM_DB_* settings",
          { cause: error },
        );
      }
    },
    readActorAccess: (userId, sessionId, rememberedRoleId) =>
      readActorAccess(database, userId, sessionId, rememberedRoleId),
    switchRole: (actor, sessionId, roleId) =>
      switchRole(database, actor.user.id, sessionId, roleId),
    keepSessionRole: (token, roleId) =>
      keepSessionRole(database, token, roleId),
    readHistory: async (actor) => {
      requirePermission(actor, "history:view");
      return readHistory(database, actor.permissions.includes("people:view"));
    },
    readChanges: async (actor, before, search) => {
      requirePermission(actor, "changes:view");
      const read = await readChangeHistory(database, actor, before, search);
      if (read.includedSensitive) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      return { entries: read.entries, next: read.next };
    },
    lists: createListAccess(database),
    releases: createReleaseAccess(database),
    projects: createProjectAccess(database),
    allocations: {
      read: async (actor) => {
        const { includedPersonal, ...read } = await readAllocations(
          database,
          actor,
        );
        // Allocations of someone who has not started tell of their start date, which is Personal.
        if (includedPersonal) {
          await recordPersonalView(
            database,
            actor.user.id,
            await readTimeZone(database),
          );
        }
        return read;
      },
      change: async (actor, change) =>
        changeAllocation(database, recordEditor(actor, "allocation"), change),
    },
    records: {
      discardDraft: async (actor, type, id) =>
        discardRecordDraft(
          database,
          recordEditor(actor, type),
          type,
          id,
          actor.permissions.includes(recordEditors["cycle-pattern"]),
        ),
      resubmitDraft: async (actor, type, id) =>
        resubmitRecordDraft(database, recordEditor(actor, type), type, id),
    },
    drafts: {
      approve: async (actor, asked) =>
        approveDrafts(database, actor, draftsRequestSchema.parse(asked)),
      reject: async (actor, asked, reason) =>
        rejectDrafts(database, actor, draftsRequestSchema.parse(asked), reason),
    },
    people: createPeopleAccess(database),
    hires: createHireAccess(database),
    featureTeams: createFeatureTeamAccess(database),
    unpublished: {
      read: async (actor) => readUnpublished(database, actor),
      publish: async (actor) => publishUnpublished(database, actor),
      discard: async (actor) => discardUnpublished(database, actor),
    },
    undo: async (actor, changeSetId) =>
      undoChangeSet(database, actor, changeSetId),
    readGreeting: async (actor) => {
      requirePermission(actor, "plan:view");
      return readGreeting(database);
    },
    readSettings: async () => readSettings(database),
    readEffortConversions: async (actor) =>
      readEffortConversions(database, actor),
    changeEffortConversions: async (actor, conversions) =>
      changeEffortConversions(database, actor, conversions),
    changeTimeZone: async (actor, timeZone) =>
      changeTimeZone(database, actor, timeZone),
    changePasswordSettings: async (actor, passwords) =>
      changePasswordSettings(database, actor, passwords),
    checkChosenPassword: async (password, owner) =>
      checkChosenPassword(database, password, owner),
  };
}
