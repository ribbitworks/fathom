// SPDX-License-Identifier: Apache-2.0

// The dialog for creating a list or editing one: its name, description, and, for a list not yet
// approved and a role with Classify data, the class of the values chosen from it; an approved list
// changes class from its panel instead. Editing also offers retiring or restoring the list, and
// removing it, except for a built-in list, which is kept. The name is checked against the other
// lists as it is typed. The dialog cannot be closed while a change is being saved.

import {
  type List,
  listLengths,
  type ListRequest,
  type Permission,
  type Tier,
} from "@fathom/shared";
import { Button, Group, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, describeProblem } from "./api.ts";
import { createList, sameName, updateList } from "./lists.ts";
import { ClassChoice } from "./move-class-dialog.tsx";
import classes from "./pages.module.css";

const conflict = 409;
// How close to a field's limit its count of characters appears.
const nearLimit = 5;

// The count of characters, shown only near the limit, and in red over it.
export function Count({
  length,
  maximum,
}: {
  length: number;
  maximum: number;
}) {
  if (length < maximum - nearLimit) return null;
  return (
    <span className={length > maximum ? classes.countOver : classes.count}>
      {length}/{maximum}
    </span>
  );
}

// What is wrong with a name, if anything.
export function nameProblem(
  name: string,
  maximum: number,
  taken: boolean,
  duplicate: string,
): string | undefined {
  if (name.trim() === "") return "Name needed";
  if (name.trim().length > maximum) return "Too long";
  return taken ? duplicate : undefined;
}

export function ListDialog({
  list,
  lists,
  onSaved,
  onRetire,
  onDelete,
  onCancel,
  onBusy,
  permissions,
}: {
  // The list being edited; absent when creating one.
  list?: List;
  lists: List[];
  // The role's permissions, which decide whether and to which classes the list may be given.
  permissions: readonly Permission[];
  // Given the list as saved, and the change set it was saved in.
  onSaved: (saved: List, changeSetId: string | null) => void;
  onRetire: (list: List) => void;
  onDelete: (list: List) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const builtIn = Boolean(list?.builtIn);
  const classifies =
    permissions.includes("data:classify") &&
    (list === undefined || list.draft?.action === "created");
  const [name, setName] = useState(list?.name ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [visibility, setVisibility] = useState<Tier>(
    list?.visibility ?? "general",
  );
  const [tried, setTried] = useState(false);
  const saving = useMutation({
    mutationFn: (request: ListRequest) =>
      list === undefined ? createList(request) : updateList(list.id, request),
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
    onSuccess: ({ list: saved, changeSetId }) => {
      onSaved(saved, changeSetId);
    },
  });
  const taken = lists.some(
    (other) => other.id !== list?.id && sameName(other.name, name),
  );
  const refusedAsTaken =
    saving.error instanceof ApiError && saving.error.status === conflict;
  const problem =
    nameProblem(name, listLengths.name, taken, "Already a list") ??
    (refusedAsTaken ? "Already a list" : undefined);
  const shownProblem = tried || name !== "" ? problem : undefined;
  const descriptionTooLong =
    description.trim().length > listLengths.description;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (problem !== undefined || descriptionTooLong) return;
        saving.mutate({
          name: name.trim(),
          description: description.trim(),
          visibility,
        });
      }}
    >
      <Stack gap="md">
        <TextInput
          label="Name"
          data-autofocus
          value={name}
          error={shownProblem}
          rightSection={
            <Count length={name.trim().length} maximum={listLengths.name} />
          }
          rightSectionWidth={56}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
        <Textarea
          label={
            <>
              Description <span className={classes.optional}>(optional)</span>
            </>
          }
          autosize
          minRows={2}
          maxRows={6}
          value={description}
          error={descriptionTooLong ? "Too long" : undefined}
          onChange={(event) => {
            setDescription(event.currentTarget.value);
          }}
        />
        {classifies && (
          <ClassChoice
            from={list?.visibility ?? "general"}
            value={visibility}
            permissions={permissions}
            onChange={setVisibility}
          />
        )}
        {saving.error && !refusedAsTaken && (
          <Text fz="sm" c="red" role="alert">
            {describeProblem(
              saving.error,
              "Fathom could not save the list. Try again in a moment.",
            )}
          </Text>
        )}
        <Group gap="xs" mt="xs">
          {list && !builtIn && (
            <>
              <Button
                variant="default"
                disabled={saving.isPending}
                onClick={() => {
                  onRetire(list);
                }}
              >
                {list.retired ? "Restore list" : "Retire list"}
              </Button>
              <Button
                variant="outline"
                color="red"
                disabled={saving.isPending}
                onClick={() => {
                  onDelete(list);
                }}
              >
                Remove list
              </Button>
            </>
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
              {list ? "Save" : "Create list"}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
