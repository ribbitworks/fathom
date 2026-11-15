// SPDX-License-Identifier: Apache-2.0

// The Releases page's table of release streams on the shared table: each stream's name, how its
// cycles are made now, its releases, the next to ship, and how far its cycles are made. A stream's
// row carries the drafts of its cycle changes and releases as well as its own, so its row is marked
// wherever any of them is, and each part is marked in its cell. Retired streams show only when
// asked for, and a stream drafted to be retired or restored stays where it is live until approved.

import type {
  CyclePattern,
  RecordDraft,
  RecordRef,
  ReleaseStream,
  Show,
} from "@fathom/shared";
import type { ReactNode } from "react";
import { decidable, type DraftSelection, noDrafts } from "./drafts.ts";
import { retiredLive } from "./lists.ts";
import { draftFieldsOf } from "./project-grids.tsx";
import {
  type Column,
  fieldColumn,
  type GridDraft,
  type GridRecord,
  type RecordTable,
  type RowGrouping,
  undoDrafts,
} from "./record-grid.tsx";
import {
  draftedStreams,
  keptReleases,
  liveStreams,
  markedDraft,
  releaseDate,
} from "./releases.ts";
import {
  DraftedItem,
  EmptiedValue,
  MarkedItem,
  partsMark,
  type DraftLike,
  useBesideLive,
} from "./status-mark.tsx";
import { LiveParts, Parts, type SummaryPart } from "./summary-row.tsx";
import { formatDay } from "./table-view.ts";

export const patternWords = (pattern: CyclePattern) =>
  `Every ${String(pattern.length)} ${pattern.unit === "weeks" ? "week" : "month"}${pattern.length === 1 ? "" : "s"}, named ${pattern.naming}`;

// The pattern in force on a day, or the first, when none has started yet.
export function patternOn(
  stream: ReleaseStream,
  day: string,
): CyclePattern | undefined {
  const kept = stream.patterns.filter(
    ({ draft }) => draft?.action !== "deleted",
  );
  return kept.filter(({ startsOn }) => startsOn <= day).at(-1) ?? kept[0];
}

// What a row shows of its stream, by column key, as a draft's live values hold it too.
interface StreamValues {
  name: string;
  schedule: string;
  releases: string;
  nextRelease: string;
  cyclesUntil: string;
}

export interface StreamRow extends GridRecord, StreamValues {
  draft?: (GridDraft & { live: StreamValues }) | undefined;
  stream: ReleaseStream;
  // The marks of the stream's cycle changes and releases, and its releases as the row lists them,
  // worked out from every draft, so the Draft view decides how they show.
  scheduleMark: DraftLike | undefined;
  releasesMark: DraftLike | undefined;
  parts: readonly SummaryPart[];
  live: boolean;
}

// A stream with no cycles yet, in its group's heading; its cell is blank, as every empty cell is.
const noSchedule = "None";

// The release that ships next, on or after a day, of those not removed.
function nextRelease(stream: ReleaseStream, day: string) {
  return keptReleases(stream)
    .flatMap((release) => {
      const ships = releaseDate(stream, release);
      return ships !== undefined && ships >= day ? [{ release, ships }] : [];
    })
    .sort((one, other) => one.ships.localeCompare(other.ships))
    .at(0);
}

const nextReleaseWords = (stream: ReleaseStream, day: string) => {
  const next = nextRelease(stream, day);
  return next === undefined
    ? ""
    : `${next.release.name}, ships ${formatDay(next.ships)}`;
};

function valuesOf(stream: ReleaseStream, day: string): StreamValues {
  const now = patternOn(stream, day);
  return {
    name: stream.name,
    schedule: now === undefined ? "" : patternWords(now),
    releases: keptReleases(stream)
      .map(({ name }) => name)
      .join(", "),
    nextRelease: nextReleaseWords(stream, day),
    cyclesUntil: stream.cyclesUntil,
  };
}

const isRejected = ({ state }: { state: string }) => state === "rejected";

// The drafts of records, leaving out rejected ones where the view does.
const draftsOf = (
  records: readonly { draft?: RecordDraft | undefined }[],
  leaveOutRejected: boolean,
) =>
  records.flatMap(({ draft }) =>
    draft === undefined || (leaveOutRejected && isRejected(draft))
      ? []
      : [draft],
  );

// The latest of several drafts, by when each was last changed.
const latest = (drafts: readonly RecordDraft[]) =>
  drafts.reduce((one, other) =>
    (other.madeAt ?? "") > (one.madeAt ?? "") ? other : one,
  );

