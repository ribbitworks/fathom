// SPDX-License-Identifier: Apache-2.0

// What drafts hold that other changes must respect: the IDs they take, the choices and columns they
// use, and how many values they give a column. Part of the data access layer.

import {
  drafts,
  inChunks,
  people,
  plannedHires,
  privateChanges,
  type Reader,
} from "@fathom/db";
import {
  type AnyColumn,
  and,
  eq,
  inArray,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { columnTableOf } from "@fathom/shared";
import { typeHolding } from "./column-types.ts";
import { planningOwners, valueOwnersOf } from "./values.ts";

// The IDs asked for that another row of the ID column already has, ignoring letter case: a person's
// Employee ID or a planned hire's requisition, live or as a draft makes it, published or not. A live
// ID stays taken until a draft that changes it is approved, so approving drafts one at a time never
// finds two rows with the same one, and an unpublished draft's until it is discarded, so publishing
// never finds it taken. The records excepted are people or hires, whose identifiers never clash.
export async function takenEmployeeIds(
  reader: Reader,
  employeeIds: readonly string[],
  except: readonly string[],
): Promise<string[]> {
  const lowered = [...new Set(employeeIds.map((id) => id.toLowerCase()))];
  const taken = new Set<string>();
  for (const chunk of inChunks(lowered)) {
    const live = await reader
      .select({ value: people.employeeId })
      .from(people)
      .where(
        and(
          inArray(sql`lower(${people.employeeId})`, chunk),
          except.length === 0 ? undefined : notInArray(people.id, [...except]),
        ),
      );
    const liveHires = await reader
      .select({ value: sql<string>`${plannedHires.requisition}` })
      .from(plannedHires)
      .where(
        and(
          inArray(sql`lower(${plannedHires.requisition})`, chunk),
          except.length === 0
            ? undefined
            : notInArray(plannedHires.id, [...except]),
        ),
      );
    for (const { value } of [
      ...live,
      ...liveHires,
      ...(await draftedPersonValues(reader, "employeeId", chunk, except)),
      ...(await draftedTexts(
        reader,
        "planned-hire",
        "requisition",
        chunk,
        except,
      )),
    ]) {
      taken.add(value.toLowerCase());
    }
  }
  return employeeIds.filter((id) => taken.has(id.toLowerCase()));
}

// The values of a person's text field, such as an Employee ID, that drafts of people other than
// those excepted hold, published or not, among those given in lower case.
export const draftedPersonValues = (
  reader: Reader,
  field: string,
  lowered: readonly string[],
  except: readonly string[],
) => draftedTexts(reader, "person", field, lowered, except);

// The values of a text field that drafts of records of the type given, other than those excepted,
// hold, published or not, among those given in lower case.
async function draftedTexts(
  reader: Reader,
  recordType: string,
  field: string,
  lowered: readonly string[],
  except: readonly string[],
): Promise<{ value: string }[]> {
  const found = [];
  for (const table of [drafts, privateChanges]) {
    found.push(
      ...(await reader
        .select({ value: sql<string>`${table.fields}->>${field}::text` })
        .from(table)
        .where(
          and(
            eq(table.recordType, recordType),
            inArray(sql`lower(${table.fields}->>${field}::text)`, [...lowered]),
            except.length === 0
              ? undefined
              : notInArray(table.recordId, [...except]),
          ),
        )),
    );
  }
  return found;
}

// Whether any person's or planned hire's draft, published or not, changes the column, even to clear
// it, or whether a draft of either has the choice given, as a value, or as a position or state. The
// editor's unpublished drafts stand in for the published drafts of the same records, so a draft
// they have changed or discarded but not yet published no longer counts.
export async function draftsUse(
  reader: Reader,
  use: { column: string } | { choice: string },
  editor?: string,
): Promise<boolean> {
  for (const table of [drafts, privateChanges]) {
    const found = await reader
      .select({ one: sql`1` })
      .from(table)
      .where(
        "column" in use
          ? or(
              ...valueOwners.map((recordType) =>
                and(
                  eq(table.recordType, recordType),
                  sql`${table.fields} ? ${`value:${use.column}`}::text`,
                  table === drafts && editor !== undefined
                    ? notReplacedBy(recordType, table.recordId, editor)
                    : undefined,
                ),
              ),
            )
          : or(
              and(
                eq(table.recordType, "person"),
                or(
                  holdsChoice(table.fields, use.choice),
                  sql`${table.fields}->>'positionId' = ${use.choice}`,
                  sql`${table.fields}->>'stateId' = ${use.choice}`,
                ),
                table === drafts && editor !== undefined
                  ? notReplacedBy("person", table.recordId, editor)
                  : undefined,
              ),
              and(
                eq(table.recordType, "planned-hire"),
                or(
                  holdsChoice(table.fields, use.choice),
                  sql`${table.fields}->>'positionId' = ${use.choice}`,
                  sql`${table.fields}->>'stateId' = ${use.choice}`,
                ),
                table === drafts && editor !== undefined
                  ? notReplacedBy("planned-hire", table.recordId, editor)
                  : undefined,
              ),
              ...planningOwners.map((recordType) =>
                and(
                  eq(table.recordType, recordType),
                  holdsChoice(table.fields, use.choice),
                  table === drafts && editor !== undefined
                    ? notReplacedBy(recordType, table.recordId, editor)
                    : undefined,
                ),
              ),
            ),
      )
      .limit(1);
    if (found.length > 0) return true;
  }
  return false;
}

// The kinds of record whose drafts give values in added columns.
const valueOwners = Object.values(valueOwnersOf).flat();

// Whether a draft's fields give a column's value holding the choice.
const holdsChoice = (fields: AnyColumn, choiceId: string) =>
  sql`EXISTS (SELECT 1 FROM jsonb_each(${fields}) AS held(field, value) WHERE jsonb_typeof(held.value) = 'array' AND held.value @> ${JSON.stringify([choiceId])}::jsonb)`;

// Whether the editor holds no unpublished draft of the record whose published draft is given.
const notReplacedBy = (
  recordType: string,
  recordId: AnyColumn,
  editor: string,
) =>
  sql`NOT EXISTS (SELECT 1 FROM ${privateChanges} WHERE ${privateChanges.recordType} = ${recordType} AND ${privateChanges.recordId} = ${recordId} AND ${privateChanges.userId} = ${editor})`;

// How many values a recorded value holds: its choices, or one link, note, number, or ticked box, or
// undefined when none is recorded.
function valueCount(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  return typeHolding(value) === undefined ? undefined : 1;
}

// A column's values as drafts hold them, for checking that the column's settings fit the drafts
// too: for each draft, published or not, that adds or changes a record of the column's table, whether it
// is a hire's, how many values it gives the column, or undefined when it leaves the column as it
// is.
export async function draftedValues(
  reader: Reader,
  columnId: string,
  onTable: unknown,
): Promise<{ hire: boolean; adds: boolean; held: number | undefined }[]> {
  const rows = [];
  for (const table of [drafts, privateChanges]) {
    rows.push(
      ...(await reader
        .select({
          recordType: table.recordType,
          action: table.action,
          value: sql<unknown>`${table.fields} -> ${`value:${columnId}`}::text`,
        })
        .from(table)
        .where(
          and(
            inArray(table.recordType, [
              ...valueOwnersOf[columnTableOf(onTable)],
            ]),
            inArray(table.action, ["created", "changed"]),
          ),
        )),
    );
  }
  return rows.map(({ recordType, action, value }) => ({
    hire: recordType === "planned-hire",
    adds: action === "created",
    held: valueCount(value),
  }));
}
