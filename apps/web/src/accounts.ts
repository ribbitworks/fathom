// SPDX-License-Identifier: Apache-2.0

// Account administration and changing one's own password, through the server's API, with the names
// users see for each role.

import {
  type Account,
  accountListSchema,
  accountSchema,
  type NewAccountRequest,
  type PasswordChangeRequest,
  type Role,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getJson, sendJson, sendJsonFor } from "./api.ts";

// Every role must be named, which the compiler checks.
const roleNames: Record<Role, string> = {
  viewer: "Viewer",
  "project-planner": "Project Planner",
  "resource-planner": "Resource Planner",
  "people-manager": "People Manager",
  "workforce-administrator": "Workforce Administrator",
  leadership: "Leadership",
  approver: "Approver",
  administrator: "Administrator",
};

export function roleName(role: Role): string {
  // The role is always one of the fixed roles named above.
  // eslint-disable-next-line security/detect-object-injection
  return roleNames[role];
}

export const accountsQuery = queryOptions({
  queryKey: ["accounts"],
  queryFn: async () =>
    (await getJson("/api/accounts", accountListSchema)).accounts,
});

const accountResponse = z.object({ account: accountSchema });

async function sendForAccount(
  path: string,
  body: object,
  method: "POST" | "PUT" = "PUT",
): Promise<Account> {
  return (await sendJsonFor(method, path, body, accountResponse)).account;
}

export const createAccount = (account: NewAccountRequest) =>
  sendForAccount("/api/accounts", account, "POST");

export const setRoles = (id: string, roles: Role[]) =>
  sendForAccount(`/api/accounts/${encodeURIComponent(id)}/roles`, { roles });

export const setActive = (id: string, active: boolean) =>
  sendForAccount(`/api/accounts/${encodeURIComponent(id)}/active`, { active });

export async function resetPassword(
  id: string,
  password: string,
): Promise<void> {
  await sendJson("PUT", `/api/accounts/${encodeURIComponent(id)}/password`, {
    password,
  });
}

export async function changePassword(
  request: PasswordChangeRequest,
): Promise<void> {
  await sendJson("POST", "/api/auth/change-password", request);
}
