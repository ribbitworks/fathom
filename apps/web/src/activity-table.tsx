// SPDX-License-Identifier: Apache-2.0

// Activities' table: its columns, in the order its details show them, and the groups its rows can
// be put in.

import {
  type Activity,
  activityOwnerProblem,
  planColumnNames,
} from "@fathom/shared";
import {
  addedColumn,
  type AddedColumns,
  cellRequest,
} from "./added-columns.ts";
import type { CellChange } from "./cell-kinds.tsx";
import type { CellValue } from "./table-view.ts";
import { byChoice, holdsChoices } from "./choice-grouping.ts";
import { inOrder } from "./grid-columns.tsx";
import {
  field,
  identified,
  merged,
  namesCell,
  newKind,
  type PlanChange,
  planTable,
  savedKind,
} from "./plan-table.tsx";
import {
  byNeededBy,
  planningColumns,
  staffedColumnKey,
} from "./planning-columns.tsx";
import type { ActivityFields, TableChoices } from "./projects.ts";
import type { Column, RecordTable, RowProblem } from "./record-table.ts";

// An activity's built-in columns in the headed groups its details show them in, in order: the
// order the table starts its columns in too.
export const activityColumnGroups: readonly {
  title: string;
  keys: readonly string[];
}[] = [
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

const activityColumnOrder = activityColumnGroups.flatMap(({ keys }) => keys);

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
    }),
    {
      ...field<Activity>("projectId", planColumnNames.projectId, "choice", {
        choices: identified(choices.projects),
      }),
      content: ({ projectId }) =>
        projectId === null ? null : namesCell(choices.projects)([projectId]),
    },
  ];
  const inGroups = [...builtIn].sort(
    (a, b) =>
      activityColumnOrder.indexOf(a.key) - activityColumnOrder.indexOf(b.key),
  );
  return [
    ...inGroups,
    ...inOrder(
      fields.map((added) => addedColumn<Activity, CellChange>(added, lists)),
      order,
    ),
  ];
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
// new one, to both. Checked when one of those two changes, or the whole record is added; choosing
// one in a saved activity's cell moves it there, clearing the other.
export function activityProblem(
  values: Record<string, CellValue>,
  changed?: string,
): RowProblem | undefined {
  if (
    changed !== undefined &&
    changed !== "releaseId" &&
    changed !== "projectId"
  ) {
    return undefined;
  }
  const releaseId =
    changed === "projectId" ? null : ownerIn(values, "releaseId");
  const projectId =
    changed === "releaseId" ? null : ownerIn(values, "projectId");
  const message = activityOwnerProblem({ releaseId, projectId });
  return message === undefined
    ? undefined
    : { message, column: changed ?? "releaseId" };
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
      label: "Activities",
      one: "activity",
      noun: "activities",
      kinds: [newKind, savedKind],
      columns: (shown) =>
        activityColumns(choices, { shown, editsFeatureTeams }),
      groupings: [byNeededBy, ...byListed],
      request: (changes) => {
        const request: PlanChange = {
          ...merged(changes),
          ...cellRequest(changes),
        };
        return request as ActivityFields;
      },
      showDetails: onOpen,
    }),
    recordProblem: (values, _others, changed) =>
      activityProblem(values, changed),
  };
}
