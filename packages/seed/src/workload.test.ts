// SPDX-License-Identifier: Apache-2.0

// Tests for the fictional workload: who it allocates and who it leaves alone, how this month reads
// across the organization, and the allocations that fall outside someone's employment on purpose.

import {
  fictionalOrganization,
  fillingHires,
  firstUnnamed,
  leavingInDays,
} from "@fathom/fixtures";
import {
  addDays,
  addToMonth,
  allocatedTotal,
  type AllocationMonths,
  monthOf,
  percentageIn,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { seededAllocationRows } from "./allocations.ts";
import { fieldAppsFeatures } from "./field-apps.ts";
import { seededFeatures } from "./features.ts";
import { featureId } from "./projects.ts";
import {
  currentWork,
  earlierWork,
  workIds,
  workloadPeople,
  workloadRows,
} from "./workload.ts";

const referenceDate = "2026-11-15";
const organization = fictionalOrganization({ size: 150, referenceDate });
const seeded = seededAllocationRows(organization);
const seededPeople = new Set(seeded.map(({ personId }) => personId));
const rows = workloadRows(organization, { seededPeople });
// The feature or activity an allocation names.
const workOf = (allocation: {
  featureId: string | null;
  activityId: string | null;
}) => String(allocation.featureId ?? allocation.activityId);
const month = monthOf(referenceDate);
const personOf = (id: string) =>
  organization.people.find((person) => person.id === id);

describe("the workload", () => {
  it("leaves alone the first people, those filling hires, and those the seeded allocations name", () => {
    const filling = fillingHires(organization.hires);
    for (const { personId } of rows) {
      const place = organization.people.findIndex(({ id }) => id === personId);
      expect(place).toBeGreaterThanOrEqual(firstUnnamed);
      expect(filling.has(personId)).toBe(false);
      expect(seededPeople.has(personId)).toBe(false);
    }
  });

  it("works on current work, or on a done feature only in months past, once each", () => {
    const current = new Set(currentWork.map((item) => workOf(workIds(item))));
    const done = new Set(
      earlierWork.flatMap((item) =>
        "feature" in item ? [featureId(item.feature)] : [],
      ),
    );
    for (const row of rows) {
      if (!current.has(workOf(row))) {
        expect(done.has(workOf(row))).toBe(true);
        expect(percentageIn(row.months, month)).toBeNull();
      }
    }
    const pairs = [...seeded, ...rows].map(
      (row) => `${String(row.personId)} ${workOf(row)}`,
    );
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("staffs every committed Field Apps feature, the one in the next cycle by a planned hire alone", () => {
    const all: { personId: string | null; featureId: string | null }[] = [
      ...seeded,
      ...rows,
    ];
    const hireAlone = seeded.filter(
      ({ featureId: id }) => id === featureId("work-order-sync"),
    );
    expect(hireAlone.map(({ plannedHireId }) => plannedHireId)).toEqual([
      organization.hires.find(({ name }) => name === "Mobile developer")?.id,
    ]);
    const committed = fieldAppsFeatures.filter(
      ({ status }) => status === "planned" || status === "in-progress",
    );
    expect(
      committed.map(({ key }) =>
        all.some(
          ({ featureId: id, personId }) =>
            id === featureId(key) && personId !== null,
        ),
      ),
    ).toEqual(committed.map(({ key }) => key !== "work-order-sync"));
  });

  it("gives this month most people full time, and some over, under and not allocated", () => {
    const all: {
      personId: string | null;
      featureId: string | null;
      months: AllocationMonths;
    }[] = [...seeded, ...rows];
    const working = organization.people.filter(
      ({ startDate, endDate, isManager }) =>
        !isManager &&
        String(startDate) <= referenceDate &&
        (endDate === null || endDate > referenceDate),
    );
    const totals = working.map((person) =>
      allocatedTotal(
        all
          .filter(({ personId }) => personId === person.id)
          .map(({ months, featureId: id }) => ({
            percentage: percentageIn(months, month) ?? 0,
            meaning:
              id === featureId("report-builder")
                ? ("possible" as const)
                : ("planned" as const),
          })),
      ),
    );
    expect({
      full: totals.filter((total) => total === 100).length,
      over: totals.filter((total) => total > 100).length,
      under: totals.filter((total) => total > 0 && total < 100).length,
      none: totals.filter((total) => total === 0).length,
    }).toEqual({ full: 86, over: 10, under: 10, none: 12 });
    const percentages = new Set(
      rows.flatMap(({ months }) => Object.values(months)),
    );
    for (const offered of [10, 25, 50, 75, 90, 100]) {
      expect(percentages.has(offered)).toBe(true);
    }
  });

  it("gives three managers a little time", () => {
    const { managers } = workloadPeople(organization, { seededPeople });
    expect(
      managers.map(({ id }) =>
        rows
          .filter(({ personId }) => personId === id)
          .map(({ months }) => percentageIn(months, month)),
      ),
    ).toEqual([[10], [25], [25]]);
  });

  it("allocates outside employment only someone still to start, a month early, and the first to leave, after leaving", () => {
    const { early } = workloadPeople(organization, { seededPeople });
    const soonest = organization.people.find(
      ({ endDate }) => endDate === addDays(referenceDate, leavingInDays[0]),
    );
    const outside = rows.filter(({ personId, months }) => {
      const person = personOf(personId);
      const first = Object.keys(months).sort()[0];
      const stop = Object.entries(months).find(([, value]) => value === null);
      return (
        String(first) < monthOf(String(person?.startDate)) ||
        (person?.endDate !== null &&
          (stop === undefined ||
            stop[0] > addToMonth(monthOf(String(person?.endDate)), 1)))
      );
    });
    expect(
      [...new Set(outside.map(({ personId }) => personId))].sort(),
    ).toEqual([String(early?.id), String(soonest?.id)].sort());
  });

  it("ends some work in months to come, and lets the rest run on", () => {
    const ending = rows.filter(({ months }) =>
      Object.entries(months).some(
        ([key, value]) => value === null && key > month,
      ),
    );
    expect(ending.length).toBeGreaterThan(0);
    expect(ending.length).toBeLessThan(rows.length / 2);
  });

  it.each(["2026-11-01", "2026-11-30", "2027-02-28"])(
    "makes the same allocations when seeded on %s",
    (day) => {
      const keys = (made: readonly { key: string }[]) =>
        made.map(({ key }) => key).sort();
      const onDay = fictionalOrganization({ size: 150, referenceDate: day });
      expect(keys(workloadRows(onDay, { seededPeople }))).toEqual(keys(rows));
    },
  );

  it("allocates no one early when no one is still to start", () => {
    const started = organization.people.filter(
      ({ startDate }) => String(startDate) <= referenceDate,
    );
    expect(
      workloadRows(
        { ...organization, people: started },
        { seededPeople },
      ).filter(({ key }) => key.endsWith(":early")),
    ).toEqual([]);
  });
});

describe("what Overview counts on the seed day", () => {
  const all = [...seeded, ...rows];
  const allocated = new Set(all.map(({ featureId: id }) => id));
  const committed = seededFeatures.filter(
    ({ status }) => status === "planned" || status === "in-progress",
  );

  it("has features not staffed and with no estimate", () => {
    expect(
      committed
        .filter(({ key }) => !allocated.has(featureId(key)))
        .map(({ key }) => key),
    ).toEqual(["scheduler-api", "retention-controls"]);
    expect(
      committed.filter(({ hours }) => hours === null).map(({ key }) => key),
    ).toEqual(["scheduler-api"]);
  });

  it("has a late open hire, open hires with no allocation, and someone leaving within the month", () => {
    const open = organization.hires.filter(
      ({ meaning, filledBy }) => meaning === "open" && filledBy === null,
    );
    const hired = new Set(seeded.map(({ plannedHireId }) => plannedHireId));
    expect(
      open
        .filter(
          ({ targetDate }) => targetDate !== null && targetDate < referenceDate,
        )
        .map(({ name }) => name),
    ).toEqual(["Data engineer"]);
    expect(
      open
        .filter(({ id }) => !hired.has(id))
        .map(({ requisition, name }) => String(requisition ?? name)),
    ).toEqual(["REQ-2042", "Backend engineer 2", "REQ-2047", "REQ-2053"]);
    expect(
      organization.people.filter(
        ({ endDate }) =>
          endDate !== null &&
          endDate > referenceDate &&
          endDate <= addDays(referenceDate, 30),
      ),
    ).toHaveLength(1);
  });
});
