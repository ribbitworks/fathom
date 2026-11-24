// SPDX-License-Identifier: Apache-2.0

// How the shared table's columns are made, and what each kind of cell does with a column's values.

import { type Choice, type RecordKeyOf, shownRecordKey } from "@fathom/shared";
import { type CellChange, type CellSource, cellKinds } from "./cell-kinds.tsx";
import { choice } from "./lists.ts";
import { isSaved } from "./record-key.tsx";
import type {
  AnyColumn,
  CellRecord,
  Column,
  ColumnUnits,
  GridRecord,
} from "./record-table.ts";
import type { CellValue, ColumnUnit, Kind, View } from "./table-view.ts";

// The unit the view names for a column, or the column's first when the view names none it offers.
export function unitInView(
  key: string,
  { offered }: ColumnUnits,
  view: Pick<View, "units">,
): ColumnUnit {
  const named = new Map(Object.entries(view.units ?? {})).get(key);
  return offered.find((unit) => unit.key === named) ?? offered[0];
}

// The column as shown in the unit and to the decimal places the view names, or as it starts where
// the view names none it offers.
export function inViewUnits<Rec extends GridRecord, Change>(
  column: Column<Rec, Change>,
  view: Pick<View, "units" | "places">,
): Column<Rec, Change> {
  return column.units === undefined
    ? column
    : shownInView(column, column.units, view).column;
}

// A column that offers units as the view shows it, and the unit it is shown in.
export function shownInView<Rec extends GridRecord, Change>(
  column: Column<Rec, Change>,
  units: NonNullable<Column<Rec, Change>["units"]>,
  view: Pick<View, "units" | "places">,
): { unit: ColumnUnit; column: Column<Rec, Change> } {
  const { places, shownIn } = units;
  const unit = unitInView(column.key, units, view);
  const asked = new Map(Object.entries(view.places ?? {})).get(column.key);
  const shownTo =
    asked !== undefined && places.offered.includes(asked)
      ? asked
      : places.starting;
  return {
    unit,
    column: { ...shownIn(unit, shownTo), units, places: shownTo },
  };
}

// A column whose cells are of one kind, reading a record's value, live or as drafted, by its key,
// and saving it with the change its kind makes.
export function cellColumn<Rec extends CellRecord, Change extends CellChange>(
  key: string,
  kind: Kind,
  rest: Pick<Column<Rec>, "label" | "required" | "choices" | "multiple"> &
    Partial<Pick<Column<Rec>, "field" | "maxLength">>,
): Column<Rec, Change> {
  // The kind is always one of the fixed kinds.
  // eslint-disable-next-line security/detect-object-injection
  const cellKind = cellKinds[kind];
  return {
    key,
    kind,
    ...rest,
    value: (record) => cellKind.read(record, key),
    live: (draft) => cellKind.read(draft.live, key),
    // Each table's change holds what its kinds of cell save.
    change: (value) => cellKind.change(key, value) as Change,
  };
}

// A column whose values are held as fields of the record itself, each named by the column's key.
export function fieldColumn<
  Rec extends GridRecord & { draft?: { live: object } | undefined },
  Change,
>(
  key: string,
  kind: Kind,
  rest: Pick<Column<Rec>, "label" | "required" | "choices" | "multiple"> &
    Partial<Pick<Column<Rec>, "maxLength" | "readOnly" | "emptyLabel">>,
): Column<Rec, Change> {
  // The kind is always one of the fixed kinds.
  // eslint-disable-next-line security/detect-object-injection
  const cellKind = cellKinds[kind];
  const { ownField } = cellKind;
  const read = (holder: object): CellValue =>
    ownField === undefined
      ? cellKind.read(holder as CellSource, key)
      : ownField.read(new Map(Object.entries(holder)).get(key));
  return {
    key,
    kind,
    ...rest,
    value: read,
    live: (draft) => read(draft.live),
    change: (value) =>
      (ownField === undefined
        ? cellKind.change(key, value)
        : { [key]: ownField.save(value, rest.multiple) }) as Change,
  };
}

