// SPDX-License-Identifier: Apache-2.0

// The allocations grid: who is allocated to what, month by month, with each month's total against
// the time available.

import {
  type AllocatedFeature,
  type Allocation,
  type AllocationDraft,
  allocatedTotal,
  type Allocations,
  type Capacity,
  allocationsSchema,
  byName,
  loadMark,
  type LoadMark,
  type Meaning,
  monthCapacity,
  type OrgChart,
  type PaletteColour,
  percentageIn,
  type Show,
  summedCapacity,
  type TeamMonths,
  wholeMonth,
  wholeMonthHoursIn,
} from "@fathom/shared";
import { VisuallyHidden } from "@mantine/core";
import { queryOptions } from "@tanstack/react-query";
import type { ReactNode } from "react";
import styles from "./allocation-lines.module.css";
import {
  allocatedToGrouping,
  groupedRows,
  type HeldRow,
  rowsByWork,
} from "./allocation-groups.ts";
import { getJson } from "./api.ts";
import { unitWords } from "./effort.ts";
import { share } from "./metrics.ts";
import { decimal } from "./numbers.ts";
import { hireRows } from "./planned-hire-months.ts";
import type { CellChange } from "./cell-kinds.tsx";
import pages from "./pages.module.css";
import type { RecordTable, RowGrouping, RowTotals } from "./record-table.ts";
import { rankOfNone } from "./row-groups.ts";
import { allocatedHours, countedTo, WorkFacts } from "./allocated-work.tsx";
import { ColouredName } from "./colour-swatch.tsx";
import {
  DraftedPartItem,
  type DraftedPart,
  besideLive,
  DraftedValue,
  LiveValue,
  viewedDraft,
} from "./status-mark.tsx";
import type { DraftLike } from "./draft-marks.ts";
import { tipAttribute } from "./table-tips.tsx";
import {
  monthGridTable,
  monthGroupings,
  type MonthRow,
  personDraft,
  teamMonthRecords,
} from "./team-months.tsx";

export const allocationsQuery = queryOptions({
  queryKey: ["allocations"],
  queryFn: () => getJson("/api/allocations", allocationsSchema),
});

// A feature or activity as allocation lines name it, counted alike. An activity's tip names its
// project or release, which tells apart activities of one name.
export interface AllocatedWork extends AllocatedFeature {
  tip: string;
  // The filter's choice it is: its own, or, for work the reader can't read, one for all of its kind.
  choice: string;
}

// The one choice for every feature, or every activity, the reader can't read, never a record's own
// identifier, so a filter kept in an address or a view means the same whichever such records there
// are.
export const unseenFeatureChoice = "unseen-feature";
export const unseenActivityChoice = "unseen-activity";

// Everything the allocations name: their features, then their activities.
export const allocatedWork = ({
  features,
  activities,
}: Allocations): AllocatedWork[] => [
  ...features.map((feature) => ({
    ...feature,
    tip: feature.name,
    choice: feature.unseen === true ? unseenFeatureChoice : feature.id,
  })),
  ...activities.map(({ owner, ...activity }) => ({
    ...activity,
    tip: owner === undefined ? activity.name : `${activity.name} (${owner})`,
    choice: activity.unseen === true ? unseenActivityChoice : activity.id,
  })),
];

export interface AllocationLine {
  workId: string;
  // The feature's or activity's name as the Draft view shows it.
  name: string;
  tip: string;
  rename?: AllocatedFeature["rename"];
  meaning: Meaning | null;
  colour: PaletteColour | null;
  // The percentage shown: as drafted, or, for work a draft takes off, as approved.
  percentage: number;
  // The percentage as approved; null for work a draft adds.
  live: number | null;
  // The hours a whole month of the row's time gives in the month, after focus and ramp-up.
  monthHours: number;
  drafted?: DraftedPart;
  draft?: DraftLike;
  // Set on a line as it is live, where draft changes it as drafted says, so it shows Live's dot.
  shownLive?: boolean;
  // Set on every line of a Live row, which names the feature as it is live, with Live's dot where a
  // draft renames it.
  inLiveRow?: true;
}

