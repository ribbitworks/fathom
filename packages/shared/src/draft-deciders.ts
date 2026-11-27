// SPDX-License-Identifier: Apache-2.0

// Who decides a draft: the Approver of its kind's area, or, for a column and a list or choice made
// with one, the Approver of the column's table, who also sees what deciding it needs.

import {
  holdsAny,
  type Permission,
  permissionLabel,
  withImplied,
} from "./access.ts";
import {
  type ColumnTable,
  columnTableOf,
  columnTables,
} from "./column-tables.ts";
import {
  type ClassifiedField,
  classPermissions,
  type DataClasses,
} from "./data-classes.ts";
import {
  type ApprovePermission,
  approvedAreaNames,
  approvePermissions,
  type DraftKind,
  draftKinds,
} from "./drafts.ts";
import { columnTablePolicies } from "./people.ts";
import { eitherOf } from "./words.ts";

// The kinds a column's table decides: a column, and a list or choice made with one.
export const tableKinds = ["field", "list", "list-item"] as const;

type TableKind = (typeof tableKinds)[number];

const byTable = (kind: DraftKind): kind is TableKind =>
  (tableKinds as readonly DraftKind[]).includes(kind);

// What deciding a column, list or choice also needs: the sight of people that General lists and
// columns take, since their values are people's details.
const tableSight: Permission = "people:view";

// A draft as deciding it needs: its kind, with, for a column, its table, absent for one recorded
// before columns had tables, and, for a list or choice made with a column, that column's table, and
// the sight of what it holds that deciding it needs besides its kind's, such as a fill's.
export interface Decided {
  kind: DraftKind;
  table?: ColumnTable | undefined;
  sight?: readonly Permission[] | undefined;
}

const sightOf = ({ kind, sight = [] }: Decided): Permission[] => [
  ...(byTable(kind) ? [tableSight] : []),
  ...sight,
];

const lackedSight = (
  permissions: readonly string[],
  decided: Decided,
): Permission[] => {
  const held = withImplied(permissions);
  return sightOf(decided).filter((permission) => !held.includes(permission));
};

// What deciding a fill's drafts needs besides their kinds': sight of start and end dates when it
// names who fills the hire, who may not have started, and, when it carries the hire's feature teams
// to them, sight of feature teams and of the days people join them too.
export function fillSight(
  dataClasses: DataClasses,
  { names, carries }: { names: boolean; carries: boolean },
): Permission[] {
  const fields: ClassifiedField[] = [
    ...(names || carries ? (["startDate", "endDate"] as const) : []),
    ...(carries ? (["featureTeamDates"] as const) : []),
  ];
  const classes = new Set(
    // The field is always one of the fixed fields.
    // eslint-disable-next-line security/detect-object-injection
    fields.map((field) => dataClasses[field]),
  );
  return [
    ...(carries ? (["feature-teams:view"] as const) : []),
    ...[...classes].flatMap((dataClass) =>
      dataClass === "general"
        ? []
        : // The class is always one of the fixed classes.
          // eslint-disable-next-line security/detect-object-injection
          [classPermissions[dataClass].view],
    ),
  ];
}

// The Approve permissions that decide a draft, any one of them sufficing.
export const decidersOf = ({
  kind,
  table,
}: Decided): readonly [ApprovePermission, ...ApprovePermission[]] => {
  if (kind === "field") {
    return [columnTablePolicies[columnTableOf(table)].approveNeeds];
  }
  return table !== undefined && byTable(kind)
    ? // The table is always one of the fixed tables.
      // eslint-disable-next-line security/detect-object-injection
      [columnTablePolicies[table].approveNeeds]
    : // The kind is always one of the fixed list.
      // eslint-disable-next-line security/detect-object-injection
      approvePermissions[kind];
};

export const decides = (
  permissions: readonly string[],
  decided: Decided,
): boolean =>
  holdsAny(permissions, decidersOf(decided)) &&
  lackedSight(permissions, decided).length === 0;

// The areas whose Approvers decide a draft, either being enough, such as "features and releases",
// or "the plan or configuration".
export const areaWords = (decided: Decided): string =>
  eitherOf(
    // Each Approve permission always comes from the fixed list.
    // eslint-disable-next-line security/detect-object-injection
    decidersOf(decided).map((permission) => approvedAreaNames[permission]),
  );

// Why a role may not approve a draft that takes along another it does not decide, such as a column
// only drafted to be added that a feature is given a value in, naming that one, since approving one
// approves both; undefined when it may.
export const takenAlongRefusal = (
  permissions: readonly string[],
  decided: Decided,
  name: string,
): string | undefined =>
  decides(permissions, decided)
    ? undefined
    : `Approving this also approves ${name}, which needs ${eitherOf(
        (holdsAny(permissions, decidersOf(decided))
          ? lackedSight(permissions, decided)
          : decidersOf(decided)
        ).map(permissionLabel),
      )}.`;

// A kind of draft as a role decides it: a column's, and a list's or choice's made with a column, by
// the column's table.
export type DecidedKind =
  Exclude<DraftKind, "field"> | `${TableKind} on ${ColumnTable}`;

export const decidedKindOf = ({ kind, table }: Decided): DecidedKind => {
  if (kind === "field") return `field on ${columnTableOf(table)}`;
  return table !== undefined && byTable(kind) ? `${kind} on ${table}` : kind;
};

// Every kind there is: a column on each table, and a list or choice made with a column only on a
// table whose columns make new lists.
const everyDecided: readonly Decided[] = [
  ...draftKinds.flatMap((kind) => (kind === "field" ? [] : [{ kind }])),
  ...columnTables.flatMap((table) =>
    tableKinds
      // The table is always one of the fixed tables.
      // eslint-disable-next-line security/detect-object-injection
      .filter((kind) => kind === "field" || columnTablePolicies[table].newLists)
      .map((kind) => ({ kind, table })),
  ),
];

export const decidedKinds: readonly DecidedKind[] =
  everyDecided.map(decidedKindOf);

export const approvableKinds = (
  permissions: readonly string[],
): DecidedKind[] =>
  everyDecided
    .filter((decided) => decides(permissions, decided))
    .map(decidedKindOf);
