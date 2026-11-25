// SPDX-License-Identifier: Apache-2.0

// The fictional organization's allocations: one for each case a month can show, then the wider
// workload on top of them, and removing them. A development-only package, never included in the
// runtime image.

import {
  activities,
  allocations,
  type Database,
  drafts,
  privateChanges,
  recordChanges,
} from "@fathom/db";
import { fictionalId, type FictionalOrganization } from "@fathom/fixtures";
import { addToMonth, type AllocationMonths, monthOf } from "@fathom/shared";
import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { seededActivityIds, seededProjectActivityIds } from "./activities.ts";
import { seededFeatures } from "./features.ts";
import { featureId } from "./projects.ts";
import { filledIn, recorded, type SeededChange } from "./recorded.ts";
import { type WorkItem, workIds, workloadRows } from "./workload.ts";

// Who is allocated: a member of a seeded feature team, by the team's place and the member's place
// on it, the organization's first open planned hire with a target date, or a planned hire by name.
type Assignee =
  { team: number; member: number } | "planned hire" | { hire: string };

// Each month is counted from the seed day's, or a planned hire's from the month it is expected,
// before it when negative; null stops the allocation.
export const seededAllocations: readonly ({
  key: string;
  assignee: Assignee;
  months: Readonly<Record<number, number | null>>;
} & WorkItem)[] = [
  {
    key: "lead-offline",
    assignee: { team: 0, member: 0 },
    feature: "offline-sync",
    months: { [-3]: 100 },
  },
  // Over-allocated for three months.
  {
    key: "over-offline",
    assignee: { team: 0, member: 1 },
    feature: "offline-sync",
    months: { [-2]: 75 },
  },
  {
    key: "over-alerts",
    assignee: { team: 0, member: 1 },
    feature: "usage-alerts",
    months: { 0: 50, 3: null },
  },
  // Three assignments for four months, one of them to a Possible feature, which counts toward no
  // over-allocation, so the month is under-allocated too.
  {
    key: "three-offline",
    assignee: { team: 0, member: 2 },
    feature: "offline-sync",
    months: { [-1]: 50 },
  },
  {
    key: "three-mobile",
    assignee: { team: 0, member: 2 },
    feature: "mobile-approvals",
    months: { 1: 25, 5: null },
  },
  {
    key: "three-reports",
    assignee: { team: 0, member: 2 },
    feature: "report-builder",
    months: { 1: 25 },
  },
  // Past work on a feature now done, then the next.
  {
    key: "done-audit",
    assignee: { team: 0, member: 3 },
    feature: "audit-export",
    months: { [-6]: 100, [-2]: null },
  },
  {
    key: "after-audit",
    assignee: { team: 0, member: 3 },
    feature: "offline-sync",
    months: { [-2]: 100 },
  },
  // Under-allocated.
  {
    key: "under-mobile",
    assignee: { team: 0, member: 4 },
    feature: "mobile-approvals",
    months: { 0: 50, 6: null },
  },
  {
    key: "search-alerts",
    assignee: { team: 1, member: 1 },
    feature: "usage-alerts",
    months: { [-2]: 100, 4: null },
  },
  // A cancelled feature still allocated in months to come, over-allocating them until cleared.
  {
    key: "cancelled-import",
    assignee: { team: 1, member: 2 },
    feature: "bulk-import",
    months: { [-2]: 50, 2: null },
  },
  {
    key: "after-import",
    assignee: { team: 1, member: 2 },
    feature: "usage-alerts",
    months: { 0: 75 },
  },
  {
    key: "general",
    assignee: { team: 1, member: 3 },
    activity: { project: "crane-control", key: "general" },
    months: { [-2]: 100, 4: null },
  },
  {
    key: "planned-hire",
    assignee: "planned hire",
    feature: "mobile-approvals",
    months: { 0: 100, 6: null },
  },
  // The only allocation to a feature in Field Apps' next cycle, so a planned hire alone staffs it,
  // until that cycle ends.
  {
    key: "hire-alone",
    assignee: { hire: "Mobile developer" },
    feature: "work-order-sync",
    months: { 0: 100, 4: null },
  },
];

export const allocationId = (key: string) => fictionalId(`allocation:${key}`);

const seededIds = () => seededAllocations.map(({ key }) => allocationId(key));

// The planned hire allocated: the first open one with a target date.
const allocatedHire = (organization: FictionalOrganization) =>
  organization.hires.find(
    ({ meaning, targetDate, filledBy }) =>
      meaning === "open" && targetDate !== null && filledBy === null,
  );

// A feature team's members, in the order they joined; the first two teams have no one who left.
const membersOf = (organization: FictionalOrganization, team: number) =>
  (organization.featureTeams.at(team)?.memberships ?? [])
    .filter(({ member }) => member)
    .map(({ personId }) => personId);

