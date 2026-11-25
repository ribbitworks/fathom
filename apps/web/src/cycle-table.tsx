// SPDX-License-Identifier: Apache-2.0

// The Cycles tab's table on the shared table, read only: each cycle of every schedule, its schedule,
// its first and last days, Current on the one holding today, and the release that includes it, after
// its colour's square. The rows can be grouped by schedule. A cycle's row is marked where a
// draft of its schedule's cycles changes it, adds it or removes it, and its menu decides, discards
// or resubmits that draft, which may change other cycles too, deciding the release's own draft with
// it where that changes the cycle as well, or alone where the change behind it can't be decided.

import {
  withSchedule,
  type Choice,
  type Cycle,
  draftKey,
  type DraftKind,
  type RecordRef,
  type ReleaseStream,
  type Show,
} from "@fathom/shared";
import { formatDay } from "./day-formats.ts";
import {
  creditedBy,
  decidable,
  differingKeys,
  mayDecide,
  noDrafts,
} from "./drafts.ts";
import { isCurrent } from "./feature-board.ts";
import { choice } from "./lists.ts";
import { draftFieldsOf } from "./plan-table.tsx";
import { cycleChoiceId } from "./projects.ts";
import {
  choicesNamed,
  fieldColumn,
  withLiveCopies,
  wordsColumn,
} from "./grid-columns.tsx";
import {
  type Column,
  type GridDraft,
  type GridRecord,
  readOnlyTableParts,
  type RecordTable,
} from "./record-table.ts";
import {
  cycleNamed,
  draftedStreams,
  includesCycle,
  keptReleases,
  liveStreams,
  nameCounts,
  releaseListNames,
  scheduledNames,
  shownColour,
} from "./releases.ts";
import {
  bySchedule,
  type DetailRows,
  detailRows,
  featuresColumn,
  type PlannedFeatures,
  scheduleColumn,
} from "./release-tabs.ts";
import {
  changeBehind,
  type CycleChange,
  cycleChanges,
  type CycleTwin,
  cycleTwins,
  durationWords,
  unitOf,
} from "./schedules.ts";

// What a row shows of its cycle, by column key, as a draft's live values hold it too, with what only
// a cycle's details show.
interface CycleValues {
  // The cycle's own identifier, which its Cycle filter chooses it by.
  cycleId: string;
  name: string;
  schedule: string;
  startsOn: string;
  endsOn: string;
  current: string;
  // The release that includes the cycle, by its identifier, with its name and colour.
  release: string;
  releaseName: string;
  releaseColour: string;
  duration: string;
}

// A cycle's draft: that of the change behind it, as it changes the cycle, and the record the change
// is the draft of, which the row's menu decides, discards or resubmits; with the waiting draft of
// the cycle's own release, where that changes the cycle's Release as well, which the menu decides
// too, though the change behind it was rejected.
export type CycleDraft = GridDraft & {
  live: CycleValues;
  ref: RecordRef;
  release?: (Waiting & { name: string }) | undefined;
};

interface Waiting {
  ref: RecordRef;
  decidable: boolean;
  needsOtherApprover: boolean;
}

export interface CycleRow extends GridRecord, CycleValues {
  draft?: CycleDraft | undefined;
  stream: ReleaseStream;
  cycle: Cycle;
  // The cycle as it is live, in its schedule as it is live, unless only a draft adds it.
  twin: { stream: ReleaseStream; cycle: Cycle } | undefined;
  // What its draft is, as its menu says, where it has one.
  subject: string;
  live: boolean;
}

const currentChoice = choice("current", "Current", false);

function valuesOf(
  stream: ReleaseStream,
  cycle: Cycle,
  day: string,
): CycleValues {
  const release = keptReleases(stream).find((each) =>
    includesCycle(each, cycle.startsOn),
  );
  return {
    cycleId: cycleChoiceId(stream.id, cycle.startsOn),
    name: cycle.name,
    schedule: stream.id,
    startsOn: cycle.startsOn,
    endsOn: cycle.endsOn,
    current: isCurrent(cycle, day) ? currentChoice.id : "",
    release: release?.id ?? "",
    releaseName: release?.name ?? "",
    releaseColour: release === undefined ? "" : shownColour(release.colour),
    duration: durationWords(cycle, unitOf(stream, cycle)),
  };
}

