// SPDX-License-Identifier: Apache-2.0

// Who is allocated to what, month by month, through the server's API, as a read-only table of
// records: the people of the feature teams' grid, with the planned hires the org chart draws, each
// month's cell listing the features someone is allocated to with their percentages, and the month's
// total, marked over or under a whole month as the Decisions Log sets out. The months allocation
// drafts change are shown as a draft of the row, as team drafts are on the Teams grid.

import {
  type AllocatedFeature,
  type Allocation,
  type AllocationDraft,
  allocatedTotal,
  type Allocations,
  allocationsSchema,
  byName,
  loadMark,
  type LoadMark,
  type Meaning,
  type OrgChart,
  type OrgChartPerson,
  percentageIn,
  type Show,
  type TeamMonths,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import styles from "./allocation-lines.module.css";
import { getJson } from "./api.ts";
import type { CellChange } from "./cell-kinds.tsx";
import pages from "./pages.module.css";
import type { RecordTable } from "./record-grid.tsx";
import {
  DraftDot,
  type DraftedPart,
  DraftedWords,
  type DraftLike,
} from "./status-mark.tsx";
import { tipAttribute } from "./table-tips.tsx";
import {
  monthGridTable,
  monthGroupings,
  type MonthRow,
  peopleManagers,
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
  // The percentage shown: as drafted, or, for a feature a draft takes off, as approved.
  percentage: number;
  // The percentage as approved; null for a feature a draft adds.
  live: number | null;
  drafted?: DraftedPart;
  draft?: DraftLike;
}

export interface AllocationRow extends MonthRow {
  allocated: ReadonlyMap<string, AllocationLine[]>;
  // For a planned hire: the month it is expected, the first it can be allocated in.
  allocatableFrom?: string;
  // For a planned hire with no name: its position and ID, shown in grey in place of a name.
  madeName?: string;
  live?: AllocationRow | undefined;
}

const marks: Record<
  LoadMark,
  { words: string; className: string | undefined }
> = {
  over: { words: "Over", className: styles.over },
  under: { words: "Under", className: styles.under },
};

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

export function allocatableIn(row: AllocationRow, month: string): boolean {
  return (
    !row.outside.has(month) &&
    (row.allocatableFrom === undefined || row.allocatableFrom <= month)
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
  const total = monthTotal(lines, show);
  const mark = loadMark({ total, month, currentMonth, allocatable });
  // The key is one of the union's own.
  // eslint-disable-next-line security/detect-object-injection
  const marked = mark === undefined ? undefined : marks[mark];
  const withTotal = lines.length > 1 || marked !== undefined;
  return (
    <div className={styles.lines}>
      {lines.map(({ featureId, name, percentage, drafted, draft }) => (
        <div
          key={featureId}
          className={[
            styles.line,
            drafted === "removed" ? pages.struck : "",
          ].join(" ")}
          {...{ [tipAttribute]: name }}
        >
          <span className={styles.name}>
            {draft !== undefined && drafted !== "removed" && (
              <DraftDot draft={draft} />
            )}
            {name}
          </span>
          <span>{percentage}%</span>
          {drafted !== undefined && <DraftedWords drafted={drafted} />}
        </div>
      ))}
      {withTotal && (
        <div
          className={[styles.line, styles.total, marked?.className ?? ""].join(
            " ",
          )}
        >
          <span>{marked?.words ?? "Total"}</span>
          <span>{total}%</span>
        </div>
      )}
    </div>
  );
}

function featureOf(
  features: ReadonlyMap<string, AllocatedFeature>,
  { featureId }: Allocation,
): Pick<AllocationLine, "featureId" | "name" | "meaning"> {
  // The server lists every feature an allocation names.
  const { name, meaning } = features.get(featureId) as AllocatedFeature;
  return { featureId, name, meaning };
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
  base: MonthRow & Pick<AllocationRow, "allocatableFrom" | "madeName">,
  allocations: readonly Allocation[],
  features: ReadonlyMap<string, AllocatedFeature>,
  months: readonly string[],
  show: Show,
): AllocationRow {
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
    live,
  };
}

const plannedHires = (chart: OrgChart) =>
  chart.people.flatMap((card) =>
    card.planned === undefined ? [] : [{ ...card, planned: card.planned }],
  );

// A planned hire's manager, a person or a planned manager, who is on the chart.
function hireManager(
  chart: OrgChart,
  { managerId }: OrgChartPerson,
): MonthRow["manager"] {
  if (managerId === null) return null;
  // The chart draws every placeholder under a manager it holds.
  const manager = chart.people.find(
    ({ id }) => id === managerId,
  ) as OrgChartPerson;
  return { id: managerId, name: manager.preferredName };
}

// Everyone the grid's rows report to: people's managers and planned hires'.
export const allocationManagers = (teamMonths: TeamMonths, chart: OrgChart) => [
  ...peopleManagers(teamMonths),
  ...plannedHires(chart).flatMap((card) => hireManager(chart, card) ?? []),
];

// The planned hires the org chart draws, as rows under their managers and under no feature team.
function hireRows(
  chart: OrgChart,
): (MonthRow & Pick<AllocationRow, "allocatableFrom" | "madeName">)[] {
  return plannedHires(chart).map((card) => {
    const unnamed = card.planned.shownId !== undefined;
    return {
      id: card.id,
      personId: card.id,
      name: unnamed ? "" : card.preferredName,
      ...(unnamed ? { madeName: card.preferredName } : {}),
      manager: hireManager(chart, card),
      values: {},
      links: {},
      outside: new Set<string>(),
      allocatableFrom: card.planned.expected,
    };
  });
}

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
  const people = teamMonthRecords(teamMonths, grouping, "live").map(
    (record): MonthRow => {
      const person = record.live ?? record;
      return {
        id: person.id,
        personId: person.personId,
        name: person.name,
        manager: person.manager,
        ...(person.group === undefined ? {} : { group: person.group }),
        values: {},
        links: {},
        outside: person.outside,
      };
    },
  );
  const row = (
    base: MonthRow & Pick<AllocationRow, "allocatableFrom" | "madeName">,
    of: ReadonlyMap<string, Allocation[]>,
  ) =>
    withAllocations(
      base,
      of.get(base.personId) ?? [],
      features,
      teamMonths.months,
      show,
    );
  return [
    ...people.map((person) => row(person, ofPeople)),
    ...hireRows(chart).map((hire) => row(hire, ofHires)),
  ];
}

export function allocationMonthsTable({
  teamMonths,
  features,
  managers,
  seesPeople,
  currentMonth,
  show,
}: {
  teamMonths: TeamMonths;
  features: readonly AllocatedFeature[];
  managers: readonly { id: string; name: string }[];
  seesPeople: boolean;
  currentMonth: string;
  show: Show;
}): RecordTable<AllocationRow, CellChange, CellChange> {
  return monthGridTable<AllocationRow>({
    months: teamMonths.months,
    label: "Allocations by month",
    choices: features,
    content: (row, month) => (
      <AllocationLines
        lines={row.allocated.get(month) ?? []}
        month={month}
        currentMonth={currentMonth}
        allocatable={allocatableIn(row, month)}
        show={show}
      />
    ),
    readOnly: () => true,
    standIn: ({ madeName }) => madeName ?? "",
    groupings: monthGroupings(seesPeople, managers, teamMonths),
  });
}
