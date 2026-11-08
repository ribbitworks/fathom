// SPDX-License-Identifier: Apache-2.0

// A record's details in a side panel, on any page: a value in its row under its label, changed in
// place for those who may, with a draft's live value under it, and a link to another record that
// shows it instead.

import type { Link as WebLink } from "@fathom/shared";
import { ActionIcon, Anchor, Group, Text } from "@mantine/core";
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
import type { Column } from "./record-grid.tsx";
import { type DraftLike, DraftMark, StatusMark } from "./status-mark.tsx";
import type { CellValue } from "./table-view.ts";

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

export function RecordLink({
  name,
  onShow,
}: {
  name: string;
  onShow: () => void;
}) {
  return (
    <Anchor component="button" type="button" ta="start" onClick={onShow}>
      {name}
    </Anchor>
  );
}

export function Row({
  column,
  value,
  changed,
  editing,
  children,
}: {
  column: DetailColumn;
  value: CellValue;
  // Beside live, what a draft changes here: the live value, and the draft to mark it with, if any.
  changed?: { live: CellValue; draft?: DraftLike } | undefined;
  editing?: Editing | undefined;
  children?: ReactNode;
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
              {draft !== undefined && <DraftMark draft={draft} />}
            </Group>
            {start !== undefined && (
              <ActionIcon
                id={changeId(column)}
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={`Change ${column.label}`}
                onClick={start}
              >
                <Icon name="edit" />
              </ActionIcon>
            )}
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
