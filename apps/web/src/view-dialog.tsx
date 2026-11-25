// SPDX-License-Identifier: Apache-2.0

// The dialog for naming a saved view, when saving the table's view or renaming a saved one. The name
// is checked against the table's other saved views of the same scope as it is typed. The dialog saves the view itself,
// so a name someone else has just taken is refused here, and cannot be closed while it saves.

import {
  type ListedView,
  sameName,
  viewLengths,
  type ViewScope,
} from "@fathom/shared";
import { Button, Checkbox, Group, Stack, Text } from "@mantine/core";
import type { ViewPart } from "./table-controls.tsx";
import classes from "./pages.module.css";
import { useMutation } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { describeProblem, isConflict } from "./api.ts";
import { focusRefusedSoon } from "./focus.ts";
import { CountedInput } from "./counted-input.tsx";
import { takenNameProblem } from "./list-dialog.tsx";

const includesId = "view-dialog-includes";

export interface SavedViewResult {
  view: ListedView;
  changeSetId: string | null;
}

// A saved view as a name is checked against it.
export interface NamedView {
  id: string;
  name: string;
  scope: ViewScope;
}

export function ViewDialog({
  view,
  views,
  save,
  onSaved,
  onCancel,
  onBusy,
  saves,
  canSaveShared = false,
}: {
  // The saved view being renamed; absent when saving a new one.
  view?: NamedView | undefined;
  // What saving keeps, listed under the name; absent when renaming.
  saves?: readonly ViewPart[];
  canSaveShared?: boolean;
  views: readonly NamedView[];
  save: (name: string, scope: ViewScope) => Promise<SavedViewResult>;
  onSaved: (saved: SavedViewResult) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [name, setName] = useState(view?.name ?? "");
  const [tried, setTried] = useState(false);
  const [scope, setScope] = useState<ViewScope>(view?.scope ?? "personal");
  // What was last sent, so a refusal of its name as taken no longer applies once either changes.
  const [sent, setSent] = useState({ name: "", scope });
  const saving = useMutation({
    mutationFn: (sending: string) => save(sending, scope),
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
    onSuccess: onSaved,
  });
  const taken = views.some(
    (other) =>
      other.id !== view?.id &&
      other.scope === scope &&
      sameName(other.name, name),
  );
  const refusedAsTaken =
    isConflict(saving.error) &&
    sent.scope === scope &&
    sameName(sent.name, name);
  const problem = takenNameProblem(
    "view",
    name,
    viewLengths.name,
    taken || refusedAsTaken,
  );

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        const form = event.currentTarget;
        if (problem !== undefined) {
          focusRefusedSoon(form);
          return;
        }
        setSent({ name, scope });
        saving.mutate(name.trim(), {
          onError: () => {
            focusRefusedSoon(form);
          },
        });
      }}
    >
      <Stack gap="md">
        <CountedInput
          label="Name"
          data-autofocus
          value={name}
          maximum={viewLengths.name}
          error={tried || name !== "" ? problem : undefined}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
        {canSaveShared && (
          <Checkbox
            label="Share with everyone who sees this page"
            checked={scope === "shared"}
            onChange={(event) => {
              setScope(event.currentTarget.checked ? "shared" : "personal");
            }}
          />
        )}
        {saves !== undefined && saves.length > 0 && (
          <div>
            <Text id={includesId} fz="sm" fw={500} mb={4}>
              Includes
            </Text>
            <dl className={classes.viewParts} aria-labelledby={includesId}>
              {saves.map((part, at) => (
                <Fragment key={at}>
                  <dt>{part.name}</dt>
                  <dd>{part.value}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        )}
        {saving.error && !isConflict(saving.error) && (
          <Text fz="sm" c="red" role="alert">
            {describeProblem(
              saving.error,
              "Fathom could not save the view. Try again in a moment.",
            )}
          </Text>
        )}
        <Group gap="xs" justify="flex-end" mt="xs">
          <Button
            variant="default"
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
