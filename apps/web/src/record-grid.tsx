// SPDX-License-Identifier: Apache-2.0

// A table of records, such as people or planned hires, edited like a spreadsheet. Arrow keys, Home,
// End, and Tab move between cells, and Ctrl+Home and Ctrl+End go to the first and last. On a
// record, Enter, F2, or typing edits the cell, and Delete clears it. While editing, Enter saves and
// moves down, Tab saves and moves across, and Esc cancels. A column drawing on a list is edited by
// typing to narrow its choices and picking one, as choice-picker.tsx sets out. Empty rows at the
// end take new records: Tab moves straight on to editing the next cell, and Enter, in a cell or on
// the row, adds the record and starts the next. Pasting rows copied from a spreadsheet into a new
// row adds a record for each, all saved together; rows that will not do stay as new rows with their
// problems shown. A new row with something in it has a menu, also opened with Shift+F10, that
// clears it. A row's problem is named under it, in its first cell, and the value it is about is
// marked red: a value its column cannot take first, then a problem with the record taken whole,
// such as an Employee ID someone else has, then a value still needed. A new row's mark names what
// is wrong as it is filled in, and a refused value keeps its editor open, marked. Every change to a
// record is a draft, shown in place and marked, until an Approver approves it; a cell a draft
// changes is marked, and names its live value. Each record's menu, also opened with Shift+F10,
// drafts removing it or discards its draft. Every column can be dragged by its header, moved with
// Alt and the arrow keys, or moved from its menu, and columns drawing on lists are changed from
// there too. Everyone can change a column's width, kept in the view, by dragging its header's right
// edge, with Shift, Alt and the arrow keys, or from its menu. Everyone, viewers included, can
// search the table and sort and filter it by any column they see, as table-controls.tsx sets out;
// rows keep their place while they are edited, until the view next changes. Viewers see the same
// table, read only. Changes to columns and their order are drafts too, marked under the columns'
// names, with each column's draft in its menu, and the order's in the Draft menu and the menu of
// each column it moves; the Draft menu also chooses what to show and decides every draft waiting
// among those shown. What is particular to a kind of record, such as its built-in columns and what
// adding one asks for, comes from its table, as people-grid.tsx sets out for People.
//
// A cell whose kind is edited in the side panel, such as a note, opens there on a click, Enter, or
// F2, read only where the cell may not change. While it is being changed, only the panel's own
// buttons close it, and the table changes nothing else until then.

