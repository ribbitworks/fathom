// SPDX-License-Identifier: Apache-2.0

// The People table, edited like a spreadsheet. Arrow keys, Home, End, and Tab move between cells,
// and Ctrl+Home and Ctrl+End go to the first and last. On a
// person, Enter, F2, or typing edits the cell, and Delete clears it. While editing, Enter saves and
// moves down, Tab saves and moves across, and Esc cancels. A column drawing on a list is edited by
// typing to narrow its choices and picking one, as choice-picker.tsx sets out. Empty rows at the end
// take new people: Tab moves straight on to editing the next cell, and Enter, in a cell or on the
// row, adds the person and starts the next. Pasting rows copied from a spreadsheet into a new row
// adds a person for each, all saved together; rows that will not do stay as new rows with their
// problems shown. Every change to a person is a draft, shown in place and marked, until an Approver
// approves it; a cell a draft changes is marked, and names its live value. Each person's menu, also
// opened with Shift+F10, drafts removing them or discards their draft. Every column can be
// dragged by its header, moved with Alt and the arrow keys, or moved from its menu, and columns
// drawing on lists are changed from there too. Everyone, viewers included, can search the table and
// sort and filter it by any column they see, as table-controls.tsx sets out; rows keep their place
// while they are edited, until the view next changes. Viewers see the same table, read only. Changes
// to columns and their order are drafts too, marked under the columns' names, with each column's
// draft in its menu, and the order's in the Draft menu and the menu of each column it moves; the
// Draft menu also chooses what to show and decides every draft waiting among those shown.

import type {
  Choice,
  ColumnOrderDraft,
  Field,
  FieldDraft,
  List,
  Person,
  PersonChange,
  PersonDraft,
  PersonRequest,
  Show,
} from "@fathom/shared";
import {
  builtInColumnNames,
  draftFilterKey,
  personLengths,
} from "@fathom/shared";
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
  type Ref,
  useImperativeHandle,
  useState,
} from "react";
import { ChoicePicker, type Finish } from "./choice-picker.tsx";
import {
  configDraftFields,
  draftLines,
  HeldNote,
  MenuDraftLines,
  MenuTitle,
  UnpublishedNote,
  WaitingNote,
  personDraftFields,
} from "./draft-details.tsx";

import {
  type Asking,
  decidable,
  type DraftSelection,
  draftTotal,
  noDrafts,
  waitsForRejected,
} from "./drafts.ts";
import type { ColumnDraftTarget } from "./people.ts";
import { focusSoon } from "./focus.ts";
import { shortcutsFor } from "./list-panel.tsx";
import { Icon } from "./icons.tsx";
import { movedKeys } from "./list-drafts.tsx";
import { draftedLists, liveLists, offered, sameName } from "./lists.ts";
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
  applyView,
  type CellValue,
  formatDay,
  isDay,
  knownView,
  narrows,
  type TableColumn,
  useSteadyOrder,
  type View,
} from "./table-view.ts";
import { AppMenu, closesOnBlankClick } from "./app-menu.tsx";
import { metricsButtonId } from "./metrics.ts";
import {
  type CountedRows,
  MetricsPanel,
  WithMetrics,
} from "./metrics-panel.tsx";
import classes from "./pages.module.css";
import type { Phrase } from "./phrase.tsx";
import { DraftMark, HoldMarks, StatusMark } from "./status-mark.tsx";

export interface PeopleActions {
  // Adds people, all saved together, showing each at once under the identifier given until saved,
  // then gives their own identifiers; if they cannot be saved, gives back what was entered.
  add: (
    people: { id: string; request: PersonRequest }[],
    onAdded: (ids: string[]) => void,
    onFailed: () => void,
  ) => void;
  update: (person: Person, change: PersonChange) => void;
  // Asks to approve or reject the drafts chosen, of people, columns, or the column order, naming
  // them when one menu item decides several together.
  decide: (asking: Asking, selection: DraftSelection, naming?: boolean) => void;
  remove: (person: Person) => void;
  discard: (person: Person, draft: PersonDraft) => void;
  // Sends a rejected draft for approval again, unchanged.
  resubmit: (person: Person) => void;
  // Moves a column, by its key, to just after another, or to the start when there is none.
  moveColumn: (key: string, label: string, after: string | null) => void;
  editColumn: (field: Field) => void;
  // Discards a draft of a column or of the column order, or sends a rejected one again.
  discardColumn: (target: ColumnDraftTarget, name: string) => void;
  resubmitColumn: (target: ColumnDraftTarget) => void;
}

// A person's own detail, keyed by its name, or a column drawing on a list, keyed by its identifier.
export interface Column extends TableColumn<Person> {
  required: boolean;
  // For columns drawing on a list: the column and its list's choices.
  field?: Field;
  choices: Choice[];
}

interface NewRow {
  key: number;
  values: Record<string, CellValue>;
  problem?: string;
}

type Row =
  { person: Person; newRow?: never } | { newRow: NewRow; person?: never };

// A cell by the keys of its row and column.
interface Place {
  row: string;
  column: string;
}

interface Cell {
  row: number;
  column: number;
}

const headerId = (column: Column) => `column-${column.key}`;

const shortcuts = shortcutsFor(navigator.userAgent);

// A line of a column's header, its name or a mark under it, and the room above and below them, for
// how tall a header with marks grows.
const headerLineHeight = "1.125rem";
const headerPadding = "0.5rem";

// The most rows one paste adds, as the server allows at once.
const pasteLimit = 1000;

