// SPDX-License-Identifier: Apache-2.0

// The Releases page's Releases tab: the table of releases, with a timeline above it, the selected
// release's details beside it, and its note in a panel of its own.

import type { Asking, DraftKind, Release, ReleaseStream } from "@fathom/shared";
import { Menu } from "@mantine/core";
import { useEffect, useEffectEvent, useRef } from "react";
import {
  type ActivityRow,
  activitiesShowOn,
  listingActivities,
} from "./activity-list.tsx";
import { noteOf } from "./cell-kinds.tsx";
import type { DraftSelection } from "./drafts.ts";
import { noOthers } from "./new-plan-record-panel.tsx";
import type { NoteContext, NoteOpening } from "./note-editing.tsx";
import {
  ColumnRows,
  RecordLink,
  RecordLinkList,
  RecordPanel,
  RecordSection,
  Row,
  ShowOnItem,
} from "./record-details.tsx";
import { useRecordEditing } from "./record-editing.tsx";
import { noRecordActions } from "./record-table.ts";
import { RecordKey } from "./record-key.tsx";
import type { ReleasePart } from "./release-dialogs.tsx";
import {
  releaseColumnOrder,
  releaseDetailColumns,
  type ReleaseDetailRows,
  releaseDetailRows,
  releaseNoteColumn,
  type ReleaseRow,
  releaseRows,
  releaseTable,
} from "./release-table.tsx";
import {
  inShownOrder,
  releaseRowFields,
  removeFromStream,
  saveReleaseNote,
  slotDraft,
} from "./releases.ts";
import { ReleasesTabTable } from "./releases-tab-table.tsx";
import { listingFeatures } from "./release-features.tsx";
import {
  type FeaturesAt,
  ownDraftActions,
  drawnAs,
  markOpener,
  type PlannedFeatures,
  type ShowIn,
} from "./release-tabs.ts";
import { releaseColumnKey } from "./feature-table.tsx";
import { cycleChoiceId, releaseGroupKey } from "./projects.ts";
import type { SidePanel } from "./side-panel.tsx";
import type { ChangeView, SavedViews } from "./table-controls.tsx";
import type { View } from "./table-view.ts";
import { hiddenUnlessShown, namedChoice } from "./view-choices.ts";

const panelId = "release-panel";
export const releasePanelTitleId = "release-panel-title";

type ReleaseNote = NoteContext<ReleaseRow, never>;

// The values a release's details change, by their columns' keys, each with its own pencil.
const parts: ReadonlySet<string> = new Set<ReleasePart>([
  "name",
  "shipsOn",
  "cycles",
  "colour",
]);

const isPart = (key: string): key is ReleasePart => parts.has(key);

function ReleaseDetails({
  streams,
  rows: { shown, drafted, live },
  canEdit,
  onChange,
  note,
  notes,
  planned,
  activities,
  onFeatures,
  showIn,
}: {
  // Every schedule, which a release's Schedule is chosen from.
  streams: readonly ReleaseStream[];
  planned: PlannedFeatures | undefined;
  activities: ReleaseActivities | undefined;
  onFeatures: (at: FeaturesAt) => void;
  showIn: ShowIn;
  rows: ReleaseDetailRows;
  canEdit: boolean;
  onChange: (part: ReleasePart) => void;
  // What writing the release's note needs, which opens in a panel of its own that the page holds.
  note: ReleaseNote;
  notes: NoteOpening;
}) {
  const { draft } = drafted;
  const { closeStale, editingOf } = useRecordEditing<
    ReleaseRow,
    never,
    ReleaseNote
  >(notes);
  closeStale(note);
  return (
    <RecordSection id="release-details" title="Details">
      <ColumnRows
        columns={listingActivities(
          listingFeatures(
            drawnAs(
              releaseDetailColumns(
                streams,
                [shown, drafted, live],
                planned,
                activities?.activities,
              ),
              {
                cycles: ({ cycles, stream }) => (
                  <RecordLinkList
                    links={stream.cycles
                      .map(({ name, startsOn }) => ({
                        name,
                        id: cycleChoiceId(stream.id, startsOn),
                      }))
                      .filter(({ id }) => cycles.includes(id))
                      .map(({ id, name }) => ({
                        id,
                        name,
                        onShow: () => {
                          showIn("cycles", id);
                        },
                      }))}
                  />
                ),
                schedule: ({ stream }) => (
                  <RecordLink
                    name={stream.name}
                    onShow={() => {
                      showIn("schedules", stream.id);
                    }}
                  />
                ),
              },
            ),
            planned,
            {
              cyclesOf: ({ cycles }) => cycles,
              at: ({ stream, release }) => ({
                filter: {
                  key: releaseColumnKey,
                  value: releaseGroupKey(stream.id, release.id),
                },
                board: { stream: stream.id, from: release.firstCycle },
              }),
              onFeatures,
            },
          ),
          releaseActivityRow(activities),
        )}
        shown={shown}
        draft={draft}
        live={live}
        changeOf={(column) => {
          const { key } = column;
          return canEdit && isPart(key)
            ? () => {
                onChange(key);
              }
            : undefined;
        }}
      />
      <Row
        column={releaseNoteColumn}
        value={shown.note}
        changed={
          draft?.changed.includes(releaseNoteColumn.key) === true
            ? { draft }
            : undefined
        }
        editing={editingOf(note)(releaseNoteColumn)}
      />
    </RecordSection>
  );
}