// What a removed cycle's identifier ends with, as a cycle shown may start on its first day.
export const removedCycleMark = " removed";

// A removed cycle's values, with an identifier of its own.
const removedValues = (values: CycleValues): CycleValues => ({
  ...values,
  cycleId: `${values.cycleId}${removedCycleMark}`,
});

const refKey = ({ type, id }: RecordRef) => draftKey(type, id);

// The values a draft is said to change; a cycle's identifier changes with its first day.
const shownKeys: readonly (keyof CycleValues)[] = [
  "name",
  "schedule",
  "startsOn",
  "endsOn",
  "current",
  "release",
  "releaseName",
  "releaseColour",
  "duration",
];

// What a change says it is, in a cycle's menu.
const subjectOf = (stream: ReleaseStream, change: CycleChange) =>
  change.startsOn === undefined
    ? `Part of a change to when ${stream.name} ends`
    : `Part of a change to the cycles of ${stream.name} from ${cycleNamed(stream, change.startsOn)}`;

// The values of a cycle that come from the release including it.
const releaseKeys: ReadonlySet<string> = new Set<keyof CycleValues>([
  "release",
  "releaseName",
  "releaseColour",
]);

// The draft of the release a cycle is in, as drafted, or else as it is live, as the change behind
// the cycle's Release. A view leaving rejected drafts out leaves the cycle's values unchanged by
// one, so it marks nothing.
function releaseChange(
  stream: ReleaseStream,
  releaseIds: readonly string[],
): (CycleChange & { name: string }) | undefined {
  const release = releaseIds
    .map((id) => stream.releases.find((each) => each.id === id))
    .find((each) => each?.draft !== undefined);
  return release?.draft === undefined
    ? undefined
    : {
        ref: { type: "release", id: release.id },
        record: {
          id: release.id,
          draft: release.draft,
          heldBy: release.heldBy,
        },
        startsOn: undefined,
        name: release.name,
      };
}

// A row's draft, who holds the record it is the draft of, and what it is: the change behind the
// cycle, where it adds or removes the cycle, or changes a value of it; or, where it changes only
// what the cycle shows of its release, that release's draft. Where both change the cycle and it
// stays in the same release, the row carries the change behind it, crediting the Release to the
// release's draft.
function marksOf(
  stream: ReleaseStream,
  change: CycleChange | undefined,
  action: CycleDraft["action"],
  values: CycleValues,
  live: CycleValues,
  ofRelease?: CycleChange & { name: string },
): Pick<CycleRow, "draft" | "heldBy" | "subject" | "cellDrafts"> {
  const differing =
    action === "changed" ? differingKeys(values, live, shownKeys) : [];
  // The Release column shows the release's name, so a new name changes it.
  const changed =
    differing.includes("releaseName") && !differing.includes("release")
      ? [...differing, "release"]
      : differing;
  const ofReleaseKeys = changed.filter((key) => releaseKeys.has(key));
  const byRelease =
    action === "changed" &&
    ofRelease !== undefined &&
    changed.length > 0 &&
    ofReleaseKeys.length === changed.length;
  const releaseBehind = byRelease ? ofRelease : undefined;
  const behind = releaseBehind ?? change;
  if (behind === undefined || (action === "changed" && changed.length === 0)) {
    return { subject: "" };
  }
  // Only the cycle's own release is credited, so approving the row never decides another
  // release's draft.
  const alsoRelease =
    !byRelease &&
    action === "changed" &&
    values.release === live.release &&
    ofReleaseKeys.length > 0
      ? ofRelease
      : undefined;
  return {
    draft: {
      ...behind.record.draft,
      action,
      changed,
      live,
      ref: behind.ref,
      ...(alsoRelease === undefined
        ? {}
        : {
            changedBy: {
              ...behind.record.draft.changedBy,
              ...creditedBy(
                ofReleaseKeys.map((key) => ({
                  key,
                  drafts: [alsoRelease.record.draft],
                })),
              ),
            },
            release:
              alsoRelease.record.draft.state === "waiting"
                ? {
                    ref: alsoRelease.ref,
                    name: alsoRelease.name,
                    decidable: decidable(alsoRelease.record),
                    needsOtherApprover:
                      alsoRelease.record.draft.needsOtherApprover === true,
                  }
                : undefined,
          }),
    },
    heldBy: behind.record.heldBy,
    // The Release, which the release's own draft changes, is marked by that draft alone.
    ...(alsoRelease === undefined
      ? {}
      : {
          cellDrafts: new Map(
            ofReleaseKeys.map((key) => [
              key,
              {
                ...alsoRelease.record.draft,
                action: "changed" as const,
                changed: [key],
                changedBy: creditedBy([
                  { key, drafts: [alsoRelease.record.draft] },
                ]),
                live,
                ref: alsoRelease.ref,
              },
            ]),
          ),
        }),
    subject:
      releaseBehind === undefined
        ? subjectFor(stream, behind, alsoRelease)
        : `Part of a change to ${releaseBehind.name}`,
  };
}

