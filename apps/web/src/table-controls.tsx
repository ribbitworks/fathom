// SPDX-License-Identifier: Apache-2.0

// The controls that change what a table shows, for any table and any kind of column: the search
// field, which Cmd+F or Ctrl+F focuses and Esc clears; each column's sort and filter, chosen from
// its menu, each sort added as the next level; each column's filter, edited in a popover beside its
// header; the bar naming each level of the sort and each filter, which removes them one at a time
// or all at once; the menu of the table's saved views, which applies, saves, renames, updates, and
// deletes them; and the Metrics button, and each column's Break down by, which open the Metrics
// panel. What they change is the table's view, as table-view.ts sets out.

import {
  Button,
  Checkbox,
  CloseButton,
  Group,
  Input,
  Menu,
  Pill,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  VisuallyHidden,
} from "@mantine/core";
import type { SavedView, Show } from "@fathom/shared";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { DayInput } from "./day-input.tsx";
import { drafts as draftCount } from "./decision-dialog.tsx";
import { Icon } from "./icons.tsx";
import { metricsButtonId, metricsPanelId, metricsTitleId } from "./metrics.ts";
import { focusSoon } from "./focus.ts";
import {
  type ColumnChoice,
  type Filter,
  folded,
  formatDay,
  isActive,
  type Kind,
  emptyView,
  knownView,
  narrows,
  sameView,
  type TableColumn,
  type View,
  viewFrom,
} from "./table-view.ts";
import { AppMenu } from "./app-menu.tsx";
import classes from "./pages.module.css";
import { count } from "./numbers.ts";

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
>;

// Each kind's sorts, ascending then descending.
const sortNames: Record<Kind, [string, string]> = {
  text: ["Sort A to Z", "Sort Z to A"],
  date: ["Oldest first", "Newest first"],
  choice: ["List order", "Reverse list order"],
  link: ["Sort A to Z", "Sort Z to A"],
  note: ["Sort A to Z", "Sort Z to A"],
  flag: ["Checked first", "Unchecked first"],
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
  const filters = Object.fromEntries(
    Object.entries(view.filters).filter(([other]) => other !== key),
  );
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
  const show = showOptions.filter(
    (option) => option.value === view.show && option.value !== "both",
  );
  const breakdown = (view.breakdown ?? []).flatMap(labelOf);
  return [
    ...(view.search.trim() === ""
      ? []
      : [{ name: "Search", value: `“${view.search.trim()}”` }]),
    ...filters.map((value) => ({ name: "Filter", value })),
    ...(sort.length === 0 ? [] : [{ name: "Sort", value: sort.join(", ") }]),
    ...show.map(({ label }) => ({ name: "Draft", value: label })),
    ...(breakdown.length === 0
      ? []
      : [{ name: "Metrics", value: breakdown.join(" by ") }]),
    ...(view.frozen === undefined
      ? []
      : [
          {
            name: "Frozen",
            value: frozenUpTo(view.frozen, columns, "Up to", "None"),
          },
        ]),
  ];
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
export function describeFilter(column: AnyColumn, filter: Filter): string {
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
        parts.push(`${formatDay(from)} to ${formatDay(to)}`);
      } else if (from !== undefined) {
        parts.push(`from ${formatDay(from)}`);
      } else if (to !== undefined) {
        parts.push(`until ${formatDay(to)}`);
      }
      if (filter.empty) parts.push("no date");
      return `${column.label}: ${parts.join(" or ")}`;
    }
    case "text":
    case "link":
    case "note": {
      const contains = (filter.contains ?? "").trim();
      if (contains !== "") parts.push(`contains “${contains}”`);
      if (filter.empty) parts.push("empty");
      return `${column.label} ${parts.join(" or ")}`;
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
  return parts.map((part) => `, ${part}`).join("");
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
  applied: string | undefined;
  onApply: (view: View, id: string) => void;
  // Opens the dialog naming a saved view: a new one for the table's view, or one to rename.
  onName: (saved: SavedView | undefined, view: View) => void;
  onUpdate: (saved: SavedView, view: View) => void;
  onDelete: (saved: SavedView) => void;
}

