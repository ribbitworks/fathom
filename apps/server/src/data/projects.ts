// SPDX-License-Identifier: Apache-2.0

// Customers, projects with their milestones, workstreams, proposals, and features: reading them as
// the viewer sees them, each project with its dates from its milestones, and drafting each added,
// changed, and removed.
// Part of the data access layer; the caller checks the actor's permissions. Every change is a
// draft of a plan record, as records.ts sets out, with the kinds project-kinds.ts describes.

import { type Database, featureTeams, people } from "@fathom/db";
import {
  type CustomerRequest,
  type Customer,
  type Feature,
  type FeatureColumns,
  type FeatureDraft,
  type FeatureRequest,
  type BuiltInList,
  type List,
  type Meaning,
  meaningSchema,
  type Milestone,
  type MilestoneRequest,
  type PlanChoices,
  type Project,
  type ProjectPlan,
  type ProjectRequest,
  type Proposal,
  type ProposalRequest,
  projectDates,
  type RecordType,
  recordTypeOf,
  sameDates,
  type Workstream,
  type WorkstreamRequest,
} from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import {
  checkBuiltInChoice,
  firstOfferedOrRefused,
  listChoices,
} from "./built-in-lists.ts";
import type { Saved, Transaction } from "./changes.ts";
import { type Recorded, tidy } from "./drafts.ts";
import { checkTeamForFeature, readTeamDrafts } from "./feature-teams.ts";
import { readColumnsOut } from "./column-drafts.ts";
import { liveValuesOf, typeOf } from "./column-types.ts";
import { readListsWithin } from "./lists.ts";
import {
  checkedLinks,
  checkedNotes,
  checkedNumbers,
  checkedValues,
  linksOf,
  notesOf,
  numbersOf,
  valuesOf,
} from "./people.ts";
import { milestonesOf } from "./project-kinds.ts";
import { isGeneralFeature, isWorkstream } from "./release-kinds.ts";
import {
  fieldOfValue,
  inListOrder,
  readColumns,
  valueField,
} from "./values.ts";
import {
  addedOnly,
  linkedIds,
  type RecordsState,
  shownIds,
  shownVersion,
  stateOf,
  versionOf,
} from "./record-state.ts";
import {
  changeableRecord,
  discardRecordDraft,
  drafting,
  keptNote,
  kindOf,
  type Makers,
  readRecordMakers,
  readRecordsState,
  recordDraftOut,
  type RecordDraftOut,
  recordHeldBy,
  saveRecordDraft,
  saveRecordDrafts,
  type Wanted,
} from "./records.ts";
import { readToday } from "./settings.ts";

export type PlanRecords = Omit<ProjectPlan, "canEdit" | "canEditFeatures">;

const extras = (
  state: RecordsState,
  makers: Makers,
  type: RecordType,
  id: string,
) => {
  const draft = recordDraftOut(kindOf(type), state, makers, id);
  return {
    ...(draft === undefined ? {} : { draft }),
    ...recordHeldBy(state, type, id),
  };
};

const text = (value: unknown) => (typeof value === "string" ? value : null);

// A draft of a feature, naming its added columns as a person's draft does.
function featureDraftOf(draft: RecordDraftOut): FeatureDraft {
  const columnOf = (field: string) => fieldOfValue(field) ?? field;
  const inColumns = Object.entries(draft.live).flatMap(
    ([field, value]): [string, unknown][] => {
      const column = fieldOfValue(field);
      return column === null ? [] : [[column, value]];
    },
  );
  return {
    ...draft,
    changed: draft.changed.map(columnOf),
    live: {
      ...Object.fromEntries(
        Object.entries(draft.live).filter(
          ([field]) => fieldOfValue(field) === null,
        ),
      ),
      ...liveValuesOf(new Map(inColumns)),
    },
    changedBy: Object.fromEntries(
      Object.entries(draft.changedBy).map(([field, editor]) => [
        columnOf(field),
        editor,
      ]),
    ),
  };
}

// Who drafted and holds a list and its choices is for those who may see Lists, or People, whose
// columns draw on them, as the Decisions Log's "Who changed what" sets out.
const seesListDrafts = ({ permissions }: Actor) =>
  permissions.includes("configuration:view") ||
  permissions.includes("people:view");

