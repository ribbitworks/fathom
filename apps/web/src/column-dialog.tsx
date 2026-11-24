// SPDX-License-Identifier: Apache-2.0

// The dialog for adding a column to a table or changing one.

import {
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
  mostChoicesAtOnce,
  personLengths,
  type Permission,
  type Tier,
  sameName,
} from "@fathom/shared";
import {
  Button,
  Checkbox,
  Group,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, describeProblem } from "./api.ts";
import { focusRefusedSoon } from "./focus.ts";
import {
  choiceTooLong,
  duplicateChoice,
  tooManyChoices,
} from "./choice-rules.ts";
import { Count } from "./counted-input.tsx";
import { nameTaken } from "./list-dialog.tsx";
import { listsQuery, nameProblem } from "./lists.ts";
import { ClassChoice } from "./move-class-dialog.tsx";
import { createField, updateField } from "./column-requests.ts";

const conflict = 409;

// The List picker's choice that drafts a new list with the column, which no list's ID can be.
const newListChoice = "new";

// Choices pasted several at once, one to a line, are split into each.
const choiceSeparators = ["\n", "\r"];

// A choice as typed or pasted: its name, without a description pasted after a tab from a sheet.
const choiceLabel = (typed: string) => typed.split("\t", 1).join("").trim();

// Why choices typed or pasted can't be taken, if they can't: too many at once, or one too long.
const typedChoicesProblem = (typed: readonly string[]): string | undefined => {
  if (typed.length > mostChoicesAtOnce) return tooManyChoices;
  return typed.some((label) => choiceLabel(label).length > listLengths.choice)
    ? choiceTooLong
    : undefined;
};

// Every type must be named, which the compiler checks.
const typeNames: Record<FieldType, string> = {
  choice: "Choice from a list",
  link: "Web link",
  note: "Note",
  number: "Number",
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
}) {
  const [name, setName] = useState(field?.name ?? "");
  const [type, setType] = useState<FieldType>(field?.type ?? "choice");
  const [visibility, setVisibility] = useState<Tier>(
    field?.visibility ?? "general",
  );
  const [listId, setListId] = useState<string | null>(field?.listId ?? null);
  const [listName, setListName] = useState("");
  const [choices, setChoices] = useState<string[]>([]);
  // Why the choice last typed or pasted wasn't taken, until the choices change.
  const [choiceRefused, setChoiceRefused] = useState<string>();
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
  const shownChoicesProblem =
    choiceRefused ?? (tried ? choicesProblem : undefined);

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
                required,
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
        <TextInput
          label="Name"
          data-autofocus
          value={name}
          error={shownProblem}
          rightSection={
            <Count length={name.trim().length} maximum={personLengths.column} />
          }
          rightSectionWidth={56}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
        {/* Drop-down lists that open on Enter, as the browser's own list would take Enter as
            adding the column. */}
        <Select
          label="Type"
          description={
            field === undefined ? undefined : "A column's type cannot change"
          }
          disabled={field !== undefined}
          data={fieldTypeSchema.options.map((option) => ({
            value: option,
            // The type is always one of the fixed types named above.
            // eslint-disable-next-line security/detect-object-injection
            label: typeNames[option],
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
              data={[
                ...(offersNewList
                  ? [{ value: newListChoice, label: "New list" }]
                  : []),
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
              ]}
              value={listId}
              error={listProblem}
              onChange={setListId}
            />
            {makesList && (
              <>
                <TextInput
                  label="List name"
                  value={listName}
                  error={tried || listName !== "" ? listNameProblem : undefined}
                  rightSection={
                    <Count
                      length={listName.trim().length}
                      maximum={listLengths.name}
                    />
                  }
                  rightSectionWidth={56}
                  onChange={(event) => {
                    setListName(event.currentTarget.value);
                  }}
                />
                <TagsInput
                  label="Choices"
                  value={choices}
                  error={shownChoicesProblem}
                  splitChars={choiceSeparators}
                  maxLength={listLengths.choice}
                  clearable
                  onDuplicate={() => {
                    setChoiceRefused(duplicateChoice);
                  }}
                  onChange={(next) => {
                    const refused = typedChoicesProblem(next);
                    setChoiceRefused(refused);
                    if (refused === undefined)
                      setChoices(next.map(choiceLabel));
                  }}
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