const byName = (first: SavedView, second: SavedView) =>
  first.name.localeCompare(second.name, undefined, { sensitivity: "base" });

// The menu of a table's saved views, named after the one the view started from, marked when the
// view has changed since, or, with none applied, from the table's default view. Choosing a view
// applies it. The menu clears the view, saves it as a new one, and updates, renames, or deletes the
// one applied when the user may change it.
export function ViewsMenu({
  saved: { views, applied, onApply, onName, onUpdate, onDelete },
  columns,
  filterOnly = [],
  view,
  onClear,
}: {
  saved: SavedViews;
  columns: readonly AnyColumn[];
  filterOnly?: readonly AnyColumn[];
  view: View;
  // Clears the view, leaving the saved view it started from.
  onClear: () => void;
}) {
  // Each saved view as the table can show it, without columns deleted since.
  const shownAs = (saved: SavedView) =>
    knownView(viewFrom(saved.definition), columns, filterOnly);
  const current = views.find((saved) => saved.id === applied);
  const empty = sameView(view, emptyView);
  const changed = current ? !sameView(shownAs(current), view) : !empty;
  if (views.length === 0 && empty) return null;
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
        {[...views].sort(byName).map((saved) => (
          <Menu.Item
            key={saved.id}
            // Room for the applied view's check mark only while one is applied, so the names line
            // up.
            leftSection={
              current && (
                <span className={classes.appliedMark} aria-hidden>
                  {saved.id === applied ? "✓" : ""}
                </span>
              )
            }
            onClick={() => {
              onApply(shownAs(saved), saved.id);
            }}
          >
            {saved.name}
            {saved.id === applied && <VisuallyHidden>, applied</VisuallyHidden>}
          </Menu.Item>
        ))}
        {!empty && views.length > 0 && <Menu.Divider />}
        {!empty && <Menu.Item onClick={onClear}>Clear view</Menu.Item>}
        {!empty && (
          <Menu.Item
            onClick={() => {
              onName(undefined, view);
            }}
          >
            Save view…
          </Menu.Item>
        )}
        {current?.canChange && (
          <>
            {changed && (
              <Menu.Item
                onClick={() => {
                  onUpdate(current, view);
                }}
              >
                Update {current.name}
              </Menu.Item>
            )}
            <Menu.Item
              onClick={() => {
                onName(current, view);
              }}
            >
              Rename…
            </Menu.Item>
            <Menu.Item
              color="red"
              onClick={() => {
                onDelete(current);
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

// The bar above a table: its search, its saved views, a button for each filter the table's headers
// do not offer, a pill for each level of the sort and each filter, how many rows there are, or how
// many are shown while some are hidden, and Clear all.
const showOptions: { value: Show; label: string }[] = [
  { value: "both", label: "Drafts beside live" },
  { value: "drafts", label: "Drafts applied" },
  { value: "live", label: "Live only" },
];

const check = (on: boolean) => (
  <span className={classes.appliedMark} aria-hidden>
    {on ? "✓" : ""}
  </span>
);

// The Draft button of a table with drafts: a menu choosing which version of each record shows, the
// draft beside the live record, the draft applied, as everything will be once approved, or the
// live record alone, as everything is now, which is read only; and, where the table filters by
// draft, which rows show, which the live records alone have no drafts for. Marked while either is
// not the default.
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
    show !== "both" ||
    (filter !== undefined && isActive(filter.view.filters[filter.column.key]));
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
          aria-label={`Draft${marked ? ", changed" : ""}`}
        >
          Draft
          {marked && (
            <span aria-hidden="true" className={classes.changedMark}>
              •
            </span>
          )}
        </Button>
      </AppMenu.Target>
      <AppMenu.Dropdown>
        <Menu.Label>Show</Menu.Label>
        {showOptions.map((option) => (
          <Menu.Item
            key={option.value}
            leftSection={check(option.value === show)}
            onClick={() => {
              onShow(option.value);
            }}
          >
            {option.label}
            {option.value === show && <VisuallyHidden>, on</VisuallyHidden>}
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
  // The drafts waiting among those shown, which these decide, and all those waiting, so the menu
  // says when a search, filter or Drafts applied hides some.
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

export function ViewBar({
  one,
  noun,
  columns: shownColumns,
  draftFilter,
  view,
  onView,
  shown,
  total,
  counted,
  onLeave,
  saved,
  draftItems,
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
  counted?: string | undefined;
  // Goes back to the table from the search field.
  onLeave: () => void;
  saved?: SavedViews | undefined;
  // Added to the Draft menu, after what to show and the filter.
  draftItems?: ReactNode;
}) {
  const filterOnly = [draftFilter];
  const columns = [...shownColumns, ...filterOnly];
  // Each level of the sort, in order, with its column; a column the table does not have is left
  // out.
  const sorts = view.sort.flatMap(({ key, descending }) =>
    shownColumns
      .filter((column) => column.key === key)
      .map((column) => ({ column, descending })),
  );
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
      {/* After the search, so it never moves the field being typed in when it appears. */}
      {saved && (
        <ViewsMenu
          saved={saved}
          columns={shownColumns}
          filterOnly={filterOnly}
          view={view}
          onClear={() => {
            onView(emptyView);
          }}
        />
      )}
      <DraftMenu
        show={view.show}
        onShow={(show) => {
          onView({ ...view, show });
        }}
        filter={{ column: draftFilter, view, onView }}
      >
        {draftItems}
      </DraftMenu>
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
      {sorts.map(({ column, descending }) => (
        <Pill
          key={`sort-${column.key}`}
          size="md"
          withRemoveButton
          removeButtonProps={{
            "aria-hidden": false,
            tabIndex: 0,
            "aria-label": `Remove sort on ${column.label}`,
          }}
          onRemove={() => {
            onView(unsorted(view, column.key));
          }}
        >
          {column.label} {descending ? "↓" : "↑"}
        </Pill>
      ))}
      {filters.map(({ column, filter }) => (
        <Pill
          key={column.key}
          size="md"
          withRemoveButton
          removeButtonProps={{
            // Mantine hides the button from the keyboard, but filters are removed from it too.
            "aria-hidden": false,
            tabIndex: 0,
            "aria-label": `Remove filter on ${column.label}`,
          }}
          onRemove={() => {
            onView(withFilter(view, column.key, undefined));
          }}
        >
          {describeFilter(column, filter)}
        </Pill>
      ))}
      {view.frozen !== undefined && (
        <Pill
          size="md"
          withRemoveButton
          removeButtonProps={{
            "aria-hidden": false,
            tabIndex: 0,
            "aria-label": "Reset frozen columns",
          }}
          onRemove={() => {
            onView({ ...view, frozen: undefined });
          }}
        >
          {frozenUpTo(view.frozen, shownColumns, "Frozen to", "Unfrozen")}
        </Pill>
      )}
      {/* Always there, so screen readers announce the count as it changes. */}
      <Text
        component="span"
        role="status"
        fz="sm"
        c="dimmed"
        className={classes.figures}
      >
        {narrows(view)
          ? `${count(shown)} of ${count(total)}`
          : (counted ?? `${count(total)} ${total === 1 ? one : noun}`)}
      </Text>
      {(narrows(view) || view.sort.length > 0 || view.frozen !== undefined) && (
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

// A filter the table's headers do not offer, opened from its button in the bar above the table,
// which focus goes back to when it closes. The marks beside a column's name: which way it is
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
}: {
  column: AnyColumn;
  view: View;
  onView: ChangeView;
  // Opens the column's filter.
  onFilter: () => void;
  // Whether the metrics may break the rows down by the column.
  breaksDown?: boolean;
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
      <Menu.Item leftSection={<Icon name="filter" />} onClick={onFilter}>
        Filter…
      </Menu.Item>
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
          Break down by
        </Menu.Item>
      )}
    </>
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
      shadow="md"
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
  const empty = (label: string) => (
    <Checkbox
      label={label}
      checked={filter.empty === true}
      onChange={(event) => {
        onChange(
          withPart(filter, "empty", event.currentTarget.checked || undefined),
        );
      }}
    />
  );
  switch (column.kind) {
    case "choice":
    case "flag":
      return (
        <ChoiceFilter
          column={column}
          filter={filter}
          onChange={onChange}
          empty={empty(column.emptyLabel ?? "Empty")}
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
    case "text":
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