function withoutDrafts(list: List): List {
  const plain: List = {
    ...list,
    choices: list.choices.map((listed) => {
      const choice = { ...listed };
      delete choice.draft;
      delete choice.heldBy;
      return choice;
    }),
  };
  delete plain.draft;
  delete plain.orderDraft;
  delete plain.heldBy;
  delete plain.orderHeldBy;
  return plain;
}

// The columns added to Features as the viewer sees them, and the lists they draw on. Those lists'
// choices go to everyone who sees the plan, so only General ones are sent, as a column on Features
// may draw only on those.
async function featureColumnsOut(
  transaction: Transaction,
  viewer: Actor,
): Promise<FeatureColumns> {
  const { fields, order } = await readColumnsOut(
    transaction,
    viewer,
    "features",
  );
  const drawnOn = new Set(
    fields.flatMap((field) => [field.listId, field.draft?.live.listId]),
  );
  return {
    fields,
    order,
    lists: (await readListsWithin(transaction, viewer))
      .filter((list) => drawnOn.has(list.id) && list.visibility === "general")
      .map((list) => (seesListDrafts(viewer) ? list : withoutDrafts(list))),
  };
}

// The records of a kind shown: the live ones by name, then those drafted to be added, in the order
// drafted.
function inOrder(state: RecordsState, type: RecordType): string[] {
  const { live } = stateOf(state, type);
  const name = (id: string) => String(shownVersion(state, type, id)?.name);
  return [
    ...[...live.keys()].sort((a, b) => name(a).localeCompare(name(b))),
    ...shownIds(state, type).filter((id) => !live.has(id)),
  ];
}

const projectRowsOfKind = (state: RecordsState, kind: ProjectRowKind) =>
  inOrder(state, "project").filter(
    (id) => shownVersion(state, "project", id)?.kind === kind,
  );

function milestoneOut(
  state: RecordsState,
  makers: Makers,
  id: string,
): Milestone {
  const milestone = shownVersion(state, "milestone", id) as Recorded;
  return {
    id,
    projectId: String(milestone.projectId),
    name: String(milestone.name),
    date: String(milestone.date),
    customerDelivery: milestone.customerDelivery === true,
    ...extras(state, makers, "milestone", id),
  };
}

const asDay = (milestone: Recorded) => ({
  date: String(milestone.date),
  customerDelivery: milestone.customerDelivery === true,
});

