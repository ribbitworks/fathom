// SPDX-License-Identifier: Apache-2.0

// The columns people add to People, Features and Activities: checking a column's settings against
// the records' values, and deleting a live column with its values. Part of the data access layer.

import {
  activities,
  features,
  fields,
  fieldValues,
  lists,
  people,
  plannedHires,
} from "@fathom/db";
import {
  type ColumnTable,
  columnTableOf,
  type FieldRequest,
} from "@fathom/shared";
import {
  and,
  asc,
  count,
  countDistinct,
  eq,
  gt,
  inArray,
  isNull,
} from "drizzle-orm";
import { BadRequestError, ConflictError } from "../errors.ts";
import { type Change, changesBetween, type Transaction } from "./changes.ts";
import { draftedValues } from "./drafted-values.ts";
import { hireChanges, readHireTier } from "./hire-fields.ts";
import { personChanges } from "./person-fields.ts";
import {
  type FieldRow,
  ownerColumn,
  ownerKey,
  type PlanningOwner,
  planningOwners,
  planningTableOf,
  readColumns,
  readValues,
  valueField,
  valueOwnersOf,
} from "./values.ts";

export const fieldFields = [
  "tableName",
  "name",
  "type",
  "listId",
  "visibility",
  "multiple",
  "required",
  "onPlannedHires",
  "multiline",
] as const;

// A column as the change history records it: Several lines only where it is set, so other columns
// record nothing for it.
export const recordedColumn = (row: FieldRow | undefined) =>
  row && { ...row, multiline: row.multiline || undefined };

export const fieldChanges = (
  id: string,
  action: Change["action"],
  before: FieldRow | undefined,
  after: FieldRow | undefined,
) =>
  changesBetween(
    "field",
    id,
    action,
    recordedColumn(before),
    recordedColumn(after),
    fieldFields,
  );

// Every column on people, locked.
export async function lockFields(
  transaction: Transaction,
): Promise<FieldRow[]> {
  return transaction
    .select()
    .from(fields)
    .where(eq(fields.tableName, "people"))
    .orderBy(asc(fields.id))
    .for("update");
}

// Refuses live lists that do not exist or are retired, since a retired list is no longer offered,
// read in one query.
export async function checkLiveLists(
  transaction: Transaction,
  listIds: readonly string[],
) {
  const wanted = [...new Set(listIds)];
  const found = await transaction
    .select({ retired: lists.retired })
    .from(lists)
    .where(inArray(lists.id, wanted))
    .for("share");
  if (found.length < wanted.length) {
    throw new BadRequestError("There is no such list");
  }
  if (found.some(({ retired }) => retired)) {
    throw new BadRequestError("Choose a list that is not retired");
  }
}

export const checkLiveList = (transaction: Transaction, listId: string) =>
  checkLiveLists(transaction, [listId]);

// The total a count query found.
async function totalOf(query: Promise<{ total: number }[]>): Promise<number> {
  return (await query).reduce((sum, { total }) => sum + total, 0);
}

// A number of records in words, with the verb that follows.
const have = (total: number, one: string, several: string) =>
  total === 1 ? `1 ${one} has` : `${String(total)} ${several} have`;

export const peopleHave = (total: number) => have(total, "person", "people");
export const hiresHave = (total: number) =>
  have(total, "planned hire", "planned hires");
export const featuresHave = (total: number) =>
  have(total, "feature", "features");
const activitiesHave = (total: number) => have(total, "activity", "activities");
const rowsHave = (total: number) => have(total, "row", "rows");

// The record of planned work a value row is held by.
const heldBy = (
  row: Readonly<Record<"featureId" | "activityId", string | null>>,
  owner: PlanningOwner,
) => row[ownerKey(owner)];

// Each table's own records, which a required column needs a value from, and how many lack one is
// said.
const recordsOf: Readonly<
  Record<
    ColumnTable,
    {
      records: typeof people | typeof features | typeof activities;
      have: (total: number) => string;
    }
  >
> = {
  people: { records: people, have: peopleHave },
  features: { records: features, have: featuresHave },
  activities: { records: activities, have: activitiesHave },
};

