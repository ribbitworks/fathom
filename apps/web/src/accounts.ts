// SPDX-License-Identifier: Apache-2.0

// Account administration, and changing one's own name and password, through the server's API. The
// server answers a new account and a password reset with the password it generated, this once.

import {
  type Account,
  type AccountChangeRequest,
  type RoleSummary,
  staysManageable,
  accountListSchema,
  accountSchema,
  type CreatedAccount,
  createdAccountSchema,
  generatedPasswordSchema,
  type NewAccountRequest,
  type OwnNameRequest,
  type PasswordChangeRequest,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getJson, sendJson, sendJsonFor } from "./api.ts";

export const accountsQuery = queryOptions({
  queryKey: ["accounts"],
  queryFn: async () =>
    (await getJson("/api/accounts", accountListSchema)).accounts,
});

const accountResponse = z.object({ account: accountSchema });

async function sendForAccount(
  path: string,
  body: object,
  method: "POST" | "PUT" | "PATCH" = "PUT",
): Promise<Account> {
  return (await sendJsonFor(method, path, body, accountResponse)).account;
}

export const createAccount = (
  account: NewAccountRequest,
): Promise<CreatedAccount> =>
  sendJsonFor("POST", "/api/accounts", account, createdAccountSchema);

export const updateAccount = (id: string, change: AccountChangeRequest) =>
  sendForAccount(`/api/accounts/${encodeURIComponent(id)}`, change, "PATCH");

export const setActive = (id: string, active: boolean) =>
  sendForAccount(`/api/accounts/${encodeURIComponent(id)}/active`, { active });

// Returns the password the server generated.
export async function resetPassword(id: string): Promise<string> {
  return (
    await sendJsonFor(
      "POST",
      `/api/accounts/${encodeURIComponent(id)}/password`,
      {},
      generatedPasswordSchema,
    )
  ).password;
}

// The default role among an account's roles: the one it had, while it still holds it, or else the
// first, or none without roles.
export function defaultAmong(
  roleIds: readonly string[],
  previous: string,
): string {
  return roleIds.includes(previous) ? previous : (roleIds[0] ?? "");
}

// What is wrong with a name the account rules refuse: the form's own words when it is empty, and the
// rule it breaks otherwise.
export function nameProblem(
  error: { type: string; message?: string | undefined } | undefined,
  empty: string,
): string | undefined {
  if (error === undefined) return undefined;
  return error.type === "too_small" ? empty : String(error.message);
}

export async function changeOwnName(request: OwnNameRequest): Promise<void> {
  await sendJson("PUT", "/api/account/name", request);
}

export async function changePassword(
  request: PasswordChangeRequest,
): Promise<void> {
  await sendJson("POST", "/api/auth/change-password", request);
}

// The changes to an account that the server refuses: the roles picked for it that it cannot give
// up, and whether it cannot be deactivated.
export interface RefusedChanges {
  roleIds: ReadonlySet<string>;
  deactivating: boolean;
}

export function refusedChanges(
  account: Account,
  picked: readonly string[],
  accounts: readonly Account[],
  roles: readonly RoleSummary[],
): RefusedChanges {
  const changed = (change: Partial<Account>) =>
    accounts.map((other) =>
      other.id === account.id ? { ...other, ...change } : other,
    );
  const holding = (roleIds: readonly string[]) =>
    roles.filter(({ id }) => roleIds.includes(id));
  return {
    // Adding a role never leaves Fathom unmanageable, so only those picked can be refused.
    roleIds: new Set(
      picked.filter(
        (roleId) =>
          !staysManageable(
            changed({
              roles: holding(picked.filter((other) => other !== roleId)),
            }),
            roles,
          ),
      ),
    ),
    deactivating:
      account.active && !staysManageable(changed({ active: false }), roles),
  };
}
