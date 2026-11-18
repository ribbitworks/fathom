// SPDX-License-Identifier: Apache-2.0

// The Drafts page: every draft the user may see, of people, planned hires, People's columns, lists,
// choices, the order of lists' choices and of People's columns, the plan's records, such as release
// streams, and the planning settings, a row for each on the shared table, newest first, its view
// saved as any table's is, in two tabs: those for approval, and the reader's own unpublished
// changes. Approvers tick drafts, one or several at once, and approve or reject them, or decide one
// from its row's menu or its details beside the table, which link to its record on its own page.
// Approving or rejecting names any other drafts it includes.

import { type Asking } from "@fathom/shared";
import { Button, Loader, Stack, Tabs, Text } from "@mantine/core";
import { type ReactNode, useEffect, useState } from "react";
import { DecisionModal, drafts } from "./decision-dialog.tsx";
import { type DraftsSeen, useDraftEntries } from "./draft-entries.ts";
import type { DraftPlace } from "./draft-places.ts";
import { DraftPanel, draftPanelId } from "./drafts-panel.tsx";
import {
  type Decision,
  decisionFor,
  type DraftSelection,
  mayDecide,
} from "./drafts.ts";
import {
  draftColumnOrder,
  draftColumns,
  type DraftsTab,
  draftsTabNames,
  draftsTabOf,
  draftsTabs,
  draftsTabSchema,
  isOnTab,
  viewOnTab,
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
import {
  focusRecordCell,
  noRecordActions,
  RecordGrid,
} from "./record-grid.tsx";
import { withTicks } from "./row-ticks.tsx";
import { useSavedViews } from "./saved-views.tsx";
import { useNarrow } from "./side-panel.tsx";
import { TableTips } from "./table-tips.tsx";
import type { View } from "./table-view.ts";

const draftsKey = ["drafts"] as const;
const tabsId = "drafts-tabs";

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
  open,
  onOpen,
  recordLink,
}: Pick<DraftsSeen, "approves"> &
  Partial<Omit<DraftsSeen, "approves">> & {
    view: View;
    onView: (view: View, replace?: boolean) => void;
    // The saved view the view started from, as the address names it.
    applied: string | undefined;
    onApply: (view: View, id: string, replace?: boolean) => void;
    canShareViews?: boolean;
    // The draft whose details are shown beside the table, by its row.
    open: string | undefined;
    onOpen: (id: string | undefined, replace?: boolean) => void;
    // The link to a draft's record on its own page, for a role that opens that page.
    recordLink: (place: DraftPlace) => ReactNode;
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
  const narrow = useNarrow();
  const tab = draftsTabOf(view);
  const views = useSavedViews({
    table: "drafts",
    within: draftsKey,
    applied,
    onApply,
    canShare: canShareViews,
    blocked: opened,
  });

  let content: ReactNode;
  // How many drafts each tab holds, once they have loaded.
  let counts: Record<DraftsTab, number> | undefined;
  // Whether the draft the address opens is no longer listed, such as once decided.
  let openGone = false;
  if (entries.state === "loading") {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (entries.state === "failed") {
    content = <LoadProblem what="the drafts" onRetry={entries.retry} />;
  } else {
    const { all, drafted } = entries;
    const every = draftRows(all, entries);
    const rows = every.filter((row) => isOnTab(tab, row));
    counts = {
      approval: every.filter((row) => isOnTab("approval", row)).length,
      mine: every.filter((row) => isOnTab("mine", row)).length,
    };
    // Whether the reader may decide a row's draft now.
    const decidable = (row: DraftRow) => entries.decidesNow(row.entry);
    // One's own changes are never others' to decide, so My changes ignores it.
    const mine = tab === "approval" && view.choices?.decide === mineToDecide;
    const shown = mine ? rows.filter(decidable) : rows;
    const table = draftsTable({
      rows,
      decidable,
      tab,
      onOpen: (row) => {
        onOpen(row.id);
      },
    });
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
    // Offered to those who decide drafts, and to anyone a link gave it to, so it can be turned off;
    // one's own changes are never others' to decide.
    const choices =
      (approves.length === 0 || tab === "mine") && !mine
        ? []
        : [mineToDecideChoice(rows.filter(decidable).length)];
    const openRow = rows.find(({ id }) => id === open);
    openGone = open !== undefined && openRow === undefined;
    const closePanel = (id: string) => {
      focusRecordCell(id, "record");
      onOpen(undefined);
    };
    const panels =
      openRow === undefined
        ? []
        : [
            {
              key: "draft",
              id: draftPanelId,
              name: "the draft's details",
              node: (
                <DraftPanel
                  key={openRow.id}
                  row={openRow}
                  columns={draftColumns(rows, tab)}
                  related={entries.related(openRow.entry)}
                  waits={entries.waits(openRow.entry)}
                  approves={mayDecide(approves, openRow.entry.selects)}
                  actions={
                    decidable(openRow)
                      ? {
                          approve: () => {
                            decide("approve", openRow.entry.selects);
                          },
                          reject: () => {
                            decide("reject", openRow.entry.selects);
                          },
                        }
                      : undefined
                  }
                  narrow={narrow}
                  recordLink={recordLink(openRow.entry.place)}
                  onClose={() => {
                    closePanel(openRow.id);
                  }}
                />
              ),
            },
          ];
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
          panels={panels}
          withDrafts={false}
          viewChoices={choices}
          ticks={
            approves.length === 0 || tab === "mine"
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
                              ? "1 chosen draft needs another approver."
                              : `${String(othersApprove)} chosen drafts need another approver.`}
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

  useEffect(() => {
    if (openGone) onOpen(undefined, true);
  }, [openGone, onOpen]);

  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader
        title="Drafts"
        beside={
          <Tabs
            id={tabsId}
            value={tab}
            classNames={{
              list: classes.headingTabs,
              tab: classes.headingTab,
            }}
            onChange={(next) => {
              setTicked(new Set());
              onView(viewOnTab(view, draftsTabSchema.parse(next)));
            }}
          >
            <Tabs.List aria-label="Drafts shown">
              {draftsTabs.map((one) => (
                <Tabs.Tab
                  key={one}
                  value={one}
                  // Only the chosen tab's table is drawn, so only it has a panel to point at.
                  aria-controls={
                    one === tab ? `${tabsId}-panel-${one}` : undefined
                  }
                >
                  {/* The tab is always one of the fixed tabs. */}
                  {/* eslint-disable-next-line security/detect-object-injection */}
                  {draftsTabNames[one]}{" "}
                  {counts !== undefined && (
                    <Text span inherit c="dimmed">
                      {/* eslint-disable-next-line security/detect-object-injection */}
                      {counts[one]}
                    </Text>
                  )}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        }
      />
      {/* Named by its tab, whose id Mantine makes from the tabs' id. */}
      <div
        key={tab}
        role="tabpanel"
        id={`${tabsId}-panel-${tab}`}
        aria-labelledby={`${tabsId}-tab-${tab}`}
        className={classes.tabPanel}
      >
        {content}
      </div>
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
