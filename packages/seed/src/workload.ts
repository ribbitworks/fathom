// SPDX-License-Identifier: Apache-2.0

// The fictional organization's workload: allocations giving most current people who manage no one
// work this month, on top of the seeded allocations. A development-only package, never included in
// the runtime image.

import {
  type FictionalOrganization,
  type FictionalPerson,
  fillingHires,
  firstUnnamed,
} from "@fathom/fixtures";
import {
  addDays,
  addToMonth,
  type AllocationMonths,
  monthOf,
} from "@fathom/shared";
import { activityId } from "./activities.ts";
import { featureId } from "./projects.ts";

// What people work on: a seeded feature, by key, or a seeded activity, by its project's key and its
// own.
export type WorkItem =
  { feature: string } | { activity: { project: string; key: string } };

// The feature or activity a piece of work names, the other left empty.
export const workIds = (
  item: WorkItem,
): { featureId: string | null; activityId: string | null } =>
  "feature" in item
    ? { featureId: featureId(item.feature), activityId: null }
    : {
        featureId: null,
        activityId: activityId(item.activity.project, item.activity.key),
      };

// Work under way this month, which the workload spreads people across.
export const currentWork: readonly WorkItem[] = [
  { feature: "offline-sync" },
  { feature: "usage-alerts" },
  { activity: { project: "crane-control", key: "general" } },
  { activity: { project: "clinic-booking", key: "general" } },
  { activity: { project: "transit-displays", key: "warranty-support" } },
  { activity: { project: "internal-tools", key: "general" } },
  { activity: { project: "depot-operations", key: "depot-rollout" } },
  { feature: "signature-capture" },
  { feature: "parts-lookup" },
  { feature: "barcode-scanning" },
  { feature: "site-diary" },
  { feature: "timesheet-sync" },
];

// Earlier work, on features now done, which some did before their current work.
export const earlierWork: readonly WorkItem[] = [
  { feature: "sign-on" },
  { feature: "crew-roster" },
  { feature: "job-sheets" },
  { feature: "offline-forms" },
];

// How each person's time is shared this month, in turn: most full time on one piece of work, some
// split, one in twelve over-allocated and one under; every percentage the grid offers appears.
const shares: readonly (readonly number[])[] = [
  [100],
  [50, 50],
  [100],
  [75, 25],
  [100, 25],
  [100],
  [50],
  [90, 10],
  [100],
  [50, 50],
  [100],
  [100],
];

// One in this many people allocated is left with none, so some are free.
const freeEvery = 30;

// One in this many people's last piece of work ends some months on, so not all of it runs on.
const endingEvery = 5;

// How many managers give a little time to a piece of work, and how much.
const managerShares = [10, 25, 25] as const;

// An allocation of the workload, by a key of its own, which the allocations seed makes its ID from.
export interface WorkloadAllocation {
  key: string;
  personId: string;
  featureId: string | null;
  activityId: string | null;
  months: AllocationMonths;
}

export interface Workload {
  // Those the seeded allocations already allocate, each as one of their cases, which the workload
  // leaves as they are.
  seededPeople: ReadonlySet<string | null>;
}

// Whether a person is still employed on a day, or will be once they start.
const stillEmployed = (person: FictionalPerson, day: string) =>
  person.startDate !== null &&
  (person.endDate === null || person.endDate > day);

const allocatable = (
  organization: FictionalOrganization,
  { seededPeople }: Pick<Workload, "seededPeople">,
) => {
  const filling = fillingHires(organization.hires);
  return (person: FictionalPerson, place: number) =>
    place >= firstUnnamed &&
    !seededPeople.has(person.id) &&
    !filling.has(person.id) &&
    stillEmployed(person, organization.referenceDate);
};

