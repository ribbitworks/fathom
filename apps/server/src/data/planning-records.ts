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

type PlanningTable = Exclude<ColumnTable, "people">;

type PlanningRequest = FeatureRequest | ActivityRequest;

type StatusList = Extract<
  BuiltInList,
  "proposal-statuses" | "feature-statuses"
>;

// How a record with no status starts: in the first status offered, of a meaning when one is named.
const startingStatus: Readonly<
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

// The status a record is given: the one asked for, if it is offered or the record already has it,
// or, for a record added without one, the first status it can start in.
export async function statusFor(
  transaction: Transaction,
  list: StatusList,
  asked: string | undefined,
  had: unknown,
): Promise<string> {
  if (asked !== undefined) {
    await checkBuiltInChoice(transaction, list, asked, had);
    return asked;
  }
  if (typeof had === "string") return had;
  // The list is always one of the two above.
  // eslint-disable-next-line security/detect-object-injection
  const { meaning, missing } = startingStatus[list];
  return firstOfferedOrRefused(transaction, list, meaning, missing);
}

// A record's values in the columns added to its table, live or drafted to be added as the editor sees
// them: those a request names replace those it has, each checked against its column, and every
// required column must then hold one.
async function addedValues(
  transaction: Transaction,
  editor: string,
  table: PlanningTable,
  request: PlanningRequest,
  current: Recorded | undefined,
): Promise<Recorded> {
  const columns = await columnsWithAdded(transaction, editor, true, table);
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
  refuseUnfilled(columns, values);
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

// Refuses a feature or an activity as a draft makes it, against the record before it, as a fresh
// change to it is refused: a feature team that can't be chosen, a choice not offered unless the
// record had it, or a column it must fill left empty.
export async function checkPlanningDraft(
  transaction: Transaction,
  editor: string,
  table: PlanningTable,
  after: Recorded,
  before: Recorded | undefined,
): Promise<void> {
  // The fields are the record's own, named here or by its columns.
  /* eslint-disable security/detect-object-injection */
  const changed = (field: string) => !same(after[field], before?.[field]);
  if (changed("featureTeamId")) {
    await checkTeamForFeature(transaction, text(after.featureTeamId), editor);
  }
  for (const [field, list] of Object.entries(planningChoices)) {
    const chosen = after[field];
    if (typeof chosen === "string" && changed(field)) {
      await checkBuiltInChoice(transaction, list, chosen, before?.[field]);
    }
  }
  const columns = await columnsWithAdded(transaction, editor, true, table);
  const values = valuesOf(after);
  const asked = Object.fromEntries(
    columns
      .filter(({ id, type }) => type === "choice" && changed(valueField(id)))
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

// A choice of a built-in list a record need not have: none, or one offered or the record already has.
async function optionalChoice(
  transaction: Transaction,
  list: BuiltInList,
  asked: string | null,
  had: unknown,
): Promise<string | null> {
  if (asked !== null) await checkBuiltInChoice(transaction, list, asked, had);
  return asked;
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
  await checkTeamForFeature(transaction, request.featureTeamId, editor);
  const added = await addedValues(transaction, editor, table, request, current);
  return {
    ...added,
    name: request.name,
    statusId: await statusFor(
      transaction,
      "feature-statuses",
      request.statusId,
      current?.statusId,
    ),
    priorityId: await optionalChoice(
      transaction,
      "feature-priorities",
      request.priorityId,
      current?.priorityId,
    ),
    sizeId: await optionalChoice(
      transaction,
      "feature-sizes",
      request.sizeId,
      current?.sizeId,
    ),
    riskId: await optionalChoice(
      transaction,
      "feature-risks",
      request.riskId,
      current?.riskId,
    ),
    neededBy: request.neededBy,
    estimateHours: request.estimateHours,
    featureTeamId: request.featureTeamId,
    description: request.description,
    note: keptNote(request.note),
  };
}
