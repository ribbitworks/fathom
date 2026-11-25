// SPDX-License-Identifier: Apache-2.0

// Adding a record in the panel beside its table, driven by the table's columns: the columns a new
// record has and their starting values, the panel's frame with Add and Cancel at its foot, and the
// checks Add makes, as adding a new row does. Each page draws its fields inside it, as rows in
// sections, and names the problems Add finds. The page holds what has been entered, so it can ask
// before discarding it.

import { Button, Group } from "@mantine/core";
import { type MouseEvent, type ReactNode, useEffect, useRef } from "react";
import type { Refusal } from "./api.ts";
import { cellKinds } from "./cell-kinds.tsx";
import { DetailSections } from "./record-details.tsx";
import { firstTypedInto, useFocusOnOpen } from "./record-editing.tsx";
import { columnsOn, onRow, readOnlyFor } from "./grid-columns.tsx";
import { newRecordProblems } from "./grid-saving.ts";
import type { Column, GridRecord, RecordTable } from "./record-table.ts";
import { NewFormEnter, useAfterUpdate } from "./new-form-enter.ts";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import type { CellValue } from "./table-view.ts";

export type FormValues = Readonly<Record<string, CellValue>>;

const titleId = "new-record-title";

// What the record being added is known by, until it is added and has an ID of its own.
export const newRecordId = "new-record";

// Whether anything has been entered, so discarding it asks first: a value the form didn't start
// with, such as a project a link set, which the person never chose.
export const entered = ({
  values,
  starting = {},
}: {
  values: FormValues;
  starting?: FormValues | undefined;
}) => {
  const startedWith = new Map(Object.entries(starting));
  return Object.entries(values).some(
    ([key, value]) =>
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0) &&
      JSON.stringify(value) !== JSON.stringify(startedWith.get(key)),
  );
};

// The columns a new record of a kind is given values in, and each one's value so far.
export function newRecordFields<Rec extends GridRecord, Change>(
  all: readonly Column<Rec, Change>[],
  kind: string,
  given: FormValues,
) {
  // A new record's values follow from nothing else, so it has no columns that only show them.
  const columns = columnsOn(all, kind)
    .filter((column) => !readOnlyFor(column, kind))
    .map((column) => onRow<Rec, Column<Rec, Change>>(column, undefined, kind));
  const valueOf = (column: Column<Rec, Change>): CellValue =>
    given[column.key] ??
    column.newRowValue?.(kind) ??
    cellKinds[column.kind].empty;
  const values: Record<string, CellValue> = Object.fromEntries(
    columns.map((column) => [column.key, valueOf(column)]),
  );
  return { columns, valueOf, values };
}

export function NewRecordPanel<Rec extends GridRecord, Change, Request>({
  panelId,
  title,
  narrow,
  saving,
  table,
  columns,
  shown,
  kind,
  values,
  others,
  unfinished,
  withRefused,
  onRefused,
  onAdd,
  onCancel,
  children,
}: {
  panelId: string;
  title: string;
  narrow: boolean;
  saving: boolean;
  table: Pick<RecordTable<Rec, Change, Request>, "recordProblem" | "request">;
  columns: readonly Column<Rec, Change>[];
  // The fields in the order the form shows them, the first typed into taking the cursor as it opens.
  shown: readonly Column<Rec, Change>[];
  kind: string;
  values: FormValues;
  others: () => Record<string, CellValue>[];
  // Whether an editor stays open, holding a value it will not give up, which says why itself.
  unfinished: boolean;
  withRefused: (
    found: readonly { column: string; message: string }[],
  ) => readonly { column: string; message: string }[];
  onRefused: (found: readonly { column: string; message: string }[]) => void;
  // Adds the record, given what to do with the server's refusal of a value: name it under its field,
  // saying whether the form, still shown, has that field.
  onAdd: (request: Request, refused: (refusal: Refusal) => boolean) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  useFocusOnOpen(firstTypedInto(shown));
  // Whether the form is still shown, since the server may answer after it was closed or replaced.
  const stillShown = useRef(false);
  useEffect(() => {
    stillShown.current = true;
    return () => {
      stillShown.current = false;
    };
  }, []);
  const add = () => {
    if (unfinished) return;
    const found = withRefused(
      newRecordProblems(columns, kind, values, table.recordProblem, others),
    );
    if (found.length > 0) {
      onRefused(found);
      return;
    }
    onAdd(
      table.request(
        columns.map((column) => column.change(values[column.key] as CellValue)),
        kind,
      ),
      ({ reason, field }) => {
        if (!stillShown.current || !columns.some(({ key }) => key === field)) {
          return false;
        }
        onRefused([{ column: field, message: reason }]);
        return true;
      },
    );
  };
  // Add and Cancel act once the field being typed in is left, and checked, so they act on its value
  // as given. Pressing them leaves focus where it is, since leaving the field can show or take away
  // the reason under it, which would move the button from under the pointer before the click.
  const press = useAfterUpdate((chosen: "add" | "cancel") => {
    if (chosen === "add") add();
    else onCancel();
  });
  const leavingFor =
    (chosen: "add" | "cancel") => (event: MouseEvent<HTMLButtonElement>) => {
      // Leaving the field checks it; focus then goes back to it, where the question Cancel may ask
      // returns it, and where Add's refusal, if any, puts it.
      const typing = document.activeElement;
      if (typing instanceof HTMLElement && typing !== event.currentTarget) {
        typing.blur();
        typing.focus();
      }
      press(chosen);
    };
  const keepFocus = (event: MouseEvent) => {
    event.preventDefault();
  };
  const body = (
    <DetailSections>
      {children}
      <Group justify="flex-end" gap="xs">
        <Button
          variant="default"
          onMouseDown={keepFocus}
          onClick={leavingFor("cancel")}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          onMouseDown={keepFocus}
          onClick={leavingFor("add")}
          loading={saving}
        >
          Add
        </Button>
      </Group>
    </DetailSections>
  );
  return (
    <NewFormEnter
      value={() => {
        press("add");
      }}
    >
      <SidePanelFrame
        id={panelId}
        titleId={titleId}
        title={title}
        narrow={narrow}
        close={{
          label: `Close ${title}`,
          onClose: () => {
            if (!saving) onCancel();
          },
        }}
      >
        <div className={sidePanelScroll} inert={saving}>
          {body}
        </div>
      </SidePanelFrame>
    </NewFormEnter>
  );
}
