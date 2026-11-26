// SPDX-License-Identifier: Apache-2.0

// The checks a change to planned hires must pass: their managers, report loops, requisitions and
// fills, and the people hires name. Part of the data access layer.

import {
  drafts,
  inChunks,
  people,
  plannedHires,
  privateChanges,
  type Reader,
} from "@fathom/db";
import { changesHiringPlan, type HireChange } from "@fathom/shared";
import { and, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { type Actor } from "../access.ts";
import { BadRequestError, ConflictError, ForbiddenError } from "../errors.ts";
import { peoplesMeaning } from "./list-rules.ts";
import { choiceLabels } from "./values.ts";
import { type Transaction } from "./changes.ts";
import { drafted, type Recorded } from "./draft-records.ts";
import { takenEmployeeIds } from "./drafted-values.ts";
import { asSeenBy, readDrafts } from "./drafts.ts";
import { notMarked, readManagers, reassignReports } from "./reporting.ts";
import {
  type HireRow,
  nameOfHire,
  recordedHire,
  recordType,
} from "./hire-fields.ts";
import { readHireDrafts, readLiveHires } from "./hire-reads.ts";

const duplicateId = "Someone already has that ID";

// Changing planned hires needs the rights to edit people and the hiring plan.
export const editsHires = (actor: Actor): boolean =>
  actor.permissions.includes("people:edit") && changesHiringPlan(actor);

export function requireHiringEdit(actor: Actor): void {
  if (!editsHires(actor)) throw new ForbiddenError();
}

// Hired and Left are people's states, and a hire is hired only by filling it.
export const hiredState =
  "That state is for people. A planned hire is hired when someone fills it.";

export function refuseHired(meaning: string | null): void {
  if (peoplesMeaning(meaning)) throw new BadRequestError(hiredState);
}

// Whether a draft, as the editor sees the drafts, removes the record given.
const draftedRemoval = async (
  transaction: Transaction,
  type: "person" | typeof recordType,
  id: string,
  editor: string,
): Promise<boolean> =>
  (await readDrafts(transaction, type, [id], editor)).get(id)?.action ===
  "deleted";

// Whether a hire may have the manager given: none, a live person, or a live planned hire not yet
// filled, whom no draft the editor sees removes.
export async function managerAllowed(
  transaction: Transaction,
  managerId: unknown,
  editor: string,
): Promise<boolean> {
  if (typeof managerId !== "string") return true;
  const [person] = await transaction
    .select({ id: people.id })
    .from(people)
    .where(eq(people.id, managerId))
    .for("share");
  if (person !== undefined) {
    return !(await draftedRemoval(transaction, "person", managerId, editor));
  }
  const [hire] = await transaction
    .select({ filledBy: plannedHires.filledBy })
    .from(plannedHires)
    .where(eq(plannedHires.id, managerId))
    .for("share");
  return (
    hire !== undefined &&
    hire.filledBy === null &&
    !(await draftedRemoval(transaction, recordType, managerId, editor)) &&
    !(await hireDraftsNaming(transaction, "filledBy", [managerId], editor, {
      byRecord: true,
    }))
  );
}

export const partOfFill =
  "This is part of filling a planned hire; discard the fill to change it";

// Whether a fill drafted moves the hire, as the actor's drafts make it, from the planned manager it
// reports to live to the person the planned manager's draft fills it with.
export async function movedByFill(
  transaction: Transaction,
  actor: Actor,
  before: Recorded | undefined,
  hire: Recorded,
): Promise<boolean> {
  const liveManager = before?.managerId;
  if (typeof liveManager !== "string" || hire.managerId === liveManager) {
    return false;
  }
  const managing = drafted(
    (await readLiveHires(transaction, [liveManager])).get(liveManager),
    (await readHireDrafts(transaction, [liveManager], actor.user.id)).get(
      liveManager,
    ),
  );
  return managing?.filledBy === hire.managerId;
}

// Refuses a change to what a fill drafted sets: a hire's state, manager, and Manager? while its
// draft fills it, and the manager of a hire the fill moves to its person.
export async function refuseChangingFill(
  transaction: Transaction,
  actor: Actor,
  before: Recorded | undefined,
  hire: Recorded,
  change: HireChange,
): Promise<void> {
  const filling = unfilled(before ?? {}) && !unfilled(hire);
  if (
    (filling &&
      (change.stateId !== undefined ||
        change.positionId !== undefined ||
        change.managerId !== undefined ||
        change.isManager !== undefined)) ||
    (change.managerId !== undefined &&
      (await movedByFill(transaction, actor, before, hire)))
  ) {
    throw new ConflictError(partOfFill);
  }
}

const hireLoop =
  "That manager reports to this planned hire, directly or through others";
const ownManager = "A planned hire can't report to itself";

// Each hire's manager as it is live: a person or a planned hire.
async function liveManagers(reader: Reader): Promise<Map<string, unknown>> {
  const rows = await reader
    .select({
      id: plannedHires.id,
      managerId: plannedHires.managerId,
      managerHireId: plannedHires.managerHireId,
    })
    .from(plannedHires);
  return new Map(
    rows.map(({ id, managerId, managerHireId }) => [
      id,
      managerId ?? managerHireId,
    ]),
  );
}

// Refuses a planned manager who is the hire itself, or reports to it, directly or through other
// planned hires, as every hire is live or as the editor's drafts make it, with the hire's wanted
// manager in place of its draft's.
export async function refuseHireLoop(
  transaction: Transaction,
  editor: string,
  id: string,
  managerId: unknown,
): Promise<void> {
  if (typeof managerId !== "string") return;
  if (managerId === id) throw new BadRequestError(ownManager);
  const live = await liveManagers(transaction);
  const managerOf = new Map(live);
  for (const [hireId, draft] of await readHireDrafts(
    transaction,
    undefined,
    editor,
  )) {
    const before = live.has(hireId)
      ? { managerId: live.get(hireId) }
      : undefined;
    managerOf.set(hireId, drafted(before, draft)?.managerId);
  }
  managerOf.set(id, managerId);
  if (reachesItself(managerOf, id)) throw new BadRequestError(hireLoop);
}

// Whether following managers up from the hire comes back to it. A chain that loops elsewhere, which
// the rules never let in, ends where it first repeats.
function reachesItself(
  managerOf: ReadonlyMap<string, unknown>,
  id: string,
): boolean {
  const seen = new Set<string>();
  let next = managerOf.get(id);
  while (typeof next === "string" && !seen.has(next)) {
    if (next === id) return true;
    seen.add(next);
    next = managerOf.get(next);
  }
  return false;
}

// Refuses approving managers that, now applied, make a planned hire report to itself, naming it.
export async function refuseHireLoopsLive(
  transaction: Transaction,
  ids: readonly string[],
  seesPositions: boolean,
): Promise<void> {
  const managerOf = await liveManagers(transaction);
  const looping = ids.find((id) => reachesItself(managerOf, id));
  if (looping === undefined) return;
  const [row] = await transaction
    .select()
    .from(plannedHires)
    .where(eq(plannedHires.id, looping));
  // The hire was just approved, so it is live.
  const hire = recordedHire(row as HireRow);
  throw new ConflictError(
    `${await nameWithPosition(transaction, hire, seesPositions)} would end up reporting to itself`,
  );
}

// A hire's name, with its position's label for those who see positions.
async function nameWithPosition(
  reader: Reader,
  hire: Recorded,
  seesPositions: boolean,
): Promise<string> {
  const positionId = String(hire.positionId);
  const position = seesPositions
    ? (await choiceLabels(reader, [positionId])).get(positionId)
    : undefined;
  return nameOfHire(hire, position);
}

// Which of the managers given are planned hires, so their hires keep them in that column.
export async function hiresAmong(
  reader: Reader,
  ids: readonly string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  for (const chunk of inChunks([...new Set(ids)])) {
    for (const { id } of await reader
      .select({ id: plannedHires.id })
      .from(plannedHires)
      .where(inArray(plannedHires.id, chunk))) {
      found.add(id);
    }
  }
  return found;
}

// Refuses naming as a manager a planned hire that a fill, in any draft, is filling.
async function refuseHireBeingFilled(
  transaction: Transaction,
  managerId: unknown,
  editor: string,
): Promise<void> {
  if (
    typeof managerId === "string" &&
    (await hireDraftsNaming(transaction, "filledBy", [managerId], editor, {
      byRecord: true,
    }))
  ) {
    throw new BadRequestError(
      "That planned hire is being filled, so it can't be a manager; once the fill is approved, choose the person who fills it",
    );
  }
}

export async function checkManager(
  transaction: Transaction,
  managerId: unknown,
  editor: string,
): Promise<void> {
  await refuseHireBeingFilled(transaction, managerId, editor);
  if (!(await managerAllowed(transaction, managerId, editor))) {
    throw new BadRequestError(chooseManager);
  }
}

// Refuses a fill of a hire reporting to a planned manager when it gives its person no manager of
// their own, since people report only to people.
export async function requirePersonManager(
  transaction: Transaction,
  managerId: string,
  editor: string,
): Promise<void> {
  const managers = await readManagers(transaction, [managerId], editor);
  if (!managers.has(managerId)) throw new ConflictError(chooseManager);
}

// Refuses a manager given for a fill's person who is not a live person, since people report only to
// people.
export async function checkFillManager(
  transaction: Transaction,
  managerId: string,
  editor: string,
): Promise<void> {
  await refuseHireBeingFilled(transaction, managerId, editor);
  const manager = (await readManagers(transaction, [managerId], editor)).get(
    managerId,
  );
  if (manager === undefined || manager.removing) {
    throw new BadRequestError(chooseManager);
  }
  if (!manager.isManager) throw new ConflictError(notMarked(manager));
}

// Refuses a requisition that a person's Employee ID or another hire's requisition already is, live
// or in a draft, ignoring letter case.
export async function checkRequisition(
  transaction: Transaction,
  requisition: string | null,
  id: string,
  editor: string,
): Promise<void> {
  if (
    requisition !== null &&
    (await takenEmployeeIds(transaction, [requisition], [id], editor)).length >
      0
  ) {
    throw new ConflictError(duplicateId);
  }
}

export const unfilled = (hire: Recorded) => typeof hire.filledBy !== "string";

// Whether a hire not yet filled, as a change leaves it, names a manager it did not name before: a
// new hire's manager, or a changed one.
export const newlyManaged = (before: Recorded | undefined, after: Recorded) =>
  typeof after.managerId === "string" &&
  unfilled(after) &&
  before?.managerId !== after.managerId;

// Refuses a manager, a person or a planned hire, who is not marked as a manager for a hire not yet
// filled, as people's managers are. A planned hire is named by its position only to those who see
// positions.
export async function refuseUnmarked(
  reader: Reader,
  managerId: string,
  refused: (message: string) => Error,
  { seesPositions }: { seesPositions: boolean },
): Promise<void> {
  const [manager] = await reader
    .select({
      preferredName: people.preferredName,
      isManager: people.isManager,
    })
    .from(people)
    .where(eq(people.id, managerId));
  if (manager !== undefined && !manager.isManager) {
    throw refused(notMarked(manager));
  }
  const [row] = await reader
    .select()
    .from(plannedHires)
    .where(eq(plannedHires.id, managerId));
  if (row !== undefined && !row.isManager) {
    throw refused(
      notMarked({
        preferredName: await nameWithPosition(
          reader,
          recordedHire(row),
          seesPositions,
        ),
      }),
    );
  }
}

// Whether a hire not yet filled names any of the planned hires given as its manager, live, or, when
// asked, in a draft as the editor, when given, sees the drafts.
export async function hiresReportTo(
  reader: Reader,
  ids: readonly string[],
  { drafted, editor }: { drafted: boolean; editor: string | undefined },
): Promise<boolean> {
  for (const chunk of inChunks([...ids])) {
    const [live] = await reader
      .select({ id: plannedHires.id })
      .from(plannedHires)
      .where(
        and(
          inArray(plannedHires.managerHireId, chunk),
          isNull(plannedHires.filledBy),
        ),
      )
      .limit(1);
    if (live !== undefined) return true;
    for (const table of drafted ? [drafts, privateChanges] : []) {
      const [found] = await reader
        .select({ id: table.recordId })
        .from(table)
        .where(
          and(
            eq(table.recordType, recordType),
            inArray(sql`${table.fields}->>'managerId'`, chunk),
            asSeenBy(table, editor, "managerId"),
          ),
        )
        .limit(1);
      if (found !== undefined) return true;
    }
  }
  return false;
}

const chooseManager = "Choose a manager from People";

// Refuses removing people whom any hire, live or in a published draft, names as its manager
// or as the person who filled it.
export async function refuseRemovingHiresPeople(
  reader: Reader,
  ids: readonly string[],
  editor: string | undefined,
): Promise<void> {
  for (const chunk of inChunks([...ids])) {
    const [live] = await reader
      .select({ id: plannedHires.id })
      .from(plannedHires)
      .where(
        or(
          inArray(plannedHires.managerId, chunk),
          inArray(plannedHires.filledBy, chunk),
        ),
      )
      .limit(1);
    if (
      live !== undefined ||
      (await hireDraftsNaming(reader, "managerId", chunk, editor)) ||
      (await hireDraftsNaming(reader, "filledBy", chunk, editor))
    ) {
      throw new ConflictError(
        "A planned hire names this person; change the hire first",
      );
    }
  }
}

// Refuses clearing the Manager? mark of people a hire not yet filled names as its manager, live or,
// when drafting, in a hire's draft as the editor, when given, sees them.
export async function refuseUnmarkingHireManagers(
  reader: Reader,
  ids: readonly string[],
  { drafted, editor }: { drafted: boolean; editor: string | undefined },
): Promise<void> {
  for (const chunk of inChunks([...ids])) {
    const [live] = await reader
      .select({ id: plannedHires.id })
      .from(plannedHires)
      .where(
        and(
          inArray(plannedHires.managerId, chunk),
          isNull(plannedHires.filledBy),
        ),
      )
      .limit(1);
    if (
      live !== undefined ||
      (drafted && (await hireDraftsNaming(reader, "managerId", chunk, editor)))
    ) {
      throw new ConflictError(reassignReports);
    }
  }
}

// Whether any hire's draft, as the editor sees the drafts, names any of the people given in the field
// given, as its manager or as who fills it, or, asked by record, whether any of the hires given has a
// draft naming anyone in it. With an editor, their own unpublished changes stand in for the published
// drafts they replace.
export async function hireDraftsNaming(
  reader: Reader,
  field: "managerId" | "filledBy",
  ids: readonly string[],
  editor: string | undefined,
  {
    byRecord = false,
    except = [],
  }: { byRecord?: boolean; except?: readonly string[] } = {},
): Promise<boolean> {
  for (const chunk of inChunks([...ids])) {
    for (const table of [drafts, privateChanges]) {
      const [found] = await reader
        .select({ id: table.recordId })
        .from(table)
        .where(
          and(
            eq(table.recordType, recordType),
            byRecord
              ? and(
                  inArray(table.recordId, chunk),
                  sql`${table.fields}->>${field} IS NOT NULL`,
                )
              : inArray(sql`${table.fields}->>${field}`, chunk),
            except.length === 0
              ? undefined
              : notInArray(table.recordId, [...except]),
            asSeenBy(table, editor, field),
          ),
        )
        .limit(1);
      if (found !== undefined) return true;
    }
  }
  return false;
}