// A project's milestones by day, its dates as their drafts make them, those drafted to be removed
// left out, and, where that differs, its dates from the live milestones.
function projectOut(
  state: RecordsState,
  makers: Makers,
  id: string,
  today: string,
): Project {
  const project = shownVersion(state, "project", id) as Recorded;
  const found = milestonesOf(state, id);
  const drafted = found.flatMap((milestone) => {
    const version = versionOf(state, "milestone", milestone);
    return version === undefined ? [] : [asDay(version)];
  });
  const live = [...stateOf(state, "milestone").live.values()]
    .filter((milestone) => milestone.projectId === id)
    .map(asDay);
  const dates = projectDates(drafted, today);
  const liveDates = projectDates(live, today);
  return {
    id,
    name: String(project.name),
    externalId: text(project.externalId),
    ownerId: text(project.ownerId),
    customerIds: linkedIds(project, "customerIds"),
    proposalIds: linkedIds(project, "proposalIds"),
    milestones: found
      .map((milestone) => milestoneOut(state, makers, milestone))
      .sort(
        (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
      ),
    dates,
    ...(sameDates(dates, liveDates) ? {} : { liveDates }),
    ...extras(state, makers, "project", id),
  };
}

function workstreamOut(
  state: RecordsState,
  makers: Makers,
  id: string,
): Workstream {
  const workstream = shownVersion(state, "project", id) as Recorded;
  return {
    id,
    name: String(workstream.name),
    ownerId: text(workstream.ownerId),
    ...extras(state, makers, "project", id),
  };
}

function proposalOut(
  state: RecordsState,
  makers: Makers,
  id: string,
): Proposal {
  const proposal = shownVersion(state, "proposal", id) as Recorded;
  return {
    id,
    name: String(proposal.name),
    externalId: text(proposal.externalId),
    link: text(proposal.link),
    ownerId: text(proposal.ownerId),
    customerIds: linkedIds(proposal, "customerIds"),
    statusId: String(proposal.statusId),
    ...extras(state, makers, "proposal", id),
  };
}

function featureOut(state: RecordsState, makers: Makers, id: string): Feature {
  const feature = shownVersion(state, "feature", id) as Recorded;
  const { draft, ...heldBy } = extras(state, makers, "feature", id);
  return {
    id,
    name: String(feature.name),
    statusId: String(feature.statusId),
    neededBy: text(feature.neededBy),
    customerIds: linkedIds(feature, "customerIds"),
    targetStreamId: text(feature.targetStreamId),
    targetCycle: text(feature.targetCycle),
    estimateHours:
      typeof feature.estimateHours === "number" ? feature.estimateHours : null,
    featureTeamId: text(feature.featureTeamId),
    workstreamId: text(feature.workstreamId),
    description: text(feature.description),
    note: text(feature.note),
    values: Object.fromEntries(valuesOf(feature)),
    links: linksOf(feature),
    notes: notesOf(feature),
    numbers: numbersOf(feature),
    ...(draft === undefined ? {} : { draft: featureDraftOf(draft) }),
    ...heldBy,
  };
}

async function planOut(
  transaction: Transaction,
  viewer: Actor,
  state: RecordsState,
  today: string,
): Promise<PlanRecords> {
  const makers = await readRecordMakers(transaction, state, viewer);
  return {
    customers: inOrder(state, "customer").map((id): Customer => ({
      id,
      name: String(shownVersion(state, "customer", id)?.name),
      ...extras(state, makers, "customer", id),
    })),
    projects: projectRowsOfKind(state, "project").map((id) =>
      projectOut(state, makers, id, today),
    ),
    workstreams: projectRowsOfKind(state, "workstream").map((id) =>
      workstreamOut(state, makers, id),
    ),
    proposals: inOrder(state, "proposal").map((id) =>
      proposalOut(state, makers, id),
    ),
    features: inOrder(state, "feature")
      .filter((id) => !isGeneralFeature(state, id))
      .map((id) => featureOut(state, makers, id)),
    featureColumns: await featureColumnsOut(transaction, viewer),
  };
}

// Every customer, project, proposal, and feature as the viewer sees them.
export async function readPlanRecords(
  database: Database,
  viewer: Actor,
  asOf?: string,
): Promise<PlanRecords> {
  const today = asOf ?? (await readToday(database));
  // Read as of one moment, so an approval saved meanwhile is seen whole or not at all.
  return database.transaction(
    async (transaction) => {
      const state = await readRecordsState(transaction, viewer.user.id);
      return planOut(transaction, viewer, state, today);
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Runs a change, and answers with every record as the editor now sees them.
async function changingPlan(
  database: Database,
  editor: Actor,
  change: (
    transaction: Transaction,
    state: RecordsState,
  ) => Promise<string | null>,
  asOf?: string,
): Promise<Saved<PlanRecords>> {
  const today = asOf ?? (await readToday(database));
  return drafting(database, editor.user.id, async (transaction, state) => {
    const changeSetId = await change(transaction, state);
    const now = await readRecordsState(transaction, editor.user.id);
    return {
      result: await planOut(transaction, editor, now, today),
      changeSetId,
    };
  });
}

// Refuses an owner who is not one of People.
async function checkOwner(
  transaction: Transaction,
  ownerId: string | null,
): Promise<void> {
  if (ownerId === null) return;
  const [found] = await transaction
    .select({ id: people.id })
    .from(people)
    .where(eq(people.id, ownerId));
  if (found === undefined) {
    throw new BadRequestError("Choose an owner from People");
  }
}

// A customer, project, workstream, proposal, or feature, as a request adds or changes it.
export type PlanRecordRequest =
  | { type: "customer"; request: CustomerRequest }
  | { type: "project"; request: ProjectRequest }
  | { type: "workstream"; request: WorkstreamRequest }
  | { type: "proposal"; request: ProposalRequest }
  | { type: "feature"; request: FeatureRequest };

export type PlanKind = PlanRecordRequest["type"];

type ProjectRowKind = Extract<PlanKind, "project" | "workstream">;

// A project or workstream to change, refusing a row of the other kind.
function changeableProjectRow(
  state: RecordsState,
  kind: ProjectRowKind,
  id: string,
): Recorded {
  const shown = shownVersion(state, "project", id);
  if (shown !== undefined && shown.kind !== kind) {
    throw new NotFoundError(`There is no such ${kind}`);
  }
  return changeableRecord(state, "project", id);
}

// What refuses removing each kind of record that can't be changed.
const refuseUnchangeable: Readonly<
  Record<PlanKind, (state: RecordsState, id: string) => void>
> = {
  customer: (state, id) => changeableRecord(state, "customer", id),
  project: (state, id) => changeableProjectRow(state, "project", id),
  workstream: (state, id) => changeableProjectRow(state, "workstream", id),
  proposal: (state, id) => changeableRecord(state, "proposal", id),
  feature: (state, id) => changeableRecord(state, "feature", id),
};

export async function addCustomer(
  database: Database,
  maker: Actor,
  request: CustomerRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, (transaction, state) =>
    saveRecordDraft(transaction, maker, state, "customer", randomUUID(), {
      name: request.name,
    }),
  );
}

export async function changeCustomer(
  database: Database,
  maker: Actor,
  id: string,
  request: CustomerRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, (transaction, state) =>
    saveRecordDraft(transaction, maker, state, "customer", id, {
      ...changeableRecord(state, "customer", id),
      name: request.name,
    }),
  );
}

type ProjectRow = Recorded & {
  kind: ProjectRowKind;
  ownerId: string | null;
};

const projectRecord = (request: ProjectRequest): ProjectRow => ({
  kind: "project",
  name: request.name,
  externalId: request.externalId,
  ownerId: request.ownerId,
  customerIds: request.customerIds,
  proposalIds: request.proposalIds,
});

const workstreamRecord = (request: WorkstreamRequest): ProjectRow => ({
  kind: "workstream",
  name: request.name,
  externalId: null,
  ownerId: request.ownerId,
  customerIds: [],
  proposalIds: [],
});

const addProjectRow = (
  database: Database,
  maker: Actor,
  record: ProjectRow,
): Promise<Saved<PlanRecords>> =>
  changingPlan(database, maker, async (transaction, state) => {
    await checkOwner(transaction, record.ownerId);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "project",
      randomUUID(),
      record,
    );
  });

const changeProjectRow = (
  database: Database,
  maker: Actor,
  id: string,
  record: ProjectRow,
): Promise<Saved<PlanRecords>> =>
  changingPlan(database, maker, async (transaction, state) => {
    changeableProjectRow(state, record.kind, id);
    await checkOwner(transaction, record.ownerId);
    return saveRecordDraft(transaction, maker, state, "project", id, record);
  });

export const addProject = (
  database: Database,
  maker: Actor,
  request: ProjectRequest,
) => addProjectRow(database, maker, projectRecord(request));

export const changeProject = (
  database: Database,
  maker: Actor,
  id: string,
  request: ProjectRequest,
) => changeProjectRow(database, maker, id, projectRecord(request));

export const addWorkstream = (
  database: Database,
  maker: Actor,
  request: WorkstreamRequest,
) => addProjectRow(database, maker, workstreamRecord(request));

export const changeWorkstream = (
  database: Database,
  maker: Actor,
  id: string,
  request: WorkstreamRequest,
) => changeProjectRow(database, maker, id, workstreamRecord(request));

type StatusList = Extract<
  BuiltInList,
  "proposal-statuses" | "feature-statuses"
>;

// How a record with no status starts: in the first status offered, of a meaning when one is named.
const startingStatus: Readonly<
  Record<StatusList, { meaning?: Meaning; missing: string }>
> = {
  "proposal-statuses": {
    missing: "No proposal status is offered. Add one to the list first.",
  },
  "feature-statuses": {
    meaning: "possible",
    missing: "No feature status means Possible. Add one to the list first.",
  },
};

// The status a record is given: the one asked for, if it is offered or the record already has it,
// or, for a record added without one, the first status it can start in.
async function statusFor(
  transaction: Transaction,
  list: StatusList,
  asked: string | undefined,
  had: unknown,
): Promise<string> {
  if (asked !== undefined) {
    await checkBuiltInChoice(transaction, list, asked, had);
    return asked;
  }
  if (typeof had === "string") return had;
  // The list is always one of the two above.
  // eslint-disable-next-line security/detect-object-injection
  const { meaning, missing } = startingStatus[list];
  return firstOfferedOrRefused(transaction, list, meaning, missing);
}

async function proposalRecord(
  transaction: Transaction,
  request: ProposalRequest,
  had?: unknown,
) {
  await checkOwner(transaction, request.ownerId);
  return {
    name: request.name,
    externalId: request.externalId,
    link: request.link,
    ownerId: request.ownerId,
    customerIds: request.customerIds,
    statusId: await statusFor(
      transaction,
      "proposal-statuses",
      request.statusId,
      had,
    ),
  };
}

export async function addProposal(
  database: Database,
  maker: Actor,
  request: ProposalRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) =>
    saveRecordDraft(
      transaction,
      maker,
      state,
      "proposal",
      randomUUID(),
      await proposalRecord(transaction, request),
    ),
  );
}

