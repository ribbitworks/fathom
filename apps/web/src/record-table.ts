// SPDX-License-Identifier: Apache-2.0

// What a page gives the shared table: its records and their drafts, its columns, what it does
// with them, and the props the table takes.

import type { Refusal } from "./api.ts";
import type { Adding } from "./choice-picker.tsx";
import type {
  Asking,
  Choice,
  DecidedKind,
  ExportedTable,
  Field,
  List,
  RecordKeyOf,
  RecordRef,
  Show,
  Tier,
} from "@fathom/shared";
import type { ReactNode } from "react";
import { type CellSource, chosenColour } from "./cell-kinds.tsx";
import type { Credited, DraftField } from "./draft-details.tsx";
import type { DecidedBy, DraftSelection } from "./drafts.ts";
import type { HeldDetail } from "./exports.ts";
import type { RowTicks } from "./row-ticks.tsx";
import type { SidePanel } from "./side-panel.tsx";
import type { DraftedPart } from "./status-mark.tsx";
import type { DraftLike } from "./draft-marks.ts";
import type { PageFilter } from "./filter-pills.tsx";
import type {
  ChangeView,
  PageParts,
  SavedViews,
  ViewChoice,
} from "./table-controls.tsx";
import type {
  BarFilter,
  CellValue,
  ColumnUnit,
  TableColumn,
  View,
} from "./table-view.ts";
import type { GroupingChoice, RowGroups } from "./row-groups.ts";

// A record's draft, as the table shows it: what it does, the columns it changes, by key, and who
// made it.
export interface GridDraft extends DraftLike, Credited {
  action: "created" | "changed" | "deleted";
  changed: string[];
  // Changed by this account, whose role does not let it approve its own drafts.
  needsOtherApprover?: boolean | undefined;
  // This account may discard it, as the server says.
  discardable?: boolean | undefined;
}

// A record the table shows: as its draft, if any, makes it, with the draft beside, and who else
// holds it by having unpublished changes to it.
export interface GridRecord {
  id: string;
  draft?: GridDraft | undefined;
  heldBy?: string | undefined;
  // The drafts other than the row's own that change a value the row shows, such as another
  // record's or the record's parts', by its column's key, each marking its own cell in place of the
  // row's draft.
  cellDrafts?: ReadonlyMap<string, NonNullable<this["draft"]>> | undefined;
}

export type DraftOf<Rec extends GridRecord> = NonNullable<Rec["draft"]>;

export interface RecordActions<Rec extends GridRecord, Change, Request> {
  // Adds records, all saved together, showing each at once under the identifier given until saved,
  // then gives their own identifiers; if they cannot be saved, gives back what was entered, and the
  // server's refusal of a value to name under its field, where it can, in place of a notification.
  add: (
    records: { id: string; request: Request }[],
    onAdded: (ids: string[]) => void,
    onFailed: () => void,
    onRefused?: (refusal: Refusal) => boolean,
  ) => void;
  update: (record: Rec, change: Change) => void;
  // Asks to approve or reject the drafts chosen, of records or columns.
  // Approving all those waiting skips the drafts another approver must approve.
  decide: (asking: Asking, selection: DraftSelection, all?: boolean) => void;
  remove: (record: Rec) => void;
  discard: (record: Rec, draft: DraftOf<Rec>) => void;
  // Sends a rejected draft for approval again, unchanged.
  resubmit: (record: Rec, draft: DraftOf<Rec>) => void;
  // The record a draft is of, where the table's drafts name only those that can be decided, so
  // the user's own unpublished draft is published by it.
  draftRef?: ((record: Rec, draft: DraftOf<Rec>) => RecordRef) | undefined;
  // Absent where a table's columns can't be edited yet, as a private page's.
  editColumn?: ((field: Field) => void) | undefined;
  // Removes an added column, for a role that may: as a draft, or, on a table without drafts, once
  // asked, calling back once it's removed or kept.
  removeColumn?:
    | ((field: Field, after: { removed: () => void; kept: () => void }) => void)
    | undefined;
  // Whether removing a column asks first, as it does on a table without drafts.
  removeColumnAsks?: boolean | undefined;
  // Moves an approved column to another class, for a role with Classify data on a table whose
  // columns may be in any class.
  moveColumnClass?: ((field: Field, from: Tier) => void) | undefined;
  // Discards a draft of a column, or sends a rejected one again.
  discardColumn: (id: string, name: string) => void;
  resubmitColumn: (id: string) => void;
}