export interface AllocationRow extends HeldRow {
  allocated: ReadonlyMap<string, AllocationLine[]>;
  live?: AllocationRow | undefined;
}

const marks: Record<LoadMark, { words: string }> = {
  over: { words: "Over" },
  under: { words: "Under" },
};

const totalWords = (total: number) => `Total ${String(total)}%`;

// How far a month is from a whole month, such as +25% or −90%, with a minus sign rather than a hyphen.
const offWholeMonth = (total: number) =>
  total > wholeMonth
    ? `+${String(total - wholeMonth)}%`
    : `\u2212${String(wholeMonth - total)}%`;

// A month's total as the Draft menu shows it: as drafts make it only with drafts applied, and
// otherwise as approved.
export function monthTotal(
  lines: readonly AllocationLine[],
  show: Show,
): number {
  return allocatedTotal(
    lines.map(({ meaning, percentage, live }) => ({
      meaning,
      percentage: show === "drafts" ? percentage : (live ?? 0),
    })),
  );
}

const holdsMonth = (row: Pick<AllocationRow, "holds">, month: string) =>
  row.holds === undefined || row.holds.has(month);

export function allocatableIn(row: AllocationRow, month: string): boolean {
  return holdsMonth(row, month) && !row.outside.has(month);
}

// A month's total, and its mark as its cell shows it, from the current month on.
function monthMark({
  lines,
  month,
  currentMonth,
  allocatable,
  show,
}: {
  lines: readonly AllocationLine[];
  month: string;
  currentMonth: string;
  allocatable: boolean;
  show: Show;
}): { total: number; mark: LoadMark | undefined } {
  const total = monthTotal(lines, show);
  return { total, mark: loadMark({ total, month, currentMonth, allocatable }) };
}

// The marks a row's cells show in the months given, from the current month on.
export function marksFrom(
  row: AllocationRow,
  months: readonly string[],
  currentMonth: string,
  show: Show,
): ReadonlySet<LoadMark> {
  return new Set(
    months.flatMap((month) => {
      if (!holdsMonth(row, month)) return [];
      const { mark } = monthMark({
        lines: row.allocated.get(month) ?? [],
        month,
        currentMonth,
        allocatable: allocatableIn(row, month),
        show,
      });
      return mark === undefined ? [] : [mark];
    }),
  );
}

