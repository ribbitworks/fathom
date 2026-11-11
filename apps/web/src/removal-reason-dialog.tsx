// SPDX-License-Identifier: Apache-2.0

// Asks for the optional reason for removing features from proposals, before the change is saved, or
// for a new reason while the removal is a draft. It only collects the reason: whoever opens it
// saves the change.

import { allOf, projectLengths } from "@fathom/shared";
import { Modal, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { ClearableInput } from "./clearable-input.tsx";
import { DialogActions } from "./dialog-actions.tsx";
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

function ReasonForm({
  asked,
  onClose,
}: {
  asked: ReasonAsked;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(asked.reason ?? "");
  const { features, proposals } = asked.removal;
  const save = (given: string) => {
    onClose();
    asked.onSave(given.trim() === "" ? null : given.trim());
  };
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save(reason);
      }}
    >
      <Stack gap="md">
        <Text fz="sm">
          {allOf(features)} {features.length === 1 ? "is" : "are"} removed from{" "}
          {allOf(proposals)}.
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
          onCancel={onClose}
        />
      </Stack>
    </form>
  );
}

export function RemovalReasonModal({
  asked,
  onClose,
}: {
  asked: ReasonAsked | undefined;
  onClose: () => void;
}) {
  return (
    <Modal
      opened={asked !== undefined}
      onClose={onClose}
      title={
        asked?.changing === true
          ? "Change the reason for the removal"
          : "Reason for the removal"
      }
    >
      {asked !== undefined && <ReasonForm asked={asked} onClose={onClose} />}
    </Modal>
  );
}
