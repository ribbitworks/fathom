// SPDX-License-Identifier: Apache-2.0

// The controls that change what a table shows: its search, column menus, filters, Group by and
// Views menu.

import {
  Button,
  Checkbox,
  CloseButton,
  Group,
  Input,
  Menu,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  VisuallyHidden,
} from "@mantine/core";
import {
  allOf,
  byName,
  folded,
  numberProblem,
  type SavedView,
  type Show,
  showSchema,
  typedNumber,
  type UnusableView,
  type ViewScope,
} from "@fathom/shared";
import {
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { DayInput } from "./day-input.tsx";
import { drafts as draftCount } from "./decision-dialog.tsx";
import { FilterPill, type ShownPageFilter } from "./filter-pills.tsx";
import { Icon } from "./icons.tsx";
import { metricsButtonId, metricsPanelId, metricsTitleId } from "./metrics.ts";
import { focusSoon } from "./focus.ts";
import {
  activeGrouping,
  activeThenBy,
  type BarFilter,
  filtersBesideColumns,
  groupedFirstBy,
  ungrouped,
  withGroupsReversed,
  notGrouped,
  notGroupedLabel,
  type ColumnChoice,
  type Filter,
  isActive,
  type Kind,
  emptyView,
  knownView,
  narrowsWith,
  hiddenColumnsOf,
  shownColumnsOf,
  withHidden,
  sameView,
  setsApart,
  type TableColumn,
  type View,
  viewFrom,
  withoutFilters,
  withPlaces,
  withUnit,
} from "./table-view.ts";
import type { GroupingChoice, GroupsHold } from "./row-groups.ts";
import { formatDay, formatDayRange } from "./day-formats.ts";
import { AppMenu, MenuChoices, MenuToggle, Tick } from "./app-menu.tsx";
import type { ColumnUnits } from "./record-table.ts";
import classes from "./pages.module.css";
import { ClearableInput } from "./clearable-input.tsx";
import { classWords } from "./status-mark.tsx";
import { count, decimal } from "./numbers.ts";

// Changes the view, replacing the current address rather than adding to its history when asked.
export type ChangeView = (view: View, replace?: boolean) => void;

// A column as the controls need it, whatever its rows.
type AnyColumn = Pick<
  TableColumn<never>,
  | "key"
  | "label"
  | "kind"
  | "choices"
  | "multiple"
  | "emptyLabel"
  | "retiredLabel"
  | "required"
  | "blankMeansNo"
  | "filterable"
  | "unit"
  | "places"
  | "dataClass"
  | "hiddenAtFirst"
>;

// Each kind's sorts, ascending then descending.
const sortNames: Record<Kind, [string, string]> = {
  text: ["Sort A to Z", "Sort Z to A"],
  date: ["Oldest first", "Newest first"],
  month: ["Earliest first", "Latest first"],
  number: ["Lowest first", "Highest first"],
  choice: ["List order", "Reverse list order"],
  link: ["Sort A to Z", "Sort Z to A"],
  note: ["Sort A to Z", "Sort Z to A"],
  flag: ["Checked first", "Unchecked first"],
};

// The two orders a grouping's groups run in, by what the groups are: as ranked, then reversed.
const groupOrderNames: Record<GroupsHold, [string, string]> = {
  time: ["Earliest first", "Latest first"],
  names: ["A to Z", "Z to A"],
  list: ["List order", "Reverse list order"],
};

// Lists of more choices than this can be narrowed by typing.
const narrowFrom = 8;

// The view sorted by a column too: as the next level, or, when it is sorted already, in its place
// with the direction given.
export function sortedBy(view: View, key: string, descending: boolean): View {
  const sorted = view.sort.some((level) => level.key === key);
  return {
    ...view,
    sort: sorted
      ? view.sort.map((level) =>
          level.key === key ? { key, descending } : level,
        )
      : [...view.sort, { key, descending }],
  };
}

// The view without a column's sort.
function unsorted(view: View, key: string): View {
  return { ...view, sort: view.sort.filter((level) => level.key !== key) };
}

// A filter with one part set, or taken out when undefined.
function withPart<Part extends keyof Filter>(
  filter: Filter,
  part: Part,
  value: Filter[Part] | undefined,
): Filter {
  return {
    ...Object.fromEntries(
      Object.entries(filter).filter(([name]) => name !== part),
    ),
    ...(value === undefined ? {} : { [part]: value }),
  };
}

function withFilter(view: View, key: string, filter: Filter | undefined): View {
  const { filters } = withoutFilters(view, (other) => other !== key);
  return {
    ...view,
    filters:
      filter && isActive(filter) ? { ...filters, [key]: filter } : filters,
  };
}

// A part of a view in words, as the Save view dialog lists it, such as Metrics: Position by Site.
export interface ViewPart {
  name: string;
  value: string;
}

// What saving a view keeps, part by part, so it is clear that what the Draft menu shows and the
// metrics are kept too. Parts on columns the table does not have are left out, as the view leaves
// them out.
export function viewParts(
  view: View,
  columns: readonly AnyColumn[],
  filterOnly: readonly AnyColumn[] = [],
  {
    groupings = [],
    choices = [],
    pageParts = noPageParts,
    pageFilter,
  }: {
    groupings?: readonly GroupingChoice[];
    choices?: readonly ViewChoice[];
    pageParts?: PageParts;
    pageFilter?: ShownPageFilter | undefined;
  } = {},
): ViewPart[] {
  const labelOf = (key: string) =>
    columns.filter((column) => column.key === key).map(({ label }) => label);
  const filters = [...columns, ...filterOnly].flatMap((column) => {
    const filter = view.filters[column.key];
    return filter && isActive(filter) ? [describeFilter(column, filter)] : [];
  });
  const sort = view.sort.flatMap(({ key, descending }) =>
    labelOf(key).map((label) => `${label} ${descending ? "↓" : "↑"}`),
  );
  const breakdown = (view.breakdown ?? []).flatMap(labelOf);
  const widths = widened(view, columns);
  const shownIn = unitsShown(view, columns);
  // A column hidden at first is named only once the view shows it.
  const hidden = hiddenColumnsOf(view, columns)
    .filter(({ hiddenAtFirst }) => hiddenAtFirst !== true)
    .map(({ label }) => label);
  const shownAtFirstHidden = shownColumnsOf(view, columns)
    .filter(({ hiddenAtFirst }) => hiddenAtFirst === true)
    .map(({ label }) => label);
  const first = activeGrouping(view, groupings);
  const thenBy = activeThenBy(view, groupings);
  const grouping =
    first === undefined
      ? undefined
      : thenBy === undefined
        ? first.label
        : `${first.label}, then ${thenBy.label}`;
  return [
    ...choiceParts(view, choices),
    ...pageParts(view),
    ...(view.search.trim() === ""
      ? []
      : [{ name: "Search", value: `“${view.search.trim()}”` }]),
    ...[
      ...(pageFilter === undefined ? [] : [pageFilter.words]),
      ...filters,
    ].map((value) => ({ name: "Filter", value })),
    ...(sort.length === 0 ? [] : [{ name: "Sort", value: sort.join(", ") }]),
    ...(view.show === "both"
      ? []
      : [{ name: "Draft", value: showLabel(view.show) }]),
    ...(breakdown.length === 0
      ? []
      : [{ name: "Metrics", value: breakdown.join(" by ") }]),
    ...(grouping === undefined ? [] : [{ name: "Group by", value: grouping }]),
    ...(first === undefined || view.groupsReversed !== true
      ? []
      : [{ name: "Group order", value: groupOrderNames[first.holds][1] }]),
    ...(view.frozen === undefined
      ? []
      : [
          {
            name: "Frozen",
            value: frozenUpTo(
              view.frozen,
              shownColumnsOf(view, columns),
              "Up to",
              "None",
            ),
          },
        ]),
    ...(view.order === undefined
      ? []
      : [{ name: "Column order", value: "Moved" }]),
    ...(hidden.length === 0
      ? []
      : [{ name: "Hidden", value: hidden.join(", ") }]),
    ...(shownAtFirstHidden.length === 0
      ? []
      : [{ name: "Shown", value: shownAtFirstHidden.join(", ") }]),
    ...(widths.length === 0
      ? []
      : [{ name: "Widths", value: widths.join(", ") }]),
    ...(shownIn.length === 0
      ? []
      : [{ name: "Units", value: shownIn.join(", ") }]),
  ];
}

// The columns the view shows in a unit or to decimal places of their own, such as Effort in
// person-weeks to 1 decimal place.
function unitsShown(view: View, columns: readonly AnyColumn[]): string[] {
  const units = new Map(Object.entries(view.units ?? {}));
  const places = new Map(Object.entries(view.places ?? {}));
  return columns.flatMap(({ key, label, unit, places: shownTo }) => {
    const words = [
      ...(units.has(key) && unit !== undefined ? [`in ${unit.name}`] : []),
      ...(places.has(key) && shownTo !== undefined
        ? [
            `to ${String(shownTo)} decimal ${shownTo === 1 ? "place" : "places"}`,
          ]
        : []),
    ];
    return words.length === 0 ? [] : [`${label} ${words.join(" ")}`];
  });
}

// The names of the columns whose widths the view sets, in the table's order.
function widened(view: View, columns: readonly AnyColumn[]): string[] {
  return columns
    .filter((column) => view.widths?.[column.key] !== undefined)
    .map(({ label }) => label);
}

// The frozen columns in words: the last one frozen, after `upTo`, or `none`.
function frozenUpTo(
  frozen: number,
  columns: readonly AnyColumn[],
  upTo: string,
  none: string,
): string {
  const last = columns.slice(0, frozen).at(-1);
  return last === undefined ? none : `${upTo} ${last.label}`;
}

// A filter in words, such as "Site: Harbour, Northmere".
// What a filter's choice of every value that isn't empty is called, matching its Empty box. A
// checkbox's filter offers none, since a checkbox is never empty, but an address or saved view may
// still hold one, which its pill names.
const notEmptyLabels: Record<Kind, string> = {
  text: "Not empty",
  month: "Not empty",
  link: "Not empty",
  note: "Not empty",
  choice: "Not empty",
  flag: "Not empty",
  date: "Any date",
  number: "Any number",
};

export function describeFilter(column: AnyColumn, filter: Filter): string {
  // Any value matches, so nothing else the filter holds narrows it further.
  if (filter.notEmpty === true) {
    return `${column.label}: ${notEmptyLabels[column.kind]}`;
  }
  const parts: string[] = [];
  switch (column.kind) {
    case "choice":
    case "flag":
      parts.push(
        ...column.choices
          .filter((choice) => (filter.any ?? []).includes(choice.id))
          .map((choice) => choice.label),
      );
      if (filter.empty) parts.push(column.emptyLabel ?? "Empty");
      return `${column.label}: ${parts.join(", ")}`;
    case "date": {
      const { from, to } = filter;
      if (from !== undefined && to !== undefined) {
        parts.push(formatDayRange(from, to));
      } else if (from !== undefined) {
        parts.push(`from ${formatDay(from)}`);
      } else if (to !== undefined) {
        parts.push(`until ${formatDay(to)}`);
      }
      if (filter.empty) parts.push("No date");
      return `${column.label}: ${parts.join(" or ")}`;
    }
    case "number": {
      const { atLeast, atMost } = filter;
      if (atLeast !== undefined && atMost !== undefined) {
        parts.push(`${decimal(atLeast)} to ${decimal(atMost)}`);
      } else if (atLeast !== undefined) {
        parts.push(`at least ${decimal(atLeast)}`);
      } else if (atMost !== undefined) {
        parts.push(`at most ${decimal(atMost)}`);
      }
      if (filter.empty) parts.push("No number");
      return `${column.label}: ${parts.join(" or ")}`;
    }
    case "text":
    case "month":
    case "link":
    case "note": {
      const contains = (filter.contains ?? "").trim();
      if (contains !== "") parts.push(`contains “${contains}”`);
      if (filter.empty) parts.push("Empty");
      return `${column.label}: ${parts.join(" or ")}`;
    }
  }
}

// How a column is sorted and filtered, in words for its header's name, such as ", sorted
// descending, level 2, filtered", or nothing when it is neither.
export function headerState(column: AnyColumn, view: View): string {
  const sort = view.sort.find((level) => level.key === column.key);
  const parts = [
    ...(sort
      ? [
          `sorted ${sort.descending ? "descending" : "ascending"}`,
          ...(view.sort.length > 1
            ? [`level ${String(view.sort.indexOf(sort) + 1)}`]
            : []),
        ]
      : []),
    ...(isActive(view.filters[column.key]) ? ["filtered"] : []),
  ];
  return [...classWords(column.dataClass), ...parts]
    .map((part) => `, ${part}`)
    .join("");
}

// Whether Fathom's own find key was pressed: Cmd+F on a Mac, and Ctrl+F elsewhere, where Ctrl+F is
// left to the Mac's text fields.
function isFind(event: globalThis.KeyboardEvent, mac: boolean): boolean {
  const command = mac
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  return command && !event.altKey && event.key.toLowerCase() === "f";
}

// The search field. Cmd+F on a Mac, or Ctrl+F elsewhere, focuses it from anywhere on the page
// except a dialog; Esc clears it, or, once it is empty, leaves it, for the table where the page
// says where to go, and its clear button clears it and leaves it focused. The first change after it
// is focused adds to the address's history, and the rest replace it, so Back undoes a whole search;
// clearing with the button adds to it too, so Back brings the search back.
export function TableSearch({
  label,
  value,
  onChange,
  onLeave,
}: {
  label: string;
  value: string;
  onChange: (text: string, replace: boolean) => void;
  onLeave?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  // What is typed is kept here as well as in the address, so typing never waits on the address.
  const [text, setText] = useState(value);
  // What has been sent to the address and not yet come back, in order, and the address's value when
  // last seen. A value that comes back is one this field sent, and is let pass; any other, such as
  // from Back or Clear all, replaces what is typed, and the next change adds to history again.
  const [pending, setPending] = useState<string[]>([]);
  const [seen, setSeen] = useState(value);
  const [changed, setChanged] = useState(false);
  if (value !== seen) {
    setSeen(value);
    const at = pending.indexOf(value);
    if (at === -1) {
      setPending([]);
      setText(value);
      setChanged(false);
    } else {
      setPending(pending.slice(at + 1));
    }
  }

  useEffect(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
    const onKey = (event: globalThis.KeyboardEvent) => {
      const inDialog =
        document.activeElement?.closest('[role="dialog"]') != null;
      if (event.defaultPrevented || inDialog || !isFind(event, mac)) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const change = (next: string, replace = changed) => {
    setText(next);
    setPending((sent) => [...sent, next]);
    onChange(next, replace);
    setChanged(true);
  };

  return (
    <TextInput
      ref={input}
      className={classes.tableSearch}
      aria-label={label}
      placeholder="Search"
      leftSection={<Icon name="search" />}
      rightSection={
        text === "" ? undefined : (
          <Input.ClearButton
            aria-label="Clear search"
            onClick={() => {
              change("", false);
              input.current?.focus();
            }}
          />
        )
      }
      rightSectionPointerEvents="all"
      value={text}
      autoComplete="off"
      onFocus={() => {
        setChanged(false);
      }}
      onChange={(event) => {
        change(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        if (text === "") {
          if (onLeave === undefined) input.current?.blur();
          else onLeave();
        } else {
          change("");
        }
      }}
    />
  );
}

// A table's saved views, the one its view started from, if any, and what can be done with them.
export interface SavedViews {
  views: readonly SavedView[];
  // The user's own personal views their role can no longer use, which they may rename or delete.
  unusable: readonly UnusableView[];
  applied: string | undefined;
  onApply: (view: View, id: string) => void;
  // Opens the dialog naming a new saved view for the table's view, listing what saving it keeps.
  onSave: (view: View, parts: readonly ViewPart[]) => void;
  onRename: (saved: SavedView | UnusableView) => void;
  onUpdate: (saved: SavedView, view: View) => void;
  onDelete: (saved: SavedView) => void;
  // Asks first, since deleting a view that can't be used can't be undone.
  onDeleteUnusable: (saved: UnusableView) => void;
  onScope: (saved: SavedView, scope: ViewScope) => void;
}

// A choice of which records a table shows, beyond its filters, first in its Views menu and kept in
// its view, such as Show retired: an item ticked while on, naming how many records it adds.
export interface ViewChoice {
  label: string;
  count: number;
  on: (view: View) => boolean;
  turned: (view: View, on: boolean) => View;
  // How the Save view dialog names it while on.
  part: ViewPart;
}

// The parts of a view its page's own choices set outside the Views menu, such as Features' Board, as
// the Save view dialog names them.
export type PageParts = (view: View) => ViewPart[];
const noPageParts: PageParts = () => [];

// The parts of a view its page's choices set, as the Save view dialog names them.
const choiceParts = (view: View, choices: readonly ViewChoice[]): ViewPart[] =>
  choices.filter((choice) => choice.on(view)).map(({ part }) => part);

// What a view its maker can no longer use is missing, as its line in the Views menu says it.
export function missingWords({ missing }: UnusableView): string[] {
  return [
    ...(missing.columns.length === 0
      ? []
      : [`Uses ${allOf(missing.columns)}, which this role can't see.`]),
    ...(missing.groupings.length === 0
      ? []
      : [`Grouped by ${allOf(missing.groupings)}, which this role can't see.`]),
  ];
}

// A view its maker can no longer use, dimmed under My views with what it's missing, its own menu
// offering Rename… and Delete… alone.
function UnusableItem({
  unusable,
  onRename,
  onDelete,
}: {
  unusable: UnusableView;
  onRename: () => void;
  onDelete: () => void;
}) {
  const lines = missingWords(unusable);
  return (
    <Menu.Sub>
      <Menu.Sub.Target>
        <Menu.Sub.Item leftSection={<Tick chosen={false} />}>
          <Text component="span" display="block" c="dimmed" fz="sm">
            {unusable.name}
          </Text>
          {lines.map((line) => (
            <Text
              key={line}
              component="span"
              display="block"
              c="dimmed"
              fz="xs"
            >
              {line}
            </Text>
          ))}
        </Menu.Sub.Item>
      </Menu.Sub.Target>
      <Menu.Sub.Dropdown>
        <Menu.Item onClick={onRename}>Rename…</Menu.Item>
        <Menu.Item color="red" onClick={onDelete}>
          Delete…
        </Menu.Item>
      </Menu.Sub.Dropdown>
    </Menu.Sub>
  );
}

// A page's choices, first in its Views menu.
function ChoiceItems({
  choices,
  view,
  onView,
}: {
  choices: readonly ViewChoice[];
  view: View;
  onView: ChangeView;
}) {
  return choices.map((choice) => (
    <MenuToggle
      key={choice.label}
      label={`${choice.label} (${count(choice.count)})`}
      on={choice.on(view)}
      onToggle={(on) => {
        onView(choice.turned(view, on));
      }}
    />
  ));
}

export const viewScopes: Record<
  ViewScope,
  {
    heading: string;
    changesTo: ViewScope;
    changeLabel: string;
    changedVerb: string;
  }
> = {
  personal: {
    heading: "My views",
    changesTo: "shared",
    changeLabel: "Share current view",
    changedVerb: "Shared",
  },
  shared: {
    heading: "Shared views",
    changesTo: "personal",
    changeLabel: "Stop sharing current view",
    changedVerb: "Stopped sharing",
  },
};

// The menu of a table's saved views, named after the one the view started from, marked when the
// view has changed since, or, with none applied, from the table's default view. Choosing a view
// applies it. The menu names each level of the sort, the frozen columns, the columns moved, and the
// columns whose widths are set, which the table itself already shows, each item removing what it
// names, and the hidden columns, each item showing its column again. It clears
// the view, saves it as a new one, and updates, renames, or deletes the one applied when the user
// may change it, and shares it or stops sharing it when they may.
export function ViewsMenu({
  saved,
  columns,
  filterOnly = [],
  view,
  onView,
  onClear,
  choices = [],
  pageParts = noPageParts,
  pageFilter,
  groupings = [],
  laysOutColumns = true,
}: {
  saved?: SavedViews | undefined;
  columns: readonly AnyColumn[];
  filterOnly?: readonly AnyColumn[];
  view: View;
  onView: ChangeView;
  // Clears the view, leaving the saved view it started from.
  onClear: () => void;
  choices?: readonly ViewChoice[];
  pageParts?: PageParts;
  // A filter of the page's own in use, which Save view names with the column filters.
  pageFilter?: ShownPageFilter | undefined;
  groupings?: readonly GroupingChoice[];
  // False above rows drawn their own way, such as a board's, which lay out no columns, so the sort,
  // units and frozen, moved, hidden and widened columns the view keeps for its table aren't offered
  // there.
  laysOutColumns?: boolean;
}) {
  const views = saved?.views ?? [];
  const unusable = saved?.unusable ?? [];
  // Each level of the sort, in order, with its column; a column the table does not have is left
  // out.
  const sorts = view.sort.flatMap(({ key, descending }) =>
    columns
      .filter((column) => column.key === key)
      .map((column) => ({ column, descending })),
  );
  // Each saved view as the table can show it, without columns deleted since.
  const shownAs = (saved: SavedView) =>
    knownView(viewFrom(saved.definition), columns, filterOnly);
  const current = views.find((each) => each.id === saved?.applied);
  const empty = sameView(view, emptyView);
  const changed = current ? !sameView(shownAs(current), view) : !empty;
  const widths = widened(view, columns);
  const shownIn = unitsShown(view, columns);
  const hidden = hiddenColumnsOf(view, columns);
  // What the view sets beyond the rows it shows, each part set apart, removing what it names. Each
  // only changes the table, so none is offered above rows drawn their own way.
  const sections = [
    {
      key: "sort",
      items: sorts.length > 0 && (
        <>
          <Menu.Label>Sort</Menu.Label>
          {sorts.map(({ column, descending }) => (
            <Menu.Item
              key={column.key}
              rightSection={<Icon name="close" size={12} />}
              onClick={() => {
                onView(unsorted(view, column.key));
              }}
            >
              {column.label} <span aria-hidden>{descending ? "↓" : "↑"}</span>
              <VisuallyHidden>
                {descending ? "descending" : "ascending"}, remove sort
              </VisuallyHidden>
            </Menu.Item>
          ))}
        </>
      ),
    },
    {
      key: "frozen",
      items: view.frozen !== undefined && (
        <Menu.Item
          rightSection={<Icon name="close" size={12} />}
          onClick={() => {
            onView({ ...view, frozen: undefined });
          }}
        >
          {frozenUpTo(
            view.frozen,
            shownColumnsOf(view, columns),
            "Frozen to",
            "Unfrozen",
          )}
          <VisuallyHidden>, reset</VisuallyHidden>
        </Menu.Item>
      ),
    },
    {
      key: "order",
      items: view.order !== undefined && (
        <Menu.Item
          rightSection={<Icon name="close" size={12} />}
          onClick={() => {
            onView({ ...view, order: undefined });
          }}
        >
          Columns moved
          <VisuallyHidden>, reset</VisuallyHidden>
        </Menu.Item>
      ),
    },
    {
      key: "hidden",
      items: hidden.length > 0 && (
        <>
          <Menu.Label>Hidden</Menu.Label>
          {hidden.length > 1 && (
            <Menu.Item
              onClick={() => {
                onView(
                  withHidden(
                    view,
                    columns,
                    hidden.map(({ key }) => key),
                    false,
                  ),
                );
              }}
            >
              Show all columns
            </Menu.Item>
          )}
          {hidden.map((column) => (
            <Menu.Item
              key={column.key}
              onClick={() => {
                onView(withHidden(view, columns, [column.key], false));
              }}
            >
              {column.label}
              <VisuallyHidden>, show</VisuallyHidden>
            </Menu.Item>
          ))}
        </>
      ),
    },
    {
      key: "widths",
      items: widths.length > 0 && (
        <Menu.Item
          rightSection={<Icon name="close" size={12} />}
          onClick={() => {
            onView({ ...view, widths: undefined });
          }}
        >
          Widths: {widths.join(", ")}
          <VisuallyHidden>, reset</VisuallyHidden>
        </Menu.Item>
      ),
    },
    {
      key: "units",
      items: shownIn.length > 0 && (
        <Menu.Item
          rightSection={<Icon name="close" size={12} />}
          onClick={() => {
            onView({ ...view, units: undefined, places: undefined });
          }}
        >
          Units: {shownIn.join(", ")}
          <VisuallyHidden>, reset</VisuallyHidden>
        </Menu.Item>
      ),
    },
  ].filter(({ items }) => laysOutColumns && items !== false);
  const actions = !empty || current?.canChange === true;
  const hasChoices = choices.length > 0;
  const listed = views.length + unusable.length > 0;
  // A column hidden at first is shown again from here, even before the view sets anything.
  if (
    !listed &&
    empty &&
    !hasChoices &&
    (hidden.length === 0 || !laysOutColumns)
  ) {
    return null;
  }
  return (
    <AppMenu position="bottom-start" hideDetached={false}>
      <AppMenu.Target>
        <Button
          variant="default"
          aria-label={`Views${current ? `: ${current.name}` : ""}${changed ? ", changed" : ""}`}
        >
          {current?.name ?? "Views"}
          {changed && (
            <span aria-hidden className={classes.changedMark}>
              •
            </span>
          )}
        </Button>
      </AppMenu.Target>
      <AppMenu.Dropdown>
        <ChoiceItems choices={choices} view={view} onView={onView} />
        {hasChoices && (listed || sections.length > 0 || actions) && (
          <Menu.Divider />
        )}
        {saved &&
          Object.entries(viewScopes).map(([scope, { heading }]) => {
            const grouped = views.filter((each) => each.scope === scope);
            const dimmed = scope === "personal" ? unusable : [];
            return (
              grouped.length + dimmed.length > 0 && (
                <MenuChoices
                  key={scope}
                  label={heading}
                  divided={false}
                  after={[...dimmed].sort(byName).map((each) => (
                    <UnusableItem
                      key={each.id}
                      unusable={each}
                      onRename={() => {
                        saved.onRename(each);
                      }}
                      onDelete={() => {
                        saved.onDeleteUnusable(each);
                      }}
                    />
                  ))}
                  choices={grouped
                    .sort(byName)
                    .map((each) => ({ value: each.id, label: each.name }))}
                  chosen={saved.applied}
                  onChoose={(id) => {
                    // The view chosen, always one of the group's: an early return for none
                    // could never run, and an assertion would hide a mistake.
                    grouped
                      .filter((each) => each.id === id)
                      .forEach((each) => {
                        saved.onApply(shownAs(each), id);
                      });
                  }}
                />
              )
            );
          })}
        {sections.length > 0 && listed && <Menu.Divider />}
        {sections.map((section, at) => (
          <Fragment key={section.key}>
            {at > 0 && <Menu.Divider />}
            {section.items}
          </Fragment>
        ))}
        {actions && (listed || sections.length > 0) && <Menu.Divider />}
        {!empty && <Menu.Item onClick={onClear}>Clear view</Menu.Item>}
        {saved && !empty && (
          <Menu.Item
            onClick={() => {
              saved.onSave(
                view,
                viewParts(view, columns, filterOnly, {
                  groupings,
                  choices,
                  pageParts,
                  pageFilter,
                }),
              );
            }}
          >
            {current === undefined ? "Save view…" : "Save as new view…"}
          </Menu.Item>
        )}
        {saved && current?.canChange && (
          <>
            {changed && (
              <Menu.Item
                onClick={() => {
                  saved.onUpdate(current, view);
                }}
              >
                Update view
              </Menu.Item>
            )}
            <Menu.Item
              onClick={() => {
                saved.onRename(current);
              }}
            >
              Rename…
            </Menu.Item>
            {current.canShare && (
              <Menu.Item
                onClick={() => {
                  saved.onScope(current, viewScopes[current.scope].changesTo);
                }}
              >
                {viewScopes[current.scope].changeLabel}
              </Menu.Item>
            )}
            <Menu.Item
              color="red"
              onClick={() => {
                saved.onDelete(current);
              }}
            >
              Delete view
            </Menu.Item>
          </>
        )}
      </AppMenu.Dropdown>
    </AppMenu>
  );
}

const showLabels: Record<Show, string> = {
  both: "Drafts & Live",
  drafts: "Drafts applied",
  live: "Live only",
};

export const showLabel = (show: Show) =>
  // The choice is always one of the typed choices, each a key of the labels.
  // eslint-disable-next-line security/detect-object-injection
  showLabels[show];

const check = (on: boolean) => (
  <span className={classes.appliedMark} aria-hidden>
    {on ? "✓" : ""}
  </span>
);

// The Draft button of a table with drafts: a menu choosing which version of each record shows, the
// draft beside the live record, the draft applied, as everything will be once approved, or the
// live record alone, as everything is now, which is read only; and, where the table filters by
// draft, which rows show, which the live records alone have no drafts for. The button names the
// choice, and is marked while the filter is in use.
export function DraftMenu({
  show,
  onShow,
  filter,
  children,
}: {
  show: Show;
  onShow: (show: Show) => void;
  filter?: DraftFilter;
  // What may be done with drafts beyond choosing what to show, such as deciding all those shown.
  children?: ReactNode;
}) {
  const marked =
    filter !== undefined && isActive(filter.view.filters[filter.column.key]);
  const shown = showLabel(show);
  return (
    <AppMenu
      position="bottom-start"
      hideDetached={false}
      closeOnItemClick={false}
    >
      <AppMenu.Target>
        <Button
          variant="default"
          leftSection={<Icon name="filter" />}
          aria-label={`Draft: ${shown}${marked ? ", filtered" : ""}`}
        >
          {shown}
          {marked && (
            <span aria-hidden="true" className={classes.changedMark}>
              •
            </span>
          )}
        </Button>
      </AppMenu.Target>
      <AppMenu.Dropdown>
        <Menu.Label>Show</Menu.Label>
        {showSchema.options.map((each) => (
          <Menu.Item
            key={each}
            leftSection={check(each === show)}
            onClick={() => {
              onShow(each);
            }}
          >
            {showLabel(each)}
            {each === show && <VisuallyHidden>, on</VisuallyHidden>}
          </Menu.Item>
        ))}
        {filter && (
          <DraftFilterItems
            {...filter}
            disabled={show === "live"}
            // Rejected drafts are taken back with the drafts applied, so none shows as rejected.
            unavailable={show === "drafts" ? ["rejected"] : []}
          />
        )}
        {children}
      </AppMenu.Dropdown>
    </AppMenu>
  );
}

// Approving or rejecting every draft waiting among the records shown, in the Draft menu, for
// Approvers.
export function DecideAllItems({
  total,
  everywhere,
  disabled = false,
  onDecide,
}: {
  // The drafts waiting among those shown, which these decide, and all those the role could decide,
  // so the menu says when a search, filter, hidden column or Drafts applied hides some.
  total: number;
  everywhere: number;
  // While a change is still saving, so a draft not saved yet is never sent.
  disabled?: boolean;
  onDecide: (asking: "approve" | "reject") => void;
}) {
  return (
    <>
      <Menu.Divider />
      <Menu.Label>
        {total === everywhere
          ? "Waiting drafts"
          : `${count(total)} of ${count(everywhere)} waiting drafts shown`}
      </Menu.Label>
      <Menu.Item
        closeMenuOnClick
        disabled={disabled}
        onClick={() => {
          onDecide("approve");
        }}
      >
        Approve {draftCount(total)}…
      </Menu.Item>
      <Menu.Item
        closeMenuOnClick
        disabled={disabled}
        onClick={() => {
          onDecide("reject");
        }}
      >
        Reject {draftCount(total)}…
      </Menu.Item>
    </>
  );
}

interface DraftFilter {
  column: AnyColumn;
  view: View;
  onView: ChangeView;
  // Shown but unavailable while the live records alone show, since they have no drafts.
  disabled?: boolean;
  // The choices shown but unavailable, such as rejected drafts while they are taken back.
  unavailable?: readonly string[];
}

// The Draft menu's filter: which rows show, by whether they have a draft, waiting or rejected.
function DraftFilterItems({
  column,
  view,
  onView,
  disabled = false,
  unavailable = [],
}: DraftFilter) {
  const current = view.filters[column.key] ?? {};
  const any = current.any ?? [];
  const toggle = (next: Filter) => {
    onView(withFilter(view, column.key, next));
  };
  return (
    <>
      <Menu.Divider />
      <Menu.Label>
        {disabled ? "Filter (needs drafts shown)" : "Filter"}
      </Menu.Label>
      {column.choices.map((choice) => {
        const on = any.includes(choice.id);
        return (
          <Menu.Item
            key={choice.id}
            disabled={disabled || unavailable.includes(choice.id)}
            leftSection={check(on)}
            onClick={() => {
              toggle(
                withPart(
                  current,
                  "any",
                  on
                    ? any.filter((id) => id !== choice.id)
                    : [...any, choice.id],
                ),
              );
            }}
          >
            {choice.label}
            {on && <VisuallyHidden>, on</VisuallyHidden>}
          </Menu.Item>
        );
      })}
      <Menu.Item
        disabled={disabled}
        leftSection={check(current.empty === true)}
        onClick={() => {
          toggle(
            withPart(
              current,
              "empty",
              current.empty === true ? undefined : true,
            ),
          );
        }}
      >
        {column.emptyLabel}
        {current.empty === true && <VisuallyHidden>, on</VisuallyHidden>}
      </Menu.Item>
    </>
  );
}

const noGrouping = { key: notGrouped, label: notGroupedLabel };

// Chooses what the rows are grouped by, or that they show as one list, and, for a table whose rows
// nest, what they're grouped by under each heading, from the other groupings, in one menu whose
// button names both. Choosing none, or the second grouping, as the first takes the second away.
function GroupingMenu({
  groupings,
  nests,
  view,
  onView,
}: {
  groupings: readonly GroupingChoice[];
  nests: boolean;
  view: View;
  onView: ChangeView;
}) {
  const inUse = activeGrouping(view, groupings);
  const offersThenBy = nests && inUse !== undefined;
  const thenBy = offersThenBy ? activeThenBy(view, groupings) : undefined;
  const choicesOf = (list: readonly { key: string; label: string }[]) =>
    list.map(({ key, label }) => ({ value: key, label }));
  return (
    <AppMenu position="bottom-start" hideDetached={false}>
      <AppMenu.Target>
        <Button variant="default">
          Group by
          {inUse !== undefined && `: ${inUse.label}`}
          {thenBy !== undefined && `, then ${thenBy.label}`}
        </Button>
      </AppMenu.Target>
      <AppMenu.Dropdown>
        <MenuChoices
          label={offersThenBy ? "Group by" : undefined}
          divided={false}
          choices={choicesOf([noGrouping, ...groupings])}
          chosen={(inUse ?? noGrouping).key}
          onChoose={(key) => {
            onView(
              groupedFirstBy(view, key === noGrouping.key ? undefined : key),
            );
          }}
        />
        {inUse !== undefined && (
          <GroupOrderChoices holds={inUse.holds} view={view} onView={onView} />
        )}
        {offersThenBy && (
          <MenuChoices
            label="Then by"
            choices={choicesOf([
              noGrouping,
              ...groupings.filter(({ key }) => key !== inUse.key),
            ])}
            chosen={(thenBy ?? noGrouping).key}
            onChoose={(key) => {
              onView({
                ...view,
                thenBy: key === noGrouping.key ? undefined : key,
              });
            }}
          />
        )}
        {inUse !== undefined && (
          <>
            <Menu.Divider />
            <Menu.Item
              onClick={() => {
                onView(ungrouped(view));
              }}
            >
              Clear grouping
            </Menu.Item>
          </>
        )}
      </AppMenu.Dropdown>
    </AppMenu>
  );
}

const reversedOrder = "reversed";
const rankedOrder = "ranked";

// The order the first grouping's groups run in, named by what they are, such as A to Z.
function GroupOrderChoices({
  holds,
  view,
  onView,
}: {
  holds: GroupsHold;
  view: View;
  onView: ChangeView;
}) {
  // Each kind of grouping always has its two names.
  // eslint-disable-next-line security/detect-object-injection
  const [ranked, reversed] = groupOrderNames[holds];
  return (
    <MenuChoices
      spokenLabel="Group order"
      choices={[
        { value: rankedOrder, label: ranked },
        { value: reversedOrder, label: reversed },
      ]}
      chosen={view.groupsReversed === true ? reversedOrder : rankedOrder}
      onChoose={(order) => {
        onView(withGroupsReversed(view, order === reversedOrder));
      }}
    />
  );
}

// The bar above a table: its search, the Draft menu, Metrics, the grouping, its Views menu, a pill for each
// filter, since filters hide rows, how many rows there are, or how many are shown while some are
// hidden, and Clear all.
export function ViewBar({
  one,
  noun,
  columns: everyColumn,
  draftFilter,
  view,
  onView,
  shown,
  total,
  counted,
  onLeave,
  saved,
  draftItems,
  choices,
  pageParts,
  groupings,
  nests = false,
  laysOutColumns = true,
  withDrafts = true,
  barFilters = [],
  pageFilter,
}: {
  // What the rows are, one and several, such as "person" and "people".
  one: string;
  noun: string;
  columns: readonly AnyColumn[];
  // The filter on drafts, which is not a column of the table, offered with the choice of what to
  // show in the Draft menu.
  draftFilter: AnyColumn;
  view: View;
  onView: ChangeView;
  shown: number;
  total: number;
  // For rows of several kinds, how many of each there are in all, such as "150 people and 6
  // planned hires".
  counted?: ReactNode;
  // What the rows can be grouped by, for a table that groups them.
  groupings?: readonly GroupingChoice[] | undefined;
  // False for rows drawn their own way, such as a board's, or made for their grouping.
  nests?: boolean;
  // False for rows drawn their own way, such as a board's, which lay out no columns.
  laysOutColumns?: boolean;
  // Goes back to the table from the search field.
  onLeave: () => void;
  saved?: SavedViews | undefined;
  // Added to the Draft menu, after what to show and the filter.
  draftItems?: ReactNode;
  choices?: readonly ViewChoice[] | undefined;
  pageParts?: PageParts | undefined;
  // False for a table whose records never have drafts.
  withDrafts?: boolean;
  // Filters across the whole table, each with its button after the search field.
  barFilters?: readonly BarFilter<never>[] | undefined;
  pageFilter?: ShownPageFilter | undefined;
}) {
  const filterOnly = filtersBesideColumns(draftFilter, barFilters);
  const columns = [...everyColumn, ...filterOnly];
  const narrowed = narrowsWith(view, pageFilter);
  const filters = columns.flatMap((column) => {
    const filter = view.filters[column.key];
    return filter && isActive(filter) ? [{ column, filter }] : [];
  });
  return (
    <Group gap="sm" mb="sm" wrap="wrap">
      <TableSearch
        label={`Search ${noun}`}
        value={view.search}
        onChange={(search, replace) => {
          onView({ ...view, search }, replace);
        }}
        onLeave={onLeave}
      />
      {barFilters.map((filter) => (
        <BarFilterButton
          key={filter.column.key}
          {...filter}
          view={view}
          onView={onView}
        />
      ))}
      {withDrafts && (
        <DraftMenu
          show={view.show}
          onShow={(show) => {
            onView({ ...view, show });
          }}
          filter={{ column: draftFilter, view, onView }}
        >
          {draftItems}
        </DraftMenu>
      )}
      <Button
        id={metricsButtonId}
        variant={view.breakdown === undefined ? "default" : "light"}
        leftSection={<Icon name="metrics" />}
        aria-expanded={view.breakdown !== undefined}
        aria-controls={
          view.breakdown === undefined ? undefined : metricsPanelId
        }
        onClick={() => {
          if (view.breakdown === undefined) {
            onView({ ...view, breakdown: [] });
            focusSoon(metricsTitleId);
          } else onView({ ...view, breakdown: undefined });
        }}
      >
        Metrics
      </Button>
      {groupings !== undefined && (
        <GroupingMenu
          groupings={groupings}
          nests={nests}
          view={view}
          onView={onView}
        />
      )}
      {/* Last of the buttons, so it moves none of them when it appears. */}
      <ViewsMenu
        saved={saved}
        columns={everyColumn}
        filterOnly={filterOnly}
        view={view}
        onView={onView}
        onClear={() => {
          onView(emptyView);
        }}
        laysOutColumns={laysOutColumns}
        {...(choices === undefined ? {} : { choices })}
        {...(pageParts === undefined ? {} : { pageParts })}
        pageFilter={pageFilter}
        {...(groupings === undefined ? {} : { groupings })}
      />
      {pageFilter !== undefined && (
        <FilterPill
          removeLabel={`Remove filter: ${pageFilter.words}`}
          onRemove={() => {
            onView(pageFilter.off(view));
          }}
        >
          {pageFilter.words}
        </FilterPill>
      )}
      {filters.map(({ column, filter }) => (
        <FilterPill
          key={column.key}
          removeLabel={`Remove filter on ${column.label}`}
          onRemove={() => {
            onView(withFilter(view, column.key, undefined));
          }}
        >
          {describeFilter(column, filter)}
        </FilterPill>
      ))}
      {/* Always there, so screen readers announce the count as it changes. */}
      <Text
        component="span"
        role="status"
        fz="sm"
        c="dimmed"
        className={classes.figures}
      >
        {narrowed
          ? `${count(shown)} of ${count(total)}`
          : (counted ?? `${count(total)} ${total === 1 ? one : noun}`)}
      </Text>
      {(narrowed || setsApart(view)) && (
        <Button
          size="compact-sm"
          variant="default"
          onClick={() => {
            // The metrics stay, counting every row.
            onView({ ...emptyView, breakdown: view.breakdown });
          }}
        >
          Clear all
        </Button>
      )}
    </Group>
  );
}

// The marks beside a column's name: which way it is
// sorted, its level when sorted by several, and whether it is filtered. Screen readers hear these
// from the header's name, as headerState gives it.
export function HeaderMarks({
  column,
  view,
}: {
  column: AnyColumn;
  view: View;
}) {
  const sort = view.sort.find((level) => level.key === column.key);
  return (
    <span className={classes.headerMarks} aria-hidden="true">
      {sort && (
        <>
          <Icon name={sort.descending ? "descending" : "ascending"} size={12} />
          {view.sort.length > 1 && <sup>{view.sort.indexOf(sort) + 1}</sup>}
        </>
      )}
      {isActive(view.filters[column.key]) && <Icon name="filter" size={12} />}
    </span>
  );
}

// The items of a column's menu that sort and filter it. Choosing a sort adds the column as the next
// level of the table's sort, or, when it is sorted already, changes its direction in place.
export function ColumnViewItems({
  column,
  view,
  onView,
  onFilter,
  breaksDown = false,
  units,
}: {
  column: AnyColumn;
  view: View;
  onView: ChangeView;
  // Opens the column's filter.
  onFilter: () => void;
  // Whether the metrics may break the rows down by the column.
  breaksDown?: boolean;
  // The units the column may be shown in, the first of which it starts in, and the decimal places
  // offered with those it starts with, if it offers several units.
  units?: ColumnUnits | undefined;
}) {
  const sorted = view.sort.some((level) => level.key === column.key);

  const filtered = isActive(view.filters[column.key]);
  const sortItem = (name: string, descending: boolean) => (
    <Menu.Item
      key={name}
      leftSection={<Icon name={descending ? "descending" : "ascending"} />}
      onClick={() => {
        onView(sortedBy(view, column.key, descending));
      }}
    >
      {name}
    </Menu.Item>
  );
  const [ascending, descending] = sortNames[column.kind];
  return (
    <>
      {sortItem(ascending, false)}
      {sortItem(descending, true)}
      {sorted && (
        <Menu.Item
          onClick={() => {
            onView(unsorted(view, column.key));
          }}
        >
          Clear sort
        </Menu.Item>
      )}
      <Menu.Divider />
      {column.filterable !== false && (
        <Menu.Item leftSection={<Icon name="filter" />} onClick={onFilter}>
          Filter…
        </Menu.Item>
      )}
      {filtered && (
        <Menu.Item
          onClick={() => {
            onView(withFilter(view, column.key, undefined));
          }}
        >
          Clear filter
        </Menu.Item>
      )}
      {breaksDown && (
        <Menu.Item
          leftSection={<Icon name="metrics" />}
          onClick={() => {
            onView({ ...view, breakdown: [column.key] });
            focusSoon(metricsTitleId);
          }}
        >
          Metrics
        </Menu.Item>
      )}
      {units !== undefined && (
        <>
          <MenuChoices
            label="Show in"
            choices={units.offered.map(({ key, label }) => ({
              value: key,
              label,
            }))}
            chosen={column.unit?.key}
            onChoose={(key) => {
              // A filter's numbers are in the unit it was set in, so it goes with the unit.
              onView(
                withFilter(
                  withUnit(
                    view,
                    column.key,
                    key === units.offered[0].key ? undefined : key,
                  ),
                  column.key,
                  undefined,
                ),
              );
            }}
          />
          <MenuChoices
            label="Decimal places"
            choices={units.places.offered.map((places) => ({
              value: String(places),
              label: String(places),
            }))}
            chosen={String(column.places)}
            onChoose={(chosen) => {
              const places = Number(chosen);
              onView(
                withPlaces(
                  view,
                  column.key,
                  places === units.places.starting ? undefined : places,
                ),
              );
            }}
          />
        </>
      )}
    </>
  );
}

// A filter across the whole table, opened from its button in the bar above it, which is marked
// while it filters, and which focus goes back to when it closes.
function BarFilterButton({
  button,
  column,
  view,
  onView,
}: {
  button: string;
  column: AnyColumn;
  view: View;
  onView: ChangeView;
}) {
  const [opened, setOpened] = useState(false);
  const target = useRef<HTMLButtonElement>(null);
  const marked = isActive(view.filters[column.key]);
  return (
    <FilterPopover
      column={column}
      view={view}
      onView={onView}
      opened={opened}
      onClose={() => {
        setOpened(false);
        target.current?.focus();
      }}
    >
      <Button
        ref={target}
        variant="default"
        leftSection={<Icon name="filter" />}
        aria-label={`${button}${marked ? ", filtered" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={opened}
        onClick={() => {
          setOpened((open) => !open);
        }}
      >
        {button}
        {marked && (
          <span aria-hidden="true" className={classes.changedMark}>
            •
          </span>
        )}
      </Button>
    </FilterPopover>
  );
}

// A column's filter, in a popover beside its header. Each change shows at once; the first while it
// is open adds to the address's history, and the rest replace it, so Back undoes the whole edit.
export function FilterPopover({
  column,
  view,
  onView,
  opened,
  onClose,
  children,
}: {
  column: AnyColumn;
  view: View;
  onView: ChangeView;
  opened: boolean;
  onClose: () => void;
  // What the popover sits beside.
  children: ReactNode;
}) {
  const changed = useRef(false);
  const titleId = useId();

  const filter = view.filters[column.key] ?? {};
  const change = (next: Filter) => {
    onView(withFilter(view, column.key, next), changed.current);
    changed.current = true;
  };
  return (
    <Popover
      opened={opened}
      onOpen={() => {
        changed.current = false;
      }}
      // Escape and clicks outside close it.
      onDismiss={onClose}
      position="bottom-start"
      withinPortal
      hideDetached={false}
      trapFocus
      // It closes at once, so the next column's menu can open straight after.
      transitionProps={{ duration: 0 }}
    >
      <Popover.Target>
        <div className={classes.filterTarget}>{children}</div>
      </Popover.Target>
      <Popover.Dropdown aria-labelledby={titleId} role="dialog">
        <VisuallyHidden id={titleId}>Filter {column.label}</VisuallyHidden>
        <FilterForm column={column} filter={filter} onChange={change} />
      </Popover.Dropdown>
    </Popover>
  );
}

function FilterForm({
  column,
  filter,
  onChange,
}: {
  column: AnyColumn;
  filter: Filter;
  onChange: (filter: Filter) => void;
}) {
  // Empty and Not empty together would show every row, so ticking one unticks the other.
  const emptyBox = (label: string, part: "empty" | "notEmpty") => (
    <Checkbox
      label={label}
      checked={(part === "empty" ? filter.empty : filter.notEmpty) === true}
      onChange={(event) => {
        onChange(
          withPart(
            withPart(
              filter,
              part === "empty" ? "notEmpty" : "empty",
              undefined,
            ),
            part,
            event.currentTarget.checked || undefined,
          ),
        );
      }}
    />
  );
  // A required column's value is never empty, so it offers neither Empty nor Not empty, nor does a
  // column whose blank means no.
  const empty = (label: string) =>
    column.required !== true &&
    column.blankMeansNo !== true && (
      <>
        {emptyBox(label, "empty")}
        {emptyBox(notEmptyLabels[column.kind], "notEmpty")}
      </>
    );
  const emptyLabel = column.emptyLabel ?? "Empty";
  switch (column.kind) {
    case "choice":
      return (
        <ChoiceFilter
          column={column}
          filter={filter}
          onChange={onChange}
          empty={empty(emptyLabel)}
        />
      );
    case "flag":
      return (
        <ChoiceFilter
          column={column}
          filter={filter}
          onChange={onChange}
          empty={emptyBox(emptyLabel, "empty")}
        />
      );
    case "date":
      return (
        <Stack gap="xs">
          <DayInput
            label="From"
            size="sm"
            required={false}
            value={filter.from}
            autoFocus
            onChange={(from) => {
              onChange(withPart(filter, "from", from));
            }}
          />
          <DayInput
            label="To"
            size="sm"
            required={false}
            value={filter.to}
            {...(filter.from !== undefined &&
            filter.to !== undefined &&
            filter.to < filter.from
              ? { problem: "Before From" }
              : {})}
            onChange={(to) => {
              onChange(withPart(filter, "to", to));
            }}
          />
          {empty("No date")}
        </Stack>
      );
    case "number":
      return (
        <Stack gap="xs">
          <NumberBound
            label="At least"
            initial={filter.atLeast}
            autoFocus
            onChange={(atLeast) => {
              onChange(withPart(filter, "atLeast", atLeast));
            }}
          />
          <NumberBound
            label="At most"
            initial={filter.atMost}
            {...(filter.atLeast !== undefined &&
            filter.atMost !== undefined &&
            filter.atMost < filter.atLeast
              ? { problem: "Lower than At least" }
              : {})}
            onChange={(atMost) => {
              onChange(withPart(filter, "atMost", atMost));
            }}
          />
          {empty("No number")}
        </Stack>
      );
    case "text":
    case "month":
    case "link":
    case "note":
      return (
        <Stack gap="xs">
          <TextInput
            label="Contains"
            size="sm"
            data-autofocus
            autoComplete="off"
            value={filter.contains ?? ""}
            onChange={(event) => {
              const contains = event.currentTarget.value;
              onChange(withPart(filter, "contains", contains || undefined));
            }}
          />
          {empty("Empty")}
        </Stack>
      );
  }
}

// A sign or point alone: a number part way through being typed, not yet wrong.
const unfinishedNumber = /^-?\.?$/;

// One end of a number filter, kept as typed, so a number part way through being typed stays.
function NumberBound({
  label,
  initial,
  problem,
  autoFocus = false,
  onChange,
}: {
  label: string;
  initial: number | undefined;
  problem?: string;
  autoFocus?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const [typed, setTyped] = useState(
    initial === undefined ? "" : String(initial),
  );
  const typedProblem = unfinishedNumber.test(typed.trim())
    ? undefined
    : numberProblem(typed);
  const change = (next: string) => {
    setTyped(next);
    onChange(typedNumber(next));
  };
  return (
    <ClearableInput
      label={label}
      size="sm"
      inputMode="decimal"
      autoComplete="off"
      {...(autoFocus ? { "data-autofocus": true } : {})}
      clearLabel={`Clear ${label}`}
      onClear={() => {
        change("");
      }}
      value={typed}
      error={
        typedProblem === undefined
          ? problem
          : `${typedProblem.charAt(0).toUpperCase()}${typedProblem.slice(1)}`
      }
      onChange={(event) => {
        change(event.currentTarget.value);
      }}
    />
  );
}

// The choices to show, offered ones first, then retired ones under their own heading.
function ChoiceFilter({
  column,
  filter,
  onChange,
  empty,
}: {
  column: AnyColumn;
  filter: Filter;
  onChange: (filter: Filter) => void;
  empty: ReactNode;
}) {
  const [narrow, setNarrow] = useState("");
  const retiredId = useId();
  const picked = filter.any ?? [];
  const shown = column.choices.filter((choice) =>
    folded(choice.label).includes(folded(narrow.trim())),
  );
  const toggle = (choiceId: string, on: boolean) => {
    const any = on
      ? column.choices
          .map((choice) => choice.id)
          .filter((other) => other === choiceId || picked.includes(other))
      : picked.filter((other) => other !== choiceId);
    onChange(withPart(filter, "any", any.length === 0 ? undefined : any));
  };
  const many = column.choices.length > narrowFrom;
  const offered = shown.filter((choice) => choice.retired !== true);
  const retired = shown.filter((choice) => choice.retired === true);
  const box = (choice: ColumnChoice, first: boolean) => (
    <Checkbox
      key={choice.id}
      label={choice.label}
      {...(!many && first ? { "data-autofocus": true } : {})}
      checked={picked.includes(choice.id)}
      onChange={(event) => {
        toggle(choice.id, event.currentTarget.checked);
      }}
    />
  );
  return (
    <Stack gap="xs" className={classes.choiceFilter}>
      {many && (
        <TextInput
          aria-label={`Narrow ${column.label} choices`}
          size="sm"
          data-autofocus
          autoComplete="off"
          leftSection={<Icon name="search" />}
          value={narrow}
          rightSection={
            narrow !== "" && (
              <CloseButton
                size="sm"
                aria-label="Clear"
                onClick={() => {
                  setNarrow("");
                }}
              />
            )
          }
          onChange={(event) => {
            setNarrow(event.currentTarget.value);
          }}
        />
      )}
      <ScrollArea.Autosize mah={280} type="auto">
        <Stack gap={6}>
          {offered.map((choice, index) => box(choice, index === 0))}
          {empty}
          {retired.length > 0 && (
            <Stack gap={6} role="group" aria-labelledby={retiredId}>
              <Text id={retiredId} fz="xs" fw={600} c="dimmed" mt={4}>
                {column.retiredLabel ?? "Retired"}
              </Text>
              {retired.map((choice) => box(choice, false))}
            </Stack>
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