// Refuses settings that the people and planned hires already in Fathom, live or in drafts, do not
// meet: a required column that someone has no value for, one choice where anyone has several, or a
// column switched off for planned hires while any has a value in it. A value is never required of a
// planned hire, and a filled hire, which has left People and cannot be changed, keeps its values as
// they were without holding back any change. A draft that changes someone without changing the
// column keeps their live value. The caller checks the list, which a draft may draw from before it
// is approved.
export async function checkValuesFit(
  transaction: Transaction,
  field: FieldRow,
  request: Pick<FieldRequest, "multiple" | "required"> & {
    listId?: string | null | undefined;
    onPlannedHires?: boolean | undefined;
  },
): Promise<void> {
  // A private page's column is never drafted, nor are its rows.
  const inDrafts =
    field.pageId === null
      ? await draftedValues(transaction, field.id, field.tableName)
      : [];
  const listChanges = (request.listId ?? null) !== field.listId;
  if (
    request.required &&
    inDrafts.some(
      ({ hire, adds, held }) =>
        // A draft adding someone holds only the columns with values.
        !hire && (adds ? held === undefined : held === 0),
    )
  ) {
    throw new ConflictError(
      `Drafts leave ${field.name} empty, so it cannot be required yet`,
    );
  }
  if (!request.multiple && inDrafts.some(({ held }) => (held ?? 0) > 1)) {
    throw new ConflictError(
      `Drafts have several choices for ${field.name}, so it cannot take only one yet`,
    );
  }
  if (listChanges && inDrafts.some(({ held }) => (held ?? 0) > 0)) {
    throw new ConflictError(
      `Drafts have values from the list of ${field.name}, so its list cannot change`,
    );
  }
  const switchedOff = request.onPlannedHires === false && field.onPlannedHires;
  if (
    switchedOff &&
    inDrafts.some(({ hire, held }) => hire && (held ?? 0) > 0)
  ) {
    throw new ConflictError(
      `Drafts give planned hires values in ${field.name}, so it cannot be switched off for planned hires yet`,
    );
  }
  if (request.required && !field.required) {
    const table = columnTableOf(field.tableName);
    // The table is always one of the fixed tables.
    // eslint-disable-next-line security/detect-object-injection
    const { records, have: haveNone } = recordsOf[table];
    const everyone = await totalOf(
      transaction.select({ total: count() }).from(records),
    );
    const filled = await totalOf(
      transaction
        .select({
          // The table is always one of the fixed tables.
          // eslint-disable-next-line security/detect-object-injection
          total: countDistinct(ownerColumn(valueOwnersOf[table][0])),
        })
        .from(fieldValues)
        .where(eq(fieldValues.fieldId, field.id)),
    );
    const missing = everyone - filled;
    if (missing > 0) {
      const have = haveNone(missing);
      throw new ConflictError(
        `${have} no ${field.name}, so it cannot be required yet`,
      );
    }
  }
  if (!request.multiple && field.multiple) {
    const several = await transaction
      .select({
        personId: fieldValues.personId,
        plannedHireId: fieldValues.plannedHireId,
        featureId: fieldValues.featureId,
        activityId: fieldValues.activityId,
        privateRowId: fieldValues.privateRowId,
      })
      .from(fieldValues)
      .leftJoin(plannedHires, eq(plannedHires.id, fieldValues.plannedHireId))
      .where(
        and(eq(fieldValues.fieldId, field.id), isNull(plannedHires.filledBy)),
      )
      .groupBy(
        fieldValues.personId,
        fieldValues.plannedHireId,
        fieldValues.featureId,
        fieldValues.activityId,
        fieldValues.privateRowId,
      )
      .having(gt(count(), 1));
    const people = several.filter(({ personId }) => personId !== null).length;
    if (people > 0) {
      throw new ConflictError(
        `${peopleHave(people)} several choices for ${field.name}, so it cannot take only one yet`,
      );
    }
    for (const owner of planningOwners) {
      const holding = several.filter((row) => heldBy(row, owner) !== null);
      if (holding.length > 0) {
        throw new ConflictError(
          // The owner is always one of the fixed kinds.
          // eslint-disable-next-line security/detect-object-injection
          `${recordsOf[planningTableOf[owner]].have(holding.length)} several choices for ${field.name}, so it cannot take only one yet`,
        );
      }
    }
    const rows = several.filter(
      ({ privateRowId }) => privateRowId !== null,
    ).length;
    if (rows > 0) {
      throw new ConflictError(
        `${rowsHave(rows)} several choices for ${field.name}, so it cannot take only one yet`,
      );
    }
    if (several.length > 0) {
      throw new ConflictError(
        `${hiresHave(several.length)} several choices for ${field.name}, so it cannot take only one yet`,
      );
    }
  }
  if (listChanges) {
    const used = await totalOf(
      transaction
        .select({ total: count() })
        .from(fieldValues)
        .leftJoin(plannedHires, eq(plannedHires.id, fieldValues.plannedHireId))
        .where(
          and(eq(fieldValues.fieldId, field.id), isNull(plannedHires.filledBy)),
        ),
    );
    if (used > 0) {
      throw new ConflictError(
        `${field.name} has values from its list, so its list cannot change`,
      );
    }
  }
  if (switchedOff) {
    const holding = await totalOf(
      transaction
        .select({ total: countDistinct(fieldValues.plannedHireId) })
        .from(fieldValues)
        .innerJoin(plannedHires, eq(plannedHires.id, fieldValues.plannedHireId))
        .where(
          and(eq(fieldValues.fieldId, field.id), isNull(plannedHires.filledBy)),
        ),
    );
    if (holding > 0) {
      throw new ConflictError(
        `${hiresHave(holding)} values in ${field.name}, so it cannot be switched off for planned hires yet. Clear them first.`,
      );
    }
  }
}

