// SPDX-License-Identifier: Apache-2.0

// Filtering, searching and sorting any table's rows in the browser, as ADR 0006 sets out, and
// keeping them where they were while they are edited.

import {
  type Filter,
  folded,
  type Link,
  linkLabel,
  notePlainText,
  searchWords,
  parseRecordKey,
  type RecordKeyOf,
  sameRecordKey,
} from "@fathom/shared";
import { useState } from "react";
import { lengthDays } from "./duration-cells.ts";
import { decimal } from "./numbers.ts";
import { formatDay, formatMonth } from "./day-formats.ts";
import {
  asText,
  type CellValue,
  isActive,
  type Kind,
  type TableColumn,
  valueOrStandIn,
  type View,
} from "./table-view.ts";

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

// Each kind's values are of one type: text and dates are strings, choices are lists, and links are
// links or null.
export { asText };
const asChoices = (value: CellValue) => value as string[];
const asLink = (value: CellValue) => value as Link | null;

interface Rules {
  isEmpty: (value: CellValue) => boolean;
  // The text a search looks in.
  words: (column: TableColumn<never>, value: CellValue) => string;
  // How two values that are not empty sort, ascending.
  compare: (column: TableColumn<never>, a: CellValue, b: CellValue) => number;
  // Whether a value that is not empty matches what the filter sets, other than `empty`.
  matches: (
    column: TableColumn<never>,
    value: CellValue,
    filter: Filter,
  ) => boolean;
}

const textRules: Rules = {
  isEmpty: (value) => asText(value).trim() === "",
  words: (_column, value) => asText(value),
  compare: (_column, a, b) => collator.compare(asText(a), asText(b)),
  matches: (_column, value, filter) => {
    const contains = folded((filter.contains ?? "").trim());
    return contains !== "" && folded(asText(value)).includes(contains);
  },
};

// A note is searched, sorted, and filtered by its words, without their formatting.
const noteRules: Rules = {
  isEmpty: (value) => asText(value).trim() === "",
  words: (_column, value) => notePlainText(asText(value)),
  compare: (_column, a, b) =>
    collator.compare(notePlainText(asText(a)), notePlainText(asText(b))),
  matches: (column, value, filter) =>
    textRules.matches(column, notePlainText(asText(value)), filter),
};

// A calendar value is searched by its digits and its name, and sorts as it is kept.
const calendarWords = (format: (value: string) => string, value: string) =>
  value === "" ? "" : `${value} ${format(value)}`;

const calendarRules = (
  format: (value: string) => string,
): Pick<Rules, "isEmpty" | "words" | "compare"> => ({
  isEmpty: (value) => asText(value) === "",
  words: (_column, value) => calendarWords(format, asText(value)),
  compare: (_column, a, b) => asText(a).localeCompare(asText(b)),
});

const monthRules: Rules = {
  ...calendarRules(formatMonth),
  matches: (column, value, filter) =>
    textRules.matches(
      column,
      calendarWords(formatMonth, asText(value)),
      filter,
    ),
};

const dateRules: Rules = {
  ...calendarRules(formatDay),
  matches: (_column, value, { from, to }) =>
    (from !== undefined || to !== undefined) &&
    (from === undefined || asText(value) >= from) &&
    (to === undefined || asText(value) <= to),
};

// A number is searched as it is typed and as it is shown.
const numberRules: Rules = {
  isEmpty: (value) => asText(value) === "",
  words: (_column, value) =>
    asText(value) === ""
      ? ""
      : `${asText(value)} ${decimal(Number(asText(value)))}`,
  compare: (_column, a, b) => Number(asText(a)) - Number(asText(b)),
  matches: (_column, value, { atLeast, atMost }) =>
    (atLeast !== undefined || atMost !== undefined) &&
    (atLeast === undefined || Number(asText(value)) >= atLeast) &&
    (atMost === undefined || Number(asText(value)) <= atMost),
};

