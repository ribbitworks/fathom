// SPDX-License-Identifier: Apache-2.0

// The Releases page's Cycles tab: the table of every schedule's cycles, with a timeline above it
// and the selected cycle's details beside it.

import type { Asking, DraftKind, ReleaseStream } from "@fathom/shared";
import {
  type CycleDetailRows,
  cycleColumnOrder,
  cycleDetailColumns,
  type CycleDraft,
  type CycleRow,
  cycleDetailRows,
  cycleRows,
  cycleTable,
  cycleTitle,
  durationColumn,
} from "./cycle-table.tsx";
import type { DraftSelection } from "./drafts.ts";
import { cycleChoiceId } from "./projects.ts";
import {
  ColumnRows,
  RecordLink,
  RecordPanel,
  RecordSection,
} from "./record-details.tsx";
import { noRecordActions } from "./record-table.ts";
import { inShownOrder, streamsShown } from "./releases.ts";
import { ReleasesTabTable } from "./releases-tab-table.tsx";
import { listingFeatures } from "./release-features.tsx";
import {
  draftActions,
  type FeaturesAt,
  hiddenUnlessShown,
  namedChoice,
  drawnAs,
  markOpener,
  type PlannedFeatures,
  type ShowIn,
} from "./release-tabs.ts";
import type { ScheduleActions } from "./schedule-tab.tsx";
import { DurationChange } from "./schedule-panel.tsx";
import { laterCyclesFrom } from "./schedules.ts";
import { recordMark } from "./status-mark.tsx";
import type { ChangeView, SavedViews } from "./table-controls.tsx";
import type { View } from "./table-view.ts";

const panelId = "cycle-panel";
const panelTitleId = "cycle-panel-title";

// The selected cycle, beside the table.
function CyclePanel({
  streams,
  stream,
  rows: { shown, drafted, live },
  actions,
  narrow,
  onClose,
  planned,
  onFeatures,
  showIn,
}: {
  // Every schedule, which a cycle's Schedule and Release are named from.
  streams: readonly ReleaseStream[];
  planned: PlannedFeatures | undefined;
  onFeatures: (at: FeaturesAt) => void;
  showIn: ShowIn;
  // The cycle's schedule, as the Draft view shows it, which its Duration changes.
  stream: ReleaseStream;
  rows: CycleDetailRows;
  actions: ScheduleActions;
  narrow: boolean;
  onClose: () => void;
}) {
  const { draft } = drafted;
  // A cycle a draft removes can't be changed until the draft is discarded or decided.
  const editable = actions.changeable(stream) && draft?.action !== "deleted";
  const columns = [
    ...listingFeatures(
      drawnAs(cycleDetailColumns(streams, [shown, drafted, live], planned), {
        release: (row) => (
          <RecordLink
            name={row.releaseName}
            onShow={() => {
              showIn("releases", row.release);
            }}
          />
        ),
        schedule: ({ stream: schedule }) => (
          <RecordLink
            name={schedule.name}
            onShow={() => {
              showIn("schedules", schedule.id);
            }}
          />
        ),
      }),
      planned,
      {
        cyclesOf: ({ cycleId }) => [cycleId],
        at: (row) => ({
          filter: { key: "targetCycle", value: row.cycleId },
          board: { stream: row.stream.id, from: row.startsOn },
        }),
        onFeatures,
      },
    ),
    durationColumn,
  ];
  return (
    <RecordPanel
      id={panelId}
      titleId={panelTitleId}
      recordId={shown.id}
      title={cycleTitle(shown)}
      narrow={narrow}
      draft={recordMark(draft, new Set(columns.map(({ key }) => key)))}
      nameDraft={draft}
      // A cycle of a schedule someone else is changing is locked with it.
      heldBy={drafted.heldBy ?? stream.heldBy}
      onClose={onClose}
    >
      <RecordSection id="cycle-details" title="Details">
        <ColumnRows
          columns={columns}
          shown={shown}
          draft={draft}
          live={live}
          changeOf={() => undefined}
          actionOf={(column) =>
            editable &&
            column.key === durationColumn.key && (
              <DurationChange
                cycle={shown.cycle}
                onChange={(change) => {
                  actions.onChange(stream, change);
                }}
              />
            )
          }
        />
      </RecordSection>
    </RecordPanel>
  );
}

