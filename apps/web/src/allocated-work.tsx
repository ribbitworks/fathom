// SPDX-License-Identifier: Apache-2.0

// A feature's or activity's hours on Allocations grouped by what each is allocated to: its effort,
// the hours its allocations give it to its last month, and what remains.

import {
  type AllocatedFeature,
  type Allocation,
  hoursAllocated,
  isForecast,
  monthsBetween,
  remainingHours,
  type Show,
  type WorkEffort,
} from "@fathom/shared";
import { Text, VisuallyHidden } from "@mantine/core";
import { decimal, percentage } from "./numbers.ts";
import { tipAttribute } from "./table-tips.tsx";

// The percentages an allocation gives by month as the Draft menu shows them: as drafted, but for a
// rejected draft, while drafts show, and as approved otherwise.
function monthsShown(allocation: Allocation, show: Show) {
  const { draft } = allocation;
  if (show !== "drafts" || draft === undefined || draft.state === "rejected") {
    return allocation.months;
  }
  return draft.action === "deleted" ? {} : draft.months;
}

// The hours a feature's or activity's allocations give it, after focus, each from its
// first month to the last month given, so they don't depend on how far the grid reaches.
export const allocatedHours = (
  allocations: readonly Allocation[],
  workId: string,
  lastMonth: string,
  show: Show,
): number =>
  allocations.reduce((total, allocation) => {
    if (
      (allocation.featureId ?? allocation.activityId) !== workId ||
      allocation.hours === undefined
    ) {
      return total;
    }
    const percentages = monthsShown(allocation, show);
    const first = Object.keys(percentages).sort().at(0);
    return first === undefined
      ? total
      : total +
          hoursAllocated(
            percentages,
            allocation.hours,
            monthsBetween(first, lastMonth),
          );
  }, 0);

// A work's estimate, the hours it needs, and its last month, as the Draft menu shows them.
export const effortShown = (
  effort: NonNullable<AllocatedFeature["effort"]>,
  show: Show,
): WorkEffort =>
  show === "drafts" && effort.drafted !== undefined
    ? effort.drafted
    : effort.live;

// The month a work's allocations are counted to: its last month as shown, or the current month for
// work with no dates.
export const countedTo = (
  effort: NonNullable<AllocatedFeature["effort"]>,
  show: Show,
  currentMonth: string,
): string => effortShown(effort, show).lastMonth ?? currentMonth;

const hours = (value: number) => `${decimal(value)} h`;

// After a feature's or activity's heading: Effort · Allocated · Remaining. Remaining past what it
// needs reads in red with a minus sign, and None for done or cancelled work. Work with no estimate
// shows Allocated alone, and work the reader can't read none of it.
export function WorkFacts({
  work,
  allocated,
  show,
  bufferPercent = 0,
}: {
  work: Pick<AllocatedFeature, "effort" | "unseen" | "meaning">;
  allocated: number;
  show: Show;
  // The planning settings' Default buffer, which the hours remaining include, named in their tip.
  bufferPercent?: number | undefined;
}) {
  if (work.unseen === true || work.effort === undefined) return null;
  const { estimate, needed } = effortShown(work.effort, show);
  const remaining = isForecast(work.meaning)
    ? remainingHours(needed, allocated)
    : undefined;
  // Only a figure remaining includes the buffer; read aloud too, as only one tip shows on focus.
  const bufferTip =
    remaining !== undefined && bufferPercent > 0
      ? `Includes a ${percentage(bufferPercent)} buffer`
      : undefined;
  const allocatedFact = (
    <span
      {...{
        [tipAttribute]:
          "From each allocation's first month to the work's end, or to this month if the work has no dates",
      }}
    >
      Allocated {hours(allocated)}
    </span>
  );
  if (estimate === null) {
    return (
      <Text component="span" fz="sm" c="dimmed">
        {" "}
        · {allocatedFact}
      </Text>
    );
  }
  return (
    <Text component="span" fz="sm" c="dimmed">
      {" "}
      · Effort {hours(estimate)} · {allocatedFact} ·{" "}
      <span {...(bufferTip === undefined ? {} : { [tipAttribute]: bufferTip })}>
        Remaining{" "}
        {remaining === undefined ? (
          "None"
        ) : remaining < 0 ? (
          <Text component="span" inherit c="red" data-over>
            {`\u2212${hours(-remaining)}`}
          </Text>
        ) : (
          hours(remaining)
        )}
        {bufferTip !== undefined && (
          <VisuallyHidden>{`, ${bufferTip.toLowerCase()}`}</VisuallyHidden>
        )}
      </span>
    </Text>
  );
}