// Where each chosen choice comes in its list, so choices sort in their list's order.
const places = (column: TableColumn<never>, value: CellValue) =>
  asChoices(value).map((id) =>
    column.choices.findIndex((choice) => choice.id === id),
  );

const choiceRules: Rules = {
  isEmpty: (value) => asChoices(value).length === 0,
  words: (column, value) =>
    asChoices(value)
      .map((id) => column.choices.find((choice) => choice.id === id)?.label)
      .join(" "),
  compare: (column, a, b) => {
    const first = places(column, a);
    const second = places(column, b);
    // The first choice where they differ decides, or else the one with fewer comes first.
    const at = first.findIndex(
      (place, index) => index < second.length && place !== second.at(index),
    );
    return at === -1
      ? first.length - second.length
      : Number(first.at(at)) - Number(second.at(at));
  },
  matches: (_column, value, filter) =>
    asChoices(value).some((id) => (filter.any ?? []).includes(id)),
};

// A link is searched and filtered by its text and its address, and sorted by what it shows.
const linkRules: Rules = {
  isEmpty: (value) => asLink(value) === null,
  words: (_column, value) => {
    const link = asLink(value);
    return link === null ? "" : `${link.text} ${link.address}`;
  },
  compare: (_column, a, b) =>
    collator.compare(
      linkLabel(asLink(a) as Link),
      linkLabel(asLink(b) as Link),
    ),
  matches: (_column, value, filter) => {
    const contains = folded((filter.contains ?? "").trim());
    const link = asLink(value) as Link;
    return (
      contains !== "" &&
      (folded(link.text).includes(contains) ||
        folded(link.address).includes(contains))
    );
  },
};

// A checkbox is never empty, so it sorts either way: checked or not, filtered by its one choice or
// by the empty choice, which names the unchecked.
const checked = (value: CellValue) => asChoices(value).length > 0;

const flagRules: Rules = {
  isEmpty: () => false,
  words: (column, value) =>
    checked(value) ? choiceRules.words(column, value) : "",
  compare: (_column, a, b) => Number(checked(b)) - Number(checked(a)),
  matches: (_column, value, filter) =>
    checked(value)
      ? asChoices(value).some((id) => (filter.any ?? []).includes(id))
      : filter.empty === true,
};

// A length is searched as typed, and sorts and is filtered by its size in calendar days.
const durationRules: Rules = {
  isEmpty: (value) => asText(value) === "",
  words: (_column, value) => asText(value),
  compare: (_column, a, b) => lengthDays(a) - lengthDays(b),
  matches: (_column, value, { atLeast, atMost }) => {
    const amount = lengthDays(value);
    return (
      (atLeast !== undefined || atMost !== undefined) &&
      (atLeast === undefined || amount >= atLeast) &&
      (atMost === undefined || amount <= atMost)
    );
  },
};

const rules: Record<Kind, Rules> = {
  text: textRules,
  date: dateRules,
  month: monthRules,
  number: numberRules,
  duration: durationRules,
  choice: choiceRules,
  link: linkRules,
  note: noteRules,
  flag: flagRules,
};

const rulesFor = (column: TableColumn<never>) => rules[column.kind];

// Whether a value counts as empty in its column.
export const isEmptyIn = (column: TableColumn<never>, value: CellValue) =>
  rulesFor(column).isEmpty(value);

// Whether a value matches a column's filter.
function matchesFilter(
  column: TableColumn<never>,
  value: CellValue,
  filter: Filter,
): boolean {
  const kind = rulesFor(column);
  if (kind.isEmpty(value)) return filter.empty === true;
  return filter.notEmpty === true || kind.matches(column, value, filter);
}

