// SPDX-License-Identifier: Apache-2.0

// The dialog for adding a column to a table or changing one.

import {
  canBeRequired,
  classNames,
  type ColumnTable,
  columnTablePolicies,
  type Field,
  type FieldRequest,
  type FieldType,
  fieldTypeSchema,
  duplicateList,
  type List,
  listLengths,
  personLengths,
  type Permission,
  type Tier,
  sameName,
} from "@fathom/shared";
import { Button, Checkbox, Group, Select, Stack, Text } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, describeProblem } from "./api.ts";
import { focusRefusedSoon } from "./focus.ts";
import { addingLabel } from "./choice-picker.tsx";
import comboboxClasses from "./combobox.module.css";
import { CountedInput } from "./counted-input.tsx";
import { nameTaken } from "./list-dialog.tsx";
import { type NewChoice, NewListChoices } from "./new-list-choices.tsx";
import { listsQuery, nameProblem } from "./lists.ts";
import { ClassChoice } from "./move-class-dialog.tsx";
import { createField, updateField } from "./column-requests.ts";

const conflict = 409;

// The List picker's choice that drafts a new list with the column, which no list's ID can be.
const newListChoice = "new";

// Every type must be named, which the compiler checks, and is offered in this order.
const typeNames: Record<FieldType, string> = {
  number: "Number",
  flag: "Checkbox",
  choice: "Choice from a list",
  link: "Web link",
  note: "Note",
};

