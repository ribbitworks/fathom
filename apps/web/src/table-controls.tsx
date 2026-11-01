// SPDX-License-Identifier: Apache-2.0

// The controls that change what a table shows, for any table and any kind of column: the search
// field, which Cmd+F or Ctrl+F focuses and Esc clears; each column's sort and filter, chosen from
// its menu, each sort added as the next level; each column's filter, edited in a popover beside its
// header; the bar naming each level of the sort and each filter, which removes them one at a time
// or all at once; and the menu of the table's saved views, which applies, saves, renames, updates,
// and deletes them. What they change is the table's view, as table-view.ts sets out.

import {
  Button,
  Checkbox,
  CloseButton,
  Group,
  Menu,
  Pill,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  VisuallyHidden,
} from "@mantine/core";
import type { SavedView } from "@fathom/shared";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons.tsx";
import {
  type ColumnChoice,
  type Filter,
  folded,
  formatDay,
  isActive,
  isDay,
  type Kind,
  emptyView,
  knownView,
  narrows,
  sameView,
  type TableColumn,
  type View,
  viewFrom,
} from "./table-view.ts";
import classes from "./pages.module.css";

// Changes the view, replacing the current address rather than adding to its history when asked.
export type ChangeView = (view: View, replace?: boolean) => void;

// A column as the controls need it, whatever its rows.
type AnyColumn = Pick<
  TableColumn<never>,
  "key" | "label" | "kind" | "choices" | "multiple"
>;

// Each kind's sorts, ascending then descending.
const sortNames: Record<Kind, [string, string]> = {
  text: ["Sort A to Z", "Sort Z to A"],
  date: ["Oldest first", "Newest first"],
  choice: ["List order", "Reverse list order"],
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

// A filter in words, such as "Site: Harbour, Northmere".
export function describeFilter(column: AnyColumn, filter: Filter): string {
  const parts: string[] = [];
  switch (column.kind) {
    case "choice":
      parts.push(
        ...column.choices
          .filter((choice) => (filter.any ?? []).includes(choice.id))
          .map((choice) => choice.label),
      );
      if (filter.empty) parts.push("Empty");
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
    case "text": {
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
// except a dialog; Esc clears it, or, once it is empty, goes back to the table. The first change
// after it is focused adds to the address's history, and the rest replace it, so Back undoes a
// whole search.
export function TableSearch({
  label,
  value,
  onChange,
  onLeave,
}: {
  label: string;
  value: string;
  onChange: (text: string, replace: boolean) => void;
  onLeave: () => void;
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

  const change = (next: string) => {
    setText(next);
    setPending((sent) => [...sent, next]);
    onChange(next, changed);
    setChanged(true);
  };

  return (
    <TextInput
      ref={input}
      className={classes.tableSearch}
      aria-label={label}
      placeholder="Search"
      leftSection={<Icon name="search" />}
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
          onLeave();
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
// view has changed since. Choosing a view applies it. The menu clears the view, saves it as a new
// one, and updates, renames, or deletes the one applied when the user may change it.
export function ViewsMenu({
  saved: { views, applied, onApply, onName, onUpdate, onDelete },
  columns,
  view,
  onClear,
}: {
  saved: SavedViews;
  columns: readonly AnyColumn[];
  view: View;
  // Clears the view, leaving the saved view it started from.
  onClear: () => void;
}) {
  // Each saved view as the table can show it, without columns deleted since.
  const shownAs = (saved: SavedView) =>
    knownView(viewFrom(saved.definition), columns);
  const current = views.find((saved) => saved.id === applied);
  const changed = current !== undefined && !sameView(shownAs(current), view);
  const empty = sameView(view, emptyView);
  if (views.length === 0 && empty) return null;
  return (
    <Menu position="bottom-start" hideDetached={false}>
      <Menu.Target>
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
      </Menu.Target>
      <Menu.Dropdown>
        {[...views].sort(byName).map((saved) => (
          <Menu.Item
            key={saved.id}
            leftSection={
              <span className={classes.appliedMark} aria-hidden>
                {saved.id === applied ? "✓" : ""}
              </span>
            }
            onClick={() => {
              onApply(shownAs(saved), saved.id);
            }}
          >
            {saved.name}
            {saved.id === applied && <VisuallyHidden>, applied</VisuallyHidden>}
          </Menu.Item>
        ))}
        {!empty && <Menu.Divider />}
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
      </Menu.Dropdown>
    </Menu>
  );
}

// The bar above a table: its search, its saved views, a pill for each level of the sort and each filter, how many rows there are, or how many
// are shown while some are hidden, and Clear all.
export function ViewBar({
  one,
  noun,
  columns,
  view,
  onView,
  shown,
  total,
  onLeave,
  saved,
}: {
  // What the rows are, one and several, such as "person" and "people".
  one: string;
  noun: string;
  columns: readonly AnyColumn[];
  view: View;
  onView: ChangeView;
  shown: number;
  total: number;
  // Goes back to the table from the search field.
  onLeave: () => void;
  saved?: SavedViews | undefined;
}) {
  // Each level of the sort, in order, with its column; a column the table does not have is left out.
  const sorts = view.sort.flatMap(({ key, descending }) =>
    columns
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
          columns={columns}
          view={view}
          onClear={() => {
            onView(emptyView);
          }}
        />
      )}
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
      {/* Always there, so screen readers announce the count as it changes. */}
      <Text
        component="span"
        role="status"
        fz="sm"
        c="dimmed"
        className={classes.figures}
      >
        {narrows(view)
          ? `${String(shown)} of ${String(total)}`
          : `${String(total)} ${total === 1 ? one : noun}`}
      </Text>
      {(narrows(view) || view.sort.length > 0) && (
        <Button
          size="compact-sm"
          variant="subtle"
          onClick={() => {
            onView(emptyView);
          }}
        >
          Clear all
        </Button>
      )}
    </Group>
  );
}

// The marks beside a column's name: which way it is sorted, its level when sorted by several, and
// whether it is filtered. Screen readers hear these from the header's name, as headerState gives it.
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
}: {
  column: AnyColumn;
  view: View;
  onView: ChangeView;
  // Opens the column's filter.
  onFilter: () => void;
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
      return (
        <ChoiceFilter
          column={column}
          filter={filter}
          onChange={onChange}
          empty={empty("Empty")}
        />
      );
    case "date":
      return (
        <Stack gap="xs">
          <DayInput
            label="From"
            value={filter.from}
            autoFocus
            onChange={(from) => {
              onChange(withPart(filter, "from", from));
            }}
          />
          <DayInput
            label="To"
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

// A date typed as YYYY-MM-DD, which filters once it is a whole date; until then, the column is not
// filtered by it.
function DayInput({
  label,
  value,
  autoFocus = false,
  problem,
  onChange,
}: {
  label: string;
  value: string | undefined;
  autoFocus?: boolean;
  // What is wrong with the date beside the others, if anything.
  problem?: string;
  onChange: (day: string | undefined) => void;
}) {
  const [text, setText] = useState(value ?? "");
  const whole = text === "" || isDay(text);
  return (
    <TextInput
      label={label}
      size="sm"
      autoComplete="off"
      {...(autoFocus ? { "data-autofocus": true } : {})}
      value={text}
      error={whole ? problem : "Use a date such as 2026-10-31"}
      onChange={(event) => {
        const next = event.currentTarget.value.trim();
        setText(next);
        onChange(isDay(next) ? next : undefined);
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
                Retired
              </Text>
              {retired.map((choice) => box(choice, false))}
            </Stack>
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
