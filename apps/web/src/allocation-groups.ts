// SPDX-License-Identifier: Apache-2.0

// The rows someone has in the Allocations grid when grouped, as the Decisions Log sets out: by
// manager, a row under each manager they reported to in the months shown, and by feature team, a
// row under each team they were on and one under none for the months they were employed on none.
// Each row holds only its own months, with the months outside employment, shaded on every row; a
// single group's row holds every month.

import type { TeamMonths } from "@fathom/shared";
import { groupedRowId } from "./table-view.ts";
import {
  featureTeamGrouping,
  managerGrouping,
  type MonthRow,
  type PersonMonths,
  teamsAcross,
} from "./team-months.tsx";

export interface HeldRow extends MonthRow {
  // The months this row holds, when someone has a row under each of several groups.
  holds?: ReadonlySet<string>;
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
