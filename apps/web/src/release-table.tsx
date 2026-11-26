// SPDX-License-Identifier: Apache-2.0

// The Releases tab's table, on the shared table.

import {
  type Activity,
  type Choice,
  type RecordKeyOf,
  type Release,
  releaseKeptBy,
  type ReleaseStream,
  type Show,
} from "@fathom/shared";
import type { ReactNode } from "react";
import { activitiesColumn, activitiesColumnKey } from "./activity-list.tsx";
import { differingKeys, type DraftSelection, noDrafts } from "./drafts.ts";
import { choice } from "./lists.ts";
import { draftFieldsOf, removeTurnedOffBy } from "./plan-table.tsx";
import { cycleChoiceId, cycleChoices, cycleNames } from "./projects.ts";
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
  generalExport,
  readOnlyTableParts,
  type RecordTable,
} from "./record-table.ts";
import {
  colourName,
  draftedStreams,
  hasShipped,
  includesCycle,
  liveStreams,
  releaseDate,
  releaseRowFields,
  shownColour,
  cycleRunWords,
  releaseListNames,
} from "./releases.ts";
import { decidableRefs } from "./stream-table.tsx";
import {
  bySchedule,
  type DetailRows,
  detailRows,
  featuresColumn,
  type PlannedFeatures,
  scheduleColumn,
} from "./release-tabs.ts";

// What a row shows of its release, by column key, as a draft's live values hold it too, with what
// only a release's details show.
interface ReleaseValues {
  // The release's own identifier, which its Release filter chooses it by.
  releaseId: string;
  name: string;
  schedule: string;
  shipsOn: string;
  // Each cycle the release is in, named with its schedule.
  cycles: string[];
  status: string;
  colour: string;
  note: string;
}

export interface ReleaseRow extends GridRecord, ReleaseValues {
  draft?: (GridDraft & { live: ReleaseValues }) | undefined;
  release: Release;
  stream: ReleaseStream;
  live: boolean;
}

const shippedChoice = choice("shipped", "Shipped", false);

function valuesOf(
  stream: ReleaseStream,
  release: Release,
  day: string,
): ReleaseValues {
  return {
    releaseId: release.id,
    name: release.name,
    schedule: stream.id,
    shipsOn: releaseDate(stream, release) ?? "",
    cycles: stream.cycles
      .filter(({ startsOn }) => includesCycle(release, startsOn))
      .map(({ startsOn }) => cycleChoiceId(stream.id, startsOn)),
    status: hasShipped(stream, release, day) ? shippedChoice.id : "",
    colour: colourName(release.colour),
    note: release.note ?? "",
  };
}

// The row's draft, for its marks alone: the release's own, naming the values it changes that the
// row or the details show, such as a ship day that moves with the release's last cycle, and the
// fields it changes that neither shows.
function rowDraft(
  release: Release,
  values: ReleaseValues,
  live: ReleaseValues,
): ReleaseRow["draft"] {
  const { draft } = release;
  if (draft === undefined) return undefined;
  const shown = Object.keys(values);
  return {
    ...draft,
    changed: [
      ...differingKeys(values, live, shown),
      ...draft.changed.filter(
        (field) => !releaseRowFields.has(field) && !shown.includes(field),
      ),
    ],
    live,
  };
}

// Each schedule as it is live, if it is, from the schedules with every draft, by ID.
const liveById = (
  streams: readonly ReleaseStream[],
): ReadonlyMap<string, ReleaseStream> =>
  new Map(liveStreams(streams).map((stream) => [stream.id, stream]));

// A release as it is live, if it is, in its schedule as it is live.
const liveReleaseOf = (
  live: ReleaseStream | undefined,
  id: string,
): { stream: ReleaseStream; release: Release } | undefined => {
  const release = live?.releases.find((each) => each.id === id);
  return live === undefined || release === undefined
    ? undefined
    : { stream: live, release };
};

