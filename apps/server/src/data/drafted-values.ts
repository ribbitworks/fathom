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
  type SQL,
  and,
  eq,
  inArray,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { columnTableOf, isLink } from "@fathom/shared";
import { isNote, isNumber } from "./column-types.ts";
import { planningOwners, valueOwnersOf } from "./values.ts";
import { asSeenBy, ownFieldsSeen, publishedFieldsSeen } from "./drafts.ts";

// The IDs asked for that another row of the ID column already has, ignoring letter case: a person's
// Employee ID or a planned hire's requisition, live or as a published draft makes it. A live ID
// stays taken until a draft that changes it is approved, so approving drafts one at a time never
// finds two rows with the same one. With an editor, their own private changes take IDs too, and
// nobody else's do, so publishing checks again. The records excepted are people or hires, whose
// identifiers never clash.
export async function takenEmployeeIds(
  reader: Reader,
  employeeIds: readonly string[],
  except: readonly string[],
  editor: string | undefined,
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
      ...(await draftedPersonValues(
        reader,
        "employeeId",
        chunk,
        except,
        editor,
      )),
      ...(await draftedTexts(
        reader,
        "planned-hire",
        "requisition",
        chunk,
        except,
        editor,
      )),
    ]) {
      taken.add(value.toLowerCase());
    }
  }
  return employeeIds.filter((id) => taken.has(id.toLowerCase()));
}

// The values of a person's text field, such as an Employee ID, that drafts of people other than
// those excepted hold, as the editor, when given, sees the drafts, among those given in lower case.
export const draftedPersonValues = (
  reader: Reader,
  field: string,
  lowered: readonly string[],
  except: readonly string[],
  editor: string | undefined,
) => draftedTexts(reader, "person", field, lowered, except, editor);

// The values of a text field that drafts of records of the type given, other than those excepted,
// hold, among those given in lower case, as the editor, when given, sees the drafts.
async function draftedTexts(
  reader: Reader,
  recordType: string,
  field: string,
  lowered: readonly string[],
  except: readonly string[],
  editor: string | undefined,
): Promise<{ value: string }[]> {
  const found = [];
  for (const table of editor === undefined
    ? [drafts]
    : [drafts, privateChanges]) {
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
            asSeenBy(table, editor, field),
          ),
        )),
    );
  }
  return found;
}

// Whether any person's or planned hire's draft, as the editor sees the drafts, changes the column,
// even to clear it, or whether a draft of either has the choice given, as a value, or as a position
// or state. The editor's private changes stand in for the published drafts of the same records, and
// nobody else's count.
export async function draftsUse(
  reader: Reader,
  use: { column: string } | { choice: string },
  editor: string | undefined,
): Promise<boolean> {
  for (const table of editor === undefined
    ? [drafts]
    : [drafts, privateChanges]) {
    // A choice may be in any of a record's fields, so it is looked for in the fields the editor sees:
    // a published draft's that their own change doesn't hold, and their own change's.
    const choiceSeen = table === drafts ? undefined : asSeenBy(table, editor);
    const seen = table === drafts ? publishedFieldsSeen(editor) : ownFieldsSeen;
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
                  asSeenBy(table, editor, `value:${use.column}`),
                ),
              ),
            )
          : or(
              and(
                eq(table.recordType, "person"),
                or(
                  holdsChoice(seen, use.choice),
                  sql`${seen}->>'positionId' = ${use.choice}`,
                  sql`${seen}->>'stateId' = ${use.choice}`,
                ),
                choiceSeen,
              ),
              and(
                eq(table.recordType, "planned-hire"),
                or(
                  holdsChoice(seen, use.choice),
                  sql`${seen}->>'positionId' = ${use.choice}`,
                  sql`${seen}->>'stateId' = ${use.choice}`,
                ),
                choiceSeen,
              ),
              ...planningOwners.map((recordType) =>
                and(
                  eq(table.recordType, recordType),
                  holdsChoice(seen, use.choice),
                  choiceSeen,
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
const holdsChoice = (fields: AnyColumn | SQL, choiceId: string) =>
  sql`EXISTS (SELECT 1 FROM jsonb_each(${fields}) AS held(field, value) WHERE jsonb_typeof(held.value) = 'array' AND held.value @> ${JSON.stringify([choiceId])}::jsonb)`;

// How many values a recorded value holds: its choices, or one link, note, or number, or undefined
// when none is recorded.
function valueCount(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (isLink(value) || isNote(value) || isNumber(value)) return 1;
  return undefined;
}

// A column's values as drafts hold them, for checking that the column's settings fit the drafts
// too: for each draft, as the editor, when given, sees the drafts, that adds or changes a record of
// the column's table, whether it is a hire's, how many values it gives the column, or undefined when
// it leaves the column as it is.
export async function draftedValues(
  reader: Reader,
  columnId: string,
  onTable: unknown,
  editor: string | undefined,
): Promise<{ hire: boolean; adds: boolean; held: number | undefined }[]> {
  const field = `value:${columnId}`;
  const rows = [];
  for (const table of editor === undefined
    ? [drafts]
    : [drafts, privateChanges]) {
    rows.push(
      ...(await reader
        .select({
          recordType: table.recordType,
          action: table.action,
          value: sql<unknown>`${table.fields} -> ${field}::text`,
        })
        .from(table)
        .where(
          and(
            inArray(table.recordType, [
              ...valueOwnersOf[columnTableOf(onTable)],
            ]),
            inArray(table.action, ["created", "changed"]),
            asSeenBy(table, editor, field),
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
