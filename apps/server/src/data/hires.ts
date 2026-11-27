// SPDX-License-Identifier: Apache-2.0

// Drafting changes to the hiring plan: adding, changing, filling and removing planned hires, and
// resubmitting or discarding their drafts. Part of the data access layer.

import {
  type Database,
  listItems,
  plannedHireTemporaryNumbers,
} from "@fathom/db";
import { type HireChange, type HireRequest } from "@fathom/shared";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  requireSensitivityEdit,
  seesSensitivity,
} from "../access.ts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.ts";
import {
  onTeamsRefusals,
  refuseRemovingOnTeams,
} from "./feature-team-removals.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { checkBuiltInChoice, firstChoiceMeaning } from "./built-in-lists.ts";
import { valueField, recordedValues } from "./values.ts";
import { type Change, recordChanges, type Transaction } from "./changes.ts";
import {
  addDrafts,
  lockDrafts,
  readHeld,
  refuseHeld,
  reopened,
  writeDraft,
} from "./drafts.ts";
import {
  actionTo,
  asDraft,
  clearedRejection,
  type Draft,
  drafted,
  draftFields,
  type Recorded,
  requireRejected,
  tidy,
} from "./draft-records.ts";
import {
  checkedColumnValues,
  checkedValues,
  choicesAskedFor,
  valuesOf,
} from "./person-fields.ts";
import { reassignReports, text } from "./reporting.ts";
import {
  hireChanges,
  hireSensitivities,
  readHireTier,
  recordHiringChanges,
  recordType,
  rejectionTier,
  requireHireEdits,
} from "./hire-fields.ts";
import { readHireDrafts, readLiveHires } from "./hire-reads.ts";
import { refuseDiscardingOthers } from "./record-discards.ts";
import {
  checkManager,
  checkRequisition,
  hiresReportTo,
  movedByFill,
  newlyManaged,
  partOfFill,
  refuseChangingFill,
  refuseHired,
  refuseHireLoop,
  refuseUnmarked,
  requireHiringEdit,
  unfilled,
} from "./hire-checks.ts";

// A new temporary number, never used before.
async function nextTemporaryNumber(transaction: Transaction): Promise<number> {
  const { rows } = await transaction.execute<{ number: string }>(
    sql`SELECT nextval(${`"fathom"."${String(plannedHireTemporaryNumbers.seqName)}"`}::regclass) AS number`,
  );
  return Number(rows[0]?.number);
}

// The hire's ID as a change makes it: a requisition given replaces the temporary number, and one
// cleared gives the hire a new temporary number.
async function idAsChanged(
  transaction: Transaction,
  hire: Recorded,
  requisition: string | null | undefined,
): Promise<Pick<Recorded, "requisition" | "temporaryNumber">> {
  const current = text(hire.requisition);
  if (requisition === undefined || requisition === current) {
    return {
      requisition: current,
      temporaryNumber:
        typeof hire.temporaryNumber === "number" ? hire.temporaryNumber : null,
    };
  }
  if (requisition !== null) return { requisition, temporaryNumber: null };
  return {
    requisition: null,
    temporaryNumber: await nextTemporaryNumber(transaction),
  };
}

const noHire = "There is no such planned hire";
const toBeRemoved =
  "This planned hire's draft removes it; discard the draft to change it";

