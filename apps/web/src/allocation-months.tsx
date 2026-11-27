// SPDX-License-Identifier: Apache-2.0

// The allocations grid: who is allocated to what, month by month, with each month's total against
// the time available.

import {
  type Allocation,
  allocatedTotal,
  type Capacity,
  allocationsSchema,
  byName,
  loadMark,
  type LoadMark,
  monthCapacity,
  type Show,
  summedCapacity,
  type TeamMonths,
  wholeMonth,
} from "@fathom/shared";
import { VisuallyHidden } from "@mantine/core";
import { queryOptions } from "@tanstack/react-query";
import type { ReactNode } from "react";
import styles from "./allocation-lines.module.css";
import { allocatedToGrouping } from "./allocation-groups.ts";
import {
  allocatableIn,
  type AllocatedWork,
  type AllocationLine,
  type AllocationRow,
  holdsMonth,
} from "./allocation-rows.ts";
import { getJson } from "./api.ts";
import { unitWords } from "./effort.ts";
import { share } from "./metrics.ts";
import { decimal } from "./numbers.ts";
import type { CellChange } from "./cell-kinds.tsx";
import pages from "./pages.module.css";
import type { RecordTable, RowGrouping, RowTotals } from "./record-table.ts";
import { rankOfNone } from "./row-groups.ts";
import { allocatedHours, countedTo, WorkFacts } from "./allocated-work.tsx";
import { ColouredName } from "./colour-swatch.tsx";
import {
  DraftedPartItem,
  besideLive,
  DraftedValue,
  LiveValue,
  viewedDraft,
} from "./status-mark.tsx";
import { tipAttribute } from "./table-tips.tsx";
import { monthGridTable, monthGroupings } from "./team-months.tsx";

export const allocationsQuery = queryOptions({
  queryKey: ["allocations"],
  queryFn: () => getJson("/api/allocations", allocationsSchema),
});

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
  bufferPercent,
}: {
  teamMonths: TeamMonths;
  works: readonly AllocatedWork[];
  allocations: readonly Allocation[];
  // The planning settings' Default buffer, which Remaining includes, for a reader sent it.
  bufferPercent?: number | undefined;
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
                  bufferPercent={bufferPercent}
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
