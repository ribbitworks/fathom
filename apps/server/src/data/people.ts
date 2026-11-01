// SPDX-License-Identifier: Apache-2.0

// People and their details: reading everyone a user may see, with their drafts, and drafting people
// added, one or several pasted at once, changed, and removed, and discarding drafts. Part of the data
// access layer, the only server code that queries the database. Every change is a draft, as
// drafts.ts sets out, which reaches the live people only once approved, as approvals.ts sets out.
// Every change is recorded in the change history, field by field, with each field's tier: a person's
// name and Employee ID are General, their start and end dates Restricted, and each column's values as
// sensitive as its list. Users see and change only the tiers their roles allow, and changes to
// Restricted or Confidential details are also recorded in the access history.

import {
  changes,
  changeSets,
  type Database,
  drafts,
  fieldOfValue,
  inChunks,
  people,
  users,
} from "@fathom/db";
import {
  type Person,
  type PersonChange,
  type PersonDraft,
  type PersonRequest,
  type Tier,
  tierSchema,
} from "@fathom/shared";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  mostSensitive,
  requirePermission,
  requireTierEdit,
  seesTier,
} from "../access.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  type Transaction,
} from "./changes.ts";
import {
  addPersonDrafts,
  asDraft,
  clearedRejection,
  type Draft,
  drafted,
  draftFields,
  draftTier,
  lockPersonDrafts,
  readPersonDrafts,
  type Recorded,
  takenEmployeeIds,
  tidy,
  writePersonDraft,
} from "./drafts.ts";
import { recordEvents } from "./history.ts";
import {
  type ColumnInfo,
  inListOrder,
  readColumns,
  readValues,
  valueField,
} from "./values.ts";

type PersonRow = typeof people.$inferSelect;

export type { Recorded } from "./drafts.ts";

const noPerson = "There is no such person";
const duplicateEmployeeId = "Someone already has that Employee ID";
const toBeRemoved =
  "This person's draft removes them; discard the draft to change them";
const detailFields = [
  "preferredName",
  "employeeId",
  "startDate",
  "endDate",
] as const;

// The tier of each field of a person: dates are Restricted, each column's values are as sensitive
// as its list, and the rest is General. Every value field recorded is for one of the columns given.
export function personTier(columns: readonly ColumnInfo[]) {
  const tiers = new Map<string, Tier>([
    ["startDate", "restricted"],
    ["endDate", "restricted"],
    ...columns.map((column): [string, Tier] => [
      valueField(column.id),
      column.tier,
    ]),
  ]);
  return (field: string): Tier => tiers.get(field) ?? "general";
}

export function recorded(
  row: PersonRow,
  values: ReadonlyMap<string, readonly string[]>,
): Recorded {
  const record: Recorded = {
    preferredName: row.preferredName,
    employeeId: row.employeeId,
    startDate: row.startDate,
    endDate: row.endDate,
  };
  for (const [fieldId, choiceIds] of values) {
    if (choiceIds.length > 0) record[valueField(fieldId)] = [...choiceIds];
  }
  return record;
}

// A person's choices, by column, as recorded.
function valuesOf(person: Recorded): Map<string, string[]> {
  return new Map(
    Object.entries(person).flatMap(([field, value]) => {
      const fieldId = fieldOfValue(field);
      return fieldId === null || !Array.isArray(value)
        ? []
        : [[fieldId, value.map(String)]];
    }),
  );
}

