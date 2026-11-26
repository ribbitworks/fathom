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
  seesEmployment,
} from "@fathom/shared";
import { asc } from "drizzle-orm";
import type { Actor } from "../access.ts";
import { listChoices } from "./built-in-lists.ts";
import type { Transaction } from "./changes.ts";
import type { Recorded } from "./draft-records.ts";
import { staffedFeatures } from "./allocations.ts";
import { readTeamDrafts } from "./feature-team-reads.ts";
import { readColumnsOut } from "./column-state.ts";
import { liveValuesOf } from "./column-types.ts";
import { readListsWithin } from "./list-reads.ts";
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
import { hiddenPeople, notStarted } from "./people-reads.ts";
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

// Which columns use a list is for Lists alone.
function withoutUses(list: List): List {
  const plain = { ...list };
  delete plain.usedBy;
  return plain;
}

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
      .map((list) =>
        withoutUses(seesListDrafts(viewer) ? list : withoutDrafts(list)),
      ),
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

// The plan's records a reader may see: features and their columns with features, and the rest with
// the plan. Every read and every change's answer goes through it.
export function seenRecords(reader: Actor, records: PlanRecords): PlanRecords {
  const seesPlan = reader.permissions.includes("plan:view");
  const seesFeatures = reader.permissions.includes("features:view");
  return {
    customers: seesPlan ? records.customers : [],
    projects: seesPlan ? records.projects : [],
    proposals: seesPlan ? records.proposals : [],
    features: seesFeatures ? records.features : [],
    featureColumns: seesFeatures
      ? records.featureColumns
      : { fields: [], order: [], lists: [] },
  };
}

// A project or proposal with an owner the reader doesn't see named by none, live and drafted, as a
// feature team's lead is. A draft whose owner then reads the same before and after, such as one
// adding a record with such an owner, changes no owner to the reader, and a changed record's draft
// changing nothing else is no draft.
export function ownerShown<Rec extends Project | Proposal>(
  record: Rec,
  hidden: ReadonlySet<string>,
): Rec {
  const shown = (owner: unknown) =>
    typeof owner === "string" && !hidden.has(owner) ? owner : null;
  const ownerId = shown(record.ownerId);
  const { draft } = record;
  if (draft === undefined || !draft.changed.includes("ownerId")) {
    return { ...record, ownerId };
  }
  const before = shown(draft.live.ownerId);
  if (before !== ownerId) {
    const live =
      "ownerId" in draft.live ? { ...draft.live, ownerId: before } : draft.live;
    return { ...record, ownerId, draft: { ...draft, live } };
  }
  const changed = draft.changed.filter((field) => field !== "ownerId");
  return {
    ...record,
    ownerId,
    draft:
      changed.length === 0 && draft.action === "changed"
        ? undefined
        : {
            ...draft,
            changed,
            live: without(draft.live, "ownerId"),
            changedBy: without(draft.changedBy ?? {}, "ownerId"),
          },
  };
}

// An object with one key left out.
const without = <Value>(
  object: Readonly<Record<string, Value>>,
  key: string,
): Record<string, Value> =>
  Object.fromEntries(Object.entries(object).filter(([name]) => name !== key));

export async function planOut(
  transaction: Transaction,
  viewer: Actor,
  state: RecordsState,
  today: string,
): Promise<PlanRecords> {
  const makers = await readRecordMakers(transaction, state, viewer);
  const staffed = staffedFeatures(state);
  const projects = inOrder(state, "project").map((id) =>
    projectOut(state, makers, id, today),
  );
  const proposals = inOrder(state, "proposal").map((id) =>
    proposalOut(state, makers, id),
  );
  const hidden = await hiddenPeople(
    transaction,
    viewer,
    [...projects, ...proposals].flatMap((record) =>
      [record.ownerId, record.draft?.live.ownerId].filter(
        (owner): owner is string => typeof owner === "string",
      ),
    ),
    today,
  );
  return seenRecords(viewer, {
    customers: inOrder(state, "customer").map((id): Customer => ({
      id,
      keyNumber: recordKeyNumber(state, "customer", id),
      name: String(shownVersion(state, "customer", id)?.name),
      description: text(shownVersion(state, "customer", id)?.description),
      note: text(shownVersion(state, "customer", id)?.note),
      ...recordExtras(state, makers, "customer", id),
    })),
    projects: projects.map((project) => ownerShown(project, hidden)),
    proposals: proposals.map((proposal) => ownerShown(proposal, hidden)),
    features: inOrder(state, "feature")
      .filter((id) => !isGeneralFeature(state, id))
      .map((id) => featureOut(state, makers, staffed, id)),
    featureColumns: await featureColumnsOut(transaction, viewer),
  });
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

// People as owners, by name alone, those whose end date has passed retired, and those not yet
// started only to a reader who sees start and end dates, as People lists them; the proposal and
// feature statuses and features' priorities, sizes, with their weights, and risks, in their lists'
// order, and the live feature teams by name, those drafted to be removed retired.
export async function readPlanChoices(
  database: Database,
  reader: Actor,
): Promise<PlanChoices> {
  const today = await readToday(database);
  const owners = await database
    .select({
      id: people.id,
      name: people.preferredName,
      startDate: people.startDate,
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
    owners: owners
      .filter((person) => seesEmployment(reader) || !notStarted(person, today))
      .map(({ id, name, endDate }) => ({
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
