// SPDX-License-Identifier: Apache-2.0

// A record's details in a side panel, on any page: a value in its row under its label, changed in
// place for those who may, with a draft's live value under it, and a link to another record that
// shows it instead.

import type { Link as WebLink } from "@fathom/shared";
import { ActionIcon, Anchor, Group, Stack, Text } from "@mantine/core";
import type { MouseEvent, ReactNode } from "react";
import { cellKinds } from "./cell-kinds.tsx";
import { Icon } from "./icons.tsx";
import { LinkCell } from "./link-field.tsx";
import { NoteView } from "./note-editor.tsx";
import {
  changeId,
  type Editing,
  labelId,
  problemId,
} from "./record-editing.tsx";
import classes from "./record-details.module.css";
import { roundedUpTo } from "@fathom/shared";
import { type Column, shownInView } from "./record-grid.tsx";
import {
  DraftedItem,
  type DraftLike,
  emptiedWords,
  MarkedItem,
  MarkRow,
  useBesideLive,
  wasWords,
} from "./status-mark.tsx";
import {
  type CellValue,
  type ColumnUnit,
  unitAmountWords,
  type View,
} from "./table-view.ts";

type DetailColumn = Pick<
  Column<never>,
  "key" | "label" | "kind" | "multiple" | "choices" | "required" | "emptyLabel"
>;

// A value as it was before a draft changed it, for its draft's tip; none for a note or a link,
// whose words a tip cannot hold.
function liveWords(column: DetailColumn, value: unknown): string | undefined {
  if (column.kind === "note" || column.kind === "link") return undefined;
  const kind = cellKinds[column.kind];
  return wasWords(
    kind.inWords(column, value as Parameters<typeof kind.inWords>[1]),
    column.label,
    column.emptyLabel,
  );
}

// A value, or, when empty, None or the column's own word for it, dimmed; where a draft empties the
// value, or fills it, the words for none in grey italics, as a table's cell shows them.
function Value({
  column,
  value,
  drafted = false,
}: {
  column: DetailColumn;
  value: unknown;
  drafted?: boolean;
}) {
  const kind = cellKinds[column.kind];
  const none = drafted ? (
    <Text c="dimmed" fs="italic">
      {emptiedWords(column.label, column.emptyLabel)}
    </Text>
  ) : (
    <Text c="dimmed">{column.emptyLabel ?? "None"}</Text>
  );
  if (column.kind === "note") {
    return value === "" ? none : <NoteView note={value as string} />;
  }
  if (column.kind === "link") {
    return value === null ? (
      none
    ) : (
      <LinkCell link={value as WebLink} inTable={false} />
    );
  }
  const words = kind.inWords(
    column,
    value as Parameters<typeof kind.inWords>[1],
  );
  return words === "" ? none : <Text>{words}</Text>;
}

// A value with a unit in words, the unit spelled out, as a panel has room to, such as 1 person-week,
// one or several as the amount is shown, rounded up to the column's places, if any.
function spelledOut(
  column: DetailColumn & Pick<Column<never>, "places">,
  unit: ColumnUnit,
  value: string,
): string {
  const shown = cellKinds[column.kind].inWords(
    { ...column, unit: undefined },
    value,
  );
  const amount =
    column.places === undefined
      ? Number(value)
      : roundedUpTo(Number(value), column.places);
  return unitAmountWords(shown, amount, unit);
}

// For a column that offers units, a record's value as its row shows it, with the units spelled out:
// in the unit the table shows, when that is another and the value is more than 0, followed by the
// value in the column's first unit, as kept, such as 2.5 person-days (20 hours).
export function inUnitsWords(
  column: Column<never>,
  view: Pick<View, "units" | "places">,
  record: object,
): string | undefined {
  const { units } = column;
  if (units === undefined) return undefined;
  const value = column.value(record as never) as string;
  if (value === "") return undefined;
  const kept = spelledOut(column, units.offered[0], value);
  const shown = shownInView(column, units, view);
  const shownValue = shown.column.value(record as never) as string;
  return shown.unit.key === units.offered[0].key || Number(shownValue) <= 0
    ? kept
    : `${spelledOut(shown.column, shown.unit, shownValue)} (${kept})`;
}

// A headed list of a record's rows.
export function RecordSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h3 className={classes.heading} id={id}>
        {title}
      </h3>
      <dl className={classes.list}>{children}</dl>
    </section>
  );
}

