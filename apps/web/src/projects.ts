// SPDX-License-Identifier: Apache-2.0

// The plan's records through the server's API: reading them, with what they pick from, changes to
// features' projects and proposals, and each project's and proposal's scope history.

import {
  withSchedule,
  type Choice,
  type Activity,
  type ActivityRequest,
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
  shownColour,
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

export type PlanKind =
  "customer" | "project" | "proposal" | "feature" | "activity";

export type PlanRequest =
  | { type: "customer"; request: CustomerRequest }
  | { type: "project"; request: ProjectRequest }
  | { type: "proposal"; request: ProposalRequest }
  | { type: "feature"; request: FeatureRequest }
  | { type: "activity"; request: ActivityRequest };

const paths: Readonly<Record<PlanKind, string>> = {
  customer: "/api/customers",
  project: "/api/projects",
  proposal: "/api/proposals",
  feature: "/api/features",
  activity: "/api/activities",
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
export type PlanTab = ProjectTab | "features" | "activities";

// The Projects page's address for a tab, with a record's details open if one is named.
const projectsTabSearch = (next: ProjectTab, record?: string) => ({
  ...(next === "projects" ? {} : { tab: next }),
  ...(record === undefined ? {} : { open: record }),
});

// The address of one of the plan's pages or tabs, with a record's details open if one is named.
export const planAddress = (next: PlanTab, record?: string) => {
  if (next === "features") {
    return { to: "/features" as const, search: { open: record } };
  }
  if (next === "activities") {
    return { to: "/activities" as const, search: { open: record } };
  }
  return { to: "/projects" as const, search: projectsTabSearch(next, record) };
};

export type PlanRecord =
  Customer | Project | Proposal | Milestone | Feature | Activity;
// Planned work, a feature or an activity, which alone holds added columns' values and Staffed.
export const isPlanned = (record: PlanRecord): record is Feature | Activity =>
  "featureTeamId" in record;

export type PlanRecordKind =
  "customer" | "project" | "proposal" | "milestone" | "feature" | "activity";

// A milestone being added, with the project it is added to.
export type MilestoneAdding = MilestoneRequest & { projectId: string };

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
  featureTeamColours: ReadonlyMap<string, string | null>;
  // Every cycle a feature can target.
  cycles: Choice[];
  // The release each of those cycles is in, by its choice.
  releaseOfCycle: Map<string, ReleaseGroup>;
  // Every release an activity can belong to, each named with its schedule.
  releases: Choice[];
  featureColumns: FeatureColumns;
  activityColumns: FeatureColumns;
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
  // The release's colour; none for a stream's cycles in no release.
  colour: string | null;
}

export const releaseGroupKey = (streamId: string, releaseId: string | null) =>
  `${streamId} ${releaseId ?? "unreleased"}`;

// The stream whose release, or cycles in none, a release group's key names.
// The stream a release is in, as a list: empty for a release no stream holds.
export const streamsOfRelease = (
  streams: readonly ReleaseStream[],
  releaseId: string,
): string[] =>
  streams
    .filter(({ releases }) => releases.some(({ id }) => id === releaseId))
    .map(({ id }) => id);

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
        colour: shownColour(release.colour),
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
        colour: null,
      },
      () => true,
    );
  });
  return groups;
}

export const tableChoices = (
  plan: PlanLists & Pick<ProjectPlan, "featureColumns" | "activityColumns">,
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
  featureTeamColours: new Map(
    picks.featureTeams.map(({ id, colour }) => [id, colour]),
  ),
  cycles: cycleChoices(streams),
  releaseOfCycle: releaseOfCycle(streams),
  releases: streams.flatMap((stream) =>
    stream.releases.map(({ id, name }) =>
      choice(id, withSchedule(stream, name), stream.retired),
    ),
  ),
  customers: plan.customers,
  proposals: plan.proposals,
  projects: plan.projects,
  features: plan.features,
  featureColumns: plan.featureColumns,
  activityColumns: plan.activityColumns,
  drafted: {
    projects: plan.projects,
    proposals: plan.proposals,
    features: plan.features,
  },
  effortConversions,
});
