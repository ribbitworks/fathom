// SPDX-License-Identifier: Apache-2.0

// Activities as a kind of the plan's records, each of one project or one release, drafted and read
// with Features' permissions. Part of the data access layer.

import { activities } from "@fathom/db";
import { projectSubjects } from "@fathom/shared";
import { planningRefers, releaseCalled } from "./release-kinds.ts";
import type { Recorded } from "./draft-records.ts";
import {
  type RecordKind,
  type RecordsState,
  shownVersion,
} from "./record-state.ts";

// What an activity belongs to: its release, with its schedule, since releases are seen with
// Features; its project by name only to a reader of the plan, else "a project".
export const activityOwnerCalled = (
  state: RecordsState,
  activity: Recorded,
  readsPlan: boolean,
) =>
  typeof activity.projectId === "string"
    ? readsPlan
      ? String(shownVersion(state, "project", activity.projectId)?.name)
      : "a project"
    : releaseCalled(state, String(activity.releaseId));

// An activity holds a feature's planning fields and refers to the same lists and feature teams; its
// name is unique within its project or its release.
export const activityKind: RecordKind = {
  type: "activity",
  table: activities,
  fields: [
    "projectId",
    "releaseId",
    "name",
    "statusId",
    "priorityId",
    "sizeId",
    "riskId",
    "neededBy",
    "estimateHours",
    "featureTeamId",
    "description",
    "note",
  ],
  links: { projectId: "project", releaseId: "release" },
  refers: planningRefers,
  addedColumns: { owner: "activity", table: "activities" },
  changedTogether: ["projectId", "releaseId"],
  unique: [
    {
      field: "name",
      within: "projectId",
      message: "This project already has an activity with that name",
    },
    {
      field: "name",
      within: "releaseId",
      message: "This release already has an activity with that name",
    },
  ],
  readWith: ["features:view"],
  unseenSubject: "an activity",
  subject: (state, id) => {
    // The activity is always shown when its draft or a rule names it.
    const activity = shownVersion(state, "activity", id) as Recorded;
    return projectSubjects.activity(
      String(activity.name),
      // A subject is the same for every reader, so it names no project.
      activityOwnerCalled(state, activity, false),
    );
  },
};
