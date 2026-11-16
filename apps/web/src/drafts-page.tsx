// SPDX-License-Identifier: Apache-2.0

// The Drafts page: every draft the user may see, of people, planned hires, People's columns, lists,
// choices, the order of lists' choices and of People's columns, the plan's records, such as release
// streams, and the planning settings, a row for each on the shared table, newest first, its view
// saved as any table's is. Approvers tick drafts, one or several at once, and approve or reject
// them, or decide one from its row's menu, as they can on the People table and the Lists page too.
// Approving or rejecting names any other drafts it includes.

import { type Asking } from "@fathom/shared";
import { Button, Loader, Stack, Text } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { DecisionModal, drafts } from "./decision-dialog.tsx";
import { type DraftsSeen, useDraftEntries } from "./draft-entries.ts";
import { type Decision, decisionFor, type DraftSelection } from "./drafts.ts";
import {
  draftColumnOrder,
  type DraftRow,
  draftRows,
  draftsTable,
  mineToDecide,
  mineToDecideChoice,
  selectionOf,
} from "./drafts-table.tsx";
import { LoadProblem } from "./load-problem.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { noRecordActions, RecordGrid } from "./record-grid.tsx";
import { withTicks } from "./row-ticks.tsx";
import { useSavedViews } from "./saved-views.tsx";
import { TableTips } from "./table-tips.tsx";
import type { View } from "./table-view.ts";

const draftsKey = ["drafts"] as const;

export function DraftsPage({
  approves,
  seesPeople = true,
  seesLists = true,
  seesPlan = true,
  seesTeams = false,
  seesProjects = seesPlan,
  seesSettings = false,
  view,
  onView,
  applied,
  onApply,
  canShareViews = false,
}: Pick<DraftsSeen, "approves"> &
  Partial<Omit<DraftsSeen, "approves">> & {
    view: View;
    onView: (view: View, replace?: boolean) => void;
    // The saved view the view started from, as the address names it.
    applied: string | undefined;
    onApply: (view: View, id: string, replace?: boolean) => void;
    canShareViews?: boolean;
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
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [decision, setDecision] = useState<Decision>();
  const [opened, setOpened] = useState(false);
  const views = useSavedViews({
    table: "drafts",
    within: draftsKey,
    applied,
    onApply,
    canShare: canShareViews,
    blocked: opened,
  });

  let content: ReactNode;
  if (entries.state === "loading") {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (entries.state === "failed") {
    content = <LoadProblem what="the drafts" onRetry={entries.retry} />;
  } else {
    const { all, drafted } = entries;
    const rows = draftRows(all, entries);
    // Whether the reader may decide a row's draft now.
    const decidable = (row: DraftRow) => entries.decidesNow(row.entry);
    const mine = view.choices?.decide === mineToDecide;
    const shown = mine ? rows.filter(decidable) : rows;
    const table = draftsTable({ rows, decidable });
    const decide = (asking: Asking, selection: DraftSelection) => {
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
    // Offered to those who decide drafts, and to anyone a link gave it to, so it can be turned off.
    const choices =
      approves.length === 0 && !mine
        ? []
        : [mineToDecideChoice(rows.filter(decidable).length)];
    content = (
      <TableTips>
        <RecordGrid
          records={shown}
          table={table}
          fields={[]}
          order={draftColumnOrder}
          lists={[]}
          canEdit={false}
          canAdd={false}
          rowActions={false}
          approves={approves}
          canEditColumns={false}
          actions={noRecordActions<DraftRow, never, undefined>(decide)}
          view={view}
          onView={onView}
          saved={views.saved}
          withDrafts={false}
          viewChoices={choices}
          ticks={
            approves.length === 0
              ? undefined
              : {
                  ticked,
                  onTick: (ids, on) => {
                    setTicked((current) => withTicks(current, ids, on));
                  },
                  tickable: decidable,
                  label: (row) => `Select the draft of ${row.record}`,
                  allLabel: "Select all drafts this role can decide",
                  actions: (chosen) => {
                    const othersApprove = chosen.filter(
                      ({ entry }) => entry.needsOtherApprover,
                    ).length;
                    return (
                      <>
                        {othersApprove > 0 && (
                          <Text fz="sm" c="dimmed" role="status">
                            {othersApprove === 1
                              ? "1 chosen draft was changed by this account, so another approver must approve it."
                              : `${String(othersApprove)} chosen drafts were changed by this account, so another approver must approve them.`}
                          </Text>
                        )}
                        <Button
                          variant="default"
                          size="compact-sm"
                          disabled={chosen.length === 0}
                          onClick={() => {
                            decide("reject", selectionOf(chosen));
                          }}
                        >
                          Reject…
                        </Button>
                        <Button
                          size="compact-sm"
                          disabled={chosen.length === 0 || othersApprove > 0}
                          onClick={() => {
                            decide("approve", selectionOf(chosen));
                          }}
                        >
                          {chosen.length === 0
                            ? "Approve…"
                            : `Approve ${drafts(chosen.length)}…`}
                        </Button>
                      </>
                    );
                  },
                }
          }
        />
      </TableTips>
    );
  }

  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader title="Drafts" />
      {content}
      {views.dialogs}
      <DecisionModal
        decision={decision}
        opened={opened}
        onClose={() => {
          setOpened(false);
        }}
        onDone={() => {
          setOpened(false);
          setTicked(new Set());
        }}
      />
    </Stack>
  );
}
