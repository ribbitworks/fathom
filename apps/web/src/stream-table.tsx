// SPDX-License-Identifier: Apache-2.0

// The Schedules tab's table on the shared table: each schedule's name, with Ended after it once its
// last day has passed, its current cycle with its first and last days, the release that ships next
// and its day, how long its cycles last now, and its last day. A schedule's row carries the drafts
// of its cycle changes and releases as well as its own, so its row is marked wherever any of them
// changes what it shows. Retired schedules show only when asked for, and a schedule drafted to be
// retired or restored stays where it is live until approved.

import {
  capitalized,
  hasEnded,
  type RecordDraft,
  type RecordKeyOf,
  type RecordRef,
  type ReleaseStream,
  type Show,
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
  readOnlyTableParts,
  type RecordTable,
  type RowGrouping,
} from "./record-grid.tsx";
import {
  draftedStreams,
  liveStreams,
  markedDraft,
  shownColour,
  streamNames,
} from "./releases.ts";
import { currentCycle, lengthNow, nextRelease } from "./schedules.ts";
import { EndedBox, type DraftLike } from "./status-mark.tsx";

// What a row shows of its schedule, by column key, as a draft's live values hold it too.
interface StreamValues {
  name: string;
  currentCycle: string;
  cycleStarts: string;
  cycleEnds: string;
  nextRelease: string;
  // Not a column: the next release's colour, so a draft changing it marks Next release.
  nextReleaseColour: string;
  releaseDate: string;
  lengthNow: string;
  endsOn: string;
}

export interface StreamRow extends GridRecord, StreamValues {
  draft?: (GridDraft & { live: StreamValues }) | undefined;
  stream: ReleaseStream;
  live: boolean;
}

function valuesOf(stream: ReleaseStream, day: string): StreamValues {
  const now = currentCycle(stream, day);
  const next = nextRelease(stream, day);
  return {
    name: stream.name,
    currentCycle: now?.name ?? "",
    cycleStarts: now?.startsOn ?? "",
    cycleEnds: now?.endsOn ?? "",
    nextRelease: next?.release.name ?? "",
    nextReleaseColour: next?.release.colour ?? "",
    releaseDate: next?.ships ?? "",
    lengthNow: lengthNow(stream, day),
    endsOn: stream.endsOn ?? "",
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

// The row's draft, for its marks alone: the schedule's own, with the columns whose values its parts'
// drafts change, or, when only its parts have drafts, one standing for those that change a value the
// row shows, the next release's colour included, credited to whoever changed them last. A part's
// draft that changes nothing the row shows, such as a later release's colour, leaves it unmarked.
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
  const shownNow = new Map(Object.entries(values));
  const liveNow = new Map(Object.entries(live));
  const differs = (keys: readonly (keyof StreamValues)[]) =>
    keys.filter((key) => shownNow.get(key) !== liveNow.get(key));
  // A change of cycles can change the current cycle, how long cycles last, and, moving releases,
  // which ships next; a release's draft can change which ships next and when.
  const byColumn = [
    ...differs(["currentCycle", "cycleStarts", "cycleEnds", "lengthNow"]).map(
      (key) => ({ key, drafts: patterns }),
    ),
    ...[
      ...differs(["nextRelease", "releaseDate"]),
      ...(values.nextRelease === live.nextRelease &&
      values.nextReleaseColour !== live.nextReleaseColour
        ? (["nextRelease"] as const)
        : []),
    ].map((key) => ({
      key,
      drafts: [...patterns, ...releases],
    })),
  ];
  const changedParts = byColumn.filter(
    ({ drafts }) => drafts.length > 0 || own !== undefined,
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
    return {
      id: stream.id,
      ...values,
      heldBy: stream.heldBy,
      ...(draft === undefined ? {} : { draft }),
      stream: shown,
      live: false,
    };
  });
}

// Each row as its schedule is live, without drafts, from the schedule with every draft.
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
      live: true,
    })),
  );

// A schedule's row for its details: as the Draft view shows it, with its drafts, whatever the view,
// which its marks are worked out from, and as it is live, or, while it is only drafted to be added,
// as drafted, so nothing in it is marked beside its own mark; and the latest draft of its cycles,
// which marks those it changes.
export interface ScheduleRows {
  shown: StreamRow;
  drafted: StreamRow;
  live: StreamRow;
  cyclesDraft: RecordDraft | undefined;
}

export function scheduleRows(
  stream: ReleaseStream,
  show: Show,
  day: string,
): ScheduleRows {
  const [drafted] = streamRows([stream], show, day) as [StreamRow];
  const live = liveRows([drafted], [stream], day).at(0) ?? drafted;
  const ownEnd =
    stream.draft?.action === "changed" &&
    stream.draft.changed.includes("endsOn")
      ? [stream.draft]
      : [];
  const drafts = draftsOf(
    [...ownEnd.map((draft) => ({ draft })), ...stream.patterns],
    show === "drafts",
  );
  return {
    shown: show === "live" ? live : drafted,
    drafted,
    live,
    cyclesDraft: drafts.length === 0 ? undefined : latest(drafts),
  };
}

