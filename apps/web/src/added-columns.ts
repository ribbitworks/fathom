// SPDX-License-Identifier: Apache-2.0

// The columns added to a table and the values its records hold in them, which any table that takes
// added columns treats alike: each column's cells, a change applied to a record as the table shows
// it before it is saved, and the values a new record is given.

import {
  type ColumnValue,
  type ColumnValueMap,
  columnClass,
  columnValueMaps,
  columnValueMapsOf,
  type Field,
  type List,
  type DurationUnit,
  durationUnitSchema,
  monthOf,
  unitDays,
  optionalColumnValueMaps,
  requestedColumnValueMapsOf,
  type SomeColumnValues,
  type SomeRequestedColumnValues,
  textLimit,
} from "@fathom/shared";
import { type CellChange, type CellSource, cellKinds } from "./cell-kinds.tsx";
import {
  durationUnitsShown,
  lengthDays,
  shownLength,
} from "./duration-cells.ts";
import { noDate } from "./filter-words.tsx";
import { cellColumn } from "./grid-columns.tsx";
import type { CellRecord, Column } from "./record-table.ts";
import { asText } from "./table-rows.ts";
import type { CellValue, ColumnUnit } from "./table-view.ts";
import { decimalTo } from "./numbers.ts";

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
  const column: Column<Rec, Change> = {
    ...cellColumn<Rec, Change>(field.id, field.type, {
      label: field.name,
      required: field.required,
      field,
      choices: list?.choices ?? [],
      multiple: field.multiple,
    }),
    dataClass: columnClass(field, list),
    ...ownSettings<Rec>(field),
  };
  return field.unit === null || field.unit === undefined
    ? column
    : lengthColumn(column, field.unit);
};

// The units a Duration column is shown in, as typed first, each with its code and words.
const asTyped: ColumnUnit = {
  key: "typed",
  label: "As typed",
  code: "",
  name: "",
  one: "",
};

const unitsShown: ColumnUnit[] = durationUnitsShown.map(
  ({ unit, label, name, one }) => ({ key: unit, label, code: unit, name, one }),
);

const lengthPlaces = [0, 1, 2];
const lengthPlacesAtFirst = 1;

// A Duration column, shown as typed or in the unit the view names, in which a bare number is typed;
// its cells are compared, filtered and added up in that unit, or its own while shown as typed.
function lengthColumn<Rec extends CellRecord, Change extends CellChange>(
  column: Column<Rec, Change>,
  own: DurationUnit,
): Column<Rec, Change> {
  const shownIn = (unit: ColumnUnit, places: number): Column<Rec, Change> => {
    const shown = durationUnitSchema.safeParse(unit.key).data;
    const lengths = { own, shown };
    const sumUnit = shown ?? own;
    return {
      ...column,
      lengths,
      unit,
      ...(shown === undefined
        ? {}
        : {
            content: (record: Rec) =>
              shownLength({ lengths }, column.value(record), places),
          }),
      sum: {
        amount: (record) => {
          const value = column.value(record);
          return asText(value) === "" ? null : lengthDays(value);
        },
        shown: (days) =>
          `${decimalTo(days / unitDays(sumUnit), places)} ${sumUnit}`,
      },
      change: (value) =>
        cellKinds.duration.change(column.key, value, { lengths }) as Change,
    };
  };
  return {
    ...shownIn(asTyped, lengthPlacesAtFirst),
    units: {
      offered: [asTyped, ...unitsShown],
      places: { offered: lengthPlaces, starting: lengthPlacesAtFirst },
      shownIn,
    },
  };
}

// The settings a column takes from its field's type beyond its cells' kind's, which the built-in
// columns sharing the kind don't take.
function ownSettings<Rec extends CellRecord>(
  field: Field,
): Partial<Column<Rec, never>> {
  switch (field.type) {
    case "number":
      return {
        sum: { amount: (record: Rec) => record.numbers?.[field.id] ?? null },
      };
    case "text":
      return { maxLength: textLimit, breaksDown: "unless required" };
    case "date":
      return {
        months: {
          of: (value: CellValue) => monthOf(asText(value)),
          emptyLabel: noDate,
        },
        breaksDown: true,
      };
    case "choice":
    case "link":
    case "note":
    case "flag":
    case "duration":
      return {};
  }
}

// A record's values in added columns with a change applied, as the table shows them before it is
// saved.
export const withCellChange = (
  record: Pick<CellSource, "values" | ColumnValueMap>,
  change: CellChange,
) => {
  const shown: SomeColumnValues = record;
  const changed: SomeRequestedColumnValues = change;
  return {
    values: { ...record.values, ...change.values },
    links: kept({ ...record.links, ...change.links }),
    ...columnValueMapsOf(
      optionalColumnValueMaps,
      <Name extends ColumnValueMap>(map: Name) =>
        /* eslint-disable security/detect-object-injection -- the map is one of the record's own */
        shown[map] === undefined && changed[map] === undefined
          ? undefined
          : kept<ColumnValue<Name>>({ ...shown[map], ...changed[map] }),
      /* eslint-enable security/detect-object-injection */
    ),
  };
};

// What a new record is given in columns of one value, left out when it is given none.
function askedOf<Held>(
  parts: readonly (Readonly<Record<string, Held>> | undefined)[],
): Record<string, Held> | undefined {
  const entries = parts.flatMap((part) => Object.entries(part ?? {}));
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}

// The values a new record is given, from each column's change, with no link left empty.
export function cellRequest(parts: readonly CellChange[]) {
  const changes: readonly SomeRequestedColumnValues[] = parts;
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
    ...requestedColumnValueMapsOf(
      optionalColumnValueMaps,
      <Name extends ColumnValueMap>(map: Name) =>
        askedOf<ColumnValue<Name> | null>(
          // The map is one of each change's own.
          // eslint-disable-next-line security/detect-object-injection
          changes.map((part) => part[map]),
        ),
    ),
  };
}

const columnValueFields = new Set<string>(["values", ...columnValueMaps]);

// A record or change without its values in added columns.
export const withoutColumnValues = <Rec extends object>(
  record: Rec,
): Omit<Rec, "values" | ColumnValueMap> =>
  Object.fromEntries(
    Object.entries(record).filter(([key]) => !columnValueFields.has(key)),
  ) as Omit<Rec, "values" | ColumnValueMap>;
