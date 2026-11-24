// SPDX-License-Identifier: Apache-2.0

// The columns that offer each list's choices: the built-in column of each list Fathom builds in, and
// the columns added to a table, each named by its page.

import { builtInColumnNames } from "./changes.ts";
import type { BuiltInList, ListUse } from "./lists.ts";
import { type ColumnTable, columnTablePolicies } from "./people.ts";
import { planColumnNames } from "./projects.ts";

const { people, features } = columnTablePolicies;

const onPeople = (key: string): ListUse => ({
  page: people.name,
  column: String(builtInColumnNames.get(key)),
});

const onFeatures = (column: string): ListUse => ({
  page: features.name,
  column,
});

const proposalsPage = "Proposals";

export const builtInListUses: Readonly<Record<BuiltInList, ListUse>> = {
  positions: onPeople("positionId"),
  "hiring-states": onPeople("stateId"),
  "proposal-statuses": {
    page: proposalsPage,
    column: planColumnNames.statusId,
  },
  "feature-statuses": onFeatures(planColumnNames.statusId),
  "feature-priorities": onFeatures(planColumnNames.priorityId),
  "feature-sizes": onFeatures(planColumnNames.sizeId),
  "feature-risks": onFeatures(planColumnNames.riskId),
};

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

// The columns that use a list, by page then column: a built-in list's own column, and any added to
// a table that draw on it.
export function listUses(
  builtIn: BuiltInList | null | undefined,
  added: readonly { table: ColumnTable; name: string }[],
): ListUse[] {
  return [
    ...(builtIn === null || builtIn === undefined
      ? []
      : // The key is always one of the built-in lists named above.
        // eslint-disable-next-line security/detect-object-injection
        [builtInListUses[builtIn]]),
    ...added.map(({ table, name }) => ({
      // The table is always one of those that take added columns.
      // eslint-disable-next-line security/detect-object-injection
      page: columnTablePolicies[table].name,
      column: name,
    })),
  ].sort(
    (a, b) =>
      byName.compare(a.page, b.page) || byName.compare(a.column, b.column),
  );
}
