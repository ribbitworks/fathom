// SPDX-License-Identifier: Apache-2.0

// Drafting and reading activities: adding, changing and removing them as drafts, each answering with
// every activity as the editor now sees them. Part of the data access layer; the caller checks the
// actor may change activities.

import { allocations, type Database } from "@fathom/db";
import {
  type Activity,
  activityOwnerProblem,
  type ActivityPlan,
  type ActivityRequest,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { BadRequestError, ConflictError } from "../errors.ts";
import { activityKind } from "./activity-kinds.ts";
import { allocatedRefusal } from "./allocation-kinds.ts";
import { staffedFeatures } from "./allocations.ts";
import type { Saved, Transaction } from "./changes.ts";
import type { Recorded } from "./draft-records.ts";
import { planningRecord } from "./planning-records.ts";
import { inOrder, planningColumnsOut, planningOut } from "./project-reads.ts";
import { removing } from "./projects.ts";
import {
  changeableRecord,
  drafting,
  saveRecordDraft,
} from "./record-drafting.ts";
import { type RecordsState, shownVersion, subjectFor } from "./record-state.ts";
import { readRecordMakers, readRecordsState } from "./records.ts";
import { text } from "./reporting.ts";

export type ActivityRecords = Omit<ActivityPlan, "canEdit">;

async function activitiesOut(
  transaction: Transaction,
  viewer: Actor,
  state: RecordsState,
): Promise<ActivityRecords> {
  const makers = await readRecordMakers(transaction, state, viewer);
  const staffed = staffedFeatures(state);
  return {
    activities: inOrder(state, "activity").map((id): Activity => {
      const activity = shownVersion(state, "activity", id) as Recorded;
      return {
        ...planningOut(state, makers, staffed, "activity", id),
        releaseId: text(activity.releaseId),
        projectId: text(activity.projectId),
      };
    }),
    columns: await planningColumnsOut(transaction, viewer, "activities"),
  };
}

// Every activity as the viewer sees them, read as of one moment, so an approval saved meanwhile is
// seen whole or not at all.
export async function readActivities(
  database: Database,
  viewer: Actor,
): Promise<ActivityRecords> {
  return database.transaction(
    async (transaction) =>
      activitiesOut(
        transaction,
        viewer,
        await readRecordsState(transaction, viewer.user.id),
      ),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

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

// Runs a change to an activity, and answers with every activity as the editor now sees them.
async function changingActivities(
  database: Database,
  editor: Actor,
  change: (
    transaction: Transaction,
    state: RecordsState,
  ) => Promise<string | null>,
): Promise<Saved<ActivityRecords>> {
  return drafting(database, editor.user.id, async (transaction, state) => {
    const changeSetId = await change(transaction, state);
    const now = await readRecordsState(transaction, editor.user.id);
    return {
      result: await activitiesOut(transaction, editor, now),
      changeSetId,
    };
  });
}

export async function addActivity(
  database: Database,
  maker: Actor,
  request: ActivityRequest,
): Promise<Saved<ActivityRecords>> {
  return changingActivities(database, maker, async (transaction, state) =>
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
): Promise<Saved<ActivityRecords>> {
  return changingActivities(database, maker, async (transaction, state) => {
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

// Allocations to activities aren't yet among the plan's records, whose rules refuse removing a
// feature with allocations, so an activity's are read here and refused in the same words.
export async function removeActivity(
  database: Database,
  maker: Actor,
  id: string,
): Promise<string | null> {
  const [allocated] = await database
    .select({ id: allocations.id })
    .from(allocations)
    .where(eq(allocations.activityId, id))
    .limit(1);
  return removing(database, maker, "activity", id, (state) => {
    changeableRecord(state, "activity", id);
    if (allocated !== undefined) {
      throw new ConflictError(
        allocatedRefusal(
          subjectFor(activityKind, state, id, maker.permissions),
          "activity",
        ),
      );
    }
  });
}