// The rows the view shows, in its order: those matching every filter and every word searched for,
// or, where the search is a record's key, the record with that key, sorted by each level in turn
// and otherwise left in the order given. Filters and sorts on columns the table does not have, such
// as ones the user may not see, are left out. Filters that are not columns filter the rows too, but
// are neither searched nor sorted on.
export function applyView<Row>(
  rows: readonly Row[],
  columns: readonly TableColumn<Row>[],
  view: View,
  filterOnly: readonly TableColumn<Row>[] = [],
  keyOf?: (row: Row) => RecordKeyOf | undefined,
): Row[] {
  const byKey = new Map(
    columns.map((column) => [column.key, column as TableColumn<never>]),
  );
  const filterable = new Map([
    ...byKey,
    ...filterOnly.map(
      (column) => [column.key, column as TableColumn<never>] as const,
    ),
  ]);
  const filters = Object.entries(view.filters).flatMap(([key, filter]) => {
    const column = filterable.get(key);
    return column && isActive(filter) ? [{ column, filter }] : [];
  });
  const words = searchWords(view.search);
  const searchedKey = parseRecordKey(view.search);
  // A search that is a key finds the one record with it, in a table whose records have keys.
  const keyed =
    keyOf === undefined || searchedKey === undefined
      ? undefined
      : (row: Row) => {
          const key = keyOf(row);
          return key !== undefined && sameRecordKey(key, searchedKey);
        };
  const levels = view.sort.flatMap((level) => {
    const column = byKey.get(level.key);
    return column ? [{ column, descending: level.descending }] : [];
  });
  const read = (column: TableColumn<never>, row: Row) =>
    valueOrStandIn(column, row as never);

  const shown = rows.filter((row) => {
    const filtered = filters.every(({ column, filter }) =>
      matchesFilter(column, read(column, row), filter),
    );
    if (!filtered || words.length === 0) return filtered;
    if (keyed !== undefined) return keyed(row);
    const cells = [...byKey.values()]
      .filter(({ searched }) => searched !== false)
      .map((column) =>
        folded(rulesFor(column).words(column, read(column, row))),
      );
    return words.every((word) => cells.some((cell) => cell.includes(word)));
  });

  return shown
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const { column, descending } of levels) {
        const kind = rulesFor(column);
        const first = read(column, a.row);
        const second = read(column, b.row);
        // Empty values come last, whichever way the column sorts.
        const empties =
          Number(kind.isEmpty(first)) - Number(kind.isEmpty(second));
        if (empties !== 0) return empties;
        if (kind.isEmpty(first)) continue;
        const order = kind.compare(column, first, second);
        if (order !== 0) return descending ? -order : order;
      }
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

interface Snapshot {
  view: string;
  // The rows shown when the view last changed, in order, and every row there was then.
  shown: string[];
  known: Set<string>;
}

// The rows to show, kept where they were when the view last changed, so editing a row never moves
// it or hides it. Rows since deleted drop out. Rows added since come at the end: those the user
// added, in the order they added them, which stay whether or not they match, then others, in the
// order given, only if the view shows them. The view's rows are taken afresh whenever the view
// changes; between changes, `apply` runs only on rows added since.
export function useSteadyOrder<Row>(
  all: readonly Row[],
  view: View,
  apply: (rows: readonly Row[]) => Row[],
  idOf: (row: Row) => string,
  added: ReadonlySet<string>,
): Row[] {
  const take = (): Snapshot => ({
    view: JSON.stringify(view),
    shown: apply(all).map(idOf),
    known: new Set(all.map(idOf)),
  });
  const [snapshot, setSnapshot] = useState(take);
  let current = snapshot;
  if (snapshot.view !== JSON.stringify(view)) {
    current = take();
    setSnapshot(current);
  }
  const byId = new Map(all.map((row) => [idOf(row), row]));
  const since = all.filter((row) => !current.known.has(idOf(row)));
  const matching = new Set(since.length === 0 ? [] : apply(since).map(idOf));
  const addedOrder = [...added];
  return [
    ...current.shown.flatMap((id) => {
      const row = byId.get(id);
      return row === undefined ? [] : [row];
    }),
    ...since
      .filter((row) => added.has(idOf(row)))
      .sort(
        (a, b) => addedOrder.indexOf(idOf(a)) - addedOrder.indexOf(idOf(b)),
      ),
    ...since.filter((row) => !added.has(idOf(row)) && matching.has(idOf(row))),
  ];
}