// A read-only column of words its records hold as fields of their own, by the column's key or the
// field named: one each, several, or none, such as a cycle's name. Its choices are every word the
// records given hold, each named as given or by itself, in the order given or else alphabetically by
// name, so its filter lists those in use, as a list's does.
export function wordsColumn<
  Rec extends GridRecord & { draft?: { live: object } | undefined },
  Change,
>(
  key: string,
  label: string,
  records: readonly Rec[],
  {
    required = false,
    multiple = false,
    emptyLabel,
    from = key,
    named = (word) => word,
    order,
  }: {
    required?: boolean;
    multiple?: boolean;
    emptyLabel?: string;
    // The field holding the words, such as each record's identifier, when not the column's key.
    from?: string;
    // A word's name in the column, from a record holding it, such as a record's name for its
    // identifier.
    named?: (word: string, record: Rec) => string;
    order?: (one: string, other: string) => number;
  } = {},
): Column<Rec, Change> {
  const read = (holder: object): string[] => {
    const held: unknown = new Map(Object.entries(holder)).get(from);
    if (Array.isArray(held)) {
      return held.filter((word): word is string => typeof word === "string");
    }
    return typeof held === "string" && held !== "" ? [held] : [];
  };
  // Each word, named from the first record holding it.
  const names = new Map<string, string>();
  for (const record of records) {
    for (const word of read(record)) {
      if (!names.has(word)) names.set(word, named(word, record));
    }
  }
  return {
    ...fieldColumn<Rec, Change>(key, "choice", {
      label,
      required,
      multiple,
      choices: [...names]
        .sort(([one, oneName], [other, otherName]) =>
          order === undefined
            ? oneName.localeCompare(otherName, undefined, { numeric: true })
            : order(one, other),
        )
        .map(([word, name]) => choice(word, name, false)),
      readOnly: true,
      ...(emptyLabel === undefined ? {} : { emptyLabel }),
    }),
    value: read,
    live: (draft) => read(draft.live),
  };
}

// A cell's choices in words by the names given, such as records' own names where their filter names
// them with more, or by themselves where none is given.
export const choicesNamed =
  (names: ReadonlyMap<string, string>) =>
  (chosen: readonly string[]): string =>
    chosen.map((id) => names.get(id) ?? id).join(", ");

// Each record, and, beside one with a draft, a copy of it as it is live, so a column built from them
// names every value either holds.
export const withLiveCopies = <
  Rec extends GridRecord & { draft?: { live: object } | undefined },
>(
  records: readonly Rec[],
): Rec[] =>
  records.flatMap((record) =>
    record.draft === undefined
      ? [record]
      : [record, { ...record, ...record.draft.live }],
  );

// Columns in the order given by their keys; a column the order does not name yet comes at the end,
// in the order given.
export function inOrder<Col extends { key: string }>(
  columns: readonly Col[],
  order: readonly string[],
): Col[] {
  const place = (column: Col) => {
    const at = order.indexOf(column.key);
    return at === -1 ? order.length : at;
  };
  return columns
    .map((column, index) => ({ column, index }))
    .sort((a, b) => place(a.column) - place(b.column) || a.index - b.index)
    .map(({ column }) => column);
}

export const kindOf = (column: { kind: Kind }) => cellKinds[column.kind];

// Whether a kind of record has a column.
export const offered = (column: AnyColumn, kind: string) =>
  column.offeredOn?.(kind) ?? true;

// A column as a row's cell sees it: with the choices the row may be given, when they depend on it.
export function onRow<
  Rec extends GridRecord,
  Col extends {
    pickable?: ((choice: Choice) => boolean) | undefined;
    pickableOn?:
      | ((choice: Choice, record: Rec | undefined, kind: string) => boolean)
      | undefined;
  },
>(column: Col, record: Rec | undefined, kind: string): Col {
  const { pickableOn } = column;
  return pickableOn === undefined
    ? column
    : { ...column, pickable: (choice) => pickableOn(choice, record, kind) };
}

// Whether a kind of record's cells in a column cannot be changed.
export const readOnlyFor = (column: AnyColumn, kind: string) =>
  column.readOnly === true ||
  column.readOnlyOn?.(kind) === true ||
  !offered(column, kind);

