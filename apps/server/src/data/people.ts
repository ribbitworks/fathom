// SPDX-License-Identifier: Apache-2.0

// Drafting people added, changed and removed, and resubmitting or discarding their drafts. Part of
// the data access layer.

import { type Database } from "@fathom/db";
import { type PersonChange, type PersonRequest } from "@fathom/shared";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  requirePermission,
  requireSensitivityEdit,
  seesSensitivity,
} from "../access.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import { type Change, recordChanges, type Transaction } from "./changes.ts";
import {
  addPersonDrafts,
  lockDrafts,
  readPersonDrafts,
  reopened,
  writePersonDraft,
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
import { columnsWithAdded } from "./added-columns.ts";
import { checkBuiltInChoice } from "./built-in-lists.ts";
import { readToday } from "./settings.ts";
import {} from "./hire-checks.ts";
import {
  changedReporting,
  checkLine,
  defaultFrom,
  readManagers,
  refuseTakenTeamNames,
} from "./reporting.ts";
import { type ColumnInfo, valueField } from "./values.ts";
import {
  noPerson,
  detailFields,
  personTier,
  recorded,
  checkState,
  withMark,
  valuesOf,
  personChanges,
  recordSensitiveChanges,
  choicesAskedFor,
  checkedValues,
  checkedLinks,
  checkedNotes,
  checkedNumbers,
  checkComplete,
  type PersonRow,
} from "./person-fields.ts";
import { hireDraftsNaming, partOfFill } from "./hire-checks.ts";
import { readLive } from "./people-reads.ts";
import {
  checkPersonChange,
  checkPersonRemoval,
  refuseTakenIds,
  requireEdits,
} from "./person-checks.ts";

const toBeRemoved =
  "This person's draft removes them; discard the draft to change them";

// Drafts adding people, all saved together, and returns them with the change set they were saved
// in.
export async function createPeople(
  database: Database,
  actor: Actor,
  requests: readonly PersonRequest[],
  asOf?: string,
): Promise<{ ids: string[]; changeSetId: string | null }> {
  requirePermission(actor, "people:edit");
  const today = asOf ?? (await readToday(database));
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { ids, made } = await draftNewPeople(
      transaction,
      actor,
      requests,
      today,
    );
    await recordSensitiveChanges(transaction, actor.user.id, made);
    return {
      ids,
      changeSetId: await recordChanges(transaction, actor, made),
    };
  });
}

// Drafts adding people, within a change already under way with drafts locked, and returns them with
// the changes made, for the caller to record.
export async function draftNewPeople(
  transaction: Transaction,
  actor: Actor,
  requests: readonly PersonRequest[],
  today: string,
): Promise<{ ids: string[]; made: Change[] }> {
  requirePermission(actor, "people:edit");
  const columns = await columnsWithAdded(transaction, actor.user.id, true);
  if (!seesSensitivity(actor, columns.positionTier)) {
    throw new ForbiddenError(
      "Every person needs a position, and this role can't see positions",
    );
  }
  const known = await choicesAskedFor(transaction, actor.user.id, requests);
  for (const positionId of new Set(requests.map((one) => one.positionId))) {
    await checkBuiltInChoice(transaction, "positions", positionId);
  }
  const made: Change[] = [];
  const added: { id: string; fields: Recorded }[] = [];
  for (const request of requests) {
    const id = randomUUID();
    const values = checkedValues(columns, known, request.values, undefined);
    const links = checkedLinks(columns, request.links);
    const notes = checkedNotes(columns, request.notes ?? {});
    const numbers = checkedNumbers(columns, request.numbers ?? {});
    const row: PersonRow = {
      id,
      preferredName: request.preferredName,
      employeeId: request.employeeId,
      positionId: request.positionId,
      startDate: request.startDate ?? null,
      endDate: request.endDate ?? null,
      isManager: request.isManager ?? false,
      stateId: request.stateId ?? null,
    };
    // Notes left empty are left out.
    const after = tidy({
      ...recorded(row, values),
      ...links,
      ...notes,
      ...numbers,
      ...(request.managerId == null
        ? {}
        : {
            managerId: request.managerId,
            managerFrom:
              request.managerFrom ??
              defaultFrom({ startDate: row.startDate }, today),
          }),
      ...(request.teamName == null ? {} : { teamName: request.teamName }),
    });
    checkComplete(columns, after);
    await checkState(transaction, after, today, undefined);
    made.push(...personChanges(columns, id, "created", undefined, after));
    added.push({ id, fields: after });
  }
  requireEdits(actor, made);
  const managers = await readManagers(
    transaction,
    requests.map(({ managerId }) => managerId ?? null),
    actor.user.id,
  );
  for (const { id, fields } of added) {
    await checkLine(
      transaction,
      id,
      fields,
      [],
      today,
      actor.user.id,
      managers,
    );
  }
  await refuseTakenIds(
    transaction,
    requests.map(({ employeeId }) => employeeId),
    [],
    actor.user.id,
  );
  await refuseTakenTeamNames(
    transaction,
    added.flatMap(({ id, fields }) =>
      typeof fields.teamName === "string"
        ? [{ id, name: fields.teamName }]
        : [],
    ),
    actor.user.id,
  );
  await addPersonDrafts(transaction, actor.user.id, added);
  return { ids: added.map(({ id }) => id), made: asDraft(made) };
}