// Drafts adding the hires asked for, together in one change, so they are undone together, or none
// of them when any is refused.
export async function createHires(
  database: Database,
  actor: Actor,
  requests: readonly HireRequest[],
): Promise<{ ids: string[]; changeSetId: string | null }> {
  requireHiringEdit(actor);
  return database.transaction(async (transaction) => {
    // Every hire needs a position and a state, so one who cannot see either cannot add hires.
    const columns = await columnsWithAdded(transaction, actor.user.id, true);
    const tierOf = await readHireTier(transaction, columns);
    if (!seesSensitivity(actor, tierOf("positionId"))) {
      throw new ForbiddenError(
        "Every planned hire needs a position, and this role can't see positions",
      );
    }
    if (!seesSensitivity(actor, tierOf("stateId"))) {
      throw new ForbiddenError(
        "Every planned hire needs a state, and this role can't see hiring states",
      );
    }
    await lockDrafts(transaction);
    const known = await choicesAskedFor(transaction, actor.user.id, requests);
    const ids: string[] = [];
    const made: Change[] = [];
    for (const request of requests) {
      await checkManager(transaction, request.managerId, actor.user.id);
      await checkBuiltInChoice(transaction, "positions", request.positionId);
      const seesPositions = seesSensitivity(actor, tierOf("positionId"));
      const stateId =
        request.stateId ??
        (await firstChoiceMeaning(transaction, "hiring-states", "proposed"));
      refuseHired(
        await checkBuiltInChoice(transaction, "hiring-states", stateId),
      );
      const id = randomUUID();
      // Each hire is drafted before the next is checked, so two asked for cannot share an ID.
      await checkRequisition(transaction, request.requisition, id);
      // Notes left empty are left out.
      const after: Recorded = tidy({
        name: request.name,
        requisition: request.requisition,
        temporaryNumber:
          request.requisition === null
            ? await nextTemporaryNumber(transaction)
            : null,
        positionId: request.positionId,
        targetDate: request.targetDate,
        stateId,
        managerId: request.managerId,
        // Left out unless marked, as a new person's mark is.
        ...(request.isManager ? { isManager: true } : {}),
        filledBy: null,
        ...recordedValues(
          checkedValues(columns, known, request.values, undefined),
        ),
        ...checkedColumnValues(columns, request),
      });
      if (newlyManaged(undefined, after)) {
        await refuseUnmarked(
          transaction,
          String(after.managerId),
          (message) => new BadRequestError(message),
          { seesPositions },
        );
      }
      await addDrafts(transaction, actor.user.id, recordType, [
        { id, fields: after },
      ]);
      ids.push(id);
      made.push(
        ...asDraft(hireChanges(id, "created", undefined, after, tierOf)),
      );
    }
    requireHireEdits(actor, made);
    await recordHiringChanges(transaction, actor.user.id, made);
    return {
      ids,
      changeSetId: await recordChanges(transaction, actor, made),
    };
  });
}

// A hire as it is and as the actor's draft makes it, locked for a change, refusing one that is
// neither live nor in a draft the actor sees, or that someone else is changing.
async function lockDraftedHire(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<{
  before: Recorded | undefined;
  draft: Draft | undefined;
  hire: Recorded | undefined;
}> {
  const before = (await readLiveHires(transaction, [id], true)).get(id);
  const draft = (await readHireDrafts(transaction, [id], actor.user.id)).get(
    id,
  );
  if (before === undefined && draft === undefined) {
    throw new NotFoundError(noHire);
  }
  await refuseHeld(transaction, actor.user.id, recordType, [id]);
  return { before, draft, hire: drafted(before, draft) };
}

// Drafts a change to some of a hire's details, or a move to another state, in any order.
export async function updateHire(
  database: Database,
  actor: Actor,
  id: string,
  change: HireChange,
): Promise<string | null> {
  requireHiringEdit(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { before, draft, hire } = await lockDraftedHire(
      transaction,
      actor,
      id,
    );
    if (hire === undefined) throw new ConflictError(toBeRemoved);
    await refuseChangingFill(transaction, actor, before, hire, change);
    const columns = await columnsWithAdded(transaction, actor.user.id, true);
    const changedValues = checkedValues(
      columns,
      await choicesAskedFor(transaction, actor.user.id, [change]),
      change.values ?? {},
      valuesOf(hire),
    );
    if (change.managerId !== undefined) {
      await checkManager(transaction, change.managerId, actor.user.id);
    }
    if (change.positionId !== undefined) {
      await checkBuiltInChoice(
        transaction,
        "positions",
        change.positionId,
        hire.positionId,
      );
    }
    if (change.stateId !== undefined) {
      refuseHired(
        await checkBuiltInChoice(
          transaction,
          "hiring-states",
          change.stateId,
          hire.stateId,
        ),
      );
    }
    if (typeof change.requisition === "string") {
      await checkRequisition(transaction, change.requisition, id);
    }
    const unmarked = Object.fromEntries(
      Object.entries(hire).filter(([field]) => field !== "isManager"),
    );
    const marked = change.isManager ?? hire.isManager === true;
    // Columns left with nothing chosen are left out.
    const after: Recorded = tidy({
      ...unmarked,
      ...(marked ? { isManager: true } : {}),
      ...(change.name === undefined ? {} : { name: change.name }),
      ...(await idAsChanged(transaction, hire, change.requisition)),
      ...(change.positionId === undefined
        ? {}
        : { positionId: change.positionId }),
      ...(change.targetDate === undefined
        ? {}
        : { targetDate: change.targetDate }),
      ...(change.stateId === undefined ? {} : { stateId: change.stateId }),
      ...(change.managerId === undefined
        ? {}
        : { managerId: change.managerId }),
      ...Object.fromEntries(
        [...changedValues].map(([fieldId, choiceIds]) => [
          valueField(fieldId),
          choiceIds,
        ]),
      ),
      ...checkedColumnValues(columns, change),
    });
    const tierOf = await readHireTier(transaction, columns);
    if (newlyManaged(hire, after)) {
      await refuseUnmarked(
        transaction,
        String(after.managerId),
        (message) => new BadRequestError(message),
        { seesPositions: seesSensitivity(actor, tierOf("positionId")) },
      );
    }
    if (change.managerId !== undefined) {
      await refuseHireLoop(transaction, actor.user.id, id, after.managerId);
    }
    if (
      hire.isManager === true &&
      after.isManager !== true &&
      (await hiresReportTo(transaction, [id], { drafted: true }))
    ) {
      throw new ConflictError(reassignReports);
    }
    const made = hireChanges(id, "changed", hire, after, tierOf);
    requireHireEdits(actor, made);
    if (made.length === 0) return null;
    const all = [
      ...asDraft(made),
      ...clearedRejection(id, rejectionTier(tierOf), before, draft, recordType),
    ];
    await writeDraft(transaction, actor.user.id, recordType, id, before, after);
    await recordHiringChanges(transaction, actor.user.id, all);
    return recordChanges(transaction, actor, all);
  });
}