type PartDraft =
  | (Omit<DraftLike, "action"> & {
      action: NonNullable<DraftLike["action"]>;
    })
  | undefined;

// A record in a list a row shows, as drafted or as live, with what a draft does to it there, if
// anything: another record naming the row's, by that record's own draft, or one the row's own
// field lists, by the row's draft.
export interface NamingPart {
  record: {
    id: string;
    name: string;
    externalId?: string | null;
  };
  part: DraftedPart | undefined;
  live: boolean;
  // The draft that adds the record to the list or takes it away.
  draft: PartDraft;
}

// Where the records a record lists show, filtered to it, such as its activities on Activities.
export interface ShowOn {
  page: string;
  onShow: () => void;
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
  // For number columns: the least and most a value may be.
  least?: number;
  most?: number;
  // Set for a column whose values follow from another's, which is edited instead, or from saving, as
  // a key's do. Its change is never asked for: a new record asks nothing of it, and its cells and
  // details are never edited.
  readOnly?: boolean;
  // The key of the column whose drafts change this one's values, when another's do.
  changesWith?: string;
  // Set to depart from the kind's rule, such as false for a column with a choice for each record, or
  // "unless required" for an added text column, which the built-in ones of its kind don't share.
  breaksDown?: boolean | "unless required";
  // What a record's cell shows in place of its value in words, such as labels in a team's colours,
  // after its colour's square where it has one, in its Live row too, given the record as it is live.
  content?: (record: Rec) => ReactNode;
  // The records a choice column offers, so a link to one names it in full, such as a project by its
  // Project ID and name.
  named?: readonly NamingPart["record"][];
  // What a record's details show for it, empty or not, in place of its value, such as a list with
  // actions on it.
  details?: (record: Rec) => ReactNode;
  // For a details row listing records, the page showing them all, filtered to the record, which the
  // row's name opens and the record's menu offers, where the record has any.
  showOn?: (record: Rec) => ShowOn | undefined;
  // For a column listing records, each of them, as drafted and as live, given the row's record, so a
  // details panel marks them as the cell does.
  parts?: (record: Rec) => readonly NamingPart[];
  // What a Live row's cell shows, given the record as it is live, where it differs from content's,
  // such as parts other records' drafts change, drawn as they are live.
  liveContent?: (record: Rec) => ReactNode;
  // The colour of a record's value, such as its team's, drawn as the colour's square between a
  // draft's dot and the value's words, in its Live row too, given the record as it is live.
  colour?: (record: Rec) => string | null;
  // Set for a column whose content marks each part a draft adds or removes, such as a month's teams,
  // so its cells get no mark, words for an empty value, or Live mark of their own.
  marksParts?: boolean;
  // Whether a record's cell is shaded, such as a month outside someone's employment.
  shaded?: (record: Rec) => boolean;
  // Whether the column is the period holding today, such as the current month, its heading
  // underlined in today's red, as a strip's current period is.
  current?: boolean;
  // How many characters the column's cells fit, in place of what its kind works out.
  cellChars?: number;
  // Whether the heading alone is centred, over cells that place their own content, such as a month's;
  // a kind that centres its cells, such as a checkbox, centres its heading with them.
  headingCentred?: boolean;
  live: (draft: DraftOf<Rec>) => CellValue;
  change: (value: CellValue) => Change;
  // Shown after a record's value, such as a button that opens it.
  mark?: (record: Rec) => ReactNode;
  // The class of a record, such as a list's, marked before its value and read aloud after it.
  recordClass?: (record: Rec) => Tier;
  // Facts about a record, such as Built in, in boxes after its value and before its draft's box.
  facts?: (record: Rec) => ReactNode;
  // For a column naming other records, for a role that may add one: the kind it adds, such as
  // customer, whether its new row's picker offers it too, filling the row, and what opens its form,
  // named by what was typed, with what puts focus back where the picker was once the form closes.
  adds?: {
    one: string;
    fillsNewRow?: boolean;
    onNew: (to: AddedTo, typed: string, back: () => void) => void;
  };
  // For a column listing records: in a record's details, the words of the button under the list
  // that opens its picker, in place of the row's pencil, beside New where the column offers it.
  chooseWords?: string;
  // A warning about a record's value, its dot before the value and its words after it.
  status?: (record: Rec) => { words: string; spoken?: string } | undefined;
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
  // For a column the reader may show in one of several units: the units offered, the first of which
  // it starts in, the decimal places offered and those it starts with, and the column as shown in
  // each unit.
  units?: ColumnUnits & {
    shownIn: (unit: ColumnUnit, places: number) => Column<Rec, Change>;
  };
}