// Each release's row, from every schedule with its drafts, as the Draft view shows it: with every
// draft beside live, as they will make it with them applied, leaving out rejected ones, and as it is
// with every draft under Live only, whose rows the table makes live itself.
export function releaseRows(
  streams: readonly ReleaseStream[],
  show: Show,
  day: string,
): ReleaseRow[] {
  const shownStreams = show === "drafts" ? draftedStreams(streams) : streams;
  const lives = liveById(streams);
  return shownStreams.flatMap((stream) =>
    stream.releases.map((release) => {
      const values = valuesOf(stream, release, day);
      const live = liveReleaseOf(lives.get(stream.id), release.id);
      const draft = rowDraft(
        release,
        values,
        live === undefined ? values : valuesOf(live.stream, live.release, day),
      );
      return {
        id: release.id,
        ...values,
        heldBy: release.heldBy,
        ...(draft === undefined ? {} : { draft }),
        release,
        stream,
        live: false,
      };
    }),
  );
}

// Each row as its release is live, without drafts, leaving out those only drafted to be added.
function liveRows(rows: readonly ReleaseRow[], day: string): ReleaseRow[] {
  const lives = liveById([
    ...new Map(rows.map(({ stream }) => [stream.id, stream])).values(),
  ]);
  return rows.flatMap((row) => {
    const live = liveReleaseOf(lives.get(row.stream.id), row.id);
    return live === undefined
      ? []
      : [
          {
            ...row,
            ...valuesOf(live.stream, live.release, day),
            draft: undefined,
            release: live.release,
            stream: live.stream,
            live: true,
          },
        ];
  });
}

// A release's row for its details, by its ID, if its schedule holds it.
export type ReleaseDetailRows = DetailRows<ReleaseRow>;

export const releaseDetailRows = (
  stream: ReleaseStream,
  releaseId: string | undefined,
  show: Show,
  day: string,
): ReleaseDetailRows | undefined =>
  detailRows(
    (shown) => releaseRows([stream], shown, day),
    (row) => liveRows([row], day).at(0),
    releaseId,
    show,
  );

type ReleaseColumnKey = keyof ReleaseValues;

const column = (
  key: ReleaseColumnKey,
  label: string,
  kind: "text" | "date" | "note" | "choice",
  {
    emptyLabel,
    choices = [],
  }: { emptyLabel?: string; choices?: Choice[] } = {},
) =>
  fieldColumn<ReleaseRow, never>(key, kind, {
    label,
    required: false,
    multiple: false,
    choices,
    // A release's values are changed from their pencils in its details, never in the table.
    readOnly: true,
    ...(emptyLabel === undefined ? {} : { emptyLabel }),
  });

const releaseColour = (row: ReleaseRow) => shownColour(row.release.colour);

// The table's columns, in its order, which a release's details show first too, given every schedule
// and the releases the table can show, which the Release and Cycles filters offer, and the features
// targeting its cycles, for those who see them.
export function releaseColumns(
  streams: readonly ReleaseStream[],
  records: readonly ReleaseRow[],
  planned?: PlannedFeatures,
  // The activities as the view shows them, for a role that sees them.
  activities?: readonly Activity[],
): Column<ReleaseRow, never>[] {
  const listed = releaseListNames(streams);
  const names = new Map(records.map((row) => [row.releaseId, row.name]));
  const cycles = cycleNames(streams);
  const spanned = new Set(records.flatMap((row) => row.cycles));
  const nameOf = (cycle: string) => cycles.get(cycle) ?? cycle;
  return [
    {
      ...wordsColumn<ReleaseRow, never>("name", "Release", records, {
        required: true,
        from: "releaseId",
        named: (_id, row) => listed(row.stream, row),
      }),
      // A release's cell reads its name alone, beside its schedule; its filter names the schedule
      // where two releases share a name.
      choicesInWords: choicesNamed(names),
      breaksDown: false,
      // The name's square shows the release's colour.
      changesWith: "colour",
      colour: releaseColour,
    },
    scheduleColumn<ReleaseRow>(streams),
    column("shipsOn", "Ships on", "date"),
    {
      ...column("cycles", "Cycles", "choice", {
        choices: cycleChoices(streams).filter(({ id }) => spanned.has(id)),
      }),
      multiple: true,
      breaksDown: false,
      choicesInWords: (chosen) =>
        cycleRunWords(nameOf(chosen.at(0) ?? ""), nameOf(chosen.at(-1) ?? "")),
    },
    ...(planned === undefined
      ? []
      : [
          featuresColumn<ReleaseValues, ReleaseRow>(
            "Features",
            planned,
            ({ cycles }) => cycles,
            "cycles",
          ),
        ]),
    ...(activities === undefined
      ? []
      : [
          activitiesColumn<ReleaseRow, never>(
            activities,
            "releaseId",
            ({ releaseId }) => releaseId,
          ),
        ]),
    {
      ...column("status", "Status", "choice", {
        emptyLabel: "Not shipped",
        choices: [shippedChoice],
      }),
      // Show shipped in the Views menu chooses which releases show by it.
      filterable: false,
    },
  ];
}