const filledAlready = "This planned hire is already filled";
const notApproved =
  "This planned hire's headcount isn't approved yet; move it to an approved state before filling it";

// The hire asked to be filled, as the actor's draft makes it, with it as it is live: one not drafted
// to be removed or already filled, with no rejected draft, whose changes a fill would otherwise send
// for approval again, and in a state meaning Open.
export async function fillableHire(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<{ before: Recorded | undefined; hire: Recorded }> {
  requireHiringEdit(actor);
  const { before, draft, hire } = await lockDraftedHire(transaction, actor, id);
  if (hire === undefined) {
    throw new ConflictError(
      "This planned hire's draft removes it; discard the draft to fill it",
    );
  }
  if (before === undefined) {
    throw new ConflictError(
      "This planned hire is only drafted to be added; approve it before filling it",
    );
  }
  if (!unfilled(hire)) throw new ConflictError(filledAlready);
  if (draft?.state === "rejected") {
    throw new ConflictError(
      "This planned hire has a rejected draft; discard it or send it for approval again before filling it",
    );
  }
  if (hire.managerId !== before.managerId) {
    throw new ConflictError(
      "This planned hire's draft changes its manager; approve or discard that draft before filling it",
    );
  }
  const [state] = await transaction
    .select({ meaning: listItems.meaning })
    .from(listItems)
    .where(eq(listItems.id, String(hire.stateId)));
  if (state?.meaning !== "open") throw new ConflictError(notApproved);
  return { before, hire };
}

// Drafts the hire filled by the person given, keeping the rest of its draft, and returns the changes
// made, for the caller to record. A manager given for the person is drafted on the hire too, so the
// fill's draft of the person is known by matching the hire's manager.
export async function draftHireFilled(
  transaction: Transaction,
  actor: Actor,
  filled: {
    id: string;
    before: Recorded | undefined;
    hire: Recorded;
    managerId: string | null | undefined;
  },
  personId: string,
): Promise<Change[]> {
  const { id, before, hire, managerId } = filled;
  const after: Recorded = {
    ...hire,
    filledBy: personId,
    ...(managerId === undefined ? {} : { managerId }),
  };
  const tierOf = await readHireTier(transaction);
  const made = asDraft(hireChanges(id, "changed", hire, after, tierOf));
  requireHireEdits(actor, made);
  await writeDraft(transaction, actor.user.id, recordType, id, before, after);
  return made;
}

// Drafts the hires not yet filled that report to a planned manager moving to the person who fills
// it, and returns the changes made, for the caller to record. None of them may have a draft.
export async function draftReportsMoved(
  transaction: Transaction,
  actor: Actor,
  managerId: string,
  personId: string,
): Promise<Change[]> {
  const live = await readLiveHires(transaction);
  const draftsNow = await readHireDrafts(transaction, undefined, actor.user.id);
  const held = await readHeld(transaction, recordType, actor.user.id);
  // A hire reporting to the planned manager, live or in anyone's draft, that has a draft of its own
  // is refused, so every draft the fill writes holds only the fill.
  const drafting = [
    ...draftsNow,
    ...[...held].map(([id, { draft }]) => [id, draft] as const),
  ];
  if (
    drafting.some(
      ([id, draft]) =>
        live.get(id)?.managerId === managerId ||
        drafted(live.get(id), draft)?.managerId === managerId,
    )
  ) {
    throw new ConflictError(
      "A planned hire reporting to this one has a draft; approve or discard it before filling this one",
    );
  }
  const reports = [...live].flatMap(([id, hire]) =>
    hire.managerId === managerId && unfilled(hire) ? [{ id, hire }] : [],
  );
  const tierOf = await readHireTier(transaction);
  const made: Change[] = [];
  for (const { id, hire } of reports) {
    const after: Recorded = { ...hire, managerId: personId };
    made.push(...asDraft(hireChanges(id, "changed", hire, after, tierOf)));
    await writeDraft(transaction, actor.user.id, recordType, id, hire, after);
  }
  requireHireEdits(actor, made);
  return made;
}

// Puts the fields named of a hire's draft back as they are live, keeping the rest of the draft, as
// taking a fill back out of it does, and returns the changes made, for the caller to record.
export async function draftHireAsLive(
  transaction: Transaction,
  actor: Actor,
  id: string,
  fields: readonly string[],
): Promise<Change[]> {
  requireHiringEdit(actor);
  const { before, draft, hire } = await lockDraftedHire(transaction, actor, id);
  // A fill is taken out only of hires it changes, which it never removes.
  const now = hire as Recorded;
  const after = tidy({
    ...now,
    ...Object.fromEntries(
      // The fields are the hire's own, named by the caller.
      // eslint-disable-next-line security/detect-object-injection
      fields.map((field) => [field, before?.[field] ?? null]),
    ),
  });
  const tierOf = await readHireTier(transaction);
  const made = [
    ...asDraft(hireChanges(id, "changed", now, after, tierOf)),
    ...clearedRejection(id, rejectionTier(tierOf), before, draft, recordType),
  ];
  requireHireEdits(actor, made);
  await writeDraft(transaction, actor.user.id, recordType, id, before, after);
  return made;
}

// Drafts removing a hire, which is how a hire is cancelled; removing one only drafted to be added
// discards that draft. Filled hires are refused, since the person who filled one is kept with it, as
// are hires that lead a feature team, today or later, or that a team's draft names.
export async function deleteHire(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  requireHiringEdit(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { before, draft, hire } = await lockDraftedHire(
      transaction,
      actor,
      id,
    );
    if (hire === undefined) return null;
    if (before === undefined) {
      await refuseDiscardingOthers(transaction, actor, recordType, id);
    }
    if (typeof hire.filledBy === "string") {
      throw new ConflictError(
        "A filled hire is kept; give its person an end date instead",
      );
    }
    if (await movedByFill(transaction, actor, before, hire)) {
      throw new ConflictError(partOfFill);
    }
    if (await hiresReportTo(transaction, [id], { drafted: true })) {
      throw new ConflictError(reassignReports);
    }
    await refuseRemovingOnTeams(transaction, [id], onTeamsRefusals.plannedHire);
    const tierOf = await readHireTier(transaction);
    const made = [
      ...asDraft(hireChanges(id, "deleted", hire, undefined, tierOf)),
      ...clearedRejection(id, rejectionTier(tierOf), before, draft, recordType),
    ];
    requireHireEdits(actor, made);
    await writeDraft(
      transaction,
      actor.user.id,
      recordType,
      id,
      before,
      undefined,
    );
    await recordHiringChanges(transaction, actor.user.id, made);
    return recordChanges(
      transaction,
      actor,
      made,
      before === undefined ? "discard" : "edit",
    );
  });
}

