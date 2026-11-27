// SPDX-License-Identifier: Apache-2.0

// Drafting activities added and changed. Part of the data access layer; the caller checks
// the actor may change activities.

import type { Database } from "@fathom/db";
import { activityOwnerProblem, type ActivityRequest } from "@fathom/shared";
import type { Actor } from "../access.ts";
import { BadRequestError } from "../errors.ts";
import type { Saved, Transaction } from "./changes.ts";
import type { Recorded } from "./draft-records.ts";
import {
  planningReads,
  type PlanningReads,
  planningRecord,
} from "./planning-records.ts";
import { addingPlan, changingPlan } from "./projects.ts";
import type { PlanRecords } from "./project-reads.ts";
import { changeableRecord, saveRecordDraft } from "./record-drafting.ts";

// An activity as a request makes it, belonging to the release or project its reads were checked to
// name; moving it to another clears the one it had.
async function activityRecord(
  reads: PlanningReads,
  request: ActivityRequest,
  current?: Recorded,
): Promise<Recorded> {
  return {
    ...(await planningRecord(reads, request, current)),
    releaseId: request.releaseId,
    projectId: request.projectId,
  };
}

// What activities are checked against, once each belongs to exactly one release or one project.
async function activityReads(
  transaction: Transaction,
  maker: Actor,
  requests: readonly ActivityRequest[],
): Promise<PlanningReads> {
  for (const request of requests) {
    const problem = activityOwnerProblem(request);
    if (problem !== undefined) throw new BadRequestError(problem);
  }
  return planningReads(transaction, maker.user.id, "activities", requests);
}

// Adds activities, all in one change set or none.
export const addActivities = (
  database: Database,
  maker: Actor,
  requests: readonly ActivityRequest[],
) =>
  addingPlan(
    database,
    maker,
    "activity",
    requests,
    async (transaction, adder, asked) => {
      const reads = await activityReads(transaction, adder, asked);
      return (request) => activityRecord(reads, request);
    },
  );

export async function changeActivity(
  database: Database,
  maker: Actor,
  id: string,
  request: ActivityRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) => {
    const activity = changeableRecord(state, "activity", id);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "activity",
      id,
      await activityRecord(
        await activityReads(transaction, maker, [request]),
        request,
        activity,
      ),
    );
  });
}