// What a row's draft is, in its menu: the change behind the cycle, with the release's change too.
function subjectFor(
  stream: ReleaseStream,
  behind: CycleChange,
  alsoRelease: { name: string } | undefined,
): string {
  const own = subjectOf(stream, behind);
  return alsoRelease === undefined
    ? own
    : `${own}, and of a change to ${alsoRelease.name}`;
}

// A row's waiting drafts, the change behind it first, each counted though the other was rejected.
const waitingOf = ({
  draft,
  heldBy,
}: CycleRow): (Waiting & { own: boolean })[] =>
  draft === undefined
    ? []
    : [
        ...(draft.state === "waiting"
          ? [
              {
                ref: draft.ref,
                decidable: decidable({ draft, heldBy }),
                needsOtherApprover: draft.needsOtherApprover === true,
                own: true,
              },
            ]
          : []),
        ...(draft.release === undefined
          ? []
          : [{ ...draft.release, own: false }]),
      ];

// The first day of a cycle, or of the cycle as it is live where a draft removes it.
const startOf = ({ cycle, twin }: CycleTwin) => (cycle ?? twin).startsOn;

// Each cycle's row, from every schedule with its drafts, in each schedule's order and by date, as
// the Draft view shows it: with every draft beside live, the cycles a draft removes included; as
// they will make it with them applied, leaving out rejected ones and the cycles drafts remove; and
// as it is with every draft under Live only, whose rows the table makes live itself.
export function cycleRows(
  streams: readonly ReleaseStream[],
  show: Show,
  day: string,
): CycleRow[] {
  const leaveOutRejected = show === "drafts";
  return streams.flatMap((stream) => {
    const [shown] = leaveOutRejected ? draftedStreams([stream]) : [stream];
    // Drafts applied leaves out a schedule a draft removes.
    if (shown === undefined) return [];
    // A schedule only drafted to be added has no cycles yet as it is live.
    const [live = { ...stream, cycles: [] }] = liveStreams([stream]);
    const changes = cycleChanges(stream, leaveOutRejected);
    return cycleTwins(shown.cycles, live.cycles)
      .sort((one, other) => startOf(one).localeCompare(startOf(other)))
      .flatMap(({ cycle, twin }): CycleRow[] => {
        if (cycle === undefined) {
          if (leaveOutRejected) return [];
          const values = removedValues(valuesOf(live, twin, day));
          return [
            {
              id: values.cycleId,
              ...values,
              ...marksOf(
                stream,
                changeBehind(changes, twin),
                "deleted",
                values,
                values,
              ),
              stream: live,
              cycle: twin,
              twin: { stream: live, cycle: twin },
              live: false,
            },
          ];
        }
        const values = valuesOf(shown, cycle, day);
        const liveValues =
          twin === undefined ? values : valuesOf(live, twin, day);
        return [
          {
            id: values.cycleId,
            ...values,
            ...marksOf(
              stream,
              changeBehind(changes, cycle),
              twin === undefined ? "created" : "changed",
              values,
              liveValues,
              releaseChange(stream, [values.release, liveValues.release]),
            ),
            stream: shown,
            cycle,
            twin:
              twin === undefined ? undefined : { stream: live, cycle: twin },
            live: false,
          },
        ];
      });
  });
}

