// SPDX-License-Identifier: Apache-2.0

// Asking before a change that takes much away at once, such as removing a page with its rows or
// discarding what was typed: the button keeping it, such as Cancel, and the change's own in red.

import { Modal, Stack, Text } from "@mantine/core";
import { DialogActions, useDialogState } from "./dialog-actions.tsx";
import classes from "./removal-question.module.css";

export interface RemovalQuestion {
  title: string;
  // What else to know before choosing, such as that the removal can't be undone.
  detail?: string;
  action: string;
  // What keeping it says, where not Cancel, such as Keep adding.
  keep?: string;
}

interface Removed {
  kind: string;
  name: string;
}

export const removalQuestion = ({ kind, name }: Removed): RemovalQuestion => ({
  title: `Remove the ${name} ${kind}?`,
  action: "Remove",
});

export const removedWords = ({ kind, name }: Removed) =>
  `Removed the ${name} ${kind}.`;

export function useRemovalQuestion() {
  const {
    dialog: asking,
    opened,
    open,
    close,
  } = useDialogState<
    RemovalQuestion & { go: () => void; kept: (() => void) | undefined }
  >();
  // Removing goes on; otherwise, kept puts focus back where the question came from, where that
  // has gone, such as a menu's item.
  const ask = (
    question: RemovalQuestion,
    go: () => void,
    kept?: () => void,
  ) => {
    open({ ...question, go, kept });
  };
  const keep = () => {
    close();
    asking?.kept?.();
  };
  const dialog = (
    <Modal
      opened={opened}
      onClose={keep}
      returnFocus={asking?.kept === undefined}
      title={asking?.title}
      size="sm"
      classNames={{ body: classes.body }}
    >
      {asking && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            // Going on first, then closing, closes the question even where going on asks it again,
            // as leaving a dialog does.
            asking.go();
            close();
          }}
        >
          <Stack gap="md">
            {asking.detail !== undefined && (
              <Text fz="sm">{asking.detail}</Text>
            )}
            <DialogActions
              error={null}
              pending={false}
              label={asking.action}
              removes
              cancelFocused
              {...(asking.keep === undefined ? {} : { cancel: asking.keep })}
              onCancel={keep}
            />
          </Stack>
        </form>
      )}
    </Modal>
  );
  // Whether the question is showing, so Cmd+Z leaves the page alone meanwhile.
  return { ask, dialog, asking: opened };
}
