// SPDX-License-Identifier: Apache-2.0

// Allocations as a kind of the plan's records, checked by the rules records.ts applies to every
// kind.

import { allocations } from "@fathom/db";
import {
  type AllocationMonths,
  type ActivityType,
  activityTypeList,
  capitalized,
  isActivityType,
  type Permission,
} from "@fathom/shared";
import type { Recorded } from "./draft-records.ts";
import { activitiesOf, activityKinds } from "./activity-kinds.ts";
import { projectKind } from "./project-kinds.ts";
import {
  linkedType,
  type RecordKind,
  type RecordsState as State,
  shownIds,
  shownVersion,
  subjectFor,
  type Touched,
  versionOf,
} from "./record-state.ts";
import { featureKind, releaseKind } from "./release-kinds.ts";

export const allocationFields = [
  "personId",
  "plannedHireId",
  "featureId",
  "activityId",
  "months",
] as const;

// What an allocation is to: a feature or an activity, by the field naming it.
type WorkField = "featureId" | "activityId";

// The allocations to a feature or an activity, as their drafts make them, those drafted to be
// removed left out.
export const allocationsTo = (
  state: State,
  id: string,
  field: WorkField = "featureId",
): string[] =>
  shownIds(state, "allocation").filter(
    // The field is one of the two fixed ones.
    // eslint-disable-next-line security/detect-object-injection
    (allocation) => versionOf(state, "allocation", allocation)?.[field] === id,
  );

// The kind of the feature or activity an allocation is to, with its identifier.
function workOf(
  state: State,
  allocation: Recorded,
): { kind: RecordKind; id: string } {
  if (typeof allocation.featureId === "string") {
    return { kind: featureKind, id: allocation.featureId };
  }
  const id = String(allocation.activityId);
  const type = linkedType(state, activityTypeList, id) as ActivityType;
  // The type is always one of the two activity kinds.
  // eslint-disable-next-line security/detect-object-injection
  return { kind: activityKinds[type], id };
}

// An allocation's months, as the percentage that takes effect from each, such as "50% from 2027-01",
// and "0% from 2027-07" where it stops.
const monthsInWords = (months: AllocationMonths): string[] =>
  Object.entries(months)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([month, percentage]) => `${String(percentage ?? 0)}% from ${month}`);

// Named by its feature or activity, as the Drafts page and refusals name records, and, in the
// change history, by who it puts on which, such as "Alex Kim on Offline Sync", seen there only by
// roles that get Allocations.
export const allocationKind: RecordKind = {
  type: "allocation",
  table: allocations,
  fields: allocationFields,
  links: { featureId: "feature", activityId: activityTypeList },
  readWith: ["allocations:view"],
  view: "allocations",
  unseenSubject: "an allocation",
  historyName: {
    fields: ["personId", "plannedHireId", "featureId", "activityId"],
    name: ({ personId, plannedHireId, featureId, activityId }) => {
      const assignee = personId ?? plannedHireId;
      const work = featureId ?? activityId;
      return assignee === undefined || work === undefined
        ? undefined
        : `${assignee} on ${work}`;
    },
  },
  // Only a change shows its fields, and a change to an allocation always holds its months.
  valueInWords: (field, value) =>
    field === "months" ? monthsInWords(value as AllocationMonths) : undefined,
  subject: (state, id) => {
    // A record named is always shown, live or as its draft makes it.
    const work = workOf(
      state,
      shownVersion(state, "allocation", id) as Recorded,
    );
    return `an allocation to ${work.kind.subject(state, work.id)}`;
  },
};

const timeSpent = "Allocations are time spent, so";

// A feature, activity, project or release removed while it, or one of its activities, still has
// allocations. The count is left out, since it can include people the editor does not see. Records
// are named only to a role that reads their kind.
export function allocationProblem(
  state: State,
  touched: readonly Touched[],
  permissions: readonly Permission[],
): string | undefined {
  const named = (kind: RecordKind, id: string) =>
    capitalized(subjectFor(kind, state, id, permissions));
  const allocated = (id: string, field: WorkField) =>
    allocationsTo(state, id, field).length > 0;
  for (const { type, id } of touched) {
    if (versionOf(state, type, id) !== undefined) continue;
    if (type === "feature" && allocated(id, "featureId")) {
      return `${named(featureKind, id)} has allocations, so it can't be removed. ${timeSpent} cancel the feature instead.`;
    }
    if (
      (type === "project" || type === "release") &&
      activitiesOf(state, type, id).some((activity) =>
        allocated(activity, "activityId"),
      )
    ) {
      const kind = type === "project" ? projectKind : releaseKind;
      return `${named(kind, id)} has allocations, so it can't be removed. ${timeSpent} the ${type} stays.`;
    }
    if (isActivityType(type) && allocated(id, "activityId")) {
      // The type is always one of the two activity kinds.
      // eslint-disable-next-line security/detect-object-injection
      return `${named(activityKinds[type], id)} has allocations, so it can't be removed. ${timeSpent} the activity stays.`;
    }
  }
  return undefined;
}
