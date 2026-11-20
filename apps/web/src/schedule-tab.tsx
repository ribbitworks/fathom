// SPDX-License-Identifier: Apache-2.0

// The Releases page's Schedules tab: the table of schedules, with a timeline of those it shows above
// it, and the selected schedule's details beside it. Retired schedules show only when asked for.
// Those who change schedules retire and restore them from each row's menu, and change one from its
// details. A retired schedule, or one drafted to be retired, is only restored.

import type {
  Asking,
  DraftKind,
  RecordDraft,
  ReleaseStream,
} from "@fathom/shared";
import { Button, Group, Menu } from "@mantine/core";
import type { DraftSelection } from "./drafts.ts";
import { RecordPanel } from "./record-details.tsx";
import { noRecordActions } from "./record-table.ts";
import { RecordKey } from "./record-key.tsx";
import {
  markedDraft,
  setStreamRetired,
  slotDraft,
  streamRowFields,
  streamsShown,
  inShownOrder,
} from "./releases.ts";
import { ReleasesTabTable } from "./releases-tab-table.tsx";
import {
  hiddenUnlessShown,
  ownDraftActions,
  type ShowingChoice,
  type FeaturesAt,
  type PlannedFeatures,
  markOpener,
  type ShowIn,
  type ShowScheduleIn,
} from "./release-tabs.ts";
import {
  ScheduleCycles,
  ScheduleDetails,
  type ScheduleChange,
} from "./schedule-panel.tsx";
import { EndedBox, FactBox } from "./status-mark.tsx";
import {
  type ScheduleRows,
  scheduleRows,
  shownUnlessRetired,
  streamColumnOrder,
  type StreamRow,
  streamRows,
  streamTable,
} from "./stream-table.tsx";
import type { ChangeView, SavedViews } from "./table-controls.tsx";
import type { View } from "./table-view.ts";

const panelId = "release-stream-panel";

// Show retired, which the view keeps as its own, as every table with retired records does.
const retiredChoice: ShowingChoice = {
  on: (view) => view.retired === true,
  turned: (view, on) => ({ ...view, retired: on ? true : undefined }),
};
const panelTitleId = "release-stream-panel-title";

// What can be done on the tab, for its panel and row menus.
export interface ScheduleActions {
  // A record's draft, whatever the view, which its marks are worked out from, so the Draft view
  // decides how they show.
  draftOf: (id: string) => RecordDraft | undefined;
  canEditStreams: boolean;
  // Whether the user may change a schedule now: not while someone else is changing it, it is drafted
  // to be removed, or it is retired or drafted to be, when it is only restored.
  changeable: (stream: ReleaseStream) => boolean;
  // Asks for a change from a schedule's details.
  onChange: (stream: ReleaseStream, change: ScheduleChange) => void;
  run: (work: () => Promise<unknown>, done: string) => void;
}

