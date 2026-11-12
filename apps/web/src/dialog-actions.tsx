// SPDX-License-Identifier: Apache-2.0

// The buttons at the foot of a dialog that changes something, with any other actions it offers on
// the left or beside Cancel, and why the change it asked for was refused. Cancelling is not
// possible while the change is being saved. Also, what a dialog is open for, which is kept while
// its modal closes.

import { Alert, Button, Group } from "@mantine/core";
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