// A person as they are and as the actor's draft makes them, locked for a change, refusing someone
// who is neither live nor in a draft the actor sees.
async function lockDrafted(
  transaction: Transaction,
  actor: Actor,
  columns: readonly ColumnInfo[],
  id: string,
  today?: string,
): Promise<{
  before: Recorded | undefined;
  draft: Draft | undefined;
  person: Recorded | undefined;
}> {
  const before = (
    await readLive(transaction, columns, { ids: [id], lock: true, asOf: today })
  ).get(id);
  const draft = (await readPersonDrafts(transaction, [id], actor.user.id)).get(
    id,
  );
  if (before === undefined && draft === undefined) {
    throw new NotFoundError(noPerson);
  }
  return { before, draft, person: drafted(before, draft) };
}

// Drafts a change to some of a person's details; each column named has its choices replaced.
export async function updatePerson(
  database: Database,
  actor: Actor,
  id: string,
  change: PersonChange,
  asOf?: string,
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  const today = asOf ?? (await readToday(database));
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const all = await draftPersonChange(transaction, actor, id, change, today);
    if (all.length === 0) return null;
    await recordSensitiveChanges(transaction, actor.user.id, all);
    return recordChanges(transaction, actor, all);
  });
}

// Drafts a change to some of a person's details, within a change already under way with drafts
// locked, and returns the changes made, for the caller to record: none when it changes nothing.
export async function draftPersonChange(
  transaction: Transaction,
  actor: Actor,
  id: string,
  change: PersonChange,
  today: string,
): Promise<Change[]> {
  requirePermission(actor, "people:edit");
  const columns = await columnsWithAdded(transaction, actor.user.id, true);
  const { before, draft, person } = await lockDrafted(
    transaction,
    actor,
    columns,
    id,
    today,
  );
  if (person === undefined) {
    if (before === undefined) throw new NotFoundError(noPerson);
    throw new ConflictError(toBeRemoved);
  }
  // What a fill waiting for approval sets on its person is kept until the fill is discarded.
  if (
    (change.positionId !== undefined ||
      change.managerId !== undefined ||
      change.managerFrom !== undefined ||
      change.isManager !== undefined) &&
    (await hireDraftsNaming(transaction, "filledBy", [id], actor.user.id))
  ) {
    throw new ConflictError(partOfFill);
  }
  const known = await choicesAskedFor(transaction, actor.user.id, [change]);
  const changedValues = checkedValues(
    columns,
    known,
    change.values ?? {},
    valuesOf(person),
  );
  const details = Object.fromEntries(
    detailFields.flatMap((field) =>
      // The field is one of the fixed details named above.
      // eslint-disable-next-line security/detect-object-injection
      change[field] === undefined ? [] : [[field, change[field]]],
    ),
  );
  // Columns left with nothing chosen are left out.
  const after = withMark(
    tidy({
      ...person,
      ...details,
      ...Object.fromEntries(
        [...changedValues].map(([fieldId, choiceIds]) => [
          valueField(fieldId),
          choiceIds,
        ]),
      ),
      ...checkedLinks(columns, change.links ?? {}),
      ...checkedNotes(columns, change.notes ?? {}),
      ...checkedNumbers(columns, change.numbers ?? {}),
      ...changedReporting(person, change, today),
    }),
    before,
  );
  const made = await checkPersonChange({
    transaction,
    actor,
    columns,
    id,
    live: before,
    person,
    after,
    today,
    known,
  });
  if (made.length === 0) return [];
  const all = [
    ...asDraft(made),
    ...clearedRejection(id, personTier(columns), before, draft),
  ];
  await writePersonDraft(transaction, actor.user.id, id, before, after);
  return all;
}