import type {
  Asking,
  Choice,
  ColumnOrderDraft,
  DraftKind,
  Field,
  FieldDraft,
  List,
  Show,
} from "@fathom/shared";
import { draftFilterKey } from "@fathom/shared";
import {
  ActionIcon,
  Menu,
  Paper,
  Table,
  Text,
  VisuallyHidden,
} from "@mantine/core";
import {
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";
import type { Finish } from "./choice-picker.tsx";
import {
  type CellChange,
  cellKinds,
  type CellSource,
  type EditorProps,
} from "./cell-kinds.tsx";
import {
  configDraftFields,
  type Credited,
  type DraftField,
  draftLines,
  HeldNote,
  MenuDraftLines,
  MenuTitle,
  UnpublishedNote,
  OtherApproverNote,
  WaitingNote,
} from "./draft-details.tsx";
import {
  type ColumnDraftTarget,
  decidable,
  type DraftSelection,
  draftTotal,
  mayDecide,
  noDrafts,
  waitsForRejected,
} from "./drafts.ts";
import { useColumnWidths } from "./column-widths.ts";
import { focusSoon } from "./focus.ts";
import { ResizeEdge } from "./resize-edge.tsx";
import {
  cellKey,
  frozenByDefault,
  frozenLayout,
  useFrozenMoves,
  frozenLeft,
  frozenVariables,
  useMeasured,
} from "./frozen-columns.ts";
import { shortcutsFor } from "./list-panel.tsx";
import { Icon } from "./icons.tsx";
import { movedKeys } from "./list-drafts.tsx";
import { draftedLists, liveLists } from "./lists.ts";
import { nameAs } from "./names.ts";
import {
  type ChangeView,
  ColumnViewItems,
  DecideAllItems,
  FilterPopover,
  HeaderMarks,
  headerState,
  type SavedViews,
  ViewBar,
} from "./table-controls.tsx";
import {
  activeGrouping,
  applyView,
  type CellValue,
  type Kind,
  knownView,
  narrows,
  type TableColumn,
  useSteadyOrder,
  valueOrStandIn,
  type View,
} from "./table-view.ts";
import { AppMenu, closesOnBlankClick } from "./app-menu.tsx";
import { metricsButtonId, metricsPanelId } from "./metrics.ts";
import { type CountedRows, MetricsPanel } from "./metrics-panel.tsx";
import classes from "./pages.module.css";
import type { Phrase } from "./phrase.tsx";
import { type SidePanel, WithSidePanel } from "./side-panel.tsx";
import {
  type DraftLike,
  draftMarkChars,
  DraftMark,
  HoldMarks,
  StatusMark,
} from "./status-mark.tsx";

// A record's draft, as the table shows it: what it does, the columns it changes, by key, and who
// made it.
export interface GridDraft extends DraftLike, Credited {
  action: "created" | "changed" | "deleted";
  changed: string[];
  // Changed by this account, whose role does not let it approve its own drafts.
  needsOtherApprover?: boolean | undefined;
}

// A record the table shows: as its draft, if any, makes it, with the draft beside, and who else
// holds it by having unpublished changes to it.
export interface GridRecord {
  id: string;
  draft?: GridDraft | undefined;
  heldBy?: string | undefined;
}

type DraftOf<Rec extends GridRecord> = NonNullable<Rec["draft"]>;

export interface RecordActions<Rec extends GridRecord, Change, Request> {
  // Adds records, all saved together, showing each at once under the identifier given until saved,
  // then gives their own identifiers; if they cannot be saved, gives back what was entered.
  add: (
    records: { id: string; request: Request }[],
    onAdded: (ids: string[]) => void,
    onFailed: () => void,
  ) => void;
  update: (record: Rec, change: Change) => void;
  // Asks to approve or reject the drafts chosen, of records, columns, or the column order, naming
  // them when one menu item decides several together.
  decide: (asking: Asking, selection: DraftSelection, naming?: boolean) => void;
  remove: (record: Rec) => void;
  discard: (record: Rec, draft: DraftOf<Rec>) => void;
  // Sends a rejected draft for approval again, unchanged.
  resubmit: (record: Rec) => void;
  // Moves a column, by its key, to just after another, or to the start when there is none.
  moveColumn: (key: string, label: string, after: string | null) => void;
  editColumn: (field: Field) => void;
  // Discards a draft of a column or of the column order, or sends a rejected one again.
  discardColumn: (target: ColumnDraftTarget, name: string) => void;
  resubmitColumn: (target: ColumnDraftTarget) => void;
}

// A record's built-in detail, keyed by its name, or an added column, keyed by its identifier, with
// how it reads a value from a draft's live values, and the change that saves a value in it.
export interface Column<
  Rec extends GridRecord,
  Change = unknown,
> extends TableColumn<Rec> {
  required: boolean;
  // For added columns: the column, and, for one drawing on a list, its list's choices.
  field?: Field;
  choices: Choice[];
  // Whether a choice may be put in a cell, apart from being offered in its list.
  pickable?: (choice: Choice) => boolean;
  // Whether a choice may be put in a row's cell, for a column whose choices depend on the row: its
  // record, or none for a new row, and its kind. It takes the place of pickable for that row.
  pickableOn?: (
    choice: Choice,
    record: Rec | undefined,
    kind: string,
  ) => boolean;
  // For text columns: the most characters a value may hold.
  maxLength?: number | undefined;
  // Set for a column whose values follow from another's, which is edited instead.
  readOnly?: boolean;
  // The key of the column whose drafts change this one's values, when another's do.
  changesWith?: string;
  // Set false for a column not worth breaking down by, such as one with a choice for each record.
  breaksDown?: boolean;
  live: (draft: DraftOf<Rec>) => CellValue;
  change: (value: CellValue) => Change;
  // Shown after a record's value, such as a warning about it.
  mark?: (record: Rec) => ReactNode;
  // For a table with several kinds of record: whether a kind has the column, which is otherwise
  // empty and read only on its rows, and whether it needs a value there. Every kind has it, and
  // needs a value when the column is required, unless told otherwise.
  offeredOn?: (kind: string) => boolean;
  requiredOn?: (kind: string) => boolean;
  // For a table with several kinds of record: whether a kind's rows show the column's value without
  // letting it be changed, such as a state that follows from being that kind.
  readOnlyOn?: (kind: string) => boolean;
  // What a new row of a kind shows before anything is put in it, such as its kind.
  newRowValue?: (kind: string) => CellValue;
}

// What is particular to a kind of record: what its table and rows are called, its columns, how its
// records are as they are live, what adding one asks for, what is wrong with one taken whole, and
// which drafts name it.
export interface RecordTable<Rec extends GridRecord, Change, Request> {
  // The table's name, for assistive technology, such as "People".
  label: string;
  one: string;
  noun: string;
  // For a table of several kinds of record, what its records are called together, and how many of
  // each some records are, which Metrics counts.
  counted?: { noun: string; counted: (records: readonly Rec[]) => string };
  // The kinds of record the table holds, the first of which a new row adds unless asked for
  // another, and each record's kind; a table of one kind leaves them out.
  kinds?: readonly string[];
  kindOf?: (record: Rec) => string;
  // For a table of several kinds of record: the kind a new row's values make it, such as a state
  // only one kind has, or none when they leave it as it is.
  kindOfNewRow?: (values: Record<string, CellValue>) => string | undefined;
  // What assistive technology calls a new row of a kind, such as "New person".
  newRowLabel: (kind: string) => string;
  // What removing a record is called in its menu, such as "Remove person".
  removeLabel: (record: Rec) => string;
  nameOf: (record: Rec) => string;
  // Whether a record cannot be changed by this user, though others of the table can.
  readOnlyRecord?: (record: Rec) => boolean;
  // The table's columns, in the order given by their keys, from its added columns and their lists,
  // and the records, live or as drafted, for columns whose choices are records.
  columnsFor: (
    fields: readonly Field[],
    lists: readonly List[],
    order: readonly string[],
    records: readonly Rec[],
  ) => Column<Rec, Change>[];
  // The records as they are live, without drafts.
  liveRecords: (records: readonly Rec[]) => Rec[];
  // What a record's draft changes, field by field, as the change history words it.
  draftFields: (
    record: Rec,
    draft: DraftOf<Rec>,
    fields: readonly Field[],
    lists: readonly List[],
  ) => DraftField[];
  // What is wrong with a record's values taken together, if anything, beside the other records'
  // values, and the column whose value is wrong, when one is; the column changed, when only one is,
  // with the record's values before it changed.
  recordProblem: (
    values: Record<string, CellValue>,
    others: () => Record<string, CellValue>[],
    changed?: string,
    before?: Record<string, CellValue>,
  ) => RowProblem | undefined;
  // The request that adds a record of a kind, from the changes that save each of the values of the
  // columns it has.
  request: (changes: Change[], kind: string) => Request;
  // The drafts of the records named, to approve or reject.
  drafts: (ids: string[]) => DraftSelection;
  // What else a record's menu offers, after its columns' own items, such as showing its details.
  menuItems?: (record: Rec) => ReactNode;
  // The ways the rows can be grouped under headings, the first of which is the table's own, for a
  // table that groups them.
  groupings?: readonly RowGrouping<Rec>[];
}

// The group a row is in: the groups follow in order of rank, and each is headed with its label.
export interface RowGroup {
  key: string;
  label: string;
  rank: number;
}

export interface RowGrouping<Rec> {
  key: string;
  // What the choice of this grouping is called.
  label: string;
  of: (record: Rec) => RowGroup;
}

// What is wrong with a row, and the column whose value is wrong, when one is.
export interface RowProblem {
  message: string;
  column?: string | undefined;
}

// A record whose values in added columns, and whose draft's live values, the kinds of cell read.
export interface CellRecord extends GridRecord, CellSource {
  draft?: (GridDraft & { live: CellSource }) | undefined;
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

// Records as they are live, without drafts: those only drafted to be added are left out, and each
// built-in detail, by the keys given, and each added column a draft changes has its live value back.
export function liveRecordsBy<Rec extends GridRecord>(
  records: readonly Rec[],
  whenChanged: (
    record: Rec,
    draft: NonNullable<Rec["draft"]>,
    withoutDraft: Rec,
  ) => Rec,
): Rec[] {
  return records.flatMap((record): Rec[] => {
    const { draft, ...rest } = record;
    if (draft === undefined) return [record];
    if (draft.action === "created") return [];
    if (draft.action === "deleted") return [rest as Rec];
    return [whenChanged(record, draft, rest as Rec)];
  });
}

// A record's values of one sort, with those a draft changes put back as they are live.
export const withLiveValues = <Held,>(
  held: Readonly<Record<string, Held>> | undefined,
  changed: readonly string[],
  live: Readonly<Record<string, Held>> | undefined,
): Record<string, Held> => ({
  ...Object.fromEntries(
    Object.entries(held ?? {}).filter(([key]) => !changed.includes(key)),
  ),
  ...live,
});

export function liveRecordsOf<Rec extends CellRecord>(
  records: readonly Rec[],
  detailKeys: readonly string[],
): Rec[] {
  return liveRecordsBy(records, (record, draft, rest) => {
    const columns = draft.changed.filter((key) => !detailKeys.includes(key));
    const liveValues = new Map(Object.entries(draft.live.values));
    const values = Object.fromEntries([
      ...Object.entries(record.values).filter(
        ([key]) => !columns.includes(key),
      ),
      ...columns.flatMap((key): [string, readonly string[]][] => {
        const live = liveValues.get(key) ?? [];
        return live.length === 0 ? [] : [[key, live]];
      }),
    ]);
    const links = withLiveValues(record.links, columns, draft.live.links);
    const notes = withLiveValues(record.notes, columns, draft.live.notes);
    const numbers = withLiveValues(record.numbers, columns, draft.live.numbers);
    const details = Object.fromEntries(
      draft.changed
        .filter((key) => detailKeys.includes(key))
        // The key is one of the record's own details.
        // eslint-disable-next-line security/detect-object-injection
        .map((key) => [key, draft.live[key] ?? null]),
    );
    return {
      ...rest,
      ...details,
      values,
      links,
      ...(Object.keys(notes).length === 0 ? {} : { notes }),
      ...(Object.keys(numbers).length === 0 ? {} : { numbers }),
    };
  });
}

// The problem with a row's values, by its row's key, and the column it is in, when it is in one.
interface ShownProblem extends RowProblem {
  row: string;
}

interface NewRow {
  key: number;
  // The kind of record it adds, when not the table's first.
  kind?: string;
  values: Record<string, CellValue>;
  problem?: string;
  // The column the problem is in, when it is in one.
  problemAt?: string;
  // What is wrong with the row so far, besides what it still needs, found when a value is put in
  // it, so its mark names it before it is added.
  soFar?: RowProblem | undefined;
}

type Row<Rec> =
  { record: Rec; newRow?: never } | { newRow: NewRow; record?: never };

// A cell by the keys of its row and column.
interface Place {
  row: string;
  column: string;
}

interface Cell {
  row: number;
  column: number;
}

const headerId = (column: { key: string }) => `column-${column.key}`;

const shortcuts = shortcutsFor(navigator.userAgent);

// How Shift, Alt and an arrow key change a column's width from its header: a step wider or
// narrower.
const widthSteps: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
};

// A line of a column's header, its name or a mark under it, and the room above and below them, for
// how tall a header with marks grows.
const headerLineHeight = "1.125rem";
const headerPadding = "0.5rem";

// The most rows one paste adds, as the server allows at once.
const pasteLimit = 1000;

const kindOf = (column: { kind: Kind }) => cellKinds[column.kind];

// Whether a kind of record has a column.
const offered = (column: AnyColumn, kind: string) =>
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

// A record added but not saved yet is shown at once under an identifier of the table's own, until
// the server gives its own; until then it cannot be changed. The table goes on naming its row by it,
// so the row keeps its place, and focus, when the server's identifier replaces it.
const pendingPrefix = "pending-";

export const pendingId = () => `${pendingPrefix}${crypto.randomUUID()}`;

export const isPending = (record: GridRecord) =>
  record.id.startsWith(pendingPrefix);

// Whether a record's values cannot change for now, whoever may change it: while it is drafted to be
// removed, until the draft is discarded, while someone else holds it, or while it is being added.
export const heldBack = (record: GridRecord) =>
  record.draft?.action === "deleted" ||
  record.heldBy !== undefined ||
  isPending(record);

// What putting a new value in a record's column comes to: nothing, when it is the value already
// there; what is wrong, with the value itself or with the record's values taken together, beside
// the others'; or the change that saves it.
export function valueChange<Rec extends GridRecord, Change>(
  recordProblem: RecordTable<Rec, Change, unknown>["recordProblem"],
  column: Column<Rec, Change>,
  kind: string,
  before: Record<string, CellValue>,
  value: CellValue,
  others: () => Record<string, CellValue>[],
): { change: Change } | { problem: RowProblem } | undefined {
  if (JSON.stringify(before[column.key]) === JSON.stringify(value)) {
    return undefined;
  }
  const problem = firstProblem(
    columnsOn([column], kind),
    () => value,
    () =>
      recordProblem(
        { ...before, [column.key]: value },
        others,
        column.key,
        before,
      ),
  );
  return problem === undefined ? { change: column.change(value) } : { problem };
}

// Whether a draft changing a record names a column, or the column its values follow from.
const changedIn = (
  draft: GridDraft,
  column: { key: string; changesWith?: string | undefined },
) =>
  draft.changed.includes(column.key) ||
  (column.changesWith !== undefined &&
    draft.changed.includes(column.changesWith));

// Whether a draft gives a column a new value: every column of a record added, and those a change
// names. A removal shows the record as it is.
function draftChanges(
  draft: GridDraft | undefined,
  column: { key: string; changesWith?: string | undefined },
): boolean {
  if (draft === undefined || draft.action === "deleted") return false;
  return draft.action === "created" || changedIn(draft, column);
}

// The records the metrics count, as the Draft menu shows them. With drafts beside live, they count
// as drafted, leaving out those drafted to be removed, and as they are live, which `liveRecords`
// gives, by each column's live copy, which `liveOf` gives; otherwise they count as shown.
export function countedRecords<
  Rec extends GridRecord,
  Col extends TableColumn<Rec>,
>(
  show: Show,
  shown: readonly Rec[],
  columns: readonly Col[],
  liveOf: (column: Col) => Col | undefined,
  liveRecords: (records: readonly Rec[]) => Rec[],
): { rows: Rec[]; live?: CountedRows<Rec> } {
  if (show !== "both") return { rows: [...shown] };
  return {
    rows: shown.filter(({ draft }) => draft?.action !== "deleted"),
    live: {
      rows: liveRecords(shown),
      columns: columns.flatMap((column) => liveOf(column) ?? []),
    },
  };
}

type AnyColumn = Column<never>;

const breaksDown = (
  column: Pick<AnyColumn, "required" | "kind" | "breaksDown">,
) =>
  column.breaksDown ??
  (!column.required || kindOf(column).breaksDownWhenRequired);

const emptyValue = (column: { kind: Kind }): CellValue => kindOf(column).empty;

function isEmpty(value: CellValue): boolean {
  if (value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === "string" && value.trim() === "";
}

// How a column is sorted, as assistive technology reads it.
// Only the first level of a sort is marked, as a table has one sorted column for assistive technology;
// the header's name gives every level.
function ariaSort(view: View, key: string) {
  const [first] = view.sort;
  if (first?.key !== key) return undefined;
  return first.descending ? "descending" : "ascending";
}

const widestChars = 30;

// How many characters a column fits in its cells and in its header, which CSS turns into its width.
export function columnWidth(
  column: AnyColumn,
  longestText: ReadonlyMap<string, number>,
): { cells: number; header: number } {
  return {
    cells: Math.min(
      kindOf(column).width(column, longestText.get(column.key) ?? 0),
      widestChars,
    ),
    header: Math.min(
      Math.max(
        column.label.length,
        column.field?.draft ? draftMarkChars(column.field.draft) : 0,
      ),
      widestChars,
    ),
  };
}

// A column's width as CSS sets it: to fit its cells' characters and its header's, or, when set, in
// pixels.
function widthStyle(
  {
    cells,
    header,
  }: {
    cells: number;
    header: number;
  },
  set: number | undefined,
): CSSProperties {
  return {
    "--cell-chars": cells,
    "--header-chars": header,
    ...(set === undefined ? {} : { "--set-width": `${String(set)}px` }),
  } as CSSProperties;
}

function longestTexts<Rec extends GridRecord>(
  columns: readonly Column<Rec>[],
  records: readonly Rec[],
): Map<string, number> {
  return new Map(
    columns
      .filter((column) => kindOf(column).measured)
      .map((column) => [
        column.key,
        records.reduce(
          (longest, record) =>
            Math.max(
              longest,
              shown(column, valueOrStandIn(column, record)).length,
            ),
          0,
        ),
      ]),
  );
}

// A cell's value in words.
function shown(column: AnyColumn, value: CellValue): string {
  return kindOf(column).inWords(column, value);
}

// What a cell shows: its value in its kind's own cell, or in words.
function cellContent(column: AnyColumn, value: CellValue) {
  const { Cell } = kindOf(column);
  return Cell === undefined ? shown(column, value) : <Cell value={value} />;
}

// What a live row's cell shows: in words, so nothing in it can be focused or followed, except a
// kind edited in one step, such as a checkbox, whose cell is drawn as it is in other rows.
function liveContent(column: AnyColumn, value: CellValue) {
  return kindOf(column).toggled === undefined
    ? shown(column, value)
    : cellContent(column, value);
}

// Whether a value is missing from a column that needs one.
const neededProblem = (column: AnyColumn, value: CellValue) =>
  column.required && isEmpty(value) ? `${column.label} needed` : undefined;

// What is wrong with a value besides its being needed, such as a date that is not one.
const kindProblem = (column: AnyColumn, value: CellValue) =>
  kindOf(column).problem(column, value);

// What is wrong with a record's values, and in which column, when one: first any value its column
// cannot take, then the record taken whole, such as an Employee ID someone else has, and last any
// value still needed, so that a value that is wrong is named before one only missing.
function firstProblem(
  columns: readonly AnyColumn[],
  valueIn: (column: AnyColumn) => CellValue,
  whole: () => RowProblem | undefined,
): (RowProblem & { needed?: boolean }) | undefined {
  const inColumns = (check: typeof neededProblem, needed: boolean) => {
    for (const column of columns) {
      const message = check(column, valueIn(column));
      if (message !== undefined) {
        return { message, column: column.key, ...(needed ? { needed } : {}) };
      }
    }
    return undefined;
  };
  return (
    inColumns(kindProblem, false) ?? whole() ?? inColumns(neededProblem, true)
  );
}

// Everything wrong with a new record's values, as adding its row checks them, each in its column,
// or, for values taken together that name none, in the first: a value its column will not take or
// still needs, and the values taken together beside the other records', unless their column
// already names a problem.
export function newRecordProblems<Rec extends GridRecord, Change>(
  columns: readonly Column<Rec, Change>[],
  kind: string,
  values: Readonly<Record<string, CellValue>>,
  recordProblem: RecordTable<Rec, Change, unknown>["recordProblem"],
  others: () => Record<string, CellValue>[],
): (RowProblem & { column: string })[] {
  const offeredColumns = columnsOn(columns, kind);
  const inColumns = offeredColumns.flatMap(
    (column): (RowProblem & { column: string })[] => {
      const value = values[column.key] ?? emptyValue(column);
      const message =
        kindProblem(column, value) ?? neededProblem(column, value);
      return message === undefined ? [] : [{ message, column: column.key }];
    },
  );
  const whole = recordProblem({ ...values }, others);
  if (whole === undefined) return inColumns;
  const column = whole.column ?? (offeredColumns[0] as Column<Rec, Change>).key;
  return inColumns.some((problem) => problem.column === column)
    ? inColumns
    : [{ message: whole.message, column }, ...inColumns];
}

// The new rows pasted text makes, from the given column across: one for each line, with each cell's
// text matched to the column's choices by name, or taken as a web link's address, and any problem
// found.
export function pastedRows(
  text: string,
  columns: readonly AnyColumn[],
  from: number,
  firstKey: number,
  kind = "",
): NewRow[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      const values: Record<string, CellValue> = {};
      let problem: string | undefined;
      for (const [offset, cell] of line.split("\t").entries()) {
        const column = columns[from + offset];
        const content = cell.trim();
        if (
          column === undefined ||
          readOnlyFor(column, kind) ||
          content === ""
        ) {
          continue;
        }
        // A pasted row has no record yet.
        const read = kindOf(column).pasted(
          onRow<never, AnyColumn>(column, undefined, kind),
          content,
        );
        if ("problem" in read) problem ??= read.problem;
        else values[column.key] = read.value;
      }
      return {
        key: firstKey + index,
        values,
        ...(problem === undefined ? {} : { problem }),
      };
    });
}

