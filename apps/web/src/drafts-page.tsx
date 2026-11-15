// SPDX-License-Identifier: Apache-2.0

// The Drafts page: every draft the user may see, of people, planned hires, People's columns, lists,
// choices, the order of lists' choices and of People's columns, the plan's records, such as release
// streams, and the planning settings, newest first, each a sentence saying who drafted what, with
// what it changes from its live value, and rejected drafts marked with their reason. A search
// narrows them. Approvers select drafts, one or several at once, and approve or reject them, as
// they can on the People table and the Lists page too. Approving or rejecting names any other
// drafts it includes.

import { matchesWords, searchWords, type Asking } from "@fathom/shared";
import {
  Button,
  Checkbox,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { type ReactNode, useState } from "react";
import { DecisionModal, drafts } from "./decision-dialog.tsx";
import {
  type DraftsSeen,
  type Entry,
  toDecide,
  useDraftEntries,
} from "./draft-entries.ts";
import { type Decision, decisionFor, joined, noDrafts } from "./drafts.ts";
import { EntryDetails, EntryList, EntryRow } from "./history-entries.tsx";
import { HistorySearch } from "./history-search.tsx";
import { LoadProblem } from "./load-problem.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { PhraseList } from "./phrase.tsx";
import { DraftedItem } from "./status-mark.tsx";

function DraftEntry({
  shown,
  waits,
  selection,
}: {
  shown: Entry;
  waits: boolean;
  // Absent for users who may not approve.
  selection?: { selected: boolean; onSelect: (selected: boolean) => void };
}) {
  return (
    <EntryRow
      at={shown.madeAt}
      lead={
        selection && (
          <Checkbox
            mt={2}
            aria-label={`Select the draft of ${shown.subject}`}
            // A rejected draft is back with its makers until they resubmit it, and a draft that
            // depends on it waits too.
            disabled={
              shown.state === "rejected" ||
              waits ||
              shown.unpublished ||
              shown.heldBy !== undefined
            }
            checked={selection.selected}
            onChange={(event) => {
              selection.onSelect(event.currentTarget.checked);
            }}
          />
        )
      }
    >
      <Text fz="sm">
        <DraftedItem
          // The reason has a line of its own under the sentence, so the dot leaves it out.
          draft={{
            action: shown.action,
            state: shown.state,
            unpublished: shown.unpublished,
          }}
          heldBy={shown.heldBy}
          slot
        >
          <Text span inherit fw={600}>
            {shown.who}
          </Text>{" "}
          {shown.verb}{" "}
          <Text span inherit fw={600}>
            {shown.subject}
          </Text>
          {shown.details.length > 0 && (
            <EntryDetails>
              <PhraseList phrases={shown.details} />
            </EntryDetails>
          )}
        </DraftedItem>
      </Text>
      {shown.reason !== undefined && (
        <Text fz="xs" c="dimmed">
          Reason: {shown.reason}
        </Text>
      )}
      {waits && (
        <Text fz="xs" c="dimmed">
          Waiting for a rejected draft to be resubmitted
        </Text>
      )}
    </EntryRow>
  );
}

export function DraftsPage({
  approves,
  seesPeople = true,
  seesLists = true,
  seesPlan = true,
  seesTeams = false,
  seesProjects = seesPlan,
  seesSettings = false,
  search,
  onSearch,
}: Pick<DraftsSeen, "approves"> &
  Partial<Omit<DraftsSeen, "approves">> & {
    search: string;
    onSearch: (search: string, replace: boolean) => void;
  }) {
  const entries = useDraftEntries({
    approves,
    seesPeople,
    seesLists,
    seesPlan,
    seesTeams,
    seesProjects,
    seesSettings,
  });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [decision, setDecision] = useState<Decision>();
  const [opened, setOpened] = useState(false);

  let content: ReactNode;
  if (entries.state === "loading") {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (entries.state === "failed") {
    content = <LoadProblem what="the drafts" onRetry={entries.retry} />;
  } else {
    const { all, waits, choosable, drafted } = entries;
    const words = searchWords(search);
    const shown = all.filter(({ text }) => matchesWords(text, words));
    const waiting = toDecide(shown, entries);
    const chosen = waiting.filter(({ key }) => selected.has(key));
    const othersApprove = chosen.filter(
      ({ needsOtherApprover }) => needsOtherApprover,
    ).length;
    const ask = (asking: Asking) => {
      const selection = chosen.reduce(
        (all, { selects }) => joined(all, selects),
        noDrafts(),
      );
      setDecision(
        decisionFor(
          asking,
          selection,
          approves,
          drafted.lists,
          drafted.columns,
        ),
      );
      setOpened(true);
    };
    content = (
      <>
        {shown.some(choosable) && (
          <Group justify="space-between">
            <Checkbox
              label="Select all waiting"
              checked={waiting.length > 0 && chosen.length === waiting.length}
              indeterminate={
                chosen.length > 0 && chosen.length < waiting.length
              }
              disabled={waiting.length === 0}
              onChange={(event) => {
                setSelected(
                  new Set(
                    event.currentTarget.checked
                      ? waiting.map(({ key }) => key)
                      : [],
                  ),
                );
              }}
            />
            <Group gap="xs">
              <Button
                variant="default"
                disabled={chosen.length === 0}
                onClick={() => {
                  ask("reject");
                }}
              >
                Reject…
              </Button>
              <Button
                disabled={chosen.length === 0 || othersApprove > 0}
                onClick={() => {
                  ask("approve");
                }}
              >
                {chosen.length === 0
                  ? "Approve…"
                  : `Approve ${drafts(chosen.length)}…`}
              </Button>
            </Group>
          </Group>
        )}
        {othersApprove > 0 && (
          <Text fz="sm" c="dimmed" role="status">
            {othersApprove === 1
              ? "1 chosen draft was changed by this account, so another approver must approve it."
              : `${String(othersApprove)} chosen drafts were changed by this account, so another approver must approve them.`}
          </Text>
        )}
        <Paper withBorder className={classes.tablePanel}>
          {shown.length === 0 && (
            <Text p="md" fz="sm" c="dimmed">
              {all.length === 0
                ? "No drafts waiting for approval."
                : "No drafts match the search."}
            </Text>
          )}
          <EntryList>
            {shown.map((one) => (
              <DraftEntry
                key={one.key}
                shown={one}
                waits={waits(one)}
                {...(choosable(one)
                  ? {
                      selection: {
                        selected: selected.has(one.key),
                        onSelect: (on: boolean) => {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (on) next.add(one.key);
                            else next.delete(one.key);
                            return next;
                          });
                        },
                      },
                    }
                  : {})}
              />
            ))}
          </EntryList>
        </Paper>
        <DecisionModal
          decision={decision}
          opened={opened}
          onClose={() => {
            setOpened(false);
          }}
          onDone={() => {
            setOpened(false);
            setSelected(new Set());
          }}
        />
      </>
    );
  }

  return (
    <Stack gap="md">
      <PageHeader title="Drafts" />
      <HistorySearch
        label="Search drafts"
        search={search}
        onSearch={onSearch}
      />
      {content}
    </Stack>
  );
}
