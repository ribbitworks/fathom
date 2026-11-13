// SPDX-License-Identifier: Apache-2.0

// Roles through the server's API, and what a role's permissions mean in plain English: what its
// holders can and cannot do, which pages they see, which permissions do nothing without others, how
// a list of these changed, and, for a change to a role, what each account holding it gains and
// loses.

import {
  type DataClasses,
  type Permission,
  permissionDescriptions,
  permissionGrid,
  roleEffectsSchema,
  roleListSchema,
  type RoleChange,
  type RoleRequest,
  roleResponseSchema,
  type RoleSummary,
  viewsOfRole,
  withImplied,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { getJson, sendJsonFor } from "./api.ts";
import { pagesOpened } from "./layout.tsx";

export const rolesQuery = queryOptions({
  queryKey: ["roles"],
  queryFn: async () => (await getJson("/api/roles", roleListSchema)).roles,
});

export async function createRole(role: RoleRequest): Promise<RoleSummary> {
  return (await sendJsonFor("POST", "/api/roles", role, roleResponseSchema))
    .role;
}

export async function updateRole(
  id: string,
  role: RoleChange,
): Promise<RoleSummary> {
  return (
    await sendJsonFor(
      "PUT",
      `/api/roles/${encodeURIComponent(id)}`,
      role,
      roleResponseSchema,
    )
  ).role;
}

export async function previewRole(
  id: string,
  permissions: readonly Permission[],
) {
  return (
    await sendJsonFor(
      "POST",
      `/api/roles/${encodeURIComponent(id)}/effects`,
      { permissions },
      roleEffectsSchema,
    )
  ).effects;
}

// Every page some permissions could open, for saying which ones a role leaves out.
const everyPage = pagesOpened(
  permissionGrid.flatMap(({ actions }) => Object.values(actions)),
);

export interface Consequences {
  // The pages its holders see, each followed by the views on it needing classified data they get.
  sees: string[];
  // The pages they do not see, and each view they miss on the pages they do, with the classes it
  // needs, in the order of the pages.
  doesNotSee: string[];
  can: string[];
  cannot: string[];
}

// What a role granting these permissions lets its holders do, and not do, in plain English, in the
// order of the grid that sets them, with the organization's data in the classes it keeps it in.
export function consequences(
  granted: readonly Permission[],
  dataClasses: DataClasses,
): Consequences {
  const held = withImplied(granted);
  const pages = pagesOpened(held);
  const can: string[] = [];
  const cannot: string[] = [];
  for (const { actions } of permissionGrid) {
    const permissions = Object.values(actions);
    const missing = permissions.filter(
      (permission) => !held.includes(permission),
    );
    for (const permission of permissions) {
      // The permission is always one of the shared list.
      // eslint-disable-next-line security/detect-object-injection
      const { allows, without } = permissionDescriptions[permission];
      if (held.includes(permission)) can.push(allows);
      // An area the role reaches not at all needs saying only once.
      else if (
        missing.length < permissions.length ||
        permission === missing[0]
      ) {
        cannot.push(without);
      }
    }
  }
  const views = viewsOfRole({ permissions: held, dataClasses }, pages);
  // A page missed whole opens only to its line saying why, so it is not among what the role sees.
  const missedWhole = views.flatMap(({ name, page, why }) =>
    why !== undefined && name === page ? [page] : [],
  );
  return {
    sees: pages
      .filter((page) => !missedWhole.includes(page))
      .flatMap((page) => [
        page,
        ...views.flatMap((view) =>
          view.page === page && view.name !== page && view.why === undefined
            ? [view.name]
            : [],
        ),
      ]),
    doesNotSee: everyPage.flatMap((page) =>
      pages.includes(page)
        ? views.flatMap((view) =>
            view.page === page && view.why !== undefined ? [view.why] : [],
          )
        : [page],
    ),
    can,
    cannot,
  };
}

// Whether a permission does anything with those held: it needs none, or holds any of those it
// needs.
export function needsMet(
  permission: Permission,
  held: readonly Permission[],
): boolean {
  // The permission is always one of the shared list.
  // eslint-disable-next-line security/detect-object-injection
  const { needs = [] } = permissionDescriptions[permission];
  return needs.length === 0 || needs.some((one) => held.includes(one));
}

// The permissions granted, less each that does nothing without others no longer granted, and any
// that needed those in turn, apart from those to keep whatever they need.
export function withNeedsMet(
  granted: readonly Permission[],
  keep: readonly Permission[] = [],
): Permission[] {
  let kept = [...granted];
  let before: number;
  do {
    before = kept.length;
    const held = withImplied(kept);
    kept = kept.filter(
      (permission) => keep.includes(permission) || needsMet(permission, held),
    );
  } while (kept.length < before);
  return kept;
}

export interface Line {
  text: string;
  change: "added" | "removed" | undefined;
}

// A list as it is now, marked against the list it was first: lines added since are marked
// as added, and lines taken away since stay, struck through, after the line they followed.
export function markedLines(
  first: readonly string[],
  items: readonly string[],
): Line[] {
  const lines: Line[] = items.map((text) => ({
    text,
    change: first.includes(text) ? undefined : "added",
  }));
  let after: string | undefined;
  for (const text of first) {
    if (!items.includes(text)) {
      const at =
        after === undefined
          ? 0
          : lines.findIndex((line) => line.text === after) + 1;
      lines.splice(at, 0, { text, change: "removed" });
    }
    after = text;
  }
  return lines;
}

export interface Difference {
  gains: string[];
  losses: string[];
}

// What an account gains and loses when what it may do changes, in plain English: pages first, then
// what it may do with data.
export function difference(
  before: readonly Permission[],
  after: readonly Permission[],
): Difference {
  const pagesBefore = pagesOpened(before);
  const pagesAfter = pagesOpened(after);
  const gains = [
    ...pagesAfter
      .filter((page) => !pagesBefore.includes(page))
      .map((page) => `Sees the ${page} page.`),
    ...after
      .filter((permission) => !before.includes(permission))
      // The permission is always one of the shared list.
      // eslint-disable-next-line security/detect-object-injection
      .map((permission) => permissionDescriptions[permission].allows),
  ];
  const losses = [
    ...pagesBefore
      .filter((page) => !pagesAfter.includes(page))
      .map((page) => `The ${page} page no longer appears.`),
    ...before
      .filter((permission) => !after.includes(permission))
      // The permission is always one of the shared list.
      // eslint-disable-next-line security/detect-object-injection
      .map((permission) => permissionDescriptions[permission].without),
  ];
  return { gains, losses };
}

export const actionHeadings = {
  view: "View",
  approve: "Approve",
  edit: "Edit",
} as const;