export async function changeProposal(
  database: Database,
  maker: Actor,
  id: string,
  request: ProposalRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    const proposal = changeableRecord(state, "proposal", id);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "proposal",
      id,
      await proposalRecord(transaction, request, proposal.statusId),
    );
  });
}

// A feature's values in the columns added to Features: those a request names replace those it has,
// each checked against its column, and every required column must then hold one.
async function featureValues(
  transaction: Transaction,
  request: FeatureRequest,
  current: Recorded | undefined,
): Promise<Recorded> {
  const columns = await readColumns(transaction, true, "features");
  const known = await inListOrder(
    transaction,
    Object.values(request.values).flat(),
  );
  const had = current === undefined ? undefined : valuesOf(current);
  const chosen = checkedValues(columns, known, request.values, had);
  const kept = Object.fromEntries(
    Object.entries(current ?? {}).filter(
      ([field]) => fieldOfValue(field) !== null,
    ),
  );
  const values: Recorded = {
    ...kept,
    ...Object.fromEntries(
      [...chosen].map(([fieldId, ids]) => [valueField(fieldId), ids]),
    ),
    ...checkedLinks(columns, request.links),
    ...checkedNotes(columns, request.notes),
    ...checkedNumbers(columns, request.numbers),
  };
  for (const column of columns) {
    if (
      column.required &&
      typeOf(column).count(values[valueField(column.id)]) === 0
    ) {
      throw new BadRequestError(`${column.name} must be filled in`);
    }
  }
  return tidy(values);
}

