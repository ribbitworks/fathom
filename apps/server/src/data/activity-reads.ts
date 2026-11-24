// SPDX-License-Identifier: Apache-2.0

// Reading activities as the viewer sees them. Part of the data access layer; the caller checks the
// actor's permissions.

import {
  type Activity,
  type ActivityOwner,
  activityTypes,
} from "@fathom/shared";
import type { Recorded } from "./draft-records.ts";
import { inOrder, type RecordsState, shownVersion } from "./record-state.ts";
import { type Makers, recordExtras, recordKeyNumber } from "./records.ts";
import { text } from "./reporting.ts";

// The activities of one kind of owner, the live ones by name, then those drafted to be added.
export function activitiesOut(
  state: RecordsState,
  makers: Makers,
  owner: ActivityOwner,
): Activity[] {
  // The owner is always one of the two fixed ones.
  // eslint-disable-next-line security/detect-object-injection
  const type = activityTypes[owner];
  return inOrder(state, type).map((id) => {
    const activity = shownVersion(state, type, id) as Recorded;
    return {
      id,
      keyNumber: recordKeyNumber(state, type, id),
      projectId: text(activity.projectId),
      releaseId: text(activity.releaseId),
      name: String(activity.name),
      description: text(activity.description),
      note: text(activity.note),
      estimateHours:
        typeof activity.estimateHours === "number"
          ? activity.estimateHours
          : null,
      ...recordExtras(state, makers, type, id),
    };
  });
}
