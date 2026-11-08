// SPDX-License-Identifier: Apache-2.0

// Approving and rejecting drafts, one at a time or several at once, as the Decisions Log sets out:
// of people here, of lists, choices, and the order of lists' choices in list-approvals.ts, and of
// the plan's records, such as release streams, in records.ts. Part of the data access layer.
// Approving applies the drafts to the live records, all in one change set or none of them, and
// rejecting keeps them, marked Rejected with the Approver's reason. An Approver may not approve
// drafts they changed, unless their role lets them approve their own, but may reject them, and
// needs roles that see every value in the drafts they approve or reject, and that approve drafts of
// every area those drafts, and those approved with them, belong to. Neither can be undone.

import {
  type Database,
  databaseCodes,
  drafts,
  fieldOfValue,
  fieldValues,
  hasDatabaseCode,
  inChunks,
  people,
} from "@fathom/db";
import {
  approvedAreaNames,
  approvePermissions,
  type Asking,
  type DraftKind,
  draftKinds,
  type DraftsRequest,
  kindsAsked,
} from "@fathom/shared";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  type Actor,
  requireAnyPermission,
  requirePermission,
  seesSensitivity,
} from "../access.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import { type Change, recordChanges, type Transaction } from "./changes.ts";
import {
  type Draft,
  drafted,
  draftFields,
  draftTier,
  fitsColumns,
  lockDrafts,
  readPersonDrafts,
  type Recorded,
  refuseHeldDecision,
  refuseOwnDrafts,
  draftKeys,
  refuseRejected,
  rejectedField,
  setRejection,
} from "./drafts.ts";
import {
  notStarted,
  personChanges,
  personTier,
  readLive,
  recordSensitiveChanges,
} from "./people.ts";
import {
  approveColumnDrafts,
  asksForColumns,
  rejectColumnDrafts,
} from "./column-approvals.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { refuseUsedAcross, withUsedAcross } from "./draft-uses.ts";
import {
  applyReporting,
  refuseRemovingManagers,
  refuseUnmarkingManagers,
} from "./reporting.ts";
import {
  approveListDrafts,
  asksForLists,
  rejectListDrafts,
} from "./list-approvals.ts";
import { approveRecordDrafts, rejectRecordDrafts } from "./records.ts";
import { inListOrder, readColumns, valueField, valueRows } from "./values.ts";
import { readToday } from "./settings.ts";
import {
  approveHiresIn,
  checkHiresAsked,
  recordHiringChanges,
  refuseRemovingHiresPeople,
  refuseUnmarkingHireManagers,
  rejectHiresIn,
} from "./hires.ts";

const noDraft = "One of these people has no draft; refresh to see the latest";

// Checks the actor may approve or reject the drafts of people asked for, and reads them, with the
// people as they are live. A draft the actor is not shown, since it changes only what they may not
// see, is answered as one that does not exist, so asking reveals nothing; one they see only part of
// is refused. Values in columns drafted to be added are judged by those columns' tiers, so this is
// checked before the drafts the people use are read or approved.
async function seenAsked(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  today: string,
) {
  requirePermission(actor, "people:view");
  const columns = await columnsWithAdded(transaction, undefined, true);
  const found = await readPersonDrafts(transaction, ids);
  if (found.size !== ids.length) throw new NotFoundError(noDraft);
  const live = await readLive(transaction, columns, {
    ids,
    lock: true,
    asOf: today,
  });
  const tierOf = personTier(columns);
  const shown = new Set(columns.map(({ id }) => valueField(id)));
  const seen = (field: string) =>
    (fieldOfValue(field) === null || shown.has(field)) &&
    seesSensitivity(actor, tierOf(field));
  // Those without Restricted details see everyone who has started, as the live dates say.
  const listed = (id: string, draft: Draft) =>
    seesSensitivity(actor, "restricted") ||
    !notStarted(live.get(id) ?? draft.fields, today);
  for (const [id, draft] of found) {
    const fields = draftFields(live.get(id), draft);
    if (!fields.some(seen) || !listed(id, draft)) {
      throw new NotFoundError(noDraft);
    }
    if (!fields.every(seen)) {
      throw new ForbiddenError(
        "One of these drafts holds details your role does not let you see, so an Approver who sees them must decide it",
      );
    }
  }
  await refuseHeldDecision(transaction, "person", ids);
  return { columns, found, live };
}

