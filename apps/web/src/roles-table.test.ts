// SPDX-License-Identifier: Apache-2.0

// Tests for the Roles table's rows and what the shared table is told about them: each role's values,
// columns that count roles only, a read-only table of keyed records, what a role's menu offers each
// reader, and who holds a role.

import { describe, expect, it, vi } from "vitest";
import { breaksDown } from "./grid-columns.tsx";
import {
  roleActions,
  roleColumnOrder,
  roleColumns,
  roleHolders,
  roleRows,
  rolesTable,
} from "./roles-table.tsx";
import {
  auditors,
  fictionalAccount,
  teamMemberRole,
} from "./test-roles-page.tsx";

describe("the Roles table", () => {
  it("makes a row of each role, with its name, description and how many accounts hold it", () => {
    const [row] = roleRows([auditors]);
    expect(row).toEqual({
      id: auditors.id,
      name: "Fictional Auditors",
      description: auditors.description,
      accounts: 1,
      role: auditors,
    });
  });

  it("starts with Role, Description and Accounts, read by each row's values", () => {
    const columns = roleColumns();
    const [row] = roleRows([auditors]);
    if (row === undefined) throw new Error("No row");
    expect(columns.map(({ key }) => key)).toEqual(roleColumnOrder);
    expect(columns.map((column) => [column.label, column.value(row)])).toEqual([
      ["Role", "Fictional Auditors"],
      ["Description", auditors.description],
      ["Accounts", "1"],
    ]);
  });

  it("offers Metrics no column to break down by or sum, so it counts roles only", () => {
    const columns = roleColumns();
    expect(columns.filter(breaksDown)).toEqual([]);
    expect(columns.filter(({ sum }) => sum !== undefined)).toEqual([]);
  });

  it("shows roles as they are, keyed, and opens a role's details", () => {
    const onOpen = vi.fn();
    const table = rolesTable({ onOpen, menuItems: () => null });
    const rows = roleRows([teamMemberRole, auditors]);
    const [row] = rows;
    if (row === undefined) throw new Error("No row");

    expect(table.liveRecords(rows)).toEqual(rows);
    expect(table.keyOf?.(row)).toEqual({ kind: "role", keyNumber: 1 });
    table.showDetails?.(row);
    expect(onOpen).toHaveBeenCalledWith(teamMemberRole);
  });
});

describe("what a role's menu offers", () => {
  it("offers Edit… and Copy… to a reader who may edit roles", () => {
    expect(roleActions(true)).toEqual(["edit", "copy"]);
  });

  it("offers only View… to a reader who may only see roles", () => {
    expect(roleActions(false)).toEqual(["view"]);
  });
});

describe("who holds a role", () => {
  it("lists the active accounts holding the role, in the order given", () => {
    const accounts = [
      fictionalAccount("a1", "Fictional Archivist", [auditors]),
      fictionalAccount("a2", "Fictional Builder", [teamMemberRole]),
      fictionalAccount("a3", "Fictional Checker", [teamMemberRole, auditors]),
      fictionalAccount("a4", "Fictional Departed", [auditors], false),
    ];
    expect(roleHolders(auditors.id, accounts).map(({ name }) => name)).toEqual([
      "Fictional Archivist",
      "Fictional Checker",
    ]);
  });

  it("lists none for a role no active account holds", () => {
    expect(
      roleHolders(auditors.id, [
        fictionalAccount("a4", "Fictional Departed", [teamMemberRole]),
      ]),
    ).toEqual([]);
  });
});
