// SPDX-License-Identifier: Apache-2.0

// Fathom's pages as the sidebar lists them, in its sections and order, by name and address.

import {
  type ClassAccess,
  type GuardedPage,
  opensWith,
  pageNeeds,
} from "@fathom/shared";
import { shownHelpPage } from "./help-pages.ts";
import type { IconName } from "./icons.tsx";

export type Page =
  | "/"
  | "/accounts"
  | "/roles"
  | "/settings"
  | "/data-classes"
  | "/history"
  | "/changes"
  | "/drafts"
  | "/lists/{-$listId}"
  | "/people"
  | "/org-chart"
  | "/releases/{-$streamId}"
  | "/capacity"
  | "/projects"
  | "/features"
  | "/activities"
  | "/help";

// A page, or a box opened over the current page instead of going to another.
export type Item = {
  label: string;
  icon: IconName;
  // The page whose needs decide who opens it; a page with none is open to everyone signed in.
  page?: GuardedPage;
  // Pages with addresses below their own, such as each list's, are marked as the current page for
  // all of them.
  nested?: boolean;
  // The name of what an address below the page shows, such as a Help page's title, which the top
  // bar adds after the page's, given the rest of the address.
  detailOf?: (below: string) => string | undefined;
} & ({ to: Page; box?: undefined } | { box: "about"; to?: undefined });

export const sections: { label: string; items: Item[] }[] = [
  {
    label: "Plan",
    items: [
      {
        label: "Overview",
        icon: "overview",
        to: "/",
      },
      {
        label: "Projects",
        icon: "projects",
        to: "/projects",
        page: "projects",
      },
      {
        label: "Features",
        icon: "features",
        to: "/features",
        page: "features",
      },
      {
        label: "Activities",
        icon: "activities",
        to: "/activities",
        page: "activities",
      },
      {
        label: "Releases",
        icon: "releases",
        to: "/releases/{-$streamId}",
        nested: true,
        page: "releases",
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "People",
        icon: "people",
        to: "/people",
        page: "people",
      },
      {
        label: "Org chart",
        icon: "orgChart",
        to: "/org-chart",
        page: "org-chart",
      },
      {
        label: "Capacity",
        icon: "capacity",
        to: "/capacity",
        page: "capacity",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Accounts",
        icon: "accounts",
        to: "/accounts",
        page: "accounts",
      },
      {
        label: "Roles",
        icon: "roles",
        to: "/roles",
        page: "roles",
      },
      {
        label: "Settings",
        icon: "settings",
        to: "/settings",
        page: "settings",
      },
      {
        label: "Lists",
        icon: "lists",
        to: "/lists/{-$listId}",
        page: "lists",
        nested: true,
      },
      {
        label: "Data classes",
        icon: "lock",
        to: "/data-classes",
        page: "data-classes",
      },
    ],
  },
  {
    label: "History",
    items: [
      {
        label: "Drafts",
        icon: "drafts",
        to: "/drafts",
        page: "drafts",
      },
      {
        label: "Change history",
        icon: "changes",
        to: "/changes",
        page: "changes",
      },
      {
        label: "Access history",
        icon: "history",
        to: "/history",
        page: "history",
      },
    ],
  },
  {
    label: "Help",
    items: [
      {
        label: "Help pages",
        icon: "helpPages",
        to: "/help",
        nested: true,
        detailOf: (name) => shownHelpPage(name)?.title,
      },
      { label: "About Fathom", icon: "aboutHelp", box: "about" },
    ],
  },
];

// Whether the user's access opens an item's page.
export function opens(item: Item, access: ClassAccess): boolean {
  return item.page === undefined || opensWith(pageNeeds[item.page], access);
}
