// SPDX-License-Identifier: Apache-2.0

// The dialog in which users change the name their account shows, opened from their account's menu.
// Their email address and roles stay with Administrators, since the email address signs them in.

import { ownNameSchema } from "@fathom/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal, Stack, TextInput } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { changeOwnName, nameProblem } from "./accounts.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { notifySuccess } from "./notices.tsx";
import { sessionQuery } from "./session.ts";

type FormValues = z.infer<typeof ownNameSchema>;

function NameForm({
  name,
  onDone,
  onBusy,
}: {
  name: string;
  onDone: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(ownNameSchema),
    defaultValues: { name },
  });
  const { errors } = form.formState;
  // The rest of Fathom, such as the top bar, then shows the new name.
  const changing = useMutation({
    mutationFn: changeOwnName,
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
      await router.invalidate();
      notifySuccess("The name has been changed.");
      onDone();
    },
  });
  return (
    <form
      noValidate
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          changing.mutate(values);
        })(event)
      }
    >
      <Stack>
        <TextInput
          label="Name"
          description="How Fathom shows this account to others. Only an Administrator can change the email address."
          autoComplete="name"
          data-autofocus
          error={nameProblem(errors.name, "Name needed")}
          {...form.register("name")}
        />
        <DialogActions
          error={changing.error}
          pending={changing.isPending}
          label="Save"
          onCancel={onDone}
        />
      </Stack>
    </form>
  );
}

export function ChangeNameDialog({
  name,
  opened,
  onClose,
}: {
  name: string;
  opened: boolean;
  onClose: () => void;
}) {
  // It cannot be closed while saving, so a refusal is always seen. Its form starts afresh each time
  // it opens, since the dialog's content is removed once it has closed.
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
      title="Change name"
    >
      <NameForm name={name} onDone={onClose} onBusy={setBusy} />
    </Modal>
  );
}
