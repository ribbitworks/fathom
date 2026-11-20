// SPDX-License-Identifier: Apache-2.0

// What differs between the tables that keep saved views: who opens the table's page, and so sees
// and saves its views; the classes of its columns; and the groupings that need data
// of a class beyond their column. Every table must be described, which the compiler checks.

import type { Reader } from "@fathom/db";
import {
  capacityModeNeeds,
  type ClassifiedView,
  type PageNeeds,
  pageNeeds,
  type ViewTable,
} from "@fathom/shared";
import { type ClassedColumn, columnClasses, readColumns } from "./values.ts";

// A table's columns as its views are checked against: those of each class, by key, and whether a
// key not among them is a General column of the table's own, as on tables whose columns are all
// General, which their pages check. A table any of whose columns may be given a class beyond
// General lists every column instead, so a view on one is checked.
export interface ViewColumns {
  classed: ReadonlyMap<string, ClassedColumn>;
  open: boolean;
}

export interface ViewTableRules {
  opens: PageNeeds;
  columns(reader: Reader): Promise<ViewColumns>;
  // Groupings whose headings show data of a class beyond their column, with how they are named.
  groupingNeeds?: ReadonlyMap<string, { view: ClassifiedView; name: string }>;
}

const allGeneral = () =>
  Promise.resolve<ViewColumns>({ classed: new Map(), open: true });

const byManager = new Map([
  ["manager", { view: "groupingByManager" as const, name: "Manager" }],
]);

const generalTable = (opens: PageNeeds): ViewTableRules => ({
  opens,
  columns: allGeneral,
});

export const viewTables: Record<ViewTable, ViewTableRules> = {
  people: {
    opens: pageNeeds.people,
    columns: async (reader) => ({
      classed: columnClasses(await readColumns(reader)),
      open: false,
    }),
  },
  features: generalTable(pageNeeds.features),
  projects: generalTable(pageNeeds.projects),
  proposals: generalTable(pageNeeds.projects),
  customers: generalTable(pageNeeds.projects),
  milestones: generalTable(pageNeeds.projects),
  releases: generalTable(pageNeeds.releases),
  cycles: generalTable(pageNeeds.releases),
  "release-streams": generalTable(pageNeeds.releases),
  lists: generalTable(pageNeeds.lists),
  // Capacity's tabs, each a table of its own but Settings, which keeps no view.
  "feature-assignments": {
    ...generalTable([capacityModeNeeds["feature-teams"]]),
    groupingNeeds: byManager,
  },
  capacity: {
    ...generalTable([capacityModeNeeds.allocations]),
    groupingNeeds: byManager,
  },
  "org-chart": generalTable(pageNeeds["org-chart"]),
  accounts: generalTable(pageNeeds.accounts),
  drafts: generalTable(pageNeeds.drafts),
};
