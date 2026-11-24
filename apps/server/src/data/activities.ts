// SPDX-License-Identifier: Apache-2.0

// Drafting activities added and changed. Part of the data access layer; the caller checks
// the actor may change activities.

import type { Database } from "@fathom/db";
import { activityOwnerProblem, type ActivityRequest } from "@fathom/shared";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { BadRequestError } from "../errors.ts";
import type { Saved, Transaction } from "./changes.ts";
import type { Recorded } from "./draft-records.ts";
import { planningRecord } from "./planning-records.ts";
import { changingPlan } from "./projects.ts";
import type { PlanRecords } from "./project-reads.ts";
import { changeableRecord, saveRecordDraft } from "./record-drafting.ts";

// An activity as a request makes it, belonging to exactly one release or one project; moving it to
// another clears the one it had.
async function activityRecord(
  transaction: Transaction,
  editor: string,
  request: ActivityRequest,
  current?: Recorded,
): Promise<Recorded> {
  const problem = activityOwnerProblem(request);
  if (problem !== undefined) throw new BadRequestError(problem);
  return {
    ...(await planningRecord(
      transaction,
      editor,
      "activities",
      request,
      current,
    )),
    releaseId: request.releaseId,
    projectId: request.projectId,
  };
}

export async function addActivity(
  database: Database,
  maker: Actor,
  request: ActivityRequest,
): Promise<Saved<PlanRecords>> {
  return changingPlan(database, maker, async (transaction, state) =>
    saveRecordDraft(
      transaction,
      maker,
      state,
      "activity",
      randomUUID(),
      await activityRecord(transaction, maker.user.id, request),
    ),
  );
}

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
      await activityRecord(transaction, maker.user.id, request, activity),
    );
  });
}
