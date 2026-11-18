// SPDX-License-Identifier: Apache-2.0

// Where a draft's record is shown, and its key.

import {
  capacityModeNeeds,
  type LinkedRecord,
  type PageNeeds,
  pageNeeds,
  type RecordKeyOf,
  type RecordPage,
  recordPage,
} from "@fathom/shared";
import type { LinkOptions } from "@tanstack/react-router";

export type DraftPlace = LinkedRecord | "capacity-settings";

// The key of a draft's record, or none for the planning settings, which have no key.
export const placeKey = (place: DraftPlace): RecordKeyOf | undefined =>
  place === "capacity-settings"
    ? undefined
    : { kind: place.kind, keyNumber: place.keyNumber };

// What each page a record opens on is called in a link to it, as People's Show on org chart calls
// the Org chart.
const pageNames: Record<RecordPage | "capacity", string> = {
  people: "People",
  lists: "Lists",
  releases: "Releases",
  features: "Features",
  projects: "Projects",
  "org-chart": "org chart",
  capacity: "Capacity",
  accounts: "Accounts",
  roles: "Roles",
};

export interface ShownPlace {
  pageName: string;
  needs: PageNeeds;
  address: LinkOptions;
}

const settingsPlace: ShownPlace = {
  pageName: pageNames.capacity,
  needs: [capacityModeNeeds.settings],
  address: { to: "/capacity", search: { mode: "settings" } },
};

export function shownPlace(place: DraftPlace): ShownPlace {
  if (place === "capacity-settings") return settingsPlace;
  const page = recordPage(place);
  return {
    // The page is always one of the fixed pages.
    // eslint-disable-next-line security/detect-object-injection
    pageName: pageNames[page],
    // eslint-disable-next-line security/detect-object-injection
    needs: pageNeeds[page],
    address: {
      to: "/go/$kind/$keyNumber",
      params: { kind: place.kind, keyNumber: String(place.keyNumber) },
    },
  };
}
