// SPDX-License-Identifier: Apache-2.0

// A dialog's buttons and refusal, the modal it is shown in while saving, and what it is open for.

import { Alert, Button, Group, Modal, type ModalProps } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { describeProblem } from "./api.ts";

export function DialogActions({
  error,
  pending,
  label,
  onCancel,
  others,
  beforeCancel,
  removes = false,
  failure = "Fathom could not make this change. Try again in a moment.",
}: {
  error: Error | null;
  pending: boolean;
  label: string;
  onCancel: () => void;
  others?: ReactNode;
  // Other actions beside Cancel, for those that undo what the dialog has changed so far.
  beforeCancel?: ReactNode;
  // Whether the change deletes or deactivates something, which is shown in red.
  removes?: boolean;
  // What a failure says when the server gives no reason, for a dialog that changes nothing.
  failure?: string;
}) {
  return (
    <>
      {error && (
        <Alert color="red" role="alert">
          {describeProblem(error, failure)}
        </Alert>
      )}
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs">{others}</Group>
        <Group gap="xs">
          {beforeCancel}
          <Button
            variant="default"
            disabled={pending}
            onClick={() => {
              onCancel();
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={pending}
            {...(removes ? { color: "red" } : {})}
          >
            {label}
          </Button>
        </Group>
      </Group>
    </>
  );
}

// A modal that cannot be closed while its dialog is saving, so a refusal or the outcome is always
// seen. Its content either reports when saving starts and ends, or its owner says whether it is
// saving, such as from a mutation it already holds.
export function BusyModal({
  children,
  busy: given,
  closeOnClickOutside = true,
  ...modal
}: Omit<ModalProps, "children" | "closeOnEscape" | "withCloseButton"> &
  (
    | {
        busy?: undefined;
        children: (onBusy: (busy: boolean) => void, busy: boolean) => ReactNode;
      }
    | { busy: boolean; children: ReactNode }
  )) {
  const [reported, setReported] = useState(false);
  const busy = given ?? reported;
  return (
    <Modal
      {...modal}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy && closeOnClickOutside}
      withCloseButton={!busy}
    >
      {typeof children === "function" ? children(setReported, busy) : children}
    </Modal>
  );
}

// What a dialog is open for, such as the record it changes, and whether its modal is open. It stays
// set while the modal closes, so the dialog's content does not vanish mid-animation.
export function useDialogState<Subject>() {
  const [dialog, setDialog] = useState<Subject>();
  const [opened, setOpened] = useState(false);
  return {
    dialog,
    opened,
    open: (next: Subject) => {
      setDialog(next);
      setOpened(true);
    },
    close: () => {
      setOpened(false);
    },
    // Lets go of what the dialog was open for, once closed, such as a password never to be kept.
    forget: () => {
      setDialog(undefined);
    },
  };
}
