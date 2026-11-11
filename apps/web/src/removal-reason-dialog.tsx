// SPDX-License-Identifier: Apache-2.0

// Asks for the optional reason for removing features from proposals, before the change is saved, or
// for a new reason while the removal is a draft. It only collects the reason: whoever opens it
// saves the change.

import { allOf, projectLengths } from "@fathom/shared";
import { Modal, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { ClearableInput } from "./clearable-input.tsx";
import { DialogActions } from "./dialog-actions.tsx";
import { useDiscardQuestion } from "./discard-question.tsx";
import pages from "./pages.module.css";
import type { ProposalRemoval } from "./proposal-removal.ts";

export interface ReasonAsked {
  removal: ProposalRemoval;
  // The reason given before, when changing it.
  reason?: string | undefined;
  // Whether it changes the reason given before, rather than asking for one with the change.
  changing: boolean;
  onSave: (reason: string | null) => void;
}

// The dialog, which holds the reason as typed, starting afresh each time a reason is asked for.
// Leaving it with the reason changed, by Cancel, Esc, or its close button, asks first. It stays
// mounted while closed, so closing puts focus back where it was.
export function RemovalReasonModal({
  asked,
  onClose,
}: {
  asked: ReasonAsked | undefined;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(asked);
  const [reason, setReason] = useState(asked?.reason ?? "");
  if (asked !== shown) {
    setShown(asked);
    setReason(asked?.reason ?? "");
  }
  const question = useDiscardQuestion();
  const leave = () => {
    question.ask(
      reason === (asked?.reason ?? "")
        ? undefined
        : { title: "Discard the reason?", keep: "Keep writing" },
      onClose,
    );
  };
  const save = () => {
    onClose();
    asked?.onSave(reason.trim() === "" ? null : reason.trim());
  };
  const features = asked?.removal.features ?? [];
  return (
    <Modal
      opened={asked !== undefined}
      onClose={leave}
      closeOnEscape={!question.asking}
      title={
        asked?.changing === true
          ? "Change the reason for the removal"
          : "Reason for the removal"
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Stack gap="md">
          <Text fz="sm">
            {allOf(features)} {features.length === 1 ? "is" : "are"} removed
            from {allOf(asked?.removal.proposals ?? [])}.
          </Text>
          <ClearableInput
            label={
              <>
                Reason <span className={pages.optional}>(optional)</span>
              </>
            }
            maxLength={projectLengths.removalReason}
            value={reason}
            onChange={(event) => {
              setReason(event.currentTarget.value);
            }}
            onClear={() => {
              setReason("");
            }}
            clearLabel="Clear the reason"
            data-autofocus
          />
          <DialogActions
            error={null}
            pending={false}
            label="Save"
            onCancel={leave}
          />
        </Stack>
      </form>
      {question.dialog}
    </Modal>
  );
}
