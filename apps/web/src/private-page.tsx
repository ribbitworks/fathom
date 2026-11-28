// SPDX-License-Identifier: Apache-2.0

// A page under Mine: its maker's private table.

import type { List, PrivatePage } from "@fathom/shared";
import { useMemo } from "react";
import { Loader, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { listsQuery, liveLists } from "./lists.ts";
import { LoadProblem } from "./load-problem.tsx";
import { PageHeader } from "./page-header.tsx";
import { PageMenu } from "./page-menu.tsx";
import classes from "./pages.module.css";
import { privatePageQuery } from "./private-pages.ts";
import { privateRowActions } from "./private-row-actions.ts";
import { privateFields, privateTable } from "./private-table.ts";
import { RecordGrid } from "./record-grid.tsx";
import { useRemovalQuestion } from "./removal-question.tsx";
import { useSaving } from "./saving.ts";
import { PrivateRing } from "./status-mark.tsx";
import { TableTips } from "./table-tips.tsx";
import type { View } from "./table-view.ts";
import type { ChangeView } from "./table-controls.tsx";

// The table, its columns as fields, and their order, from the page's columns and the lists.
const tableOf = (
  page: Pick<PrivatePage, "name" | "key" | "columns" | "firstFieldId">,
  lists: readonly List[],
) => ({
  table: privateTable({ page, lists }),
  fields: privateFields(page),
  order: page.columns.map(({ id }) => id),
  lists: [...lists],
  name: page.name,
  key: page.key,
});

export function PrivatePageScreen({
  pageId,
  view,
  onView,
}: {
  pageId: string;
  view: View;
  onView: ChangeView;
}) {
  const query = privatePageQuery(pageId);
  const page = useQuery(query);
  const lists = useQuery(listsQuery);
  // The page's name and columns, kept the same while the rows change, so the table is made again
  // only when they or the lists change, and a new row being typed in keeps its place.
  const head = useQuery({
    ...query,
    select: ({ name, key, columns, firstFieldId }) => ({
      name,
      key,
      columns,
      firstFieldId,
    }),
  });
  const shown = useMemo(
    () =>
      head.data === undefined || lists.data === undefined
        ? undefined
        : tableOf(head.data, liveLists(lists.data)),
    [head.data, lists.data],
  );
  const changes = useSaving<PrivatePage>({
    queryKey: query.queryKey,
    removed: "Something on this page was removed.",
    blocked: false,
  });
  const removal = useRemovalQuestion();
  const rows = page.data?.rows;
  if (rows === undefined || shown === undefined) {
    return lists.isError ? (
      <LoadProblem
        what="the page"
        onRetry={() => {
          void lists.refetch();
        }}
      />
    ) : (
      <Loader role="status" aria-label="Loading" />
    );
  }
  const { table, fields, order, lists: shownLists, name, key } = shown;
  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader
        title={name}
        mark={<PrivateRing spoken />}
        action={<PageMenu page={{ id: pageId, name, key }} />}
      />
      <TableTips>
        <RecordGrid
          records={rows}
          table={table}
          fields={fields}
          order={order}
          lists={shownLists}
          canEdit
          canEditColumns
          actions={privateRowActions({
            pageId,
            changes,
            nameOf: table.nameOf,
            ask: removal.ask,
          })}
          view={view}
          onView={onView}
          withDrafts={false}
        />
      </TableTips>
      {removal.dialog}
    </Stack>
  );
}
