// SPDX-License-Identifier: Apache-2.0

// Filling a planned hire in its details panel, in place of its details: as a new person, who is
// named, given an ID and a start date that begins as the hire's target date, or as someone already
// in Fathom, chosen from those who can fill it, with the day they move to their manager when they
// would move. The manager begins as the hire's and can be changed for either. A new person is also
// asked for anything People requires that the hire has no value for. Each value is checked as a new
// row's cell checks it, and Fill checks the whole, naming any problem under its field. The page holds
// what has been entered, so it can ask before discarding it.

import {
  type HireFill,
  type List,
  type Person,
  typedDay,
  defaultLineFrom,
  allOf,
} from "@fathom/shared";
import { Button, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { cellKinds } from "./cell-kinds.tsx";
import { notShown } from "./draft-details.tsx";
import { choice } from "./lists.ts";
import {
  fillCandidates,
  type HireFilling,
  managerChange,
  underPlannedManager,
  wouldMove,
} from "./hire-fill.ts";
import { byLabel, chosen, type Column } from "./people-grid.tsx";
import {
  isHire,
  positionLabel,
  rowName,
  type RowChange,
  personKind,
} from "./people-rows.ts";
import type { NoteOpening } from "./note-editing.tsx";
import { type EditingContext, usePersonEditing } from "./person-editing.tsx";
import classes from "./record-details.module.css";
import { RecordLink, Row } from "./record-details.tsx";
import { useFocusOnOpen } from "./record-editing.tsx";
import { cellColumn, columnsOn, onRow } from "./grid-columns.tsx";
import { newRecordProblems } from "./grid-saving.ts";
import type { CellValue } from "./table-view.ts";
import { today } from "./today.ts";
import { newRecordRequest, recordProblem } from "./people-requests.ts";

export const fillButtonId = "hire-fill";

const reportsColumn = cellColumn<Person, RowChange>("fillReports", "text", {
  label: "Direct reports",
  required: false,
  multiple: false,
  choices: [],
});

const personKey = "fillPerson";
const fromKey = "fillFrom";

// A planned hire's Fill button, for those who may fill it now, or who is filling it, in a draft, by
// name and ID. The server names who only to those who see Personal details.
export function HireFillAction({
  hire,
  people,
  columns,
  onPerson,
  onFill,
}: {
  hire: Person;
  people: readonly Person[];
  columns: readonly Column[];
  onPerson: (employeeId: string) => void;
  onFill: (() => void) | undefined;
}) {
  if (hire.filler !== undefined) {
    const filler = people.find(({ id }) => id === hire.filler);
    return (
      <section aria-labelledby="hire-filled-by" className={classes.filledBy}>
        <h3 className={classes.heading} id="hire-filled-by">
          Filled by
        </h3>
        {filler === undefined ? (
          <Text c="dimmed">{notShown}</Text>
        ) : (
          <dl className={classes.list}>
            {columns
              .filter(({ key }) =>
                ["preferredName", "employeeId"].includes(key),
              )
              .map((column) => (
                <Row
                  key={column.key}
                  column={column}
                  value={column.value(filler)}
                >
                  <RecordLink
                    name={column.value(filler) as string}
                    onShow={() => {
                      onPerson(filler.employeeId);
                    }}
                  />
                </Row>
              ))}
          </dl>
        )}
      </section>
    );
  }
  return (
    onFill !== undefined && (
      <Button id={fillButtonId} size="xs" mt="xs" onClick={onFill}>
        Fill
      </Button>
    )
  );
}

export function HireFillForm({
  hire,
  people,
  lists,
  columns,
  filling,
  onFilling,
  notes,
  onFill,
  onCancel,
}: {
  hire: Person;
  // Everyone and every planned hire People shows, whose IDs a new person may not share.
  people: readonly Person[];
  lists: readonly List[];
  columns: readonly Column[];
  filling: HireFilling;
  // Changes what has been entered so far, since a note's panel saves long after the form was drawn.
  onFilling: (update: (current: HireFilling) => HireFilling) => void;
  notes: NoteOpening;
  onFill: (request: HireFill) => void;
  onCancel: () => void;
}) {
  const { editingOf, refuse, refuseEntered, withRefused, unfinished } =
    usePersonEditing(notes);
  // A note is written in the page's panel, which stays open for the record shown.
  const formId = hire.id;
  const day = today();
  const isNew = filling.by === "new person";
  const saving = filling.saving === true;
  const on = columnsOn(columns, personKind);
  const columnOf = (key: string) => on.find((column) => column.key === key);
  const entered = (key: string, otherwise: CellValue): CellValue =>
    // The key is one of the form's own columns.
    // eslint-disable-next-line security/detect-object-injection
    filling.values[key] ?? otherwise;

  const hireManager = hire.manager?.id;
  // A planned manager can't manage a person, so its hire's person starts with none.
  const startsEmpty = underPlannedManager(hire, people);
  const [managerId] = entered(
    "managerId",
    chosen(startsEmpty ? undefined : hireManager),
  ) as string[];
  const candidates = fillCandidates(people, managerId, day);
  const personColumn: Column = {
    ...cellColumn<Person, RowChange>(personKey, "choice", {
      label: "Person",
      required: true,
      multiple: false,
      choices: byLabel(
        candidates.map((one) =>
          choice(
            one.id,
            [
              `${rowName(one, lists)} (${one.employeeId})`,
              positionLabel(lists, one.positionId),
            ]
              .filter((part) => part !== undefined)
              .join(", "),
            false,
          ),
        ),
      ),
    }),
    emptyLabel: "",
  };
  const [personId] = entered(personKey, []) as string[];
  const chosenPerson = candidates.find(({ id }) => id === personId);
  const moves = wouldMove(chosenPerson, managerId);
  const managerFrom = columnOf("managerFrom");
  // Every record has a Manager column, offering everyone who may manage.
  const offeredManagers = onRow<Person, Column>(
    columnOf("managerId") as Column,
    undefined,
    personKind,
  );
  const managerColumn: Column = {
    ...offeredManagers,
    pickable: (option) =>
      option.id !== personId && offeredManagers.pickable?.(option) === true,
    ...(isNew
      ? { required: startsEmpty }
      : { emptyLabel: "Keeps their manager" }),
  };
  const fromColumn: Column | undefined =
    moves && managerFrom !== undefined
      ? { ...managerFrom, key: fromKey }
      : undefined;

  const others = () => people.map(({ employeeId }) => ({ employeeId }));
  const requiredAdded = on.filter(
    (column) => column.field !== undefined && column.required,
  );
  const unset = new Set(
    newRecordProblems(
      requiredAdded,
      personKind,
      Object.fromEntries(
        requiredAdded.map((column) => [column.key, column.value(hire)]),
      ),
      () => undefined,
      others,
    ).map(({ column }) => column),
  );
  const missing = requiredAdded.filter(({ key }) => unset.has(key));

  const positionColumn = columnOf("positionId");
  const startColumn = columnOf("startDate");
  const position: Column[] =
    positionColumn === undefined
      ? []
      : [
          {
            ...positionColumn,
            required: false,
            readOnly: true,
            emptyLabel: "",
          },
        ];
  // Filling a planned manager moves its planned hires to whoever fills it.
  const reports = people
    .filter((one) => isHire(one) && one.manager?.id === hire.id)
    .map((one) => rowName(one, lists));
  const fields = isNew
    ? [
        columnOf("preferredName") as Column,
        columnOf("employeeId") as Column,
        ...position,
        ...(startColumn === undefined ? [] : [startColumn]),
        managerColumn,
        ...missing,
      ]
    : [
        personColumn,
        ...position,
        managerColumn,
        ...(fromColumn === undefined ? [] : [fromColumn]),
      ];
  const from = entered(
    fromKey,
    chosenPerson ? defaultLineFrom(chosenPerson.startDate, day) : "",
  ) as string;
  const values: Record<string, CellValue> = isNew
    ? {
        preferredName: entered("preferredName", ""),
        employeeId: entered("employeeId", ""),
        positionId: chosen(hire.positionId),
        startDate: entered("startDate", hire.startDate ?? ""),
        managerId: chosen(managerId),
        ...Object.fromEntries(
          missing.map((column) => [
            column.key,
            entered(column.key, cellKinds[column.kind].empty),
          ]),
        ),
      }
    : {
        [personKey]: entered(personKey, []),
        positionId: chosen(hire.positionId),
        managerId: chosen(managerId),
        [fromKey]: from,
      };
  const context: EditingContext = {
    id: formId,
    kind: personKind,
    name: rowName(hire, lists),
    values,
    adding: true,
    others,
    recordProblem,
    save: (_change, column, value) => {
      onFilling((current) => ({
        ...current,
        values: { ...current.values, [column.key]: value },
      }));
    },
  };
  const editing = editingOf(context);
  useFocusOnOpen(fields[0], isNew);

  const fill = () => {
    if (unfinished(formId)) return;
    const found = withRefused(
      formId,
      fields,
      newRecordProblems(
        fields,
        personKind,
        values,
        isNew ? recordProblem : () => undefined,
        others,
      ),
    );
    if (found.length > 0) {
      refuseEntered(formId, found, fields);
      return;
    }
    const manager = managerChange(hire, managerId);
    if (isNew) {
      const asked = newRecordRequest(missing, personKind, values);
      onFill({
        ...manager,
        values: asked.values,
        links: asked.links,
        notes: asked.notes,
        numbers: asked.numbers,
        by: "new person",
        preferredName: (values.preferredName as string).trim(),
        employeeId: (values.employeeId as string).trim(),
        startDate:
          startColumn === undefined || values.startDate === ""
            ? null
            : typedDay(values.startDate as string),
      });
      return;
    }
    const fromDay = typedDay(from);
    onFill({
      ...manager,
      by: "existing person",
      // Fill is refused above until a person is chosen.
      personId: personId as string,
      ...(fromColumn === undefined || fromDay === ""
        ? {}
        : { managerFrom: fromDay }),
    });
  };

  return (
    <section aria-labelledby="hire-fill-heading" inert={saving}>
      <Stack gap="md">
        <h3 className={classes.heading} id="hire-fill-heading">
          Fill this planned hire
        </h3>
        <SegmentedControl
          aria-labelledby="hire-fill-heading"
          value={filling.by}
          onChange={(by) => {
            refuse(formId, []);
            onFilling((current) => ({ ...current, by }));
          }}
          data={[
            { value: "new person", label: "New person" },
            { value: "existing person", label: "Existing person" },
          ]}
          w="fit-content"
        />
        <dl className={classes.list}>
          {fields.map((column) => (
            <Row
              key={column.key}
              column={column}
              value={values[column.key] as CellValue}
              editing={editing(column)}
            />
          ))}
          {reports.length > 0 && (
            <Row column={reportsColumn} value={allOf(reports)} />
          )}
        </dl>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={fill} loading={saving}>
            Fill
          </Button>
        </Group>
      </Stack>
    </section>
  );
}