// Retires a schedule, or restores one retired, from its menu.
function RetireItem({
  stream,
  run,
}: {
  stream: ReleaseStream;
  run: ScheduleActions["run"];
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

// The selected schedule, beside the table.
function StreamPanel({
  stream,
  rows,
  day,
  actions,
  narrow,
  onClose,
  planned,
  onFeatures,
  showIn,
  showScheduleIn,
}: {
  stream: ReleaseStream;
  rows: ScheduleRows;
  planned: PlannedFeatures | undefined;
  onFeatures: (at: FeaturesAt) => void;
  showIn: ShowIn;
  showScheduleIn: ShowScheduleIn;
  // Today, for whether the stream has ended.
  day: string;
  actions: ScheduleActions;
  narrow: boolean;
  onClose: () => void;
}) {
  const editable = actions.changeable(stream);
  const onChange = (change: ScheduleChange) => {
    actions.onChange(stream, change);
  };
  return (
    <RecordPanel
      id={panelId}
      titleId={panelTitleId}
      recordId={stream.id}
      title={stream.name}
      subtitle={
        <RecordKey record={{ kind: "schedule", keyNumber: stream.keyNumber }} />
      }
      narrow={narrow}
      draft={slotDraft(
        actions.draftOf(stream.id),
        streamRowFields,
        stream.retired,
      )}
      nameDraft={actions.draftOf(stream.id)}
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
      onClose={onClose}
    >
      <ScheduleDetails
        key={`details-${stream.id}`}
        rows={rows}
        day={day}
        canEdit={editable}
        onChange={onChange}
        planned={planned}
        onFeatures={onFeatures}
        showIn={showIn}
      />
      <ScheduleCycles
        key={`cycles-${stream.id}`}
        rows={rows}
        day={day}
        canEdit={editable}
        onChange={onChange}
      />
      <Group gap="xs">
        <Button
          variant="default"
          onClick={() => {
            showScheduleIn("releases", stream.id);
          }}
        >
          Show its releases
        </Button>
        <Button
          variant="default"
          onClick={() => {
            showScheduleIn("cycles", stream.id);
          }}
        >
          Show its cycles
        </Button>
      </Group>
    </RecordPanel>
  );
}

export function SchedulesTable({
  streams: all,
  day,
  view,
  onView,
  approves,
  saved,
  narrow,
  open: openId,
  onOpen,
  onClose,
  actions,
  decide,
  planned,
  onFeatures,
  showIn,
  showScheduleIn,
}: {
  // Every schedule, with its drafts, whatever the view.
  streams: readonly ReleaseStream[];
  day: string;
  planned: PlannedFeatures | undefined;
  onFeatures: (at: FeaturesAt) => void;
  showIn: ShowIn;
  showScheduleIn: ShowScheduleIn;
  view: View;
  onView: ChangeView;
  approves: readonly DraftKind[];
  saved: SavedViews;
  narrow: boolean;
  // The schedule whose details are open, if any.
  open: string | undefined;
  onOpen: (record: { id: string }) => void;
  onClose: (id: string) => void;
  actions: ScheduleActions;
  decide: (asking: Asking, selection: DraftSelection) => void;
}) {
  const { show } = view;
  const { rows: kept, choices } = hiddenUnlessShown({
    rows: all,
    hidden: (stream) => !shownUnlessRetired(stream),
    choice: retiredChoice,
    label: "Show retired",
    records: "Retired schedules",
    view,
  });
  const rows = streamRows(kept, show, day);
  // A stream named in the address opens even while retired streams are hidden, such as from a
  // release's link on Features.
  const open =
    openId === undefined
      ? undefined
      : streamsShown(all, show).find(({ id }) => id === openId);
  const openRows = all
    .filter(({ id }) => id === open?.id)
    .map((stream) => scheduleRows(stream, show, day))
    .at(0);
  const table = streamTable({
    streams: kept,
    day,
    onOpen,
    planned,
    menuItems: (row) =>
      !row.live &&
      actions.changeable({ ...row.stream, retired: false }) && (
        <RetireItem stream={row.stream} run={actions.run} />
      ),
  });
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
                  onClose(open.id);
                }}
                planned={planned}
                onFeatures={onFeatures}
                showIn={showIn}
                showScheduleIn={showScheduleIn}
              />
            ),
          },
        ]
      : [];
  return (
    <ReleasesTabTable
      none={all.length === 0 ? "No schedules yet." : undefined}
      day={day}
      layerForm="schedules"
      onOpenMark={markOpener(
        "schedule",
        (id) => {
          onOpen({ id });
        },
        showIn,
      )}
      timelineOf={(shown) =>
        inShownOrder(
          kept,
          shown.map(({ id }) => id),
        )
      }
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
      actions={{
        ...noRecordActions<StreamRow, never, undefined>(decide),
        ...ownDraftActions("release-stream", actions.run),
      }}
      view={view}
      onView={onView}
      panels={panels}
      viewChoices={choices}
      saved={saved}
    />
  );
}