// The units a column offers, the first of which it starts in, and the decimal places it offers, with
// those it starts with.
export interface ColumnUnits {
  offered: readonly [ColumnUnit, ...ColumnUnit[]];
  places: { offered: readonly number[]; starting: number };
}

// The colour a record's value is drawn in: the column's own for the record, or that of the one
// choice the value holds.
export const colourOf = <Rec extends GridRecord, Change>(
  column: Column<Rec, Change>,
  record: Rec,
): string | null =>
  column.colour?.(record) ?? chosenColour(column, column.value(record));

// What is particular to a kind of record: what its table and rows are called, its columns, how its
// records are as they are live, what adding one asks for, what is wrong with one taken whole, and
// which drafts name it.
export interface RecordTable<Rec extends GridRecord, Change, Request> {
  // The table's name, for assistive technology, such as "People".
  label: string;
  one: string;
  noun: string;
  // What the table says while it has no records, where not "No" and its noun with "yet", such as
  // "No drafts" for drafts, which come and go.
  none?: string;
  // Whether the empty row alone shows while the table has no records, with no line saying so, as
  // on a private page, typed in like a spreadsheet. A search finding nothing still says so. Only for
  // a table whose viewers can always add to it, since it has no empty row otherwise.
  emptyRowAlone?: boolean;
  // For a table of several kinds of record, how many of each some records are, which Metrics counts.
  countKinds?: (records: readonly Rec[]) => string;
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
  // Why a record can't be removed now, such as another record naming it, said in a line under its
  // menu's Remove, which is turned off; none while it can be.
  removeTurnedOff?: (record: Rec) => string | undefined;
  // Whether a record can ever be removed, such as a list Fathom builds in, which can't; every
  // record can, where the table doesn't say.
  removable?: (record: Rec) => boolean;
  nameOf: (record: Rec) => string;
  // The key of the column naming each record, whose cell holds the row's controls.
  nameColumn: string;
  // Shows a record's details beside the table, from its Name cell and its menu, for a table whose
  // records have them.
  showDetails?: (record: Rec) => void;
  // Whether a record cannot be changed by this user, though others of the table can.
  readOnlyRecord?: (record: Rec) => boolean;
  // The table's columns, from its added columns and their lists, and the records, live or as
  // drafted, for columns whose choices are records. A table may start them in its own order rather
  // than the one given by their keys, so the grid places them in the view's order itself.
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
  // For a row whose draft is another record's, such as a change of the cycles a cycle's row shows:
  // what that draft is, which its menu says before what it changes.
  draftSubject?: (record: Rec) => string;
  // For a table whose rows' menus decide another record's draft too, such as a row standing for its
  // parts' drafts that decides them all. Approve sends those of the drafts the menu decides that
  // need no other approver. Each item names whose draft it decides where the record's own is not
  // among them.
  menuDecides?: (record: Rec) => {
    approved: DraftSelection;
    approvedOf?: string | undefined;
    rejectedOf?: string | undefined;
  };
  // What else a record's menu offers, after its columns' own items, such as showing its details.
  menuItems?: (record: Rec) => ReactNode;
  // Each record's key, for a table whose records have keys, or none for a row with no key: its
  // menu offers Copy link, and typing the key in the search finds the record.
  keyOf?: (record: Rec) => RecordKeyOf | undefined;
  // For a row that stands for its parts' drafts as well as its record's own: the record's own draft,
  // which its menu discards or resubmits; the row's otherwise.
  ownDraft?: (record: Rec) => DraftOf<Rec> | undefined;
  // For a table that makes a record of each of someone's rows under several groups: what each row
  // is of, so the count above the table and the metrics count it once. Otherwise the record's id.
  countedAs?: (record: Rec) => string;
  // The ways the rows can be grouped under headings, for a table that groups them.
  groupings?: readonly RowGrouping<Rec>[];
  // For a table whose records are made for its grouping, such as one row under each manager in
  // the months shown: its rows group one level deep, with no second grouping under the first.
  oneLevel?: true;
  // For a table that can be exported: the table the server records an export holding Personal or
  // Confidential data as, and the classified details its rows hold apart from their columns, such
  // as the hiring plan, which planned hires' rows are. A table without it offers no export.
  exported?: {
    recordedAs?: ExportedTable;
    held?: (rows: readonly Rec[], show: Show) => readonly HeldDetail[];
    // For a table whose columns' classes are fixed rather than set on Data classes, such as
    // Accounts': each column's class in the file, by key. Not the column's own class, which would
    // mark its heading, though every reader of the table sees the column.
    classOf?: (key: string) => Tier | undefined;
    // For a page with a date control: the day shown, as YYYY-MM-DD, which every row of the file
    // starts with, so a file says when its data was true.
    asOn?: string;
  };
  // For a table whose row stands for several records' drafts: whether the row has any that can be
  // decided now, in place of its own draft's state.
  decidable?: (record: Rec) => boolean;
  // For a table whose every row is a draft, such as Drafts: the dot in a row's slot is its draft's
  // only mark, with no tint, semibold or strike-through, which would mark every row alike.
  slotMarksOnly?: true;
  // For a table whose rows are drafts, such as Drafts: discarding a row's draft takes the row away,
  // not only a draft that added its record.
  discardTakesRow?: true;
  // For a table that sums its rows: a total row ending each group, headed with the label, and one
  // for all the rows shown, kept in view at the foot, headed with the overall label; each column's
  // total is drawn from the rows it sums.
  totals?: RowTotals<Rec>;
  // Filters across the whole table, each offered from a button of its own in the bar above it.
  barFilters?: readonly BarFilter<Rec>[];
}

