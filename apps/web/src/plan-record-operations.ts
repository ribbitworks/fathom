// SPDX-License-Identifier: Apache-2.0

// What each kind of the plan's records sends to be saved, from its fields, and how each is added,
// changed and removed.

import {
  type Activity,
  type AddedPlan,
  type ActivityRequest,
  type Customer,
  type CustomerRequest,
  type Feature,
  type FeatureRequest,
  type Milestone,
  type MilestoneAdding,
  type MilestoneRequest,
  ownersAfter,
  type PlanAddingRequests,
  type Project,
  type ProjectPlan,
  type ProjectRequest,
  type Proposal,
  type ProposalRequest,
} from "@fathom/shared";
import type { CellChange } from "./cell-kinds.tsx";
import {
  addRecords,
  allMilestones,
  changeFeatureProjects,
  changeMilestone,
  changeRecord,
  namersIn,
  type PlanAdding,
  type PlanKind,
  type PlanRecord,
  type PlanRecordKind,
  type PlanRequest,
  removeMilestone,
  removeRecord,
  type SavedPlan,
} from "./projects.ts";

// What changing a record sends: the whole record, as the server takes it.
export const customerRequest = (customer: Customer): CustomerRequest => ({
  name: customer.name,
  description: customer.description,
  note: customer.note,
});

export const projectRequest = (project: Project): ProjectRequest => ({
  name: project.name,
  externalId: project.externalId,
  ownerId: project.ownerId,
  customerIds: project.customerIds,
  proposalIds: project.proposalIds,
  featureIds: project.featureIds,
});

export const proposalRequest = (proposal: Proposal): ProposalRequest => ({
  name: proposal.name,
  externalId: proposal.externalId,
  link: proposal.link,
  ownerId: proposal.ownerId,
  customerIds: proposal.customerIds,
  statusId: proposal.statusId,
  featureIds: proposal.featureIds,
});

export const milestoneRequest = (milestone: Milestone): MilestoneRequest => ({
  name: milestone.name,
  date: milestone.date,
  customerDelivery: milestone.customerDelivery,
});

// The planning fields a feature's or an activity's table edits, as the server shows them.
export type PlanningFields = Pick<
  Feature,
  | "name"
  | "statusId"
  | "priorityId"
  | "sizeId"
  | "riskId"
  | "neededBy"
  | "estimateHours"
  | "featureTeamId"
  | "description"
  | "note"
>;

// The fields a feature's table edits, as the server shows them.
export type FeatureFields = PlanningFields &
  Pick<Feature, "customerIds" | "targetStreamId" | "targetCycle">;

// What saving a feature's or an activity's planning fields sends: only the added columns' values it
// changes, since the server keeps those not named.
export const planningRequest = (
  {
    name,
    statusId,
    priorityId,
    sizeId,
    riskId,
    neededBy,
    estimateHours,
    featureTeamId,
    description,
    note,
  }: PlanningFields,
  {
    values = {},
    links = {},
    notes = {},
    numbers = {},
    flags = {},
  }: CellChange = {},
) => ({
  name,
  ...(statusId === "" ? {} : { statusId }),
  priorityId,
  sizeId,
  riskId,
  neededBy,
  estimateHours,
  featureTeamId,
  description,
  note,
  values,
  links,
  notes,
  numbers,
  flags,
});

// What saving a feature sends: its planning fields, its customers, and its target as a stream and
// a cycle together.
export const featureRequest = (
  fields: FeatureFields,
  change: CellChange = {},
): FeatureRequest => ({
  ...planningRequest(fields, change),
  customerIds: fields.customerIds,
  target:
    fields.targetStreamId === null || fields.targetCycle === null
      ? null
      : { streamId: fields.targetStreamId, cycle: fields.targetCycle },
});

// The fields an activity's table edits, as the server shows them.
export type ActivityFields = PlanningFields &
  Pick<Activity, "releaseId" | "projectId">;

// What saving an activity sends: its planning fields and what it belongs to.
export const activityRequest = (
  fields: ActivityFields,
  change: CellChange = {},
): ActivityRequest => ({
  ...planningRequest(fields, change),
  releaseId: fields.releaseId,
  projectId: fields.projectId,
});

// An activity as a change makes it: choosing its release or its project moves it there, clearing
// the other, since it belongs to exactly one.
export const movedActivity = (
  activity: ActivityFields,
  change: Partial<ActivityFields>,
): ActivityFields => ({
  ...activity,
  ...change,
  ...ownersAfter(activity, change),
});

// What each kind of the plan's records has in common: what a new one holds until the server has
// saved it, where they are in the plan, and how each is saved. Requests are built from the kind's
// own columns, and the server parses them.
type Blank<Rec> = Omit<Rec, "id" | "keyNumber" | "draft" | "heldBy">;

interface PlanRecordOperations {
  blank:
    | Blank<Customer>
    | Blank<Project>
    | Blank<Proposal>
    | Blank<Milestone>
    | Blank<Feature>
    | Blank<Activity>;
  all: (plan: ProjectPlan) => readonly PlanRecord[];
  withAll: (plan: ProjectPlan, records: readonly PlanRecord[]) => ProjectPlan;
  // Adds records of the kind from what each new row holds, all saved together or none.
  add: (requests: readonly unknown[]) => Promise<AddedPlan>;
  change: (record: PlanRecord, change: CellChange) => Promise<SavedPlan>;
  remove: (record: PlanRecord) => Promise<string | null>;
}