export const releaseColumnOrder = [
  "name",
  "schedule",
  "shipsOn",
  "cycles",
  "features",
  activitiesColumnKey,
  "status",
];

// What a release's details show: the table's columns, its name in words, with its name as it is
// live under a drafted one, which a choice of one release can't give, then its colour.
export const releaseDetailColumns = (
  streams: readonly ReleaseStream[],
  records: readonly ReleaseRow[],
  planned?: PlannedFeatures,
  activities?: readonly Activity[],
): Column<ReleaseRow, never>[] => [
  ...releaseColumns(streams, withLiveCopies(records), planned, activities).map(
    (each) =>
      each.key === "name"
        ? { ...each, ...column("name", "Release", "text") }
        : each,
  ),
  { ...column("colour", "Colour", "text"), colour: releaseColour },
];

// Written in a panel of its own beside the details.
export const releaseNoteColumn = {
  ...column("note", "Note", "note"),
  readOnly: false,
};

// Made once, so the table's Key column is made again only when the releases change.
const releaseKeyOf = (row: ReleaseRow): RecordKeyOf => ({
  kind: "release",
  keyNumber: row.release.keyNumber,
});

// The table of releases, read only: releases are changed in their panel.
export function releaseTable({
  streams,
  day,
  changeable,
  onOpen,
  menuItems,
  planned,
  activities,
}: {
  // Every schedule, with its drafts, whatever the view.
  streams: readonly ReleaseStream[];
  day: string;
  planned?: PlannedFeatures | undefined;
  activities?: readonly Activity[] | undefined;
  // Whether the user may change a release now.
  changeable: (row: ReleaseRow) => boolean;
  onOpen: (release: Release) => void;
  // What else a release's menu offers, such as adding a note.
  menuItems: (row: ReleaseRow) => ReactNode;
}): RecordTable<ReleaseRow, never, undefined> {
  // A draft's menu names every value it changes, those only the details show included.
  const describedColumns = (row: ReleaseRow) => [
    ...releaseDetailColumns(streams, [row], planned, activities),
    releaseNoteColumn,
  ];
  const drafts = (ids: string[]): DraftSelection => ({
    ...noDrafts(),
    records: decidableRefs(
      "release",
      streams.flatMap(({ releases }) =>
        releases.filter(({ id }) => ids.includes(id)),
      ),
    ),
  });
  return {
    ...readOnlyTableParts,
    label: "Releases",
    exported: generalExport,
    one: "release",
    noun: "releases",
    groupings: bySchedule(streams),
    menuItems,
    newRowLabel: () => "New release",
    removeLabel: () => "Remove release",
    removeTurnedOff: (row) =>
      removeTurnedOffBy(
        releaseKeptBy({ activities: activities ?? [] }, row.releaseId),
        "release",
      ),
    nameOf: (row) => row.name,
    nameColumn: "name",
    keyOf: releaseKeyOf,
    showDetails: (row) => {
      onOpen(row.release);
    },
    readOnlyRecord: (row) => !changeable(row),
    columnsFor: (_fields, _lists, _order, records) =>
      releaseColumns(streams, records, planned, activities),
    liveRecords: (rows) => liveRows(rows, day),
    draftFields: (row, draft) =>
      draftFieldsOf(describedColumns(row), row, draft),
    drafts,
  };
}
