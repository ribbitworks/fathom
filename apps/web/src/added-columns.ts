// SPDX-License-Identifier: Apache-2.0

// The columns added to a table and the values its records hold in them, which any table that takes
// added columns treats alike: each column's cells, a change applied to a record as the table shows
// it before it is saved, and the values a new record is given.

import { columnClass, type Field, type List } from "@fathom/shared";
import type { CellChange, CellSource } from "./cell-kinds.tsx";
import { cellColumn } from "./grid-columns.tsx";
import type { CellRecord, Column } from "./record-table.ts";

// The added columns a table shows, in the order and as the Draft menu's choice makes them.
export interface AddedColumns {
  fields: readonly Field[];
  lists: readonly List[];
  order: readonly string[];
}

// Values asked for, by column, without those removed.
export const kept = <Value>(
  asked: Readonly<Record<string, Value | null>>,
): Record<string, Value> =>
  Object.fromEntries(
    Object.entries(asked).flatMap(([key, value]) =>
      value === null ? [] : [[key, value]],
    ),
  );

// A column's type is the kind of its cells, and its choices and class are those of the list it
// draws on, unless it has a class of its own.
export const addedColumn = <Rec extends CellRecord, Change extends CellChange>(
  field: Field,
  lists: readonly List[],
): Column<Rec, Change> => {
  const list = lists.find(({ id }) => id === field.listId);
  return {
    ...cellColumn<Rec, Change>(field.id, field.type, {
      label: field.name,
      required: field.required,
      field,
      choices: list?.choices ?? [],
      multiple: field.multiple,
    }),
    dataClass: columnClass(field, list),
  };
};

// A record's values in added columns with a change applied, as the table shows them before it is
// saved.
export const withCellChange = (
  record: Pick<CellSource, "values" | "links" | "notes" | "numbers">,
  { values, links, notes, numbers }: CellChange,
) => ({
  values: { ...record.values, ...values },
  links: kept({ ...record.links, ...links }),
  ...(record.notes === undefined && notes === undefined
    ? {}
    : { notes: kept({ ...record.notes, ...notes }) }),
  ...(record.numbers === undefined && numbers === undefined
    ? {}
    : { numbers: kept({ ...record.numbers, ...numbers }) }),
});

// What a new record is given in columns of one value, left out when it is given none.
function askedOf<Held>(
  parts: readonly (Record<string, Held> | undefined)[],
): Record<string, Held> | undefined {
  const entries = parts.flatMap((part) => Object.entries(part ?? {}));
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}

// The values a new record is given, from each column's change, with no link left empty.
export function cellRequest(parts: readonly CellChange[]) {
  const notes = askedOf(parts.map((part) => part.notes));
  const numbers = askedOf(parts.map((part) => part.numbers));
  return {
    values: Object.assign({}, ...parts.map((part) => part.values)) as Record<
      string,
      string[]
    >,
    links: kept(
      Object.assign({}, ...parts.map((part) => part.links)) as NonNullable<
        CellChange["links"]
      >,
    ),
    ...(notes === undefined ? {} : { notes }),
    ...(numbers === undefined ? {} : { numbers }),
  };
}
