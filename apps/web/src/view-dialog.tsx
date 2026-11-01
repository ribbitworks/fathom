// SPDX-License-Identifier: Apache-2.0

// The dialog for naming a saved view, when saving the table's view or renaming a saved one. The name
// is checked against the table's other saved views as it is typed. The dialog saves the view itself,
// so a name someone else has just taken is refused here, and cannot be closed while it saves.

import { type SavedView, viewLengths } from "@fathom/shared";
import { Group, Button, Stack, Text, TextInput } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, describeProblem } from "./api.ts";
import { Count, nameProblem } from "./list-dialog.tsx";
import { sameName } from "./lists.ts";

const conflict = 409;
const duplicate = "Already a view";

export interface SavedViewResult {
  view: SavedView;
  changeSetId: string | null;
}

export function ViewDialog({
  view,
  views,
  save,
  onSaved,
  onCancel,
  onBusy,
}: {
  // The saved view being renamed; absent when saving a new one.
  view?: SavedView;
  views: readonly SavedView[];
  save: (name: string) => Promise<SavedViewResult>;
  onSaved: (saved: SavedViewResult) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [name, setName] = useState(view?.name ?? "");
  const [tried, setTried] = useState(false);
  // The name last sent, so a refusal of it as taken no longer applies once the name changes.
  const [sentName, setSentName] = useState("");
  const saving = useMutation({
    mutationFn: save,
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
    onSuccess: onSaved,
  });
  const taken = views.some(
    (other) => other.id !== view?.id && sameName(other.name, name),
  );
  const refusedAsTaken =
    saving.error instanceof ApiError &&
    saving.error.status === conflict &&
    sameName(sentName, name);
  const problem =
    nameProblem(name, viewLengths.name, taken, duplicate) ??
    (refusedAsTaken ? duplicate : undefined);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (problem !== undefined) return;
        setSentName(name);
        saving.mutate(name.trim());
      }}
    >
      <Stack gap="md">
        <TextInput
          label="Name"
          data-autofocus
          value={name}
          error={tried || name !== "" ? problem : undefined}
          rightSection={
            <Count length={name.trim().length} maximum={viewLengths.name} />
          }
          rightSectionWidth={56}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
        {saving.error &&
          !(
            saving.error instanceof ApiError && saving.error.status === conflict
          ) && (
            <Text fz="sm" c="red" role="alert">
              {describeProblem(
                saving.error,
                "Fathom could not save the view. Try again in a moment.",
              )}
            </Text>
          )}
        <Group gap="xs" justify="flex-end" mt="xs">
          <Button
            variant="subtle"
            color="gray"
            disabled={saving.isPending}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="submit" loading={saving.isPending}>
            {view ? "Rename" : "Save view"}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
