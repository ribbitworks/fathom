// SPDX-License-Identifier: Apache-2.0

// The buttons at the foot of a dialog that changes something, with any other actions it offers on
// the left, and why the change it asked for was refused. Cancelling is not possible while the
// change is being saved.

import { Alert, Button, Group } from "@mantine/core";
import type { ReactNode } from "react";
import { describeProblem } from "./api.ts";

export function DialogActions({
  error,
  pending,
  label,
  onCancel,
  others,
}: {
  error: Error | null;
  pending: boolean;
  label: string;
  onCancel: () => void;
  others?: ReactNode;
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
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs">{others}</Group>
        <Group gap="xs">
          <Button
            variant="default"
            disabled={pending}
            onClick={() => {
              onCancel();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {label}
          </Button>
        </Group>
      </Group>
    </>
  );
}