// Deletes a live column and its values, as approving its removal does, and returns the changes to
// record: the column's, and each person's and planned hire's values in it, with their tiers, which
// the caller checks the actor may see.
export async function deleteLiveField(
  transaction: Transaction,
  id: string,
): Promise<Change[]> {
  // Approved only for a live column.
  const [before] = (await transaction
    .select()
    .from(fields)
    .where(eq(fields.id, id))
    .for("update")) as [FieldRow];
  const columns = await readColumns(transaction);
  const holders = await transaction
    .selectDistinct({
      personId: fieldValues.personId,
      plannedHireId: fieldValues.plannedHireId,
      featureId: fieldValues.featureId,
      activityId: fieldValues.activityId,
    })
    .from(fieldValues)
    .where(eq(fieldValues.fieldId, id));
  const planned: Change[] = [];
  for (const owner of planningOwners) {
    const ownerIds = holders.flatMap((holder) => {
      const held = heldBy(holder, owner);
      return held === null ? [] : [held];
    });
    const held = await readValues(transaction, ownerIds, [id], owner);
    planned.push(
      ...ownerIds.flatMap((ownerId) =>
        changesBetween(
          owner,
          ownerId,
          "changed",
          { [valueField(id)]: held.get(ownerId)?.get(id) },
          {},
          [valueField(id)],
        ),
      ),
    );
  }
  const personIds = holders.flatMap(({ personId }) =>
    personId === null ? [] : [personId],
  );
  const hireIds = holders.flatMap(({ plannedHireId }) =>
    plannedHireId === null ? [] : [plannedHireId],
  );
  const values = await readValues(transaction, personIds, [id], "person");
  const hireValues = await readValues(
    transaction,
    hireIds,
    [id],
    "planned-hire",
  );
  const hireTier = await readHireTier(transaction, columns);
  const valueChanges = [
    ...planned,
    ...personIds.flatMap((personId) =>
      personChanges(
        columns,
        personId,
        "changed",
        { [valueField(id)]: values.get(personId)?.get(id) },
        {},
      ),
    ),
    ...hireIds.flatMap((hireId) =>
      hireChanges(
        hireId,
        "changed",
        { [valueField(id)]: hireValues.get(hireId)?.get(id) },
        {},
        hireTier,
      ),
    ),
  ];
  await transaction.delete(fields).where(eq(fields.id, id));
  // The column's key stays in the order, so it would come back in its place.
  return [...fieldChanges(id, "deleted", before, undefined), ...valueChanges];
}