// The people the workload allocates, in their order in the organization: those working now who
// manage no one, the first few managers, and the first still to start with no notes, whom it
// allocates a month early.
export function workloadPeople(
  organization: FictionalOrganization,
  workload: Pick<Workload, "seededPeople">,
): {
  working: FictionalPerson[];
  managers: FictionalPerson[];
  early: FictionalPerson | undefined;
} {
  const { referenceDate, people } = organization;
  const free = allocatable(organization, workload);
  const open = people.filter((person, place) => free(person, place));
  const started = open.filter(
    ({ startDate }) => String(startDate) <= referenceDate,
  );
  return {
    working: started.filter(({ isManager }) => !isManager),
    managers: started
      .filter(({ isManager }) => isManager)
      .slice(0, managerShares.length),
    early: open.find(
      ({ startDate, isManager, notes }) =>
        String(startDate) > referenceDate &&
        !isManager &&
        Object.keys(notes).length === 0,
    ),
  };
}

// The first of those leaving, whose allocations run on after they leave, as ones left in place by
// mistake would.
const leavingFirst = ({ people, referenceDate }: FictionalOrganization) =>
  people
    .filter(({ endDate }) => endDate !== null && endDate > referenceDate)
    .sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)))[0];

const earliest = (months: readonly (string | undefined)[]) =>
  months.filter((month) => month !== undefined).sort()[0];

const months = (
  from: string,
  percentage: number,
  stop: string | undefined,
): AllocationMonths => ({
  [from]: percentage,
  ...(stop === undefined ? {} : { [stop]: null }),
});

// The workload's allocations.
export function workloadRows(
  organization: FictionalOrganization,
  workload: Workload,
): WorkloadAllocation[] {
  const { referenceDate } = organization;
  const current = monthOf(referenceDate);
  const { working, managers, early } = workloadPeople(organization, workload);
  const runsOn = leavingFirst(organization);
  const row = (
    key: string,
    person: FictionalPerson,
    item: WorkItem,
    allocated: AllocationMonths,
  ): WorkloadAllocation => ({
    key,
    personId: person.id,
    ...workIds(item),
    months: allocated,
  });
  const ofWorking = working.flatMap((person, place) => {
    if (place % freeEvery === freeEvery - 1) return [];
    // Counted in days, as start dates move with the seed day, so the same allocations come out
    // whatever its day of the month. Back up to a year, but never before they started.
    const back = addDays(referenceDate, -30 * (1 + (place % 12)));
    const fromDay =
      String(person.startDate) > back ? String(person.startDate) : back;
    // Every third person who started long enough ago worked on a feature now done until three
    // months ago; at least a month apart, its first month and the next work's never meet.
    const switchDay = addDays(referenceDate, -90);
    const earlier = place % 3 === 0 && fromDay < addDays(switchDay, -31);
    const nowFrom = monthOf(earlier ? switchDay : fromDay);
    const left =
      person === runsOn || person.endDate === null
        ? undefined
        : addToMonth(monthOf(person.endDate), 1);
    const ending =
      place % endingEvery === 2
        ? addToMonth(current, 3 + (place % 7))
        : undefined;
    const split = shares[place % shares.length] as readonly number[];
    return [
      ...(earlier
        ? [
            row(
              `${person.id}:earlier`,
              person,
              earlierWork[place % earlierWork.length] as WorkItem,
              {
                [monthOf(fromDay)]: 100,
                [nowFrom]: null,
              },
            ),
          ]
        : []),
      ...split.map((percentage, at) =>
        row(
          `${person.id}:${String(at)}`,
          person,
          currentWork[(place + at * 2) % currentWork.length] as WorkItem,
          months(
            nowFrom,
            percentage,
            earliest([left, at === split.length - 1 ? ending : undefined]),
          ),
        ),
      ),
    ];
  });
  const ofManagers = managers.map((manager, at) =>
    row(
      `${manager.id}:manager`,
      manager,
      currentWork[currentWork.length - 1 - at] as WorkItem,
      months(addToMonth(current, -2), Number(managerShares.at(at)), undefined),
    ),
  );
  const ofEarly =
    early === undefined
      ? []
      : [
          row(
            `${early.id}:early`,
            early,
            currentWork[0] as WorkItem,
            months(
              addToMonth(monthOf(String(early.startDate)), -1),
              100,
              undefined,
            ),
          ),
        ];
  return [...ofWorking, ...ofManagers, ...ofEarly];
}
