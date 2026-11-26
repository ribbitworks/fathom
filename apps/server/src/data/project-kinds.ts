// SPDX-License-Identifier: Apache-2.0

// Customers, features, proposals, projects, and milestones as kinds of the plan's records, in the
// order approving adds them, each after the records it links to; records.ts applies their rules.

import { customers, milestones, projects, proposals } from "@fathom/db";
import {
  type MilestoneDay,
  projectSubjects,
  type RecordRef,
  removalReasonsIn,
} from "@fathom/shared";
import type { Recorded } from "./draft-records.ts";
import {
  featureKind,
  projectReaders,
  projectSubject,
  unseenProject,
} from "./release-kinds.ts";
import {
  type RecordKind,
  type RecordsState,
  shownIds,
  shownVersion,
  stateOf,
  versionOf,
} from "./record-state.ts";

const nameOf = (state: RecordsState, type: RecordKind["type"], id: string) =>
  String(shownVersion(state, type, id)?.name);

const removedByDraft = (
  state: RecordsState,
  type: RecordKind["type"],
  id: string,
) =>
  stateOf(state, type).drafts.has(id) &&
  versionOf(state, type, id) === undefined;

// The milestones of a project, as shown.
export const milestonesOf = (state: RecordsState, projectId: string) =>
  shownIds(state, "milestone").filter(
    (id) => shownVersion(state, "milestone", id)?.projectId === projectId,
  );

const asDay = (milestone: Recorded): MilestoneDay => ({
  date: String(milestone.date),
  customerDelivery: milestone.customerDelivery === true,
});

// A project's milestones by day, approved, and as their drafts make them, those drafted to be
// removed left out.
export function milestoneDays(
  state: RecordsState,
  projectId: string,
): { live: MilestoneDay[]; drafted: MilestoneDay[] } {
  return {
    live: [...stateOf(state, "milestone").live.values()]
      .filter((milestone) => milestone.projectId === projectId)
      .map(asDay),
    drafted: milestonesOf(state, projectId).flatMap((milestone) => {
      const version = versionOf(state, "milestone", milestone);
      return version === undefined ? [] : [asDay(version)];
    }),
  };
}

export const customerKind: RecordKind = {
  type: "customer",
  table: customers,
  fields: ["name", "description", "note"],
  links: {},
  unique: [{ field: "name", message: "Another customer has that name" }],
  readWith: ["plan:view"],
  unseenSubject: "a customer",
  subject: (state, id) =>
    projectSubjects.customer(nameOf(state, "customer", id)),
};

const removalReasonsOf = (value: unknown) =>
  Object.entries(removalReasonsIn(value));

export const proposalKind: RecordKind = {
  type: "proposal",
  table: proposals,
  fields: [
    "name",
    "externalId",
    "link",
    "ownerId",
    "customerIds",
    "statusId",
    "featureIds",
    "removalReasons",
  ],
  links: { customerIds: "customer", featureIds: "feature" },
  refers: { ownerId: "person", statusId: "choice" },
  unique: [
    { field: "name", message: "Another proposal has that name" },
    {
      field: "externalId",
      message: "Another proposal has that Proposal ID",
    },
  ],
  readWith: ["plan:view"],
  unseenSubject: "a proposal",
  subject: (state, id) =>
    projectSubjects.proposal(nameOf(state, "proposal", id)),
  // Each reason for removing a feature, after the feature's name.
  idsInValue: {
    removalReasons: {
      kind: "feature",
      ids: (value) => removalReasonsOf(value).map(([featureId]) => featureId),
    },
  },
  valueInWords: (field, value, name) =>
    field === "removalReasons"
      ? removalReasonsOf(value).map(
          ([featureId, reason]) =>
            `${name(featureId) ?? "A removed feature"}: ${reason}`,
        )
      : undefined,
};

// A project and its milestones are removed together: the draft removing a project uses the drafts
// removing its milestones, and each of those uses the project's.
export const projectKind: RecordKind = {
  type: "project",
  table: projects,
  fields: [
    "name",
    "externalId",
    "ownerId",
    "customerIds",
    "proposalIds",
    "featureIds",
  ],
  links: {
    customerIds: "customer",
    proposalIds: "proposal",
    featureIds: "feature",
  },
  refers: { ownerId: "person" },
  unique: [
    { field: "name", message: "Another project has that name" },
    {
      field: "externalId",
      message: "Another project has that Project ID",
    },
  ],
  readWith: projectReaders,
  unseenSubject: unseenProject,
  subject: projectSubject,
  alsoUses: (state, id): RecordRef[] =>
    removedByDraft(state, "project", id)
      ? milestonesOf(state, id)
          .filter((milestone) => removedByDraft(state, "milestone", milestone))
          .map((milestone) => ({ type: "milestone", id: milestone }))
      : [],
};

export const milestoneKind: RecordKind = {
  type: "milestone",
  table: milestones,
  fields: ["projectId", "name", "date", "customerDelivery"],
  links: { projectId: "project" },
  belongsTo: "projectId",
  readWith: ["plan:view"],
  unseenSubject: "a milestone",
  subject: (state, id) => {
    const milestone = shownVersion(state, "milestone", id);
    return projectSubjects.milestone(
      String(milestone?.name),
      nameOf(state, "project", String(milestone?.projectId)),
    );
  },
  alsoUses: (state, id): RecordRef[] => {
    const projectId = String(
      stateOf(state, "milestone").live.get(id)?.projectId,
    );
    return removedByDraft(state, "milestone", id) &&
      removedByDraft(state, "project", projectId)
      ? [{ type: "project", id: projectId }]
      : [];
  },
};

export const projectKinds = [
  customerKind,
  featureKind,
  proposalKind,
  projectKind,
  milestoneKind,
] as const;