async function featureRecord(
  transaction: Transaction,
  state: RecordsState,
  request: FeatureRequest,
  current?: Recorded,
) {
  if (
    request.workstreamId !== null &&
    !isWorkstream(state, request.workstreamId)
  ) {
    throw new BadRequestError("Choose a workstream");
  }
  await checkTeamForFeature(transaction, request.featureTeamId);
  const added = await featureValues(transaction, request, current);
  return {
    ...added,
    name: request.name,
    statusId: await statusFor(
      transaction,
      "feature-statuses",
      request.statusId,
      current?.statusId,
    ),
    neededBy: request.neededBy,
    customerIds: request.customerIds,
    targetStreamId: request.target?.streamId ?? null,
    targetCycle: request.target?.cycle ?? null,
    estimateHours: request.estimateHours,
    featureTeamId: request.featureTeamId,
    workstreamId: request.workstreamId,
    description: request.description,
    note: keptNote(request.note),
  };
}

export async function addFeature(
  database: Database,
  maker: Actor,
  request: FeatureRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) =>
    saveRecordDraft(
      transaction,
      maker,
      state,
      "feature",
      randomUUID(),
      await featureRecord(transaction, state, request),
    ),
  );
}

export async function changeFeature(
  database: Database,
  maker: Actor,
  id: string,
  request: FeatureRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    const feature = changeableRecord(state, "feature", id);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "feature",
      id,
      await featureRecord(transaction, state, request, feature),
    );
  });
}

