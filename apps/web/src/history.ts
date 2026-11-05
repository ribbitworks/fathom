// SPDX-License-Identifier: Apache-2.0

// The access history, through the server's API, and how each entry is put in words: a sentence
// naming who did what to whose account, whether it deserves attention, and the roles involved.

import {
  type AccessAction,
  accessActionSchema,
  type HistoryEntry,
  historyListSchema,
  type Role,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { roleName } from "./accounts.ts";
import { getJson } from "./api.ts";

export const historyQuery = queryOptions({
  queryKey: ["access-history"],
  queryFn: async () =>
    (await getJson("/api/access-history", historyListSchema)).entries,
});

interface ActionWords {
  // What the actor did, before the name of the account it was done to.
  verb: string;
  // Changes that reveal impersonation or lock someone out deserve a second look.
  caution: boolean;
}

// Every action must be described, which the compiler checks.
const actionWords: Record<AccessAction, ActionWords> = {
  "account-created": {
    verb: "created the account for",
    caution: false,
  },
  "roles-changed": {
    verb: "changed the roles of",
    caution: false,
  },
  "name-changed": {
    verb: "changed the name of",
    caution: false,
  },
  "email-changed": {
    verb: "changed the email address of",
    caution: false,
  },
  "password-reset": {
    verb: "reset the password for",
    caution: true,
  },
  "password-changed": {
    verb: "changed their own password",
    caution: false,
  },
  // Worth checking, since someone could take a name to act as another.
  "own-name-changed": {
    verb: "changed their own name",
    caution: true,
  },
  "account-deactivated": {
    verb: "deactivated the account for",
    caution: true,
  },
  "account-reactivated": {
    verb: "reactivated the account for",
    caution: false,
  },
  "restricted-viewed": {
    verb: "viewed people's Restricted or Confidential details",
    caution: false,
  },
  "restricted-changed": {
    verb: "changed the Restricted or Confidential details of",
    caution: false,
  },
  "hiring-plan-changed": {
    verb: "changed the hiring plan",
    caution: false,
  },
  "hiring-plan-viewed": {
    verb: "viewed the hiring plan",
    caution: false,
  },
};

// An action recorded by another version of Fathom, which this one does not know, is shown as it was
// stored.
export function describeAction(action: string): ActionWords {
  const known = accessActionSchema.safeParse(action);
  return known.success
    ? actionWords[known.data]
    : { verb: `${action}:`, caution: false };
}

// The person who made an entry's change, or Fathom's operators.
export function actorName({ actor }: HistoryEntry): string {
  return actor === null ? "Fathom's operators" : nameOf(actor);
}

// A person's name, or a plain description when their account no longer exists, with an account's
// email address, which tells it from another with a name that looks the same.
export function nameOf(person: {
  name: string | null;
  email?: string | null | undefined;
}): string {
  const name = person.name ?? "A removed account";
  return person.email ? `${name} (${person.email})` : name;
}

// Whom an entry names, if anyone: an account, or a person whose details changed.
export function subjectName({ action, subject }: HistoryEntry): string | null {
  // The verb already says whose password or name it was.
  if (
    subject === null ||
    action === "password-changed" ||
    action === "own-name-changed"
  ) {
    return null;
  }
  if (action === "restricted-changed") {
    // Unnamed for readers who may not see people, and for a person deleted since.
    return subject.name ?? "a person";
  }
  return nameOf(subject);
}

function names(roles: readonly Role[]): string {
  return roles.length === 0 ? "no roles" : roles.map(roleName).join(", ");
}

// The roles involved in an entry, in words, or an empty string when none were.
export function describeDetails({ details }: HistoryEntry): string {
  if (details.previousRoles !== undefined && details.roles !== undefined) {
    return `from ${names(details.previousRoles)} to ${names(details.roles)}`;
  }
  return details.roles === undefined ? "" : `with ${names(details.roles)}`;
}

// The words an entry shows, which a search on the page looks in.
export function entryText(entry: HistoryEntry): string {
  return [
    actorName(entry),
    describeAction(entry.action).verb,
    subjectName(entry) ?? "",
    describeDetails(entry),
  ].join(" ");
}