const waitingIn = (drafts: readonly DraftLike[]) =>
  drafts.some(({ state }) => state === "waiting");

// The row's draft, for its marks alone: the stream's own, with the columns whose values its parts'
// drafts change, or, when only its parts have drafts, one standing for those that change a value the
// row shows, credited to whoever changed them last. A part's draft that changes nothing the row
// shows, such as a release's colour, leaves the row unmarked but for the dot before its parts.
function rowDraft(
  stream: ReleaseStream,
  values: StreamValues,
  live: StreamValues,
  leaveOutRejected: boolean,
): StreamRow["draft"] {
  const patterns = draftsOf(stream.patterns, leaveOutRejected);
  const releases = draftsOf(stream.releases, leaveOutRejected);
  const own =
    leaveOutRejected && stream.draft !== undefined && isRejected(stream.draft)
      ? undefined
      : markedDraft(stream.draft, stream.retired);
  const byColumn = [
    {
      key: "schedule",
      drafts: patterns,
      differs: values.schedule !== live.schedule,
    },
    {
      key: "releases",
      drafts: releases,
      differs: values.releases !== live.releases,
    },
    {
      // Moving a release, or a change to its cycles, can change which release ships next.
      key: "nextRelease",
      drafts: [...patterns, ...releases],
      differs: values.nextRelease !== live.nextRelease,
    },
  ];
  const changedParts = byColumn.filter(
    ({ drafts, differs }) =>
      differs && (drafts.length > 0 || own !== undefined),
  );
  const parts = [...new Set(changedParts.flatMap(({ drafts }) => drafts))];
  if (own !== undefined) {
    return {
      ...own,
      changed: [...own.changed, ...changedParts.map(({ key }) => key)],
      live,
    };
  }
  if (parts.length === 0) return undefined;
  const last = latest(parts);
  return {
    action: "changed",
    state: waitingIn(parts) ? "waiting" : "rejected",
    changed: changedParts.map(({ key }) => key),
    madeBy: last.madeBy,
    madeAs: last.madeAs,
    changedBy: Object.fromEntries(
      changedParts.map(({ key, drafts }) => [key, latest(drafts).madeBy]),
    ),
    unpublished: parts.every(({ unpublished }) => unpublished === true),
    needsOtherApprover: parts.some(
      ({ needsOtherApprover }) => needsOtherApprover === true,
    ),
    live,
  };
}

// Each stream's row, from every stream with its drafts, as the Draft view shows it: with every draft
// beside live, as they will make it with them applied, leaving out rejected ones, and as it is with
// every draft under Live only, whose rows the table makes live itself.
export function streamRows(
  streams: readonly ReleaseStream[],
  show: Show,
  day: string,
): StreamRow[] {
  const leaveOutRejected = show === "drafts";
  return streams.map((stream) => {
    const [shown = stream] = leaveOutRejected ? draftedStreams([stream]) : [];
    const values = valuesOf(shown, day);
    const [live] = liveStreams([stream]);
    const draft = rowDraft(
      stream,
      values,
      live === undefined ? values : valuesOf(live, day),
      leaveOutRejected,
    );
    const releases = leaveOutRejected
      ? undoDrafts(stream.releases, isRejected)
      : stream.releases;
    return {
      id: stream.id,
      ...values,
      heldBy: stream.heldBy,
      ...(draft === undefined ? {} : { draft }),
      stream: shown,
      scheduleMark: partsMark(draftsOf(stream.patterns, leaveOutRejected)),
      releasesMark: partsMark(draftsOf(stream.releases, leaveOutRejected)),
      parts: releases.map((release) => ({
        id: release.id,
        name: release.name,
        removed: release.draft?.action === "deleted",
      })),
      live: false,
    };
  });
}

// Each row as its stream is live, without drafts, from the stream with every draft, keeping the
// marks of its parts' drafts.
const liveRows = (
  rows: readonly StreamRow[],
  streams: readonly ReleaseStream[],
  day: string,
): StreamRow[] =>
  rows.flatMap((row) =>
    liveStreams(streams.filter(({ id }) => id === row.id)).map((stream) => ({
      ...row,
      ...valuesOf(stream, day),
      draft: undefined,
      stream,
      parts: stream.releases.map(({ id, name }) => ({
        id,
        name,
        removed: false,
      })),
      live: true,
    })),
  );

// A cell of a stream's parts, such as its releases, marked by their drafts, or, in its Live row
// beside live, as they are live, after Live's dot where drafts change them.
function ShownOrLive({
  row,
  shown,
  live,
}: {
  row: StreamRow;
  shown: ReactNode;
  live: ReactNode;
}) {
  const besideLive = useBesideLive();
  return row.live && besideLive ? live : shown;
}