// A headed group of a record's columns, by key, as its details show them.
export interface ColumnGroup {
  title: string;
  keys: readonly string[];
}

// Columns in the order their details' groups name them, so a table starts its columns as its
// details list them.
export function inGroupOrder<Col extends { key: string }>(
  columns: readonly Col[],
  groups: readonly ColumnGroup[],
): Col[] {
  const order = groups.flatMap(({ keys }) => keys);
  return [...columns].sort(
    (a, b) => order.indexOf(a.key) - order.indexOf(b.key),
  );
}

export interface RowTotals<Rec> {
  label: string;
  overall: string;
  cell: (records: readonly Rec[], columnKey: string) => ReactNode;
}

export interface RowGrouping<Rec> extends GroupingChoice {
  // The groups a record is in: one, or several for a column holding several values, never none,
  // since a record with no value is in the grouping's group for none.
  of: (record: Rec) => RowGroups;
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

export type AnyColumn = Column<never>;

// The props a table of one kind of record takes, which its own component passes on.
// A column a link names, and what the page does once the table has opened it.
export interface LinkedColumn {
  key: string;
  onOpened: () => void;
}

export interface RecordGridProps<Rec extends GridRecord, Change, Request> {
  // Every record the user may see; the view decides which are shown, and in what order.
  records: Rec[];
  // Side panels the page opens beside the table, stacked above the table's own.
  panels?: readonly SidePanel[] | undefined;
  table: RecordTable<Rec, Change, Request>;
  fields: Field[];
  // The keys of the columns, in the table's own order.
  order: string[];
  lists: List[];
  canEdit: boolean;
  // Whether new records can be added, for those who may edit; true unless told otherwise.
  canAdd?: boolean;
  // Whether those who may edit records may also discard, resubmit and remove them from each row's
  // menu; true unless told otherwise. False where a row's draft is seen to elsewhere.
  rowActions?: boolean;
  // For a table whose records are changed outside it, such as in their panel: whether the user may
  // still discard and resubmit each record's own draft from its row's menu, or, where rows carry
  // drafts of different kinds, each row's.
  canEditDrafts?: boolean | ((record: Rec) => boolean);
  // The kinds of draft the user's role approves and rejects.
  approves?: readonly DecidedKind[];
  // What says who decides the drafts of columns, lists and choices, where the table's own columns
  // and lists don't, as on Lists, whose rows are lists.
  decidedBy?: DecidedBy | undefined;
  // Whether a change is still saving, which approving all shown waits for, so it never sends a
  // draft not saved yet.
  saving?: boolean;
  canEditColumns: boolean;
  actions: RecordActions<Rec, Change, Request>;
  view: View;
  onView: ChangeView;
  // The table's saved views; absent where they are not offered.
  saved?: SavedViews | undefined;
  // The key of the column the table opens scrolled to, just after any frozen columns.
  opensAtColumn?: string | undefined;
  // A column a link names, which the table opens scrolled to, with its menu open.
  linkedColumn?: LinkedColumn | undefined;
  // False for a table whose records never have drafts, which offers no Draft menu.
  withDrafts?: boolean;
  // Lines between columns, for a grid read across as well as down, such as one of months.
  columnBorders?: boolean;
  // Choices of which records the table shows, beyond its filters, such as Show retired, first in
  // the Views menu.
  viewChoices?: readonly ViewChoice[] | undefined;
  // The count above the table, of its records counted once, where the page names when it counts
  // them, such as People's day or a month grid's month, which may change with what is in view
  // without redrawing the table.
  count?: ((records: readonly Rec[]) => ReactNode) | undefined;
  // The same count while something narrows the rows, given the records shown too, for a page that
  // words it its own way rather than as how many of all are shown.
  countNarrowed?:
    ((records: readonly Rec[], shown: readonly Rec[]) => ReactNode) | undefined;
  // How Save view names the page's own choices kept outside the Views menu, such as Features' Board.
  pageParts?: PageParts | undefined;
  // A filter of the page's own, kept among its choices, while it is in use.
  pageFilter?: PageFilter<Rec> | undefined;
  // What the page shows under the bar above the table, such as a timeline, as tall as it needs,
  // given the records the table shows.
  above?: ((shown: readonly Rec[]) => ReactNode) | undefined;
  // What the table shows under its line saying it has no records, such as a link to where the first
  // is made.
  noneBelow?: ReactNode;
  // Draws the rows the view shows in place of the table, such as a board, under the same bar.
  body?: ((shown: ShownRows<Rec>) => ReactNode) | undefined;
  // Ticks for choosing rows to act on together, with the bar above the table that acts on them.
  ticks?: RowTicks<Rec> | undefined;
  // The record whose details are open beside the table, whose row is marked as selected, and how
  // the page closes them, as the panel's own close does, which its row's details button does too.
  selected?: string | undefined;
  closeSelected?: ((id: string) => void) | undefined;
}

// The rows a view shows, for a page that draws them its own way: in the view's order, each with its
// group, its draft whatever the view, which its marks are worked out from, and as it is live; and
// whether a side panel is open beside them.
export interface ShownRows<Rec extends GridRecord> {
  records: readonly Rec[];
  panelOpen: boolean;
  groupOf: ((record: Rec) => RowGroups) | undefined;
  groupsReversed: boolean;
  draftOf: (record: Rec) => DraftOf<Rec> | undefined;
  liveOf: (record: Rec) => Rec | undefined;
}

const nothing = () => undefined;

// For a table that changes none of its records itself, whose actions are never called, apart from
// deciding on drafts, which it may still offer.
export const noRecordActions = <Rec extends GridRecord, Change, Request>(
  decide: RecordActions<Rec, Change, Request>["decide"] = nothing,
): RecordActions<Rec, Change, Request> => ({
  add: nothing,
  update: nothing,
  decide,
  remove: nothing,
  discard: nothing,
  resubmit: nothing,
  discardColumn: nothing,
  resubmitColumn: nothing,
});

// What a table that adds, removes and drafts none of its records itself is never asked: what a new
// row and removing are called, what a draft changes, what is wrong with a new record's values, and
// the request that adds one.
export const readOnlyTableParts = {
  newRowLabel: () => "",
  removeLabel: () => "",
  draftFields: () => [],
  recordProblem: nothing,
  request: (): never => {
    throw new Error("A read-only table adds no records");
  },
};

// The export of a table whose data is all General: saved at once, asking and recording nothing.
export const generalExport = {};

// What a record added from a picker goes to: the saved record the picker was for, by its identifier,
// or the new row it fills.
export type AddedTo =
  { id: string } | { fill: (ids: readonly string[]) => void };

// A picker's New option, for a column that offers one, with what puts focus back where the picker
// was.
export const addingFor = (
  adds: Column<never>["adds"],
  to: AddedTo,
  back: () => void,
): Adding | undefined =>
  adds === undefined
    ? undefined
    : {
        one: adds.one,
        onNew: (typed) => {
          adds.onNew(to, typed, back);
        },
      };
