// SPDX-License-Identifier: Apache-2.0

// The dialog for creating a list or editing one: its name, description, and who can see the values
// chosen from it. Editing also offers retiring or restoring the list, and deleting it. The name is
// checked against the other lists as it is typed. The dialog cannot be closed while a change is
// being saved.

import {
  type List,
  listLengths,
  type ListRequest,
  type Tier,
  tierSchema,
} from "@fathom/shared";
import {
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, describeProblem } from "./api.ts";
import { createList, sameName, updateList, visibilityName } from "./lists.ts";
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
}: {
  // The list being edited; absent when creating one.
  list?: List;
  lists: List[];
  onSaved: (saved: List, before?: List) => void;
  onRetire: (list: List) => void;
  onDelete: (list: List) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
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
    onSuccess: (saved) => {
      onSaved(saved, list);
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
        <Stack gap={6}>
          <Text fz="sm" fw={500} id="list-visibility">
            Visible to
          </Text>
          <SegmentedControl
            aria-labelledby="list-visibility"
            value={visibility}
            onChange={(value) => {
              setVisibility(tierSchema.parse(value));
            }}
            data={tierSchema.options.map((tier) => ({
              value: tier,
              label: visibilityName(tier),
            }))}
            w="fit-content"
          />
        </Stack>
        {saving.error && !refusedAsTaken && (
          <Text fz="sm" c="red" role="alert">
            {describeProblem(
              saving.error,
              "Fathom could not save the list. Try again in a moment.",
            )}
          </Text>
        )}
        <Group gap="xs" mt="xs">
          {list && (
            <>
              <Button
                variant="subtle"
                color="gray"
                disabled={saving.isPending}
                onClick={() => {
                  onRetire(list);
                }}
              >
                {list.retired ? "Restore list" : "Retire list"}
              </Button>
              <Button
                variant="subtle"
                color="red"
                disabled={saving.isPending}
                onClick={() => {
                  onDelete(list);
                }}
              >
                Delete list
              </Button>
            </>
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
              {list ? "Save" : "Create list"}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
