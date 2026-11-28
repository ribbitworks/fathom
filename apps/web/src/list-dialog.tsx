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
  sameName,
} from "@fathom/shared";
import { Button, Group, Stack, Text, Textarea } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { describeProblem, isConflict } from "./api.ts";
import { focusRefusedSoon } from "./focus.ts";
import { createList, takenNameProblem, updateList } from "./lists.ts";
import { CountedInput } from "./counted-input.tsx";
import { ClassChoice } from "./move-class-dialog.tsx";
import classes from "./pages.module.css";

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
  // The name last sent, so a refusal of it as taken no longer applies once the name changes.
  const [sentName, setSentName] = useState("");
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
  const refusedAsTaken = isConflict(saving.error) && sameName(sentName, name);
  const problem = takenNameProblem(
    "list",
    name,
    listLengths.name,
    taken || refusedAsTaken,
  );
  const shownProblem = tried || name !== "" ? problem : undefined;
  const descriptionTooLong =
    description.trim().length > listLengths.description;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        const form = event.currentTarget;
        if (problem !== undefined || descriptionTooLong) {
          focusRefusedSoon(form);
          return;
        }
        setSentName(name);
        saving.mutate(
          {
            name: name.trim(),
            description: description.trim(),
            visibility,
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
          maximum={listLengths.name}
          error={shownProblem}
          onValue={setName}
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
          error={descriptionTooLong ? "Description is too long" : undefined}
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