// Puts the fields named of a person's draft back as they are live, keeping the rest of the draft, as
// taking a fill back out of it does, and returns the changes made, for the caller to record.
export async function draftPersonAsLive(
  transaction: Transaction,
  actor: Actor,
  id: string,
  fields: readonly string[],
): Promise<Change[]> {
  requirePermission(actor, "people:edit");
  const columns = await columnsWithAdded(transaction, actor.user.id, true);
  const { before, draft, person } = await lockDrafted(
    transaction,
    actor,
    columns,
    id,
  );
  // A fill is taken out only of someone live it changes, whom it never removes.
  const live = before as Recorded;
  const now = person as Recorded;
  const after = withMark(
    tidy({
      ...Object.fromEntries(
        Object.entries(now).filter(([field]) => !fields.includes(field)),
      ),
      ...Object.fromEntries(
        Object.entries(live).filter(([field]) => fields.includes(field)),
      ),
    }),
    live,
  );
  const made = [
    ...asDraft(personChanges(columns, id, "changed", now, after)),
    ...clearedRejection(id, personTier(columns), before, draft),
  ];
  requireEdits(actor, made);
  await writePersonDraft(transaction, actor.user.id, id, before, after);
  return made;
}

// Drafts removing a person entered by mistake, recording everything they held; removing someone
// only drafted to be added discards that draft. People who leave are given an end date instead.
// Nobody who is or was anyone's manager can be removed, nor anyone a planned hire names, as its
// manager or as who filled it, nor anyone a plan record names, such as a project's owner.
export async function deletePerson(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const columns = await columnsWithAdded(transaction, actor.user.id, true);
    const { before, draft, person } = await lockDrafted(
      transaction,
      actor,
      columns,
      id,
    );
    // Already drafted to be removed.
    if (person === undefined) return null;
    const made = [
      ...asDraft(
        await checkPersonRemoval(
          transaction,
          actor,
          columns,
          id,
          before,
          person,
        ),
      ),
      ...clearedRejection(id, personTier(columns), before, draft),
    ];
    await writePersonDraft(transaction, actor.user.id, id, before, undefined);
    await recordSensitiveChanges(transaction, actor.user.id, made);
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
export async function resubmitPersonDraftIn(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<Change[]> {
  requirePermission(actor, "people:edit");
  const columns = await columnsWithAdded(transaction, actor.user.id, true);
  const { before, draft } = await lockDrafted(transaction, actor, columns, id);
  requireRejected(draft);
  const tierOf = personTier(columns);
  // Resubmitting sends every change the draft holds, so it needs the right to make each of them.
  for (const field of draftFields(before, draft)) {
    requireSensitivityEdit(actor, tierOf(field));
  }
  const made = clearedRejection(id, tierOf, before, draft);
  await reopened(transaction, "person", id);
  return made;
}

// Discards a person's draft, within a change already under way with drafts locked, and returns the
// changes made, for the caller to record.
export async function discardPersonDraftIn(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<Change[]> {
  requirePermission(actor, "people:edit");
  const columns = await columnsWithAdded(transaction, actor.user.id, true);
  const { before, draft, person } = await lockDrafted(
    transaction,
    actor,
    columns,
    id,
  );
  if (draft === undefined) {
    throw new NotFoundError("This person has no draft");
  }
  const action = actionTo(person, before);
  const made = [
    ...asDraft(personChanges(columns, id, action, person, before)),
    ...clearedRejection(id, personTier(columns), before, draft),
  ];
  requireEdits(actor, made);
  await writePersonDraft(transaction, actor.user.id, id, before, before);
  return made;
}
