// SPDX-License-Identifier: Apache-2.0

// The notifications that report the result of a change, at the top right of every page. A success
// is announced politely and goes after a few seconds, a little later when it offers Undo. Only the
// latest change can be undone, so a newer change closes an older notification's Undo. A failure is
// announced at once and stays until closed.

import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";

const successSeconds = 5;
const undoSeconds = 8;

// The notification whose Undo is still offered, if any.
let undoNotice: string | undefined;

export function notifySuccess(message: string): void {
  notifications.show({
    message,
    color: "green",
    role: "status",
    autoClose: successSeconds * 1000,
  });
}

// Closes the notification offering Undo for an earlier change, which no longer applies.
export function closeUndoNotice(): void {
  if (undoNotice !== undefined) notifications.hide(undoNotice);
  undoNotice = undefined;
}

export function notifyUndoable(message: string, undo: () => void): void {
  closeUndoNotice();
  const id = notifications.show({
    message: (
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text fz="sm">{message}</Text>
        <Button
          size="compact-sm"
          variant="default"
          onClick={() => {
            closeUndoNotice();
            undo();
          }}
        >
          Undo
        </Button>
      </Group>
    ),
    color: "green",
    role: "status",
    autoClose: undoSeconds * 1000,
  });
  undoNotice = id;
}

export function notifyFailure(message: string): void {
  notifications.show({
    message,
    color: "red",
    role: "alert",
    autoClose: false,
  });
}
