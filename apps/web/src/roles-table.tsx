// SPDX-License-Identifier: Apache-2.0

// The Roles page's table, on the shared table, what a role's menu offers each reader, and who holds
// a role.

import type { Account, RecordKeyOf, RoleSummary } from "@fathom/shared";
import type { ReactNode } from "react";
import { fieldColumn } from "./grid-columns.tsx";
import { liveTableParts } from "./live-table.ts";
import {
  type Column,
  generalExport,
  type GridRecord,
  readOnlyTableParts,
  type RecordTable,
} from "./record-table.ts";
import type { Kind } from "./table-view.ts";

export interface RoleRow extends GridRecord {
  draft?: undefined;
  name: string;
  description: string;
  accounts: number;
  role: RoleSummary;
}

export const roleRows = (roles: readonly RoleSummary[]): RoleRow[] =>
  roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    accounts: role.accounts,
    role,
  }));

export const roleColumnOrder = ["name", "description", "accounts"];

// The table's columns, which the role's details list too. Metrics counts roles only: each role's
// name and description are its own, and adding up Accounts would count an account once for each
// role it holds.
export function roleColumns(): Column<RoleRow, never>[] {
  const column = (
    key: string,
    label: string,
    kind: Kind,
    required: boolean,
  ): Column<RoleRow, never> => ({
    ...fieldColumn<RoleRow, never>(key, kind, {
      label,
      required,
      multiple: false,
      choices: [],
    }),
    breaksDown: false,
  });
  return [
    column("name", "Role", "text", true),
    {
      ...column("description", "Description", "text", false),
      emptyLabel: "No description",
    },
    column("accounts", "Accounts", "number", true),
  ];
}

// Made once, so the table's Key column is made again only when the roles change.
const roleKeyOf = (row: RoleRow): RecordKeyOf => ({
  kind: "role",
  keyNumber: row.role.keyNumber,
});

// The table of roles, read only: roles change in their dialogs, which a role's menu opens.
export function rolesTable({
  onOpen,
  menuItems,
}: {
  onOpen: (role: RoleSummary) => void;
  menuItems: (row: RoleRow) => ReactNode;
}): RecordTable<RoleRow, never, undefined> {
  const shownColumns = roleColumns();
  return {
    ...readOnlyTableParts,
    ...liveTableParts,
    label: "Roles",
    exported: generalExport,
    one: "role",
    noun: "roles",
    nameOf: (row) => row.name,
    nameColumn: "name",
    columnsFor: () => shownColumns,
    showDetails: (row) => {
      onOpen(row.role);
    },
    menuItems,
    keyOf: roleKeyOf,
  };
}

export type RoleAction = "edit" | "copy" | "view";

// A reader who may edit roles edits a role or copies it into a new one; anyone else views it.
export const roleActions = (canEdit: boolean): readonly RoleAction[] =>
  canEdit ? ["edit", "copy"] : ["view"];

// The active accounts holding a role, in the order given, as its count counts them.
export const roleHolders = (
  roleId: string,
  accounts: readonly Account[],
): Account[] =>
  accounts.filter(
    (account) =>
      account.active && account.roles.some(({ id }) => id === roleId),
  );