// The selected release, beside the table.
function ReleasePanel({
  streams,
  release,
  rows,
  canEdit,
  narrow,
  onChange,
  note,
  notes,
  onClose,
  planned,
  activities,
  onFeatures,
  showIn,
}: {
  streams: readonly ReleaseStream[];
  release: Release;
  rows: ReleaseDetailRows;
  planned: PlannedFeatures | undefined;
  activities: ReleaseActivities | undefined;
  onFeatures: (at: FeaturesAt) => void;
  showIn: ShowIn;
  canEdit: boolean;
  narrow: boolean;
  onChange: (part: ReleasePart) => void;
  note: ReleaseNote;
  notes: NoteOpening;
  onClose: () => void;
}) {
  return (
    <RecordPanel
      id={panelId}
      titleId={releasePanelTitleId}
      recordId={release.id}
      title={rows.shown.name}
      subtitle={
        <RecordKey record={{ kind: "release", keyNumber: release.keyNumber }} />
      }
      narrow={narrow}
      draft={slotDraft(release.draft, releaseRowFields)}
      nameDraft={release.draft}
      heldBy={release.heldBy}
      onClose={onClose}
    >
      <ReleaseDetails
        key={release.id}
        streams={streams}
        rows={rows}
        canEdit={canEdit}
        onChange={onChange}
        note={note}
        notes={notes}
        planned={planned}
        activities={activities}
        onFeatures={onFeatures}
        showIn={showIn}
      />
    </RecordPanel>
  );
}

