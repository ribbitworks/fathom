// SPDX-License-Identifier: Apache-2.0

// The Releases page, with its Releases, Cycles and Schedules tabs: a table, a timeline and saved
// views for each, a record's details beside it, and changes to releases, cycles and schedules.

import type {
  Asking,
  Cycle,
  DraftKind,
  Release,
  ReleaseStream,
  ViewTable,
} from "@fathom/shared";
import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Tooltip,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type MouseEvent, type ReactNode, useMemo, useState } from "react";
import { z } from "zod";
import { describeProblem } from "./api.ts";
import { DecisionModal } from "./decision-dialog.tsx";
import { type DraftSelection } from "./drafts.ts";
import { type Decision, decisionFor } from "./draft-decisions.ts";
import { notifyFailure, notifySuccess } from "./notices.tsx";
import { HeadingTabPanel, HeadingTabs, PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import {
  CycleLengthDialog,
  PatternDialog,
  ReleaseDialog,
  type ReleasePart,
  StreamDialog,
} from "./release-dialogs.tsx";
import {
  type ReleaseActivities,
  releasePanelTitleId,
  ReleasesTable,
} from "./release-tab.tsx";
import {
  type ActivitiesOf,
  editsFeatureKinds,
  leavingFor,
} from "./activity-list.tsx";
import { recordsAsShown } from "./live-records.ts";
import { EndsDialog } from "./schedule-end-dialog.tsx";
import { useDiscardQuestion } from "./discard-question.tsx";
import { afterNote, useNoteEditing } from "./note-editing.tsx";
import {
  draftsById,
  recordNodes,
  releaseStreamsQuery,
  type SavedStream,
} from "./releases.ts";
import { focusRecordCell } from "./grid-row.tsx";
import { useNarrow } from "./side-panel.tsx";
import { unpublishedQuery } from "./unpublished.tsx";
import { today } from "./today.ts";
import type { ChangeView } from "./table-controls.tsx";
import { useSavedViews } from "./saved-views.tsx";
import type { View } from "./table-view.ts";
import { type ScheduleActions, SchedulesTable } from "./schedule-tab.tsx";
import { CyclesTable } from "./cycle-tab.tsx";
import { livePlanRecords } from "./plan-table.tsx";
import { planNodes, projectPlanQuery } from "./projects.ts";
import {
  type FeaturesAt,
  type PlannedFeatures,
  plannedFeatures,
  type ShowIn,
} from "./release-tabs.ts";
import type { ScheduleChange } from "./schedule-panel.tsx";

type Dialog =
  | { kind: "stream"; stream?: ReleaseStream }
  | { kind: "pattern"; stream: ReleaseStream; from?: string | undefined }
  | { kind: "ends"; stream: ReleaseStream }
  | { kind: "cycle-length"; stream: ReleaseStream; cycle: Cycle }
  | { kind: "new-release" }
  | {
      kind: "release";
      stream: ReleaseStream;
      release: Release;
      part: ReleasePart;
    };

const tabsId = "releases-tabs";
// Also where one of a release's activities opens.
export interface ReleaseActivitiesOf extends ActivitiesOf {
  open: (id: string) => void;
}

export const releasesTabSchema = z.enum(["releases", "cycles", "schedules"]);

export type ReleasesTab = z.infer<typeof releasesTabSchema>;

const releasesTabs = [
  { value: "releases", label: "Releases" },
  { value: "cycles", label: "Cycles" },
  { value: "schedules", label: "Schedules" },
] as const satisfies readonly { value: ReleasesTab; label: string }[];

// The table each tab keeps its saved views in.
export const releasesTabTables = {
  releases: "releases",
  cycles: "cycles",
  schedules: "release-streams",
} as const satisfies Record<ReleasesTab, ViewTable>;

const releaseDialogTitles: Record<ReleasePart, (name: string) => string> = {
  name: (name) => `Rename ${name}`,
  cycles: (name) => `Change the cycles of ${name}`,
  shipsOn: (name) => `Change when ${name} ships`,
  colour: (name) => `Change the colour of ${name}`,
};

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
  if (dialog.kind === "new-release") return "New release";
  if (dialog.kind === "release") {
    return releaseDialogTitles[dialog.part](dialog.release.name);
  }
  return dialog.stream.patterns.length === 0
    ? `Set up cycles for ${dialog.stream.name}`
    : `Change the length or names of ${dialog.stream.name}'s cycles`;
};

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