// Where a dragged column should go, by key: just after another, or at the start. Undefined when it
// stays where it is.
export function droppedAfter(
  keys: readonly string[],
  moved: string,
  onto: string,
): string | null | undefined {
  const from = keys.indexOf(moved);
  const to = keys.indexOf(onto);
  if (from === -1 || to === -1 || from === to) return undefined;
  const others = keys.filter((key) => key !== moved);
  const at = others.indexOf(onto) + (to > from ? 1 : 0);
  return others[at - 1] ?? null;
}

// What a table is filtered by besides its columns: whether each record has a draft, waiting or
// rejected.
export const draftColumn: TableColumn<GridRecord> = {
  key: draftFilterKey,
  label: "Draft",
  kind: "choice",
  choices: [
    { id: "waiting", label: "Waiting" },
    { id: "rejected", label: "Rejected" },
  ],
  multiple: false,
  emptyLabel: "No draft",
  value: (record) => (record.draft === undefined ? [] : [record.draft.state]),
};

// The mark beside a new row being filled in, until its record is added, naming what is wrong with
// it so far, or otherwise the required columns still empty. The whole mark shows on hover too, since
// a narrow first column can cut it short.
function NewMark({
  missing,
  wrong,
  id,
}: {
  missing: readonly string[];
  wrong?: string | undefined;
  // What names what is wrong, which the editor of the cell it is in is described by.
  id: string;
}) {
  const status = "New, not saved yet";
  const detail =
    wrong ?? (missing.length > 0 ? `${missing.join(", ")} needed` : undefined);
  const words = detail === undefined ? status : `${status}: ${detail}`;
  return (
    <span className={classes.newMark} title={words}>
      <span className={classes.statusDot} aria-hidden="true" /> {status}
      {detail !== undefined && ": "}
      {wrong === undefined && detail}
      {/* Only what is wrong is red, and announced as it is found; the row's status, and what it
          still needs, are not. */}
      <span aria-live="polite">
        {wrong !== undefined && (
          <span id={id} className={classes.newMarkWrong}>
            {wrong}
          </span>
        )}
      </span>
    </span>
  );
}

// The columns as they are live, without drafts: those only drafted to be added are left out, and
// each setting a draft changes has its live value back.
export function liveFields(fields: readonly Field[]): Field[] {
  return fields.flatMap((field): Field[] => {
    const { draft, ...rest } = field;
    if (draft?.action === "created") return [];
    if (draft?.action !== "changed") return [rest];
    return [
      {
        ...rest,
        name: draft.live.name ?? rest.name,
        listId: draft.live.listId ?? rest.listId,
        visibility: draft.live.visibility ?? rest.visibility,
        multiple: draft.live.multiple ?? rest.multiple,
        required: draft.live.required ?? rest.required,
      },
    ];
  });
}

// The columns, their lists, and their order as a choice of the Draft menu shows them. Live only
// shows the live columns, in their live order, with their lists as they are live. Drafts applied
// shows the columns as they will be once approved: a rejected draft, not on its way to approval, is
// taken back, and a column drafted to be removed is left out, as are the choices drafted away from
// their lists.
export function shownSchema(
  show: Show,
  fields: readonly Field[],
  lists: readonly List[],
  order: readonly string[],
  orderDraft: ColumnOrderDraft | undefined,
): {
  fields: Field[];
  lists: List[];
  order: readonly string[];
  // The draft of the order, when it is shown.
  orderDraft: ColumnOrderDraft | undefined;
} {
  const applied = show === "drafts";
  const orderShown =
    orderDraft !== undefined &&
    show !== "live" &&
    !(applied && orderDraft.state === "rejected");
  return {
    fields:
      show === "live"
        ? liveFields(fields)
        : applied
          ? fields.flatMap((field) => {
              if (field.draft?.state === "rejected") return liveFields([field]);
              return field.draft?.action === "deleted" ? [] : [field];
            })
          : [...fields],
    lists:
      show === "live"
        ? liveLists(lists)
        : applied
          ? draftedLists(lists)
          : [...lists],
    order: orderDraft === undefined || orderShown ? order : orderDraft.live,
    orderDraft: orderShown ? orderDraft : undefined,
  };
}

// The records as a choice of the Draft menu shows them: as they are live, as drafted, or as they
// will be once approved, where a rejected draft is taken back and those drafted to be removed are
// left out.
export function recordsAsShown<Rec extends GridRecord>(
  show: Show,
  records: readonly Rec[],
  liveRecords: (records: readonly Rec[]) => Rec[],
): Rec[] {
  if (show === "live") return liveRecords(records);
  if (show === "both") return [...records];
  return records.flatMap((record) => {
    if (record.draft?.state === "rejected") return liveRecords([record]);
    return record.draft?.action === "deleted" ? [] : [record];
  });
}

// What a column's draft changes, field by field, with lists named rather than identified.
function fieldDraftLines(field: Field, lists: readonly List[]): Phrase[] {
  const draft = field.draft as FieldDraft;
  // A column's list, live or drafted, is always among the lists.
  const named = (value: unknown) =>
    (lists.find(({ id }) => id === value) as List).name;
  return draftLines(
    draft,
    configDraftFields(draft, field).map((one) =>
      one.key === "listId"
        ? {
            ...one,
            field: {
              ...one.field,
              oldValue: named(one.field.oldValue),
              newValue: named(one.field.newValue),
            },
          }
        : one,
    ),
  );
}

// Who drafted the column order, as the heading of its section in a menu, and as a line of a moved
// column's draft.
const orderMaker = (draft: ColumnOrderDraft) =>
  draft.madeBy === null ? "Fathom" : nameAs(draft.madeBy, draft.madeAs);
const movedLine = (draft: ColumnOrderDraft): Phrase => [
  { strong: "Moved" },
  ` by ${orderMaker(draft)}`,
];

// What may be done with a draft of the order of the table's columns, which the table shows,
// in the Draft menu above the table and in the menu of each column it moves.
function OrderItems({
  draft,
  canEdit,
  canApprove,
  actions,
  waits,
  heldBy,
  withColumnDraft = false,
}: {
  draft: ColumnOrderDraft;
  // Who else has unpublished changes to the order, which hold it.
  heldBy?: string | undefined;
  canEdit: boolean;
  canApprove: boolean;
  actions: Pick<
    RecordActions<never, never, never>,
    "decide" | "discardColumn" | "resubmitColumn"
  >;
  // Whether the order places a column whose addition was rejected, so cannot be approved yet.
  waits: boolean;
  // Part of the draft section of a moved column with a draft of its own, which names the move and
  // decides both drafts at once, leaving only what undoes the move.
  withColumnDraft?: boolean;
}) {
  const order = { ...noDrafts(), columnOrder: true };
  return (
    <>
      {!withColumnDraft && (
        <>
          <Menu.Divider />
          <MenuDraftLines
            draft={draft}
            lines={[[`Reordered by ${orderMaker(draft)}`]]}
            divider={false}
          />
          {heldBy !== undefined && <HeldNote by={heldBy} />}
          {draft.unpublished === true && <UnpublishedNote />}
        </>
      )}
      {canApprove && decidable({ draft, heldBy }) && !withColumnDraft && (
        <>
          <Menu.Item
            closeMenuOnClick
            disabled={waits || draft.needsOtherApprover === true}
            onClick={() => {
              actions.decide("approve", order);
            }}
          >
            Approve new order…
          </Menu.Item>
          {waits && <WaitingNote />}
          {!waits && draft.needsOtherApprover === true && <OtherApproverNote />}
          <Menu.Item
            closeMenuOnClick
            onClick={() => {
              actions.decide("reject", order);
            }}
          >
            Reject new order…
          </Menu.Item>
        </>
      )}
      {canEdit && heldBy === undefined && draft.state === "rejected" && (
        <Menu.Item
          closeMenuOnClick
          onClick={() => {
            actions.resubmitColumn({ kind: "order" });
          }}
        >
          Resubmit
        </Menu.Item>
      )}
      {canEdit && heldBy === undefined && (
        <Menu.Item
          closeMenuOnClick
          onClick={() => {
            actions.discardColumn({ kind: "order" }, "the column order");
          }}
        >
          Discard new order
        </Menu.Item>
      )}
    </>
  );
}

// The props a table of one kind of record takes, which its own component passes on.
export interface RecordGridProps<Rec extends GridRecord, Change, Request> {
  // Every record the user may see; the view decides which are shown, and in what order.
  records: Rec[];
  // Side panels the page opens beside the table, stacked above the table's own.
  panels?: readonly SidePanel[] | undefined;
  table: RecordTable<Rec, Change, Request>;
  fields: Field[];
  // The keys of the columns, in order, as a draft of the order makes it, and that draft.
  order: string[];
  orderDraft?: ColumnOrderDraft | undefined;
  // Who else has unpublished changes to the column order, which hold it.
  orderHeldBy?: string | undefined;
  lists: List[];
  canEdit: boolean;
  // Whether new records can be added, for those who may edit; true unless told otherwise.
  canAdd?: boolean;
  // The kinds of draft the user's role approves and rejects.
  approves?: readonly DraftKind[];
  // Whether a change is still saving, which approving all shown waits for, so it never sends a
  // draft not saved yet.
  saving?: boolean;
  canEditColumns: boolean;
  actions: RecordActions<Rec, Change, Request>;
  view: View;
  onView: ChangeView;
  // The table's saved views; absent where they are not offered.
  saved?: SavedViews | undefined;
}

// Each row's group as the view last placed it, so a row keeps its heading while it is edited, as
// it keeps its place; a row added since is placed by what it holds now.
function useSteadyGroups<Rec>(
  records: readonly Rec[],
  view: View,
  grouping: RowGrouping<Rec> | undefined,
  idOf: (record: Rec) => string,
): ((record: Rec) => RowGroup) | undefined {
  const viewKey = JSON.stringify(view);
  const take = () => ({
    view: viewKey,
    groups: new Map(
      grouping === undefined
        ? []
        : records.map((record) => [idOf(record), grouping.of(record)]),
    ),
  });
  const [snapshot, setSnapshot] = useState(take);
  let current = snapshot;
  if (snapshot.view !== viewKey) {
    current = take();
    setSnapshot(current);
  }
  return grouping === undefined
    ? undefined
    : (record) => current.groups.get(idOf(record)) ?? grouping.of(record);
}