type Seen = Awaited<ReturnType<typeof seenAsked>>;

// The drafts of people asked for, checked as above, with the live columns, which by now include
// those drafted to be added that the people use, approved with them.
async function readAsked(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  today: string,
) {
  const { found, live } = await seenAsked(transaction, actor, ids, today);
  return { columns: await readColumns(transaction, true), found, live };
}

const detailColumns = (id: string, person: Recorded) => ({
  id,
  preferredName: String(person.preferredName),
  employeeId: String(person.employeeId),
  positionId: String(person.positionId),
  startDate: (person.startDate as string | null | undefined) ?? null,
  endDate: (person.endDate as string | null | undefined) ?? null,
  isManager: person.isManager === true,
  stateId: (person.stateId as string | null | undefined) ?? null,
});

// The values a person is to have in each column a draft sets, by column, as recorded.
function valuesSet(draft: Draft, person: Recorded): [string, unknown][] {
  const fields =
    draft.action === "created"
      ? Object.keys(person)
      : Object.keys(draft.fields);
  return fields.flatMap((field): [string, unknown][] => {
    const fieldId = fieldOfValue(field);
    // The field is the person's own.
    // eslint-disable-next-line security/detect-object-injection
    return fieldId === null ? [] : [[fieldId, person[field]]];
  });
}

const detailNames = new Set([
  "preferredName",
  "employeeId",
  "positionId",
  "startDate",
  "endDate",
  "isManager",
  "stateId",
]);

// Makes the live people as their drafts make them, in as few statements as PostgreSQL allows:
// people added together, removed together, and their columns' values replaced together. Each
// person whose details change is updated on their own.
async function apply(
  transaction: Transaction,
  wanted: ReadonlyMap<string, { draft: Draft; person: Recorded | undefined }>,
): Promise<void> {
  const added: ReturnType<typeof detailColumns>[] = [];
  const removed: string[] = [];
  const replaced: { personId: string; fieldId: string }[] = [];
  const chosen: ReturnType<typeof valueRows> = [];
  for (const [id, { draft, person }] of wanted) {
    if (person === undefined) {
      removed.push(id);
      continue;
    }
    if (draft.action === "created") {
      added.push(detailColumns(id, person));
    } else if (
      Object.keys(draft.fields).some((field) => detailNames.has(field))
    ) {
      const {
        preferredName,
        employeeId,
        positionId,
        startDate,
        endDate,
        isManager,
        stateId,
      } = detailColumns(id, person);
      await transaction
        .update(people)
        .set({
          preferredName,
          employeeId,
          positionId,
          startDate,
          endDate,
          isManager,
          stateId,
        })
        .where(eq(people.id, id));
    }
    for (const [fieldId, value] of valuesSet(draft, person)) {
      replaced.push({ personId: id, fieldId });
      chosen.push(...valueRows(id, fieldId, value, "person"));
    }
  }
  for (const chunk of inChunks(removed)) {
    await transaction.delete(people).where(inArray(people.id, chunk));
  }
  for (const chunk of inChunks(added)) {
    await transaction.insert(people).values(chunk);
  }
  for (const chunk of inChunks(replaced)) {
    await transaction
      .delete(fieldValues)
      .where(
        or(
          ...chunk.map(({ personId, fieldId }) =>
            and(
              eq(fieldValues.personId, personId),
              eq(fieldValues.fieldId, fieldId),
            ),
          ),
        ),
      );
  }
  for (const chunk of inChunks(chosen)) {
    await transaction.insert(fieldValues).values(chunk);
  }
}

