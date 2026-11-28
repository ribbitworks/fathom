// SPDX-License-Identifier: Apache-2.0

// The planning fields features and activities share, and the status every record of the plan with
// one is given, as requests make them. Part of the data access layer.

import type {
  ActivityRequest,
  BuiltInList,
  ColumnTable,
  FeatureRequest,
  Meaning,
} from "@fathom/shared";
import { BadRequestError } from "../errors.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { checkBuiltInChoice, firstOfferedOrRefused } from "./built-in-lists.ts";
import type { Transaction } from "./changes.ts";
import { typeOf } from "./column-types.ts";
import { type Recorded, same, tidy } from "./draft-records.ts";
import { checkTeamForFeature } from "./feature-team-removals.ts";
import {
  checkedLinks,
  checkedNotes,
  checkedNumbers,
  checkedValues,
  choicesAskedFor,
  valuesOf,
} from "./person-fields.ts";
import { keptNote } from "./records.ts";
import { text } from "./reporting.ts";
import { type ColumnInfo, fieldOfValue, valueField } from "./values.ts";

export type PlanningTable = Exclude<ColumnTable, "people">;

type PlanningRequest = FeatureRequest | ActivityRequest;

type StatusList = Extract<
  BuiltInList,
  "proposal-statuses" | "feature-statuses"
>;

// How a record with no status starts: in the first status offered, of a meaning when one is named.
const startingStatuses: Readonly<
  Record<StatusList, { meaning?: Meaning; missing: string }>
> = {
  "proposal-statuses": {
    missing: "No proposal status is offered. Add one to the list first.",
  },
  "feature-statuses": {
    meaning: "possible",
    missing: "No status means Possible. Add one to the list first.",
  },
};

// The status a record keeps, or, for a record added without one, the first status it can start in.
export async function startingStatus(
  transaction: Transaction,
  list: StatusList,
  had: unknown,
): Promise<string> {
  if (typeof had === "string") return had;
  // The list is always one of the two above.
  // eslint-disable-next-line security/detect-object-injection
  const { meaning, missing } = startingStatuses[list];
  return firstOfferedOrRefused(transaction, list, meaning, missing);
}

// A record's values in the columns added to its table, live or drafted to be added as the editor sees
// them: those a request names replace those it has, each checked against its column.
async function addedValues(
  transaction: Transaction,
  editor: string,
  columns: readonly ColumnInfo[],
  request: PlanningRequest,
  current: Recorded | undefined,
): Promise<Recorded> {
  const known = await choicesAskedFor(transaction, editor, [request]);
  const had = current === undefined ? undefined : valuesOf(current);
  const chosen = checkedValues(columns, known, request.values, had);
  const kept = Object.fromEntries(
    Object.entries(current ?? {}).filter(
      ([field]) => fieldOfValue(field) !== null,
    ),
  );
  const values: Recorded = {
    ...kept,
    ...Object.fromEntries(
      [...chosen].map(([fieldId, ids]) => [valueField(fieldId), ids]),
    ),
    ...checkedLinks(columns, request.links),
    ...checkedNotes(columns, request.notes),
    ...checkedNumbers(columns, request.numbers),
  };
  return tidy(values);
}

// Refuses a record with no value in a column that must be filled in.
function refuseUnfilled(columns: readonly ColumnInfo[], record: Recorded) {
  for (const column of columns) {
    if (
      column.required &&
      typeOf(column).count(record[valueField(column.id)]) === 0
    ) {
      throw new BadRequestError(`${column.name} must be filled in`);
    }
  }
}

// The built-in list each planning field chooses from.
const planningChoices = {
  statusId: "feature-statuses",
  priorityId: "feature-priorities",
  sizeId: "feature-sizes",
  riskId: "feature-risks",
} as const satisfies Readonly<Record<string, BuiltInList>>;

// The columns added to a feature's or an activity's table, as the editor sees them.
export const planningColumns = (
  transaction: Transaction,
  editor: string,
  table: PlanningTable,
) => columnsWithAdded(transaction, editor, true, table);

// Refuses a feature or an activity as a change makes it, against the record before it: a feature
// team that can't be chosen, a choice not offered unless the record had it, a value not of its
// column's list, or a column it must fill left empty.
export async function checkPlanningDraft(
  transaction: Transaction,
  editor: string,
  columns: readonly ColumnInfo[],
  after: Recorded,
  before: Recorded | undefined,
): Promise<void> {
  await checkTeamForFeature(transaction, text(after.featureTeamId), editor);
  // The fields are the record's own, named here or by its columns.
  /* eslint-disable security/detect-object-injection */
  for (const [field, list] of Object.entries(planningChoices)) {
    const chosen = after[field];
    if (typeof chosen === "string") {
      await checkBuiltInChoice(transaction, list, chosen, before?.[field]);
    }
  }
  const values = valuesOf(after);
  const asked = Object.fromEntries(
    columns
      .filter(
        ({ id, type }) =>
          type === "choice" &&
          !same(after[valueField(id)], before?.[valueField(id)]),
      )
      .map(({ id }) => [id, values.get(id) ?? []]),
  );
  /* eslint-enable security/detect-object-injection */
  checkedValues(
    columns,
    await choicesAskedFor(transaction, editor, [{ values: asked }]),
    asked,
    before === undefined ? undefined : valuesOf(before),
  );
  refuseUnfilled(columns, after);
}

// A feature's or an activity's planning fields and column values, as a request makes them, from
// the version shown, if any.
export async function planningRecord(
  transaction: Transaction,
  editor: string,
  table: PlanningTable,
  request: PlanningRequest,
  current?: Recorded,
): Promise<Recorded> {
  const columns = await planningColumns(transaction, editor, table);
  const added = await addedValues(
    transaction,
    editor,
    columns,
    request,
    current,
  );
  const record: Recorded = {
    ...added,
    name: request.name,
    statusId:
      request.statusId ??
      (await startingStatus(
        transaction,
        "feature-statuses",
        current?.statusId,
      )),
    priorityId: request.priorityId,
    sizeId: request.sizeId,
    riskId: request.riskId,
    neededBy: request.neededBy,
    estimateHours: request.estimateHours,
    featureTeamId: request.featureTeamId,
    description: request.description,
    note: keptNote(request.note),
  };
  await checkPlanningDraft(transaction, editor, columns, record, current);
  return record;
}
