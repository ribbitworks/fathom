// SPDX-License-Identifier: Apache-2.0

// Tests for the Accounts table's rows and what the shared table is told about them: each account's
// values, its roles with the default first, the day it was made in Fathom's time zone, and a table
// that is read only, with no drafts.

import { type Account, defaultTimeZone } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { accountRows, accountsTable } from "./accounts-table.tsx";
import { setTimeZone } from "./today.ts";

afterEach(() => {
  setTimeZone(defaultTimeZone);
});

const role = (id: string, name: string) => ({ id, name });
const account: Account = {
  id: "10000000-0000-4000-8000-000000000001",
  keyNumber: 1,
  name: "Fictional Person",
  email: "person@example.test",
  role: role("r2", "Product Manager"),
  roles: [role("r1", "Administrator"), role("r2", "Product Manager")],
  active: false,
  createdAt: "2026-10-12T09:00:00.000Z",
};

describe("the Accounts table", () => {
  it("makes a row of each account, its default role first", () => {
    const [row] = accountRows([account]);
    expect(row).toMatchObject({
      id: account.id,
      name: "Fictional Person",
      email: "person@example.test",
      roles: ["r2", "r1"],
      status: "deactivated",
    });
  });

  it("dates each account by the day it was made in Fathom's time zone", () => {
    // Given a moment early on Oct 12 in UTC, still Oct 11 in Vancouver
    setTimeZone("America/Vancouver");

    const [row] = accountRows([
      { ...account, createdAt: "2026-10-12T03:00:00.000Z" },
    ]);

    expect(row?.created).toBe("2026-10-11");
  });

  it("shows accounts as they are, and opens an account's details", () => {
    const onOpen = vi.fn();
    const table = accountsTable({ accounts: [account], ownId: "", onOpen });
    const rows = accountRows([account]);
    const [row] = rows;
    if (row === undefined) throw new Error("No row");

    expect(table.liveRecords(rows)).toEqual(rows);
    table.showDetails?.(row);
    expect(onOpen).toHaveBeenCalledWith(account);
  });
});
