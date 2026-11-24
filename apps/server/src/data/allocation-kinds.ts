// SPDX-License-Identifier: Apache-2.0

// Allocations as a kind of the plan's records, checked by the rules records.ts applies to every
// kind.

import { allocations } from "@fathom/db";
import { isNotNull } from "drizzle-orm";
import {
  type AllocationMonths,
  capitalized,
  type ClassAccess,
} from "@fathom/shared";
import type { Recorded } from "./draft-records.ts";
import {
  type RecordKind,
  type RecordsState as State,
  shownIds,
  shownVersion,
  subjectFor,
  type Touched,
  versionOf,
} from "./record-state.ts";
import { featureKind } from "./release-kinds.ts";

export const allocationFields = [
  "personId",
  "plannedHireId",
  "featureId",
  "months",
] as const;

// Every field an allocation's row holds, which removing it records, its activity included, though
// allocations to activities aren't yet drafted.
export const allocationRowFields = [...allocationFields, "activityId"] as const;

// The allocations to a feature, as their drafts make them, those drafted to be removed left out.
export const allocationsTo = (state: State, featureId: string): string[] =>
  shownIds(state, "allocation").filter(
    (id) => versionOf(state, "allocation", id)?.featureId === featureId,
  );

// An allocation's months, as the percentage that takes effect from each, such as "50% from 2027-01",
// and "0% from 2027-07" where it stops.
const monthsInWords = (months: AllocationMonths): string[] =>
  Object.entries(months)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([month, percentage]) => `${String(percentage ?? 0)}% from ${month}`);

// Named by its feature, as the Drafts page and refusals name records, and, in the change history,
// by who it puts on which feature, such as "Alex Kim on Offline Sync", seen there only by roles that
// get Allocations.
export const allocationKind: RecordKind = {
  type: "allocation",
  table: allocations,
  // Activities aren't yet kinds of their own, so their allocations stay out of the plan's rules.
  rowsWhere: isNotNull(allocations.featureId),
  fields: allocationFields,
  links: { featureId: "feature" },
  readWith: ["allocations:view"],
  view: "allocations",
  unseenSubject: "an allocation",
  historyName: {
    fields: ["personId", "plannedHireId", "featureId"],
    name: ({ personId, plannedHireId, featureId }) => {
      const assignee = personId ?? plannedHireId;
      return assignee === undefined || featureId === undefined
        ? undefined
        : `${assignee} on ${featureId}`;
    },
  },
  // Only a change shows its fields, and a change to an allocation always holds its months.
  valueInWords: (field, value) =>
    field === "months" ? monthsInWords(value as AllocationMonths) : undefined,
  subject: (state, id, access) =>
    `an allocation to ${subjectFor(
      featureKind,
      state,
      // A record named is always shown, live or as its draft makes it.
      String((shownVersion(state, "allocation", id) as Recorded).featureId),
      access,
    )}`,
};

// A feature removed while it still has allocations. The count is left out, since it can include
// people the editor does not see. The feature is named only to a role that reads features.
export function allocationProblem(
  state: State,
  touched: readonly Touched[],
  access: ClassAccess,
): string | undefined {
  const removed = touched.find(
    ({ type, id }) =>
      type === "feature" &&
      versionOf(state, type, id) === undefined &&
      allocationsTo(state, id).length > 0,
  );
  return removed === undefined
    ? undefined
    : `${capitalized(subjectFor(featureKind, state, removed.id, access))} has allocations, so it can't be removed. Allocations are time spent, so cancel the feature instead.`;
}
