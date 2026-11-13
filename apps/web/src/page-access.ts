// SPDX-License-Identifier: Apache-2.0

// What opens a page: any one of some permissions, each with the other permissions and the classified
// view it needs where the page shows nothing without them, so a page a role would find empty or
// unable to load is left out rather than shown cut down.

import {
  type ClassAccess,
  type ClassifiedView,
  type Permission,
  seesView,
} from "@fathom/shared";

export interface PageNeed {
  permission: Permission;
  // Other permissions the page reads with it, such as those of data it draws on.
  with?: readonly Permission[];
  view?: ClassifiedView;
}

export type PageNeeds = Permission | readonly (Permission | PageNeed)[];

const needsOf = (needs: PageNeeds): PageNeed[] =>
  (typeof needs === "string" ? [needs] : needs).map((need) =>
    typeof need === "string" ? { permission: need } : need,
  );

// Whether a role holds a permission that would open the page, whatever data it sees.
export const reaches = (needs: PageNeeds, permissions: readonly Permission[]) =>
  needsOf(needs).some(({ permission }) => permissions.includes(permission));

// Whether a role opens the page: it holds one of the permissions with the others that one needs, and
// sees the data it needs.
export const opensWith = (needs: PageNeeds, access: ClassAccess) =>
  needsOf(needs).some(
    ({ permission, with: others = [], view }) =>
      [permission, ...others].every((one) =>
        access.permissions.includes(one),
      ) &&
      (view === undefined || seesView(view, access)),
  );
