// SPDX-License-Identifier: Apache-2.0

// Customers, projects with their milestones, and proposals through the server's API: reading them,
// with what they pick from, every change to them, each a draft, each record as decisions on its
// draft name it, and each project's and proposal's scope history.

import {
  type Activity,
  type ActivityRequest,
  activitySubject,
  type Choice,
  type Customer,
  type CustomerRequest,
  draftKeyKinds,
  type EffortConversions,
  type Feature,
  type FeatureColumns,
  featureNamerKeys,
  type FeatureProjectsRequest,
  featureProjectsRequestSchema,
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
  type RecordKeyKind,
  type RecordKeyOf,
  type ProposalRequest,
  type ReleaseStream,
  type RemovalReasonRequest,
  savedSchema,
  scopeHistorySchema,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getJson, sendDeleteFor, sendJsonFor } from "./api.ts";
import type { CellChange } from "./cell-kinds.tsx";
import { choice } from "./lists.ts";
import { type RecordNode, recordNode } from "./record-drafts.ts";
import {
  cycleChoices,
  type ReleaseGroup,
  releaseOfCycle,
} from "./feature-cycles.ts";

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

export type PlanKind = "customer" | "project" | "proposal" | "feature";

export type PlanRequest =
  | { type: "customer"; request: CustomerRequest }
  | { type: "project"; request: ProjectRequest }
  | { type: "proposal"; request: ProposalRequest }
  | { type: "feature"; request: FeatureRequest };