// The columns a kind of record has, each required as it is for that kind.
export function columnsOn<Col extends AnyColumn>(
  columns: readonly Col[],
  kind: string,
): Col[] {
  return columns
    .filter((column) => offered(column, kind))
    .map((column) => ({
      ...column,
      required: column.requiredOn?.(kind) ?? column.required,
    }));
}

// A new record's values, kept for the kind it is now: those in the columns the kind has, and the
// columns it no longer has that held something.
export function keptForKind<Col extends AnyColumn>(
  columns: readonly Col[],
  values: Readonly<Record<string, CellValue>>,
  kind: string,
): { values: Record<string, CellValue>; lost: Col[] } {
  const lost = columns.filter(
    (column) =>
      readOnlyFor(column, kind) &&
      column.key in values &&
      !isEmpty(values[column.key] as CellValue),
  );
  const gone = new Set(lost.map(({ key }) => key));
  return {
    values: Object.fromEntries(
      Object.entries(values).filter(([key]) => !gone.has(key)),
    ),
    lost,
  };
}

export function breaksDown(
  column: Pick<AnyColumn, "required" | "kind" | "breaksDown">,
): boolean {
  if (column.breaksDown !== undefined) return column.breaksDown;
  const byKind = kindOf(column).breaksDown;
  return byKind === "unless required" ? !column.required : byKind === "always";
}

export const emptyValue = (column: { kind: Kind }): CellValue =>
  kindOf(column).empty;

export function isEmpty(value: CellValue): boolean {
  if (value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === "string" && value.trim() === "";
}

// A cell's value in words.
export function shown(column: AnyColumn, value: CellValue): string {
  return kindOf(column).inWords(column, value);
}

// What a cell shows: its value in its kind's own cell, or in words.
export function cellContent(column: AnyColumn, value: CellValue) {
  const { Cell } = kindOf(column);
  return Cell === undefined ? shown(column, value) : <Cell value={value} />;
}

// What a live row's cell shows: in words, so nothing in it can be focused or followed, except a
// kind edited in one step, such as a checkbox, whose cell is drawn as it is in other rows.
export function liveContent(column: AnyColumn, value: CellValue) {
  return kindOf(column).toggled === undefined
    ? shown(column, value)
    : cellContent(column, value);
}

export const keyColumnKey = "recordKey";

// A key is mostly capitals, each about a third wider than the digit a column's width counts in.
const keyCharWidth = 1.3;

// Each record's key, hidden until a view shows it, sorted and filtered by its number. A key never
// changes, so the column is read only, and no draft changes it.
export function keyColumn<Rec extends GridRecord, Change>(
  keyOf: (record: Rec) => RecordKeyOf | undefined,
  records: readonly Rec[],
): Column<Rec, Change> {
  const label = "Key";
  const savedKey = (record: Rec) => {
    const key = keyOf(record);
    return key !== undefined && isSaved(key) ? key : undefined;
  };
  const shown = (record: Rec) => {
    const key = savedKey(record);
    return key === undefined ? "" : shownRecordKey(key.kind, key.keyNumber);
  };
  return {
    // As wide as the longest key shown, so none is cut short.
    cellChars: Math.ceil(
      Math.max(label.length, ...records.map((one) => shown(one).length)) *
        keyCharWidth,
    ),
    key: keyColumnKey,
    label,
    kind: "number",
    choices: [],
    multiple: false,
    required: false,
    readOnly: true,
    breaksDown: false,
    hiddenAtFirst: true,
    searched: false,
    live: () => null,
    change: () => {
      throw new Error("A record's key can't be changed");
    },
    value: (record) => String(savedKey(record)?.keyNumber ?? ""),
    content: (record) => shown(record) || null,
  };
}

// Items with one put right after the name column's, where a record's key is read with its name, or
// first in a table with no name column.
export function afterName<Item>(
  items: readonly Item[],
  isName: (item: Item) => boolean,
  item: Item,
): Item[] {
  const after = items.findIndex(isName) + 1;
  return [...items.slice(0, after), item, ...items.slice(after)];
}
