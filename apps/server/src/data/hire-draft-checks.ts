// SPDX-License-Identifier: Apache-2.0

// The rules a planned hire as a change makes it goes through, its removal, and a fill, shared by
// drafting them and by publishing a private change. Part of the data access layer.

import { type Actor, seesSensitivity } from "../access.ts";
import { BadRequestError, ConflictError } from "../errors.ts";
import { checkBuiltInChoice } from "./built-in-lists.ts";
import { type Change, type Transaction } from "./changes.ts";
import { type Recorded, same } from "./draft-records.ts";
import {
  checkFillManager,
  checkManager,
  checkRequisition,
  hiresReportTo,
  movedByFill,
  newlyManaged,
  refuseHired,
  refuseHireLoop,
  refuseUnmarked,
  unfilled,
} from "./hire-checks.ts";
import {
  type HireTier,
  hireChanges,
  offeredOn,
  refuseNotOffered,
  requireHireEdits,
} from "./hire-fields.ts";
import {
  type ChoiceRow,
  changedChoices,
  checkedValues,
  choicesAskedFor,
  valuesOf,
} from "./person-fields.ts";
import { reassignReports, text } from "./reporting.ts";
import { fieldOfValue, type TableColumns } from "./values.ts";

// A planned hire as a change makes it, from how it was before, if anyone had it.
export interface HireChecked {
  transaction: Transaction;
  actor: Actor;
  columns: TableColumns;
  tierOf: HireTier;
  id: string;
  live: Recorded | undefined;
  hire: Recorded | undefined;
  after: Recorded;
  // The choices the change asks for, where the caller has read them already.
  known?: readonly ChoiceRow[];
}

// Refuses a planned hire as a change makes it, and returns the changes it makes: a column not
// offered on planned hires, a value, position or state not offered, a state meaning Hired, a
// manager or requisition that can't be, a manager marked who can't manage, a reporting loop, a
// manager unmarked who still has hires reporting to it, or a class the actor may not change.
export async function checkHireChange(checked: HireChecked): Promise<Change[]> {
  const { transaction, actor, columns, tierOf, id, live, hire, after, known } =
    checked;
  const editor = actor.user.id;
  // The fields are the hire's own, named here or by its columns.
  // eslint-disable-next-line security/detect-object-injection
  const changed = (field: string) => !same(after[field], hire?.[field]);
  const valueFields = Object.keys({ ...hire, ...after }).filter(
    (field) => fieldOfValue(field) !== null && changed(field),
  );
  refuseNotOffered(columns, {
    values: Object.fromEntries(
      valueFields.map((field): [string, boolean] => [
        String(fieldOfValue(field)),
        true,
      ]),
    ),
  });
  const offered = offeredOn(columns);
  const asked = changedChoices(offered, after, hire);
  checkedValues(
    offered,
    known ?? (await choicesAskedFor(transaction, editor, [{ values: asked }])),
    asked,
    hire === undefined ? undefined : valuesOf(hire),
  );
  // A fill gives the hire its person's manager, who must be a person who manages, and moves the
  // hires reporting to it to its person, whose own checks cover them: either way the manager is the
  // fill's, not one chosen.
  const filling = typeof after.filledBy === "string" && changed("filledBy");
  const moved =
    !filling && (await movedByFill(transaction, actor, live, after));
  const fillsManager = filling || moved;
  const managerId = text(after.managerId);
  if (changed("managerId") && !moved) {
    await (filling && managerId !== null
      ? checkFillManager(transaction, managerId, editor)
      : checkManager(transaction, managerId, editor));
  }
  if (changed("positionId")) {
    await checkBuiltInChoice(
      transaction,
      "positions",
      String(after.positionId),
      hire?.positionId,
    );
  }
  if (changed("stateId")) {
    refuseHired(
      await checkBuiltInChoice(
        transaction,
        "hiring-states",
        String(after.stateId),
        hire?.stateId,
      ),
    );
  }
  if (typeof after.requisition === "string" && changed("requisition")) {
    await checkRequisition(transaction, after.requisition, id, editor);
  }
  if (!fillsManager && newlyManaged(hire, after)) {
    await refuseUnmarked(
      transaction,
      String(after.managerId),
      (message) => new BadRequestError(message),
      { seesPositions: seesSensitivity(actor, tierOf("positionId")) },
    );
  }
  // A hire added has nobody reporting to it yet, so can't close a loop.
  if (hire !== undefined && !fillsManager && changed("managerId")) {
    await refuseHireLoop(transaction, editor, id, after.managerId);
  }
  if (
    hire?.isManager === true &&
    after.isManager !== true &&
    (await hiresReportTo(transaction, [id], { drafted: true, editor }))
  ) {
    throw new ConflictError(reassignReports);
  }
  const made = hireChanges(
    id,
    hire === undefined ? "created" : "changed",
    hire,
    after,
    tierOf,
  );
  requireHireEdits(actor, made);
  return made;
}

// Refuses removing a planned hire that is filled, or that hires report to, or holding a class the
// actor may not change; returns the changes the removal makes.
export async function checkHireRemoval(
  transaction: Transaction,
  actor: Actor,
  tierOf: HireTier,
  id: string,
  hire: Recorded,
): Promise<Change[]> {
  if (typeof hire.filledBy === "string") {
    throw new ConflictError(
      "A filled hire is kept; give its person an end date instead",
    );
  }
  if (
    await hiresReportTo(transaction, [id], {
      drafted: true,
      editor: actor.user.id,
    })
  ) {
    throw new ConflictError(reassignReports);
  }
  const made = hireChanges(id, "deleted", hire, undefined, tierOf);
  requireHireEdits(actor, made);
  return made;
}

const filledAlready = "This planned hire is already filled";

// Refuses filling a planned hire, as it is live and as the change starts from: one only drafted to
// be added, already filled, or whose draft changes its manager.
export function refuseUnfillable(
  live: Recorded | undefined,
  hire: Recorded,
): void {
  if (live === undefined) {
    throw new ConflictError(
      "This planned hire is only drafted to be added; approve it before filling it",
    );
  }
  if (!unfilled(hire)) throw new ConflictError(filledAlready);
  if (hire.managerId !== live.managerId) {
    throw new ConflictError(
      "This planned hire's draft changes its manager; approve or discard that draft before filling it",
    );
  }
}
