// SPDX-License-Identifier: Apache-2.0

// Customers, projects with their milestones, and proposals through the server's API: reading them,
// with what they pick from, every change to them, each a draft, each record as decisions on its
// draft name it, and each project's and proposal's scope history.

import {
  type Choice,
  type Customer,
  type CustomerRequest,
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
  includesCycle,
  keptReleases,
  releaseDate,
  withSchedule,
} from "./releases.ts";
import { formatDay } from "./day-formats.ts";

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
  "customers" | "projects" | "proposals" | "features"
>;

// A record named with its ID first, where it has one, such as P-2001 Crane Control.
export const identifiedLabel = ({
  externalId,
  name,
}: {
  name: string;
  externalId?: string | null;
}) => (externalId == null ? name : `${externalId} ${name}`);

// Every customer, proposal, project, milestone, and feature, named as decisions name them, and as
// the Drafts table names them.
export function listedPlanRecords(plan: PlanLists): {
  kind: PlanRecordKind;
  record: PlanRecord;
  subject: string;
  // The record's name as a table names it, with its project's for a milestone.
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

export type PlanRecord = Customer | Project | Proposal | Milestone | Feature;
export const isFeature = (record: PlanRecord): record is Feature =>
  "featureTeamId" in record;

export type PlanRecordKind =
  "customer" | "project" | "proposal" | "milestone" | "feature";

// A milestone being added, with the project it is added to.
export type MilestoneAdding = MilestoneRequest & { projectId: string };

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
  // The records with their drafts, whatever the view, which mark the records each lists, or the
  // features a project or proposal names, as each draft adds or takes them away.
  drafted: {
    projects: readonly Project[];
    proposals: readonly Proposal[];
    features: readonly Feature[];
  };
  // The conversions between units of effort, where the page has them, without which effort is
  // offered in hours alone.
  effortConversions?: EffortConversions | undefined;
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

// A stream's cycles a feature can name, by date: those of a retired stream are kept to name what
// targets them, and offered to nothing new.
function namedCycles(stream: ReleaseStream) {
  const drafted = new Set(stream.cycles.map(({ startsOn }) => startsOn));
  return [
    ...stream.cycles.map((cycle) => ({ cycle, retired: stream.retired })),
    // Cycles only as they are live are kept to name what is on them until a draft is approved.
    ...(stream.liveCycles ?? [])
      .filter(({ startsOn }) => !drafted.has(startsOn))
      .map((cycle) => ({ cycle, retired: true })),
  ].sort((a, b) => a.cycle.startsOn.localeCompare(b.cycle.startsOn));
}

// Every stream's cycles, each named with its stream, streams in their order and cycles by date.
export const cycleChoices = (streams: readonly ReleaseStream[]): Choice[] =>
  streams.flatMap((stream) =>
    namedCycles(stream).map(({ cycle, retired }) =>
      choice(
        cycleChoiceId(stream.id, cycle.startsOn),
        withSchedule(stream, cycle.name),
        retired,
      ),
    ),
  );

// Every stream's cycles' own names, by their choices.
export const cycleNames = (
  streams: readonly ReleaseStream[],
): ReadonlyMap<string, string> =>
  new Map(
    streams.flatMap((stream) =>
      namedCycles(stream).map(({ cycle }) => [
        cycleChoiceId(stream.id, cycle.startsOn),
        cycle.name,
      ]),
    ),
  );

// The release, or a stream's cycles in none, that features are grouped under, in order of rank: its
// key, which starts with its stream's, its heading, and its name.
export interface ReleaseGroup {
  key: string;
  label: string;
  rank: number;
  name: string;
}

export const releaseGroupKey = (streamId: string, releaseId: string | null) =>
  `${streamId} ${releaseId ?? "unreleased"}`;

// The stream whose release, or cycles in none, a release group's key names.
export const streamOfReleaseGroup = (key: string): string =>
  key.slice(0, key.indexOf(" "));

// The release each cycle a feature can target is in, by the cycle's choice: every stream's
// releases, streams in their order and releases by date, each named with its stream and the day it
// ships, then each stream's cycles in no release, as Not released yet.
export function releaseOfCycle(
  streams: readonly ReleaseStream[],
): Map<string, ReleaseGroup> {
  const releases = streams.flatMap((stream) =>
    keptReleases(stream)
      .sort((a, b) => a.firstCycle.localeCompare(b.firstCycle))
      .map((release) => ({ stream, release })),
  );
  const groups = new Map<string, ReleaseGroup>();
  const place = (
    stream: ReleaseStream,
    group: ReleaseGroup,
    holds: (startsOn: string) => boolean,
  ) => {
    for (const { cycle } of namedCycles(stream)) {
      const id = cycleChoiceId(stream.id, cycle.startsOn);
      if (!groups.has(id) && holds(cycle.startsOn)) groups.set(id, group);
    }
  };
  releases.forEach(({ stream, release }, rank) => {
    const shipsOn = releaseDate(stream, release);
    const name = withSchedule(stream, release.name);
    place(
      stream,
      {
        key: releaseGroupKey(stream.id, release.id),
        label:
          shipsOn === undefined ? name : `${name}, ships ${formatDay(shipsOn)}`,
        rank,
        name,
      },
      (startsOn) => includesCycle(release, startsOn),
    );
  });
  streams.forEach((stream, order) => {
    const name = withSchedule(stream, "Not released yet");
    place(
      stream,
      {
        key: releaseGroupKey(stream.id, null),
        label: name,
        rank: releases.length + order,
        name,
      },
      () => true,
    );
  });
  return groups;
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
  featureColumns: plan.featureColumns,
  drafted: {
    projects: plan.projects,
    proposals: plan.proposals,
    features: plan.features,
  },
  effortConversions,
});