// The schedules the timeline draws, in the order the table shows them, each with only the cycles
// the table shows, as it is live too.
function cyclesTimeline(
  streams: readonly ReleaseStream[],
  shown: readonly CycleRow[],
): ReleaseStream[] {
  const listed = new Set(shown.map(({ cycleId }) => cycleId));
  return inShownOrder(
    streams,
    shown.map(({ schedule }) => schedule),
  ).map((stream) => {
    const inTable = ({ startsOn }: { startsOn: string }) =>
      listed.has(cycleChoiceId(stream.id, startsOn));
    return {
      ...stream,
      cycles: stream.cycles.filter(inTable),
      liveCycles: (stream.liveCycles ?? stream.cycles).filter(inTable),
    };
  });
}

export function CyclesTable({
  streams,
  day,
  view,
  onView,
  approves,
  saved,
  narrow,
  open,
  onOpen,
  onClose,
  actions,
  decide,
  planned,
  onFeatures,
  showIn,
  canEditReleases,
}: {
  // Every schedule, with its drafts, whatever the view.
  streams: readonly ReleaseStream[];
  day: string;
  planned: PlannedFeatures | undefined;
  onFeatures: (at: FeaturesAt) => void;
  showIn: ShowIn;
  // Whether the user may change releases in the Draft view shown, whose drafts a cycle can carry.
  canEditReleases: boolean;
  view: View;
  onView: ChangeView;
  approves: readonly DraftKind[];
  saved: SavedViews;
  narrow: boolean;
  // The cycle whose details are open, if any.
  open: string | undefined;
  onOpen: (record: { id: string }) => void;
  onClose: (id: string) => void;
  actions: ScheduleActions;
  decide: (asking: Asking, selection: DraftSelection, all?: boolean) => void;
}) {
  const { show } = view;
  const everyRow = cycleRows(streams, show, day);
  const past = hiddenUnlessShown({
    rows: everyRow,
    hidden: ({ endsOn }) => endsOn < day,
    choice: namedChoice("past"),
    label: "Show past cycles",
    records: "Past cycles",
    view,
  });
  const laterFrom = laterCyclesFrom(day);
  const later = hiddenUnlessShown({
    rows: past.rows,
    hidden: ({ startsOn }) => startsOn >= laterFrom,
    choice: namedChoice("later"),
    label: "Show later cycles",
    records: "Later cycles",
    view,
  });
  const { rows } = later;
  const choices = [...past.choices, ...later.choices];
  const table = cycleTable({
    streams,
    rows: everyRow,
    day,
    onOpen,
    planned,
    approves,
  });
  // A cycle named in the address opens even while past cycles are hidden, while its schedule shows.
  const opened = streams
    .filter(({ id }) =>
      everyRow.some((row) => row.id === open && row.schedule === id),
    )
    .flatMap((stream) => {
      const [shownStream] = streamsShown([stream], show);
      const detail = cycleDetailRows(stream, open, show, day);
      return shownStream === undefined || detail === undefined
        ? []
        : [{ stream: shownStream, detail }];
    })
    .at(0);
  const panels =
    opened === undefined
      ? []
      : [
          {
            key: "cycle",
            id: panelId,
            name: "the cycle's panel",
            node: (
              <CyclePanel
                key={opened.detail.shown.id}
                streams={streams}
                stream={opened.stream}
                rows={opened.detail}
                actions={actions}
                narrow={narrow}
                onClose={() => {
                  onClose(opened.detail.shown.id);
                }}
                planned={planned}
                onFeatures={onFeatures}
                showIn={showIn}
              />
            ),
          },
        ];
  return (
    <ReleasesTabTable
      none={everyRow.length === 0 ? "No cycles yet." : undefined}
      day={day}
      layerForm="cycles"
      onOpenMark={markOpener(
        "cycle",
        (id) => {
          onOpen({ id });
        },
        showIn,
      )}
      timelineOf={(shown) => cyclesTimeline(streams, shown)}
      records={rows}
      table={table}
      fields={[]}
      order={cycleColumnOrder}
      lists={[]}
      canEdit={false}
      canAdd={false}
      rowActions={false}
      // A cycle's row carries its schedule's draft, or its release's, which only those who change
      // releases discard or resubmit.
      canEditDrafts={(row) =>
        row.draft?.ref.type === "release"
          ? canEditReleases
          : actions.canEditStreams
      }
      approves={approves}
      canEditColumns={false}
      actions={{
        ...noRecordActions<CycleRow, never, undefined>(decide),
        ...draftActions(
          (_row: CycleRow, draft: CycleDraft) => draft.ref,
          actions.run,
        ),
      }}
      view={view}
      onView={onView}
      panels={panels}
      viewChoices={choices}
      saved={saved}
    />
  );
}
