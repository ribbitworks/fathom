// SPDX-License-Identifier: Apache-2.0

// A feature's or activity's hours on Allocations grouped by what each is allocated to: its effort,
// the hours its
// allocations give it over the grid's months, and what remains.

import {
  type AllocatedFeature,
  type Allocation,
  hoursAllocated,
  isForecast,
  remainingHours,
  type Show,
  type WorkEffort,
} from "@fathom/shared";
import { Text } from "@mantine/core";
import { decimal } from "./numbers.ts";
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

// The hours a feature's or activity's allocations give it over some months, after focus and ramp-up.
export const allocatedHours = (
  allocations: readonly Allocation[],
  workId: string,
  months: readonly string[],
  show: Show,
): number =>
  allocations.reduce(
    (total, allocation) =>
      (allocation.featureId ?? allocation.activityId) !== workId ||
      allocation.hours === undefined
        ? total
        : total +
          hoursAllocated(
            monthsShown(allocation, show),
            allocation.hours,
            months,
          ),
    0,
  );

// A work's estimate and the hours it needs as the Draft menu shows them.
export const effortShown = (
  effort: NonNullable<AllocatedFeature["effort"]>,
  show: Show,
): WorkEffort =>
  show === "drafts" && effort.drafted !== undefined
    ? effort.drafted
    : effort.live;

const hours = (value: number) => `${decimal(value)} h`;

// After a feature's or activity's heading: Effort · Allocated · Remaining. Remaining past what it
// needs reads in red with a minus sign, and None for done or cancelled work, or work with no
// estimate. Work the reader can't read shows none of it.
export function WorkFacts({
  work,
  allocated,
  show,
}: {
  work: Pick<AllocatedFeature, "effort" | "unseen" | "meaning">;
  allocated: number;
  show: Show;
}) {
  if (work.unseen === true || work.effort === undefined) return null;
  const { estimate, needed } = effortShown(work.effort, show);
  const remaining = isForecast(work.meaning)
    ? remainingHours(needed, allocated)
    : undefined;
  return (
    <Text component="span" fz="sm" c="dimmed">
      {" "}
      · Effort {estimate === null ? "None" : hours(estimate)} ·{" "}
      <span {...{ [tipAttribute]: "Over the months the grid shows" }}>
        Allocated {hours(allocated)}
      </span>{" "}
      · Remaining{" "}
      {remaining === undefined ? (
        "None"
      ) : remaining < 0 ? (
        <Text component="span" inherit c="red" data-over>
          {`\u2212${hours(-remaining)}`}
        </Text>
      ) : (
        hours(remaining)
      )}
    </Text>
  );
}