// The changes between two versions of a person, with each field's tier.
export function personChanges(
  columns: readonly ColumnInfo[],
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change[] {
  const fieldNames = [
    ...detailFields,
    ...new Set(
      [...Object.keys(before ?? {}), ...Object.keys(after ?? {})].filter(
        (field) => fieldOfValue(field) !== null,
      ),
    ),
  ];
  return changesBetween(
    "person",
    id,
    action,
    before,
    after,
    fieldNames,
    personTier(columns),
  );
}

// Refuses changes to tiers the actor may not change.
function requireEdits(actor: Actor, made: readonly Change[]): void {
  for (const tier of new Set(made.map((change) => change.tier))) {
    requireTierEdit(actor, tier);
  }
}

// Records, in the access history, each person whose Restricted or Confidential details changed,
// live or in a draft.
export async function recordSensitiveChanges(
  transaction: Pick<Database, "insert">,
  actorId: string | null,
  made: readonly Change[],
): Promise<void> {
  const changed = new Set(
    made
      .filter(
        (change) => change.recordType === "person" && change.tier !== "general",
      )
      .map((change) => change.recordId),
  );
  await recordEvents(
    transaction,
    [...changed].map((subjectId) => ({
      actorId,
      action: "restricted-changed" as const,
      subjectId,
    })),
  );
}

type ChoiceRow = Awaited<ReturnType<typeof inListOrder>>[number];

// Every choice asked for in the requests, in list order, read at once. The drafts lock keeps them
// from being deleted until the drafts holding them are saved.
async function choicesAskedFor(
  transaction: Transaction,
  requests: readonly {
    values?: Readonly<Record<string, readonly string[]>> | undefined;
  }[],
): Promise<ChoiceRow[]> {
  return inListOrder(
    transaction,
    requests.flatMap((request) => Object.values(request.values ?? {}).flat()),
  );
}

// Checks the choices asked for each column, and returns them in list order. Choices a person already
// has stay valid when retired; new ones must be offered.
function checkedValues(
  columns: readonly ColumnInfo[],
  known: readonly ChoiceRow[],
  requested: Readonly<Record<string, readonly string[]>>,
  current: ReadonlyMap<string, readonly string[]> | undefined,
): Map<string, string[]> {
  const checked = new Map<string, string[]>();
  for (const [fieldId, choiceIds] of Object.entries(requested)) {
    const column = columns.find(({ id }) => id === fieldId);
    if (column === undefined) {
      throw new BadRequestError("There is no such column");
    }
    const choices = known.filter(({ id }) => choiceIds.includes(id));
    if (
      choices.length !== choiceIds.length ||
      choices.some(({ listId }) => listId !== column.listId)
    ) {
      throw new BadRequestError(`Choose ${column.name} from the column's list`);
    }
    const had = current?.get(fieldId) ?? [];
    if (
      choices.some(
        ({ id, retired }) =>
          !had.includes(id) && (retired || column.listRetired),
      )
    ) {
      throw new BadRequestError(`Choose a ${column.name} that is offered`);
    }
    if (!column.multiple && choices.length > 1) {
      throw new BadRequestError(`${column.name} takes one choice`);
    }
    checked.set(
      fieldId,
      choices.map(({ id }) => id),
    );
  }
  return checked;
}

// Whether the live people given, as they are now, fit their columns: each value from the column's
// list, one choice unless the column takes several, and a value in every required column. Used after
// an undo or an approval puts people's values in place, since the columns may have changed since.
export async function peopleFitColumns(
  transaction: Transaction,
  personIds: readonly string[],
): Promise<boolean> {
  const present = await transaction
    .select({ id: people.id })
    .from(people)
    .where(inArray(people.id, [...personIds]));
  if (present.length === 0) return true;
  const columns = await readColumns(transaction);
  const values = await readValues(
    transaction,
    present.map(({ id }) => id),
    columns.map(({ id }) => id),
  );
  const choices = await inListOrder(
    transaction,
    [...values.values()].flatMap((byColumn) => [...byColumn.values()].flat()),
  );
  return present.every(({ id }) =>
    columns.every((column) => {
      const chosen = values.get(id)?.get(column.id) ?? [];
      return (
        (!column.required || chosen.length > 0) &&
        (column.multiple || chosen.length <= 1) &&
        chosen.every(
          (choiceId) =>
            choices.find((choice) => choice.id === choiceId)?.listId ===
            column.listId,
        )
      );
    }),
  );
}

// Refuses a person missing a required column's value, or with dates out of order.
function checkComplete(columns: readonly ColumnInfo[], person: Recorded): void {
  for (const column of columns) {
    if (column.required && person[valueField(column.id)] === undefined) {
      throw new BadRequestError(`${column.name} must be filled in`);
    }
  }
  const { startDate, endDate } = person;
  if (
    typeof startDate === "string" &&
    typeof endDate === "string" &&
    endDate < startDate
  ) {
    throw new BadRequestError("The end date cannot be before the start date");
  }
}

// The live people given, as recorded, by person, locked for a change when asked.
export async function readLive(
  reader: Pick<Database, "select">,
  columns: readonly ColumnInfo[],
  ids?: readonly string[],
  lock = false,
): Promise<Map<string, Recorded>> {
  const rows: PersonRow[] = [];
  const read = async (chunk?: readonly string[]) => {
    const query = reader
      .select()
      .from(people)
      .where(chunk === undefined ? undefined : inArray(people.id, [...chunk]))
      .orderBy(people.id);
    rows.push(...(await (lock ? query.for("update") : query)));
  };
  if (ids === undefined) await read();
  else for (const chunk of inChunks([...ids])) await read(chunk);
  const values = await readValues(
    reader,
    rows.map(({ id }) => id),
    columns.map(({ id }) => id),
  );
  return new Map(
    rows.map((row) => [row.id, recorded(row, values.get(row.id) ?? new Map())]),
  );
}

// Who last changed each person's draft, and when, from the changes to it the reader may see, so a
// hidden change reveals nothing. Rejecting a draft does not change it.
async function draftMakers(
  reader: Pick<Database, "selectDistinctOn">,
  ids: readonly string[],
  seen: (field: string, tier: Tier) => boolean,
): Promise<Map<string, { madeBy: string | null; madeAt: Date }>> {
  const makers = new Map<string, { madeBy: string | null; madeAt: Date }>();
  for (const chunk of inChunks([...ids])) {
    // The latest change to each field, so only as many are read as the drafts have fields.
    const rows = await reader
      .selectDistinctOn([changes.recordId, changes.field], {
        recordId: changes.recordId,
        field: changes.field,
        tier: changes.tier,
        madeBy: users.name,
        madeAt: changeSets.madeAt,
        id: changes.id,
      })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .leftJoin(users, eq(users.id, changeSets.madeBy))
      .where(
        and(
          eq(changes.recordType, "person"),
          eq(changes.draft, true),
          ne(changeSets.kind, "rejection"),
          inArray(changes.recordId, chunk),
        ),
      )
      .orderBy(changes.recordId, changes.field, desc(changes.id));
    rows.sort((first, second) => second.id - first.id);
    for (const { recordId, field, tier, madeBy, madeAt } of rows) {
      const recorded = tierSchema.catch("confidential").parse(tier);
      if (!makers.has(recordId) && seen(field, recorded)) {
        makers.set(recordId, { madeBy, madeAt });
      }
    }
  }
  return makers;
}

export interface PeopleRead {
  people: Person[];
  columns: ColumnInfo[];
  // Whether what was read included anyone's Restricted details, which the access history records.
  includedRestricted: boolean;
}

const byName = new Intl.Collator("en", { sensitivity: "base" });

// Whether a person is current on a day: from their start date until their end date passes, or with
// no start date at all.
export function currentOn(person: Recorded, today: string): boolean {
  const { startDate, endDate } = person;
  return (
    (typeof startDate !== "string" || startDate <= today) &&
    (typeof endDate !== "string" || endDate >= today)
  );
}

// Everyone the actor may see, by preferred name, as their drafts make them, with the columns whose
// values they may see, and each draft as they may see it. A person a draft removes is shown as they
// are, with the draft. Users who cannot see Restricted details see only current staff, so the list
// does not reveal anyone's start or end date before it arrives, and receive no dates.
export async function readPeople(
  database: Database,
  actor: Actor,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<PeopleRead> {
  // People and their drafts are read as of one moment, so an approval saved meanwhile is seen
  // whole or not at all.
  return database.transaction(
    (transaction) => readPeopleIn(transaction, actor, today),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

async function readPeopleIn(
  database: Transaction,
  actor: Actor,
  today: string,
): Promise<PeopleRead> {
  const restricted = seesTier(actor, "restricted");
  const allColumns = await readColumns(database);
  const columns = allColumns.filter((column) => seesTier(actor, column.tier));
  const tierOf = personTier(allColumns);
  const shownFields = new Set<string>([
    "preferredName",
    "employeeId",
    ...(restricted ? ["startDate", "endDate"] : []),
    ...columns.map(({ id }) => valueField(id)),
  ]);
  const live = await readLive(database, allColumns);
  const draftsNow = await readPersonDrafts(database);
  const makers = await draftMakers(
    database,
    [...draftsNow.keys()],
    (field, tier) =>
      shownFields.has(field) &&
      seesTier(actor, mostSensitive([tier, tierOf(field)])),
  );
  const ids = [
    ...live.keys(),
    ...[...draftsNow.keys()].filter((id) => !live.has(id)),
  ];
  const shown = ids.flatMap((id): Person[] => {
    const before = live.get(id);
    const draft = draftsNow.get(id);
    // A draft that removes someone shows them as they are; one that adds nobody is never kept.
    const person = drafted(before, draft) ?? before;
    // Who is current comes from the live dates while a draft waits, so a draft changing only
    // Restricted dates reveals nothing.
    if (
      person === undefined ||
      (!restricted && !currentOn(before ?? person, today))
    ) {
      return [];
    }
    const seen = draft && seenDraft(id, before, draft);
    return [
      {
        id,
        preferredName: String(person.preferredName),
        employeeId: String(person.employeeId),
        ...(restricted
          ? {
              startDate: (person.startDate as string | null) ?? null,
              endDate: (person.endDate as string | null) ?? null,
            }
          : {}),
        values: Object.fromEntries(
          [...valuesOf(person)].filter(([fieldId]) =>
            shownFields.has(valueField(fieldId)),
          ),
        ),
        ...(seen ? { draft: seen } : {}),
      },
    ];
  });

  // The draft as the actor may see it, or undefined when it changes nothing they see.
  function seenDraft(
    id: string,
    before: Recorded | undefined,
    draft: Draft,
  ): PersonDraft | undefined {
    // In a fixed order, since drafts are stored without one: the details, then the columns.
    const rank = (field: string) => {
      const at = detailFields.indexOf(field as (typeof detailFields)[number]);
      return at === -1 ? detailFields.length : at;
    };
    const fields = draftFields(before, draft)
      .filter((field) => shownFields.has(field))
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    if (fields.length === 0) return undefined;
    const liveValues: PersonDraft["live"] = { values: {} };
    if (before !== undefined) {
      for (const field of fields) {
        const fieldId = fieldOfValue(field);
        // The fields are the person's own, named just above.
        /* eslint-disable security/detect-object-injection */
        if (fieldId === null) {
          Object.assign(liveValues, { [field]: before[field] ?? null });
        } else {
          const chosen = before[field];
          liveValues.values[fieldId] = Array.isArray(chosen)
            ? chosen.map(String)
            : [];
        }
        /* eslint-enable security/detect-object-injection */
      }
    }
    const maker = makers.get(id);
    const reason =
      draft.state === "rejected" &&
      draft.reason !== null &&
      seesTier(actor, draftTier(tierOf, before, draft))
        ? { reason: draft.reason }
        : {};
    return {
      action: draft.action,
      changed: fields.map((field) => fieldOfValue(field) ?? field),
      live: liveValues,
      state: draft.state,
      ...reason,
      madeBy: maker?.madeBy ?? null,
      madeAt: maker?.madeAt.toISOString() ?? null,
    };
  }

  shown.sort(
    (a, b) =>
      byName.compare(a.preferredName, b.preferredName) ||
      a.id.localeCompare(b.id),
  );
  return {
    people: shown,
    columns,
    includedRestricted:
      shown.length > 0 &&
      (restricted || columns.some(({ tier }) => tier !== "general")),
  };
}

// Refuses Employee IDs that someone else has, live or in a draft, or that two of the people asked
// for share.
async function refuseTakenIds(
  transaction: Transaction,
  employeeIds: readonly string[],
  except: readonly string[],
): Promise<void> {
  const lowered = employeeIds.map((id) => id.toLowerCase());
  if (
    new Set(lowered).size !== lowered.length ||
    (await takenEmployeeIds(transaction, employeeIds, except)).length > 0
  ) {
    throw new ConflictError(duplicateEmployeeId);
  }
}

// Drafts adding people, all saved together, and returns them with the change set they were saved in.
export async function createPeople(
  database: Database,
  actor: Actor,
  requests: readonly PersonRequest[],
): Promise<{ ids: string[]; changeSetId: string | null }> {
  requirePermission(actor, "people:edit");
  return database.transaction(async (transaction) => {
    await lockPersonDrafts(transaction);
    const columns = await readColumns(transaction, true);
    const known = await choicesAskedFor(transaction, requests);
    const made: Change[] = [];
    const added: { id: string; fields: Recorded }[] = [];
    for (const request of requests) {
      const id = randomUUID();
      const values = checkedValues(columns, known, request.values, undefined);
      const row: PersonRow = {
        id,
        preferredName: request.preferredName,
        employeeId: request.employeeId,
        startDate: request.startDate ?? null,
        endDate: request.endDate ?? null,
      };
      const after = recorded(row, values);
      checkComplete(columns, after);
      made.push(...personChanges(columns, id, "created", undefined, after));
      added.push({ id, fields: after });
    }
    requireEdits(actor, made);
    await refuseTakenIds(
      transaction,
      requests.map(({ employeeId }) => employeeId),
      [],
    );
    await addPersonDrafts(transaction, added);
    const drafts = asDraft(made);
    await recordSensitiveChanges(transaction, actor.user.id, drafts);
    return {
      ids: added.map(({ id }) => id),
      changeSetId: await recordChanges(transaction, actor.user.id, drafts),
    };
  });
}

// A person as they are and as their draft makes them, locked for a change, refusing someone who is
// neither live nor in a draft.
async function lockDrafted(
  transaction: Transaction,
  columns: readonly ColumnInfo[],
  id: string,
): Promise<{
  before: Recorded | undefined;
  draft: Draft | undefined;
  person: Recorded | undefined;
}> {
  const before = (await readLive(transaction, columns, [id], true)).get(id);
  const draft = (await readPersonDrafts(transaction, [id])).get(id);
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
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  return database.transaction(async (transaction) => {
    await lockPersonDrafts(transaction);
    const columns = await readColumns(transaction, true);
    const { before, draft, person } = await lockDrafted(
      transaction,
      columns,
      id,
    );
    if (person === undefined) {
      if (before === undefined) throw new NotFoundError(noPerson);
      throw new ConflictError(toBeRemoved);
    }
    const current = valuesOf(person);
    const changedValues = checkedValues(
      columns,
      await choicesAskedFor(transaction, [change]),
      change.values ?? {},
      current,
    );
    const details = Object.fromEntries(
      detailFields.flatMap((field) =>
        // The field is one of the fixed details named above.
        // eslint-disable-next-line security/detect-object-injection
        change[field] === undefined ? [] : [[field, change[field]]],
      ),
    );
    // Columns left with nothing chosen are left out.
    const after = tidy({
      ...person,
      ...details,
      ...Object.fromEntries(
        [...changedValues].map(([fieldId, choiceIds]) => [
          valueField(fieldId),
          choiceIds,
        ]),
      ),
    });
    checkComplete(columns, after);
    const made = personChanges(columns, id, "changed", person, after);
    requireEdits(actor, made);
    if (made.length === 0) return null;
    if (change.employeeId !== undefined) {
      await refuseTakenIds(transaction, [change.employeeId], [id]);
    }
    const all = [
      ...asDraft(made),
      ...clearedRejection(id, personTier(columns), before, draft),
    ];
    await writePersonDraft(transaction, id, before, after);
    await recordSensitiveChanges(transaction, actor.user.id, all);
    return recordChanges(transaction, actor.user.id, all);
  });
}

// Drafts removing a person entered by mistake, recording everything they held; removing someone
// only drafted to be added discards that draft. People who leave are given an end date instead.
// Nothing uses people yet; later slices refuse to remove a person who is, for example, on a team.
export async function deletePerson(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  return database.transaction(async (transaction) => {
    await lockPersonDrafts(transaction);
    const columns = await readColumns(transaction, true);
    const { before, draft, person } = await lockDrafted(
      transaction,
      columns,
      id,
    );
    // Already drafted to be removed.
    if (person === undefined) return null;
    const made = [
      ...asDraft(personChanges(columns, id, "deleted", person, undefined)),
      ...clearedRejection(id, personTier(columns), before, draft),
    ];
    requireEdits(actor, made);
    await writePersonDraft(transaction, id, before, undefined);
    await recordSensitiveChanges(transaction, actor.user.id, made);
    return recordChanges(
      transaction,
      actor.user.id,
      made,
      before === undefined ? "discard" : "edit",
    );
  });
}

// Sends a rejected draft for approval again, unchanged, clearing its reason.
export async function resubmitPersonDraft(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  return database.transaction(async (transaction) => {
    await lockPersonDrafts(transaction);
    const columns = await readColumns(transaction, true);
    const { before, draft } = await lockDrafted(transaction, columns, id);
    if (draft?.state !== "rejected") {
      throw new ConflictError(
        "Only a rejected draft is sent for approval again",
      );
    }
    const made = clearedRejection(id, personTier(columns), before, draft);
    requireEdits(actor, made);
    await transaction
      .update(drafts)
      .set({ state: "waiting", reason: null })
      .where(and(eq(drafts.recordType, "person"), eq(drafts.recordId, id)));
    await recordSensitiveChanges(transaction, actor.user.id, made);
    return recordChanges(transaction, actor.user.id, made, "resubmission");
  });
}

// Discards a person's draft, so they are as they are live, or, for someone only drafted to be added,
// gone.
export async function discardPersonDraft(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  return database.transaction(async (transaction) => {
    await lockPersonDrafts(transaction);
    const columns = await readColumns(transaction, true);
    const { before, draft, person } = await lockDrafted(
      transaction,
      columns,
      id,
    );
    if (draft === undefined) {
      throw new NotFoundError("This person has no draft");
    }
    let action: Change["action"] = "changed";
    if (person === undefined) action = "created";
    else if (before === undefined) action = "deleted";
    const made = [
      ...asDraft(personChanges(columns, id, action, person, before)),
      ...clearedRejection(id, personTier(columns), before, draft),
    ];
    requireEdits(actor, made);
    await writePersonDraft(transaction, id, before, before);
    await recordSensitiveChanges(transaction, actor.user.id, made);
    return recordChanges(transaction, actor.user.id, made, "discard");
  });
}
