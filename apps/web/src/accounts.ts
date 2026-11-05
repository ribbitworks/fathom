// SPDX-License-Identifier: Apache-2.0

// Account administration, and changing one's own name and password, through the server's API, with
// the names users see for each role and what the Help page says each lets them do.

import {
  type Account,
  type AccountChangeRequest,
  accountListSchema,
  accountSchema,
  type NewAccountRequest,
  type OwnNameRequest,
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

// What each role lets a user do, matching what the server grants, as docs/product/roles.md sets out.
// Every role must be described, which the compiler checks.
const roleDescriptions: Record<Role, string> = {
  viewer: "See the plan and everyone's work assignments.",
  "project-planner":
    "Change the plan: projects, features, milestones, releases, products, customers, and estimates.",
  "resource-planner": "See people, and assign them to work.",
  "people-manager":
    "See people, including Restricted details, and maintain feature teams.",
  "workforce-administrator":
    "Maintain people, their columns and the lists they choose from, and feature teams, and see and change Restricted and Confidential details.",
  leadership:
    "See people, including Restricted and Confidential details, without changing them.",
  approver: "Approve draft changes to the plan, and feature teams.",
  administrator:
    "Manage accounts, their roles, and system settings, and see the access history, without seeing people.",
};

export function roleDescription(role: Role): string {
  // The role is always one of the fixed roles described above.
  // eslint-disable-next-line security/detect-object-injection
  return roleDescriptions[role];
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
  method: "POST" | "PUT" | "PATCH" = "PUT",
): Promise<Account> {
  return (await sendJsonFor(method, path, body, accountResponse)).account;
}

export const createAccount = (account: NewAccountRequest) =>
  sendForAccount("/api/accounts", account, "POST");

export const updateAccount = (id: string, change: AccountChangeRequest) =>
  sendForAccount(`/api/accounts/${encodeURIComponent(id)}`, change, "PATCH");

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

// What is wrong with a name the account rules refuse: the form's own words when it is empty, and the
// rule it breaks otherwise.
export function nameProblem(
  error: { type: string; message?: string | undefined } | undefined,
  empty: string,
): string | undefined {
  if (error === undefined) return undefined;
  return error.type === "too_small" ? empty : `${String(error.message)}.`;
}

export async function changeOwnName(request: OwnNameRequest): Promise<void> {
  await sendJson("PUT", "/api/account/name", request);
}

export async function changePassword(
  request: PasswordChangeRequest,
): Promise<void> {
  await sendJson("POST", "/api/auth/change-password", request);
}
