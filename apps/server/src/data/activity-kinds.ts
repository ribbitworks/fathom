// SPDX-License-Identifier: Apache-2.0

// Activities as kinds of the plan's records, one for each owner over the one table, so each takes
// its owner's permissions. Part of the data access layer.

import { activities } from "@fathom/db";
import {
  type ActivityOwner,
  activityOwnerFields,
  activitySubject,
  type ActivityType,
  activityTypes,
  type Permission,
} from "@fathom/shared";
import { isNotNull } from "drizzle-orm";
import { releaseCalled } from "./release-kinds.ts";
import {
  ownerRemovalUsed,
  type RecordKind,
  type RecordsState,
  shownVersion,
  shownWhere,
} from "./record-state.ts";

// An owner's activities, as shown.
export const activitiesOf = (
  state: RecordsState,
  owner: ActivityOwner,
  ownerId: string,
): string[] =>
  // The owner is always one of the two fixed ones.
  // eslint-disable-next-line security/detect-object-injection
  shownWhere(state, activityTypes[owner], activityOwnerFields[owner], ownerId);

interface OwnerRules {
  ownerType: "project" | "release";
  readWith: readonly Permission[];
  ownerCalled: (state: RecordsState, id: string) => string;
}

const ownerRules: Record<ActivityOwner, OwnerRules> = {
  project: {
    ownerType: "project",
    readWith: ["plan:view"],
    ownerCalled: (state, id) =>
      String(shownVersion(state, "project", id)?.name),
  },
  release: {
    ownerType: "release",
    readWith: ["features:view"],
    ownerCalled: (state, id) => {
      const { name, stream } = releaseCalled(state, id);
      return `${name} in ${stream}`;
    },
  },
};

function activityKind(owner: ActivityOwner): RecordKind {
  // The owner is always one of the two fixed ones.
  // eslint-disable-next-line security/detect-object-injection
  const type: ActivityType = activityTypes[owner];
  // eslint-disable-next-line security/detect-object-injection
  const field = activityOwnerFields[owner];
  // eslint-disable-next-line security/detect-object-injection
  const { ownerType, readWith, ownerCalled } = ownerRules[owner];
  return {
    type,
    table: activities,
    rowsWhere: isNotNull(
      owner === "project" ? activities.projectId : activities.releaseId,
    ),
    fields: [field, "name", "description", "note", "estimateHours"],
    links: { [field]: ownerType },
    belongsTo: field,
    unique: [
      {
        field: "name",
        within: field,
        message: `This ${ownerType} already has an activity with that name`,
      },
    ],
    readWith,
    unseenSubject: "an activity",
    subject: (state, id) => {
      const activity = shownVersion(state, type, id);
      return activitySubject(
        String(activity?.name),
        // eslint-disable-next-line security/detect-object-injection
        ownerCalled(state, String(activity?.[field])),
      );
    },
    // An activity removed with its project uses the project's removal, as a milestone does.
    alsoUses: (state, id) =>
      ownerRemovalUsed(state, type, id, field, ownerType),
  };
}

export const projectActivityKind = activityKind("project");
export const releaseActivityKind = activityKind("release");

export const activityKinds: Record<ActivityType, RecordKind> = {
  "project-activity": projectActivityKind,
  "release-activity": releaseActivityKind,
};
