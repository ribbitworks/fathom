// SPDX-License-Identifier: Apache-2.0

// Roles through the server's API, and what a role's permissions mean in plain English: what its
// holders can and cannot do, which pages they see, any permission that does nothing without another,
// and, for a change to a role, what each account holding it gains and loses.

import {
  type Permission,
  permissionDescriptions,
  permissionGrid,
  permissionLabel,
  roleEffectsSchema,
  roleListSchema,
  type RoleChange,
  type RoleRequest,
  roleResponseSchema,
  type RoleSummary,
  unbuiltPermissions,
  withImplied,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { getJson, sendJsonFor } from "./api.ts";
import { pagesNotBuilt, pagesOpened } from "./layout.tsx";

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

// Every line the summary or the confirmation can show about something Fathom does not have yet: a
// page, or a permission that does nothing until its feature is built.
const linesNotBuilt = new Set([
  ...pagesNotBuilt.flatMap((page) => [
    page,
    `The ${page} page does not appear.`,
    `Sees the ${page} page.`,
    `The ${page} page no longer appears.`,
  ]),
  ...unbuiltPermissions.flatMap((permission) => {
    // The permission is always one of the shared list.
    // eslint-disable-next-line security/detect-object-injection
    const { allows, without } = permissionDescriptions[permission];
    return [allows, without];
  }),
]);

// Whether a line of the summary or the confirmation is about something Fathom does not have yet.
export const notBuiltYet = (line: string): boolean => linesNotBuilt.has(line);

export interface Consequences {
  pages: string[];
  can: string[];
  cannot: string[];
  // Permissions granted that do nothing without another the role does not grant.
  ineffective: string[];
}

// What a role granting these permissions lets its holders do, and not do, in plain English, in the
// order of the grid that sets them.
export function consequences(granted: readonly Permission[]): Consequences {
  const held = withImplied(granted);
  const pages = pagesOpened(held);
  const can: string[] = [];
  const cannot: string[] = everyPage
    .filter((page) => !pages.includes(page))
    .map((page) => `The ${page} page does not appear.`);
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
  const ineffective = held.flatMap((permission) => {
    // The permission is always one of the shared list.
    // eslint-disable-next-line security/detect-object-injection
    const { needs } = permissionDescriptions[permission];
    return needs === undefined || held.includes(needs)
      ? []
      : [
          `${permissionLabel(permission)} does nothing without ${permissionLabel(needs)}.`,
        ];
  });
  return { pages, can, cannot, ineffective };
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
