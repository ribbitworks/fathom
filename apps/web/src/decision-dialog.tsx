// SPDX-License-Identifier: Apache-2.0

// Approving or rejecting drafts, from the Drafts page, the People table, or the Lists page: a dialog
// that asks first, since neither can be undone, showing the decision drafts.ts works out: how many
// related drafts it includes, how many it skips because they depend on a rejected draft, that none
// can be approved yet, or which drafts this account changed and so needs another approver for. It
// asks for a reason for rejecting, saves the decision itself, and cannot be closed while it saves.

import { type Asking, reasonLength } from "@fathom/shared";
import {
  Button,
  Group,
  List,
  Modal,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectPlanQuery } from "./projects.ts";
import { useState } from "react";
import { DialogActions } from "./dialog-actions.tsx";
import {
  approveDrafts,
  type Decision,
  type DraftSelection,
  draftTotal,
  rejectDrafts,
} from "./drafts.ts";
import { effortConversionsQuery } from "./effort.ts";
import { listsQuery } from "./lists.ts";
import { notifySuccess } from "./notices.tsx";
import { count } from "./numbers.ts";
import { peopleQuery } from "./people.ts";
import { planningSettingsQuery } from "./planning-settings.ts";

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

// Asks before approving or rejecting the drafts selected, with a reason for rejecting them.
function DecisionDialog({
  asking,
  selection,
  included,
  leftOut,
  onDone,
  onCancel,
  onBusy,
}: {
  asking: Asking;
  selection: DraftSelection;
  included: string[];
  leftOut: number;
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
      await queryClient.invalidateQueries({
        queryKey: projectPlanQuery.queryKey,
      });
      await queryClient.invalidateQueries({ queryKey: ["changes"] });
      await queryClient.invalidateQueries({
        queryKey: planningSettingsQuery.queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: effortConversionsQuery.queryKey,
      });
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
            ? "Approving cannot be undone."
            : "The drafts go back to whoever made them, with the reason given. Rejecting cannot be undone."}
        </Text>
        {included.length > 0 && (
          <div>
            <Text fz="sm">
              {asking === "approve"
                ? "Also approves the drafts these depend on:"
                : "Also rejects the drafts that use these:"}
            </Text>
            <List size="sm" mt={4}>
              {included.map((name) => (
                <List.Item key={name}>{name}</List.Item>
              ))}
            </List>
          </div>
        )}
        {leftOut > 0 && (
          <Text fz="sm">
            {leftOut === 1
              ? "1 draft is skipped because it depends on a rejected draft."
              : `${count(leftOut)} drafts are skipped because they depend on rejected drafts.`}
          </Text>
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

// Drafts the user cannot decide, named under a sentence saying why.
function Undecided({
  why,
  names,
  onClose,
}: {
  why: string;
  names: readonly string[];
  onClose: () => void;
}) {
  return (
    <Stack gap="md">
      <Text fz="sm">{why}</Text>
      <List size="sm">
        {names.map((name) => (
          <List.Item key={name}>{name}</List.Item>
        ))}
      </List>
      <Group justify="flex-end">
        <Button onClick={onClose}>Close</Button>
      </Group>
    </Stack>
  );
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
  const verb = decision?.asking === "reject" ? "reject" : "approve";
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
      title={
        decision?.beyondRole || decision?.othersApprove
          ? "Another approver needed"
          : decision?.waiting
            ? "Can't approve yet"
            : `${decision?.asking === "reject" ? "Reject" : "Approve"} ${drafts(total)}?`
      }
    >
      {decision?.beyondRole && (
        <Undecided
          why={`This role can't ${verb} these drafts:`}
          names={decision.beyondRole}
          onClose={onClose}
        />
      )}
      {decision?.othersApprove && (
        <Undecided
          why="This account changed these drafts, so another approver must approve them:"
          names={decision.othersApprove}
          onClose={onClose}
        />
      )}
      {decision?.waiting && (
        <Stack gap="md">
          <Text fz="sm">Waiting for a rejected draft to be resubmitted.</Text>
          <Group justify="flex-end">
            <Button onClick={onClose}>Close</Button>
          </Group>
        </Stack>
      )}
      {decision &&
        !decision.waiting &&
        !decision.othersApprove &&
        !decision.beyondRole && (
          <DecisionDialog
            asking={decision.asking}
            selection={decision.selection}
            included={decision.included ?? []}
            leftOut={decision.leftOut ?? 0}
            onDone={onDone}
            onCancel={onClose}
            onBusy={setBusy}
          />
        )}
    </Modal>
  );
}