// The People table's columns, in the order given by their keys: each person's name and Employee ID,
// the columns drawing on lists, and, for those who may see them, start and end dates. A column the
// order does not name yet comes at the end.
export function columnsFor(
  fields: readonly Field[],
  lists: readonly List[],
  order: readonly string[],
  showDates: boolean,
): Column[] {
  const builtIn = (
    key: string,
    kind: Column["kind"],
    required = false,
  ): Column => ({
    key,
    // Every built-in column is named.
    label: builtInColumnNames.get(key) as string,
    kind,
    required,
    choices: [],
    multiple: false,
    value: (person) => personValue(person, kind, key),
  });
  const all: Column[] = [
    builtIn("preferredName", "text", true),
    builtIn("employeeId", "text", true),
    ...(showDates
      ? [builtIn("startDate", "date"), builtIn("endDate", "date")]
      : []),
    ...fields.map((field): Column => ({
      key: field.id,
      label: field.name,
      kind: "choice",
      required: field.required,
      field,
      choices: lists.find(({ id }) => id === field.listId)?.choices ?? [],
      multiple: field.multiple,
      value: (person) => personValue(person, "choice", field.id),
    })),
  ];
  const place = (column: Column) => {
    const at = order.indexOf(column.key);
    return at === -1 ? order.length : at;
  };
  return all
    .map((column, index) => ({ column, index }))
    .sort((a, b) => place(a.column) - place(b.column) || a.index - b.index)
    .map(({ column }) => column);
}

function personValue(
  person: Person,
  kind: Column["kind"],
  key: string,
): CellValue {
  // The key is a column's own.
  // eslint-disable-next-line security/detect-object-injection
  if (kind === "choice") return person.values[key] ?? [];
  const detail = person[key as DetailKey];
  return detail ?? "";
}

// The keys of a person's built-in details.
export type DetailKey =
  "preferredName" | "employeeId" | "startDate" | "endDate";

// Someone added but not saved yet is shown at once under an identifier of the table's own, until the
// server gives theirs; until then they cannot be changed. The table goes on naming their row by it,
// so the row keeps its place, and focus, when the server's identifier replaces it.
const pendingPrefix = "pending-";

const pendingId = () => `${pendingPrefix}${crypto.randomUUID()}`;

const isPending = (person: Person) => person.id.startsWith(pendingPrefix);

// What the table can do for whoever opens it: put focus on the row for adding someone.
export interface PeopleGridHandle {
  addPerson: () => void;
}

// A column's live value, for a person whose draft changes it.
function liveValue(draft: PersonDraft, column: Column): CellValue {
  if (column.kind === "choice") return draft.live.values[column.key] ?? [];
  return draft.live[column.key as DetailKey] ?? "";
}

// Whether a draft gives a column a new value: every column of someone added, and those a change
// names. A removal shows the person as they are.
function draftChanges(draft: PersonDraft | undefined, column: Column): boolean {
  if (draft === undefined || draft.action === "deleted") return false;
  return draft.action === "created" || draft.changed.includes(column.key);
}

// Everyone as they are live, without drafts: those only drafted to be added are left out, and each
// detail and column a draft changes has its live value back.
export function livePeople(people: readonly Person[]): Person[] {
  return people.flatMap((person): Person[] => {
    const { draft, ...rest } = person;
    if (draft === undefined) return [person];
    if (draft.action === "created") return [];
    if (draft.action === "deleted") return [rest];
    const columns = draft.changed.filter((key) => !builtInDetail(key));
    const liveValues = new Map(Object.entries(draft.live.values));
    const values: Record<string, string[]> = Object.fromEntries([
      ...Object.entries(rest.values).filter(([key]) => !columns.includes(key)),
      ...columns.flatMap((key): [string, string[]][] => {
        const live = liveValues.get(key) ?? [];
        return live.length === 0 ? [] : [[key, live]];
      }),
    ]);
    const details: Partial<Person> = Object.fromEntries(
      draft.changed
        .filter(builtInDetail)
        .map((key): [string, string | null] => [
          key,
          draft.live[key as DetailKey] ?? null,
        ]),
    );
    return [{ ...rest, ...details, values }];
  });
}

// The people the metrics count, as the Draft menu shows them. With drafts beside live, they count
// as drafted, leaving out those drafted to be removed, and as they are live, by each column's live
// copy, which `liveOf` gives; otherwise they count as shown.
export function countedPeople(
  show: Show,
  shown: readonly Person[],
  columns: readonly Column[],
  liveOf: (column: Column) => Column | undefined,
): { rows: Person[]; live?: CountedRows<Person> } {
  if (show !== "both") return { rows: [...shown] };
  return {
    rows: shown.filter(({ draft }) => draft?.action !== "deleted"),
    live: {
      rows: livePeople(shown),
      columns: columns.flatMap((column) => liveOf(column) ?? []),
    },
  };
}

// Required text, such as names, is always filled in, so is not worth breaking down by.
const breaksDown = (column: Column) =>
  column.kind === "choice" || !column.required;

const builtInDetail = (key: string) =>
  ["preferredName", "employeeId", "startDate", "endDate"].includes(key);

function newRowValue(newRow: NewRow, column: Column): CellValue {
  return newRow.values[column.key] ?? (column.kind === "choice" ? [] : "");
}

function isEmpty(value: CellValue): boolean {
  return Array.isArray(value) ? value.length === 0 : value.trim() === "";
}

// How a column is sorted, as assistive technology reads it.
// Only the first level of a sort is marked, as a table has one sorted column for assistive technology;
// the header's name gives every level.
function ariaSort(view: View, key: string) {
  const [first] = view.sort;
  if (first?.key !== key) return undefined;
  return first.descending ? "descending" : "ascending";
}

