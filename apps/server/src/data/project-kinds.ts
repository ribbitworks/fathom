// SPDX-License-Identifier: Apache-2.0

// Customers, features, proposals, projects, and milestones, as kinds of the plan's records, in the
// order approving adds them. Part of the data access layer.

import { customers, milestones, projects, proposals } from "@fathom/db";
import {
  projectSubjects,
  type RecordRef,
  removalReasonsIn,
} from "@fathom/shared";
import { activitiesOf } from "./activity-kinds.ts";
import { featureKind, projectSubject } from "./release-kinds.ts";
import {
  ownerRemovalUsed,
  type RecordKind,
  type RecordsState,
  removedByDraft,
  shownVersion,
  shownWhere,
} from "./record-state.ts";

const nameOf = (state: RecordsState, type: RecordKind["type"], id: string) =>
  String(shownVersion(state, type, id)?.name);

// The milestones of a project, as shown.
export const milestonesOf = (state: RecordsState, projectId: string) =>
  shownWhere(state, "milestone", "projectId", projectId);

// What belongs to a project and is removed with it: its milestones and activities, as shown.
export const belongingTo = (
  state: RecordsState,
  projectId: string,
): RecordRef[] => [
  ...milestonesOf(state, projectId).map((id): RecordRef => ({
    type: "milestone",
    id,
  })),
  ...activitiesOf(state, "project", projectId).map((id): RecordRef => ({
    type: "project-activity",
    id,
  })),
];

export const customerKind: RecordKind = {
  type: "customer",
  table: customers,
  fields: ["name"],
  links: {},
  unique: [
    { field: "name", message: "There is already a customer with that name" },
  ],
  readWith: ["plan:view"],
  unseenSubject: "a customer",
  subject: (state, id) =>
    projectSubjects.customer(nameOf(state, "customer", id)),
};

const removalReasonsOf = (field: string, value: unknown) =>
  field === "removalReasons" ? Object.entries(removalReasonsIn(value)) : [];

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
    { field: "name", message: "There is already a proposal with that name" },
    {
      field: "externalId",
      message: "There is already a proposal with that Proposal ID",
    },
  ],
  readWith: ["plan:view"],
  unseenSubject: "a proposal",
  subject: (state, id) =>
    projectSubjects.proposal(nameOf(state, "proposal", id)),
  // Each reason for removing a feature, after the feature's name.
  idsInValue: (field, value) =>
    removalReasonsOf(field, value).map(([featureId]) => featureId),
  valueInWords: (field, value, name) =>
    field === "removalReasons"
      ? removalReasonsOf(field, value).map(
          ([featureId, reason]) =>
            `${name(featureId) ?? "A removed feature"}: ${reason}`,
        )
      : undefined,
};

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
    { field: "name", message: "There is already a project with that name" },
    {
      field: "externalId",
      message: "There is already a project with that Project ID",
    },
  ],
  readWith: ["plan:view"],
  unseenSubject: "a project",
  subject: projectSubject,
  // A project and what belongs to it are removed together, each removal using the others'
  // drafts, so they are approved, rejected, and discarded together.
  alsoUses: (state, id): RecordRef[] =>
    removedByDraft(state, "project", id)
      ? belongingTo(state, id).filter((record) =>
          removedByDraft(state, record.type, record.id),
        )
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
  alsoUses: (state, id) =>
    ownerRemovalUsed(state, "milestone", id, "projectId", "project"),
};

export const projectKinds = [
  customerKind,
  featureKind,
  proposalKind,
  projectKind,
  milestoneKind,
] as const;