// Each row as its cycle is live, without drafts, leaving out those only a draft adds.
const liveRows = (rows: readonly CycleRow[], day: string): CycleRow[] =>
  rows.flatMap(({ twin, ...row }) =>
    twin === undefined
      ? []
      : [
          {
            ...row,
            ...valuesOf(twin.stream, twin.cycle, day),
            draft: undefined,
            cellDrafts: undefined,
            stream: twin.stream,
            cycle: twin.cycle,
            twin,
            live: true,
          },
        ],
  );

// A cycle's rows for its details, by its ID, if its schedule holds it.
export type CycleDetailRows = DetailRows<CycleRow>;

export const cycleDetailRows = (
  stream: ReleaseStream,
  id: string | undefined,
  show: Show,
  day: string,
): CycleDetailRows | undefined =>
  detailRows(
    (shown) => cycleRows([stream], shown, day),
    (row) => liveRows([row], day).at(0),
    id,
    show,
  );

const column = (
  key: keyof CycleValues,
  label: string,
  kind: "text" | "date" | "choice",
  {
    required = false,
    emptyLabel,
    choices = [],
  }: { required?: boolean; emptyLabel?: string; choices?: Choice[] } = {},
) =>
  fieldColumn<CycleRow, never>(key, kind, {
    label,
    required,
    multiple: false,
    choices,
    // A cycle comes from its schedule's patterns, changed from its details' Duration.
    readOnly: true,
    ...(emptyLabel === undefined ? {} : { emptyLabel }),
  });

// A day every cycle has, with a value of its own for nearly every cycle, not worth breaking down by.
const dayColumn = (key: "startsOn" | "endsOn", label: string) => ({
  ...column(key, label, "date", { required: true }),
  breaksDown: false,
});

// How long a cycle lasts, which only its details show.
export const durationColumn = column("duration", "Duration", "text");

const releaseColourOf = ({ releaseColour }: CycleRow) =>
  releaseColour === "" ? null : releaseColour;

// The table's columns, in its order, which a cycle's details show first too, given every schedule
// and the cycles the table can show, whose names and releases the Cycle and Release filters offer.
export function cycleColumns(
  streams: readonly ReleaseStream[],
  records: readonly CycleRow[],
  planned?: PlannedFeatures,
): Column<CycleRow, never>[] {
  const cycles = [
    ...new Map(records.map((row) => [row.cycleId, row])).values(),
  ];
  const names = new Map(cycles.map((row) => [row.cycleId, row.name]));
  const listed = scheduledNames(cycles.map(({ name }) => name));
  const inSchedule = (row: CycleRow) => `${row.schedule} ${row.name}`;
  const repeated = nameCounts(cycles.map(inSchedule));
  // A cycle as its filter lists it: with its schedule where another schedule's has its name, and its
  // first day too where another of its own schedule's does.
  const listedName = (row: CycleRow) =>
    repeated(inSchedule(row)) > 1
      ? `${withSchedule(row.stream, row.name)}, ${formatDay(row.startsOn)}`
      : listed(row.stream, row);
  const releaseNames = new Map(
    records.map((row) => [row.release, row.releaseName]),
  );
  const releases = releaseListNames(streams);
  return [
    {
      ...wordsColumn<CycleRow, never>("name", "Cycle", records, {
        required: true,
        from: "cycleId",
        named: (_id, row) => listedName(row),
      }),
      // A cycle's cell reads its name alone, beside its schedule; its filter tells apart cycles that
      // share a name.
      choicesInWords: choicesNamed(names),
      // A Live row's cycle can have the identifier of another cycle, or none shown, so each row names
      // its own.
      content: ({ name }) => name,
      breaksDown: false,
    },
    scheduleColumn<CycleRow>(streams),
    dayColumn("startsOn", "Starts"),
    dayColumn("endsOn", "Ends"),
    {
      ...column("current", "Current", "choice", {
        emptyLabel: "Not current",
        choices: [currentChoice],
      }),
      blankMeansNo: true,
    },
    {
      ...wordsColumn<CycleRow, never>("release", "Release", records, {
        named: (_id, row) => releases(row.stream, { name: row.releaseName }),
      }),
      // A release's cell reads its name alone, beside its schedule; its filter names the schedule
      // where two releases share a name.
      choicesInWords: choicesNamed(releaseNames),
      // The release's square shows its colour.
      changesWith: "releaseColour",
      colour: releaseColourOf,
      // A release renamed keeps its identifier, so each row names its own.
      content: ({ releaseName }) => releaseName,
    },
    ...(planned === undefined
      ? []
      : [
          featuresColumn<CycleValues, CycleRow>(
            "Features",
            planned,
            ({ cycleId }) => [cycleId],
            "startsOn",
          ),
        ]),
  ];
}

