// SPDX-License-Identifier: Apache-2.0

// The access history, through the server's API, and how each entry is put in words: a sentence
// naming who did what to whose account, whether it deserves attention, and the roles involved, by
// name.

import {
  type AccessAction,
  accessActionSchema,
  characterKinds,
  classifiedDataWords,
  classNames,
  type HistoryEntry,
  historyListSchema,
  type PasswordSettings,
  permissionLabel,
  tierSchema,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { getJson } from "./api.ts";
import { rolesHeld } from "./names.ts";

export const historyQuery = queryOptions({
  queryKey: ["access-history"],
  queryFn: async () =>
    (await getJson("/api/access-history", historyListSchema)).entries,
});

interface ActionWords {
  // What the actor did, before the name of the account it was done to.
  verb: string;
  // Changes that could give access, reveal impersonation, or lock someone out need a second look.
  caution: boolean;
}

// Every action must be described, which the compiler checks.
const actionWords: Record<AccessAction, ActionWords> = {
  // Worth checking, since the account's role gives it access, Confidential data included.
  "account-created": {
    verb: "created the account for",
    caution: true,
  },
  // Worth checking, since a new role can give more access, Confidential data included.
  "roles-changed": {
    verb: "changed the role of",
    caution: true,
  },
  "role-switched": {
    verb: "switched role",
    caution: false,
  },
  "signed-in": {
    verb: "signed in",
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
  "personal-viewed": {
    verb: "viewed people's Personal or Confidential details",
    caution: false,
  },
  "personal-changed": {
    verb: "changed the Personal or Confidential details of",
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
  "role-created": {
    verb: "created the role",
    caution: false,
  },
  // Worth checking, since a change to a role can give its holders, including whoever made it, more
  // access.
  "role-changed": {
    verb: "changed the role",
    caution: true,
  },
  "time-zone-changed": {
    verb: "changed Fathom's time zone",
    caution: false,
  },
  // Worth checking, since weaker rules or recipes make passwords easier to guess.
  "password-settings-changed": {
    verb: "changed Fathom's password settings",
    caution: true,
  },
  // Worth checking, since a move can show data to more people.
  "data-class-moved": {
    verb: "moved",
    caution: true,
  },
  "data-exported": {
    verb: "exported",
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
    action === "own-name-changed" ||
    action === "role-switched" ||
    action === "signed-in"
  ) {
    return null;
  }
  if (action === "personal-changed") {
    // Unnamed for readers who may not see people, and for a person deleted since.
    return subject.name ?? "a person";
  }
  return nameOf(subject);
}

function permissionNames(permissions: readonly string[]): string {
  return permissions.map(permissionLabel).join(", ");
}

// What a role entry names: the role, any name it had before, and the permissions it was given or
// lost.
function describeRole(details: HistoryEntry["details"]): string {
  const parts = [
    details.previousName === undefined
      ? String(details.role)
      : `${String(details.role)}, before named ${details.previousName}`,
    ...(details.granted !== undefined && details.granted.length > 0
      ? [`granting ${permissionNames(details.granted)}`]
      : []),
    ...(details.withdrawn !== undefined && details.withdrawn.length > 0
      ? [`withdrawing ${permissionNames(details.withdrawn)}`]
      : []),
  ];
  return parts.join("; ");
}

// What changed in the password settings, one phrase for each setting.
function describePasswords(
  { rules, recipe }: PasswordSettings,
  previous: PasswordSettings,
): string {
  const chosen = "password requirements";
  const made = "generated passwords";
  const phrases: string[] = [];
  if (rules.minimumLength !== previous.rules.minimumLength) {
    phrases.push(
      `${chosen} need ${String(rules.minimumLength)} characters, not ${String(previous.rules.minimumLength)}`,
    );
  }
  for (const kind of characterKinds) {
    if (rules[kind.type] !== previous.rules[kind.type]) {
      phrases.push(
        `${chosen} ${rules[kind.type] ? "need" : "no longer need"} ${kind.one}`,
      );
    }
  }
  if (recipe.length !== previous.recipe.length) {
    phrases.push(
      `${made} have ${String(recipe.length)} characters, not ${String(previous.recipe.length)}`,
    );
  }
  for (const kind of characterKinds) {
    if (recipe[kind.type] !== previous.recipe[kind.type]) {
      phrases.push(
        `${made} ${recipe[kind.type] ? "use" : "no longer use"} ${kind.all}`,
      );
    }
  }
  if (recipe.avoidLookAlikes !== previous.recipe.avoidLookAlikes) {
    phrases.push(
      `${made} ${recipe.avoidLookAlikes ? "leave out" : "may use"} characters that look alike`,
    );
  }
  return phrases.join("; ");
}

// An account's roles as they were then, or its default alone, as entries made before accounts held
// several roles name it.
function heldRoles(
  role: string | undefined,
  roles: readonly string[] | undefined,
): string | undefined {
  if (roles === undefined || roles.length === 0) return role;
  return rolesHeld(role, roles).join(", ");
}

// The roles, time zones, or password settings involved in an entry, in words, or an empty string
// when none were. An account's roles are named as they were then.
export function describeDetails({ action, details }: HistoryEntry): string {
  const { role, previousRole, timeZone, previousTimeZone } = details;
  const held = heldRoles(role, details.roles);
  const previousHeld = heldRoles(previousRole, details.previousRoles);
  if (action === "account-created" && held !== undefined) return `with ${held}`;
  if (action === "signed-in" && role !== undefined) return `as ${role}`;
  if (
    (action === "roles-changed" || action === "role-switched") &&
    held !== undefined
  ) {
    return previousHeld === undefined
      ? `to ${held}`
      : `from ${previousHeld} to ${held}`;
  }
  if (role !== undefined) return describeRole(details);
  if (timeZone !== undefined) {
    return previousTimeZone === undefined
      ? `to ${timeZone}`
      : `from ${previousTimeZone} to ${timeZone}`;
  }
  if (
    details.passwords !== undefined &&
    details.previousPasswords !== undefined
  ) {
    return describePasswords(details.passwords, details.previousPasswords);
  }
  if (details.exported !== undefined) {
    return `${details.exported} with ${classifiedDataWords({
      personal: details.personalColumns ?? [],
      confidential: details.confidentialColumns ?? [],
    })}`;
  }
  if (details.moved !== undefined) {
    return `${details.moved} from ${className(details.previousDataClass)} to ${className(details.dataClass)}`;
  }
  return "";
}

// A class's name as stored, as people read it, or as stored when this version does not know it.
function className(stored: string | undefined): string {
  if (stored === undefined) return "an unrecorded class";
  const known = tierSchema.safeParse(stored);
  return known.success ? classNames[known.data] : stored;
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
