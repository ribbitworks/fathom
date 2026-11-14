// SPDX-License-Identifier: Apache-2.0

// Customers, projects with their milestones, proposals, and features: reading them as the viewer
// sees them, each project with its dates from its milestones, and drafting each added, changed, and
// removed.
// Part of the data access layer; the caller checks the actor's permissions. Every change is a
// draft of a plan record, as records.ts sets out, with the kinds project-kinds.ts describes.

import { type Database, featureTeams, people } from "@fathom/db";
import {
  type CustomerRequest,
  type Customer,
  type Feature,
  type FeatureColumns,
  type FeatureDraft,
  featureNamerKeys,
  type FeatureProjectsRequest,
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
  type RemovalReasonRequest,
  removalReasonsAfter,
  removalReasonsIn,
  withRemovalReason,
  type RecordType,
  sameDates,
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
import { staffedFeatures } from "./allocations.ts";
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
import { isGeneralFeature } from "./release-kinds.ts";
import { text } from "./reporting.ts";
import {
  fieldOfValue,
  inListOrder,
  readColumns,
  valueField,
} from "./values.ts";
import {
  addedOnly,
  linkedIds,
  recordExists,
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
    featureIds: linkedIds(project, "featureIds"),
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

// The reasons a proposal keeps for the features removed from it, by feature.
const reasonsOf = (proposal: Recorded | undefined): Record<string, string> =>
  removalReasonsIn(proposal?.removalReasons);

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
    featureIds: linkedIds(proposal, "featureIds"),
    removalReasons: reasonsOf(proposal),
    ...extras(state, makers, "proposal", id),
  };
}

function featureOut(
  state: RecordsState,
  makers: Makers,
  staffed: ReturnType<typeof staffedFeatures>,
  id: string,
): Feature {
  const feature = shownVersion(state, "feature", id) as Recorded;
  const { draft, ...heldBy } = extras(state, makers, "feature", id);
  return {
    id,
    name: String(feature.name),
    statusId: String(feature.statusId),
    priorityId: text(feature.priorityId),
    sizeId: text(feature.sizeId),
    riskId: text(feature.riskId),
    neededBy: text(feature.neededBy),
    customerIds: linkedIds(feature, "customerIds"),
    targetStreamId: text(feature.targetStreamId),
    targetCycle: text(feature.targetCycle),
    estimateHours:
      typeof feature.estimateHours === "number" ? feature.estimateHours : null,
    featureTeamId: text(feature.featureTeamId),
    description: text(feature.description),
    note: text(feature.note),
    values: Object.fromEntries(valuesOf(feature)),
    links: linksOf(feature),
    notes: notesOf(feature),
    numbers: numbersOf(feature),
    staffed: staffed.drafted.has(id),
    staffedLive: staffed.live.has(id),
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
  const staffed = staffedFeatures(state);
  return {
    customers: inOrder(state, "customer").map((id): Customer => ({
      id,
      name: String(shownVersion(state, "customer", id)?.name),
      ...extras(state, makers, "customer", id),
    })),
    projects: inOrder(state, "project").map((id) =>
      projectOut(state, makers, id, today),
    ),
    proposals: inOrder(state, "proposal").map((id) =>
      proposalOut(state, makers, id),
    ),
    features: inOrder(state, "feature")
      .filter((id) => !isGeneralFeature(state, id))
      .map((id) => featureOut(state, makers, staffed, id)),
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

// Refuses a project's general feature, which is off the roadmap, as a feature a record names.
function checkRoadmapFeatures(
  state: RecordsState,
  featureIds: readonly string[],
): void {
  if (featureIds.some((id) => isGeneralFeature(state, id))) {
    throw new BadRequestError("Choose features from Features");
  }
}

// A customer, project, proposal, or feature, as a request adds or changes it.
export type PlanRecordRequest =
  | { type: "customer"; request: CustomerRequest }
  | { type: "project"; request: ProjectRequest }
  | { type: "proposal"; request: ProposalRequest }
  | { type: "feature"; request: FeatureRequest };

export type PlanKind = PlanRecordRequest["type"];

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

const projectRecord = (request: ProjectRequest) => ({
  name: request.name,
  externalId: request.externalId,
  ownerId: request.ownerId,
  customerIds: request.customerIds,
  proposalIds: request.proposalIds,
  featureIds: request.featureIds,
});

export async function addProject(
  database: Database,
  maker: Actor,
  request: ProjectRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    await checkOwner(transaction, request.ownerId);
    checkRoadmapFeatures(state, request.featureIds);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "project",
      randomUUID(),
      projectRecord(request),
    );
  });
}

export async function changeProject(
  database: Database,
  maker: Actor,
  id: string,
  request: ProjectRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    changeableRecord(state, "project", id);
    await checkOwner(transaction, request.ownerId);
    checkRoadmapFeatures(state, request.featureIds);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "project",
      id,
      projectRecord(request),
    );
  });
}

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

