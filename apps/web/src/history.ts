// SPDX-License-Identifier: Apache-2.0

// The access history, through the server's API, with how each kind of entry is put in words.

import {
  type AccessAction,
  accessActionSchema,
  type HistoryEntry,
  historyListSchema,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { roleName } from "./accounts.ts";
import { getJson } from "./api.ts";

export const historyQuery = queryOptions({
  queryKey: ["access-history"],
  queryFn: async () =>
    (await getJson("/api/access-history", historyListSchema)).entries,
});

// Every action must be described, which the compiler checks.
const actionNames: Record<AccessAction, string> = {
  "account-created": "Created the account",
  "roles-changed": "Changed the roles",
  "password-reset": "Reset the password",
  "account-deactivated": "Deactivated the account",
  "account-reactivated": "Reactivated the account",
};

// An action recorded by another version of Fathom, which this one does not know, is shown as it was
// stored.
export function describeAction(action: string): string {
  const known = accessActionSchema.safeParse(action);
  return known.success ? actionNames[known.data] : action;
}

// A person's name, or a plain description when their account no longer exists.
export function nameOf(person: { name: string | null }): string {
  return person.name ?? "A removed account";
}

// The roles involved in an entry, in words, or an empty string when none were.
export function describeDetails({ details }: HistoryEntry): string {
  const names = (roles: readonly Parameters<typeof roleName>[0][]) =>
    roles.length === 0 ? "no roles" : roles.map(roleName).join(", ");
  if (details.previousRoles !== undefined && details.roles !== undefined) {
    return `From ${names(details.previousRoles)} to ${names(details.roles)}`;
  }
  return details.roles === undefined ? "" : `With ${names(details.roles)}`;
}
