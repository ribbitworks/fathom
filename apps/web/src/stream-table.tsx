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
import {
  creditedBy,
  decidable,
  differingKeys,
  type DraftSelection,
  latestDraft,
  noDrafts,
} from "./drafts.ts";
import { retiredLive } from "./lists.ts";
import { draftFieldsOf } from "./project-grids.tsx";
import { cycleChoiceId } from "./projects.ts";
import { featuresColumn, type PlannedFeatures } from "./release-tabs.ts";
import {
  type Column,
  fieldColumn,
  type GridDraft,
  type GridRecord,
  readOnlyTableParts,
  type RecordTable,
  type RowGrouping,
  withLiveCopies,
  wordsColumn,
} from "./record-grid.tsx";
import {
  draftedStreams,
  liveStreams,
  markedDraft,
  shownColour,
  streamNames,
} from "./releases.ts";
import {
  currentCycle,
  cycleChanges,
  lengthNow,
  nextRelease,
} from "./schedules.ts";
import { EndedBox, type DraftLike } from "./status-mark.tsx";

// What a row shows of its schedule, by column key, as a draft's live values hold it too.
interface StreamValues {
  name: string;
  currentCycle: string;
  // Not a column: the current cycle by its choice, which its features are found by.
  currentCycleId: string;
  cycleStarts: string;
  cycleEnds: string;
  nextRelease: string;
  // Not a column: the next release's colour, so a draft changing it marks Next release.
  nextReleaseColour: string;
  // Not a column: the next release's identifier, which its link opens it by.
  nextReleaseId: string;
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
    currentCycleId:
      now === undefined ? "" : cycleChoiceId(stream.id, now.startsOn),
    cycleStarts: now?.startsOn ?? "",
    cycleEnds: now?.endsOn ?? "",
    nextRelease: next?.release.name ?? "",
    nextReleaseColour: next?.release.colour ?? "",
    nextReleaseId: next?.release.id ?? "",
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
  const differs = (keys: readonly (keyof StreamValues)[]) =>
    differingKeys(values, live, keys);
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
  const last = latestDraft(parts);
  if (last === undefined) return undefined;
  return {
    action: "changed",
    state: waitingIn(parts) ? "waiting" : "rejected",
    changed: changedParts.map(({ key }) => key),
    madeBy: last.madeBy,
    madeAs: last.madeAs,
    changedBy: creditedBy(changedParts),
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
  const drafts = cycleChanges(stream, show === "drafts").map(
    ({ record }) => record.draft,
  );
  return {
    shown: show === "live" ? live : drafted,
    drafted,
    live,
    cyclesDraft: latestDraft(drafts),
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

// The table's columns, in its order, which a schedule's details show too, given the schedules the
// table can show, whose names, current cycles, next releases and cycle lengths their filters offer.
export function streamColumns(
  day: string,
  records: readonly StreamRow[],
  planned?: PlannedFeatures,
): Column<StreamRow, never>[] {
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
  // A column listing the words its rows hold, one each or none.
  const listColumn = (key: StreamColumnKey, label: string) => ({
    ...wordsColumn<StreamRow, never>(key, label, records),
    breaksDown: false,
  });
  return [
    {
      ...wordsColumn<StreamRow, never>("name", "Schedule", records, {
        required: true,
      }),
      mark: (row) => <EndedBox stream={row.stream} day={day} />,
    },
    listColumn("currentCycle", "Current cycle"),
    valueColumn("cycleStarts", "Cycle starts", "date"),
    valueColumn("cycleEnds", "Cycle ends", "date"),
    ...(planned === undefined
      ? []
      : [
          featuresColumn<StreamValues, StreamRow>(
            "Features this cycle",
            planned,
            ({ currentCycleId }) => [currentCycleId],
            // A draft moving the current cycle moves its first day.
            "cycleStarts",
          ),
        ]),
    {
      ...listColumn("nextRelease", "Next release"),
      colour: (row) => {
        const next = nextRelease(row.stream, day);
        return next === undefined ? null : shownColour(next.release.colour);
      },
    },
    valueColumn("releaseDate", "Release date", "date"),
    listColumn("lengthNow", "Cycle length"),
    valueColumn("endsOn", "Schedule ends", "date", "No end date"),
  ];
}

export const streamColumnOrder = [
  "name",
  "currentCycle",
  "cycleStarts",
  "cycleEnds",
  "features",
  "nextRelease",
  "releaseDate",
  "lengthNow",
  "endsOn",
];

// The records whose drafts can be decided now, as decisions name them.
export const decidableRefs = (
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
  planned,
}: {
  // Every stream, with its drafts, whatever the view.
  streams: readonly ReleaseStream[];
  day: string;
  planned?: PlannedFeatures | undefined;
  onOpen: (stream: ReleaseStream) => void;
  // What else a schedule's menu offers, such as retiring it.
  menuItems?: ((row: StreamRow) => ReactNode) | undefined;
}): RecordTable<StreamRow, never, undefined> {
  // A draft's menu words a schedule's values as drafted and as they are live.
  const describedColumns = (row: StreamRow) =>
    streamColumns(day, withLiveCopies([row]), planned);
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
    ownDraft: (row) => (row.stream.draft === undefined ? undefined : row.draft),
    ...(menuItems === undefined ? {} : { menuItems }),
    nameOf: (row) => row.name,
    nameColumn: "name",
    showDetails: (row) => {
      onOpen(row.stream);
    },
    keyOf: streamKeyOf,
    columnsFor: (_fields, _lists, _order, records) =>
      streamColumns(day, records, planned),
    liveRecords: (rows) => liveRows(rows, streams, day),
    draftFields: (row, draft) =>
      draftFieldsOf(describedColumns(row), row, draft),
    drafts,
    decidable: (row) => drafts([row.id]).records.length > 0,
  };
}

// Whether a stream shows while retired streams are hidden: it is retired only once its retirement is
// approved.
export const shownUnlessRetired = (stream: ReleaseStream) =>
  !retiredLive(stream);
