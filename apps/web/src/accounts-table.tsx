// SPDX-License-Identifier: Apache-2.0

// The Accounts page's table on the shared table, read only, since accounts are changed in their
// dialogs: each account's name, with This account after the reader's own, its email address, its
// roles, the default first, whether it is active, and the day it was made, each account's details
// opening beside it.

import type { Account } from "@fathom/shared";
import { noDrafts } from "./drafts.ts";
import { rolesHeld } from "./names.ts";
import {
  type Column,
  fieldColumn,
  type GridRecord,
  readOnlyTableParts,
  type RecordTable,
} from "./record-grid.tsx";
import { FactBox } from "./status-mark.tsx";
import { dayOf } from "./today.ts";

// Accounts have no drafts.
export interface AccountRow extends GridRecord {
  draft?: undefined;
  name: string;
  email: string;
  created: string;
  roles: string[];
  status: string;
  account: Account;
}

const active = "active";
const deactivated = "deactivated";

const statusChoices = [
  { id: active, label: "Active" },
  { id: deactivated, label: "Deactivated" },
].map((choice) => ({ ...choice, description: "", retired: false }));

// An account's roles in words, the default first, marked so.
export const rolesText = (account: Account): string =>
  rolesHeld(
    account.role?.name,
    account.roles.map(({ name }) => name),
  ).join(", ");

export const accountRows = (accounts: readonly Account[]): AccountRow[] =>
  accounts.map((account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    created: dayOf(account.createdAt),
    // The default role first, as the account's roles are named.
    roles: [
      ...(account.role === null ? [] : [account.role.id]),
      ...account.roles
        .map(({ id }) => id)
        .filter((id) => id !== account.role?.id),
    ],
    status: account.active ? active : deactivated,
    account,
  }));

export const accountColumnOrder = [
  "name",
  "email",
  "roles",
  "status",
  "created",
];

// The table's columns, which the account's details list too.
export function accountColumns(
  accounts: readonly Account[],
  ownId: string,
): Column<AccountRow, never>[] {
  const roles = [
    ...new Map(
      accounts.flatMap(({ roles: held }) =>
        held.map((role) => [role.id, role]),
      ),
    ).values(),
  ]
    .sort((one, other) => one.name.localeCompare(other.name))
    .map(({ id, name }) => ({
      id,
      label: name,
      description: "",
      retired: false,
    }));
  // Every account has each of its values, so its columns are required, and the shared table offers
  // to break down by only those worth it: its roles and status.
  const column = (
    key: string,
    label: string,
    kind: "text" | "date" | "choice",
    choices: Column<AccountRow>["choices"] = [],
    multiple = false,
  ) =>
    fieldColumn<AccountRow, never>(key, kind, {
      label,
      required: true,
      multiple,
      choices,
    });
  return [
    {
      ...column("name", "Name", "text"),
      mark: (row) => row.id === ownId && <FactBox>This account</FactBox>,
    },
    column("email", "Email address", "text"),
    // An account whose roles could not be read holds none, which Fathom never makes, but which is
    // shown as such.
    {
      ...column("roles", "Roles", "choice", roles, true),
      required: false,
      emptyLabel: "No role",
      standIn: () => "No role",
      content: ({ account }) => rolesText(account),
    },
    column("status", "Status", "choice", statusChoices),
    column("created", "Created", "date"),
  ];
}

// The table of accounts, read only.
export function accountsTable({
  accounts,
  ownId,
  onOpen,
}: {
  accounts: readonly Account[];
  ownId: string;
  onOpen: (account: Account) => void;
}): RecordTable<AccountRow, never, undefined> {
  const shownColumns = accountColumns(accounts, ownId);
  return {
    ...readOnlyTableParts,
    label: "Accounts",
    one: "account",
    noun: "accounts",
    nameOf: (row) => row.name,
    nameColumn: "name",
    columnsFor: () => shownColumns,
    liveRecords: (rows) => [...rows],
    drafts: () => noDrafts(),
    showDetails: (row) => {
      onOpen(row.account);
    },
  };
}
