// SPDX-License-Identifier: Apache-2.0

// The dialog for adding a column to the People table or changing one: its name, the list it draws
// on, whether several choices can be picked, and whether it must be filled in. Changing a column also
// offers deleting it. The name is checked against the other columns as it is typed. The dialog cannot
// be closed while a change is being saved.

import {
  type Field,
  type FieldRequest,
  type List,
  personLengths,
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
import { sameName, visibilityName } from "./lists.ts";
import { createField, updateField } from "./people.ts";

const conflict = 409;
const duplicate = "Already a column";

export function ColumnDialog({
  field,
  fields,
  lists,
  onSaved,
  onDelete,
  onCancel,
  onBusy,
}: {
  // The column being changed; absent when adding one.
  field?: Field;
  fields: Field[];
  lists: List[];
  // Given the column as saved, and the change set it was saved in.
  onSaved: (saved: Field, changeSetId: string | null) => void;
  onDelete: (field: Field) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [name, setName] = useState(field?.name ?? "");
  const [listId, setListId] = useState<string | null>(field?.listId ?? null);
  const [multiple, setMultiple] = useState(field?.multiple ?? false);
  const [required, setRequired] = useState(field?.required ?? false);
  const [tried, setTried] = useState(false);
  // The name last sent, so a refusal of it as taken no longer applies once the name changes.
  const [sentName, setSentName] = useState("");
  const saving = useMutation({
    mutationFn: (request: FieldRequest) =>
      field === undefined
        ? createField(request)
        : updateField(field.id, request),
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
  const offered = lists.filter(
    (list) =>
      (!list.retired && list.draft?.action !== "deleted") ||
      list.id === field?.listId,
  );
  const listProblem = tried && listId === null ? "List needed" : undefined;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (problem !== undefined || listId === null) return;
        setSentName(name);
        saving.mutate({ name: name.trim(), listId, multiple, required });
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
          label="List"
          data={[
            { value: "", label: "" },
            // A list whose values not everyone may see says who may, and one only drafted to be
            // added says it is new.
            ...offered.map((list) => {
              const notes = [
                ...(list.draft?.action === "created" ? ["new"] : []),
                ...(list.visibility === "general"
                  ? []
                  : [visibilityName(list.visibility)]),
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
        <Checkbox
          label="Must be filled in"
          checked={required}
          onChange={(event) => {
            setRequired(event.currentTarget.checked);
          }}
        />
        {saving.error && !refusedAsTaken && (
          <Text fz="sm" c="red" role="alert">
            {describeProblem(
              saving.error,
              "Fathom could not save the column. Try again in a moment.",
            )}
          </Text>
        )}
        <Group gap="xs" mt="xs">
          {field && (
            <Button
              variant="subtle"
              color="red"
              disabled={saving.isPending}
              onClick={() => {
                onDelete(field);
              }}
            >
              Delete column
            </Button>
          )}
          <Group gap="xs" ml="auto">
            <Button
              variant="subtle"
              color="gray"
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