const statusGroups = {
  current: { key: "current", label: "Current", rank: 0 },
  ended: { key: "ended", label: "Ended", rank: 1 },
  retired: { key: "retired", label: "Retired", rank: 2 },
};

// A stream's status: retired once its retirement is approved, or else ended once its last day has
// passed, or else current.
const statusOf = (stream: ReleaseStream, day: string) => {
  if (retiredLive(stream)) return statusGroups.retired;
  return hasEnded(stream, day) ? statusGroups.ended : statusGroups.current;
};

const groupings = (day: string): RowGrouping<StreamRow>[] => [
  {
    key: "status",
    label: "Status",
    of: (row) => [statusOf(row.stream, day)],
  },
];

type StreamColumnKey = Exclude<keyof StreamValues, "nextReleaseColour">;

// The table's columns, in its order, which a schedule's details show too.
export function streamColumns(day: string): Column<StreamRow, never>[] {
  const column = (
    key: StreamColumnKey,
    label: string,
    kind: "text" | "date",
    emptyLabel?: string,
  ) =>
    fieldColumn<StreamRow, never>(key, kind, {
      label,
      required: false,
      multiple: false,
      choices: [],
      ...(emptyLabel === undefined ? {} : { emptyLabel }),
    });
  // A column with a value of its own for nearly every schedule, not worth breaking down by.
  const valueColumn = (...args: Parameters<typeof column>) => ({
    ...column(...args),
    breaksDown: false,
  });
  return [
    {
      ...column("name", "Schedule", "text"),
      headingHidden: true,
      mark: (row) => <EndedBox stream={row.stream} day={day} />,
    },
    valueColumn("currentCycle", "Current cycle", "text"),
    valueColumn("cycleStarts", "Cycle starts", "date"),
    valueColumn("cycleEnds", "Cycle ends", "date"),
    {
      ...valueColumn("nextRelease", "Next release", "text"),
      colour: (row) => {
        const next = nextRelease(row.stream, day);
        return next === undefined ? null : shownColour(next.release.colour);
      },
    },
    valueColumn("releaseDate", "Release date", "date"),
    valueColumn("lengthNow", "Cycle length", "text"),
    valueColumn("endsOn", "Schedule ends", "date", "No end date"),
  ];
}

export const streamColumnOrder = [
  "name",
  "currentCycle",
  "cycleStarts",
  "cycleEnds",
  "nextRelease",
  "releaseDate",
  "lengthNow",
  "endsOn",
];

const decidableRefs = (
  type: RecordRef["type"],
  records: readonly {
    id: string;
    draft?: RecordDraft | undefined;
    heldBy?: string | undefined;
  }[],
): RecordRef[] => records.filter(decidable).map(({ id }) => ({ type, id }));

// Made once, so the table's Key column is made again only when the streams change.
const streamKeyOf = (row: StreamRow): RecordKeyOf => ({
  kind: "schedule",
  keyNumber: row.stream.keyNumber,
});

// The table of streams, read only: streams are changed in their panel.
export function streamTable({
  streams,
  day,
  onOpen,
  menuItems,
}: {
  // Every stream, with its drafts, whatever the view.
  streams: readonly ReleaseStream[];
  day: string;
  onOpen: (stream: ReleaseStream) => void;
  // What else a schedule's menu offers, such as retiring it.
  menuItems?: ((row: StreamRow) => ReactNode) | undefined;
}): RecordTable<StreamRow, never, undefined> {
  const shownColumns = streamColumns(day);
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
    ...readOnlyTableParts,
    label: capitalized(streamNames.noun),
    one: streamNames.one,
    noun: streamNames.noun,
    groupings: groupings(day),
    ungrouped: true,
    ownDraft: (row) => (row.stream.draft === undefined ? undefined : row.draft),
    ...(menuItems === undefined ? {} : { menuItems }),
    nameOf: (row) => row.name,
    nameColumn: "name",
    showDetails: (row) => {
      onOpen(row.stream);
    },
    keyOf: streamKeyOf,
    columnsFor: () => shownColumns,
    liveRecords: (rows) => liveRows(rows, streams, day),
    draftFields: (row, draft) => draftFieldsOf(shownColumns, row, draft),
    drafts,
    decidable: (row) => drafts([row.id]).records.length > 0,
  };
}

// Whether a stream shows while retired streams are hidden: it is retired only once its retirement is
// approved.
export const shownUnlessRetired = (stream: ReleaseStream) =>
  !retiredLive(stream);