// A proposal as a request makes it, from the version shown, if any.
async function proposalRecord(
  transaction: Transaction,
  state: RecordsState,
  request: ProposalRequest,
  current?: Recorded,
) {
  await checkOwner(transaction, request.ownerId);
  checkRoadmapFeatures(state, request.featureIds);
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
      current?.statusId,
    ),
    featureIds: request.featureIds,
    removalReasons: removalReasonsAfter(
      reasonsOf(current),
      linkedIds(current, "featureIds"),
      request.featureIds,
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
      await proposalRecord(transaction, state, request),
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
      await proposalRecord(transaction, state, request, proposal),
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

// A choice of a built-in list a record need not have: none, or one offered or the record already has.
async function optionalChoice(
  transaction: Transaction,
  list: BuiltInList,
  asked: string | null,
  had: unknown,
): Promise<string | null> {
  if (asked !== null) await checkBuiltInChoice(transaction, list, asked, had);
  return asked;
}

async function featureRecord(
  transaction: Transaction,
  request: FeatureRequest,
  current?: Recorded,
) {
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
    priorityId: await optionalChoice(
      transaction,
      "feature-priorities",
      request.priorityId,
      current?.priorityId,
    ),
    sizeId: await optionalChoice(
      transaction,
      "feature-sizes",
      request.sizeId,
      current?.sizeId,
    ),
    riskId: await optionalChoice(
      transaction,
      "feature-risks",
      request.riskId,
      current?.riskId,
    ),
    neededBy: request.neededBy,
    customerIds: request.customerIds,
    targetStreamId: request.target?.streamId ?? null,
    targetCycle: request.target?.cycle ?? null,
    estimateHours: request.estimateHours,
    featureTeamId: request.featureTeamId,
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
      await featureRecord(transaction, request),
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
      await featureRecord(transaction, request, feature),
    );
  });
}

// What else each kind that names features keeps once the features it names change: a proposal,
// the reason for each feature removed from it.
const keptWithScope: Readonly<
  Record<
    keyof typeof featureNamerKeys,
    (change: { record: Recorded; featureIds: readonly string[] }) => Recorded
  >
> = {
  project: () => ({}),
  proposal: ({ record, featureIds }) => ({
    removalReasons: removalReasonsAfter(
      reasonsOf(record),
      linkedIds(record, "featureIds"),
      featureIds,
    ),
  }),
};

// Adds a feature to, or takes it from, each project and proposal whose naming of it the request
// changes, as their drafts, in one change set. Those whose naming it keeps are left as they are, and
// so is one drafted to be removed that the request leaves out, since a view of the drafts applied
// does not show it.
export async function changeFeatureProjects(
  database: Database,
  maker: Actor,
  featureId: string,
  request: FeatureProjectsRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    if (
      shownVersion(state, "feature", featureId) === undefined ||
      isGeneralFeature(state, featureId)
    ) {
      throw new NotFoundError("There is no such feature");
    }
    const wanted = Object.entries(featureNamerKeys).flatMap(([kind, key]) => {
      const type = kind as keyof typeof featureNamerKeys;
      // The key is always one of the fixed keys.
      // eslint-disable-next-line security/detect-object-injection
      const named = request[key];
      if (named === undefined) return [];
      const asked = new Set(named);
      const naming = shownIds(state, type).filter((id) =>
        linkedIds(versionOf(state, type, id), "featureIds").includes(featureId),
      );
      const changing = [
        ...naming.filter((id) => !asked.has(id)),
        ...[...asked].filter((id) => !naming.includes(id)),
      ];
      return changing.map((id) => {
        if (
          recordExists(state, type, id) &&
          versionOf(state, type, id) === undefined
        ) {
          throw new ConflictError(
            `The ${type} ${String(shownVersion(state, type, id)?.name)} is drafted to be removed, so it can't be changed`,
          );
        }
        const record = changeableRecord(state, type, id);
        const others = linkedIds(record, "featureIds").filter(
          (other) => other !== featureId,
        );
        const featureIds = asked.has(id)
          ? [...others, featureId].sort()
          : others;
        // The kind is always one of the fixed kinds above.
        // eslint-disable-next-line security/detect-object-injection
        const kept = keptWithScope[type]({
          record,
          featureIds,
        });
        return { type, id, record: { ...record, featureIds, ...kept } };
      });
    });
    return saveRecordDrafts(transaction, maker, state, wanted);
  });
}

// Changes the reason for removing a feature from a proposal, while a draft removes it.
export async function changeRemovalReason(
  database: Database,
  maker: Actor,
  featureId: string,
  proposalId: string,
  request: RemovalReasonRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    const proposal = changeableRecord(state, "proposal", proposalId);
    const live = stateOf(state, "proposal").live.get(proposalId);
    if (
      !linkedIds(live, "featureIds").includes(featureId) ||
      linkedIds(proposal, "featureIds").includes(featureId)
    ) {
      throw new ConflictError(
        "No draft removes this feature from the proposal, so it has no reason to change",
      );
    }
    return saveRecordDraft(transaction, maker, state, "proposal", proposalId, {
      ...proposal,
      removalReasons: withRemovalReason(
        reasonsOf(proposal),
        featureId,
        request.removalReason,
      ),
    });
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
  return changingPlan(database, maker, (transaction, state) =>
    saveRecordDraft(
      transaction,
      maker,
      state,
      "milestone",
      randomUUID(),
      milestoneRecord(projectId, request),
    ),
  );
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
  type: PlanKind,
  id: string,
): Promise<string | null> {
  return removing(database, maker, type, id, (state) => {
    changeableRecord(state, type, id);
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
// statuses and features' priorities, sizes, with their weights, and risks, in their lists' order,
// and the live feature teams by name, those drafted to be removed retired.
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
  const featureStatuses = await listChoices(database, "feature-statuses");
  const offered = async (key: BuiltInList) =>
    (await listChoices(database, key)).map(({ id, name, retired }) => ({
      id,
      name,
      retired,
    }));
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
    statuses: await offered("proposal-statuses"),
    featureStatuses: featureStatuses.map((status) => ({
      ...status,
      meaning: meaningSchema.parse(status.meaning),
    })),
    priorities: await offered("feature-priorities"),
    sizes: (await listChoices(database, "feature-sizes")).map(
      ({ id, name, retired, weight }) => ({ id, name, retired, weight }),
    ),
    risks: await offered("feature-risks"),
    featureTeams: teams.map((team) => ({
      ...team,
      retired: teamDrafts.get(team.id)?.action === "deleted",
    })),
  };
}