export function RecordLink({
  name,
  onShow,
}: {
  name: ReactNode;
  onShow: () => void;
}) {
  return (
    <Anchor component="button" type="button" ta="start" onClick={onShow}>
      {name}
    </Anchor>
  );
}

// Links to records, one to a line, as a details panel lists several records.
export function RecordLinkList({
  links,
}: {
  links: readonly { id: string; name: ReactNode; onShow: () => void }[];
}) {
  return (
    <Stack gap={0} align="flex-start">
      {links.map(({ id, name, onShow }) => (
        <span key={id}>
          <RecordLink name={name} onShow={onShow} />
        </span>
      ))}
    </Stack>
  );
}

// What a row's change button is, named Change and the row's label, for a row's own control, such as a
// menu, that changes its value. It shows while its row is pointed at or has focus.
export const changeButton = (label: string) =>
  ({
    variant: "subtle",
    color: "gray",
    size: "sm",
    className: classes.change,
    "aria-label": `Change ${label}`,
    children: <Icon name="edit" />,
  }) as const;

// A row's click handler that opens its editor from a click anywhere on it, but not on a link or a
// control in it, as the button beside it does; a click in its own menu, drawn elsewhere, still
// reaches it, and is left. None for a row with no editor to open.
export const opensOnClick = (start: (() => void) | undefined) =>
  start === undefined
    ? undefined
    : (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (
          event.currentTarget.contains(target) &&
          target.closest("a, button") === null
        ) {
          start();
        }
      };

export function Row({
  column,
  value,
  changed,
  editing,
  children,
  action,
}: {
  column: DetailColumn;
  value: CellValue;
  // What a draft changes here, whatever the Draft view, which decides how it shows: the live value,
  // shown under the drafted one beside live where given, the draft to mark it with, if any, and the
  // day or month the change takes effect from, where that needs saying.
  changed?:
    | {
        live?: CellValue;
        draft?: DraftLike;
        from?: string | undefined;
        // A warning about the live value, such as a manager who has left.
        warning?: { words: string; spoken?: string } | undefined;
      }
    | undefined;
  editing?: Editing | undefined;
  children?: ReactNode;
  // A control of its own at the row's right, after the change button if there is one, such as a menu.
  action?: ReactNode;
}) {
  const draft = changed?.draft;
  const liveUnder =
    useBesideLive() && changed?.live !== undefined
      ? { ...changed, live: changed.live }
      : undefined;
  const start = editing?.open === true ? undefined : editing?.onStart;
  const onClick = opensOnClick(start);
  const checkbox = editing !== undefined && editing.onStart === undefined;
  return (
    <div
      className={[
        classes.row,
        onClick === undefined ? "" : classes.editable,
      ].join(" ")}
      data-field={editing?.open === true || undefined}
      onClick={onClick}
    >
      <dt id={labelId(column)} className={classes.label}>
        {column.label}
      </dt>
      <dd className={classes.value}>
        {editing?.open === true ? (
          editing.editor
        ) : (
          <Group
            gap={6}
            wrap="nowrap"
            justify="space-between"
            align="flex-start"
          >
            <MarkRow>
              <DraftedItem
                draft={draft}
                from={changed?.from}
                was={
                  changed?.live === undefined
                    ? undefined
                    : liveWords(column, changed.live)
                }
              >
                {checkbox
                  ? editing.editor
                  : (children ?? (
                      <Value
                        column={column}
                        value={value}
                        drafted={draft !== undefined}
                      />
                    ))}
              </DraftedItem>
            </MarkRow>
            {(start !== undefined || Boolean(action)) && (
              <Group gap={4} wrap="nowrap">
                {start !== undefined && (
                  <ActionIcon
                    id={changeId(column)}
                    {...changeButton(column.label)}
                    onClick={start}
                  />
                )}
                {action}
              </Group>
            )}
          </Group>
        )}
        {editing?.problem !== undefined && (
          <Text id={problemId(column)} c="red" size="sm" mt={4}>
            {editing.problem}
          </Text>
        )}
        {liveUnder !== undefined && (
          <MarkRow className={classes.live}>
            <MarkedItem tone="live">
              <MarkedItem
                tone={liveUnder.warning === undefined ? undefined : "warning"}
                words={liveUnder.warning?.words}
                spoken={liveUnder.warning?.spoken}
              >
                <Value column={column} value={liveUnder.live} drafted />
              </MarkedItem>
            </MarkedItem>
          </MarkRow>
        )}
      </dd>
    </div>
  );
}
