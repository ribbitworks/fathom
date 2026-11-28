// SPDX-License-Identifier: Apache-2.0

// The rules a person as a change makes them goes through, and their removal, shared by drafting a
// change and by publishing a private one. Part of the data access layer.

import { seesField } from "@fathom/shared";
import { type Actor, requireSensitivityEdit } from "../access.ts";
import { ConflictError } from "../errors.ts";
import { type Change, type Transaction } from "./changes.ts";
import { checkBuiltInChoice } from "./built-in-lists.ts";
import { type Recorded, same } from "./draft-records.ts";
import { takenEmployeeIds } from "./drafted-values.ts";
import { refuseRemovingPeopleOnTeams } from "./feature-team-removals.ts";
import {
  refuseRemovingHiresPeople,
  refuseUnmarkingHireManagers,
} from "./hire-checks.ts";
import {
  checkComplete,
  changedChoices,
  checkedValues,
  checkState,
  type ChoiceRow,
  choicesAskedFor,
  personChanges,
  valuesOf,
} from "./person-fields.ts";
import { refuseRemovingNamed } from "./records.ts";
import {
  checkLine,
  type Manager,
  readLines,
  refuseLoop,
  refuseRemovingManagers,
  refuseReportsOutside,
  refuseTakenTeamNames,
  refuseUnmarkingManagers,
} from "./reporting.ts";
import { type TableColumns } from "./values.ts";

const duplicateEmployeeId = "Someone already has that ID";

// Refuses changes to tiers the actor may not change.
export function requireEdits(actor: Actor, made: readonly Change[]): void {
  for (const tier of new Set(made.map((change) => change.tier))) {
    requireSensitivityEdit(actor, tier);
  }
}

// Refuses Employee IDs that someone else has, live or in a draft, or that two of the people asked
// for share.
export async function refuseTakenIds(
  transaction: Transaction,
  employeeIds: readonly string[],
  except: readonly string[],
  editor: string,
): Promise<void> {
  const lowered = employeeIds.map((id) => id.toLowerCase());
  if (
    new Set(lowered).size !== lowered.length ||
    (await takenEmployeeIds(transaction, employeeIds, except, editor)).length >
      0
  ) {
    throw new ConflictError(duplicateEmployeeId, "employeeId");
  }
}

// A person as a change makes them, from how they were before it, if anyone had them, and as they
// are live, if they are.
export interface PersonChecked {
  transaction: Transaction;
  actor: Actor;
  columns: TableColumns;
  id: string;
  live: Recorded | undefined;
  person: Recorded | undefined;
  after: Recorded;
  today: string;
  // The choices the change asks for, where the caller has read them already.
  known?: readonly ChoiceRow[];
  // For several people added at once: the managers they name, read once, with their positions,
  // Employee IDs and team names checked by the caller for them all.
  batch?: { managers: ReadonlyMap<string, Manager> };
}

// Refuses a person as a change makes them, and returns the changes it makes, none when it changes
// nothing: a position or column value not offered, a required detail or
// column left empty, a state that doesn't fit, a class the actor may not change, a reporting line
// or loop that can't be, dates that leave their reports outside, a manager unmarked who still
// manages, or a team name or Employee ID someone else has.
export async function checkPersonChange(
  checked: PersonChecked,
): Promise<Change[]> {
  const {
    transaction,
    actor,
    columns,
    id,
    live,
    person,
    after,
    today,
    known,
    batch,
  } = checked;
  const editor = actor.user.id;
  // The fields are the person's own, named here or by their columns.
  // eslint-disable-next-line security/detect-object-injection
  const changed = (field: string) => !same(after[field], person?.[field]);
  if (batch === undefined && changed("positionId")) {
    await checkBuiltInChoice(
      transaction,
      "positions",
      String(after.positionId),
      person?.positionId,
    );
  }
  const asked = changedChoices(columns, after, person);
  checkedValues(
    columns,
    known ?? (await choicesAskedFor(transaction, editor, [{ values: asked }])),
    asked,
    person === undefined ? undefined : valuesOf(person),
  );
  checkComplete(columns, after);
  // A request can't take a person's state away, so only a state held is checked.
  if (typeof after.stateId === "string" && changed("stateId")) {
    // Those who see no dates are offered states from the live end date, so their choice is
    // checked against it, and a draft's end date is never revealed by a refusal; a state that
    // stops fitting once the draft is approved shows the first of the meaning instead.
    const dates = seesField(actor, "endDate") ? after : (live ?? after);
    await checkState(
      transaction,
      { ...after, endDate: dates.endDate },
      after.stateId,
      today,
      person?.stateId,
    );
  }
  const made = personChanges(
    columns,
    id,
    person === undefined ? "created" : "changed",
    person,
    after,
  );
  requireEdits(actor, made);
  if (made.length === 0) return [];
  const lines =
    live === undefined ? [] : (await readLines(transaction, [id])).get(id);
  await checkLine(
    transaction,
    id,
    after,
    lines ?? [],
    today,
    editor,
    batch?.managers,
  );
  // Someone added has nobody reporting to them yet, so can't close a loop.
  if (
    person !== undefined &&
    typeof after.managerFrom === "string" &&
    (changed("managerId") || changed("managerFrom"))
  ) {
    await refuseLoop(
      transaction,
      editor,
      id,
      typeof after.managerId === "string" ? after.managerId : null,
      after.managerFrom,
      today,
    );
  }
  if (live !== undefined && (changed("startDate") || changed("endDate"))) {
    await refuseReportsOutside(transaction, [{ id, person: after }], today, {
      editor,
    });
  }
  if (person?.isManager === true && after.isManager === false) {
    await refuseUnmarkingManagers(transaction, [id], today, {
      drafted: true,
      editor,
    });
    await refuseUnmarkingHireManagers(transaction, [id], {
      drafted: true,
      editor,
    });
  }
  if (batch !== undefined) return made;
  if (typeof after.teamName === "string" && changed("teamName")) {
    await refuseTakenTeamNames(
      transaction,
      [{ id, name: after.teamName }],
      editor,
    );
  }
  if (changed("employeeId")) {
    await refuseTakenIds(transaction, [String(after.employeeId)], [id], editor);
  }
  return made;
}

// Refuses removing a person who is or was anyone's manager, whom a planned hire, a record of the
// plan or a feature team names, or who holds a class the actor may not change; returns the changes
// the removal makes.
export async function checkPersonRemoval(
  transaction: Transaction,
  actor: Actor,
  columns: TableColumns,
  id: string,
  live: Recorded | undefined,
  person: Recorded,
): Promise<Change[]> {
  const editor = actor.user.id;
  if (live !== undefined) {
    await refuseRemovingManagers(transaction, [id], editor);
  }
  await refuseRemovingHiresPeople(transaction, [id], editor);
  await refuseRemovingNamed(transaction, "person", [id], actor);
  await refuseRemovingPeopleOnTeams(transaction, [id], editor);
  const made = personChanges(columns, id, "deleted", person, undefined);
  requireEdits(actor, made);
  return made;
}