export function RecordGrid<Rec extends GridRecord, Change, Request>({
  records: everyone,
  table,
  fields: draftedFields,
  order: draftedOrder,
  orderDraft,
  orderHeldBy,
  lists,
  canEdit: mayEdit,
  canAdd = true,
  approves: mayApprove = [],
  saving = false,
  canEditColumns,
  actions,
  view: asked,
  onView,
  saved,
  panels = [],
}: RecordGridProps<Rec, Change, Request>) {
  const applied = asked.show === "drafts";
  // A new column order that places a column whose addition was rejected waits for it.
  const orderWaits = waitsForRejected(
    { ...noDrafts(), columnOrder: true },
    lists,
    { fields: draftedFields, orderDraft },
  );
  const {
    fields,
    lists: listsShown,
    order,
    orderDraft: shownOrderDraft,
  } = shownSchema(asked.show, draftedFields, lists, draftedOrder, orderDraft);
  const orderShown = shownOrderDraft !== undefined;
  // The columns with their lists as they are live, for the live records and each live row, so a
  // choice's drafted name is not shown as live.
  const listsLive = liveLists(lists);
  const liveColumns = table.columnsFor(
    fields,
    listsLive,
    order,
    table.liveRecords(everyone),
  );
  // Both are made from the same fields, so every column has its live one.
  const liveColumn = (column: Column<Rec, Change>) =>
    liveColumns.find(({ key }) => key === column.key) as Column<Rec, Change>;
  const columns =
    asked.show === "live"
      ? liveColumns
      : table.columnsFor(fields, listsShown, order, everyone);
  const known = knownView(
    asked,
    columns,
    [draftColumn],
    columns.filter(breaksDown),
  );
  // The live records alone are read only, since every change makes a draft they do not show, and
  // have no drafts to filter by.
  const liveOnly = known.show === "live";
  // Nor are rejected drafts shown with the drafts applied, so they are not filtered by either.
  const draftFilter = new Map(Object.entries(known.filters)).get(
    draftFilterKey,
  );
  let view = known;
  if (liveOnly) {
    view = {
      ...known,
      filters: Object.fromEntries(
        Object.entries(known.filters).filter(([key]) => key !== draftFilterKey),
      ),
    };
  } else if (applied && draftFilter?.any !== undefined) {
    view = {
      ...known,
      filters: {
        ...known.filters,
        [draftFilterKey]: {
          ...draftFilter,
          any: draftFilter.any.filter((state) => state !== "rejected"),
        },
      },
    };
  }
  const records = recordsAsShown(known.show, everyone, table.liveRecords);
  const canEdit = mayEdit && !liveOnly;
  const approves = liveOnly ? [] : mayApprove;
  const approvesOrder = approves.includes("column-order");
  // Whether the user's role approves a record's draft, and those it decides with it.
  const approvesRecord = (record: Rec) =>
    mayDecide(approves, table.drafts([record.id]));
  // Beside a column whose draft changes it, the column as it is live, to compare, as a record's live
  // row is shown under their draft.
  const fieldsLive = new Map(
    liveFields(draftedFields).map((field) => [field.id, field]),
  );
  const liveCopies = new Map(
    columns.flatMap((column): [string, Column<Rec, Change>][] => {
      if (view.show !== "both" || column.field?.draft?.action !== "changed") {
        return [];
      }
      // A column only changed by its draft is live.
      const live = fieldsLive.get(column.key) as Field;
      return [
        [
          column.key,
          {
            ...column,
            label: live.name,
            required: live.required,
            multiple: live.multiple,
            // The lists load apart from the records, so may not have caught up yet.
            choices:
              listsLive.find(({ id }) => id === live.listId)?.choices ?? [],
          },
        ],
      ];
    }),
  );
  const liveBeside = (column: Column<Rec, Change>) =>
    liveCopies.get(column.key);
  const besides = columns.filter((column) => liveCopies.has(column.key));
  // The columns a draft of the order moves, marked under their names, unless drafted to be removed,
  // since where such a column goes matters to no one.
  const movedColumns = orderShown
    ? movedKeys(shownOrderDraft.live, draftedOrder)
    : new Map<string, number>();
  const isMoved = (column: Column<Rec, Change>) =>
    movedColumns.has(column.key) && column.field?.draft?.action !== "deleted";
  // The most lines of marks under any column's name, which the header grows to hold.
  const markLines = Math.max(
    0,
    ...columns.map(
      (column) =>
        (column.field?.draft === undefined ? 0 : 1) +
        (isMoved(column) ? 1 : 0) +
        (column.field?.draft?.unpublished === true ? 1 : 0) +
        (column.field?.heldBy === undefined ? 0 : 1),
    ),
  );
  // A record's value in a column as it is live, for the column's live copy: none for one only
  // drafted to be added, or for a new row.
  const liveCell = (record: Rec | undefined, column: Column<Rec, Change>) => {
    const draft = record?.draft as DraftOf<Rec> | undefined;
    if (record === undefined || draft?.action === "created") return "";
    return shown(
      // Only changed columns have a live copy beside them.
      liveBeside(column) as Column<Rec, Change>,
      draft?.action === "changed" && changedIn(draft, column)
        ? column.live(draft)
        : column.value(record),
    );
  };
  const liveCellBeside = (
    record: Rec | undefined,
    column: Column<Rec, Change>,
    index: number,
  ) => {
    const at = frozenCell(index, 1);
    return (
      liveBeside(column) && (
        <Table.Td
          key={`${column.key}-live`}
          aria-hidden="true"
          className={[
            classes.recordCell,
            classes.liveColumn,
            at.className,
          ].join(" ")}
          style={at.style}
        >
          {liveCell(record, column)}
        </Table.Td>
      )
    );
  };
  // A column with a draft is tinted, as a row with one is, and one a draft removes is struck through.
  const columnTint = (column: Column<Rec, Change>) => {
    const draft = column.field?.draft;
    if (draft === undefined) return "";
    return draft.action === "deleted"
      ? [classes.draftColumn, classes.removedColumn].join(" ")
      : classes.draftColumn;
  };
  // No width follows what is typed, so editing never moves the table.
  const [longestText] = useState(() => longestTexts(columns, records));
  // The records this user has added since the page opened, which stay shown whatever the view.
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  // The identifier each record added since the page opened was shown under before it was saved, by
  // its own, which names its row from then on.
  const [shownAs, setShownAs] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const stableId = (record: Rec) => shownAs.get(record.id) ?? record.id;
  // Freezing columns and setting their widths move no rows.
  const rowView = { ...view, frozen: undefined, widths: undefined };
  const groupOf = useSteadyGroups(
    records,
    rowView,
    activeGrouping(view, table.groupings),
    stableId,
  );
  const shownRecords = useSteadyOrder(
    records,
    rowView,
    (rows) => {
      const shown = applyView(rows, columns, view, [draftColumn]);
      return groupOf === undefined
        ? shown
        : shown.sort((a, b) => groupOf(a).rank - groupOf(b).rank);
    },
    stableId,
    added,
  );
  // The heading above each run of rows of one group, by its first row's key, with how many it
  // holds. Rows added since the view last changed stay at the end, so may start a run of their own.
  const groupRuns: {
    key: string;
    first: string;
    label: string;
    count: number;
  }[] = [];
  if (groupOf !== undefined) {
    for (const record of shownRecords) {
      const group = groupOf(record);
      const run = groupRuns.at(-1);
      if (run?.key === group.key) run.count += 1;
      else {
        groupRuns.push({
          key: group.key,
          first: stableId(record),
          label: group.label,
          count: 1,
        });
      }
    }
  }
  const headings = new Map(groupRuns.map((run) => [run.first, run]));
  const [newRows, setNewRows] = useState<NewRow[]>([{ key: 0, values: {} }]);
  const [nextKey, setNextKey] = useState(1);
  // The selected cell and the cell being edited, by row and column key rather than position, so they
  // stay with their record when a save puts the rows in a new order.
  const [activeAt, setActiveAt] = useState<Place>();
  const [editingAt, setEditingAt] = useState<Place>();
  // The record and column edited in the side panel, such as a note's, as they were when it opened,
  // so a note being written stays open, and is saved to its record, if its row leaves the view.
  const [panelOpen, setPanelOpen] = useState<{
    row: Row<Rec>;
    column: Column<Rec, Change>;
    readOnly: boolean;
  }>();
  // Whether something is being changed in the side panel, rather than only read there.
  const [panelWriting, setPanelWriting] = useState(false);
  // What is typed in the cell being edited: its text, or what narrows its choices.
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<ShownProblem>();
  const [menuFor, setMenuFor] = useState<string>();
  const [dragging, setDragging] = useState<string>();
  // Whether the table is scrolled sideways, which the frozen columns' edge shows with a shadow.
  const [scrolled, setScrolled] = useState(false);
  // The column whose filter is open, by key.
  const [filtering, setFiltering] = useState<string>();

  // The actions column, for those who may edit records or approve drafts.
  const withActions =
    canEdit || approves.length > 0 || table.menuItems !== undefined;
  // Whether the user may change a record, as they may the table's others, unless it is one they
  // may only view.
  const mayChange = (record: Rec) =>
    canEdit && table.readOnlyRecord?.(record) !== true;
  // A record's menu: approving or rejecting its draft, for Approvers, discarding it or removing the
  // record, for those who may change it, and whatever else the table offers, such as its details.
  const hasMenu = (record: Rec) =>
    !isPending(record) &&
    (mayChange(record) ||
      (record.draft !== undefined && approvesRecord(record)) ||
      Boolean(table.menuItems?.(record)));
  // Whether a record's cells cannot be changed: by those who may only view it, while it is drafted
  // to be removed, until the draft is discarded, or while it is being added.
  const locked = (record: Rec) => !mayChange(record) || heldBack(record);
  const defaultKind = table.kinds?.[0] ?? "";
  // The kind of record a row is, or adds.
  const rowKind = (row: Row<Rec>) =>
    row.newRow
      ? (row.newRow.kind ?? defaultKind)
      : (table.kindOf?.(row.record) ?? defaultKind);
  const rows: Row<Rec>[] = [
    ...shownRecords.map((record) => ({ record })),
    ...(canEdit && canAdd ? newRows.map((newRow) => ({ newRow })) : []),
  ];
  const rowKey = (row: Row<Rec>) =>
    row.newRow ? `new-${String(row.newRow.key)}` : stableId(row.record);
  const rowKeys = rows.map(rowKey);
  const keys = columns.map((column) => column.key);
  // Each column's header cells: its own, and any live copy beside it.
  const headerCells = columns.map((column) => (liveBeside(column) ? 2 : 1));
  const [scrollRef, measured, holdMeasuring] = useMeasured(
    columns
      .map((column) => `${column.key}${liveBeside(column) ? "+" : ""}`)
      .join(" "),
  );
  const frozenAsked = Math.min(view.frozen ?? frozenByDefault, columns.length);
  const frozen = frozenLayout(measured, headerCells, frozenAsked);
  // Where a frozen column's cell, or its live copy's, sits, or nothing for a column not frozen.
  const frozenCell = (index: number, copy = 0) =>
    index < frozen.frozen
      ? {
          className: classes.frozen,
          style: { left: `var(${frozenLeft(cellKey(index, copy))})` },
        }
      : { className: "", style: undefined };
  const freeze = (count: number) => {
    onView({
      ...view,
      frozen: count === frozenByDefault ? undefined : count,
    });
  };
  const refreeze = useFrozenMoves(keys, freeze);
  // The table's panel, holding its columns and where its frozen columns sit.
  const panelRef = useRef<HTMLDivElement>(null);
  const widths = useColumnWidths({
    panelRef,
    view,
    onView,
    measured,
    headerCells,
    frozen,
    holdMeasuring,
  });
  const cellId = (row: number, column: number) =>
    `cell-${String(rowKeys.at(row))}-${String(keys.at(column))}`;
  // The row and column of a cell, which is always within the table.
  const at = (cell: Cell) => ({
    row: rows[cell.row] as Row<Rec>,
    column: columns[cell.column] as Column<Rec, Change>,
  });
  const placeOf = (cell: Cell): Place => ({
    row: String(rowKeys.at(cell.row)),
    column: String(keys.at(cell.column)),
  });
  const cellAt = (place: Place) => ({
    row: rowKeys.indexOf(place.row),
    column: keys.indexOf(place.column),
  });
  // The selected cell, or the first when the one selected has gone.
  const found = activeAt === undefined ? undefined : cellAt(activeAt);
  const active =
    found && found.row !== -1 && found.column !== -1
      ? found
      : { row: 0, column: 0 };
  const placed = editingAt === undefined ? undefined : cellAt(editingAt);
  // The cell being edited, while its row and column are shown.
  const editing =
    placed && placed.row !== -1 && placed.column !== -1 ? placed : undefined;
  // What the side panel edits, if anything: a note only shown closes once its row is not.
  const inPanel =
    panelOpen && (editing !== undefined || !panelOpen.readOnly)
      ? panelOpen
      : undefined;
  // A note being written closes only by its panel's own buttons, and keeps the table from changing
  // values until then.
  const writingInPanel =
    inPanel !== undefined && !inPanel.readOnly && panelWriting;
  const setActive = (cell: Cell) => {
    setActiveAt(placeOf(cell));
  };
  const setEditing = (cell: Cell | undefined) => {
    if (cell === undefined) {
      setPanelOpen(undefined);
      setPanelWriting(false);
    }
    setEditingAt(cell === undefined ? undefined : placeOf(cell));
  };
  // A new row's value in a column: what is put in it, or what the column shows on a new row of its
  // kind.
  const newValue = (newRow: NewRow, column: Column<Rec, Change>): CellValue =>
    newRow.values[column.key] ??
    column.newRowValue?.(newRow.kind ?? defaultKind) ??
    emptyValue(column);
  const valueAt = (row: Row<Rec>, column: Column<Rec, Change>) =>
    row.newRow ? newValue(row.newRow, column) : column.value(row.record);
  // What an empty cell of a record shows in grey, if anything.
  const standInAt = (row: Row<Rec>, column: Column<Rec, Change>) =>
    row.newRow || column.standIn === undefined || valueAt(row, column) !== ""
      ? undefined
      : column.standIn(row.record);

  // What an empty cell of a record's Live row shows in grey, worked out from the record as it is
  // live, so a stand-in made from other cells uses their live values too.
  const liveStandIn = (record: Rec, column: Column<Rec, Change>) => {
    if (column.standIn === undefined) return undefined;
    const [live] = table.liveRecords([record]);
    return live === undefined || column.value(live) !== ""
      ? undefined
      : column.standIn(live);
  };

  // Focuses a cell of a new row by its key, since the row may not be drawn yet.
  const focusNew = (newKey: number) => {
    const place = { row: `new-${String(newKey)}`, column: String(keys[0]) };
    setActiveAt(place);
    focusSoon(`cell-${place.row}-${place.column}`);
  };

  const moveTo = (row: number, column: number) => {
    const target = {
      row: Math.max(0, Math.min(row, rows.length - 1)),
      column: Math.max(0, Math.min(column, columns.length - 1)),
    };
    setActive(target);
    focusSoon(cellId(target.row, target.column));
  };

  // Whether a cell's value may not change, as in a record nobody may change yet, or a column whose
  // values follow from another's or that its kind of row does not have.
  const readOnlyAt = (cell: Cell) => {
    const { row, column } = at(cell);
    return (
      Boolean(row.record && locked(row.record)) ||
      readOnlyFor(column, rowKind(row))
    );
  };

  const opensEditor = (cell: Cell) => {
    const { toggled, inPanel } = kindOf(at(cell).column);
    return toggled === undefined && (!readOnlyAt(cell) || inPanel === true);
  };

  // Starts editing a cell, or, for a kind edited in one step, such as a checkbox, saves the value
  // editing gives, unless what started it was typing.
  const startEdit = (cell: Cell, typed?: string) => {
    const { row, column } = at(cell);
    const { toggled, inPanel: opensPanel, asTyped } = kindOf(column);
    if (readOnlyAt(cell) && opensPanel !== true) return;
    // Typing does nothing in a cell edited in the side panel, as in a checkbox.
    if (writingInPanel || (opensPanel === true && typed !== undefined)) return;
    const value = valueAt(row, column);
    setActive(cell);
    if (toggled !== undefined) {
      if (typed === undefined) save(cell, toggled(value));
      return;
    }
    setEditing(cell);
    setPanelOpen(
      opensPanel === true
        ? { row, column, readOnly: readOnlyAt(cell) }
        : undefined,
    );
    setMenuFor(undefined);
    const startingText = typed ?? (typeof value === "string" ? value : "");
    setText(asTyped?.(startingText) ?? startingText);
    focusSoon(`${cellId(cell.row, cell.column)}-editor`);
  };

  const stopEdit = (then: Cell) => {
    setEditing(undefined);
    moveTo(then.row, then.column);
  };

  // Each record's values, by column.
  const valuesOf = (record: Rec): Record<string, CellValue> =>
    Object.fromEntries(
      columns.map((column) => [column.key, column.value(record)]),
    );

  // Every record's and new row's values, by its row's key, read once for a save or for adding
  // rows, and only when a record's problem needs them.
  const everyRowsValues = () => {
    let read: [string, Record<string, CellValue>][] | undefined;
    return () => {
      read ??= [
        ...records.map((record): [string, Record<string, CellValue>] => [
          stableId(record),
          valuesOf(record),
        ]),
        ...newRows.map((newRow): [string, Record<string, CellValue>] => [
          `new-${String(newRow.key)}`,
          newRow.values,
        ]),
      ];
      return read;
    };
  };

  // The values of every record and new row but the one named by its row's key.
  const otherValues =
    (rowsValues: () => [string, Record<string, CellValue>][], except: string) =>
    () =>
      rowsValues().flatMap(([key, values]) => (key === except ? [] : [values]));

  // What is wrong so far with a new row's values, named by its row's key, besides what it still
  // needs, such as an Employee ID someone else has. An empty row has nothing wrong yet.
  const wrongSoFar = (
    values: Record<string, CellValue>,
    key: string,
    kind: string,
  ): RowProblem | undefined => {
    if (Object.values(values).every(isEmpty)) return undefined;
    const found = firstProblem(
      columnsOn(columns, kind),
      (column) => values[column.key] ?? emptyValue(column),
      () => table.recordProblem(values, otherValues(everyRowsValues(), key)),
    );
    return found?.needed === true ? undefined : found;
  };

  // A record's cell whose new value was refused shows the value it had again, so the row is as it
  // was and has no problem to name.
  const putBack = () => {
    setProblem(undefined);
  };

  // Saves a cell's new value: on a record, at once; on a new row, into the row. Returns whether it
  // would do, showing the problem on the row when it would not.
  const save = (cell: Cell, value: CellValue): boolean => {
    const { row, column } = at(cell);
    return saveTo(row, column, value);
  };

  const saveTo = (
    row: Row<Rec>,
    column: Column<Rec, Change>,
    value: CellValue,
  ): boolean => {
    const key = rowKey(row);
    if (row.newRow) {
      const made = followingKind({
        key: row.newRow.key,
        ...kindKept(row.newRow),
        values: { ...row.newRow.values, [column.key]: value },
      });
      const soFar = wrongSoFar(made.values, key, made.kind ?? defaultKind);
      setNewRows((current) =>
        current.map((newRow) =>
          newRow.key === row.newRow.key
            ? { ...made, ...(soFar ? { soFar } : {}) }
            : newRow,
        ),
      );
      setProblem(undefined);
      return true;
    }
    const made = valueChange(
      table.recordProblem,
      column,
      rowKind(row),
      valuesOf(row.record),
      value,
      otherValues(everyRowsValues(), key),
    );
    if (made === undefined) return true;
    if ("problem" in made) {
      setProblem({
        row: key,
        column: made.problem.column ?? column.key,
        message: made.problem.message,
      });
      return false;
    }
    setProblem(undefined);
    actions.update(row.record, made.change);
    return true;
  };

  const emptyNewRow = (newRow: NewRow) =>
    Object.values(newRow.values).every(isEmpty);

  // A new row's kind, kept when the row is made again with new values.
  const kindKept = (newRow: NewRow) =>
    newRow.kind === undefined ? {} : { kind: newRow.kind };

  // A new row of the kind its values make it, when they decide one, without the values that kind
  // does not have.
  const followingKind = (newRow: NewRow): NewRow => {
    const kind = table.kindOfNewRow?.(newRow.values);
    if (kind === undefined || kind === (newRow.kind ?? defaultKind)) {
      return newRow;
    }
    const made: NewRow = {
      ...newRow,
      kind,
      values: keptForKind(columns, newRow.values, kind).values,
    };
    if (kind === defaultKind) delete made.kind;
    return made;
  };

  // A new row with something in it can be cleared, so it is no longer added.
  const clearable = (newRow: NewRow) => !emptyNewRow(newRow);

  // Takes away a new row and what it holds, leaving an empty one at the end, and puts focus on the
  // row after it.
  const clearNewRow = (newRow: NewRow) => {
    const kept = newRows.filter(({ key }) => key !== newRow.key);
    const last = kept.at(-1);
    const free = Math.max(nextKey, ...newRows.map(({ key }) => key + 1));
    const next =
      last === undefined || !emptyNewRow(last)
        ? [...kept, { key: free, values: {} }]
        : kept;
    setNewRows(next);
    if (next.length > kept.length) setNextKey(free + 1);
    setMenuFor(undefined);
    setEditing(undefined);
    // New rows end with an empty one, which a row that can be cleared is always before.
    const after = next.find(({ key }) => key > newRow.key) as NewRow;
    focusNew(after.key);
  };

  // Adds the records in the new rows, all together, once every one of them will do; otherwise shows
  // each row's problem and puts focus on the first.
  const submitNewRows = (current: NewRow[] = newRows) => {
    const filled = current.filter((newRow) => !emptyNewRow(newRow));
    if (filled.length === 0) return;
    const rowsValues = everyRowsValues();
    const checked = filled.map((newRow): NewRow => {
      if (newRow.problem !== undefined) return newRow;
      const found = firstProblem(
        columnsOn(columns, newRow.kind ?? defaultKind),
        // The columns given are the table's own.
        (column) => newValue(newRow, column as Column<Rec, Change>),
        () =>
          table.recordProblem(
            newRow.values,
            otherValues(rowsValues, `new-${String(newRow.key)}`),
          ),
      );
      if (found === undefined) return newRow;
      return {
        ...newRow,
        problem: found.message,
        ...(found.column === undefined ? {} : { problemAt: found.column }),
      };
    });
    // Keys for the rows made next, after every key in use, since rows just pasted may already have
    // taken the next ones.
    const free = Math.max(nextKey, ...current.map(({ key }) => key + 1));
    const withProblem = checked.find((newRow) => newRow.problem);
    if (withProblem) {
      setNewRows([...checked, { key: free, values: {} }]);
      setNextKey(free + 1);
      focusNew(withProblem.key);
      return;
    }
    const pending = filled.map((newRow) => {
      const kind = newRow.kind ?? defaultKind;
      return {
        id: pendingId(),
        request: table.request(
          columnsOn(columns, kind).map((column) =>
            column.change(newValue(newRow, column)),
          ),
          kind,
        ),
      };
    });
    setAdded(
      (current) => new Set([...current, ...pending.map(({ id }) => id)]),
    );
    actions.add(
      pending,
      (ids) => {
        setShownAs(
          (current) =>
            new Map([
              ...current,
              ...pending.map(
                ({ id }, index) => [String(ids.at(index)), id] as const,
              ),
            ]),
        );
      },
      // What was entered comes back above any new rows typed in since.
      () => {
        setNewRows((current) => [...filled, ...current]);
      },
    );
    setNewRows([{ key: free, values: {} }]);
    setNextKey(free + 2);
    setProblem(undefined);
    focusNew(free);
  };

  // Saves the cell being edited and goes on as the key that finished it asks: Enter adds a new row's
  // record or, on a record, moves down; Tab moves across, straight on to editing in a new row where
  // the next cell opens an editor; and
  // leaving the cell stays put. A refused value keeps the cell open, with the problem named; once
  // the cell is left, the cell shows its own value again.
  const finish = (cell: Cell, value: CellValue, how: Finish) => {
    if (!save(cell, value)) {
      // Only a record's value is refused, since a new row keeps what is typed until it is added.
      if (how === "leave") {
        setEditing(undefined);
        putBack();
      }
      return;
    }
    const { row, column } = at(cell);
    const key = column.key;
    if (how === "enter" && row.newRow) {
      setEditing(undefined);
      submitNewRows(
        newRows.map((newRow) =>
          newRow.key === row.newRow.key
            ? followingKind({
                key: newRow.key,
                ...kindKept(newRow),
                values: { ...newRow.values, [key]: value },
              })
            : newRow,
        ),
      );
      return;
    }
    if (how === "enter") {
      stopEdit({ ...cell, row: cell.row + 1 });
      return;
    }
    if (how === "leave") {
      setEditing(undefined);
      return;
    }
    const across = {
      ...cell,
      column: cell.column + (how === "next" ? 1 : -1),
    };
    const within = across.column >= 0 && across.column < columns.length;
    if (row.newRow && within && opensEditor(across)) {
      startEdit(across);
    } else {
      stopEdit(within ? across : cell);
    }
  };

  const onEditorKey = (event: KeyboardEvent, cell: Cell) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setProblem(undefined);
      stopEdit(cell);
    } else if (event.key === "Enter") {
      event.preventDefault();
      finish(cell, text, "enter");
    } else if (event.key === "Tab") {
      event.preventDefault();
      finish(cell, text, event.shiftKey ? "previous" : "next");
    }
  };

  const onCellKey = (event: KeyboardEvent, cell: Cell) => {
    if (event.target !== event.currentTarget) return;
    const { row, column } = at(cell);
    const plain = !event.altKey && !event.metaKey && !event.ctrlKey;
    const moves: Record<string, Cell> = {
      ArrowUp: { ...cell, row: cell.row - 1 },
      ArrowDown: { ...cell, row: cell.row + 1 },
      ArrowLeft: { ...cell, column: cell.column - 1 },
      ArrowRight: { ...cell, column: cell.column + 1 },
      Home: { ...cell, column: 0 },
      End: { ...cell, column: columns.length - 1 },
    };
    // Ctrl+Home and Ctrl+End, or Cmd with the same keys, go to the table's first and last cells.
    const corners: Record<string, Cell> = {
      Home: { row: 0, column: 0 },
      End: { row: rows.length - 1, column: columns.length - 1 },
    };
    const jump =
      (event.ctrlKey || event.metaKey) && !event.altKey
        ? corners[event.key]
        : undefined;
    const move = plain ? moves[event.key] : jump;
    if (move) {
      event.preventDefault();
      moveTo(move.row, move.column);
      return;
    }
    // Tab and Shift+Tab move across, on to the next or previous row at either end, and leave the
    // table only from its first or last cell.
    if (event.key === "Tab") {
      const step = event.shiftKey ? -1 : 1;
      const index = cell.row * columns.length + cell.column + step;
      if (index < 0 || index >= rows.length * columns.length) return;
      event.preventDefault();
      moveTo(Math.floor(index / columns.length), index % columns.length);
      return;
    }
    if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10")
    ) {
      event.preventDefault();
      if (row.record && hasMenu(row.record)) setMenuFor(row.record.id);
      if (row.newRow && clearable(row.newRow)) setMenuFor(rowKey(row));
      return;
    }
    if (!plain) return;
    if (row.record && locked(row.record)) {
      if (
        kindOf(column).inPanel === true &&
        (event.key === "Enter" || event.key === "F2")
      ) {
        event.preventDefault();
        startEdit(cell);
      }
      return;
    }
    if (event.key === "Enter" && row.newRow && !emptyNewRow(row.newRow)) {
      event.preventDefault();
      submitNewRows();
    } else if (
      event.key === "Enter" ||
      event.key === "F2" ||
      event.key === " "
    ) {
      event.preventDefault();
      startEdit(cell);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      if (readOnlyFor(column, rowKind(row)) || writingInPanel) return;
      if (!save(cell, emptyValue(column))) putBack();
    } else if (event.key.length === 1) {
      event.preventDefault();
      startEdit(cell, event.key);
    }
  };

  // Pasting rows into a new row adds a record for each, from the cell pasted into across.
  const onPaste = (event: ClipboardEvent, cell: Cell) => {
    const { row } = at(cell);
    const pasted = event.clipboardData.getData("text/plain");
    if (
      !row.newRow ||
      editing !== undefined ||
      writingInPanel ||
      pasted.trim() === ""
    ) {
      return;
    }
    event.preventDefault();
    const made = pastedRows(
      pasted,
      columns,
      cell.column,
      nextKey,
      rowKind(row),
    ).map((newRow) => followingKind({ ...newRow, ...kindKept(row.newRow) }));
    if (made.length > pasteLimit) {
      setProblem({
        row: rowKey(row),
        message: `Up to ${String(pasteLimit)} rows at once`,
      });
      return;
    }
    // Adding them takes the next keys past these rows.
    const kept = newRows.filter(
      (newRow) => newRow.key !== row.newRow.key && !emptyNewRow(newRow),
    );
    submitNewRows([...kept, ...made]);
  };

  const moveColumnBy = (column: Column<Rec, Change>, step: -1 | 1) => {
    const index = keys.indexOf(column.key);
    const to = index + step;
    if (to < 0 || to >= keys.length) return;
    const others = keys.filter((key) => key !== column.key);
    refreeze(frozenAsked, index, to);
    actions.moveColumn(column.key, column.label, others[to - 1] ?? null);
    focusSoon(headerId(column));
  };

  const onDrop = (event: DragEvent, onto: Column<Rec, Change>) => {
    event.preventDefault();
    const moved = columns.find(({ key }) => key === dragging);
    setDragging(undefined);
    if (moved === undefined) return;
    const after = droppedAfter(keys, moved.key, onto.key);
    if (after === undefined) return;
    const others = keys.filter((key) => key !== moved.key);
    refreeze(
      frozenAsked,
      keys.indexOf(moved.key),
      after === null ? 0 : others.indexOf(after) + 1,
    );
    actions.moveColumn(moved.key, moved.label, after);
  };

  const header = (column: Column<Rec, Change>, index: number) => {
    const { field } = column;
    const moved = orderShown && isMoved(column);
    // A moved column's own waiting draft is decided together with the waiting order that moves it;
    // once either is rejected, the order keeps a section of its own.
    const ownWaiting = field !== undefined && decidable(field);
    const joinedOrder =
      moved &&
      ownWaiting &&
      decidable({ draft: orderDraft, heldBy: orderHeldBy }) &&
      !orderWaits;
    // Someone else's unpublished changes to the column, or to the order, hold it.
    const changesColumn = canEditColumns && field?.heldBy === undefined;
    const movesColumns = canEditColumns && orderHeldBy === undefined;
    const deciding: DraftSelection = {
      ...noDrafts(),
      columns: ownWaiting ? [field.id] : [],
      columnOrder: joinedOrder,
    };
    const dragProps = movesColumns
      ? {
          draggable: true,
          // A press on the column's edge resizes it, which the browser would otherwise take as
          // dragging the whole header.
          onDragStart: (event: DragEvent) => {
            if (widths.resizing()) {
              event.preventDefault();
              return;
            }
            setDragging(column.key);
          },
          onDragOver: (event: DragEvent) => {
            event.preventDefault();
          },
          onDrop: (event: DragEvent) => {
            onDrop(event, column);
          },
        }
      : {};
    const frozenAt = frozenCell(index);
    return (
      <Table.Th
        key={column.key}
        scope="col"
        aria-sort={ariaSort(view, column.key)}
        className={[columnTint(column), frozenAt.className].join(" ")}
        style={frozenAt.style}
        {...dragProps}
      >
        <FilterPopover
          column={column}
          view={view}
          onView={onView}
          opened={filtering === column.key}
          onClose={() => {
            // Focus goes back to the column's header, not to the menu the filter was opened from.
            setFiltering(undefined);
            focusSoon(headerId(column));
          }}
        >
          <AppMenu position="bottom-start" withinPortal hideDetached={false}>
            <AppMenu.Target>
              <button
                id={headerId(column)}
                type="button"
                className={classes.recordHeadButton}
                aria-label={`${column.label} column${headerState(column, view)}`}
                onKeyDown={(event) => {
                  const step = widthSteps[event.key];
                  if (event.altKey && event.shiftKey && step !== undefined) {
                    event.preventDefault();
                    widths.step(column.key, index, step);
                    return;
                  }
                  if (!movesColumns || !event.altKey) return;
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    moveColumnBy(column, -1);
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    moveColumnBy(column, 1);
                  }
                }}
              >
                <span className={classes.headerName}>
                  <span className={classes.headerLabel}>{column.label}</span>
                  {field?.draft && !liveOnly && (
                    <DraftMark draft={field.draft} />
                  )}
                  {field && !liveOnly && <HoldMarks heldBy={field.heldBy} />}
                  {moved && (
                    <StatusMark
                      tone={
                        shownOrderDraft.state === "rejected"
                          ? "rejected"
                          : "draft"
                      }
                      spaced
                    >
                      {shownOrderDraft.state === "rejected"
                        ? "Rejected: moved"
                        : "Draft: moved"}
                    </StatusMark>
                  )}
                </span>
                <HeaderMarks column={column} view={view} />
              </button>
            </AppMenu.Target>
            <AppMenu.Dropdown>
              <MenuTitle>{column.label}</MenuTitle>
              {field?.heldBy !== undefined && !liveOnly && (
                <HeldNote by={field.heldBy} />
              )}
              {field?.draft?.unpublished === true && !liveOnly && (
                <UnpublishedNote />
              )}
              {field?.draft && !liveOnly && (
                <>
                  <MenuDraftLines
                    draft={field.draft}
                    lines={[
                      ...fieldDraftLines(field, lists),
                      ...(joinedOrder ? [movedLine(shownOrderDraft)] : []),
                    ]}
                    divider={
                      (ownWaiting && mayDecide(approves, deciding)) ||
                      changesColumn
                    }
                  />
                  {/* One decision for the column's draft and the order that moves it, among those
                      waiting: a rejected draft is back with its makers until they send it again. */}
                  {ownWaiting && mayDecide(approves, deciding) && (
                    <>
                      <Menu.Item
                        disabled={field.draft.needsOtherApprover === true}
                        onClick={() => {
                          actions.decide("approve", deciding, true);
                        }}
                      >
                        Approve…
                      </Menu.Item>
                      {field.draft.needsOtherApprover === true && (
                        <OtherApproverNote />
                      )}
                      <Menu.Item
                        onClick={() => {
                          actions.decide("reject", deciding, true);
                        }}
                      >
                        Reject…
                      </Menu.Item>
                    </>
                  )}
                  {changesColumn && field.draft.state === "rejected" && (
                    <Menu.Item
                      onClick={() => {
                        actions.resubmitColumn({
                          kind: "column",
                          id: field.id,
                        });
                      }}
                    >
                      Resubmit
                    </Menu.Item>
                  )}
                  {changesColumn && (
                    <Menu.Item
                      onClick={() => {
                        actions.discardColumn(
                          { kind: "column", id: field.id },
                          field.name,
                        );
                      }}
                    >
                      Discard draft
                    </Menu.Item>
                  )}
                  {joinedOrder && (
                    <OrderItems
                      draft={shownOrderDraft}
                      canEdit={movesColumns}
                      canApprove={approvesOrder}
                      actions={actions}
                      waits={false}
                      withColumnDraft
                    />
                  )}
                  <Menu.Divider />
                </>
              )}
              <ColumnViewItems
                column={column}
                view={view}
                onView={onView}
                onFilter={() => {
                  setFiltering(column.key);
                }}
                breaksDown={breaksDown(column)}
              />
              <Menu.Divider />
              {index + 1 !== frozenAsked && (
                <Menu.Item
                  leftSection={<Icon name="freeze" />}
                  disabled={frozen.fits.at(index) !== true}
                  onClick={() => {
                    freeze(index + 1);
                  }}
                >
                  Freeze up to this column
                </Menu.Item>
              )}
              {frozenAsked > 0 && (
                <Menu.Item
                  onClick={() => {
                    freeze(0);
                  }}
                >
                  Unfreeze columns
                </Menu.Item>
              )}
              <Menu.Item
                rightSection={<kbd>{shortcuts.wider}</kbd>}
                disabled={!widths.canWiden(column.key, index)}
                onClick={() => {
                  widths.step(column.key, index, 1);
                }}
              >
                Wider
              </Menu.Item>
              <Menu.Item
                rightSection={<kbd>{shortcuts.narrower}</kbd>}
                disabled={!widths.canNarrow(column.key, index)}
                onClick={() => {
                  widths.step(column.key, index, -1);
                }}
              >
                Narrower
              </Menu.Item>
              {widths.setWidthOf(column.key) !== undefined && (
                <Menu.Item
                  onClick={() => {
                    widths.reset(column.key);
                  }}
                >
                  Reset width
                </Menu.Item>
              )}
              {canEditColumns && (changesColumn || movesColumns) && (
                <>
                  <Menu.Divider />
                  {changesColumn &&
                    field &&
                    field.draft?.action !== "deleted" && (
                      <Menu.Item
                        onClick={() => {
                          actions.editColumn(field);
                        }}
                      >
                        Edit column
                      </Menu.Item>
                    )}
                  {movesColumns && (
                    <>
                      <Menu.Item
                        rightSection={<kbd>{shortcuts.left}</kbd>}
                        onClick={() => {
                          moveColumnBy(column, -1);
                        }}
                      >
                        Move left
                      </Menu.Item>
                      <Menu.Item
                        rightSection={<kbd>{shortcuts.right}</kbd>}
                        onClick={() => {
                          moveColumnBy(column, 1);
                        }}
                      >
                        Move right
                      </Menu.Item>
                    </>
                  )}
                </>
              )}
              {/* A moved column's menu decides the order that moves it, as a drafted record's does. */}
              {moved && !joinedOrder && (canEditColumns || approvesOrder) && (
                <OrderItems
                  draft={shownOrderDraft}
                  canEdit={canEditColumns}
                  canApprove={approvesOrder}
                  actions={actions}
                  waits={orderWaits}
                  heldBy={orderHeldBy}
                />
              )}
            </AppMenu.Dropdown>
          </AppMenu>
        </FilterPopover>
        <ResizeEdge
          className={classes.columnEdge}
          {...widths.edge(column.key, index)}
        />
      </Table.Th>
    );
  };

  // The problem in a cell, if any: one saving its value found, or one found in it when its new row
  // was added.
  const problemIn = (cell: Cell): string | undefined => {
    const { row, column } = at(cell);
    const key = rowKey(row);
    if (problem?.row === key) {
      return problem.column === column.key ? problem.message : undefined;
    }
    if (row.newRow === undefined) return undefined;
    if (row.newRow.problem !== undefined) {
      return row.newRow.problemAt === column.key
        ? row.newRow.problem
        : undefined;
    }
    const wrong = row.newRow.soFar;
    return wrong?.column === column.key ? wrong.message : undefined;
  };

  // The problem named under a row, in its first cell, if any: one saving a value found, or one
  // found when its new row was added.
  const rowProblemOf = (row: Row<Rec>): string | undefined =>
    problem?.row === rowKey(row) ? problem.message : row.newRow?.problem;

  // The element naming the problem in the cell being edited, when it is shown: under the row, or in
  // a new row's mark, which is hidden while the row's first cell is edited.
  const problemTarget = (cell: Cell): string | undefined => {
    const { row } = at(cell);
    const shown =
      rowProblemOf(row) !== undefined ||
      (row.newRow?.soFar !== undefined && cell.column !== 0);
    return problemIn(cell) !== undefined && shown
      ? `${cellId(cell.row, 0)}-problem`
      : undefined;
  };

  const newRowMenu = (row: Row<Rec> & { newRow: NewRow }) => {
    const key = rowKey(row);
    return (
      <Menu
        opened={menuFor === key}
        onChange={(opened) => {
          setMenuFor(opened ? key : undefined);
        }}
        position="bottom-end"
        withinPortal
        hideDetached={false}
      >
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            // Tab moves between cells; the menu also opens with Shift+F10 on any of the row's cells.
            tabIndex={-1}
            aria-label={`Actions for ${table.newRowLabel(rowKind(row)).toLowerCase()}`}
          >
            <Icon name="more" />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown
          onClick={closesOnBlankClick(() => {
            setMenuFor(undefined);
          })}
        >
          <MenuTitle>{table.newRowLabel(rowKind(row))}</MenuTitle>
          <Menu.Item
            onClick={() => {
              clearNewRow(row.newRow);
            }}
          >
            Clear row
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  };

  const editor = (
    cell: Cell,
    column: Column<Rec, Change>,
    value: CellValue,
  ) => {
    const id = `${cellId(cell.row, cell.column)}-editor`;
    const { Editor, asTyped } = kindOf(column);
    const invalid = problemIn(cell) !== undefined;
    const describedBy = problemTarget(cell);
    if (Editor !== undefined) {
      return (
        <Editor
          id={id}
          column={column}
          value={value}
          typed={text}
          invalid={invalid}
          describedBy={describedBy}
          readOnly={readOnlyAt(cell)}
          onDone={(edited, how) => {
            finish(cell, edited, how);
          }}
          onCancel={() => {
            stopEdit(cell);
          }}
        />
      );
    }
    return (
      <input
        id={id}
        className={[
          classes.recordEditor,
          invalid ? classes.recordEditorInvalid : "",
        ].join(" ")}
        aria-label={column.label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={text}
        autoComplete="off"
        onChange={(event) => {
          const typedText = event.currentTarget.value;
          setText(asTyped?.(typedText) ?? typedText);
        }}
        onKeyDown={(event) => {
          onEditorKey(event, cell);
        }}
        onBlur={() => {
          finish(cell, text, "leave");
        }}
      />
    );
  };

  const rowMenu = (
    record: Rec,
    draft = record.draft as DraftOf<Rec> | undefined,
    ownItems = table.menuItems?.(record),
  ) => (
    <Menu
      opened={menuFor === record.id}
      onChange={(opened) => {
        setMenuFor(opened ? record.id : undefined);
      }}
      position="bottom-end"
      withinPortal
      hideDetached={false}
    >
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          // Tab moves between cells; the menu also opens with Shift+F10 on any of the row's cells.
          tabIndex={-1}
          aria-label={`Actions for ${table.nameOf(record)}`}
        >
          <Icon name="more" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown
        onClick={closesOnBlankClick(() => {
          setMenuFor(undefined);
        })}
      >
        {/* Names whose menu it is, and gives every menu somewhere to click that closes it. */}
        <MenuTitle>{table.nameOf(record)}</MenuTitle>
        {/* Who holds the record matters only to those who may change or decide it. */}
        {record.heldBy !== undefined &&
          (mayChange(record) || approvesRecord(record)) && (
            <HeldNote by={record.heldBy} />
          )}
        {draft?.unpublished === true && <UnpublishedNote />}
        {draft && (
          <MenuDraftLines
            draft={draft}
            lines={draftLines(
              draft,
              table.draftFields(record, draft, fields, lists),
            )}
            // Set apart from the items after it, when any are offered.
            divider={
              (mayChange(record) && record.heldBy === undefined) ||
              (decidable(record) && approvesRecord(record)) ||
              Boolean(ownItems)
            }
          />
        )}
        {columns.map((column) => {
          const { MenuItem } = kindOf(column);
          return (
            MenuItem && (
              <MenuItem
                key={column.key}
                name={column.label}
                value={column.value(record)}
              />
            )
          );
        })}
        {ownItems}
        {/* A rejected draft is back with its makers, until they send it again. */}
        {decidable(record) && approvesRecord(record) && (
          <>
            {Boolean(ownItems) && <Menu.Divider />}
            <Menu.Item
              disabled={record.draft?.needsOtherApprover === true}
              onClick={() => {
                actions.decide("approve", table.drafts([record.id]));
              }}
            >
              Approve draft
            </Menu.Item>
            {record.draft?.needsOtherApprover === true && <OtherApproverNote />}
            <Menu.Item
              onClick={() => {
                actions.decide("reject", table.drafts([record.id]));
              }}
            >
              Reject draft…
            </Menu.Item>
          </>
        )}
        {mayChange(record) && record.heldBy === undefined && (
          <>
            {((decidable(record) && approvesRecord(record)) ||
              Boolean(ownItems)) && <Menu.Divider />}
            {draft?.state === "rejected" && (
              <Menu.Item
                onClick={() => {
                  actions.resubmit(record);
                }}
              >
                Resubmit
              </Menu.Item>
            )}
            {draft && (
              <Menu.Item
                onClick={() => {
                  actions.discard(record, draft);
                  moveTo(active.row, active.column);
                }}
              >
                Discard draft
              </Menu.Item>
            )}
            {draft?.action !== "created" && draft?.action !== "deleted" && (
              <Menu.Item
                color="red"
                onClick={() => {
                  actions.remove(record);
                  moveTo(active.row, active.column);
                }}
              >
                {table.removeLabel(record)}
              </Menu.Item>
            )}
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );

  // The drafts waiting among the records and columns shown, which Approvers approve or reject all at
  // once.
  const waitingShown: DraftSelection = {
    ...table.drafts(
      shownRecords
        .filter((record) => decidable(record) && approvesRecord(record))
        .map(({ id }) => id),
    ),
    columns: approves.includes("field")
      ? fields
          .filter(
            (field) =>
              decidable(field) && columns.some(({ key }) => key === field.id),
          )
          .map(({ id }) => id)
      : [],
    columnOrder:
      approvesOrder &&
      orderDraft !== undefined &&
      decidable({ draft: orderDraft, heldBy: orderHeldBy }),
  };
  const waitingTotal = draftTotal(waitingShown);

  // A column only drafted to be added, or to draw on another list, has no live figures to compare.
  const liveForMetrics = (column: Column<Rec, Change>) => {
    const draft = column.field?.draft;
    if (draft?.action === "created") return undefined;
    if (fieldsLive.get(column.key)?.listId !== column.field?.listId) {
      return undefined;
    }
    return liveBeside(column) ?? liveColumn(column);
  };
  const metrics = view.breakdown !== undefined && (
    <MetricsPanel
      one={table.one}
      noun={table.noun}
      kinds={table.counted}
      {...countedRecords(
        view.show,
        shownRecords,
        columns,
        liveForMetrics,
        table.liveRecords,
      )}
      offered={columns.filter(breaksDown)}
      breakdown={view.breakdown}
      onBreakdown={(breakdown) => {
        onView({ ...view, breakdown });
      }}
      onClose={() => {
        onView({ ...view, breakdown: undefined });
        focusSoon(metricsButtonId);
      }}
    />
  );

  const cellPanel = ((): SidePanel[] => {
    if (inPanel === undefined) return [];
    const { column, readOnly } = inPanel;
    // A kind edited in the side panel has an editor.
    const Editor = kindOf(column).Editor as (props: EditorProps) => ReactNode;
    // The record as it is now while its row is shown, or as it was when the panel opened.
    const row = editing === undefined ? inPanel.row : at(editing).row;
    const key = rowKey(row);
    const id = `cell-${key}-${column.key}-editor`;
    const refused =
      problem?.row === key && problem.column === column.key
        ? problem.message
        : undefined;
    // The panel closes, and the cell it opened from, if shown, has focus again.
    const close = () => {
      setEditing(undefined);
      if (editing !== undefined) moveTo(editing.row, editing.column);
    };
    return [
      {
        key: "cell",
        id: `${id}-panel`,
        name: column.label,
        node: (
          <Editor
            key={id}
            id={id}
            column={column}
            value={valueAt(row, column)}
            typed=""
            invalid={refused !== undefined}
            problem={refused}
            readOnly={readOnly}
            onWriting={setPanelWriting}
            onDone={(edited) => {
              // A refused value keeps the panel open, with what was written and why.
              if (saveTo(row, column, edited)) close();
            }}
            onCancel={() => {
              setProblem(undefined);
              close();
            }}
          />
        ),
      },
    ];
  })();
  const sidePanels: SidePanel[] = [
    ...panels,
    ...cellPanel,
    ...(metrics === false
      ? []
      : [
          {
            key: "metrics",
            id: metricsPanelId,
            name: "metrics",
            node: metrics,
          },
        ]),
  ];

  // Menus and choices stay shown beside their cell however the table scrolls, so they are not hidden
  // when the cell is partly out of view.
  return (
    <WithSidePanel panels={sidePanels} storageKey="fathom-table-panel-width">
      <ViewBar
        one={table.one}
        noun={table.noun}
        columns={columns}
        draftFilter={draftColumn}
        view={view}
        onView={onView}
        shown={shownRecords.length}
        total={records.length}
        counted={table.counted?.counted(records)}
        groupings={table.groupings}
        onLeave={() => {
          moveTo(active.row, active.column);
        }}
        saved={saved}
        draftItems={
          <>
            {waitingTotal > 0 && (
              <DecideAllItems
                total={waitingTotal}
                everywhere={
                  everyone.filter(({ draft }) => draft?.state === "waiting")
                    .length +
                  draftedFields.filter(
                    ({ draft }) => draft?.state === "waiting",
                  ).length +
                  (orderDraft?.state === "waiting" ? 1 : 0)
                }
                disabled={saving}
                onDecide={(asking) => {
                  actions.decide(asking, waitingShown);
                }}
              />
            )}
            {orderShown && (canEditColumns || approvesOrder) && (
              <OrderItems
                draft={shownOrderDraft}
                canEdit={canEditColumns}
                canApprove={approvesOrder}
                actions={actions}
                waits={orderWaits}
                heldBy={orderHeldBy}
              />
            )}
          </>
        }
      />
      <Paper
        ref={panelRef}
        withBorder
        className={classes.tableScrollPanel}
        style={frozenVariables(frozen)}
      >
        <div
          ref={scrollRef}
          className={classes.tableScroll}
          // Cells reached from the keyboard scroll clear of the header, however many lines of marks
          // it has under the columns' names, and of the frozen columns.
          style={{
            scrollPaddingTop: `max(var(--fathom-table-head-height), ${String(
              markLines + 1,
            )} * ${headerLineHeight} + ${headerPadding})`,
          }}
          onScroll={(event) => {
            setScrolled(event.currentTarget.scrollLeft > 0);
          }}
        >
          <Table
            role="grid"
            aria-label={table.label}
            className={classes.recordTable}
            layout="fixed"
            tabularNums
          >
            <colgroup>
              {columns.flatMap((column, columnIndex) => {
                const live = liveBeside(column);
                return [
                  <col
                    key={column.key}
                    data-column={column.key}
                    className={
                      columnIndex === 0
                        ? classes.recordColFirst
                        : classes.recordCol
                    }
                    style={widthStyle(
                      columnWidth(column, longestText),
                      widths.setWidthOf(column.key),
                    )}
                  />,
                  live && (
                    <col
                      key={`${column.key}-live`}
                      data-column={column.key}
                      className={classes.recordCol}
                      style={widthStyle(
                        columnWidth(live, longestText),
                        widths.setWidthOf(column.key),
                      )}
                    />
                  ),
                ];
              })}
              {withActions && <col className={classes.recordColActions} />}
            </colgroup>
            <Table.Thead>
              <Table.Tr>
                {columns.flatMap((column, columnIndex) => {
                  const live = liveBeside(column);
                  const liveAt = frozenCell(columnIndex, 1);
                  return [
                    header(column, columnIndex),
                    live && (
                      <Table.Th
                        key={`${column.key}-live`}
                        scope="col"
                        aria-hidden="true"
                        className={[classes.liveColumn, liveAt.className].join(
                          " ",
                        )}
                        style={liveAt.style}
                      >
                        <span className={classes.recordHeadButton}>
                          <span className={classes.headerName}>
                            <span className={classes.headerLabel}>
                              {live.label}
                            </span>
                            <StatusMark tone="live" spaced>
                              Live
                            </StatusMark>
                          </span>
                        </span>
                      </Table.Th>
                    ),
                  ];
                })}
                {withActions && (
                  <Table.Th scope="col">
                    <VisuallyHidden>Actions</VisuallyHidden>
                  </Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shownRecords.length === 0 && narrows(view) && (
                <Table.Tr>
                  <Table.Td
                    colSpan={
                      columns.length + besides.length + Number(withActions)
                    }
                    className={classes.recordNone}
                  >
                    <Text component="span" fz="sm" c="dimmed">
                      No matching {table.noun}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {rows.map((row, rowIndex) => {
                const key = rowKey(row);
                const rowProblem =
                  problem?.row === key ? problem.message : row.newRow?.problem;
                const record = row.record;
                const draft = record?.draft as DraftOf<Rec> | undefined;
                // A row with a draft is tinted, and one a draft removes is struck through too.
                let rowClass: string | undefined;
                const filling = row.newRow && !emptyNewRow(row.newRow);
                if (row.newRow) {
                  rowClass = filling ? classes.recordFillingRow : undefined;
                } else if (draft) {
                  rowClass = [
                    classes.draftRow,
                    draft.action === "deleted" ? classes.recordRemovedRow : "",
                  ].join(" ");
                }
                const heading = headings.get(key);
                return [
                  heading !== undefined && (
                    <Table.Tr key={`group-${key}`}>
                      <Table.Th
                        scope="row"
                        colSpan={
                          columns.length + besides.length + Number(withActions)
                        }
                        className={classes.recordGroup}
                      >
                        <span className={classes.recordGroupLabel}>
                          {heading.label}
                          <Text component="span" fz="sm" c="dimmed" ml="xs">
                            {heading.count}
                            <VisuallyHidden>
                              {` ${heading.count === 1 ? table.one : table.noun}`}
                            </VisuallyHidden>
                          </Text>
                        </span>
                      </Table.Th>
                    </Table.Tr>
                  ),
                  <Table.Tr
                    key={key}
                    className={rowClass}
                    aria-label={
                      row.newRow ? table.newRowLabel(rowKind(row)) : undefined
                    }
                  >
                    {columns.flatMap((column, columnIndex) => {
                      const cell = { row: rowIndex, column: columnIndex };
                      const has = offered(column, rowKind(row));
                      const editingHere =
                        editing?.row === rowIndex &&
                        editing.column === columnIndex &&
                        inPanel === undefined;
                      const isActive =
                        active.row === rowIndex &&
                        active.column === columnIndex;
                      const changes = draftChanges(draft, column);
                      const frozenAt = frozenCell(columnIndex);
                      const live =
                        changes && draft?.action === "changed"
                          ? shown(liveColumn(column), column.live(draft)) ||
                            "empty"
                          : undefined;
                      return [
                        <Table.Td
                          key={column.key}
                          id={cellId(rowIndex, columnIndex)}
                          role="gridcell"
                          tabIndex={isActive ? 0 : -1}
                          aria-invalid={
                            (columnIndex === 0 && rowProblem !== undefined) ||
                            problemIn(cell) !== undefined
                              ? true
                              : undefined
                          }
                          className={[
                            classes.recordCell,
                            columnTint(column),
                            changes
                              ? draft?.state === "rejected"
                                ? classes.rejectedCell
                                : classes.draftCell
                              : "",
                            // While edited, the editor is marked instead.
                            problemIn(cell) === undefined || editingHere
                              ? ""
                              : classes.recordProblemCell,
                            frozenAt.className,
                          ].join(" ")}
                          style={frozenAt.style}
                          aria-readonly={
                            readOnlyFor(column, rowKind(row)) ||
                            (row.record &&
                              table.readOnlyRecord?.(row.record)) ||
                            draft?.action === "deleted" ||
                            row.record?.heldBy !== undefined ||
                            (row.record && isPending(row.record))
                              ? true
                              : undefined
                          }
                          onKeyDown={(event) => {
                            onCellKey(event, cell);
                          }}
                          onPaste={(event) => {
                            onPaste(event, cell);
                          }}
                          onFocus={(event) => {
                            if (event.target === event.currentTarget) {
                              setActive(cell);
                            }
                          }}
                          onClick={() => {
                            const kind = kindOf(column);
                            if (
                              kind.toggled !== undefined ||
                              kind.inPanel === true
                            ) {
                              startEdit(cell);
                            }
                          }}
                          onDoubleClick={() => {
                            if (kindOf(column).toggled === undefined) {
                              startEdit(cell);
                            }
                          }}
                        >
                          {editingHere
                            ? editor(
                                cell,
                                onRow(column, row.record, rowKind(row)),
                                valueAt(row, column),
                              )
                            : has &&
                              (standInAt(row, column) === undefined ? (
                                cellContent(column, valueAt(row, column))
                              ) : (
                                <Text
                                  component="span"
                                  inherit
                                  c="dimmed"
                                  fs="italic"
                                >
                                  {standInAt(row, column)}
                                </Text>
                              ))}
                          {row.record &&
                            !editingHere &&
                            column.mark?.(row.record)}
                          {changes && !editingHere && (
                            <VisuallyHidden>
                              {live === undefined
                                ? ", draft"
                                : `, draft, live ${live}`}
                            </VisuallyHidden>
                          )}
                          {columnIndex === 0 && draft && !editingHere && (
                            <DraftMark draft={draft} />
                          )}
                          {columnIndex === 0 && row.record && !editingHere && (
                            <HoldMarks heldBy={row.record.heldBy} />
                          )}
                          {columnIndex === 0 &&
                            row.newRow &&
                            filling &&
                            rowProblem === undefined &&
                            !editingHere && (
                              <NewMark
                                wrong={row.newRow.soFar?.message}
                                id={`${cellId(rowIndex, 0)}-problem`}
                                missing={columnsOn(columns, rowKind(row))
                                  .filter(
                                    (other) =>
                                      other.required &&
                                      isEmpty(newValue(row.newRow, other)),
                                  )
                                  .map(({ label }) => label)}
                              />
                            )}
                          {columnIndex === 0 && rowProblem !== undefined && (
                            <span
                              id={`${cellId(rowIndex, 0)}-problem`}
                              className={classes.recordProblem}
                              role="alert"
                            >
                              {rowProblem}
                            </span>
                          )}
                        </Table.Td>,
                        liveCellBeside(row.record, column, columnIndex),
                      ];
                    })}
                    {withActions && (
                      <Table.Td
                        className={[
                          classes.recordCell,
                          classes.recordActionsCell,
                        ].join(" ")}
                      >
                        {row.record &&
                          hasMenu(row.record) &&
                          rowMenu(row.record)}
                        {row.newRow &&
                          clearable(row.newRow) &&
                          newRowMenu({ newRow: row.newRow })}
                      </Table.Td>
                    )}
                  </Table.Tr>,
                  // Under a record whose draft changes it, the record as it is live, to compare.
                  // Assistive technology hears each changed cell's live value instead.
                  record !== undefined &&
                    draft?.action === "changed" &&
                    view.show === "both" && (
                      <Table.Tr
                        key={`${key}-live`}
                        className={classes.recordLiveRow}
                        aria-hidden="true"
                      >
                        {columns.flatMap((column, columnIndex) => {
                          const standIn = liveStandIn(record, column);
                          const frozenAt = frozenCell(columnIndex);
                          return [
                            <Table.Td
                              key={column.key}
                              className={[
                                classes.recordCell,
                                frozenAt.className,
                              ].join(" ")}
                              style={frozenAt.style}
                            >
                              {standIn === undefined ? (
                                liveContent(
                                  liveColumn(column),
                                  changedIn(draft, column)
                                    ? column.live(draft)
                                    : column.value(record),
                                )
                              ) : (
                                <Text
                                  component="span"
                                  inherit
                                  c="dimmed"
                                  fs="italic"
                                >
                                  {standIn}
                                </Text>
                              )}
                              {columnIndex === 0 && (
                                <StatusMark tone="live" spaced>
                                  Live
                                </StatusMark>
                              )}
                            </Table.Td>,
                            liveCellBeside(row.record, column, columnIndex),
                          ];
                        })}
                        {withActions && (
                          <Table.Td className={classes.recordCell} />
                        )}
                      </Table.Tr>
                    ),
                ];
              })}
            </Table.Tbody>
          </Table>
        </div>
        {frozen.frozen > 0 && (
          <div
            aria-hidden="true"
            className={classes.frozenEdge}
            data-scrolled={scrolled || undefined}
            style={{ height: measured.height }}
          />
        )}
      </Paper>
    </WithSidePanel>
  );
}