const paths: Readonly<Record<PlanKind, string>> = {
  customer: "/api/customers",
  project: "/api/projects",
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

// The kinds of record that name features: the field a feature's row shows them in, and where the
// plan holds them.
export const featureNamers = {
  project: { key: featureNamerKeys.project, records: "projects" },
  proposal: { key: featureNamerKeys.proposal, records: "proposals" },
} as const satisfies Record<
  keyof typeof featureNamerKeys,
  {
    key: keyof FeatureProjectsRequest;
    records: keyof Pick<ProjectPlan, "projects" | "proposals">;
  }
>;

const namerKinds = Object.values(featureNamers);
const namerKeys: readonly string[] = Object.values(featureNamerKeys);

// A project or proposal, as one that names features.
export interface FeatureNamer {
  type: keyof typeof featureNamers;
  id: string;
}

// A change to a feature split into the projects and proposals that name it, and its own fields.
export function namersIn(change: CellChange & Record<string, unknown>): {
  namers: Partial<FeatureProjectsRequest>;
  own: CellChange & Record<string, unknown>;
} {
  const entries = Object.entries(change);
  return {
    namers: featureProjectsRequestSchema.parse(
      Object.fromEntries(entries.filter(([key]) => namerKeys.includes(key))),
    ),
    own: Object.fromEntries(
      entries.filter(([key]) => !namerKeys.includes(key)),
    ),
  };
}

// The plan with a feature named by the projects and proposals a change gives, and by no others of
// those kinds.
export function withNamers(
  plan: ProjectPlan,
  featureId: string,
  namers: Partial<FeatureProjectsRequest>,
): ProjectPlan {
  return namerKinds.reduce((next, { key, records }) => {
    // The key is always one of the fixed keys above.
    // eslint-disable-next-line security/detect-object-injection
    const named = namers[key];
    if (named === undefined) return next;
    return {
      ...next,
      // eslint-disable-next-line security/detect-object-injection
      [records]: next[records].map((record) => {
        const others = record.featureIds.filter((id) => id !== featureId);
        return {
          ...record,
          featureIds: named.includes(record.id)
            ? [...others, featureId].sort()
            : others,
        };
      }),
    };
  }, plan);
}

export const changeFeatureProjects = (
  featureId: string,
  request: Partial<FeatureProjectsRequest>,
): Promise<SavedPlan> =>
  sendJsonFor(
    "PUT",
    `${recordPath("feature", featureId)}/projects-and-proposals`,
    request,
    savedPlan,
  );

// The features a project or proposal was given and had removed, read again with the plan.
export const scopeHistoryQuery = (type: "project" | "proposal", id: string) =>
  queryOptions({
    queryKey: [...projectPlanQuery.queryKey, "scope-history", type, id],
    queryFn: async () =>
      getJson(`${recordPath(type, id)}/scope-history`, scopeHistorySchema),
  });

export const changeRemovalReason = (
  featureId: string,
  proposalId: string,
  request: RemovalReasonRequest,
): Promise<SavedPlan> =>
  sendJsonFor(
    "PUT",
    `${recordPath("feature", featureId)}/proposals/${encodeURIComponent(proposalId)}/removal-reason`,
    request,
    savedPlan,
  );

// The names of the records given whose identifiers are given, in the records' order.
export const namesOf = (
  records: readonly { id: string; name: string }[],
  ids: readonly string[],
) => records.filter(({ id }) => ids.includes(id)).map(({ name }) => name);

export const isProposal = (record: PlanRecord): record is Proposal =>
  "removalReasons" in record;

// The parts of a project, each under its project's address.
type ProjectPart = "milestones" | "activities";

const partsPath = (part: ProjectPart, projectId: string) =>
  `/api/projects/${encodeURIComponent(projectId)}/${part}`;

const partPath = (
  part: ProjectPart,
  record: { id: string; projectId: string },
) => `${partsPath(part, record.projectId)}/${encodeURIComponent(record.id)}`;

const addPart = (part: ProjectPart, projectId: string, request: object) =>
  sendJsonFor("POST", partsPath(part, projectId), request, savedPlan);

const changePart = (
  part: ProjectPart,
  record: { id: string; projectId: string },
  request: object,
) => sendJsonFor("PUT", partPath(part, record), request, savedPlan);

const removePart = async (
  part: ProjectPart,
  record: { id: string; projectId: string },
) => (await sendDeleteFor(partPath(part, record), savedSchema)).changeSetId;

export const addMilestone = (
  projectId: string,
  request: MilestoneRequest,
): Promise<SavedPlan> => addPart("milestones", projectId, request);

export const changeMilestone = (
  milestone: Milestone,
  request: MilestoneRequest,
): Promise<SavedPlan> => changePart("milestones", milestone, request);

export const removeMilestone = (milestone: Milestone): Promise<string | null> =>
  removePart("milestones", milestone);

// A project's activity, which always names its project.
export type ProjectActivity = Activity & { projectId: string };

export const isProjectActivity = (
  activity: Activity,
): activity is ProjectActivity => activity.projectId !== null;

// The activities the plan holds, all of them a project's.
export const projectActivities = (
  plan: Pick<ProjectPlan, "activities">,
): ProjectActivity[] => plan.activities.filter(isProjectActivity);

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

export const activityRequest = (activity: Activity): ActivityRequest => ({
  name: activity.name,
  description: activity.description,
  note: activity.note,
  estimateHours: activity.estimateHours,
});

// The fields a feature's table edits, as the server shows them.
export type FeatureFields = Pick<
  Feature,
  | "name"
  | "statusId"
  | "priorityId"
  | "sizeId"
  | "riskId"
  | "neededBy"
  | "customerIds"
  | "targetStreamId"
  | "targetCycle"
  | "estimateHours"
  | "featureTeamId"
  | "description"
  | "note"
>;

// What saving a feature sends: its target as a stream and a cycle together, and only the added
// columns' values it changes, since the server keeps those not named.
export const featureRequest = (
  {
    name,
    statusId,
    priorityId,
    sizeId,
    riskId,
    neededBy,
    customerIds,
    estimateHours,
    featureTeamId,
    description,
    note,
    targetStreamId,
    targetCycle,
  }: FeatureFields,
  { values = {}, links = {}, notes = {}, numbers = {} }: CellChange = {},
): FeatureRequest => ({
  name,
  ...(statusId === "" ? {} : { statusId }),
  priorityId,
  sizeId,
  riskId,
  neededBy,
  customerIds,
  estimateHours,
  featureTeamId,
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
  "customers" | "projects" | "proposals" | "features" | "activities"
>;

// A record named with its ID first, where it has one, such as P-2001 Crane Control.
export const identifiedLabel = ({
  externalId,
  name,
}: {
  name: string;
  externalId?: string | null;
}) => (externalId == null ? name : `${externalId} ${name}`);

// Every customer, proposal, project, milestone, project activity and feature, named as decisions
// name them, and as the Drafts table names them.
export function listedPlanRecords(plan: PlanLists): {
  kind: PlanRecordKind;
  record: PlanRecord;
  subject: string;
  // The record's name as a table names it, with its project's for a milestone or an activity.
  name: string;
}[] {
  return [
    ...plan.features.map((record) => ({
      kind: "feature" as const,
      record,
      subject: projectSubjects.feature(record.name),
      name: record.name,
    })),
    ...plan.customers.map((record) => ({
      kind: "customer" as const,
      record,
      subject: projectSubjects.customer(record.name),
      name: record.name,
    })),
    ...plan.proposals.map((record) => ({
      kind: "proposal" as const,
      record,
      subject: projectSubjects.proposal(record.name),
      name: identifiedLabel(record),
    })),
    ...plan.projects.flatMap((project) => [
      {
        kind: "project" as const,
        record: project,
        subject: projectSubjects.project(project.name),
        name: identifiedLabel(project),
      },
      ...project.milestones.map((record) => ({
        kind: "milestone" as const,
        record,
        subject: projectSubjects.milestone(record.name, project.name),
        name: `${record.name} of ${identifiedLabel(project)}`,
      })),
      ...projectActivities(plan)
        .filter(({ projectId }) => projectId === project.id)
        .map((record) => ({
          kind: "project-activity" as const,
          record,
          subject: activitySubject(record.name, project.name),
          name: `${record.name} of ${identifiedLabel(project)}`,
        })),
    ]),
  ];
}

export const planNodes = (plan: PlanLists): RecordNode[] =>
  listedPlanRecords(plan).map(({ kind, record, subject }) =>
    recordNode(kind, record, subject),
  );

export const projectTabs = [
  "projects",
  "proposals",
  "customers",
  "milestones",
] as const;

export type ProjectTab = (typeof projectTabs)[number];

// What the plan's page shows: one of the Projects page's tabs, or the Features page.
export type PlanTab = ProjectTab | "features";

// The Projects page's address for a tab, with a record's details open if one is named.
const projectsTabSearch = (next: ProjectTab, record?: string) => ({
  ...(next === "projects" ? {} : { tab: next }),
  ...(record === undefined ? {} : { open: record }),
});

// The address of one of the plan's pages or tabs, with a record's details open if one is named.
export const planAddress = (next: PlanTab, record?: string) =>
  next === "features"
    ? { to: "/features" as const, search: { open: record } }
    : { to: "/projects" as const, search: projectsTabSearch(next, record) };

// The address of a project's activity: its details under its project's on Projects.
export const activityAddress = (projectId: string, activity: string) => ({
  to: "/projects" as const,
  search: { open: projectId, activity },
});

export type PlanRecord =
  Customer | Project | Proposal | Milestone | ProjectActivity | Feature;
export const isFeature = (record: PlanRecord): record is Feature =>
  "featureTeamId" in record;

export type PlanRecordKind =
  | "customer"
  | "project"
  | "proposal"
  | "milestone"
  | "project-activity"
  | "feature";

// A plan record's key, its kind as drafts number it, such as ACTIVITY for a project's activity.
export const planRecordKey = (
  kind: PlanRecordKind,
  { keyNumber }: { keyNumber: number },
): RecordKeyOf & { kind: Exclude<RecordKeyKind, "column"> } => ({
  // Every kind of the plan's records has a key, and none is a column.
  // eslint-disable-next-line security/detect-object-injection
  kind: draftKeyKinds[kind] as Exclude<RecordKeyKind, "column">,
  keyNumber,
});

// A milestone being added, with the project it is added to.
export type MilestoneAdding = MilestoneRequest & { projectId: string };

// An activity being added, with the project it is added to.
export type ActivityAdding = ActivityRequest & { projectId: string };

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
    | Blank<ProjectActivity>
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
  "project-activity": {
    blank: {
      name: "",
      projectId: "",
      releaseId: null,
      description: null,
      note: null,
      estimateHours: null,
    },
    all: projectActivities,
    withAll: (plan, records) => ({
      ...plan,
      activities: [
        ...plan.activities.filter((activity) => !isProjectActivity(activity)),
        ...(records as ProjectActivity[]),
      ],
    }),
    add: (request) => {
      const { projectId, ...activity } = request as ActivityAdding;
      return addPart("activities", projectId, activity);
    },
    change: (record, change) =>
      changePart("activities", record as ProjectActivity, {
        ...activityRequest(record as ProjectActivity),
        ...change,
      }),
    remove: (record) => removePart("activities", record as ProjectActivity),
  },
  feature: {
    blank: {
      name: "",
      statusId: "",
      priorityId: null,
      sizeId: null,
      riskId: null,
      neededBy: null,
      customerIds: [],
      targetStreamId: null,
      targetCycle: null,
      estimateHours: null,
      featureTeamId: null,
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
  features: readonly Feature[];
  activities: readonly ProjectActivity[];
  statuses: Choice[];
  // In their list's order, each with its meaning.
  featureStatuses: Choice[];
  // Each in its list's order.
  priorities: Choice[];
  sizes: Choice[];
  risks: Choice[];
  featureTeams: Choice[];
  // Every cycle a feature can target.
  cycles: Choice[];
  // The release each of those cycles is in, by its choice.
  releaseOfCycle: Map<string, ReleaseGroup>;
  featureColumns: FeatureColumns;
  // The projects and proposals with their drafts, whatever the view, which mark the features they
  // name as each draft adds or takes them away.
  drafted: { projects: readonly Project[]; proposals: readonly Proposal[] };
  // The conversions between units of effort, where the page has them, without which effort is
  // offered in hours alone.
  effortConversions?: EffortConversions | undefined;
}

export const tableChoices = (
  plan: PlanLists & Pick<ProjectPlan, "featureColumns">,
  picks: PlanChoices,
  streams: readonly ReleaseStream[],
  effortConversions?: EffortConversions,
): TableChoices => ({
  people: asChoices(picks.owners),
  statuses: asChoices(picks.statuses),
  featureStatuses: picks.featureStatuses.map(
    ({ id, name, retired, meaning }) => ({
      ...choice(id, name, retired),
      meaning,
    }),
  ),
  priorities: asChoices(picks.priorities),
  sizes: asChoices(picks.sizes),
  risks: asChoices(picks.risks),
  featureTeams: asChoices(picks.featureTeams),
  cycles: cycleChoices(streams),
  releaseOfCycle: releaseOfCycle(streams),
  customers: plan.customers,
  proposals: plan.proposals,
  projects: plan.projects,
  features: plan.features,
  activities: projectActivities(plan),
  featureColumns: plan.featureColumns,
  drafted: { projects: plan.projects, proposals: plan.proposals },
  effortConversions,
});
