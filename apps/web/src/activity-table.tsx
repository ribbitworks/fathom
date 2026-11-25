// SPDX-License-Identifier: Apache-2.0

// Activities' table: its columns, in the order its details show them, and the groups its rows can
// be put in.

import {
  type Activity,
  activityOwnerProblem,
  ownersAfter,
  planColumnNames,
} from "@fathom/shared";
import { type AddedColumns } from "./added-columns.ts";
import type { CellValue } from "./table-view.ts";
import { byChoice, holdsChoices } from "./choice-grouping.ts";
import {
  field,
  identified,
  namesCell,
  newKind,
  type PlanChange,
  planTable,
  wordsOf,
  savedKind,
} from "./plan-table.tsx";
import {
  byNeededBy,
  inGroupsThenAdded,
  plannedRequest,
  planningColumns,
  staffedColumnKey,
} from "./planning-columns.tsx";
import type { TableChoices } from "./projects.ts";
import type { ActivityFields } from "./plan-record-operations.ts";
import type {
  Column,
  ColumnGroup,
  RecordTable,
  RowProblem,
} from "./record-table.ts";

// An activity's built-in columns in the headed groups its details show them in, in order: the
// order the table starts its columns in too.
export const activityColumnGroups: readonly ColumnGroup[] = [
  {
    title: "Details",
    keys: ["name", "statusId", "description", "note", "releaseId", "projectId"],
  },
  {
    title: "Planning",
    keys: [
      "priorityId",
      "neededBy",
      "estimateHours",
      "sizeId",
      "riskId",
      "featureTeamId",
      staffedColumnKey,
    ],
  },
];

// What the Release or Project an activity doesn't belong to reads, alike in its cells, details and
// drafts.
const noOwner = "None";

export function activityColumns(
  choices: TableChoices,
  {
    shown: { fields, lists, order } = choices.activityColumns,
    editsFeatureTeams = false,
  }: {
    shown?: AddedColumns;
    // An activity's feature team is set only by those who edit feature teams, as a feature's is.
    editsFeatureTeams?: boolean;
  } = {},
): Column<Activity, PlanChange>[] {
  const builtIn: Column<Activity, PlanChange>[] = [
    ...planningColumns<Activity>(choices, { editsFeatureTeams }),
    field<Activity>("releaseId", planColumnNames.releaseId, "choice", {
      choices: choices.releases,
      emptyLabel: noOwner,
    }),
    {
      ...field<Activity>("projectId", planColumnNames.projectId, "choice", {
        choices: identified(choices.projects),
        emptyLabel: noOwner,
      }),
      content: ({ projectId }) =>
        projectId === null ? null : namesCell(choices.projects)([projectId]),
    },
  ];
  return inGroupsThenAdded(builtIn, activityColumnGroups, {
    fields,
    lists,
    order,
  });
}

const ownerIn = (
  values: Record<string, CellValue>,
  key: "releaseId" | "projectId",
) => {
  // The key is always one of the two fields naming an owner.
  // eslint-disable-next-line security/detect-object-injection
  const [owner = null] = (values[key] as string[] | undefined) ?? [];
  return owner;
};

// Why an activity's values can't be saved: it belongs to neither a release nor a project, or, in a
// new one, to both. Checked when one of those two changes, by the rule that moves it, or when the
// whole record is added.
export function activityProblem(
  values: Record<string, CellValue>,
  changed?: string,
): RowProblem | undefined {
  const owners = {
    releaseId: ownerIn(values, "releaseId"),
    projectId: ownerIn(values, "projectId"),
  };
  if (changed === undefined) {
    const message = activityOwnerProblem(owners);
    return message === undefined ? undefined : { message, column: "releaseId" };
  }
  if (changed !== "releaseId" && changed !== "projectId") return undefined;
  const message = activityOwnerProblem(
    // The key is always one of the two fields naming an owner.
    // eslint-disable-next-line security/detect-object-injection
    ownersAfter(owners, { [changed]: owners[changed] }),
  );
  return message === undefined ? undefined : { message, column: changed };
}

// The grouped columns whose choices are listed by name, as the server sends them.
const groupedByName = new Set(["featureTeamId", "releaseId", "projectId"]);

export function activityTable(
  choices: TableChoices,
  {
    onOpen,
    editsFeatureTeams = false,
  }: {
    onOpen?: (activity: Activity) => void;
    editsFeatureTeams?: boolean;
  } = {},
): RecordTable<Activity, PlanChange, ActivityFields> {
  const byListed = activityColumns(choices)
    .filter(holdsChoices)
    .map((column) =>
      byChoice(column, groupedByName.has(column.key) ? { holds: "names" } : {}),
    );
  return {
    ...planTable<Activity, ActivityFields>({
      type: "activity",
      ...wordsOf("activities"),
      kinds: [newKind, savedKind],
      columns: (shown) =>
        activityColumns(choices, { shown, editsFeatureTeams }),
      groupings: [byNeededBy, ...byListed],
      request: (changes) => plannedRequest(changes) as ActivityFields,
      showDetails: onOpen,
    }),
    recordProblem: (values, _others, changed) =>
      activityProblem(values, changed),
  };
}
