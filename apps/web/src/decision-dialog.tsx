// SPDX-License-Identifier: Apache-2.0

// Approving or rejecting drafts, from the Drafts page, the People table, or the Lists page: a dialog
// that asks first, since neither can be undone, names any other drafts an approval includes, and
// asks for a reason for rejecting. It saves the decision itself, and cannot be closed while it saves.

import { reasonLength } from "@fathom/shared";
import { List, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DialogActions } from "./dialog-actions.tsx";
import {
  approveDrafts,
  type DraftSelection,
  draftTotal,
  rejectDrafts,
} from "./drafts.ts";
import { listsQuery } from "./lists.ts";
import { notifySuccess } from "./notices.tsx";
import { count } from "./numbers.ts";
import { peopleQuery } from "./people.ts";

// What a decision did, as its notification says.
const decided = (asking: "approve" | "reject", total: number) =>
  `${asking === "approve" ? "Approved" : "Rejected"} ${drafts(total)}.`;

// Why a decision changed nothing: rejected drafts already rejected for that reason, or, rarely,
// drafts that no longer change anything, such as a change to someone removed another way.
const unchanged = (asking: "approve" | "reject") =>
  asking === "reject"
    ? "Nothing changed: those drafts were already rejected for that reason."
    : "Nothing changed: those drafts no longer change anything.";

// A number of drafts in words, such as "3 drafts".
export const drafts = (total: number) =>
  total === 1 ? "1 draft" : `${count(total)} drafts`;

export type Asking = "approve" | "reject";

// Asks before approving or rejecting the drafts selected, with a reason for rejecting them.
function DecisionDialog({
  asking,
  selection,
  included,
  onDone,
  onCancel,
  onBusy,
}: {
  asking: Asking;
  selection: DraftSelection;
  included: string[];
  onDone: () => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const deciding = useMutation({
    mutationFn: () =>
      asking === "approve"
        ? approveDrafts(selection)
        : rejectDrafts(selection, reason.trim()),
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
    onSuccess: async (changeSetId) => {
      notifySuccess(
        changeSetId === null
          ? unchanged(asking)
          : decided(asking, draftTotal(selection)),
      );
      onDone();
      await queryClient.invalidateQueries({ queryKey: peopleQuery.queryKey });
      await queryClient.invalidateQueries({ queryKey: listsQuery.queryKey });
      await queryClient.invalidateQueries({ queryKey: ["changes"] });
    },
  });
  const missing = asking === "reject" && reason.trim() === "";
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (!missing) deciding.mutate();
      }}
    >
      <Stack gap="md">
        <Text fz="sm">
          {asking === "approve"
            ? "What the drafts change becomes live. Approving cannot be undone."
            : "The drafts stay, marked Rejected with your reason, until someone changes or discards them. Rejecting cannot be undone."}
        </Text>
        {included.length > 0 && (
          <div>
            <Text fz="sm">
              {asking === "approve"
                ? "These drafts use others, which are approved too:"
                : "Other drafts use these, so they are rejected too:"}
            </Text>
            <List size="sm" mt={4}>
              {included.map((name) => (
                <List.Item key={name}>{name}</List.Item>
              ))}
            </List>
          </div>
        )}
        {asking === "reject" && (
          <Textarea
            label="Reason"
            required
            autosize
            minRows={2}
            maxLength={reasonLength}
            value={reason}
            error={tried && missing ? "Give a reason" : undefined}
            onChange={(event) => {
              setReason(event.currentTarget.value);
            }}
            data-autofocus
          />
        )}
        <DialogActions
          error={deciding.error}
          pending={deciding.isPending}
          label={asking === "approve" ? "Approve" : "Reject"}
          onCancel={onCancel}
        />
      </Stack>
    </form>
  );
}

// The drafts to approve or reject once asked: those chosen, with any others the decision includes,
// which are named.
export interface Decision {
  asking: Asking;
  selection: DraftSelection;
  included?: string[];
}

export function DecisionModal({
  decision,
  opened,
  onClose,
  onDone,
}: {
  decision: Decision | undefined;
  opened: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const total = decision === undefined ? 0 : draftTotal(decision.selection);
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
      title={`${decision?.asking === "reject" ? "Reject" : "Approve"} ${drafts(total)}?`}
    >
      {decision && (
        <DecisionDialog
          asking={decision.asking}
          selection={decision.selection}
          included={decision.included ?? []}
          onDone={onDone}
          onCancel={onClose}
          onBusy={setBusy}
        />
      )}
    </Modal>
  );
}