async function approvePeopleIn(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  today: string,
): Promise<Change[]> {
  const { columns, found, live } = await readAsked(
    transaction,
    actor,
    ids,
    today,
  );
  const made: Change[] = [];
  const wanted = new Map<
    string,
    { draft: Draft; person: Recorded | undefined }
  >();
  refuseRejected(found.values());
  for (const id of ids) {
    const draft = found.get(id) as Draft;
    const person = drafted(live.get(id), draft);
    wanted.set(id, { draft, person });
    made.push(
      ...personChanges(columns, id, draft.action, live.get(id), person),
    );
  }
  // The choices the people will have, so each can be checked against its column's list.
  const chosen = [...wanted.values()].flatMap(({ person }) =>
    Object.entries(person ?? {}).flatMap(([field, value]) =>
      fieldOfValue(field) !== null && Array.isArray(value)
        ? value.map(String)
        : [],
    ),
  );
  const listOf = new Map(
    (await inListOrder(transaction, chosen)).map(({ id, listId }) => [
      id,
      listId,
    ]),
  );
  for (const { person } of wanted.values()) {
    if (person !== undefined && !fitsColumns(columns, listOf, person)) {
      throw new ConflictError(
        `The draft of ${String(person.preferredName)} no longer fits the columns; change it, then approve it`,
      );
    }
  }
  const removed = ids.filter(
    (id) => live.has(id) && wanted.get(id)?.person === undefined,
  );
  await refuseRemovingManagers(transaction, removed);
  await refuseRemovingHiresPeople(transaction, removed);
  await apply(transaction, wanted);
  await applyReporting(transaction, wanted, today);
  const unmarked = ids.filter(
    (id) =>
      live.get(id)?.isManager === true &&
      wanted.get(id)?.person !== undefined &&
      wanted.get(id)?.person?.isManager !== true,
  );
  await refuseUnmarkingManagers(transaction, unmarked, today, {
    drafted: false,
  });
  await refuseUnmarkingHireManagers(transaction, unmarked, { drafted: false });
  for (const chunk of inChunks([...ids])) {
    await transaction
      .delete(drafts)
      .where(
        and(eq(drafts.recordType, "person"), inArray(drafts.recordId, chunk)),
      );
  }
  return made;
}

// Refuses deciding drafts of a kind whose area the actor's role does not approve.
function refuseBeyondRole(
  actor: Actor,
  kinds: readonly DraftKind[],
  asking: Asking,
): void {
  for (const kind of kinds) {
    // The kind is always one of the fixed list.
    // eslint-disable-next-line security/detect-object-injection
    const permission = approvePermissions[kind];
    if (!actor.permissions.includes(permission)) {
      throw new ForbiddenError(
        // The permission is always one of the fixed list above.
        // eslint-disable-next-line security/detect-object-injection
        `Your role doesn't let you ${asking} drafts of ${approvedAreaNames[permission]}`,
      );
    }
  }
}

// Checks the actor may approve or reject the drafts asked for, after every other change to drafts.
async function deciding(
  transaction: Transaction,
  actor: Actor,
  asked: DraftsRequest,
  asking: Asking,
): Promise<void> {
  refuseBeyondRole(actor, kindsAsked(asked), asking);
  // Lists are seen by those who see configuration, and by those who see people, whose columns
  // draw on them.
  if (asksForLists(asked)) {
    requireAnyPermission(actor, ["configuration:view", "people:view"]);
  }
  // Columns are seen on the People table, with the people's values in them.
  if (asksForColumns(asked)) requirePermission(actor, "people:view");
  // Planned hires are seen beside the people who manage and fill them.
  if (asked.plannedHires.length > 0) requirePermission(actor, "people:view");
  // The plan's records, such as release streams, are seen with the plan or planning configuration.
  if (asked.records.length > 0) {
    requireAnyPermission(actor, ["plan:view", "configuration:view"]);
  }
  await lockDrafts(transaction);
}

