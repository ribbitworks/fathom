// SPDX-License-Identifier: Apache-2.0

// Customers, proposals, projects, features, and milestones, as kinds of the plan's records, in the
// order approving adds them, so each comes after the records it links to. A project and its
// milestones are removed together: the draft removing a project uses the drafts removing its
// milestones, and each of those uses the project's, so they are approved, rejected, and discarded
// together. Each project has a general feature, which takes people assigned to the project itself:
// it follows the project's approval rather than having a draft, and nobody chooses anything in it,
// so the project's own history covers it. Part of the data access layer; records.ts applies the
// rules every kind shares.

import {
  customers,
  features,
  milestones,
  projects,
  proposals,
} from "@fathom/db";
import { projectSubjects, type RecordRef } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { firstOfferedOrRefused } from "./built-in-lists.ts";
import { featureKind, projectSubject } from "./release-kinds.ts";
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

export const customerKind: RecordKind = {
  type: "customer",
  table: customers,
  fields: ["name"],
  links: {},
  unique: [
    { field: "name", message: "There is already a customer with that name" },
  ],
  readWith: ["plan:view"],
  subject: (state, id) =>
    projectSubjects.customer(nameOf(state, "customer", id)),
};

export const proposalKind: RecordKind = {
  type: "proposal",
  table: proposals,
  fields: ["name", "externalId", "link", "ownerId", "customerIds", "statusId"],
  links: { customerIds: "customer" },
  refers: { ownerId: "person", statusId: "choice" },
  unique: [
    { field: "name", message: "There is already a proposal with that name" },
    {
      field: "externalId",
      message: "There is already a proposal with that Proposal ID",
    },
  ],
  readWith: ["plan:view"],
  subject: (state, id) =>
    projectSubjects.proposal(nameOf(state, "proposal", id)),
};

export const projectKind: RecordKind = {
  type: "project",
  table: projects,
  fields: ["name", "externalId", "ownerId", "customerIds", "proposalIds"],
  links: { customerIds: "customer", proposalIds: "proposal" },
  refers: { ownerId: "person" },
  unique: [
    { field: "name", message: "There is already a project with that name" },
    {
      field: "externalId",
      message: "There is already a project with that Project ID",
    },
  ],
  readWith: ["plan:view"],
  subject: projectSubject,
  onAdded: async (transaction, id) => {
    const statusId = await firstOfferedOrRefused(
      transaction,
      "feature-statuses",
      "in-progress",
      "No feature status means In progress. Add one to the list first.",
    );
    await transaction
      .insert(features)
      .values({ statusId, generalForProjectId: id });
  },
  onRemoving: async (transaction, id) => {
    await transaction
      .delete(features)
      .where(eq(features.generalForProjectId, id));
  },
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
  proposalKind,
  projectKind,
  featureKind,
  milestoneKind,
] as const;