// An empty schedule is blank, unless a draft fills or empties it, when the empty side says so.
function scheduleCell(row: StreamRow) {
  const mark = row.scheduleMark;
  const words =
    mark !== undefined && row.schedule === "" ? (
      <EmptiedValue name="cycles" />
    ) : (
      row.schedule
    );
  return (
    <ShownOrLive
      row={row}
      shown={<DraftedItem draft={mark}>{words}</DraftedItem>}
      live={
        <MarkedItem tone={mark === undefined ? undefined : "live"}>
          {words}
        </MarkedItem>
      }
    />
  );
}

function releasesCell(row: StreamRow) {
  return (
    <ShownOrLive
      row={row}
      shown={<Parts mark={row.releasesMark} parts={row.parts} />}
      live={
        <LiveParts
          marked={row.releasesMark !== undefined}
          names={row.parts.map(({ name }) => name)}
        />
      }
    />
  );
}

const statusGroups = {
  current: { key: "current", label: "Current", rank: 0 },
  retired: { key: "retired", label: "Retired", rank: 1 },
};

const groupings: RowGrouping<StreamRow>[] = [
  {
    key: "status",
    label: "Status",
    of: (row) =>
      retiredLive(row.stream) ? statusGroups.retired : statusGroups.current,
  },
  {
    key: "schedule",
    label: "Cycle schedule",
    of: ({ schedule }) => ({
      key: schedule,
      label: schedule === "" ? noSchedule : schedule,
      rank: schedule === "" ? 1 : 0,
    }),
  },
];

function columns(): Column<StreamRow, never>[] {
  const text = (key: keyof StreamValues, label: string) =>
    fieldColumn<StreamRow, never>(key, "text", {
      label,
      required: false,
      multiple: false,
      choices: [],
    });
  return [
    text("name", "Stream"),
    {
      ...text("schedule", "Cycle schedule"),
      emptyLabel: noSchedule,
      marksParts: true,
      content: scheduleCell,
    },
    {
      ...text("releases", "Releases"),
      breaksDown: false,
      marksParts: true,
      content: releasesCell,
    },
    { ...text("nextRelease", "Next release"), breaksDown: false },
    {
      ...fieldColumn<StreamRow, never>("cyclesUntil", "date", {
        label: "Planned to",
        required: false,
        multiple: false,
        choices: [],
      }),
      breaksDown: false,
    },
  ];
}

export const streamColumnOrder = [
  "name",
  "schedule",
  "releases",
  "nextRelease",
  "cyclesUntil",
];

const decidableRefs = (
  type: RecordRef["type"],
  records: readonly {
    id: string;
    draft?: RecordDraft | undefined;
    heldBy?: string | undefined;
  }[],
): RecordRef[] => records.filter(decidable).map(({ id }) => ({ type, id }));

// The table of streams, read only: streams are changed in their panel.
export function streamTable({
  streams,
  day,
  onOpen,
}: {
  // Every stream, with its drafts, whatever the view.
  streams: readonly ReleaseStream[];
  day: string;
  onOpen: (stream: ReleaseStream) => void;
}): RecordTable<StreamRow, never, undefined> {
  const shownColumns = columns();
  const drafts = (ids: string[]): DraftSelection => ({
    ...noDrafts(),
    records: streams
      .filter(({ id }) => ids.includes(id))
      .flatMap((stream) => [
        ...decidableRefs("release-stream", [stream]),
        ...decidableRefs("cycle-pattern", stream.patterns),
        ...decidableRefs("release", stream.releases),
      ]),
  });
  return {
    label: "Release streams",
    one: "release stream",
    noun: "release streams",
    groupings,
    newRowLabel: () => "New release stream",
    removeLabel: () => "Remove release stream",
    nameOf: (row) => row.name,
    nameColumn: "name",
    showDetails: (row) => {
      onOpen(row.stream);
    },
    columnsFor: () => shownColumns,
    liveRecords: (rows) => liveRows(rows, streams, day),
    draftFields: (row, draft) => draftFieldsOf(shownColumns, row, draft),
    recordProblem: () => undefined,
    request: () => undefined,
    drafts,
    decidable: (row) => drafts([row.id]).records.length > 0,
  };
}

// Whether a stream shows while retired streams are hidden: it is retired only once its retirement is
// approved.
export const shownUnlessRetired = (stream: ReleaseStream) =>
  !retiredLive(stream);
