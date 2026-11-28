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
import { columnsWithAdded } from "./added-columns.ts";
import { checkBuiltInChoice, firstOfferedOrRefused } from "./built-in-lists.ts";
import type { Reader } from "@fathom/db";
import type { Transaction } from "./changes.ts";
import type { Recorded } from "./draft-records.ts";
import { checkTeamsForFeatures } from "./feature-team-removals.ts";
import { askedColumnValues, choicesAskedFor } from "./person-fields.ts";
import { keptNote } from "./records.ts";

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
async function statusFor(
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

// Answers each read once per key, however often it is asked for. A rejected read refuses the whole
// batch, so it is kept as any other.
export function readOnce<Asked extends unknown[], Value>(
  read: (...asked: Asked) => Promise<Value>,
): (...asked: Asked) => Promise<Value> {
  const answers = new Map<string, Promise<Value>>();
  return (...asked) => {
    const key = JSON.stringify(asked);
    const known = answers.get(key);
    if (known !== undefined) return known;
    const answer = read(...asked);
    answers.set(key, answer);
    return answer;
  };
}

// Each built-in choice a batch of records asks for, read once however many of them ask for it.
export const choiceReads = (transaction: Transaction) => ({
  status: readOnce(
    (list: StatusList, asked: string | undefined, had: unknown) =>
      statusFor(transaction, list, asked, had),
  ),
  optional: readOnce((list: BuiltInList, asked: string | null, had: unknown) =>
    optionalChoice(transaction, list, asked, had),
  ),
});

export type ChoiceReads = ReturnType<typeof choiceReads>;

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

// What the features or activities a request makes are checked against, read once for all of them:
// their feature teams, their table's columns, live or drafted to be added as the editor sees them,
// and the choices they name, with the transaction that checks the records they link to.
export async function planningReads(
  transaction: Transaction,
  editor: string,
  table: PlanningTable,
  requests: readonly PlanningRequest[],
) {
  await checkTeamsForFeatures(
    transaction,
    requests.map(({ featureTeamId }) => featureTeamId),
  );
  const reader: Reader = transaction;
  return {
    reader,
    columns: await columnsWithAdded(transaction, editor, true, table),
    known: await choicesAskedFor(transaction, editor, requests),
    choices: choiceReads(transaction),
  };
}

export type PlanningReads = Awaited<ReturnType<typeof planningReads>>;

// A feature's or an activity's planning fields and column values, as a request makes them, from
// the version shown, if any. Those a request names replace those it has, each checked against its
// column, and every required column must then hold one.
export async function planningRecord(
  { reader, columns, known, choices }: PlanningReads,
  request: PlanningRequest,
  current?: Recorded,
): Promise<Recorded> {
  return {
    ...(await askedColumnValues(reader, columns, known, request, current)),
    name: request.name,
    statusId: await choices.status(
      "feature-statuses",
      request.statusId,
      current?.statusId,
    ),
    priorityId: await choices.optional(
      "feature-priorities",
      request.priorityId,
      current?.priorityId,
    ),
    sizeId: await choices.optional(
      "feature-sizes",
      request.sizeId,
      current?.sizeId,
    ),
    riskId: await choices.optional(
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
