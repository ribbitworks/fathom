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
import { type DraftLike, DraftMark, StatusMark } from "./status-mark.tsx";
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

function Value({ column, value }: { column: DetailColumn; value: unknown }) {
  const kind = cellKinds[column.kind];
  if (column.kind === "note") {
    return value === "" ? (
      <Text c="dimmed">None</Text>
    ) : (
      <NoteView note={value as string} />
    );
  }
  if (column.kind === "link") {
    return value === null ? (
      <Text c="dimmed">None</Text>
    ) : (
      <LinkCell link={value as WebLink} inTable={false} />
    );
  }
  const words = kind.inWords(
    column,
    value as Parameters<typeof kind.inWords>[1],
  );
  return words === "" ? (
    <Text c="dimmed">{column.emptyLabel ?? "None"}</Text>
  ) : (
    <Text>{words}</Text>
  );
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
// menu, that changes its value.
export const changeButton = (label: string) =>
  ({
    variant: "subtle",
    color: "gray",
    size: "sm",
    "aria-label": `Change ${label}`,
    children: <Icon name="edit" />,
  }) as const;

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
  // Beside live, what a draft changes here: the live value, the draft to mark it with, if any, and
  // the day or month the change takes effect from, where that needs saying.
  changed?:
    | { live: CellValue; draft?: DraftLike; from?: string | undefined }
    | undefined;
  editing?: Editing | undefined;
  children?: ReactNode;
  // A control of its own at the row's right, in place of the change button, such as a menu.
  action?: ReactNode;
}) {
  const draft = changed?.draft;
  const start = editing?.open === true ? undefined : editing?.onStart;
  // A click on the value, but not on a link in it, opens its editor, as the button beside it does.
  const onClick =
    start === undefined
      ? undefined
      : (event: MouseEvent) => {
          if ((event.target as HTMLElement).closest("a, button") === null) {
            start();
          }
        };
  const checkbox = editing !== undefined && editing.onStart === undefined;
  return (
    <div
      className={classes.row}
      data-field={editing?.open === true || undefined}
    >
      <dt id={labelId(column)} className={classes.label}>
        {column.label}
      </dt>
      <dd
        className={[
          classes.value,
          onClick === undefined ? "" : classes.editable,
        ].join(" ")}
        onClick={onClick}
      >
        {editing?.open === true ? (
          editing.editor
        ) : (
          <Group
            gap={6}
            wrap="nowrap"
            justify="space-between"
            align="flex-start"
          >
            <Group gap={6} wrap="nowrap" align="baseline">
              {checkbox
                ? editing.editor
                : (children ?? <Value column={column} value={value} />)}
              {draft !== undefined && (
                <DraftMark draft={draft} from={changed?.from} />
              )}
            </Group>
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
        {editing?.problem !== undefined && (
          <Text id={problemId(column)} c="red" size="sm" mt={4}>
            {editing.problem}
          </Text>
        )}
        {changed !== undefined && (
          <Group
            gap={6}
            wrap="nowrap"
            align="baseline"
            className={classes.live}
          >
            <Value column={column} value={changed.live} />
            <StatusMark tone="live">Live</StatusMark>
          </Group>
        )}
      </dd>
    </div>
  );
}