// Approves the drafts asked for, with the drafts they use, of any kind, applying them all to the
// live records, and returns the change set that applied them. The plan's records come first, then
// lists and choices, then columns, which may draw on them, then people, who may be given both, then
// planned hires, whose managers are people.
export async function approveDrafts(
  database: Database,
  actor: Actor,
  requested: DraftsRequest,
  asOf?: string,
): Promise<string | null> {
  const today = asOf ?? (await readToday(database));
  try {
    return await database.transaction(async (transaction) => {
      await deciding(transaction, actor, requested, "approve");
      const waiting = await draftKeys(transaction);
      if (requested.people.length > 0) {
        await seenAsked(transaction, actor, requested.people, today);
      }
      await checkHiresAsked(transaction, actor, requested.plannedHires);
      const asked = await withUsedAcross(transaction, requested);
      const made = await approveRecordDrafts(transaction, asked.records);
      if (asksForLists(asked)) {
        made.push(...(await approveListDrafts(transaction, asked)));
      }
      if (asksForColumns(asked)) {
        made.push(...(await approveColumnDrafts(transaction, actor, asked)));
      }
      if (asked.people.length > 0) {
        made.push(
          ...(await approvePeopleIn(transaction, actor, asked.people, today)),
        );
      }
      made.push(
        ...(await approveHiresIn(transaction, actor, asked.plannedHires)),
      );
      const left = await draftKeys(transaction);
      const decided = [...waiting].filter((key) => !left.has(key));
      // The drafts approved with those asked for may belong to other areas.
      refuseBeyondRole(
        actor,
        draftKinds.filter((kind) =>
          decided.some((key) => key.startsWith(`${kind} `)),
        ),
        "approve",
      );
      await refuseOwnDrafts(transaction, actor, decided);
      await recordSensitiveChanges(transaction, actor.user.id, made);
      await recordHiringChanges(transaction, actor.user.id, made);
      return recordChanges(transaction, actor.user.id, made, "approval");
    });
  } catch (error) {
    // A choice deleted, or an Employee ID or name taken, since the draft was saved, or a choice
    // still in use.
    if (
      [
        databaseCodes.uniqueViolation,
        databaseCodes.foreignKeyViolation,
        databaseCodes.restrictViolation,
        databaseCodes.checkViolation,
      ].some((code) => hasDatabaseCode(error, code))
    ) {
      throw new ConflictError(
        "A draft no longer fits the data as it is; refresh, change it, then approve it",
      );
    }
    throw error;
  }
}

// Rejects the drafts asked for, with a reason, and returns the change set that recorded it. A
// rejected draft keeps its reason until it is changed again or discarded.
export async function rejectDrafts(
  database: Database,
  actor: Actor,
  asked: DraftsRequest,
  reason: string,
  asOf?: string,
): Promise<string | null> {
  const today = asOf ?? (await readToday(database));
  return database.transaction(async (transaction) => {
    await deciding(transaction, actor, asked, "reject");
    const seen =
      asked.people.length > 0
        ? await seenAsked(transaction, actor, asked.people, today)
        : undefined;
    await refuseUsedAcross(transaction, asked);
    const made = await rejectRecordDrafts(transaction, asked.records, reason);
    if (asksForLists(asked)) {
      made.push(...(await rejectListDrafts(transaction, asked, reason)));
    }
    if (asksForColumns(asked)) {
      made.push(
        ...(await rejectColumnDrafts(transaction, actor, asked, reason)),
      );
    }
    if (seen !== undefined) {
      made.push(
        ...(await rejectPeopleIn(transaction, asked.people, seen, reason)),
      );
    }
    made.push(
      ...(await rejectHiresIn(transaction, actor, asked.plannedHires, reason)),
    );
    await recordHiringChanges(transaction, actor.user.id, made);
    return recordChanges(transaction, actor.user.id, made, "rejection");
  });
}

// The rejections of the drafts of people asked for, each recorded at its draft's tier, judged with
// the columns drafted to be added, since rejecting leaves those columns' drafts in place.
async function rejectPeopleIn(
  transaction: Transaction,
  ids: readonly string[],
  { columns, found, live }: Seen,
  reason: string,
): Promise<Change[]> {
  const tierOf = personTier(columns);
  const made: Change[] = [];
  for (const id of ids) {
    const draft = found.get(id) as Draft;
    const tier = draftTier(tierOf, live.get(id), draft);
    if (draft.state === "rejected" && draft.reason === reason) continue;
    made.push({
      recordType: "person",
      recordId: id,
      action: "changed",
      field: rejectedField,
      tier,
      oldValue: draft.state === "rejected" ? draft.reason : null,
      newValue: reason,
      draft: true,
    });
  }
  await setRejection(transaction, "person", ids, { state: "rejected", reason });
  return made;
}
