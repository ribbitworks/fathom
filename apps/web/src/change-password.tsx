// SPDX-License-Identifier: Apache-2.0

// The dialog in which users change their own password, giving their current one, opened from their
// account's menu. Changing it signs out their other sessions, such as on another computer, which
// the notification says once it is done.

import { passwordChangeSchema } from "@fathom/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal, PasswordInput, Stack } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "./api.ts";
import { changePassword } from "./accounts.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { notifySuccess } from "./notices.tsx";

const formSchema = passwordChangeSchema
  .extend({ repeated: z.string() })
  .refine((values) => values.newPassword === values.repeated, {
    path: ["repeated"],
  });

type FormValues = z.infer<typeof formSchema>;

// A wrong current password is named under its field, which takes the focus; other problems are put as
// every dialog puts them.
const isWrongPassword = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "INVALID_PASSWORD";

function PasswordForm({
  onDone,
  onBusy,
}: {
  onDone: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: "", newPassword: "", repeated: "" },
  });
  const { errors } = form.formState;
  // The passwords sent are not kept once the change is done.
  const changing = useMutation({
    gcTime: 0,
    mutationFn: ({ currentPassword, newPassword }: FormValues) =>
      changePassword({ currentPassword, newPassword }),
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
    onError: (error) => {
      if (isWrongPassword(error)) {
        form.setError(
          "currentPassword",
          { type: "server", message: "Your current password is not right." },
          { shouldFocus: true },
        );
      }
    },
    onSuccess: () => {
      notifySuccess(
        "Your password has been changed, and you have been signed out everywhere else.",
      );
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
        <PasswordInput
          label="Current password"
          autoComplete="current-password"
          data-autofocus
          error={
            errors.currentPassword &&
            (errors.currentPassword.type === "server"
              ? errors.currentPassword.message
              : "Enter your current password.")
          }
          {...form.register("currentPassword")}
        />
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          error={errors.newPassword && "Use 12 to 128 characters."}
          {...form.register("newPassword")}
        />
        <PasswordInput
          label="New password again"
          autoComplete="new-password"
          error={errors.repeated && "The new passwords do not match."}
          {...form.register("repeated")}
        />
        <DialogActions
          error={isWrongPassword(changing.error) ? null : changing.error}
          pending={changing.isPending}
          label="Change password"
          onCancel={onDone}
        />
      </Stack>
    </form>
  );
}

export function ChangePasswordDialog({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  // It cannot be closed while saving, so the user always learns whether the password changed. Its
  // form starts afresh each time it opens, since the dialog's content is removed once it has closed.
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
      title="Change password"
    >
      <PasswordForm onDone={onClose} onBusy={setBusy} />
    </Modal>
  );
}
