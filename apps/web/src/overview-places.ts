// SPDX-License-Identifier: Apache-2.0

// The places the Overview's jobs lead to: the sidebar's pages, and the parts of some that need no
// record, each with the link that opens it, for a role that opens it.

import {
  type CapacityMode,
  capacityModeNeeds,
  type ClassAccess,
  opensWith,
} from "@fathom/shared";
import { linkOptions, type LinkOptions } from "@tanstack/react-router";
import { type Item, opens, sections } from "./navigation.ts";
import type { PlaceName } from "./overview-jobs.ts";
import { holdsNeed } from "./role-jobs.ts";

// A sidebar page, or a part of it, and the link that opens it.
export interface PagePart {
  item: Item;
  link: LinkOptions;
  part?: string;
}

// Whether a role opens one of Capacity's tabs, by the needs Capacity opens it by.
const opensMode = (mode: CapacityMode) => (access: ClassAccess) =>
  // The mode is always one of Capacity's fixed tabs.
  // eslint-disable-next-line security/detect-object-injection
  opensWith([capacityModeNeeds[mode]], access);

// Each part, by its page and its name, with the link that opens it and what it needs beyond its
// page, where it needs anything.
const parts = new Map<
  string,
  { link: LinkOptions; opens?: (access: ClassAccess) => boolean }
>([
  [
    "Drafts|To decide",
    {
      link: linkOptions({ to: "/drafts", search: { tab: "decide" } }),
      opens: (access) => holdsNeed(access, "approve:any"),
    },
  ],
  [
    "Capacity|Feature teams",
    {
      link: linkOptions({ to: "/capacity", search: { mode: "feature-teams" } }),
      opens: opensMode("feature-teams"),
    },
  ],
  [
    "Capacity|Allocations",
    {
      link: linkOptions({ to: "/capacity", search: { mode: "allocations" } }),
      opens: opensMode("allocations"),
    },
  ],
  [
    "Capacity|Settings",
    {
      link: linkOptions({ to: "/capacity", search: { mode: "settings" } }),
      opens: opensMode("settings"),
    },
  ],
  [
    "Org chart|Feature teams",
    {
      link: linkOptions({ to: "/org-chart", search: { teams: "feature" } }),
      opens: (access) => holdsNeed(access, "feature-teams:view"),
    },
  ],
  [
    "Releases|Schedules",
    {
      link: linkOptions({
        to: "/releases/{-$streamId}",
        search: { tab: "schedules" },
      }),
    },
  ],
  [
    "People|Metrics",
    { link: linkOptions({ to: "/people", search: { breakdown: [] } }) },
  ],
]);

const items = new Map(
  sections
    .flatMap(({ items: listed }) =>
      listed.flatMap((item) => (item.to === undefined ? [] : [item])),
    )
    .map((item) => [item.label, item]),
);

// Where a job or task is done, for a role that opens it: its page, or the part of it, and the link
// that leads there.
export const overviewPlace =
  (access: ClassAccess) =>
  ({ page, part }: PlaceName): PagePart | undefined => {
    const item = items.get(page);
    if (item?.to === undefined || !opens(item, access)) return undefined;
    if (part === undefined) return { item, link: linkOptions({ to: item.to }) };
    const found = parts.get(`${page}|${part}`);
    return found === undefined || found.opens?.(access) === false
      ? undefined
      : { item, link: found.link, part };
  };
