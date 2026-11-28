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
import {
  pageNameProblem,
  privatePageQuery,
  privatePagesQuery,
  renamePrivatePage,
} from "./private-pages.ts";

type Page = Pick<ListedPrivatePage, "id" | "name">;

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
        // The same name changes nothing, so nothing is sent.
        if (name.trim() === page.name) {
          onCancel();
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
          error={tried || name !== "" ? problem : undefined}
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
  opened,
  onClose,
  onRenamed,
}: {
  // The page being renamed, kept while the dialog closes.
  page: Page | undefined;
  opened: boolean;
  onClose: () => void;
  onRenamed: (page: Page, changeSetId: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
      returnFocus={false}
      title="Rename page"
    >
      {page && (
        <RenameForm
          key={page.id}
          page={page}
          onCancel={onClose}
          onRenamed={onRenamed}
          onBusy={setBusy}
        />
      )}
    </Modal>
  );
}