export function AllocationLines({
  lines,
  month,
  currentMonth,
  allocatable,
  show,
}: {
  lines: readonly AllocationLine[];
  month: string;
  currentMonth: string;
  allocatable: boolean;
  show: Show;
}) {
  const { total, mark } = monthMark({
    lines,
    month,
    currentMonth,
    allocatable,
    show,
  });
  // The key is one of the union's own.
  // eslint-disable-next-line security/detect-object-injection
  const marked = mark === undefined ? undefined : marks[mark];
  return (
    <div className={styles.lines}>
      {lines.map(
        ({
          workId,
          name,
          tip,
          rename,
          colour,
          percentage,
          drafted,
          draft,
          shownLive,
          inLiveRow,
        }) => (
          <div
            key={workId}
            className={[
              styles.line,
              drafted === "removed" && shownLive !== true ? pages.struck : "",
            ].join(" ")}
            {...{ [tipAttribute]: tip }}
          >
            <span
              className={[
                styles.name,
                inLiveRow !== true &&
                besideLive(show) &&
                viewedDraft(rename, show).draft !== undefined
                  ? pages.changedValue
                  : "",
              ].join(" ")}
            >
              <DraftedPartItem draft={draft} part={drafted} live={shownLive}>
                {inLiveRow === true ? (
                  <LiveValue draft={rename} fields={["name"]}>
                    <ColouredName colour={colour}>{name}</ColouredName>
                  </LiveValue>
                ) : (
                  <DraftedValue draft={rename} fields={["name"]} named="Name">
                    <ColouredName colour={colour}>{name}</ColouredName>
                  </DraftedValue>
                )}
              </DraftedPartItem>
            </span>
            <span>{percentage}%</span>
          </div>
        ),
      )}
      {/* Only a month off a whole month has a last line, so a whole month reads alike with one feature
          or several. */}
      {marked !== undefined && (
        <div
          className={[styles.line, styles.total, styles.marked].join(" ")}
          {...(total === 0 ? {} : { [tipAttribute]: totalWords(total) })}
        >
          {total === 0 ? (
            <span>Not allocated</span>
          ) : (
            <>
              <span>{marked.words}</span>
              <span>{offWholeMonth(total)}</span>
              <VisuallyHidden>, {totalWords(total)}</VisuallyHidden>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// What a line of an allocation's names, with the hours a whole month of its person's time gives in
// the month.
function workOf(
  works: ReadonlyMap<string, AllocatedWork>,
  allocation: Allocation,
  month: string,
): Pick<
  AllocationLine,
  "workId" | "name" | "tip" | "rename" | "meaning" | "colour" | "monthHours"
> {
  // Every allocation names a feature or an activity, which the server lists.
  const workId = String(allocation.featureId ?? allocation.activityId);
  const { name, tip, rename, meaning, colour } = works.get(
    workId,
  ) as AllocatedWork;
  return {
    workId,
    name,
    tip,
    ...(rename === undefined ? {} : { rename }),
    meaning,
    colour,
    monthHours: hoursIn(allocation, month),
  };
}

const liveNameOf = (work: Pick<AllocatedFeature, "name" | "rename">) =>
  typeof work.rename?.live.name === "string"
    ? work.rename.live.name
    : work.name;

// The features and activities as the Draft view names them: as a rename makes one where the view
// shows the rename, otherwise as it is live.
export function namedIn(allocations: Allocations, show: Show): Allocations {
  const named = <Work extends AllocatedFeature>(work: Work): Work =>
    viewedDraft(work.rename, show).draft === undefined
      ? { ...work, name: liveNameOf(work) }
      : work;
  return {
    ...allocations,
    features: allocations.features.map(named),
    activities: allocations.activities.map(named),
  };
}

// The hours a whole month of an allocation's person's time gives, none for a reader not sent them.
const hoursIn = (allocation: Allocation, month: string): number =>
  allocation.hours === undefined
    ? 0
    : wholeMonthHoursIn(allocation.hours, month);

// The hours some lines deliver in their month, at the percentages the Draft menu shows.
export const monthHoursOf = (
  lines: readonly AllocationLine[],
  show: Show,
): number =>
  lines.reduce(
    (total, { percentage, live, monthHours }) =>
      total +
      ((show === "drafts" ? percentage : (live ?? 0)) * monthHours) /
        wholeMonth,
    0,
  );

// A month's allocations as approved, each feature or activity by name.
function liveLines(
  allocations: readonly Allocation[],
  works: ReadonlyMap<string, AllocatedWork>,
  month: string,
): AllocationLine[] {
  return allocations.flatMap((allocation): AllocationLine[] => {
    const percentage = percentageIn(allocation.months, month);
    return percentage === null
      ? []
      : [{ ...workOf(works, allocation, month), percentage, live: percentage }];
  });
}

type Drafted = Allocation & { draft: AllocationDraft };

const isDrafted = (allocation: Allocation): allocation is Drafted =>
  allocation.draft !== undefined;

const draftedPercentage = ({ draft }: Drafted, month: string) =>
  draft.action === "deleted" ? null : percentageIn(draft.months, month);

// A month's allocations as drafts make them, with the features they add, take off, or change
// marked. With drafts applied, work a draft takes off is gone, rather than struck through.
function draftedLines(
  allocations: readonly Drafted[],
  works: ReadonlyMap<string, AllocatedWork>,
  month: string,
  show: Show,
): AllocationLine[] {
  return allocations.flatMap((allocation): AllocationLine[] => {
    const live = percentageIn(allocation.months, month);
    const { draft } = allocation;
    const drafted = draftedPercentage(allocation, month);
    const work = workOf(works, allocation, month);
    if (drafted === null) {
      return live === null || show === "drafts"
        ? []
        : [{ ...work, percentage: live, live, drafted: "removed", draft }];
    }
    if (drafted === live) return [{ ...work, percentage: drafted, live }];
    return [
      {
        ...work,
        percentage: drafted,
        live,
        drafted: live === null ? "added" : "changed",
        draft,
      },
    ];
  });
}

const workIdsOf = (lines: readonly AllocationLine[]) =>
  lines
    .filter(({ drafted }) => drafted !== "removed")
    .map(({ workId }) => workId);

// Each month's lines by name, leaving out the months with none.
const linesByMonth = (
  months: readonly string[],
  linesIn: (month: string) => AllocationLine[],
): Map<string, AllocationLine[]> =>
  new Map(
    months.flatMap((month): [string, AllocationLine[]][] => {
      const lines = linesIn(month).sort(byName);
      return lines.length === 0 ? [] : [[month, lines]];
    }),
  );

// A row with its allocations, and, when drafts change any of its months shown, the row as drafted
// with the row as approved kept for the Live row. Rejected drafts are with their makers, so drafts
// applied leaves them out.
function withAllocations(
  base: BaseRow,
  allocations: readonly Allocation[],
  works: ReadonlyMap<string, AllocatedWork>,
  allMonths: readonly string[],
  show: Show,
): AllocationRow {
  const months = allMonths.filter((month) => holdsMonth(base, month));
  const liveIn = linesByMonth(months, (month) =>
    liveLines(allocations, works, month),
  );
  const live: AllocationRow = {
    ...base,
    values: Object.fromEntries(
      [...liveIn].map(([month, lines]) => [month, workIdsOf(lines)]),
    ),
    allocated: liveIn,
  };
  const withDraftShown = allocations
    .filter(isDrafted)
    .filter(({ draft }) => !(show === "drafts" && draft.state === "rejected"));
  const withoutDraftShown = allocations.filter(
    (allocation) => !withDraftShown.some(({ id }) => id === allocation.id),
  );
  const changed = months.filter((month) =>
    withDraftShown.some(
      (allocation) =>
        draftedPercentage(allocation, month) !==
        percentageIn(allocation.months, month),
    ),
  );
  if (changed.length === 0) return live;
  const draftedIn = linesByMonth(months, (month) => [
    ...draftedLines(withDraftShown, works, month, show),
    ...liveLines(withoutDraftShown, works, month),
  ]);
  return {
    ...live,
    values: Object.fromEntries(
      [...draftedIn].map(([month, lines]) => [month, workIdsOf(lines)]),
    ),
    allocated: draftedIn,
    draft: {
      action: "changed",
      changed,
      live: { values: live.values, links: {} },
      ...personDraft(withDraftShown.map(({ draft }) => draft)),
      madeBy: null,
    },
    live: withLiveMarks(live, draftedIn),
  };
}

// The row as approved, for its Live row, with each line a draft takes off or changes marked as
// live.
function withLiveMarks(
  live: AllocationRow,
  draftedIn: ReadonlyMap<string, AllocationLine[]>,
): AllocationRow {
  return {
    ...live,
    allocated: new Map(
      [...live.allocated].map(([month, lines]): [string, AllocationLine[]] => {
        const changed = new Map(
          (draftedIn.get(month) ?? []).flatMap(({ workId, drafted, draft }) =>
            (drafted === "removed" || drafted === "changed") &&
            draft !== undefined
              ? [[workId, { drafted, draft }] as const]
              : [],
          ),
        );
        return [
          month,
          lines.map((line) => {
            const change = changed.get(line.workId);
            const asLive = {
              ...line,
              name: liveNameOf(line),
              inLiveRow: true as const,
            };
            return change === undefined
              ? asLive
              : { ...asLive, ...change, shownLive: true };
          }),
        ];
      }),
    ),
  };
}

type BaseRow = MonthRow & Pick<AllocationRow, "holds">;

// Allocations by whom they name: a person, or a planned hire.
function byAssignee(allocations: readonly Allocation[]) {
  const ofPeople = new Map<string, Allocation[]>();
  const ofHires = new Map<string, Allocation[]>();
  for (const allocation of allocations) {
    const [map, id] =
      allocation.personId === null
        ? [ofHires, allocation.plannedHireId]
        : [ofPeople, allocation.personId];
    // Every allocation names a person or a planned hire.
    const key = id as string;
    map.set(key, [...(map.get(key) ?? []), allocation]);
  }
  return { ofPeople, ofHires };
}

// A row for each person, as the Teams grid has them, and each planned hire, with their allocations
// as the Draft menu shows them.
export function allocationMonthRecords({
  teamMonths,
  allocations,
  chart,
  grouping,
  show,
}: {
  teamMonths: TeamMonths;
  allocations: Allocations;
  chart: OrgChart;
  grouping: string | undefined;
  show: Show;
}): AllocationRow[] {
  const works = new Map(
    allocatedWork(allocations).map((work) => [work.id, work]),
  );
  const { ofPeople, ofHires } = byAssignee(allocations.allocations);
  const managersOf = new Map(
    teamMonths.people.map(({ id, managers }) => [id, managers]),
  );
  const people = teamMonthRecords(teamMonths, undefined, "live").flatMap(
    (record) => {
      const person = record.live ?? record;
      return groupedRows<BaseRow>(
        {
          id: person.id,
          personId: person.personId,
          name: person.name,
          manager: person.manager,
          values: {},
          links: {},
          outside: person.outside,
        },
        {
          teamsIn: person.teamsIn,
          managers: managersOf.get(person.personId),
          months: teamMonths.months,
          grouping,
        },
      );
    },
  );
  const rows = (base: BaseRow, of: ReadonlyMap<string, Allocation[]>) => {
    const theirs = of.get(base.personId) ?? [];
    return (
      grouping === allocatedToGrouping
        ? rowsByWork(base, theirs)
        : [{ row: base, allocations: theirs }]
    ).map(({ row, allocations: own }) =>
      withAllocations(row, own, works, teamMonths.months, show),
    );
  };
  return [
    ...people.flatMap((person) => rows(person, ofPeople)),
    ...hireRows(chart, teamMonths.months).flatMap((hire) =>
      rows(hire, ofHires),
    ),
  ];
}

// Grouped by the feature or activity each row is for, by name, then those allocated to nothing.
// Work the reader can't read is one group of its kind, named only by its kind, as its filter's
// choice is.
function groupedByWork(
  works: readonly AllocatedWork[],
  factsOf: (work: AllocatedWork) => ReactNode,
): RowGrouping<AllocationRow> {
  const groups = new Map(
    [...works]
      .sort((first, second) =>
        byName({ name: first.tip }, { name: second.tip }),
      )
      .map((work, rank) => [
        work.id,
        work.unseen === true
          ? { key: work.choice, label: work.name, rank }
          : {
              key: work.id,
              label: work.tip,
              rank,
              colour: work.colour,
              facts: factsOf(work),
            },
      ]),
  );
  return {
    key: allocatedToGrouping,
    label: "Allocated to",
    holds: "names",
    of: ({ work }) => [
      (work === undefined ? undefined : groups.get(work)) ?? {
        key: "not-allocated",
        label: "Not allocated",
        rank: rankOfNone,
      },
    ],
  };
}

export function allocationMonthsTable({
  teamMonths,
  works,
  allocations,
  managers,
  currentMonth,
  show,
  byWork,
  offersWork,
}: {
  teamMonths: TeamMonths;
  works: readonly AllocatedWork[];
  allocations: readonly Allocation[];
  // Whether the rows are grouped by what each is allocated to, whose totals are hours.
  byWork: boolean;
  // Whether it may be, for a reader who sees the planning settings, since its hours tell them.
  offersWork: boolean;
  // The managers to group by, for roles that may group by manager.
  managers: readonly { id: string; name: string }[] | undefined;
  currentMonth: string;
  show: Show;
}): RecordTable<AllocationRow, CellChange, CellChange> {
  const choiceOf = new Map(works.map(({ id, choice }) => [id, choice]));
  return {
    ...monthGridTable<AllocationRow>({
      months: teamMonths.months,
      currentMonth,
      label: "Allocations by month",
      // Offered by their tips, as activities may share a name; work the reader can't read is one
      // choice of its kind, since they can't tell it apart.
      choices: works.map(({ id, tip }) => ({ id, name: tip })),
      // Every value a month holds names work the allocations list.
      choiceOf: (id) => choiceOf.get(id) as string,
      filter: {
        button: "Allocations",
        label: "Allocated to",
        none: "Not allocated",
      },
      content: (row, month) =>
        holdsMonth(row, month) && (
          <AllocationLines
            lines={row.allocated.get(month) ?? []}
            month={month}
            currentMonth={currentMonth}
            // A row for one feature holds part of someone's month, so their load isn't marked on it.
            allocatable={!byWork && allocatableIn(row, month)}
            show={show}
          />
        ),
      readOnly: () => true,
      groupings: [
        ...monthGroupings<AllocationRow>(managers, teamMonths),
        ...(offersWork
          ? [
              groupedByWork(works, (work) => (
                <WorkFacts
                  work={work}
                  allocated={
                    work.effort === undefined
                      ? 0
                      : allocatedHours(
                          allocations,
                          work.id,
                          countedTo(work.effort, show, currentMonth),
                          show,
                        )
                  }
                  show={show}
                />
              )),
            ]
          : []),
      ],
    }),
    totals: byWork ? workTotals(show) : capacityTotals(show),
  };
}

const rowCapacity = (row: AllocationRow, month: string, show: Show) =>
  monthCapacity({
    total: monthTotal(row.allocated.get(month) ?? [], show),
    allocatable: allocatableIn(row, month),
  });

// A month's capacity over some rows, counting each person's month once, though they have a row
// under each of several groups.
export function capacityOf(
  rows: readonly AllocationRow[],
  month: string,
  show: Show,
): Capacity {
  const once = new Map(
    rows
      .filter((row) => allocatableIn(row, month))
      .map((row) => [row.personId, rowCapacity(row, month, show)]),
  );
  return summedCapacity([...once.values()]);
}

const personMonths = unitWords["person-months"];

// A month's capacity, with the unit in its tip and read aloud, since the heading names it by its
// code alone.
export function CapacityTotal({ allocated, available }: Capacity) {
  if (available === 0) return null;
  const [of, from] = [allocated / wholeMonth, available / wholeMonth];
  const unit = from === 1 ? personMonths.one : personMonths.name;
  const shared = share(allocated, available);
  return (
    <div
      className={styles.lines}
      {...{
        [tipAttribute]: `${decimal(of)} of ${decimal(from)} ${unit} allocated: ${shared}`,
      }}
    >
      <span>
        {decimal(of)} of {decimal(from)}
        <VisuallyHidden> {unit} allocated</VisuallyHidden>
      </span>
      <span>{shared}</span>
    </div>
  );
}

// Under each feature, the hours its allocations give it each month, and those of every feature.
function workTotals(show: Show): RowTotals<AllocationRow> {
  return {
    label: "Allocated",
    overall: "Allocated, all work",
    cell: (rows, month) =>
      `${decimal(
        rows.reduce(
          // Rows under what someone is allocated to hold every month.
          (total, row) =>
            total + monthHoursOf(row.allocated.get(month) ?? [], show),
          0,
        ),
      )} h`,
  };
}

function capacityTotals(show: Show): RowTotals<AllocationRow> {
  return {
    label: `Total, ${personMonths.name}`,
    overall: `Organization, ${personMonths.name}`,
    cell: (rows, month) => <CapacityTotal {...capacityOf(rows, month, show)} />,
  };
}