// Sends a rejected draft for approval again, within a change already under way with drafts locked,
// and returns the changes made, for the caller to record.
export async function resubmitHireDraftIn(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<Change[]> {
  requireHiringEdit(actor);
  const { before, draft } = await lockDraftedHire(transaction, actor, id);
  requireRejected(draft);
  const tierOf = await readHireTier(transaction);
  // Resubmitting sends every change the draft holds, so it needs the right to make each of them.
  for (const field of draftFields(before, draft)) {
    for (const sensitivity of hireSensitivities(field, [tierOf(field)])) {
      requireSensitivityEdit(actor, sensitivity);
    }
  }
  const made = clearedRejection(
    id,
    rejectionTier(tierOf),
    before,
    draft,
    recordType,
  );
  await reopened(transaction, recordType, id);
  return made;
}

// Discards a hire's draft, within a change already under way with drafts locked, and returns the
// changes made, for the caller to record.
export async function discardHireDraftIn(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<Change[]> {
  requireHiringEdit(actor);
  const { before, draft, hire } = await lockDraftedHire(transaction, actor, id);
  if (draft === undefined) {
    throw new NotFoundError("This planned hire has no draft");
  }
  const action = actionTo(hire, before);
  const tierOf = await readHireTier(transaction);
  const made = [
    ...asDraft(hireChanges(id, action, hire, before, tierOf)),
    ...clearedRejection(id, rejectionTier(tierOf), before, draft, recordType),
  ];
  requireHireEdits(actor, made);
  await writeDraft(transaction, actor.user.id, recordType, id, before, before);
  return made;
}
