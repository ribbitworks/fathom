// SPDX-License-Identifier: Apache-2.0

// Customers, projects with their milestones, workstreams, and proposals through the server's API:
// reading them, with what they pick from, every change to them, each a draft, and each record as
// decisions on its draft name it.

import {
  type Choice,
  type Customer,
  type CustomerRequest,
  type Feature,
  type FeatureColumns,
  type FeatureRequest,
  type Milestone,
  type MilestoneRequest,
  type PlanChoice,
  type PlanChoices,
  planChoicesSchema,
  type Project,
  type ProjectPlan,
  projectPlanSchema,
  type ProjectRequest,
  projectSubjects,
  type Proposal,
  type ProposalRequest,
  recordTypeOf,
  type ReleaseStream,
  savedSchema,
  type Workstream,
  type WorkstreamRequest,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getJson, sendDeleteFor, sendJsonFor } from "./api.ts";
import type { CellChange } from "./cell-kinds.tsx";
import { choice } from "./lists.ts";
import { type RecordNode, recordNode } from "./record-drafts.ts";

export const projectPlanQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: async () => getJson("/api/projects", projectPlanSchema),
});

export const planChoicesQuery = queryOptions({
  queryKey: ["plan-choices"],
  queryFn: async () => getJson("/api/projects/choices", planChoicesSchema),
});

// A plan's choice, as a table's columns offer it.
export const asChoices = (choices: readonly PlanChoice[]): Choice[] =>
  choices.map(({ id, name, retired }) => choice(id, name, retired));

export type PlanKind =
  "customer" | "project" | "workstream" | "proposal" | "feature";

export type PlanRequest =
  | { type: "customer"; request: CustomerRequest }
  | { type: "project"; request: ProjectRequest }
  | { type: "workstream"; request: WorkstreamRequest }
  | { type: "proposal"; request: ProposalRequest }
  | { type: "feature"; request: FeatureRequest };

const paths: Readonly<Record<PlanKind, string>> = {
  customer: "/api/customers",
  project: "/api/projects",
  workstream: "/api/workstreams",
  proposal: "/api/proposals",
  feature: "/api/features",
};

const savedPlan = z.object({
  plan: projectPlanSchema,
  changeSetId: savedSchema.shape.changeSetId,
});

export type SavedPlan = z.infer<typeof savedPlan>;

const recordPath = (type: PlanKind, id: string) =>
  // The kind is always one of the fixed kinds above.
  // eslint-disable-next-line security/detect-object-injection
  `${paths[type]}/${encodeURIComponent(id)}`;

export const addRecord = ({ type, request }: PlanRequest): Promise<SavedPlan> =>
  // The kind is always one of the fixed kinds above.
  // eslint-disable-next-line security/detect-object-injection
  sendJsonFor("POST", paths[type], request, savedPlan);

export const changeRecord = (
  id: string,
  { type, request }: PlanRequest,
): Promise<SavedPlan> =>
  sendJsonFor("PUT", recordPath(type, id), request, savedPlan);

export async function removeRecord(
  type: PlanKind,
  id: string,
): Promise<string | null> {
  return (await sendDeleteFor(recordPath(type, id), savedSchema)).changeSetId;
}

const milestonesPath = (projectId: string) =>
  `/api/projects/${encodeURIComponent(projectId)}/milestones`;

export const addMilestone = (
  projectId: string,
  request: MilestoneRequest,
): Promise<SavedPlan> =>
  sendJsonFor("POST", milestonesPath(projectId), request, savedPlan);

export const changeMilestone = (
  milestone: Milestone,
  request: MilestoneRequest,
): Promise<SavedPlan> =>
  sendJsonFor(
    "PUT",
    `${milestonesPath(milestone.projectId)}/${encodeURIComponent(milestone.id)}`,
    request,
    savedPlan,
  );

export async function removeMilestone(
  milestone: Milestone,
): Promise<string | null> {
  return (
    await sendDeleteFor(
      `${milestonesPath(milestone.projectId)}/${encodeURIComponent(milestone.id)}`,
      savedSchema,
    )
  ).changeSetId;
}

// What changing a record sends: the whole record, as the server takes it.
export const customerRequest = (customer: Customer): CustomerRequest => ({
  name: customer.name,
});

export const projectRequest = (project: Project): ProjectRequest => ({
  name: project.name,
  externalId: project.externalId,
  ownerId: project.ownerId,
  customerIds: project.customerIds,
  proposalIds: project.proposalIds,
});

export const workstreamRequest = (
  workstream: Workstream,
): WorkstreamRequest => ({
  name: workstream.name,
  ownerId: workstream.ownerId,
});

export const proposalRequest = (proposal: Proposal): ProposalRequest => ({
  name: proposal.name,
  externalId: proposal.externalId,
  link: proposal.link,
  ownerId: proposal.ownerId,
  customerIds: proposal.customerIds,
  statusId: proposal.statusId,
});

export const milestoneRequest = (milestone: Milestone): MilestoneRequest => ({
  name: milestone.name,
  date: milestone.date,
  customerDelivery: milestone.customerDelivery,
});

