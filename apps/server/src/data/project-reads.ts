// SPDX-License-Identifier: Apache-2.0

// Reading customers, projects with their milestones, proposals and features as the viewer sees
// them, and the choices they draw on. Part of the data access layer; the caller checks the actor's
// permissions.

import { type Database, featureTeams, people } from "@fathom/db";
import {
  type Customer,
  type Feature,
  type FeatureColumns,
  type FeatureDraft,
  type BuiltInList,
  type List,
  meaningSchema,
  type Milestone,
  type PlanChoices,
  type Project,
  type ProjectPlan,
  type Proposal,
  projectDates,
  removalReasonsIn,
  type RecordType,
  sameDates,
} from "@fathom/shared";
import { asc } from "drizzle-orm";
import type { Actor } from "../access.ts";
import { listChoices } from "./built-in-lists.ts";
import type { Transaction } from "./changes.ts";
import type { Recorded } from "./draft-records.ts";
import { staffedFeatures } from "./allocations.ts";
import { readTeamDrafts } from "./feature-team-reads.ts";
import { readColumnsOut } from "./column-drafts.ts";
import { liveValuesOf } from "./column-types.ts";
import { readListsWithin } from "./lists.ts";
import { linksOf, notesOf, numbersOf, valuesOf } from "./person-fields.ts";
import { milestonesOf } from "./project-kinds.ts";
import { isGeneralFeature } from "./release-kinds.ts";
import { text } from "./reporting.ts";
import { fieldOfValue } from "./values.ts";
import {
  linkedIds,
  type RecordsState,
  shownIds,
  shownVersion,
  stateOf,
  versionOf,
} from "./record-state.ts";
import {
  type Makers,
  readRecordMakers,
  readRecordsState,
  type RecordDraftOut,
  recordExtras,
  recordKeyNumber,
} from "./records.ts";
import { readToday } from "./settings.ts";

export type PlanRecords = Omit<ProjectPlan, "canEdit" | "canEditFeatures">;

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
// columns draw on them, as Roles sets out under Columns on Features.
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
    keyNumber: recordKeyNumber(state, "milestone", id),
    projectId: String(milestone.projectId),
    name: String(milestone.name),
    date: String(milestone.date),
    customerDelivery: milestone.customerDelivery === true,
    ...recordExtras(state, makers, "milestone", id),
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
    keyNumber: recordKeyNumber(state, "project", id),
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
    ...recordExtras(state, makers, "project", id),
  };
}

// The reasons a proposal keeps for the features removed from it, by feature.
export const reasonsOf = (
  proposal: Recorded | undefined,
): Record<string, string> => removalReasonsIn(proposal?.removalReasons);

function proposalOut(
  state: RecordsState,
  makers: Makers,
  id: string,
): Proposal {
  const proposal = shownVersion(state, "proposal", id) as Recorded;
  return {
    id,
    keyNumber: recordKeyNumber(state, "proposal", id),
    name: String(proposal.name),
    externalId: text(proposal.externalId),
    link: text(proposal.link),
    ownerId: text(proposal.ownerId),
    customerIds: linkedIds(proposal, "customerIds"),
    statusId: String(proposal.statusId),
    featureIds: linkedIds(proposal, "featureIds"),
    removalReasons: reasonsOf(proposal),
    ...recordExtras(state, makers, "proposal", id),
  };
}

function featureOut(
  state: RecordsState,
  makers: Makers,
  staffed: ReturnType<typeof staffedFeatures>,
  id: string,
): Feature {
  const feature = shownVersion(state, "feature", id) as Recorded;
  const { draft, ...heldBy } = recordExtras(state, makers, "feature", id);
  return {
    id,
    keyNumber: recordKeyNumber(state, "feature", id),
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

export async function planOut(
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
      keyNumber: recordKeyNumber(state, "customer", id),
      name: String(shownVersion(state, "customer", id)?.name),
      ...recordExtras(state, makers, "customer", id),
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