export const cycleColumnOrder = [
  "name",
  "schedule",
  "startsOn",
  "endsOn",
  "current",
  "release",
  "features",
];

// What a cycle's details show: the table's columns, its name in words, with its name as it is live
// under a drafted one, which a choice of one cycle can't give.
export const cycleDetailColumns = (
  streams: readonly ReleaseStream[],
  records: readonly CycleRow[],
  planned?: PlannedFeatures,
): Column<CycleRow, never>[] =>
  cycleColumns(streams, withLiveCopies(records), planned).map((each) =>
    each.key === "name"
      ? { ...each, ...column("name", "Cycle", "text", { required: true }) }
      : each,
  );

// A cycle named with its schedule, as its menu and details are headed.
export const cycleTitle = (row: CycleRow): string =>
  withSchedule(row.stream, row.name);

// The table of cycles, read only: cycles come from their schedule's patterns, changed in a cycle's
// details. A row's menu decides, discards or resubmits the draft behind it.
export function cycleTable({
  streams,
  rows,
  day,
  onOpen,
  planned,
  approves,
}: {
  // Every schedule, with its drafts, whatever the view.
  streams: readonly ReleaseStream[];
  // Every cycle's row, as the Draft view shows it, whatever else the view shows.
  rows: readonly CycleRow[];
  day: string;
  planned?: PlannedFeatures | undefined;
  onOpen: (row: CycleRow) => void;
  // The kinds of draft the user's role approves.
  approves: readonly DraftKind[];
}): RecordTable<CycleRow, never, undefined> {
  const decidedBy = (row: CycleRow) =>
    waitingOf(row).filter(
      ({ ref, decidable }) =>
        decidable && mayDecide(approves, { ...noDrafts(), records: [ref] }),
    );
  const refsOf = (waiting: readonly Waiting[]) => waiting.map(({ ref }) => ref);
  // A draft's menu names every value it changes, the Duration only the details show included.
  const describedColumns = (row: CycleRow) => [
    ...cycleDetailColumns(streams, [row], planned),
    durationColumn,
  ];
  return {
    ...readOnlyTableParts,
    label: "Cycles",
    one: "cycle",
    noun: "cycles",
    groupings: bySchedule(streams),
    nameOf: cycleTitle,
    nameColumn: "name",
    showDetails: onOpen,
    columnsFor: (_fields, _lists, _order, records) =>
      cycleColumns(streams, records, planned),
    liveRecords: (records) => liveRows(records, day),
    draftFields: (row, draft) =>
      draftFieldsOf(describedColumns(row), row, draft),
    draftSubject: ({ subject }) => subject,
    decidable: (row) => decidedBy(row).length > 0,
    menuDecides: (row) => {
      const decided = decidedBy(row);
      const approved = decided.filter(
        ({ needsOtherApprover }) => !needsOtherApprover,
      );
      const othersOnly = (drafts: readonly { own: boolean }[]) =>
        drafts.length > 0 && !drafts.some(({ own }) => own)
          ? row.draft?.release?.name
          : undefined;
      return {
        approved: { ...noDrafts(), records: refsOf(approved) },
        approvedOf: othersOnly(approved),
        rejectedOf: othersOnly(decided),
      };
    },
    // Each draft once, though it changes several of the cycles named.
    drafts: (ids) => ({
      ...noDrafts(),
      records: [
        ...new Map(
          rows
            .filter(({ id }) => ids.includes(id))
            .flatMap((row) => refsOf(decidedBy(row)))
            .map((ref) => [refKey(ref), ref]),
        ).values(),
      ],
    }),
  };
}