const noDates = { first: null, last: null, nextDelivery: null };

// How a kind whose record is sent whole is saved, each change laid over its record's request.
const savedAs = (
  type: Exclude<PlanKind, "feature">,
  requestOf: (record: never) => object,
): Pick<PlanRecordOperations, "add" | "change" | "remove"> => ({
  add: (requests) =>
    // The grid's rows are the kind's own requests, which the server parses.
    addRecords(...([type, requests] as PlanAdding)),
  change: (record, change) =>
    changeRecord(record.id, {
      type,
      request: { ...requestOf(record as never), ...change },
    } as PlanRequest),
  remove: (record) => removeRecord(type, record.id),
});

// What a new feature or activity holds in its planning fields until the server has it.
const planningBlank = {
  name: "",
  statusId: "",
  priorityId: null,
  sizeId: null,
  riskId: null,
  neededBy: null,
  estimateHours: null,
  featureTeamId: null,
  description: null,
  note: null,
  values: {},
  links: {},
};

// How features or activities are added: each request built from its blank, with what its new row
// holds laid over it.
const addPlanned =
  <Kind extends "feature" | "activity">(
    type: Kind,
    requestOf: (fields: never, change: CellChange) => PlanAddingRequests[Kind],
  ) =>
  (requests: readonly unknown[]): Promise<AddedPlan> =>
    addRecords(
      ...([
        type,
        requests.map((request) =>
          requestOf(
            {
              // The kind is always one of the two above.
              // eslint-disable-next-line security/detect-object-injection
              ...planRecordOperations[type].blank,
              ...(request as object),
            } as never,
            request as CellChange,
          ),
        ),
      ] as PlanAdding),
    );

const planRecordOperations: Readonly<
  Record<PlanRecordKind, PlanRecordOperations>
> = {
  customer: {
    blank: { name: "", description: null, note: null },
    all: (plan) => plan.customers,
    withAll: (plan, records) => ({
      ...plan,
      customers: records as Customer[],
    }),
    ...savedAs("customer", customerRequest),
  },
  project: {
    blank: {
      name: "",
      externalId: null,
      ownerId: null,
      customerIds: [],
      proposalIds: [],
      featureIds: [],
      milestones: [],
      dates: noDates,
    },
    all: (plan) => plan.projects,
    withAll: (plan, records) => ({ ...plan, projects: records as Project[] }),
    ...savedAs("project", projectRequest),
  },
  proposal: {
    blank: {
      name: "",
      externalId: null,
      link: null,
      ownerId: null,
      customerIds: [],
      statusId: "",
      featureIds: [],
      removalReasons: {},
    },
    all: (plan) => plan.proposals,
    withAll: (plan, records) => ({
      ...plan,
      proposals: records as Proposal[],
    }),
    ...savedAs("proposal", proposalRequest),
  },
  milestone: {
    blank: { name: "", projectId: "", date: "", customerDelivery: false },
    all: allMilestones,
    withAll: (plan, records) => ({
      ...plan,
      projects: plan.projects.map((project) => ({
        ...project,
        milestones: (records as Milestone[]).filter(
          ({ projectId }) => projectId === project.id,
        ),
      })),
    }),
    add: (requests) =>
      addRecords("milestone", requests as readonly MilestoneAdding[]),
    change: (record, change) =>
      changeMilestone(record as Milestone, {
        ...milestoneRequest(record as Milestone),
        ...change,
      }),
    remove: (record) => removeMilestone(record as Milestone),
  },
  feature: {
    blank: {
      ...planningBlank,
      customerIds: [],
      targetStreamId: null,
      targetCycle: null,
    },
    all: (plan) => plan.features,
    withAll: (plan, records) => ({ ...plan, features: records as Feature[] }),
    add: addPlanned("feature", featureRequest),
    // The projects and proposals that name a feature are changed as their own drafts, saved before
    // any change to the feature's own fields.
    change: async (record, change) => {
      const { namers, own } = namersIn(change);
      const namersSaved =
        Object.keys(namers).length > 0
          ? await changeFeatureProjects(record.id, namers)
          : undefined;
      return Object.keys(own).length === 0 && namersSaved !== undefined
        ? namersSaved
        : changeRecord(record.id, {
            type: "feature",
            request: featureRequest({ ...(record as Feature), ...own }, own),
          });
    },
    remove: (record) => removeRecord("feature", record.id),
  },
  activity: {
    blank: { ...planningBlank, releaseId: null, projectId: null },
    all: (plan) => plan.activities,
    withAll: (plan, records) => ({
      ...plan,
      activities: records as Activity[],
    }),
    add: addPlanned("activity", activityRequest),
    change: (record, change) =>
      changeRecord(record.id, {
        type: "activity",
        request: activityRequest(
          movedActivity(record as Activity, change as Partial<ActivityFields>),
          change,
        ),
      }),
    remove: (record) => removeRecord("activity", record.id),
  },
};

export const operationsOf = (kind: PlanRecordKind): PlanRecordOperations =>
  // The kind is always one of the fixed kinds above.
  // eslint-disable-next-line security/detect-object-injection
  planRecordOperations[kind];