// A project's milestone to change, refusing one of another project.
function projectMilestone(
  state: RecordsState,
  projectId: string,
  id: string,
): Recorded {
  const milestone = changeableRecord(state, "milestone", id);
  if (milestone.projectId !== projectId) {
    throw new NotFoundError("There is no such milestone in this project");
  }
  return milestone;
}

const milestoneRecord = (projectId: string, request: MilestoneRequest) => ({
  projectId,
  name: request.name,
  date: request.date,
  customerDelivery: request.customerDelivery,
});

// Saving refuses a project that does not exist, as it does any link to a record.
export async function addMilestone(
  database: Database,
  maker: Actor,
  projectId: string,
  request: MilestoneRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, (transaction, state) => {
    if (isWorkstream(state, projectId)) {
      throw new ConflictError("A workstream has no milestones");
    }
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "milestone",
      randomUUID(),
      milestoneRecord(projectId, request),
    );
  });
}

export async function changeMilestone(
  database: Database,
  maker: Actor,
  projectId: string,
  id: string,
  request: MilestoneRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, (transaction, state) => {
    projectMilestone(state, projectId, id);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "milestone",
      id,
      milestoneRecord(projectId, request),
    );
  });
}

// Drafts removing a record, refusing one another record still uses; removing one only drafted to
// be added discards its draft, as records.ts discards drafts. A project is removed with its
// milestones.
async function removing(
  database: Database,
  maker: Actor,
  type: RecordType,
  id: string,
  check: (state: RecordsState) => void,
): Promise<string | null> {
  const discards = await drafting(
    database,
    maker.user.id,
    (_transaction, state) => {
      check(state);
      return Promise.resolve(addedOnly(state, type, id));
    },
  );
  if (discards) return discardRecordDraft(database, maker, type, id, true);
  return drafting(database, maker.user.id, (transaction, state) => {
    check(state);
    const wanted: Wanted[] = [{ type, id, record: undefined }];
    if (type === "project") {
      for (const milestone of milestonesOf(state, id)) {
        if (versionOf(state, "milestone", milestone) !== undefined) {
          changeableRecord(state, "milestone", milestone);
          wanted.push({ type: "milestone", id: milestone, record: undefined });
        }
      }
    }
    return saveRecordDrafts(transaction, maker, state, wanted);
  });
}

export async function removeRecord(
  database: Database,
  maker: Actor,
  kind: PlanKind,
  id: string,
): Promise<string | null> {
  return removing(database, maker, recordTypeOf(kind), id, (state) => {
    // The kind is always one of the fixed kinds.
    // eslint-disable-next-line security/detect-object-injection
    refuseUnchangeable[kind](state, id);
  });
}

export async function removeMilestone(
  database: Database,
  maker: Actor,
  projectId: string,
  id: string,
): Promise<string | null> {
  return removing(database, maker, "milestone", id, (state) => {
    projectMilestone(state, projectId, id);
  });
}

// People as owners, by name alone, those whose end date has passed retired, the proposal and feature
// statuses, in their lists' order, and the live feature teams by name, those drafted to be removed
// retired.
export async function readPlanChoices(
  database: Database,
  asOf?: string,
): Promise<PlanChoices> {
  const today = asOf ?? (await readToday(database));
  const owners = await database
    .select({
      id: people.id,
      name: people.preferredName,
      endDate: people.endDate,
    })
    .from(people)
    .orderBy(asc(people.preferredName), asc(people.id));
  const statuses = await listChoices(database, "proposal-statuses");
  const featureStatuses = await listChoices(database, "feature-statuses");
  const teams = await database
    .select({ id: featureTeams.id, name: featureTeams.name })
    .from(featureTeams)
    .orderBy(asc(featureTeams.name), asc(featureTeams.id));
  const teamDrafts = await readTeamDrafts(database);
  return {
    owners: owners.map(({ id, name, endDate }) => ({
      id,
      name,
      retired: endDate !== null && endDate < today,
    })),
    statuses: statuses.map(({ id, name, retired }) => ({ id, name, retired })),
    featureStatuses: featureStatuses.map((status) => ({
      ...status,
      meaning: meaningSchema.parse(status.meaning),
    })),
    featureTeams: teams.map((team) => ({
      ...team,
      retired: teamDrafts.get(team.id)?.action === "deleted",
    })),
  };
}