const monthsFrom = (
  months: Readonly<Record<number, number | null>>,
  first: string,
): AllocationMonths =>
  Object.fromEntries(
    Object.entries(months).map(([offset, percentage]) => [
      addToMonth(first, Number(offset)),
      percentage,
    ]),
  );

export interface SeededAllocation {
  id: string;
  personId: string | null;
  plannedHireId: string | null;
  featureId: string | null;
  activityId: string | null;
  months: AllocationMonths;
}

// The allocations as seeding adds them, or none when the organization has no feature team or open
// planned hire with a target date to allocate.
export function seededAllocationRows(
  organization: FictionalOrganization,
): SeededAllocation[] {
  const hire = allocatedHire(organization);
  if (hire === undefined || membersOf(organization, 0).length === 0) return [];
  const current = monthOf(organization.referenceDate);
  // Who an allocation names, and the month its months are counted from: the seed day's for a person,
  // the month a planned hire is expected for a hire; none for a hire missing or with no target.
  const assigned = (assignee: Assignee) => {
    if (assignee !== "planned hire" && !("hire" in assignee)) {
      const member = membersOf(organization, assignee.team).at(assignee.member);
      return { personId: String(member), plannedHireId: null, from: current };
    }
    const planned =
      assignee === "planned hire"
        ? hire
        : organization.hires.find(({ name }) => name === assignee.hire);
    return planned === undefined || planned.targetDate === null
      ? undefined
      : {
          personId: null,
          plannedHireId: planned.id,
          from: monthOf(planned.targetDate),
        };
  };
  return seededAllocations.flatMap(({ key, assignee, months, ...work }) => {
    const to = assigned(assignee);
    if (to === undefined) return [];
    const { from, ...who } = to;
    return [
      {
        id: allocationId(key),
        ...who,
        ...workIds(work),
        months: monthsFrom(months, from),
      },
    ];
  });
}

// Adds the allocations, once, if the seeded projects' activities are there, which are seeded after
// the people, planned hires, and features. Returns whether it added them.
export async function seedAllocations(
  database: Database,
  organization: FictionalOrganization,
): Promise<boolean> {
  return database.transaction(async (transaction) => {
    const [present] = await transaction
      .select({ id: allocations.id })
      .from(allocations)
      .where(inArray(allocations.id, seededIds()));
    const activityIds = seededProjectActivityIds();
    const [{ activitiesPresent } = { activitiesPresent: 0 }] = await transaction
      .select({ activitiesPresent: count() })
      .from(activities)
      .where(inArray(activities.id, activityIds));
    const seeded = seededAllocationRows(organization);
    if (
      present !== undefined ||
      activitiesPresent < activityIds.length ||
      seeded.length === 0
    ) {
      return false;
    }
    const rows = [
      ...seeded,
      ...workloadRows(organization, {
        seededPeople: new Set(seeded.map(({ personId }) => personId)),
      }).map(({ key, ...row }) => ({
        id: allocationId(`workload:${key}`),
        ...row,
        plannedHireId: null,
      })),
    ];
    const made: SeededChange[] = [];
    for (const { id, ...row } of rows) {
      await transaction.insert(allocations).values({ id, ...row });
      made.push(...recorded("allocation", id, "created", filledIn(row)));
    }
    await recordChanges(transaction, null, made);
    return true;
  });
}

// Removes every allocation, and every draft of one, that is seeded or names a seeded person,
// planned hire, feature, or activity, recording what was removed.
export async function unseedAllocations(
  database: Database,
  organization: FictionalOrganization,
): Promise<void> {
  await database.transaction(async (transaction) => {
    const featureIds = seededFeatures.map(({ key }) => featureId(key));
    const activityIds = seededActivityIds();
    const personIds = organization.people.map(({ id }) => id);
    const hireIds = organization.hires.map(({ id }) => id);
    const removed = await transaction
      .delete(allocations)
      .where(
        or(
          inArray(allocations.id, seededIds()),
          inArray(allocations.featureId, featureIds),
          inArray(allocations.activityId, activityIds),
          inArray(allocations.personId, personIds),
          inArray(allocations.plannedHireId, hireIds),
        ),
      )
      .returning();
    const ids = [...seededIds(), ...removed.map(({ id }) => id)];
    for (const table of [drafts, privateChanges]) {
      await transaction
        .delete(table)
        .where(
          and(
            eq(table.recordType, "allocation"),
            or(
              inArray(table.recordId, ids),
              inArray(sql`${table.fields}->>'featureId'`, featureIds),
              inArray(sql`${table.fields}->>'activityId'`, activityIds),
              inArray(sql`${table.fields}->>'personId'`, personIds),
              inArray(sql`${table.fields}->>'plannedHireId'`, hireIds),
            ),
          ),
        );
    }
    const made = removed.flatMap(({ id, ...row }) =>
      recorded("allocation", id, "deleted", filledIn(row)),
    );
    if (made.length > 0) await recordChanges(transaction, null, made);
  });
}
