// SPDX-License-Identifier: Apache-2.0

// The dialog that asks before approving or rejecting drafts, showing what the decision covers, and
// saves the decision.

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
import { planChoicesQuery, projectPlanQuery } from "./projects.ts";
import { useState } from "react";
import { CountedList } from "./counted-list.tsx";
import { DialogActions } from "./dialog-actions.tsx";
import { focusRefusedSoon } from "./focus.ts";
import {
  approveDrafts,
  type DraftSelection,
  draftTotal,
  rejectDrafts,
} from "./drafts.ts";
import { type Decision } from "./draft-decisions.ts";
import { effortConversionsQuery } from "./effort.ts";
import { featureTeamsQuery } from "./feature-teams.ts";
import { listsQuery } from "./lists.ts";
import { notifySuccess } from "./notices.tsx";
import { orgChartQuery } from "./org-chart.ts";
import { count } from "./numbers.ts";
import { peopleQuery } from "./people.ts";
import { planningSettingsQuery } from "./planning-settings.ts";
import { releaseStreamsQuery } from "./releases.ts";

// What a decision did, as its notification says.
const decided = (asking: "approve" | "reject", total: number) =>
  `${asking === "approve" ? "Approved" : "Rejected"} ${drafts(total)}.`;

// How many drafts approving all those waiting left for another approver, as a sentence.
const othersLeftWords = (total: number) =>
  `${total === 1 ? "1 needs" : `${count(total)} need`} another approver.`;

// Drafts by name, one to a line; two drafts may share a name.
function DraftNameList({
  names,
  mt = 0,
}: {
  names: readonly string[];
  mt?: number;
}) {
  return (
    <List size="sm" mt={mt}>
      {names.map((name, index) => (
        <List.Item key={`${String(index)} ${name}`}>{name}</List.Item>
      ))}
    </List>
  );
}

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
  named,
  included,
  leftOut,
  othersLeft,
  onDone,
  onCancel,
  onBusy,
}: {
  asking: Asking;
  selection: DraftSelection;
  named: string[];
  included: string[];
  leftOut: number;
  othersLeft: string[];
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
          : [
              decided(asking, draftTotal(selection)),
              ...(othersLeft.length > 0
                ? [othersLeftWords(othersLeft.length)]
                : []),
            ].join(" "),
      );
      onDone();
      // Every read a decided draft may be in, on every day each is read for.
      await Promise.all(
        [
          peopleQuery.queryKey,
          listsQuery.queryKey,
          projectPlanQuery.queryKey,
          planChoicesQuery.queryKey,
          releaseStreamsQuery.queryKey,
          featureTeamsQuery.queryKey,
          orgChartQuery.queryKey,
          ["changes"],
          planningSettingsQuery.queryKey,
          effortConversionsQuery.queryKey,
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
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
        else focusRefusedSoon(event.currentTarget);
      }}
    >
      <Stack gap="md">
        <Text fz="sm">
          {asking === "approve"
            ? "Approving cannot be undone."
            : "The drafts go back to whoever made them, with the reason given. Rejecting cannot be undone."}
        </Text>
        {named.length > 0 && (
          <CountedList
            items={named.map((name, index) => ({
              key: `${String(index)} ${name}`,
              name,
            }))}
          />
        )}
        {included.length > 0 && (
          <div>
            <Text fz="sm">
              {asking === "approve"
                ? "Also approves the drafts these depend on:"
                : "Also rejects the drafts that use these:"}
            </Text>
            <DraftNameList names={included} mt={4} />
          </div>
        )}
        {leftOut > 0 && (
          <Text fz="sm">
            {leftOut === 1
              ? "1 draft is skipped because it depends on a rejected draft."
              : `${count(leftOut)} drafts are skipped because they depend on rejected drafts.`}
          </Text>
        )}
        {othersLeft.length > 0 && (
          <div>
            <Text fz="sm">
              {othersLeft.length === 1
                ? "This needs another approver and stays waiting:"
                : "These need another approver and stay waiting:"}
            </Text>
            <DraftNameList names={othersLeft} mt={4} />
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
            error={tried && missing ? "Reason needed" : undefined}
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
      <DraftNameList names={names} />
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
            named={decision.named}
            included={decision.included ?? []}
            leftOut={decision.leftOut ?? 0}
            othersLeft={decision.othersLeft ?? []}
            onDone={onDone}
            onCancel={onClose}
            onBusy={setBusy}
          />
        )}
    </Modal>
  );
}
