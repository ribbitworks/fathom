// SPDX-License-Identifier: Apache-2.0

// The rows someone has in the allocations grid when it is grouped by manager, by feature team or by
// what they're allocated to.

import type { TeamMonths } from "@fathom/shared";
import { groupedRowId } from "./row-groups.ts";
import {
  featureTeamGrouping,
  managerGrouping,
  type MonthRow,
  type PersonMonths,
  teamsAcross,
} from "./team-months.tsx";

// Grouped by the feature or activity someone is allocated to, with a row under each.
export const allocatedToGrouping = "allocated-to";

export interface HeldRow extends MonthRow {
  // The months this row holds, when someone has a row under each of several groups.
  holds?: ReadonlySet<string>;
  // The feature or activity this row is for, when grouped by what someone is allocated to.
  work?: string;
}

type MonthManagers = TeamMonths["people"][number]["managers"] | undefined;

interface MonthGroup {
  key: string;
  months: readonly string[];
}

const noGroup = "";

function splitRows<Row extends HeldRow>(
  base: Row,
  groups: readonly MonthGroup[],
  withGroup: (row: Row, key: string) => Row,
): Row[] {
  if (groups.length <= 1) {
    const only = groups[0];
    return [only === undefined ? base : withGroup(base, only.key)];
  }
  return groups.map(({ key, months }) =>
    withGroup(
      {
        ...base,
        id: groupedRowId(key, base.personId),
        holds: new Set([...months, ...base.outside]),
      },
      key,
    ),
  );
}

function byManager<Row extends HeldRow>(
  base: Row,
  managers: MonthManagers,
): Row[] {
  if (managers === undefined) return [base];
  const lines = new Map(Object.entries(managers));
  const known = new Map(
    [...lines.values()].flatMap((manager) =>
      manager === null ? [] : [[manager.id, manager] as const],
    ),
  );
  const each = new Map<string, string[]>();
  for (const month of [...lines.keys()].sort()) {
    if (base.outside.has(month)) continue;
    const key = lines.get(month)?.id ?? noGroup;
    each.set(key, [...(each.get(key) ?? []), month]);
  }
  return splitRows(
    base,
    [...each].map(([key, months]) => ({ key, months })),
    (row, key) => ({ ...row, manager: known.get(key) ?? null }),
  );
}

function byTeam<Row extends HeldRow>(
  base: Row,
  teamsIn: PersonMonths["teamsIn"],
  months: readonly string[],
): Row[] {
  const teams = teamsAcross(teamsIn);
  const onNone = months.filter(
    (month) =>
      !base.outside.has(month) && (teamsIn.get(month) ?? []).length === 0,
  );
  const groups: MonthGroup[] = [
    ...teams.map(({ team, months: on }) => ({ key: team.id, months: on })),
    ...(onNone.length === 0 ? [] : [{ key: noGroup, months: onNone }]),
  ];
  const byId = new Map(teams.map(({ team }) => [team.id, team]));
  return splitRows(base, groups, (row, key) => {
    const team = byId.get(key);
    return team === undefined ? row : { ...row, group: team };
  });
}

// Someone's rows under the grouping given, from their row and their months as approved.
export function groupedRows<Row extends HeldRow>(
  base: Row,
  {
    teamsIn,
    managers,
    months,
    grouping,
  }: {
    teamsIn: PersonMonths["teamsIn"];
    managers: MonthManagers;
    months: readonly string[];
    grouping: string | undefined;
  },
): Row[] {
  if (grouping === managerGrouping) return byManager(base, managers);
  if (grouping === featureTeamGrouping) return byTeam(base, teamsIn, months);
  return [base];
}

// Someone's row under each feature or activity they're allocated to, each with its allocations
// alone, so its cells show its line; one row under none when they're allocated to nothing.
export function rowsByWork<
  Row extends HeldRow,
  Allocated extends { featureId: string | null; activityId: string | null },
>(
  base: Row,
  allocations: readonly Allocated[],
): { row: Row; allocations: Allocated[] }[] {
  const byWork = new Map<string, Allocated[]>();
  for (const allocation of allocations) {
    // Every allocation names a feature or an activity.
    const work = String(allocation.featureId ?? allocation.activityId);
    byWork.set(work, [...(byWork.get(work) ?? []), allocation]);
  }
  if (byWork.size === 0) return [{ row: base, allocations: [] }];
  return [...byWork].map(([featureId, ofFeature]) => ({
    row: {
      ...base,
      id: groupedRowId(featureId, base.personId),
      work: featureId,
    },
    allocations: ofFeature,
  }));
}
