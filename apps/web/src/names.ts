// SPDX-License-Identifier: Apache-2.0

// A person's initials, for their avatar: the first letters of their first two names, a person's
// name with the role they acted as, and the roles an account holds.

import { sameName } from "@fathom/shared";

// Each name's first character is taken whole, as the reader sees it, so no character is ever split,
// whatever its script.
const characters = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== "")
    .slice(0, 2)
    .map((part) =>
      [...characters.segment(part)]
        .slice(0, 1)
        .map(({ segment }) => segment.toUpperCase())
        .join(""),
    )
    .join("");
}

// A person's name with the role they acted as, when it is known and the name isn't the role's own,
// as an account named after its role's is.
export function nameAs(name: string, role: string | null | undefined): string {
  return role && !sameName(name, role) ? `${name} as ${role}` : name;
}

// Everyone who changed a draft, first to last, Fathom itself among them by name, since several
// people's changes to one record make one draft. A draft one person changed names the role they
// acted as; with several, the one role recorded would read as everyone's.
export function makerNames(draft: {
  madeBy: string | null;
  madeAs?: string | null | undefined;
  editors?: (string | null)[] | undefined;
}): string[] {
  const names = (draft.editors?.length ? draft.editors : [draft.madeBy]).map(
    (name) => name ?? "Fathom",
  );
  const [only] = names;
  return names.length === 1 && only !== undefined
    ? [nameAs(only, draft.madeAs)]
    : names;
}

// An account's roles by name, the default first and marked when it holds several.
export function rolesHeld(
  defaultRole: string | undefined,
  roles: readonly string[],
): string[] {
  const others = roles.filter((name) => name !== defaultRole);
  if (defaultRole === undefined) return others;
  return others.length === 0
    ? [defaultRole]
    : [`${defaultRole} (default)`, ...others];
}