// The fields a feature's table edits, as the server shows them.
export type FeatureFields = Pick<
  Feature,
  | "name"
  | "statusId"
  | "neededBy"
  | "customerIds"
  | "targetStreamId"
  | "targetCycle"
  | "estimateHours"
  | "featureTeamId"
  | "workstreamId"
  | "description"
  | "note"
>;

// What saving a feature sends: its target as a stream and a cycle together, and only the added
// columns' values it changes, since the server keeps those not named.
export const featureRequest = (
  {
    name,
    statusId,
    neededBy,
    customerIds,
    estimateHours,
    featureTeamId,
    workstreamId,
    description,
    note,
    targetStreamId,
    targetCycle,
  }: FeatureFields,
  { values = {}, links = {}, notes = {}, numbers = {} }: CellChange = {},
): FeatureRequest => ({
  name,
  ...(statusId === "" ? {} : { statusId }),
  neededBy,
  customerIds,
  estimateHours,
  featureTeamId,
  workstreamId,
  description,
  note,
  values,
  links,
  notes,
  numbers,
  target:
    targetStreamId === null || targetCycle === null
      ? null
      : { streamId: targetStreamId, cycle: targetCycle },
});

// Every milestone of every project.
export const allMilestones = (plan: Pick<ProjectPlan, "projects">) =>
  plan.projects.flatMap((project) => project.milestones);

type PlanLists = Pick<
  ProjectPlan,
  "customers" | "projects" | "workstreams" | "proposals" | "features"
>;

// Every customer, proposal, project, milestone, workstream, and feature, named as the Drafts page
// names them.
export function listedPlanRecords(
  plan: PlanLists,
): { kind: PlanRecordKind; record: PlanRecord; subject: string }[] {
  return [
    ...plan.features.map((record) => ({
      kind: "feature" as const,
      record,
      subject: projectSubjects.feature(record.name),
    })),
    ...plan.customers.map((record) => ({
      kind: "customer" as const,
      record,
      subject: projectSubjects.customer(record.name),
    })),
    ...plan.proposals.map((record) => ({
      kind: "proposal" as const,
      record,
      subject: projectSubjects.proposal(record.name),
    })),
    ...plan.projects.flatMap((project) => [
      {
        kind: "project" as const,
        record: project,
        subject: projectSubjects.project(project.name),
      },
      ...project.milestones.map((record) => ({
        kind: "milestone" as const,
        record,
        subject: projectSubjects.milestone(record.name, project.name),
      })),
    ]),
    ...plan.workstreams.map((record) => ({
      kind: "workstream" as const,
      record,
      subject: projectSubjects.workstream(record.name),
    })),
  ];
}

export const planNodes = (plan: PlanLists): RecordNode[] =>
  listedPlanRecords(plan).map(({ kind, record, subject }) =>
    recordNode(recordTypeOf(kind), record, subject),
  );

export const projectTabs = [
  "projects",
  "workstreams",
  "proposals",
  "customers",
  "milestones",
] as const;

export type ProjectTab = (typeof projectTabs)[number];

// What the plan's page shows: one of the Projects page's tabs, or the Features page.
export type PlanTab = ProjectTab | "features";

export type PlanRecord =
  Customer | Project | Workstream | Proposal | Milestone | Feature;
export const isFeature = (record: PlanRecord): record is Feature =>
  "featureTeamId" in record;

export type PlanRecordKind =
  "customer" | "project" | "workstream" | "proposal" | "milestone" | "feature";

// A milestone being added, with the project it is added to.
export type MilestoneAdding = MilestoneRequest & { projectId: string };

// What each kind of the plan's records has in common: what a new one holds until the server has
// saved it, where they are in the plan, and how each is saved. Requests are built from the kind's
// own columns, and the server parses them.
type Blank<Rec> = Omit<Rec, "id" | "draft" | "heldBy">;

interface PlanRecordOperations {
  blank:
    | Blank<Customer>
    | Blank<Project>
    | Blank<Workstream>
    | Blank<Proposal>
    | Blank<Milestone>
    | Blank<Feature>;
  all: (plan: ProjectPlan) => readonly PlanRecord[];
  withAll: (plan: ProjectPlan, records: readonly PlanRecord[]) => ProjectPlan;
  add: (request: unknown) => Promise<SavedPlan>;
  change: (record: PlanRecord, change: CellChange) => Promise<SavedPlan>;
  remove: (record: PlanRecord) => Promise<string | null>;
}

const noDates = { first: null, last: null, nextDelivery: null };

// How a kind whose record is sent whole is saved, each change laid over its record's request.
const savedAs = (
  type: Exclude<PlanKind, "feature">,
  requestOf: (record: never) => object,
): Pick<PlanRecordOperations, "add" | "change" | "remove"> => ({
  add: (request) => addRecord({ type, request } as PlanRequest),
  change: (record, change) =>
    changeRecord(record.id, {
      type,
      request: { ...requestOf(record as never), ...change },
    } as PlanRequest),
  remove: (record) => removeRecord(type, record.id),
});