// The 28th is in every month, so this tries each month's name.
const longestDay = Math.max(
  ...Array.from(
    { length: 12 },
    (_, month) =>
      formatDay(`2026-${String(month + 1).padStart(2, "0")}-28`).length,
  ),
);
const widestChars = 30;

// How many characters a column fits in its cells and in its header, which CSS turns into its width.
export function columnWidth(
  column: Column,
  longestText: ReadonlyMap<string, number>,
): { cells: number; header: number } {
  let cells: number;
  switch (column.kind) {
    case "choice":
      cells = column.choices.reduce(
        (longest, { label }) => Math.max(longest, label.length),
        0,
      );
      break;
    case "date":
      cells = longestDay;
      break;
    case "text":
      cells = longestText.get(column.key) ?? 0;
      break;
  }
  return {
    cells: Math.min(cells, widestChars),
    header: Math.min(column.label.length, widestChars),
  };
}

function widthStyle({
  cells,
  header,
}: {
  cells: number;
  header: number;
}): CSSProperties {
  return {
    "--cell-chars": cells,
    "--header-chars": header,
  } as CSSProperties;
}

function longestTexts(
  columns: readonly Column[],
  people: readonly Person[],
): Map<string, number> {
  return new Map(
    columns
      .filter(({ kind }) => kind === "text")
      .map((column) => [
        column.key,
        people.reduce(
          (longest, person) =>
            Math.max(longest, shown(column, column.value(person)).length),
          0,
        ),
      ]),
  );
}

// A cell's value in words.
function shown(column: Column, value: CellValue): string {
  if (Array.isArray(value)) {
    return value
      .map((id) => column.choices.find((choice) => choice.id === id)?.label)
      .filter((label) => label !== undefined)
      .join(", ");
  }
  return column.kind === "date" && isDay(value) ? formatDay(value) : value;
}

// The choices a cell offers: those offered in its list, and any retired ones it already has.
// Choices only drafted to be added are not offered until approved.
function choicesFor(column: Column, value: string[]) {
  return column.choices
    .filter((choice) => offered(choice) || value.includes(choice.id))
    .map((choice) => ({ value: choice.id, label: choice.label }));
}

// What is wrong with a value for a column, if anything.
export function valueProblem(
  column: Column,
  value: CellValue,
): string | undefined {
  if (column.required && isEmpty(value)) return `${column.label} needed`;
  if (typeof value !== "string") return undefined;
  const limit =
    column.key === "employeeId"
      ? personLengths.employeeId
      : personLengths.preferredName;
  if (column.kind === "text" && value.trim().length > limit) {
    return `${column.label} too long`;
  }
  if (column.kind === "date" && value !== "" && !isDay(value)) {
    return `${column.label}: use a date such as 2026-10-31`;
  }
  return undefined;
}

// What is wrong with a person's details taken together, if anything: an Employee ID someone else has,
// or an end date before the start date.
function recordProblem(
  values: Record<string, CellValue>,
  others: readonly string[],
): string | undefined {
  const employeeId = values.employeeId;
  if (
    typeof employeeId === "string" &&
    others.some((other) => sameName(other, employeeId))
  ) {
    return "Someone already has that Employee ID";
  }
  const { startDate, endDate } = values;
  if (
    typeof startDate === "string" &&
    typeof endDate === "string" &&
    startDate !== "" &&
    endDate !== "" &&
    endDate < startDate
  ) {
    return "The end date cannot be before the start date";
  }
  return undefined;
}