export function ReleasesTable({
  streams,
  day,
  view,
  onView,
  approves,
  saved,
  canEdit,
  narrow,
  open,
  onOpen,
  onClose,
  planned,
  activities,
  onFeatures,
  showIn,
  notes,
  notePanel,
  onChange,
  run,
  decide,
}: {
  // Every schedule, with its drafts, whatever the view.
  streams: readonly ReleaseStream[];
  day: string;
  view: View;
  onView: ChangeView;
  approves: readonly DraftKind[];
  saved: SavedViews;
  // Whether the user may change releases in the Draft view shown.
  canEdit: boolean;
  narrow: boolean;
  // The release whose details are open, if any.
  open: string | undefined;
  // Opens a release's details, then does what was asked with them, unless they cannot open now.
  onOpen: (id: string, opened?: () => void) => void;
  // Closes the release's details, given its ID.
  onClose: (id: string) => void;
  planned: PlannedFeatures | undefined;
  // A role's activities, for one that sees them.
  activities?: ReleaseActivities | undefined;
  onFeatures: (at: FeaturesAt) => void;
  showIn: ShowIn;
  // Opens a release's note, which the page holds, and its panel while one is open.
  notes: NoteOpening;
  notePanel: SidePanel | undefined;
  onChange: (
    stream: ReleaseStream,
    release: Release,
    part: ReleasePart,
  ) => void;
  run: (work: () => Promise<unknown>, done: string) => void;
  decide: (asking: Asking, selection: DraftSelection, all?: boolean) => void;
}) {
  const { show } = view;
  const everyRow = releaseRows(streams, show, day);
  const { rows, choices } = hiddenUnlessShown({
    rows: everyRow,
    hidden: ({ status }) => status !== "",
    choice: namedChoice("shipped"),
    label: "Show shipped",
    records: "Shipped releases",
    view,
  });
  const changeable = (stream: ReleaseStream, release: Release) =>
    canEdit &&
    release.heldBy === undefined &&
    release.draft?.action !== "deleted" &&
    !stream.retired;
  // What writing a release's note needs: its note as shown, and, for those who may change the
  // release, saving it as a draft.
  const noteContextOf = (
    stream: ReleaseStream,
    release: Release,
    shown: string,
  ): ReleaseNote => ({
    id: release.id,
    name: release.name,
    kind: "",
    values: { [releaseNoteColumn.key]: shown },
    save: changeable(stream, release)
      ? (_change, _column, value) => {
          const note = noteOf(value);
          run(
            () => saveReleaseNote(stream.id, release.id, note),
            note === ""
              ? `Drafted removing the note on ${release.name}.`
              : `Drafted the note on ${release.name}.`,
          );
        }
      : undefined,
    others: noOthers,
    recordProblem: () => undefined,
  });
  // A note asked for from a row's menu, opened once its release's details are.
  const noteAsked = useRef<string>(undefined);
  const table = releaseTable({
    streams,
    day,
    planned,
    activities: activities?.activities,
    changeable: (row) => !row.live && changeable(row.stream, row.release),
    onOpen: (release) => {
      onOpen(release.id);
    },
    menuItems: (row) => {
      const addsNote =
        !row.live &&
        changeable(row.stream, row.release) &&
        row.release.note === null;
      const activityRow = releaseActivityRow(activities);
      const showOn = activityRow && activitiesShowOn(activityRow, row);
      return (
        (addsNote || showOn !== undefined) && (
          <>
            {addsNote && (
              <Menu.Item
                onClick={() => {
                  if (open === row.id) {
                    notes.start(
                      noteContextOf(row.stream, row.release, ""),
                      releaseNoteColumn,
                    );
                  } else {
                    onOpen(row.id, () => {
                      noteAsked.current = row.id;
                    });
                  }
                }}
              >
                Add note…
              </Menu.Item>
            )}
            <ShowOnItem showOn={showOn} />
          </>
        )
      );
    },
  });
  const gridActions = {
    ...noRecordActions<ReleaseRow, never, undefined>(decide),
    remove: (row: ReleaseRow) => {
      run(
        () => removeFromStream(row.stream.id, "releases", row.id),
        `Drafted removing ${row.name}.`,
      );
    },
    ...ownDraftActions("release", run),
  };

  // A release named in the address opens even while shipped releases are hidden.
  const holding =
    open === undefined
      ? undefined
      : streams.find(({ releases }) => releases.some(({ id }) => id === open));
  const detail =
    holding === undefined
      ? undefined
      : releaseDetailRows(holding, open, show, day);
  const opened =
    holding === undefined || detail === undefined
      ? undefined
      : { stream: holding, release: detail.drafted.release, detail };
  const startAskedNote = useEffectEvent(() => {
    if (opened === undefined || noteAsked.current !== opened.release.id) {
      return;
    }
    noteAsked.current = undefined;
    notes.start(
      noteContextOf(opened.stream, opened.release, opened.detail.shown.note),
      releaseNoteColumn,
    );
  });
  useEffect(() => {
    startAskedNote();
  }, [opened?.release.id]);
  const panels =
    opened === undefined
      ? []
      : [
          {
            key: "release",
            id: panelId,
            name: "the release's panel",
            node: (
              <ReleasePanel
                key={opened.release.id}
                streams={streams}
                release={opened.release}
                rows={opened.detail}
                canEdit={changeable(opened.stream, opened.release)}
                narrow={narrow}
                onChange={(part) => {
                  onChange(opened.stream, opened.release, part);
                }}
                note={noteContextOf(
                  opened.stream,
                  opened.release,
                  opened.detail.shown.note,
                )}
                notes={notes}
                onClose={() => {
                  onClose(opened.release.id);
                }}
                planned={planned}
                activities={activities}
                onFeatures={onFeatures}
                showIn={showIn}
              />
            ),
          },
          ...(notePanel === undefined ? [] : [notePanel]),
        ];

  return (
    <ReleasesTabTable
      none={everyRow.length === 0 ? "No releases yet." : undefined}
      day={day}
      layerForm="releases"
      onOpenMark={markOpener(
        "release",
        (id) => {
          onOpen(id);
        },
        showIn,
      )}
      timelineOf={(shown) => {
        const listed = new Set(shown.map(({ id }) => id));
        // Each schedule holding a release the table shows, with only those releases.
        return inShownOrder(
          streams,
          shown.map(({ stream }) => stream.id),
        ).map((stream) => ({
          ...stream,
          releases: stream.releases.filter(({ id }) => listed.has(id)),
        }));
      }}
      records={rows}
      table={table}
      fields={[]}
      order={releaseColumnOrder}
      lists={[]}
      canEdit={canEdit}
      canAdd={false}
      canEditDrafts={canEdit}
      approves={approves}
      canEditColumns={false}
      actions={gridActions}
      view={view}
      onView={onView}
      selected={open}
      closeSelected={onClose}
      panels={panels}
      viewChoices={choices}
      saved={saved}
    />
  );
}

// A role's activities on Releases, for one that sees them.
export type ReleaseActivities = Omit<
  ActivityRow<ReleaseRow>,
  "owner" | "idOf" | "takesNoActivity"
>;

const releaseActivityRow = (
  activities: ReleaseActivities | undefined,
): ActivityRow<ReleaseRow> | undefined =>
  activities === undefined
    ? undefined
    : {
        ...activities,
        owner: "releaseId",
        idOf: ({ releaseId }) => releaseId,
        // A retired schedule's release is no longer offered for an activity.
        takesNoActivity: ({ release, stream }) =>
          release.draft?.action === "deleted" || stream.retired,
      };
