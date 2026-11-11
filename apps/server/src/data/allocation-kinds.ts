// SPDX-License-Identifier: Apache-2.0

// Allocations as a kind of the plan's records: one person or planned hire on one feature, with the
// percentage that takes effect from each month it changes, as the Decisions Log sets out. Its draft
// holds every month it changes, so it is approved or rejected whole. Allocations are time spent, so
// a feature, or a project whose general feature, has any cannot be removed, and is cancelled
// instead. Part of the data access layer; records.ts applies the rules every kind shares.

import { allocations } from "@fathom/db";
import { type AllocationMonths, capitalized } from "@fathom/shared";
import type { Recorded } from "./drafts.ts";
import {
  type RecordKind,
  type RecordsState as State,
  shownIds,
  shownVersion,
  type Touched,
  versionOf,
} from "./record-state.ts";
import { featureKind, projectSubject } from "./release-kinds.ts";

export const allocationFields = [
  "personId",
  "plannedHireId",
  "featureId",
  "months",
] as const;

// The allocations to a feature, as their drafts make them, those drafted to be removed left out.
export const allocationsTo = (state: State, featureId: string): string[] =>
  shownIds(state, "allocation").filter(
    (id) => versionOf(state, "allocation", id)?.featureId === featureId,
  );

// A project's general features: the one it has once approved, which only ever exists live.
const generalFeaturesOf = (state: State, projectId: string): string[] =>
  [...state.feature.rows]
    .filter(([, row]) => row.generalForProjectId === projectId)
    .map(([id]) => id);

// An allocation's months, as the percentage that takes effect from each, such as "50% from 2027-01",
// and "0% from 2027-07" where it stops.
const monthsInWords = (months: AllocationMonths): string[] =>
  Object.entries(months)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([month, percentage]) => `${String(percentage ?? 0)}% from ${month}`);

// Named by its feature, as the Drafts page and refusals name records, a general feature by its
// project, and, in the change history, by who it puts on which feature, such as "Alex Kim on
// Offline Sync", seen there only by roles that get Allocations.
export const allocationKind: RecordKind = {
  type: "allocation",
  table: allocations,
  fields: allocationFields,
  links: { featureId: "feature" },
  readWith: ["allocations:view"],
  view: "allocations",
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
  subject: (state, id) =>
    `an allocation to ${featureKind.subject(
      state,
      // A record named is always shown, live or as its draft makes it.
      String((shownVersion(state, "allocation", id) as Recorded).featureId),
    )}`,
};

// A project's general feature, as the project it is for, when that project is drafted to be removed.
function removedProjectOf(state: State, featureId: string): string | undefined {
  const projectId = state.feature.rows.get(featureId)?.generalForProjectId;
  return typeof projectId === "string" &&
    versionOf(state, "project", projectId) === undefined
    ? projectId
    : undefined;
}

// A feature or project removed while it, or its general feature, still has allocations, or an
// allocation to the general feature of a project drafted to be removed, which, having no draft of
// its own, is not caught as a link to a removed record. The count is left out, since it can include
// people the editor does not see.
export function allocationProblem(
  state: State,
  touched: readonly Touched[],
): string | undefined {
  for (const { type, id } of touched) {
    if (type === "allocation") {
      const featureId = versionOf(state, type, id)?.featureId;
      const projectId =
        typeof featureId === "string"
          ? removedProjectOf(state, featureId)
          : undefined;
      if (projectId === undefined) continue;
      return `This links to ${projectSubject(state, projectId)}, which is drafted to be removed; discard that draft first`;
    }
    if (type !== "feature" && type !== "project") continue;
    if (versionOf(state, type, id) !== undefined) continue;
    const allocated = (
      type === "project" ? generalFeaturesOf(state, id) : [id]
    ).some((featureId) => allocationsTo(state, featureId).length > 0);
    if (!allocated) continue;
    return type === "project"
      ? `${capitalized(projectSubject(state, id))} has allocations, so it can't be removed. Allocations are time spent, so the project stays.`
      : `${capitalized(featureKind.subject(state, id))} has allocations, so it can't be removed. Allocations are time spent, so cancel the feature instead.`;
  }
  return undefined;
}
