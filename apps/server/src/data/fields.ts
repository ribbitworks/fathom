// SPDX-License-Identifier: Apache-2.0

// The columns people add to People and Features: checking a column's settings against the records'
// values, and deleting a live column with its values. Part of the data access layer.

import {
  features,
  fields,
  fieldValues,
  lists,
  people,
  plannedHires,
} from "@fathom/db";
import type { FieldRequest } from "@fathom/shared";
import {
  and,
  asc,
  count,
  countDistinct,
  eq,
  gt,
  isNotNull,
  isNull,
} from "drizzle-orm";
import { BadRequestError, ConflictError } from "../errors.ts";
import { type Change, changesBetween, type Transaction } from "./changes.ts";
import { draftedValues } from "./drafted-values.ts";
import { hireChanges, readHireTier } from "./hire-fields.ts";
import { personChanges } from "./person-fields.ts";
import {
  type FieldRow,
  readColumns,
  readValues,
  valueField,
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
] as const;

export const fieldChanges = (
  id: string,
  action: Change["action"],
  before: FieldRow | undefined,
  after: FieldRow | undefined,
) => changesBetween("field", id, action, before, after, fieldFields);

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

// Refuses a live list that does not exist or is retired, since a retired list is no longer offered.
export async function checkLiveList(transaction: Transaction, listId: string) {
  const [list] = await transaction
    .select({ retired: lists.retired })
    .from(lists)
    .where(eq(lists.id, listId))
    .for("share");
  if (list === undefined) throw new BadRequestError("There is no such list");
  if (list.retired) {
    throw new BadRequestError("Choose a list that is not retired");
  }
}

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
  const inDrafts = await draftedValues(transaction, field.id, field.tableName);
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
    const onFeatures = field.tableName === "features";
    const everyone = await totalOf(
      onFeatures
        ? transaction
            .select({ total: count() })
            .from(features)
            // A project's general feature has no name, and is never shown with these columns.
            .where(isNotNull(features.name))
        : transaction.select({ total: count() }).from(people),
    );
    const filled = await totalOf(
      transaction
        .select({
          total: countDistinct(
            onFeatures ? fieldValues.featureId : fieldValues.personId,
          ),
        })
        .from(fieldValues)
        .where(eq(fieldValues.fieldId, field.id)),
    );
    const missing = everyone - filled;
    if (missing > 0) {
      const have = onFeatures ? featuresHave(missing) : peopleHave(missing);
      throw new ConflictError(
        `${have} no ${field.name}, so it cannot be required yet`,
      );
    }
  }
  if (!request.multiple && field.multiple) {
    const several = await transaction
      .select({
        personId: fieldValues.personId,
        featureId: fieldValues.featureId,
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
      )
      .having(gt(count(), 1));
    const people = several.filter(({ personId }) => personId !== null).length;
    if (people > 0) {
      throw new ConflictError(
        `${peopleHave(people)} several choices for ${field.name}, so it cannot take only one yet`,
      );
    }
    const featuresHolding = several.filter(
      ({ featureId }) => featureId !== null,
    ).length;
    if (featuresHolding > 0) {
      throw new ConflictError(
        `${featuresHave(featuresHolding)} several choices for ${field.name}, so it cannot take only one yet`,
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
    })
    .from(fieldValues)
    .where(eq(fieldValues.fieldId, id));
  const featureIds = holders.flatMap(({ featureId }) =>
    featureId === null ? [] : [featureId],
  );
  const featureValues = await readValues(
    transaction,
    featureIds,
    [id],
    "feature",
  );
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
    ...featureIds.flatMap((featureId) =>
      changesBetween(
        "feature",
        featureId,
        "changed",
        { [valueField(id)]: featureValues.get(featureId)?.get(id) },
        {},
        [valueField(id)],
      ),
    ),
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