const planRecordOperations: Readonly<
  Record<PlanRecordKind, PlanRecordOperations>
> = {
  customer: {
    blank: { name: "" },
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
      milestones: [],
      dates: noDates,
    },
    all: (plan) => plan.projects,
    withAll: (plan, records) => ({ ...plan, projects: records as Project[] }),
    ...savedAs("project", projectRequest),
  },
  workstream: {
    blank: { name: "", ownerId: null },
    all: (plan) => plan.workstreams,
    withAll: (plan, records) => ({
      ...plan,
      workstreams: records as Workstream[],
    }),
    ...savedAs("workstream", workstreamRequest),
  },
  proposal: {
    blank: {
      name: "",
      externalId: null,
      link: null,
      ownerId: null,
      customerIds: [],
      statusId: "",
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
    add: (request) => {
      const { projectId, ...milestone } = request as MilestoneAdding;
      return addMilestone(projectId, milestone);
    },
    change: (record, change) =>
      changeMilestone(record as Milestone, {
        ...milestoneRequest(record as Milestone),
        ...change,
      }),
    remove: (record) => removeMilestone(record as Milestone),
  },
  feature: {
    blank: {
      name: "",
      statusId: "",
      neededBy: null,
      customerIds: [],
      targetStreamId: null,
      targetCycle: null,
      estimateHours: null,
      featureTeamId: null,
      workstreamId: null,
      description: null,
      note: null,
      values: {},
      links: {},
    },
    all: (plan) => plan.features,
    withAll: (plan, records) => ({ ...plan, features: records as Feature[] }),
    add: (request) =>
      addRecord({
        type: "feature",
        request: featureRequest(
          {
            ...planRecordOperations.feature.blank,
            ...(request as object),
          } as FeatureFields,
          request as CellChange,
        ),
      }),
    change: (record, change) =>
      changeRecord(record.id, {
        type: "feature",
        request: featureRequest({ ...(record as Feature), ...change }, change),
      }),
    remove: (record) => removeRecord("feature", record.id),
  },
};

export const operationsOf = (kind: PlanRecordKind): PlanRecordOperations =>
  // The kind is always one of the fixed kinds above.
  // eslint-disable-next-line security/detect-object-injection
  planRecordOperations[kind];

// What the tables offer: people as owners, the plan's records, and the statuses.
export interface TableChoices {
  people: Choice[];
  customers: readonly Customer[];
  proposals: readonly Proposal[];
  projects: readonly Project[];
  statuses: Choice[];
  // In their list's order, each with its meaning.
  featureStatuses: Choice[];
  featureTeams: Choice[];
  // Every cycle a feature can target.
  cycles: Choice[];
  featureColumns: FeatureColumns;
}

// A cycle a feature targets, as a value in a cell.
export const cycleChoiceId = (streamId: string, startsOn: string) =>
  `${streamId} ${startsOn}`;

// The stream and first day of the cycle a cell holds, each null for a feature in Later.
export function targetOf(chosen: string | undefined): {
  targetStreamId: string | null;
  targetCycle: string | null;
} {
  const [targetStreamId = null, targetCycle = null] = chosen?.split(" ") ?? [];
  return { targetStreamId, targetCycle };
}

// Every stream's cycles, each named with its stream, streams in their order and cycles by date;
// those of a retired stream are kept to name what targets them, and offered to nothing new.
export const cycleChoices = (streams: readonly ReleaseStream[]): Choice[] =>
  streams.flatMap((stream) => {
    const drafted = new Set(stream.cycles.map(({ startsOn }) => startsOn));
    return [
      ...stream.cycles.map((cycle) => ({ cycle, retired: stream.retired })),
      // Cycles only as they are live are kept to name what is on them until a draft is approved.
      ...(stream.liveCycles ?? [])
        .filter(({ startsOn }) => !drafted.has(startsOn))
        .map((cycle) => ({ cycle, retired: true })),
    ]
      .sort((a, b) => a.cycle.startsOn.localeCompare(b.cycle.startsOn))
      .map(({ cycle, retired }) =>
        choice(
          cycleChoiceId(stream.id, cycle.startsOn),
          `${stream.name}: ${cycle.name}`,
          retired,
        ),
      );
  });

export const tableChoices = (
  plan: PlanLists & Pick<ProjectPlan, "featureColumns">,
  picks: PlanChoices,
  streams: readonly ReleaseStream[],
): TableChoices => ({
  people: asChoices(picks.owners),
  statuses: asChoices(picks.statuses),
  featureStatuses: picks.featureStatuses.map(
    ({ id, name, retired, meaning }) => ({
      ...choice(id, name, retired),
      meaning,
    }),
  ),
  featureTeams: asChoices(picks.featureTeams),
  cycles: cycleChoices(streams),
  customers: plan.customers,
  proposals: plan.proposals,
  projects: plan.projects,
  featureColumns: plan.featureColumns,
});