// Whether a new release may be made in a schedule: one not retired, nor drafted to be removed, with
// cycles to put it in.
const takesReleases = (stream: ReleaseStream) =>
  !stream.retired &&
  stream.draft?.action !== "deleted" &&
  stream.cycles.length > 0;

export function ReleasesPage({
  tab,
  onTab,
  open: openId,
  onOpen,
  onFeatures,
  activitiesOf,
  approves,
  view,
  onView,
  applied,
  onApply,
  canShareViews,
}: {
  tab: ReleasesTab;
  // Changes the tab, with a record's details open on it, or its rows filtered to a schedule, if
  // one is named.
  onTab: (tab: ReleasesTab, at?: { open?: string; schedule?: string }) => void;
  // The record of the tab open in the side panel, if any.
  open?: string | undefined;
  onOpen: (id: string | undefined) => void;
  onFeatures: (at: FeaturesAt) => void;
  // Set for a role that sees activities.
  activitiesOf?: ReleaseActivitiesOf | undefined;
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
  const planned: PlannedFeatures | undefined = useMemo(
    () =>
      plan.data === undefined ? undefined : plannedFeatures(plan.data.features),
    [plan.data],
  );
  const narrow = useNarrow();
  const [dialog, setDialog] = useState<Dialog>();
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<Decision>();
  const [deciding, setDeciding] = useState(false);
  // A release's note, written in a panel of its own beside its details, which closes once the
  // release is no longer shown; anything that would close it while it is changed asks first.
  const notes = useNoteEditing(releasePanelTitleId);
  const notePanel = notes.note(openId);
  const question = useDiscardQuestion();
  const leave = (go: () => void) => {
    afterNote(notes, question.ask, go);
  };
  const views = useSavedViews({
    // The tab is always one of the fixed tabs.
    // eslint-disable-next-line security/detect-object-injection
    table: releasesTabTables[tab],
    within: releaseStreamsQuery.queryKey,
    view,
    applied,
    onApply,
    canShare: canShareViews,
    blocked: dialog !== undefined || deciding || question.asking,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: releaseStreamsQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: unpublishedQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: ["changes"] }),
    ]);
  };
  const showIn: ShowIn = (next, record) => {
    leave(() => {
      onTab(next, { open: record });
    });
  };
  const showScheduleIn = (next: ReleasesTab, schedule: string) => {
    leave(() => {
      onTab(next, { schedule });
    });
  };
  const showFeatures = (at: FeaturesAt) => {
    leave(() => {
      onFeatures(at);
    });
  };
  const activities: ReleaseActivities | undefined =
    activitiesOf === undefined || plan.data === undefined
      ? undefined
      : {
          activities: recordsAsShown(
            show,
            plan.data.activities,
            livePlanRecords,
          ),
          of: leavingFor(activitiesOf, leave),
          onShow: (id) => {
            leave(() => {
              activitiesOf.open(id);
            });
          },
          mayAdd: editsFeatureKinds(plan.data.canEditFeatures, show),
        };
  const openRecord = (record: { id: string }) => {
    leave(() => {
      onOpen(record.id);
    });
  };
  const closePanel = (id: string) => {
    leave(() => {
      focusRecordCell(id, "name");
      onOpen(undefined);
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

  const { streams: all, canEditStreams, canEditReleases } = query.data;
  const day = today();
  const drafts = draftsById(all);
  const nodes = [
    ...recordNodes(all),
    ...(plan.data === undefined ? [] : planNodes(plan.data)),
  ];
  const decide = (asking: Asking, selection: DraftSelection, all?: boolean) => {
    setDecision(
      decisionFor(
        asking,
        selection,
        approves,
        [],
        { fields: [], records: nodes },
        all,
      ),
    );
    setDeciding(true);
  };
  const actions: ScheduleActions = {
    draftOf: (id) => drafts.get(id),
    canEditStreams: canEditStreams && show !== "live",
    changeable: (stream) =>
      actions.canEditStreams &&
      stream.heldBy === undefined &&
      stream.draft?.action !== "deleted" &&
      !stream.retired,
    onChange: (stream, change) => {
      setDialog(dialogFor(stream, change));
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
              error,
              "Fathom could not make this change. Try again in a moment.",
            ),
          );
        });
    },
  };
  // Closes the dialog once its change is saved, saying so, and opens what it added, if anything.
  const saved =
    (message: string, added?: (stream: ReleaseStream) => { id: string }[]) =>
    ({ stream }: SavedStream) => {
      setDialog(undefined);
      notifySuccess(message);
      for (const record of added?.(stream) ?? []) openRecord(record);
      void refresh();
    };
  // The releases a saved schedule holds that were not there before.
  const known = new Set(
    all.flatMap(({ releases }) => releases.map(({ id }) => id)),
  );
  const newReleases = (stream: ReleaseStream) =>
    stream.releases.filter(({ id }) => !known.has(id));
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
      openId !== undefined &&
      event.currentTarget.contains(target) &&
      !target.closest("tr, [data-side-panel], section, button, a, input")
    ) {
      closePanel(openId);
    }
  };

  const takers = all.filter(takesReleases);
  // Nothing is made under Live only, where it would not show. Cycles come from their schedules.
  const newButtons: Record<ReleasesTab, ReactNode> = {
    releases: canEditReleases && show !== "live" && (
      <Tooltip
        label="No schedule takes new releases now"
        disabled={takers.length > 0}
      >
        <span>
          <Button
            disabled={takers.length === 0}
            onClick={() => {
              setDialog({ kind: "new-release" });
            }}
          >
            New release
          </Button>
        </span>
      </Tooltip>
    ),
    cycles: undefined,
    schedules: canEditStreams && show !== "live" && (
      <Button
        onClick={() => {
          setDialog({ kind: "stream" });
        }}
      >
        New schedule
      </Button>
    ),
  };
  const tables: Record<ReleasesTab, () => ReactNode> = {
    releases: () => (
      <ReleasesTable
        streams={all}
        day={day}
        view={view}
        onView={onView}
        approves={approves}
        saved={views.saved}
        canEdit={canEditReleases && show !== "live"}
        narrow={narrow}
        open={openId}
        onOpen={(id, opened) => {
          leave(() => {
            onOpen(id);
            opened?.();
          });
        }}
        onClose={closePanel}
        planned={planned}
        activities={activities}
        onFeatures={showFeatures}
        showIn={showIn}
        notes={notes}
        notePanel={notePanel}
        onChange={(stream, release, part) => {
          setDialog({ kind: "release", stream, release, part });
        }}
        run={actions.run}
        decide={decide}
      />
    ),
    cycles: () => (
      <CyclesTable
        streams={all}
        day={day}
        view={view}
        onView={onView}
        approves={approves}
        saved={views.saved}
        narrow={narrow}
        open={openId}
        onOpen={openRecord}
        onClose={closePanel}
        actions={actions}
        decide={decide}
        planned={planned}
        onFeatures={showFeatures}
        showIn={showIn}
        canEditReleases={canEditReleases && show !== "live"}
      />
    ),
    schedules: () => (
      <SchedulesTable
        streams={all}
        day={day}
        view={view}
        onView={onView}
        approves={approves}
        saved={views.saved}
        narrow={narrow}
        open={openId}
        onOpen={openRecord}
        onClose={closePanel}
        actions={actions}
        decide={decide}
        planned={planned}
        onFeatures={showFeatures}
        showIn={showIn}
        showScheduleIn={showScheduleIn}
      />
    ),
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
            tab={tab}
            onTab={(next) => {
              leave(() => {
                onTab(next);
              });
            }}
          />
        }
        // The tab is always one of the fixed tabs.
        // eslint-disable-next-line security/detect-object-injection
        action={newButtons[tab]}
      />
      <HeadingTabPanel id={tabsId} tab={tab}>
        {/* The tab is always one of the fixed tabs. */}
        {/* eslint-disable-next-line security/detect-object-injection */}
        {tables[tab]()}
      </HeadingTabPanel>
      {views.dialogs}
      {question.dialog}
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
                ? saved("Drafted the new schedule.", (stream) => [stream])
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
        {dialog?.kind === "new-release" && (
          <ReleaseDialog
            streams={takers}
            onSaved={saved("Drafted the new release.", newReleases)}
            {...savingProps}
          />
        )}
        {dialog?.kind === "release" && (
          <ReleaseDialog
            stream={dialog.stream}
            release={dialog.release}
            part={dialog.part}
            onSaved={saved("Drafted the change to the release.")}
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
