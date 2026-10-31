// SPDX-License-Identifier: Apache-2.0

// The buttons at the foot of a dialog that changes something, and why the change it asked for was
// refused. Cancelling is not possible while the change is being saved.

import { Alert, Button, Group } from "@mantine/core";
import { describeProblem } from "./api.ts";

export function DialogActions({
  error,
  pending,
  label,
  onCancel,
  danger = false,
}: {
  error: Error | null;
  pending: boolean;
  label: string;
  onCancel: () => void;
  // Red, for changes that remove something.
  danger?: boolean;
}) {
  return (
    <>
      {error && (
        <Alert color="red" role="alert">
          {describeProblem(
            error,
            "Fathom could not make this change. Try again in a moment.",
          )}
        </Alert>
      )}
      <Group justify="flex-end">
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
          {...(danger ? { color: "red" } : {})}
        >
          {label}
        </Button>
      </Group>
    </>
  );
}
