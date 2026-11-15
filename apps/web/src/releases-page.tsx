// SPDX-License-Identifier: Apache-2.0

// The Releases page, under its tabs, starting with Schedules: a timeline of the schedules the table
// shows, above the table, and the selected schedule's details in a side panel at its own address.
// Those who change schedules add them, retire and restore them from each row's menu, and change one
// from its details: its name, its end, its cycles' length and names from a cycle on, and one cycle's
// length. A retired schedule, or one drafted to be retired, is only restored. Every change is a
// draft, shown in place with its mark, which its makers discard or resubmit, and Approvers approve
// or reject, here or on the Drafts page, from each row's menu.

import {
  type Cycle,
  type DraftKind,
  type RecordDraft,
  type RecordRef,
  type ReleaseStream,
} from "@fathom/shared";
import {
  Alert,
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type MouseEvent, useEffect, useState } from "react";
import { describeProblem } from "./api.ts";
import { DecisionModal } from "./decision-dialog.tsx";
import { type Decision, decisionFor } from "./drafts.ts";
import { focusSoon } from "./focus.ts";
import { notifyFailure, notifySuccess } from "./notices.tsx";
import { HeadingTabPanel, HeadingTabs, PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { DetailSections } from "./record-details.tsx";
import {
  CycleLengthDialog,
  EndsDialog,
  PatternDialog,
  StreamDialog,
} from "./release-dialogs.tsx";
import {
  discardRecordDraft,
  markedDraft,
  slotDraft,
  streamRowFields,
  draftsById,
  streamsShown,
  recordNodes,
  releaseStreamsQuery,
  resubmitRecordDraft,
  type SavedStream,
  setStreamRetired,
} from "./releases.ts";
import {
  focusRecordCell,
  noRecordActions,
  RecordGrid,
} from "./record-grid.tsx";
import {
  DraftedItem,
  DraftedValue,
  EndedBox,
  FactBox,
} from "./status-mark.tsx";
import { SidePanelFrame, sidePanelScroll, useNarrow } from "./side-panel.tsx";
import { unpublishedQuery } from "./unpublished.tsx";
import { TimelineView } from "./timeline-view.tsx";
import { today } from "./today.ts";
import type { ChangeView, ViewChoice } from "./table-controls.tsx";
import { useSavedViews } from "./saved-views.tsx";
import type { View } from "./table-view.ts";
import { TableTips } from "./table-tips.tsx";
import {
  type ScheduleRows,
  scheduleRows,
  shownUnlessRetired,
  streamColumnOrder,
  type StreamRow,
  streamRows,
  streamTable,
} from "./stream-table.tsx";
import { planNodes, projectPlanQuery } from "./projects.ts";
import {
  ScheduleCycles,
  ScheduleDetails,
  type ScheduleChange,
} from "./schedule-panel.tsx";

type Dialog =
  | { kind: "stream"; stream?: ReleaseStream }
  | { kind: "pattern"; stream: ReleaseStream; from?: string | undefined }
  | { kind: "ends"; stream: ReleaseStream }
  | { kind: "cycle-length"; stream: ReleaseStream; cycle: Cycle };

const tabsId = "releases-tabs";
const releasesTabs = [{ value: "schedules", label: "Schedules" }] as const;

const panelId = "release-stream-panel";
const panelTitleId = "release-stream-panel-title";
const timelineZoomKey = "fathom-releases-timeline-zoom";
const dialogTitle = (dialog: Dialog): string => {
  if (dialog.kind === "stream") {
    return dialog.stream === undefined
      ? "New schedule"
      : `Rename ${dialog.stream.name}`;
  }
  if (dialog.kind === "ends") {
    return `Change when ${dialog.stream.name} ends`;
  }
  if (dialog.kind === "cycle-length") {
    return `Change the length of ${dialog.cycle.name}`;
  }
  return dialog.stream.patterns.length === 0
    ? `Set up cycles for ${dialog.stream.name}`
    : `Change the length or names of ${dialog.stream.name}'s cycles`;
};

// What can be done on the page, for its panel, dialogs and row menus.
interface Actions {
  // A record's draft, whatever the view, which its marks are worked out from, so the Draft view
  // decides how they show.
  draftOf: (id: string) => RecordDraft | undefined;
  canEditStreams: boolean;
  // Whether the user may change a schedule now: not while someone else is changing it, it is drafted
  // to be removed, or it is retired or drafted to be, when it is only restored.
  changeable: (stream: ReleaseStream) => boolean;
  open: (dialog: Dialog) => void;
  resubmit: (ref: RecordRef) => void;
  discard: (ref: RecordRef) => void;
  run: (work: () => Promise<unknown>, done: string) => void;
}

// The dialog a change from a schedule's details opens.
function dialogFor(stream: ReleaseStream, change: ScheduleChange): Dialog {
  switch (change.kind) {
    case "rename":
      return { kind: "stream", stream };
    case "ends":
      return { kind: "ends", stream };
    case "pattern":
      return { kind: "pattern", stream, from: change.from };
    case "cycle-length":
      return { kind: "cycle-length", stream, cycle: change.cycle };
  }
}

// Retires a schedule, or restores one retired, from its menu.
function RetireItem({
  stream,
  run,
}: {
  stream: ReleaseStream;
  run: Actions["run"];
}) {
  return (
    <Menu.Item
      onClick={() => {
        run(
          () => setStreamRetired(stream.id, !stream.retired),
          `Drafted ${stream.retired ? "restoring" : "retiring"} ${stream.name}.`,
        );
      }}
    >
      {stream.retired ? "Restore" : "Retire"}
    </Menu.Item>
  );
}

// The selected schedule, beside the table, as the Lists page shows a list.
function StreamPanel({
  stream,
  rows,
  day,
  actions,
  narrow,
  onClose,
}: {
  stream: ReleaseStream;
  rows: ScheduleRows;
  // Today, for whether the stream has ended.
  day: string;
  actions: Actions;
  narrow: boolean;
  onClose: () => void;
}) {
  // Opening a stream puts focus on its name in the panel.
  useEffect(() => {
    focusSoon(panelTitleId);
  }, [stream.id]);
  const editable = actions.changeable(stream);
  return (
    <SidePanelFrame
      id={panelId}
      titleId={panelTitleId}
      narrow={narrow}
      title={stream.name}
      marked={(heading) => (
        <DraftedItem
          draft={slotDraft(
            actions.draftOf(stream.id),
            streamRowFields,
            stream.retired,
          )}
          heldBy={stream.heldBy}
          facts={
            <>
              {/* A draft retiring the schedule says so in its own box. */}
              {stream.retired &&
                markedDraft(stream.draft, stream.retired)?.retiring ===
                  undefined && <FactBox>Retired</FactBox>}
              <EndedBox stream={stream} day={day} />
            </>
          }
        >
          <DraftedValue
            draft={actions.draftOf(stream.id)}
            fields={["name"]}
            named="Name"
          >
            {heading}
          </DraftedValue>
        </DraftedItem>
      )}
      close={{ label: "Close details", onClose }}
    >
      <div className={sidePanelScroll}>
        <DetailSections>
          <ScheduleDetails
            key={`details-${stream.id}`}
            rows={rows}
            day={day}
            canEdit={editable}
            onChange={(change) => {
              actions.open(dialogFor(stream, change));
            }}
          />
          <ScheduleCycles
            key={`cycles-${stream.id}`}
            rows={rows}
            day={day}
            canEdit={editable}
            onChange={(change) => {
              actions.open(dialogFor(stream, change));
            }}
          />
        </DetailSections>
      </div>
    </SidePanelFrame>
  );
}

export function ReleasesPage({
  streamId,
  approves,
  view,
  onView,
  applied,
  onApply,
  canShareViews,
}: {
  // The stream open in the side panel, if any.
  streamId?: string | undefined;
  // The kinds of draft the user's role approves and rejects.
  approves: readonly DraftKind[];
  view: View;
  onView: ChangeView;
  // The saved view the view started from, as the address names it.
  applied: string | undefined;
  onApply: (view: View, id: string, replace?: boolean) => void;
  canShareViews: boolean;
}) {
  const { show } = view;
  const queryClient = useQueryClient();
  const query = useQuery(releaseStreamsQuery);
  // Drafts of features move with cycles; those who see only configuration are sent none.
  const plan = useQuery(projectPlanQuery);
  const narrow = useNarrow();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>();
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<Decision>();
  const [deciding, setDeciding] = useState(false);
  const views = useSavedViews({
    table: "release-streams",
    within: releaseStreamsQuery.queryKey,
    applied,
    onApply,
    canShare: canShareViews,
    blocked: dialog !== undefined || deciding,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: releaseStreamsQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: unpublishedQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: ["changes"] }),
    ]);
  };
  const openStream = (stream: { id: string }) => {
    void navigate({
      to: "/releases/{-$streamId}",
      params: { streamId: stream.id },
      search: true,
    });
  };
  const closePanel = (stream: ReleaseStream) => {
    focusRecordCell(stream.id, "name");
    void navigate({
      to: "/releases/{-$streamId}",
      params: { streamId: undefined },
      search: true,
    });
  };

  if (query.isPending) return <Loader role="status" aria-label="Loading" />;
  if (query.isError) {
    return (
      <Alert color="red" role="alert">
        <Group justify="space-between">
          Fathom could not load the schedules.
          <Button
            variant="light"
            color="red"
            size="xs"
            onClick={() => {
              void query.refetch();
            }}
          >
            Try again
          </Button>
        </Group>
      </Alert>
    );
  }

  const { streams: all, canEditStreams } = query.data;
  const day = today();
  const kept = view.retired === true ? all : all.filter(shownUnlessRetired);
  const retiredCount = all.length - all.filter(shownUnlessRetired).length;
  const rows = streamRows(kept, show, day);
  const choices: ViewChoice[] =
    retiredCount > 0 || view.retired === true
      ? [
          {
            label: "Show retired",
            count: retiredCount,
            on: (shown) => shown.retired === true,
            turned: (shown, on) => ({
              ...shown,
              retired: on ? true : undefined,
            }),
            part: { name: "Show", value: "Retired schedules" },
          },
        ]
      : [];
  const drafts = draftsById(all);
  const nodes = [
    ...recordNodes(all),
    ...(plan.data === undefined ? [] : planNodes(plan.data)),
  ];
  // A stream named in the address opens even while retired streams are hidden, such as from a
  // release's link on Features.
  const open = streamsShown(all, show).find(({ id }) => id === streamId);
  const openRows = all
    .filter(({ id }) => id === open?.id)
    .map((stream) => scheduleRows(stream, show, day))
    .at(0);
  const actions: Actions = {
    draftOf: (id) => drafts.get(id),
    canEditStreams: canEditStreams && show !== "live",
    changeable: (stream) =>
      actions.canEditStreams &&
      stream.heldBy === undefined &&
      stream.draft?.action !== "deleted" &&
      !stream.retired,
    open: setDialog,
    resubmit: (ref) => {
      actions.run(() => resubmitRecordDraft(ref), "Resubmitted the draft.");
    },
    discard: (ref) => {
      actions.run(() => discardRecordDraft(ref), "Discarded the draft.");
    },
    run: (work, done) => {
      work()
        .then(async () => {
          notifySuccess(done);
          await refresh();
        })
        .catch((error: unknown) => {
          notifyFailure(
            describeProblem(
              error as Error,
              "Fathom could not make this change. Try again in a moment.",
            ),
          );
        });
    },
  };
  const table = streamTable({
    streams: kept,
    day,
    onOpen: openStream,
    menuItems: (row) =>
      !row.live &&
      actions.changeable({ ...row.stream, retired: false }) && (
        <RetireItem stream={row.stream} run={actions.run} />
      ),
  });
  // Closes the dialog once its change is saved, saying so, and opens a stream just added.
  const saved =
    (message: string, opens = false) =>
    ({ stream }: SavedStream) => {
      setDialog(undefined);
      notifySuccess(message);
      if (opens) openStream(stream);
      void refresh();
    };
  const savingProps = {
    onCancel: () => {
      setDialog(undefined);
    },
    onBusy: setBusy,
  };

  // Clicking the page outside the panel, the table's rows, and any control closes the panel, as on
  // the Lists page. Menus and dialogs are drawn outside the page, so clicks in them do not count.
  const onPageClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (
      open &&
      event.currentTarget.contains(target) &&
      !target.closest("tr, [data-side-panel], section, button, a, input")
    ) {
      closePanel(open);
    }
  };

  const panels =
    open && openRows
      ? [
          {
            key: "stream",
            id: panelId,
            name: "the schedule's panel",
            node: (
              <StreamPanel
                key={open.id}
                stream={open}
                rows={openRows}
                day={day}
                actions={actions}
                narrow={narrow}
                onClose={() => {
                  closePanel(open);
                }}
              />
            ),
          },
        ]
      : [];
  const gridActions = {
    ...noRecordActions<StreamRow, never, undefined>((asking, selection) => {
      setDecision(
        decisionFor(asking, selection, approves, [], {
          fields: [],
          records: nodes,
        }),
      );
      setDeciding(true);
    }),
    // A schedule's row discards or resubmits the schedule's own draft, never its parts'.
    discard: (row: StreamRow) => {
      actions.discard({ type: "release-stream", id: row.id });
    },
    resubmit: (row: StreamRow) => {
      actions.resubmit({ type: "release-stream", id: row.id });
    },
  };

  return (
    <Stack gap="md" className={classes.tablePage} onClick={onPageClick}>
      <PageHeader
        title="Releases"
        beside={
          <HeadingTabs
            id={tabsId}
            label="Releases tables"
            tabs={releasesTabs}
            tab="schedules"
            onTab={() => undefined}
          />
        }
        action={
          canEditStreams && (
            <Button
              onClick={() => {
                setDialog({ kind: "stream" });
              }}
            >
              New schedule
            </Button>
          )
        }
      />
      <HeadingTabPanel id={tabsId} tab="schedules">
        {all.length === 0 ? (
          <Text fz="sm" c="dimmed">
            No schedules yet.
          </Text>
        ) : (
          <TableTips>
            <RecordGrid
              records={rows}
              table={table}
              fields={[]}
              order={streamColumnOrder}
              lists={[]}
              canEdit={false}
              canAdd={false}
              rowActions={false}
              canEditDrafts={actions.canEditStreams}
              approves={approves}
              canEditColumns={false}
              actions={gridActions}
              view={view}
              onView={onView}
              panels={panels}
              above={(shown) => {
                const listed = new Set(shown.map(({ id }) => id));
                return (
                  <div className={classes.releasesTimeline}>
                    <TimelineView
                      title="Timeline"
                      zoomKey={timelineZoomKey}
                      releaseStreams={kept.filter(({ id }) => listed.has(id))}
                      today={day}
                    />
                  </div>
                );
              }}
              viewChoices={choices}
              saved={views.saved}
            />
          </TableTips>
        )}
      </HeadingTabPanel>
      {views.dialogs}
      <Modal
        opened={dialog !== undefined}
        onClose={() => {
          setDialog(undefined);
        }}
        closeOnEscape={!busy}
        closeOnClickOutside={!busy}
        withCloseButton={!busy}
        title={dialog === undefined ? "" : dialogTitle(dialog)}
      >
        {dialog?.kind === "stream" && (
          <StreamDialog
            stream={dialog.stream}
            streams={all}
            onSaved={
              dialog.stream === undefined
                ? saved("Drafted the new schedule.", true)
                : saved("Drafted the new name.")
            }
            {...savingProps}
          />
        )}
        {dialog?.kind === "pattern" && (
          <PatternDialog
            stream={dialog.stream}
            from={dialog.from}
            onSaved={saved(
              dialog.stream.patterns.length === 0
                ? "Drafted the cycles."
                : "Drafted the change to the cycles.",
            )}
            {...savingProps}
          />
        )}
        {dialog?.kind === "ends" && (
          <EndsDialog
            stream={dialog.stream}
            onSaved={saved("Drafted the change to the cycles.")}
            {...savingProps}
          />
        )}
        {dialog?.kind === "cycle-length" && (
          <CycleLengthDialog
            stream={dialog.stream}
            cycle={dialog.cycle}
            onSaved={saved("Drafted the new length.")}
            {...savingProps}
          />
        )}
      </Modal>
      <DecisionModal
        decision={decision}
        opened={deciding}
        onClose={() => {
          setDeciding(false);
        }}
        onDone={() => {
          setDeciding(false);
          void refresh();
        }}
      />
    </Stack>
  );
}
