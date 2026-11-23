// SPDX-License-Identifier: Apache-2.0

// What the Releases page's tabs share apart from drawing: each row's Schedule column and the rows
// grouped by it, the features targeting a row's cycles and its Features column, a record's rows for
// its details, and a row's menu discarding or resubmitting the draft it shows.

import {
  type Feature,
  type RecordRef,
  type ReleaseStream,
  type Show,
} from "@fathom/shared";
import type { ReactNode } from "react";
import { byChoice } from "./choice-grouping.ts";
import type { LayerRecord } from "./release-layer.tsx";
import { columnOf } from "./feature-board.ts";
import { releaseColumnKey } from "./feature-table.tsx";
import { livePlanRecords, recordsColumn } from "./plan-table.tsx";
import { choice } from "./lists.ts";
import { fieldColumn } from "./grid-columns.tsx";
import type { Column, GridRecord, RowGrouping } from "./record-table.ts";
import { discardRecordDraft, resubmitRecordDraft } from "./releases.ts";

// Each row's schedule, a choice of every schedule, by its ID in the row's schedule field, which
// every row has, read only, as on the Releases and Cycles tabs.
export const scheduleColumn = <
  Rec extends GridRecord & {
    schedule: string;
    draft?: { live: object } | undefined;
  },
>(
  streams: readonly ReleaseStream[],
): Column<Rec, never> =>
  fieldColumn<Rec, never>("schedule", "choice", {
    label: "Schedule",
    required: true,
    multiple: false,
    choices: streams.map(({ id, name }) => choice(id, name, false)),
    readOnly: true,
  });

// The rows grouped by their schedule.
export const bySchedule = <
  Rec extends GridRecord & {
    schedule: string;
    draft?: { live: object } | undefined;
  },
>(
  streams: readonly ReleaseStream[],
): RowGrouping<Rec>[] => [byChoice(scheduleColumn<Rec>(streams))];

// The plan's features as the tabs show them: every one, and those targeting any of the cycles
// given, by their choices, as drafts make them, leaving out those drafted to be removed, or as they
// are live, in the plan's order. Those who see only planning configuration see no features, so the
// tabs leave their Features columns out.
export interface PlannedFeatures {
  all: readonly Feature[];
  in: (cycles: readonly string[], live: boolean) => Feature[];
}

export function plannedFeatures(features: readonly Feature[]): PlannedFeatures {
  const drafted = features.filter(({ draft }) => draft?.action !== "deleted");
  const live = livePlanRecords(features);
  return {
    all: features,
    in: (cycles, isLive) => {
      const targeted = new Set(cycles);
      return (isLive ? live : drafted).filter((feature) =>
        targeted.has(columnOf(feature)),
      );
    },
  };
}

// Where the page sends someone to see features: one feature's details on Features, or those of a
// release or a cycle, by Features' filter of them, as a table, or on the Board from the cycle they
// start in.
export type FeaturesAt =
  | { feature: string }
  | {
      filter: { key: typeof releaseColumnKey | "targetCycle"; value: string };
      board?: { stream: string; from: string } | undefined;
    };

export const featuresColumnKey = "features";

// Opens a record's details on its own tab of the Releases page, as a link in another's details does.
export type ShowIn = (
  tab: "releases" | "cycles" | "schedules",
  record: string,
) => void;

// The tab each kind of record a timeline mark stands for is on.
const tabOf = {
  release: "releases",
  cycle: "cycles",
  schedule: "schedules",
} as const;

// Opens a timeline mark's record: on this tab where it is of the tab's own kind, and on its own tab
// otherwise.
export const markOpener =
  (own: LayerRecord["kind"], openOwn: (id: string) => void, showIn: ShowIn) =>
  ({ kind, id }: LayerRecord) => {
    if (kind === own) openOwn(id);
    // The kind is always one of the fixed kinds.
    // eslint-disable-next-line security/detect-object-injection
    else showIn(tabOf[kind], id);
  };

// Shows a schedule's releases or cycles on their tab, filtered to it.
export type ShowScheduleIn = (
  tab: "releases" | "cycles",
  schedule: string,
) => void;

// A record's details' columns, each named here drawing its value as given, such as a link.
export const drawnAs = <Rec extends GridRecord>(
  columns: readonly Column<Rec, never>[],
  drawn: Partial<Record<keyof Rec & string, (row: Rec) => ReactNode>>,
): Column<Rec, never>[] =>
  columns.map((column) => {
    const draw = new Map<string, ((row: Rec) => ReactNode) | undefined>(
      Object.entries(drawn),
    ).get(column.key);
    return draw === undefined ? column : { ...column, content: draw };
  });

// A row's features, named in one line as any table names several records, worked out from the
// cycles they target, so read only: as drafts make them, or, in a row as it is live and under a
// drafted row, as they are live. A draft moving the row's cycles changes them, as its field named
// by changesWith says.
export const featuresColumn = <
  Values extends object,
  Rec extends GridRecord &
    Values & { live: boolean; draft?: { live: Values } | undefined },
>(
  label: string,
  planned: PlannedFeatures,
  cyclesOf: (values: Values) => readonly string[],
  changesWith?: keyof Values & string,
): Column<Rec, never> => {
  const named = (values: Values, live: boolean) =>
    planned.in(cyclesOf(values), live).map(({ id }) => id);
  return {
    ...recordsColumn<Rec, never>(featuresColumnKey, label, planned.all, {
      namedBy: (row) => named(row, row.live),
      readOnly: true,
    }),
    live: (draft) => named(draft.live, true),
    ...(changesWith === undefined ? {} : { changesWith }),
  };
};

// A row's menu's discarding and resubmitting of the draft it shows, given the record each draft is
// of, as decisions name it.
export const draftActions = <Row, Draft>(
  refOf: (row: Row, draft: Draft) => RecordRef,
  run: (work: () => Promise<unknown>, done: string) => void,
) => ({
  discard: (row: Row, draft: Draft) => {
    run(() => discardRecordDraft(refOf(row, draft)), "Discarded the draft.");
  },
  resubmit: (row: Row, draft: Draft) => {
    run(() => resubmitRecordDraft(refOf(row, draft)), "Resubmitted the draft.");
  },
});

// A row's menu's discarding and resubmitting of the record's own draft, never its parts'.
export const ownDraftActions = (
  type: RecordRef["type"],
  run: (work: () => Promise<unknown>, done: string) => void,
) => draftActions((row: { id: string }) => ({ type, id: row.id }), run);

// A record's rows for its details, by its ID, if its rows hold it: as the Draft view shows it, with
// its draft whatever the view, which its marks are worked out from, and as it is live, or, while it
// is only drafted to be added, as drafted.
export interface DetailRows<Row> {
  shown: Row;
  drafted: Row;
  live: Row;
}

export function detailRows<Row extends { id: string }>(
  // The record's rows as each Draft view shows them, and a row as it is live, if it is.
  rowsAs: (show: Show) => readonly Row[],
  liveOf: (row: Row) => Row | undefined,
  id: string | undefined,
  show: Show,
): DetailRows<Row> | undefined {
  const drafted = rowsAs("both").find((row) => row.id === id);
  if (drafted === undefined) return undefined;
  const live = liveOf(drafted) ?? drafted;
  const applied = rowsAs("drafts").find((row) => row.id === id);
  const shownBy: Record<Show, Row> = {
    both: drafted,
    drafts: applied ?? drafted,
    live,
  };
  // The view is always one of the fixed views.
  // eslint-disable-next-line security/detect-object-injection
  return { shown: shownBy[show], drafted, live };
}
