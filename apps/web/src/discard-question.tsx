// SPDX-License-Identifier: Apache-2.0

// Asking whether to discard what is being written before leaving it.

import { Button, Group, Modal } from "@mantine/core";
import { useState } from "react";

export const newRecordQuestion = (thing: string) => ({
  title: `Discard the new ${thing}?`,
  keep: "Keep adding",
});

// Asking whether to discard what is being written before showing another record or adding one: a
// note changed, or a record being added that holds something. Discard goes on; Keep writing, or
// closing the question, stays.

export function useDiscardQuestion() {
  const [asking, setAsking] = useState<{
    title: string;
    keep: string;
    go: () => void;
  }>();
  const ask = (
    question: { title: string; keep: string } | undefined,
    go: () => void,
  ) => {
    if (question === undefined) go();
    else setAsking({ ...question, go });
  };
  const close = () => {
    setAsking(undefined);
  };
  const dialog = (
    <Modal
      opened={asking !== undefined}
      onClose={close}
      title={asking?.title}
      size="sm"
    >
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={close} data-autofocus>
          {asking?.keep}
        </Button>
        <Button
          color="red"
          onClick={() => {
            asking?.go();
            close();
          }}
        >
          Discard
        </Button>
      </Group>
    </Modal>
  );
  // Whether the question is showing, so a dialog under it leaves Esc to it.
  return { ask, dialog, asking: asking !== undefined };
}