// The request that adds a new row's person.
function requestFor(newRow: NewRow, columns: readonly Column[]): PersonRequest {
  const text = (key: string) => {
    // The key is one of the fixed details named below.
    // eslint-disable-next-line security/detect-object-injection
    const value = newRow.values[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const date = (key: string) => (text(key) === "" ? null : text(key));
  const values = Object.fromEntries(
    columns
      .filter((column) => column.kind === "choice")
      .map((column) => [column.key, newRowValue(newRow, column) as string[]]),
  );
  return {
    preferredName: text("preferredName"),
    employeeId: text("employeeId"),
    ...(columns.some((column) => column.kind === "date")
      ? { startDate: date("startDate"), endDate: date("endDate") }
      : {}),
    values,
  };
}

// The new rows pasted text makes, from the given column across: one for each line, with each cell's
// text matched to the column's choices by name, and any problem found.
export function pastedRows(
  text: string,
  columns: readonly Column[],
  from: number,
  firstKey: number,
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
        if (column === undefined || content === "") continue;
        if (column.kind !== "choice") {
          values[column.key] = content;
          continue;
        }
        const choice = column.choices.find(
          (option) => offered(option) && sameName(option.label, content),
        );
        if (choice === undefined) {
          problem ??= `No ${column.label} called ${content}`;
        } else {
          values[column.key] = [choice.id];
        }
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

// What the People table is filtered by besides its columns: whether each person has a draft,
// waiting or rejected.
export const draftColumn: TableColumn<Person> = {
  key: draftFilterKey,
  label: "Draft",
  kind: "choice",
  choices: [
    { id: "waiting", label: "Waiting" },
    { id: "rejected", label: "Rejected" },
  ],
  multiple: false,
  emptyLabel: "No draft",
  value: (person) => (person.draft === undefined ? [] : [person.draft.state]),
};

// The mark beside a new row being filled in, until its person is added, naming the required
// columns still empty.
// The whole mark shows on hover too, since a narrow first column can cut it short.
function NewMark({ missing }: { missing: readonly string[] }) {
  const words = [
    "New, not saved yet",
    ...(missing.length > 0 ? [`: ${missing.join(", ")} needed`] : []),
  ].join("");
  return (
    <span className={classes.newMark} title={words}>
      <span className={classes.statusDot} aria-hidden="true" /> {words}
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
        multiple: draft.live.multiple ?? rest.multiple,
        required: draft.live.required ?? rest.required,
      },
    ];
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
const orderMaker = (draft: ColumnOrderDraft) => draft.madeBy ?? "Fathom";
const movedLine = (draft: ColumnOrderDraft): Phrase => [
  { strong: "Moved" },
  ` by ${orderMaker(draft)}`,
];

// What may be done with a draft of the order of the People table's columns, which the table shows,
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
  actions: PeopleActions;
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
            disabled={waits}
            onClick={() => {
              actions.decide("approve", order);
            }}
          >
            Approve new order…
          </Menu.Item>
          {waits && <WaitingNote />}
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

export function PeopleGrid({
  people: everyone,
  fields: draftedFields,
  order: draftedOrder,
  orderDraft,
  orderHeldBy,
  lists,
  canEdit: mayEdit,
  canApprove: mayApprove = false,
  saving = false,
  canEditColumns,
  showDates,
  actions,
  view: asked,
  onView,
  saved,
  ref,
}: {
  // Everyone the user may see; the view decides which are shown, and in what order.
  people: Person[];
  fields: Field[];
  // The keys of the columns, in order, as a draft of the order makes it, and that draft.
  order: string[];
  orderDraft?: ColumnOrderDraft | undefined;
  // Who else has unpublished changes to the column order, which hold it.
  orderHeldBy?: string | undefined;
  lists: List[];
  canEdit: boolean;
  canApprove?: boolean;
  // Whether a change is still saving, which approving all shown waits for, so it never sends a
  // draft not saved yet.
  saving?: boolean;
  canEditColumns: boolean;
  showDates: boolean;
  actions: PeopleActions;
  view: View;
  onView: ChangeView;
  // The table's saved views; absent where they are not offered.
  saved?: SavedViews;
  ref?: Ref<PeopleGridHandle>;
}) {
  // Live only shows the live columns, in their live order. Drafts applied shows the columns as they
  // will be once approved: a rejected draft, not on its way to approval, is taken back, and a column
  // drafted to be removed is left out.
  const applied = asked.show === "drafts";
  // A new column order that places a column whose addition was rejected waits for it.
  const orderWaits = waitsForRejected(
    { ...noDrafts(), columnOrder: true },
    lists,
    { fields: draftedFields, orderDraft },
  );
  const fields =
    asked.show === "live"
      ? liveFields(draftedFields)
      : applied
        ? draftedFields.flatMap((field) => {
            if (field.draft?.state === "rejected") return liveFields([field]);
            return field.draft?.action === "deleted" ? [] : [field];
          })
        : draftedFields;
  // The order drafted, unless it is taken back.
  const orderShown =
    orderDraft !== undefined &&
    asked.show !== "live" &&
    !(applied && orderDraft.state === "rejected");
  const order =
    orderDraft === undefined || orderShown ? draftedOrder : orderDraft.live;
  // The columns with their lists as they are live, for the live people and each live row, so a
  // choice's drafted name is not shown as live.
  const listsLive = liveLists(lists);
  const liveColumns = columnsFor(fields, listsLive, order, showDates);
  // Both are made from the same fields, so every column has its live one.
  const liveColumn = (column: Column) =>
    liveColumns.find(({ key }) => key === column.key) as Column;
  const columns =
    asked.show === "live"
      ? liveColumns
      : columnsFor(
          fields,
          applied ? draftedLists(lists) : lists,
          order,
          showDates,
        );
  const known = knownView(
    asked,
    columns,
    [draftColumn],
    columns.filter(breaksDown),
  );
  // The live people alone are read only, since every change makes a draft they do not show, and
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
  // Drafts applied shows everyone as they will be once approved: a rejected draft is taken back, and
  // those drafted to be removed are left out.
  let people = everyone;
  if (liveOnly) people = livePeople(everyone);
  else if (applied) {
    people = everyone.flatMap((person) => {
      if (person.draft?.state === "rejected") return livePeople([person]);
      return person.draft?.action === "deleted" ? [] : [person];
    });
  }
  const canEdit = mayEdit && !liveOnly;
  const canApprove = mayApprove && !liveOnly;
  // Beside a column whose draft changes it, the column as it is live, to compare, as a person's live
  // row is shown under their draft.
  const fieldsLive = new Map(
    liveFields(draftedFields).map((field) => [field.id, field]),
  );
  const liveCopies = new Map(
    columns.flatMap((column): [string, Column][] => {
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
            // The lists load apart from the people, so may not have caught up yet.
            choices:
              listsLive.find(({ id }) => id === live.listId)?.choices ?? [],
          },
        ],
      ];
    }),
  );
  const liveBeside = (column: Column) => liveCopies.get(column.key);
  const besides = columns.filter((column) => liveCopies.has(column.key));
  // The columns a draft of the order moves, marked under their names, unless drafted to be removed,
  // since where such a column goes matters to no one.
  const movedColumns = orderShown
    ? movedKeys(orderDraft.live, draftedOrder)
    : new Map<string, number>();
  const isMoved = (column: Column) =>
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
  // A person's value in a column as it is live, for the column's live copy: none for someone only
  // drafted to be added, or for a new row.
  const liveCell = (person: Person | undefined, column: Column) => {
    const draft = person?.draft;
    if (person === undefined || draft?.action === "created") return "";
    return shown(
      // Only changed columns have a live copy beside them.
      liveBeside(column) as Column,
      draft?.action === "changed" && draft.changed.includes(column.key)
        ? liveValue(draft, column)
        : column.value(person),
    );
  };
  const liveCellBeside = (person: Person | undefined, column: Column) =>
    liveBeside(column) && (
      <Table.Td
        key={`${column.key}-live`}
        aria-hidden="true"
        className={[classes.peopleCell, classes.liveColumn].join(" ")}
      >
        {liveCell(person, column)}
      </Table.Td>
    );
  // A column with a draft is tinted, as a row with one is, and one a draft removes is struck through.
  const columnTint = (column: Column) => {
    const draft = column.field?.draft;
    if (draft === undefined) return "";
    return draft.action === "deleted"
      ? [classes.draftColumn, classes.removedColumn].join(" ")
      : classes.draftColumn;
  };
  // No width follows what is typed, so editing never moves the table.
  const [longestText] = useState(() => longestTexts(columns, people));
  // The people this user has added since the page opened, which stay shown whatever the view.
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  // The identifier each person added since the page opened was shown under before it was saved, by
  // their own, which names their row from then on.
  const [shownAs, setShownAs] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const stableId = (person: Person) => shownAs.get(person.id) ?? person.id;
  const shownPeople = useSteadyOrder(
    people,
    view,
    (rows) => applyView(rows, columns, view, [draftColumn]),
    stableId,
    added,
  );
  const [newRows, setNewRows] = useState<NewRow[]>([{ key: 0, values: {} }]);
  const [nextKey, setNextKey] = useState(1);
  // The selected cell and the cell being edited, by row and column key rather than position, so they
  // stay with their person when a save puts the rows in a new order.
  const [activeAt, setActiveAt] = useState<Place>();
  const [editingAt, setEditingAt] = useState<Place>();
  // What is typed in the cell being edited: its text, or what narrows its choices.
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<{ row: string; message: string }>();
  const [menuFor, setMenuFor] = useState<string>();
  const [dragging, setDragging] = useState<string>();
  // The column whose filter is open, by key.
  const [filtering, setFiltering] = useState<string>();

  // The actions column, for those who may edit people or approve drafts.
  const withActions = canEdit || canApprove;
  // A person's menu: approving or rejecting their draft, for Approvers, and discarding it or
  // removing them, for those who may edit people.
  const hasMenu = (person: Person) =>
    !isPending(person) &&
    (canEdit || (canApprove && person.draft !== undefined));
  // Whether a person's cells cannot be changed: by those who may only view, while they are drafted
  // to be removed, until the draft is discarded, or while they are being added.
  const locked = (person: Person) =>
    !canEdit ||
    person.draft?.action === "deleted" ||
    person.heldBy !== undefined ||
    isPending(person);
  const rows: Row[] = [
    ...shownPeople.map((person) => ({ person })),
    ...(canEdit ? newRows.map((newRow) => ({ newRow })) : []),
  ];
  const rowKey = (row: Row) =>
    row.person ? stableId(row.person) : `new-${String(row.newRow.key)}`;
  const rowKeys = rows.map(rowKey);
  const keys = columns.map((column) => column.key);
  const cellId = (row: number, column: number) =>
    `cell-${String(rowKeys.at(row))}-${String(keys.at(column))}`;
  // The row and column of a cell, which is always within the table.
  const at = (cell: Cell) => ({
    row: rows[cell.row] as Row,
    column: columns[cell.column] as Column,
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
  const editing = editingAt === undefined ? undefined : cellAt(editingAt);
  const setActive = (cell: Cell) => {
    setActiveAt(placeOf(cell));
  };
  const setEditing = (cell: Cell | undefined) => {
    setEditingAt(cell === undefined ? undefined : placeOf(cell));
  };
  const valueAt = (row: Row, column: Column) =>
    row.person ? column.value(row.person) : newRowValue(row.newRow, column);

  // Focuses a cell of a new row by its key, since the row may not be drawn yet.
  const focusNew = (newKey: number) => {
    const place = { row: `new-${String(newKey)}`, column: String(keys[0]) };
    setActiveAt(place);
    focusSoon(`cell-${place.row}-${place.column}`);
  };

  // Adding someone goes to the last new row, of which there is always at least one.
  useImperativeHandle(ref, () => ({
    addPerson: () => {
      focusNew((newRows.at(-1) as NewRow).key);
    },
  }));

  const moveTo = (row: number, column: number) => {
    const target = {
      row: Math.max(0, Math.min(row, rows.length - 1)),
      column: Math.max(0, Math.min(column, columns.length - 1)),
    };
    setActive(target);
    focusSoon(cellId(target.row, target.column));
  };

  const startEdit = (cell: Cell, typed?: string) => {
    const { row, column } = at(cell);
    if (row.person && locked(row.person)) return;
    const value = valueAt(row, column);
    setActive(cell);
    setEditing(cell);
    setMenuFor(undefined);
    setText(typed ?? (Array.isArray(value) ? "" : value));
    focusSoon(`${cellId(cell.row, cell.column)}-editor`);
  };

  const stopEdit = (then: Cell) => {
    setEditing(undefined);
    moveTo(then.row, then.column);
  };

  const otherEmployeeIds = (except: string) => [
    ...people.filter(({ id }) => id !== except).map((p) => p.employeeId),
    ...newRows
      .filter((newRow) => `new-${String(newRow.key)}` !== except)
      .flatMap((newRow) =>
        typeof newRow.values.employeeId === "string"
          ? [newRow.values.employeeId]
          : [],
      ),
  ];

  // Saves a cell's new value: on a person, at once; on a new row, into the row. Returns whether it
  // would do, showing the problem on the row when it would not.
  const save = (cell: Cell, value: CellValue): boolean => {
    const { row, column } = at(cell);
    const key = rowKey(row);
    if (row.newRow) {
      setNewRows((current) =>
        current.map((newRow) =>
          newRow.key === row.newRow.key
            ? {
                key: newRow.key,
                values: { ...newRow.values, [column.key]: value },
              }
            : newRow,
        ),
      );
      setProblem(undefined);
      return true;
    }
    const before = column.value(row.person);
    if (JSON.stringify(before) === JSON.stringify(value)) return true;
    const message =
      valueProblem(column, value) ??
      recordProblem(
        {
          startDate: row.person.startDate ?? "",
          endDate: row.person.endDate ?? "",
          [column.key]: value,
        },
        column.key === "employeeId" ? otherEmployeeIds(row.person.id) : [],
      );
    if (message !== undefined) {
      setProblem({ row: key, message });
      return false;
    }
    setProblem(undefined);
    let change: PersonChange;
    if (Array.isArray(value)) {
      change = { values: { [column.key]: value } };
    } else if (column.kind === "date") {
      change = { [column.key]: value === "" ? null : value };
    } else {
      change = { [column.key]: value.trim() };
    }
    actions.update(row.person, change);
    return true;
  };

  const emptyNewRow = (newRow: NewRow) =>
    Object.values(newRow.values).every(isEmpty);

  // Adds the people in the new rows, all together, once every one of them will do; otherwise shows
  // each row's problem and puts focus on the first.
  const submitNewRows = (current: NewRow[] = newRows) => {
    const filled = current.filter((newRow) => !emptyNewRow(newRow));
    if (filled.length === 0) return;
    const checked = filled.map((newRow) => {
      const message =
        newRow.problem ??
        columns
          .map((column) => valueProblem(column, newRowValue(newRow, column)))
          .find((found) => found !== undefined) ??
        recordProblem(
          newRow.values,
          otherEmployeeIds(`new-${String(newRow.key)}`),
        );
      return message === undefined ? newRow : { ...newRow, problem: message };
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
    const pending = filled.map((newRow) => ({
      id: pendingId(),
      request: requestFor(newRow, columns),
    }));
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
  // person or, on a person, moves down; Tab moves across, straight on to editing in a new row; and
  // leaving the cell stays put. A value that will not do keeps the cell open with its problem, or,
  // when the cell was left, is put back, with the problem still shown.
  const finish = (cell: Cell, value: CellValue, how: Finish) => {
    if (!save(cell, value)) {
      if (how === "leave") setEditing(undefined);
      return;
    }
    const { row, column } = at(cell);
    const key = column.key;
    if (how === "enter" && row.newRow) {
      setEditing(undefined);
      submitNewRows(
        newRows.map((newRow) =>
          newRow.key === row.newRow.key
            ? { key: newRow.key, values: { ...newRow.values, [key]: value } }
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
    if (row.newRow && within) {
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
      if (row.person && hasMenu(row.person)) setMenuFor(row.person.id);
      return;
    }
    if (!plain || (row.person && locked(row.person))) return;
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
      save(cell, column.kind === "choice" ? [] : "");
    } else if (event.key.length === 1) {
      event.preventDefault();
      startEdit(cell, event.key);
    }
  };

  // Pasting rows into a new row adds a person for each, from the cell pasted into across.
  const onPaste = (event: ClipboardEvent, cell: Cell) => {
    const { row } = at(cell);
    const pasted = event.clipboardData.getData("text/plain");
    if (!row.newRow || editing !== undefined || pasted.trim() === "") return;
    event.preventDefault();
    const made = pastedRows(pasted, columns, cell.column, nextKey);
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

  const moveColumnBy = (column: Column, step: -1 | 1) => {
    const index = keys.indexOf(column.key);
    const to = index + step;
    if (to < 0 || to >= keys.length) return;
    const others = keys.filter((key) => key !== column.key);
    actions.moveColumn(column.key, column.label, others[to - 1] ?? null);
    focusSoon(headerId(column));
  };

  const onDrop = (event: DragEvent, onto: Column) => {
    event.preventDefault();
    const moved = columns.find(({ key }) => key === dragging);
    setDragging(undefined);
    if (moved === undefined) return;
    const after = droppedAfter(keys, moved.key, onto.key);
    if (after !== undefined) actions.moveColumn(moved.key, moved.label, after);
  };

  const header = (column: Column) => {
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
          onDragStart: () => {
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
    return (
      <Table.Th
        key={column.key}
        scope="col"
        aria-sort={ariaSort(view, column.key)}
        className={columnTint(column)}
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
                className={classes.peopleHeadButton}
                aria-label={`${column.label} column${headerState(column, view)}`}
                onKeyDown={(event) => {
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
                  {field && !liveOnly && (
                    <HoldMarks
                      unpublished={field.draft?.unpublished}
                      heldBy={field.heldBy}
                    />
                  )}
                  {moved && (
                    <StatusMark
                      tone={
                        orderDraft.state === "rejected" ? "rejected" : "draft"
                      }
                      spaced
                    >
                      {orderDraft.state === "rejected"
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
                      ...(joinedOrder ? [movedLine(orderDraft)] : []),
                    ]}
                    divider={(canApprove && ownWaiting) || changesColumn}
                  />
                  {/* One decision for the column's draft and the order that moves it, among those
                      waiting: a rejected draft is back with its makers until they send it again. */}
                  {canApprove && ownWaiting && (
                    <>
                      <Menu.Item
                        onClick={() => {
                          actions.decide("approve", deciding, true);
                        }}
                      >
                        Approve…
                      </Menu.Item>
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
                      draft={orderDraft}
                      canEdit={movesColumns}
                      canApprove={canApprove}
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
              {moved && !joinedOrder && (canEditColumns || canApprove) && (
                <OrderItems
                  draft={orderDraft}
                  canEdit={canEditColumns}
                  canApprove={canApprove}
                  actions={actions}
                  waits={orderWaits}
                  heldBy={orderHeldBy}
                />
              )}
            </AppMenu.Dropdown>
          </AppMenu>
        </FilterPopover>
      </Table.Th>
    );
  };

  const editor = (cell: Cell, column: Column, value: CellValue) => {
    const id = `${cellId(cell.row, cell.column)}-editor`;
    if (Array.isArray(value)) {
      return (
        <ChoicePicker
          id={id}
          label={column.label}
          options={choicesFor(column, value)}
          multiple={column.multiple}
          initial={value}
          typed={text}
          onDone={(values, how) => {
            finish(cell, values, how);
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
        className={classes.peopleEditor}
        aria-label={column.label}
        value={text}
        autoComplete="off"
        onChange={(event) => {
          setText(event.currentTarget.value);
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

  const rowMenu = (person: Person, draft = person.draft) => (
    <Menu
      opened={menuFor === person.id}
      onChange={(opened) => {
        setMenuFor(opened ? person.id : undefined);
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
          aria-label={`Actions for ${person.preferredName}`}
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
        <MenuTitle>{person.preferredName}</MenuTitle>
        {person.heldBy !== undefined && <HeldNote by={person.heldBy} />}
        {draft?.unpublished === true && <UnpublishedNote />}
        {draft && (
          <MenuDraftLines
            draft={draft}
            lines={draftLines(
              draft,
              personDraftFields(person, draft, fields, lists),
            )}
            // Set apart from the items after it, when any are offered.
            divider={
              (canEdit && person.heldBy === undefined) ||
              (canApprove && decidable(person))
            }
          />
        )}
        {/* A rejected draft is back with its makers, until they send it again. */}
        {canApprove && decidable(person) && (
          <>
            <Menu.Item
              onClick={() => {
                actions.decide("approve", {
                  ...noDrafts(),
                  people: [person.id],
                });
              }}
            >
              Approve draft
            </Menu.Item>
            <Menu.Item
              onClick={() => {
                actions.decide("reject", {
                  ...noDrafts(),
                  people: [person.id],
                });
              }}
            >
              Reject draft…
            </Menu.Item>
          </>
        )}
        {canEdit && person.heldBy === undefined && (
          <>
            {draft?.state === "rejected" && (
              <Menu.Item
                onClick={() => {
                  actions.resubmit(person);
                }}
              >
                Resubmit
              </Menu.Item>
            )}
            {draft && (
              <Menu.Item
                onClick={() => {
                  actions.discard(person, draft);
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
                  actions.remove(person);
                  moveTo(active.row, active.column);
                }}
              >
                Remove person
              </Menu.Item>
            )}
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );

  // The drafts waiting among the people and columns shown, which Approvers approve or reject all at
  // once.
  const waitingShown: DraftSelection = canApprove
    ? {
        ...noDrafts(),
        people: shownPeople.filter(decidable).map(({ id }) => id),
        columns: fields
          .filter(
            (field) =>
              decidable(field) && columns.some(({ key }) => key === field.id),
          )
          .map(({ id }) => id),
        columnOrder:
          orderDraft !== undefined &&
          decidable({ draft: orderDraft, heldBy: orderHeldBy }),
      }
    : noDrafts();
  const waitingTotal = draftTotal(waitingShown);

  // A column only drafted to be added, or to draw on another list, has no live figures to compare.
  const liveForMetrics = (column: Column) => {
    const draft = column.field?.draft;
    if (draft?.action === "created") return undefined;
    if (fieldsLive.get(column.key)?.listId !== column.field?.listId) {
      return undefined;
    }
    return liveBeside(column) ?? liveColumn(column);
  };
  const metrics = view.breakdown !== undefined && (
    <MetricsPanel
      one="person"
      noun="people"
      {...countedPeople(view.show, shownPeople, columns, liveForMetrics)}
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

  // Menus and choices stay shown beside their cell however the table scrolls, so they are not hidden
  // when the cell is partly out of view.
  return (
    <WithMetrics panel={metrics}>
      <ViewBar
        one="person"
        noun="people"
        columns={columns}
        draftFilter={draftColumn}
        view={view}
        onView={onView}
        shown={shownPeople.length}
        total={people.length}
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
            {orderShown && (canEditColumns || canApprove) && (
              <OrderItems
                draft={orderDraft}
                canEdit={canEditColumns}
                canApprove={canApprove}
                actions={actions}
                waits={orderWaits}
                heldBy={orderHeldBy}
              />
            )}
          </>
        }
      />
      <Paper withBorder className={classes.tableScrollPanel}>
        <div
          className={classes.tableScroll}
          // Cells reached from the keyboard scroll clear of the header, however many lines of marks
          // it has under the columns' names.
          style={{
            scrollPaddingTop: `max(var(--fathom-table-head-height), ${String(
              markLines + 1,
            )} * ${headerLineHeight} + ${headerPadding})`,
          }}
        >
          <Table
            role="grid"
            aria-label="People"
            className={classes.peopleTable}
            layout="fixed"
            tabularNums
          >
            <colgroup>
              {columns.flatMap((column, columnIndex) => {
                const live = liveBeside(column);
                return [
                  <col
                    key={column.key}
                    className={
                      columnIndex === 0
                        ? classes.peopleColFirst
                        : classes.peopleCol
                    }
                    style={widthStyle(columnWidth(column, longestText))}
                  />,
                  live && (
                    <col
                      key={`${column.key}-live`}
                      className={classes.peopleCol}
                      style={widthStyle(columnWidth(live, longestText))}
                    />
                  ),
                ];
              })}
              {withActions && <col className={classes.peopleColActions} />}
            </colgroup>
            <Table.Thead>
              <Table.Tr>
                {columns.flatMap((column) => {
                  const live = liveBeside(column);
                  return [
                    header(column),
                    live && (
                      <Table.Th
                        key={`${column.key}-live`}
                        scope="col"
                        aria-hidden="true"
                        className={classes.liveColumn}
                      >
                        <span className={classes.peopleHeadButton}>
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
              {shownPeople.length === 0 && narrows(view) && (
                <Table.Tr>
                  <Table.Td
                    colSpan={
                      columns.length + besides.length + (withActions ? 1 : 0)
                    }
                    className={classes.peopleNone}
                  >
                    <Text component="span" fz="sm" c="dimmed">
                      No matching people
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {rows.map((row, rowIndex) => {
                const key = rowKey(row);
                const rowProblem =
                  problem?.row === key ? problem.message : row.newRow?.problem;
                const draft = row.person?.draft;
                // A row with a draft is tinted, and one a draft removes is struck through too.
                let rowClass: string | undefined;
                const filling = row.newRow && !emptyNewRow(row.newRow);
                if (row.newRow) {
                  rowClass = filling ? classes.peopleFillingRow : undefined;
                } else if (draft) {
                  rowClass = [
                    classes.draftRow,
                    draft.action === "deleted" ? classes.peopleRemovedRow : "",
                  ].join(" ");
                }
                return [
                  <Table.Tr
                    key={key}
                    className={rowClass}
                    aria-label={row.newRow ? "New person" : undefined}
                  >
                    {columns.flatMap((column, columnIndex) => {
                      const cell = { row: rowIndex, column: columnIndex };
                      const editingHere =
                        editing?.row === rowIndex &&
                        editing.column === columnIndex;
                      const isActive =
                        active.row === rowIndex &&
                        active.column === columnIndex;
                      const changes = draftChanges(draft, column);
                      const live =
                        changes && draft?.action === "changed"
                          ? shown(
                              liveColumn(column),
                              liveValue(draft, column),
                            ) || "empty"
                          : undefined;
                      return [
                        <Table.Td
                          key={column.key}
                          id={cellId(rowIndex, columnIndex)}
                          role="gridcell"
                          tabIndex={isActive ? 0 : -1}
                          aria-invalid={
                            columnIndex === 0 && rowProblem !== undefined
                              ? true
                              : undefined
                          }
                          className={[
                            classes.peopleCell,
                            columnTint(column),
                            changes
                              ? draft?.state === "rejected"
                                ? classes.rejectedCell
                                : classes.draftCell
                              : "",
                          ].join(" ")}
                          aria-readonly={
                            draft?.action === "deleted" ||
                            row.person?.heldBy !== undefined ||
                            (row.person && isPending(row.person))
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
                          onDoubleClick={() => {
                            startEdit(cell);
                          }}
                        >
                          {editingHere
                            ? editor(cell, column, valueAt(row, column))
                            : shown(column, valueAt(row, column))}
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
                          {columnIndex === 0 && row.person && !editingHere && (
                            <HoldMarks
                              unpublished={draft?.unpublished}
                              heldBy={row.person.heldBy}
                            />
                          )}
                          {columnIndex === 0 &&
                            row.newRow &&
                            filling &&
                            rowProblem === undefined &&
                            !editingHere && (
                              <NewMark
                                missing={columns
                                  .filter(
                                    (other) =>
                                      other.required &&
                                      isEmpty(newRowValue(row.newRow, other)),
                                  )
                                  .map(({ label }) => label)}
                              />
                            )}
                          {columnIndex === 0 && rowProblem !== undefined && (
                            <span
                              className={classes.peopleProblem}
                              role="alert"
                            >
                              {rowProblem}
                            </span>
                          )}
                        </Table.Td>,
                        liveCellBeside(row.person, column),
                      ];
                    })}
                    {withActions && (
                      <Table.Td className={classes.peopleCell}>
                        {row.person &&
                          hasMenu(row.person) &&
                          rowMenu(row.person)}
                      </Table.Td>
                    )}
                  </Table.Tr>,
                  // Under a person whose draft changes them, the person as they are live, to compare.
                  // Assistive technology hears each changed cell's live value instead.
                  row.person &&
                    draft?.action === "changed" &&
                    view.show === "both" && (
                      <Table.Tr
                        key={`${key}-live`}
                        className={classes.peopleLiveRow}
                        aria-hidden="true"
                      >
                        {columns.flatMap((column, columnIndex) => [
                          <Table.Td
                            key={column.key}
                            className={classes.peopleCell}
                          >
                            {shown(
                              liveColumn(column),
                              draft.changed.includes(column.key)
                                ? liveValue(draft, column)
                                : column.value(row.person),
                            )}
                            {columnIndex === 0 && (
                              <StatusMark tone="live" spaced>
                                Live
                              </StatusMark>
                            )}
                          </Table.Td>,
                          liveCellBeside(row.person, column),
                        ])}
                        {withActions && (
                          <Table.Td className={classes.peopleCell} />
                        )}
                      </Table.Tr>
                    ),
                ];
              })}
            </Table.Tbody>
          </Table>
        </div>
      </Paper>
    </WithMetrics>
  );
}
