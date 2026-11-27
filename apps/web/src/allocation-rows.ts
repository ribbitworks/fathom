// SPDX-License-Identifier: Apache-2.0

// The allocations grid's rows: a row for each person and planned hire, with the work each is
// allocated to month by month, as approved and as drafts make it.

import {
  type AllocatedFeature,
  type Allocation,
  type AllocationDraft,
  type Allocations,
  byName,
  type Meaning,
  type OrgChart,
  type PaletteColour,
  percentageIn,
  type Show,
  type TeamMonths,
} from "@fathom/shared";
import {
  allocatedToGrouping,
  groupedRows,
  type HeldRow,
  rowsByWork,
} from "./allocation-groups.ts";
import type { DraftLike } from "./draft-marks.ts";
import { hireRows } from "./planned-hire-months.ts";
import { type DraftedPart, viewedDraft } from "./status-mark.tsx";
import {
  type MonthRow,
  personDraft,
  teamMonthRecords,
} from "./team-months.tsx";

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
  // The hours a whole month of the row's time gives, after focus.
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

export const holdsMonth = (row: Pick<AllocationRow, "holds">, month: string) =>
  row.holds === undefined || row.holds.has(month);

export function allocatableIn(row: AllocationRow, month: string): boolean {
  return holdsMonth(row, month) && !row.outside.has(month);
}

// What a line of an allocation's names, with the hours a whole month of its person's time gives.
function workOf(
  works: ReadonlyMap<string, AllocatedWork>,
  allocation: Allocation,
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
    monthHours: hoursOf(allocation),
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
const hoursOf = (allocation: Allocation): number => allocation.hours ?? 0;

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
      : [{ ...workOf(works, allocation), percentage, live: percentage }];
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
    const work = workOf(works, allocation);
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
  const everyone = teamMonthRecords(
    teamMonths,
    undefined,
    "live",
    hireRows(chart, teamMonths.months),
  ).flatMap((record) => {
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
        ...(person.madeName === undefined ? {} : { madeName: person.madeName }),
        ...(person.plannedHire === undefined ? {} : { plannedHire: true }),
        ...(person.expected === undefined ? {} : { expected: person.expected }),
      },
      {
        teamsIn: person.teamsIn,
        managers: managersOf.get(person.personId),
        months: teamMonths.months,
        grouping,
      },
    );
  });
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
  return everyone.flatMap((row) =>
    rows(row, row.plannedHire === true ? ofHires : ofPeople),
  );
}
