// SPDX-License-Identifier: Apache-2.0

// The dialog for adding a column to a table or changing one: its name, its type, which is set once,
// whether it must be filled in, and, for a choice column, the list it draws on and whether several
// choices can be picked. On People, it also sets whether planned hires, which never must fill it
// in, are offered it, and, for a web link, note, or number column not yet approved and a role with
// Classify data, the class of its values; an approved column changes class from its menu instead.
// A column on Features is General, so it offers only General lists. Changing a column also offers
// removing it, to those who may. The name is checked against the other columns as it is typed. The
// dialog cannot be closed while a change is being saved.

import {
  classNames,
  type ColumnTable,
  columnTablePolicies,
  type Field,
  type FieldRequest,
  type FieldType,
  fieldTypeSchema,
  type List,
  personLengths,
  type Permission,
  type Tier,
} from "@fathom/shared";
import {
  Button,
  Checkbox,
  Group,
  NativeSelect,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, describeProblem } from "./api.ts";
import { Count, nameProblem } from "./list-dialog.tsx";
import { sameName } from "./lists.ts";
import { ClassChoice } from "./move-class-dialog.tsx";
import { createField, updateField } from "./column-requests.ts";

const conflict = 409;
const duplicate = "Already a column";

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
    onSuccess: ({ field: saved, changeSetId }) => {
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
  const problem =
    nameProblem(name, personLengths.column, taken, duplicate) ??
    (nameRefused ? duplicate : undefined);
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

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (problem !== undefined || needsList) return;
        setSentName(name);
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
                listId: listId as string,
                multiple,
                required,
                onPlannedHires,
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
        <NativeSelect
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
          onChange={(event) => {
            setType(fieldTypeSchema.parse(event.currentTarget.value));
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
            <NativeSelect
              label="List"
              data={[
                { value: "", label: "" },
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
              value={listId ?? ""}
              error={listProblem}
              onChange={(event) => {
                setListId(event.currentTarget.value || null);
              }}
            />
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
        {saving.error && !refusedAsTaken && (
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
