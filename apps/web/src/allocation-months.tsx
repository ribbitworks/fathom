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
} from "@fathom/shared";
import { VisuallyHidden } from "@mantine/core";
import { queryOptions } from "@tanstack/react-query";
import { recordTableClasses } from "./page-styles.ts";
import styles from "./allocation-lines.module.css";
import { groupedRows, type HeldRow } from "./allocation-groups.ts";
import { getJson } from "./api.ts";
import { unitWords } from "./effort.ts";
import { share } from "./metrics.ts";
import { decimal } from "./numbers.ts";
import { hireRows } from "./planned-hire-months.ts";
import type { CellChange } from "./cell-kinds.tsx";
import type { RecordTable, RowTotals } from "./record-table.ts";
import { ColouredName } from "./colour-swatch.tsx";
import { DraftedPartItem, type DraftedPart } from "./status-mark.tsx";
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

export interface AllocationLine {
  featureId: string;
  name: string;
  meaning: Meaning | null;
  colour: PaletteColour | null;
  // The percentage shown: as drafted, or, for a feature a draft takes off, as approved.
  percentage: number;
  // The percentage as approved; null for a feature a draft adds.
  live: number | null;
  drafted?: DraftedPart;
  draft?: DraftLike;
  // Set on a line as it is live, where draft changes it as drafted says, so it shows Live's dot.
  shownLive?: boolean;
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
          featureId,
          name,
          colour,
          percentage,
          drafted,
          draft,
          shownLive,
        }) => (
          <div
            key={featureId}
            className={[
              styles.line,
              drafted === "removed" && shownLive !== true
                ? recordTableClasses.struck
                : "",
            ].join(" ")}
            {...{ [tipAttribute]: name }}
          >
            <span className={styles.name}>
              <DraftedPartItem draft={draft} part={drafted} live={shownLive}>
                <ColouredName colour={colour}>{name}</ColouredName>
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

function featureOf(
  features: ReadonlyMap<string, AllocatedFeature>,
  { featureId }: Allocation,
): Pick<AllocationLine, "featureId" | "name" | "meaning" | "colour"> {
  // The server lists every feature an allocation names.
  const { name, meaning, colour } = features.get(featureId) as AllocatedFeature;
  return { featureId, name, meaning, colour };
}

// A month's allocations as approved, each feature by name.
function liveLines(
  allocations: readonly Allocation[],
  features: ReadonlyMap<string, AllocatedFeature>,
  month: string,
): AllocationLine[] {
  return allocations.flatMap((allocation): AllocationLine[] => {
    const percentage = percentageIn(allocation.months, month);
    return percentage === null
      ? []
      : [{ ...featureOf(features, allocation), percentage, live: percentage }];
  });
}

type Drafted = Allocation & { draft: AllocationDraft };

const isDrafted = (allocation: Allocation): allocation is Drafted =>
  allocation.draft !== undefined;

const draftedPercentage = ({ draft }: Drafted, month: string) =>
  draft.action === "deleted" ? null : percentageIn(draft.months, month);

// A month's allocations as drafts make them, with the features they add, take off, or change
// marked. With drafts applied, a feature a draft takes off is gone, rather than struck through.
function draftedLines(
  allocations: readonly Drafted[],
  features: ReadonlyMap<string, AllocatedFeature>,
  month: string,
  show: Show,
): AllocationLine[] {
  return allocations.flatMap((allocation): AllocationLine[] => {
    const live = percentageIn(allocation.months, month);
    const { draft } = allocation;
    const drafted = draftedPercentage(allocation, month);
    const feature = featureOf(features, allocation);
    if (drafted === null) {
      return live === null || show === "drafts"
        ? []
        : [{ ...feature, percentage: live, live, drafted: "removed", draft }];
    }
    if (drafted === live) return [{ ...feature, percentage: drafted, live }];
    return [
      {
        ...feature,
        percentage: drafted,
        live,
        drafted: live === null ? "added" : "changed",
        draft,
      },
    ];
  });
}

const featureIdsOf = (lines: readonly AllocationLine[]) =>
  lines
    .filter(({ drafted }) => drafted !== "removed")
    .map(({ featureId }) => featureId);

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
  features: ReadonlyMap<string, AllocatedFeature>,
  allMonths: readonly string[],
  show: Show,
): AllocationRow {
  const months = allMonths.filter((month) => holdsMonth(base, month));
  const liveIn = linesByMonth(months, (month) =>
    liveLines(allocations, features, month),
  );
  const live: AllocationRow = {
    ...base,
    values: Object.fromEntries(
      [...liveIn].map(([month, lines]) => [month, featureIdsOf(lines)]),
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
    ...draftedLines(withDraftShown, features, month, show),
    ...liveLines(withoutDraftShown, features, month),
  ]);
  return {
    ...live,
    values: Object.fromEntries(
      [...draftedIn].map(([month, lines]) => [month, featureIdsOf(lines)]),
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
          (draftedIn.get(month) ?? []).flatMap(
            ({ featureId, drafted, draft }) =>
              (drafted === "removed" || drafted === "changed") &&
              draft !== undefined
                ? [[featureId, { drafted, draft }] as const]
                : [],
          ),
        );
        return [
          month,
          lines.map((line) => {
            const change = changed.get(line.featureId);
            return change === undefined
              ? line
              : { ...line, ...change, shownLive: true };
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
  const features = new Map(
    allocations.features.map((feature) => [feature.id, feature]),
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
  const row = (base: BaseRow, of: ReadonlyMap<string, Allocation[]>) =>
    withAllocations(
      base,
      of.get(base.personId) ?? [],
      features,
      teamMonths.months,
      show,
    );
  return [
    ...people.map((person) => row(person, ofPeople)),
    ...hireRows(chart, teamMonths.months).map((hire) => row(hire, ofHires)),
  ];
}

export function allocationMonthsTable({
  teamMonths,
  features,
  managers,
  currentMonth,
  show,
}: {
  teamMonths: TeamMonths;
  features: readonly AllocatedFeature[];
  // The managers to group by, for roles that may group by manager.
  managers: readonly { id: string; name: string }[] | undefined;
  currentMonth: string;
  show: Show;
}): RecordTable<AllocationRow, CellChange, CellChange> {
  return {
    ...monthGridTable<AllocationRow>({
      months: teamMonths.months,
      currentMonth,
      label: "Allocations by month",
      choices: features,
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
            allocatable={allocatableIn(row, month)}
            show={show}
          />
        ),
      readOnly: () => true,
      groupings: monthGroupings(managers, teamMonths),
    }),
    totals: capacityTotals(show),
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

function capacityTotals(show: Show): RowTotals<AllocationRow> {
  return {
    label: `Total, ${personMonths.code}`,
    overall: `Organization, ${personMonths.code}`,
    cell: (rows, month) => <CapacityTotal {...capacityOf(rows, month, show)} />,
  };
}
