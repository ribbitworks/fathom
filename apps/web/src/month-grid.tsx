// SPDX-License-Identifier: Apache-2.0

// The monthly grid of people by month, as Feature assignments' teams and Capacity's allocations show
// it, once what it reads has loaded, or what it shows until then.

import { monthOf } from "@fathom/shared";
import { Center, Loader } from "@mantine/core";
import type { UseQueryResult } from "@tanstack/react-query";
import type { CellChange } from "./cell-kinds.tsx";
import { LoadProblem } from "./load-problem.tsx";
import {
  type RecordActions,
  RecordGrid,
  type RecordTable,
} from "./record-grid.tsx";
import type { View } from "./table-view.ts";
import { TableTips } from "./table-tips.tsx";
import type { MonthRow } from "./team-months.tsx";

// What a page gives the grid it shows.
export interface MonthGridProps {
  byManager: boolean;
  now: string;
  view: View;
  onView: (view: View, replace?: boolean) => void;
}

export function MonthGrid<Rec extends MonthRow>({
  what,
  reads,
  table,
  records,
  actions,
  canEdit,
  now,
  view,
  onView,
}: {
  // What could not be loaded, such as "the allocations".
  what: string;
  reads: readonly Pick<UseQueryResult, "isError" | "refetch">[];
  table: RecordTable<Rec, CellChange, CellChange> | undefined;
  records: Rec[];
  actions: RecordActions<Rec, CellChange, CellChange>;
  canEdit: boolean;
  now: string;
  view: View;
  onView: (view: View, replace?: boolean) => void;
}) {
  if (reads.some(({ isError }) => isError)) {
    return (
      <LoadProblem
        what={what}
        onRetry={() => {
          for (const read of reads) {
            if (read.isError) void read.refetch();
          }
        }}
      />
    );
  }
  if (table === undefined) {
    return (
      <Center p="xl">
        <Loader aria-label="Loading" />
      </Center>
    );
  }
  return (
    <TableTips>
      <RecordGrid
        records={records}
        table={table}
        fields={[]}
        order={[]}
        lists={[]}
        canEdit={canEdit}
        canAdd={false}
        rowActions={false}
        canEditColumns={false}
        actions={actions}
        view={view}
        onView={onView}
        opensAtColumn={monthOf(now)}
        withDrafts
      />
    </TableTips>
  );
}
