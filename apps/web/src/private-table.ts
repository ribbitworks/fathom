// SPDX-License-Identifier: Apache-2.0

// A private page's table, on the shared table: its rows, saved at once with no drafts, in the
// page's own columns, the first of which names each row.

import type {
  Field,
  List,
  PrivateColumn,
  PrivatePage,
  PrivateRow,
  RecordKeyOf,
} from "@fathom/shared";
import { addedColumn, cellRequest } from "./added-columns.ts";
import type { CellChange } from "./cell-kinds.tsx";
import { byChoice, holdsChoices } from "./choice-grouping.ts";
import { unsavedKeyNumber } from "./drafts.ts";
import { shown } from "./grid-columns.tsx";
import { liveTableParts } from "./live-table.ts";
import type { Column, RecordTable } from "./record-table.ts";

// A private page's row, which never has a draft.
export type PrivateRecord = PrivateRow & { draft?: undefined };

export type PrivateTable = RecordTable<PrivateRecord, CellChange, CellChange>;

// A page's column as any table's added column is, required only where it names each row. A page's
// columns have no number of their own, so none is given.
export const privateField = (
  column: PrivateColumn,
  firstFieldId: string | null,
): Field => ({
  ...column,
  keyNumber: unsavedKeyNumber,
  required: column.id === firstFieldId,
});

export const privateFields = (
  page: Pick<PrivatePage, "columns" | "firstFieldId">,
): Field[] =>
  page.columns.map((column) => privateField(column, page.firstFieldId));

// Made once, so the table's Key column is made again only when the rows change. A row being added
// has no key yet.
const rowKeyOf = (row: PrivateRecord): RecordKeyOf | undefined =>
  row.key === null ? undefined : { kind: "row", code: row.key };

export function privateTable({
  page,
  lists,
}: {
  page: Pick<PrivatePage, "name" | "columns" | "firstFieldId">;
  lists: readonly List[];
}): PrivateTable {
  const columns = privateFields(page).map((field) =>
    addedColumn<PrivateRecord, CellChange>(field, lists),
  );
  const [first] = columns;
  const groupings = columns
    .filter((column) => holdsChoices(column))
    .map((column) => byChoice(column));
  const naming = columns.find(({ key }) => key === page.firstFieldId) ?? first;
  const nameOf = (row: PrivateRecord) =>
    naming === undefined ? "" : shown(naming, naming.value(row));
  return {
    ...liveTableParts,
    label: page.name,
    one: "row",
    noun: "rows",
    emptyRowAlone: true,
    newRowLabel: () => "New row",
    removeLabel: () => "Remove row",
    nameOf,
    nameColumn: naming?.key ?? "",
    columnsFor: (): Column<PrivateRecord, CellChange>[] => columns,
    recordProblem: () => undefined,
    request: (changes) => cellRequest(changes),
    exported: {},
    keyOf: rowKeyOf,
    // Group by is offered only once a column has choices to group by.
    ...(groupings.length === 0 ? {} : { groupings }),
  };
}
