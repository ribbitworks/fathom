// SPDX-License-Identifier: Apache-2.0

// Rename page, from a page's ⋯: its name, refused as New page refuses one.

import {
  type ListedPrivatePage,
  privatePageLengths,
  sameName,
} from "@fathom/shared";
import { Modal, Stack } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { isConflict } from "./api.ts";
import { CountedInput } from "./counted-input.tsx";
import { DialogActions } from "./dialog-actions.tsx";
import { focusRefusedSoon } from "./focus.ts";
import { takenNameProblem } from "./list-dialog.tsx";
import {
  privatePageQuery,
  privatePagesQuery,
  renamePrivatePage,
} from "./private-pages.ts";

type Page = Pick<ListedPrivatePage, "id" | "name">;

// The name's problem, if any: needed, too long, or another of the maker's pages has it already,
// or the server said so of the name last sent.
export const pageNameProblem = (
  name: string,
  pages: readonly Page[],
  renaming: string | undefined,
  refusedAsTaken: boolean,
) =>
  takenNameProblem(
    "page",
    name,
    privatePageLengths.name,
    refusedAsTaken ||
      pages.some((page) => page.id !== renaming && sameName(page.name, name)),
  );

function RenameForm({
  page,
  onCancel,
  onRenamed,
  onBusy,
}: {
  page: Page;
  onCancel: () => void;
  onRenamed: (page: Page, changeSetId: string | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const pages = useQuery(privatePagesQuery).data ?? [];
  const [name, setName] = useState(page.name);
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState("");
  const renaming = useMutation({
    mutationFn: (sending: string) => renamePrivatePage(page.id, sending),
    onSuccess: (saved) => {
      queryClient.setQueryData(privatePageQuery(page.id).queryKey, saved.page);
      onRenamed({ id: page.id, name: saved.page.name }, saved.changeSetId);
    },
  });
  useEffect(() => {
    onBusy(renaming.isPending);
  }, [renaming.isPending, onBusy]);
  const problem = pageNameProblem(
    name,
    pages,
    page.id,
    isConflict(renaming.error) && sameName(sent, name),
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
        setSent(name);
        renaming.mutate(name.trim(), {
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
          maximum={privatePageLengths.name}
          error={tried || name !== page.name ? problem : undefined}
          onValue={setName}
        />
        <DialogActions
          error={
            renaming.error !== null && !isConflict(renaming.error)
              ? renaming.error
              : null
          }
          pending={renaming.isPending}
          label="Rename"
          onCancel={onCancel}
        />
      </Stack>
    </form>
  );
}

export function RenamePageDialog({
  page,
  onClose,
  onRenamed,
}: {
  // The page being renamed, while the dialog is open.
  page: Page | undefined;
  onClose: () => void;
  onRenamed: (page: Page, changeSetId: string | null) => void;
}) {
  // The page stays set while the dialog closes, so its name doesn't vanish mid-animation.
  const [shown, setShown] = useState(page);
  const [busy, setBusy] = useState(false);
  if (page !== undefined && page !== shown) setShown(page);
  return (
    <Modal
      opened={page !== undefined}
      onClose={onClose}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
      returnFocus={false}
      title="Rename page"
    >
      {shown && (
        <RenameForm
          key={shown.id}
          page={shown}
          onCancel={onClose}
          onRenamed={onRenamed}
          onBusy={setBusy}
        />
      )}
    </Modal>
  );
}
