// SPDX-License-Identifier: Apache-2.0

// The Drafts page: every draft the user may see, on the shared table, under the To decide, Not
// published and All drafts tabs, where drafts are decided, published and discarded.

import {
  allOf,
  type Asking,
  draftKeysOf,
  type DraftsTab,
} from "@fathom/shared";
import { Button, Loader, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { DecisionModal, drafts } from "./decision-dialog.tsx";
import { type DraftsSeen, useDraftEntries } from "./draft-reading.ts";
import { type DraftPlace, placeKey } from "./draft-places.ts";
import { DraftPanel, draftPanelId } from "./drafts-panel.tsx";
import { useDraftsPageActions } from "./drafts-page-actions.ts";
import { type DraftSelection, linkedGroups } from "./drafts.ts";
import { type Decision, decisionFor } from "./draft-decisions.ts";
import {
  draftColumnOrder,
  draftColumns,
  draftsTabNames,
  draftsTabOf,
  isOnTab,
  tabsFor,
  viewOnTab,
  type DraftRow,
  draftRows,
  draftsTable,
  selectionOf,
} from "./drafts-table.tsx";
import { LoadProblem } from "./load-problem.tsx";
import { count } from "./numbers.ts";
import { HeadingTabPanel, HeadingTabs, PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { focusRecordCell } from "./grid-row.tsx";
import { RecordGrid } from "./record-grid.tsx";
import { noRecordActions } from "./record-table.ts";
import { withTicks } from "./row-ticks.tsx";
import { useSavedViews } from "./saved-views.tsx";
import { useNarrow } from "./side-panel.tsx";
import { TableTips } from "./table-tips.tsx";
import type { View } from "./table-view.ts";
import {
  changeCount,
  DiscardChangesModal,
  unpublishedQuery,
  useUnpublishedActions,
} from "./unpublished.tsx";

const draftsKey = ["drafts"] as const;

const tabsId = "drafts-tabs";

// The most linked changes a tick's tip names; the rest are counted.
const namedInTip = 3;

export function DraftsPage({
  approves,
  makesDrafts = true,
  seesPeople = true,
  seesLists = true,
  seesPlan = true,
  seesTeams = false,
  seesProjects = seesPlan,
  seesSettings = false,
  permissions = [],
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
    permissions,
  });
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [decision, setDecision] = useState<Decision>();
  const [opened, setOpened] = useState(false);
  // The changes chosen to discard, while asking first.
  const [discarding, setDiscarding] = useState<DraftRow[]>();
  // The reader's own changes as the server links them, grouped once for every row on the page.
  const unpublished = useQuery({ ...unpublishedQuery, enabled: makesDrafts });
  const groups = useMemo(
    () =>
      linkedGroups(
        new Map(
          (unpublished.data?.changes ?? []).map(({ key, linked }) => [
            key,
            linked,
          ]),
        ),
      ),
    [unpublished.data],
  );
  const sent = useUnpublishedActions(() => {
    setDiscarding(undefined);
    setTicked(new Set());
  });
  const narrow = useNarrow();
  const tabs = tabsFor(approves, makesDrafts);
  const tab = draftsTabOf(view, tabs);
  const views = useSavedViews({
    table: "drafts",
    within: draftsKey,
    view,
    applied,
    onApply,
    canShare: canShareViews,
    blocked: opened,
  });
  const ownDrafts = useDraftsPageActions({
    listed:
      entries.state === "loaded"
        ? entries.all.map(({ key }) => key)
        : undefined,
    blocked: opened || discarding !== undefined || views.opened,
  });

  let content: ReactNode;
  // What can be done with the rows ticked, among the page's actions in its heading.
  let actions: ReactNode;
  // How many drafts each tab holds, once they have loaded.
  let counts: ReadonlyMap<DraftsTab, number> | undefined;
  // Whether the draft the address opens is no longer listed, such as once decided.
  let openGone = false;
  if (entries.state === "loading") {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (entries.state === "failed") {
    content = <LoadProblem what="the drafts" onRetry={entries.retry} />;
  } else {
    const { all, drafted } = entries;
    const every = ownDrafts.shown(draftRows(all, entries));
    // Whether the reader may decide a row's draft now.
    const decidesNow = (row: DraftRow) => entries.decidesNow(row.entry);
    const rows = every.filter((row) => isOnTab(tab, row, decidesNow));
    counts = new Map(
      tabs.map((one) => [
        one,
        every.filter((row) => isOnTab(one, row, decidesNow)).length,
      ]),
    );
    // Drafts are decided on To decide; All drafts only lists them.
    const decidable = (row: DraftRow) => tab === "decide" && decidesNow(row);
    const table = draftsTable({
      rows,
      decidable,
      tab,
      onOpen: (row) => {
        onOpen(row.id);
      },
    });
    const decide = (
      asking: Asking,
      selection: DraftSelection,
      all?: boolean,
    ) => {
      setDecision(
        decisionFor(
          asking,
          selection,
          approves,
          drafted.lists,
          drafted.columns,
          all,
        ),
      );
      setOpened(true);
    };
    // The reader's own changes that must go with each, as the server links them, which are
    // published or discarded only together, in the table's order, worked out once for every row. A
    // change the page doesn't list, such as one of a kind this role can't read, isn't ticked.
    const rowsOfGroup = new Map<readonly string[], DraftRow[]>();
    for (const row of rows) {
      for (const key of draftKeysOf(row.entry.selects)) {
        const group = groups.get(key);
        if (group !== undefined) {
          rowsOfGroup.set(group, [...(rowsOfGroup.get(group) ?? []), row]);
        }
      }
    }
    const groupOf = (row: DraftRow): DraftRow[] => {
      const members = draftKeysOf(row.entry.selects).flatMap(
        (key) => rowsOfGroup.get(groups.get(key) ?? []) ?? [],
      );
      return members.length === 0 ? [row] : members;
    };
    const together = (given: readonly DraftRow[]): DraftRow[] => [
      ...new Set(given.flatMap(groupOf)),
    ];
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
                  linked={
                    tab === "unpublished"
                      ? together([openRow])
                          .filter(({ id }) => id !== openRow.id)
                          .map(({ id, record, entry }) => ({
                            id,
                            name: record,
                            key: placeKey(entry.place),
                            onShow: () => {
                              onOpen(id);
                            },
                          }))
                      : []
                  }
                  waits={entries.waits(openRow.entry)}
                  approves={entries.choosable(openRow.entry)}
                  unseen={entries.unseen(openRow.entry)}
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
    const chosen = rows.filter(
      (row) => ticked.has(row.id) && (tab === "unpublished" || decidable(row)),
    );
    // What approving the drafts ticked would do, so the button counts what the dialog approves.
    const approving =
      chosen.length > 0 && tab === "decide"
        ? decisionFor(
            "approve",
            selectionOf(chosen),
            approves,
            drafted.lists,
            drafted.columns,
            true,
          )
        : undefined;
    const ownOnly = approving?.othersApprove !== undefined;
    const othersApprove = ownOnly
      ? chosen.length
      : (approving?.othersLeft?.length ?? 0);
    if (chosen.length > 0 && tab === "unpublished") {
      actions = (
        <>
          <Button
            variant="default"
            disabled={sent.busy}
            onClick={() => {
              setDiscarding(chosen);
            }}
          >
            Discard {changeCount(chosen.length)}…
          </Button>
          <Button
            disabled={sent.discard.isPending}
            loading={sent.publish.isPending}
            onClick={() => {
              sent.publish.mutate(selectionOf(chosen));
            }}
          >
            Publish {changeCount(chosen.length)}
          </Button>
        </>
      );
    } else if (chosen.length > 0 && tab === "decide") {
      actions = (
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
            onClick={() => {
              decide("reject", selectionOf(chosen));
            }}
          >
            Reject…
          </Button>
          <Button
            disabled={ownOnly}
            onClick={() => {
              decide("approve", selectionOf(chosen), true);
            }}
          >
            Approve{" "}
            {drafts(ownOnly ? chosen.length : chosen.length - othersApprove)}…
          </Button>
        </>
      );
    }
    content = (
      <TableTips>
        <RecordGrid
          records={rows}
          table={table}
          fields={[]}
          order={draftColumnOrder}
          lists={[]}
          canEdit={false}
          canAdd={false}
          rowActions={false}
          approves={approves}
          canEditColumns={false}
          actions={{
            ...noRecordActions<DraftRow, never, undefined>(decide),
            discard: ownDrafts.discard,
            resubmit: ownDrafts.resubmit,
          }}
          // One's own unpublished changes go only with those linked to them, so are left to Not
          // published's buttons.
          canEditDrafts={(row) =>
            !row.entry.unpublished && row.entry.discardable
          }
          view={view}
          onView={onView}
          saved={views.saved}
          selected={open}
          closeSelected={closePanel}
          panels={panels}
          withDrafts={false}
          ticks={
            tab === "unpublished"
              ? {
                  ticked,
                  // A change is ticked and unticked with every change it must go with.
                  onTick: (ids, on) => {
                    // The ids given go too, such as a change no longer listed, unticked once gone.
                    setTicked((current) =>
                      withTicks(
                        current,
                        [
                          ...ids,
                          ...together(
                            rows.filter(({ id }) => ids.includes(id)),
                          ).map(({ id }) => id),
                        ],
                        on,
                      ),
                    );
                  },
                  // A change linked to one the view hides can't be ticked without it.
                  tickable: (row, shown) =>
                    together([row]).every(({ id }) => shown.has(id)),
                  label: (row) => `Select the change to ${row.record}`,
                  allLabel: "Select all changes",
                  tip: (row, shown) => {
                    const others = together([row]).filter(
                      ({ id }) => id !== row.id,
                    );
                    if (others.length === 0) return undefined;
                    const names =
                      others.length > namedInTip
                        ? `${others
                            .slice(0, namedInTip)
                            .map(({ record }) => record)
                            .join(", ")} and ${count(
                            others.length - namedInTip,
                          )} more`
                        : allOf(others.map(({ record }) => record));
                    const linked =
                      others.length === 1
                        ? `Linked to the change to ${names}`
                        : `Linked to the changes to ${names}`;
                    return others.every(({ id }) => shown.has(id))
                      ? linked
                      : `${linked}, not shown in the table`;
                  },
                }
              : tab === "all"
                ? undefined
                : {
                    ticked,
                    onTick: (ids, on) => {
                      setTicked((current) => withTicks(current, ids, on));
                    },
                    tickable: decidable,
                    label: (row) => `Select the draft of ${row.record}`,
                    allLabel: "Select all drafts this role can decide",
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
        action={actions}
        beside={
          <HeadingTabs
            id={tabsId}
            label="Drafts shown"
            tabs={tabs.map((one) => ({
              value: one,
              label: (
                <>
                  {/* The tab is always one of the fixed tabs. */}
                  {/* eslint-disable-next-line security/detect-object-injection */}
                  {draftsTabNames[one]}{" "}
                  {counts?.has(one) === true && (
                    <Text span inherit c="dimmed">
                      {counts.get(one)}
                    </Text>
                  )}
                </>
              ),
            }))}
            tab={tab}
            onTab={(next) => {
              setTicked(new Set());
              onView(viewOnTab(view, next, tabs));
            }}
          />
        }
      />
      <HeadingTabPanel key={tab} id={tabsId} tab={tab}>
        {content}
      </HeadingTabPanel>
      {views.dialogs}
      {discarding !== undefined && (
        <DiscardChangesModal
          opened
          total={changeCount(discarding.length)}
          pending={sent.discard.isPending}
          onCancel={() => {
            setDiscarding(undefined);
          }}
          onDiscard={() => {
            sent.discard.mutate(selectionOf(discarding));
          }}
        >
          {discarding.length === 1
            ? "The chosen change is discarded. This cannot be undone."
            : "The chosen changes are discarded. This cannot be undone."}
        </DiscardChangesModal>
      )}
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
