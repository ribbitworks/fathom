// SPDX-License-Identifier: Apache-2.0

// What differs between the tables that keep saved views: who opens the table's page, and so sees
// and saves its views; who shares them; the classes of its columns; and the groupings that need data
// of a class beyond their column. Every table must be described, which the compiler checks.

import type { Database } from "@fathom/db";
import {
  capacityModeNeeds,
  type ClassifiedView,
  type PageNeeds,
  pageNeeds,
  type Permission,
  type ViewTable,
} from "@fathom/shared";
import { type ClassedColumn, columnClasses, readColumns } from "./values.ts";

type Reader = Pick<Database, "select">;

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
  sharesWith: Permission;
  columns(reader: Reader): Promise<ViewColumns>;
  // Groupings whose headings show data of a class beyond their column, with how they are named.
  groupingNeeds?: ReadonlyMap<string, { view: ClassifiedView; name: string }>;
}

const allGeneral = () =>
  Promise.resolve<ViewColumns>({ classed: new Map(), open: true });

const byManager = new Map([
  ["manager", { view: "groupingByManager" as const, name: "Manager" }],
]);

const plan = (opens: PageNeeds): ViewTableRules => ({
  opens,
  sharesWith: "configuration:edit",
  columns: allGeneral,
});

export const viewTables: Record<ViewTable, ViewTableRules> = {
  people: {
    opens: pageNeeds.people,
    sharesWith: "configuration:edit",
    columns: async (reader) => ({
      classed: columnClasses(await readColumns(reader)),
      open: false,
    }),
  },
  features: plan(pageNeeds.features),
  projects: plan(pageNeeds.projects),
  proposals: plan(pageNeeds.projects),
  customers: plan(pageNeeds.projects),
  milestones: plan(pageNeeds.projects),
  "release-streams": plan(pageNeeds.releases),
  lists: plan(pageNeeds.lists),
  "feature-assignments": {
    ...plan(pageNeeds["feature-assignments"]),
    groupingNeeds: byManager,
  },
  // Capacity's People, since its Settings keep no view.
  capacity: { ...plan([capacityModeNeeds.people]), groupingNeeds: byManager },
  "org-chart": plan(pageNeeds["org-chart"]),
  // Nobody who opens Accounts may change planning configuration.
  accounts: {
    opens: pageNeeds.accounts,
    sharesWith: "administration:edit",
    columns: allGeneral,
  },
};