export function ColumnDialog({
  table,
  field,
  fields,
  lists,
  onSaved,
  onDelete,
  onCancel,
  onBusy,
  onChanged,
  permissions,
}: {
  table: ColumnTable;
  // The role's permissions, which decide whether and to which classes the column may be given.
  permissions: readonly Permission[];
  // The column being changed; absent when adding one.
  field?: Field;
  fields: Field[];
  lists: List[];
  // Given the column as saved, and the change set it was saved in.
  onSaved: (saved: Field, changeSetId: string | null) => void;
  // Absent for those who may not remove the column.
  onDelete?: ((field: Field) => void) | undefined;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
  // Told whether anything shown differs from how the dialog opened, so leaving it may ask first.
  onChanged: (changed: boolean) => void;
}) {
  const [name, setName] = useState(field?.name ?? "");
  const [type, setType] = useState<FieldType>(field?.type ?? "choice");
  const [visibility, setVisibility] = useState<Tier>(
    field?.visibility ?? "general",
  );
  const [listId, setListId] = useState<string | null>(field?.listId ?? null);
  const [listName, setListName] = useState("");
  const [choices, setChoices] = useState<NewChoice[]>([]);
  // A choice being typed, not yet taken, which leaving the dialog would lose too.
  const [typingChoice, setTypingChoice] = useState("");
  // The list name last sent, so a refusal of it as taken no longer applies once the name changes.
  const [sentListName, setSentListName] = useState("");
  const [multiple, setMultiple] = useState(field?.multiple ?? false);
  const [required, setRequired] = useState(field?.required ?? false);
  // The table is always one of the fixed tables.
  // eslint-disable-next-line security/detect-object-injection
  const policy = columnTablePolicies[table];
  const classifies =
    !policy.generalOnly &&
    permissions.includes("data:classify") &&
    (field === undefined || field.draft?.action === "created");
  const [onPlannedHires, setOnPlannedHires] = useState(
    field?.onPlannedHires ?? policy.onPlannedHires,
  );
  const [tried, setTried] = useState(false);
  const queryClient = useQueryClient();
  const shown = JSON.stringify({
    name,
    type,
    visibility,
    listId,
    multiple,
    required,
    onPlannedHires,
    listName,
    choices,
    typingChoice,
  });
  const [opened] = useState(shown);
  const changed = shown !== opened;
  useEffect(() => {
    onChanged(changed);
  }, [changed, onChanged]);
  // The name last sent, so a refusal of it as taken no longer applies once the name changes.
  const [sentName, setSentName] = useState("");
  const saving = useMutation({
    mutationFn: (request: FieldRequest) =>
      field === undefined
        ? createField(request, table)
        : updateField(field.id, request, table),
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
    onSuccess: ({ field: saved, changeSetId }, request) => {
      // The lists offered are read apart from the table, so a new list is read with them.
      if (request.newList !== undefined) {
        void queryClient.invalidateQueries({ queryKey: listsQuery.queryKey });
      }
      onSaved(saved, changeSetId);
    },
  });
  const taken = fields.some(
    (other) => other.id !== field?.id && sameName(other.name, name),
  );
  // A conflict for a name not taken by any column shown is about the column's values, which the
  // server explains.
  const refusedAsTaken =
    saving.error instanceof ApiError &&
    saving.error.status === conflict &&
    saving.error.serverMessage === "There is already a column with that name";
  const nameRefused = refusedAsTaken && sameName(sentName, name);
  const problem = nameProblem(
    name,
    personLengths.column,
    taken || nameRefused,
    nameTaken("column"),
  );
  const shownProblem = tried || name !== "" ? problem : undefined;
  // Retired lists, and lists drafted to be removed, are not offered, except the one the column
  // already draws on. A list only drafted to be added is offered, and is approved with the column.
  const offered = lists
    .filter((list) => !policy.generalOnly || list.visibility === "general")
    .filter(
      (list) =>
        (!list.retired && list.draft?.action !== "deleted") ||
        list.id === field?.listId,
    );
  const needsList = type === "choice" && listId === null;
  const listProblem = tried && needsList ? "List needed" : undefined;
  // A new list drafted with the column, offered only on a table whose editors don't make lists.
  const offersNewList = policy.newLists && field === undefined;
  const makesList = type === "choice" && listId === newListChoice;
  const listRefusedAsTaken =
    saving.error instanceof ApiError &&
    saving.error.status === conflict &&
    saving.error.serverMessage === duplicateList;
  const listNameProblem = makesList
    ? nameProblem(
        listName,
        listLengths.name,
        (listRefusedAsTaken && sameName(sentListName, listName)) ||
          lists.some((list) => sameName(list.name, listName)),
        nameTaken("list"),
      )
    : undefined;
  const choicesProblem =
    makesList && choices.length === 0 ? "Choices needed" : undefined;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        const form = event.currentTarget;
        if (
          problem !== undefined ||
          needsList ||
          listNameProblem !== undefined ||
          choicesProblem !== undefined
        ) {
          focusRefusedSoon(form);
          return;
        }
        setSentName(name);
        setSentListName(listName);
        saving.mutate(
          type !== "choice"
            ? {
                name: name.trim(),
                type,
                visibility,
                multiple: false,
                required: canBeRequired(type) && required,
                onPlannedHires,
              }
            : {
                name: name.trim(),
                type,
                // A choice column cannot be saved without its list, as checked above.
                ...(makesList
                  ? { newList: { name: listName.trim(), choices } }
                  : { listId: listId as string }),
                multiple,
                required,
                onPlannedHires,
              },
          {
            onError: () => {
              focusRefusedSoon(form);
            },
          },
        );
      }}
    >
      <Stack gap="md">
        <CountedInput
          label="Name"
          data-autofocus
          value={name}
          maximum={personLengths.column}
          error={shownProblem}
          onValue={setName}
        />
        {/* Drop-down lists that open on Enter, as the browser's own list would take Enter as
            adding the column. */}
        <Select
          label="Type"
          description={
            field === undefined ? undefined : "A column's type cannot change"
          }
          disabled={field !== undefined}
          data={Object.entries(typeNames).map(([option, label]) => ({
            value: option,
            label,
          }))}
          value={type}
          onChange={(value) => {
            setType(fieldTypeSchema.parse(value));
          }}
        />
        {type !== "choice" ? (
          classifies && (
            <ClassChoice
              from={field?.visibility ?? "general"}
              value={visibility}
              permissions={permissions}
              onChange={setVisibility}
            />
          )
        ) : (
          <>
            <Select
              label="List"
              {...(offersNewList
                ? { classNames: { options: comboboxClasses.lastAdds } }
                : {})}
              data={[
                // A list in a class beyond General names it, and one only drafted to be added says
                // it is new.
                ...offered.map((list) => {
                  const notes = [
                    ...(list.draft?.action === "created" ? ["new"] : []),
                    ...(list.visibility === "general"
                      ? []
                      : [classNames[list.visibility]]),
                  ];
                  return {
                    value: list.id,
                    label:
                      notes.length === 0
                        ? list.name
                        : `${list.name} (${notes.join(", ")})`,
                  };
                }),
                ...(offersNewList
                  ? [{ value: newListChoice, label: addingLabel("list", "") }]
                  : []),
              ]}
              value={listId}
              error={listProblem}
              onChange={setListId}
            />
            {makesList && (
              <>
                <CountedInput
                  label="List name"
                  value={listName}
                  maximum={listLengths.name}
                  error={tried || listName !== "" ? listNameProblem : undefined}
                  onValue={setListName}
                />
                <NewListChoices
                  choices={choices}
                  needed={tried ? choicesProblem : undefined}
                  onChoices={setChoices}
                  onTyping={setTypingChoice}
                />
              </>
            )}
            <Checkbox
              label="Several choices"
              checked={multiple}
              onChange={(event) => {
                setMultiple(event.currentTarget.checked);
              }}
            />
          </>
        )}
        {canBeRequired(type) && (
          <Checkbox
            label="Must be filled in"
            description={
              onPlannedHires ? "Planned hires can leave it empty" : undefined
            }
            checked={required}
            onChange={(event) => {
              setRequired(event.currentTarget.checked);
            }}
          />
        )}
        {policy.onPlannedHires && (
          <Checkbox
            label="Offered on planned hires"
            checked={onPlannedHires}
            onChange={(event) => {
              setOnPlannedHires(event.currentTarget.checked);
            }}
          />
        )}
        {saving.error && !refusedAsTaken && !listRefusedAsTaken && (
          <Text fz="sm" c="red" role="alert">
            {describeProblem(
              saving.error,
              "Fathom could not save the column. Try again in a moment.",
            )}
          </Text>
        )}
        <Group gap="xs" mt="xs">
          {field && onDelete && (
            <Button
              variant="outline"
              color="red"
              disabled={saving.isPending}
              onClick={() => {
                onDelete(field);
              }}
            >
              Remove column
            </Button>
          )}
          <Group gap="xs" ml="auto">
            <Button
              variant="default"
              disabled={saving.isPending}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving.isPending}>
              {field ? "Save" : "Add column"}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
