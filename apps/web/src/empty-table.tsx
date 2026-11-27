// SPDX-License-Identifier: Apache-2.0

// The line a table shows while it shows no rows, and its words.

import { Table, Text } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./pages.module.css";
import type { ViewChoice } from "./table-controls.tsx";
import { narrowsWith, type View } from "./table-view.ts";

// Whether the view leaves out any of the table's records: by its search, its filters, the page's
// own filter, or a choice of which records show, such as shipped releases while Show shipped is off.
export const leavesOutRecords = (
  view: View,
  pageFilter: object | undefined,
  choices: readonly Pick<ViewChoice, "leavesOut">[] = [],
): boolean =>
  narrowsWith(view, pageFilter) || choices.some(({ leavesOut }) => leavesOut);

// "No" and the table's noun, with "yet" unless the table has its own words, or none matching while
// the view leaves records out.
export const emptyTableWords = (
  table: { noun: string; none?: string | undefined },
  leavesOut: boolean,
): string =>
  leavesOut
    ? `No matching ${table.noun}`
    : (table.none ?? `No ${table.noun} yet`);

export function EmptyTableRow({
  span,
  table,
  leavesOut,
  below,
}: {
  // How many columns the line spans: every one the table has.
  span: number;
  table: Parameters<typeof emptyTableWords>[0];
  leavesOut: boolean;
  // Under the words while none are left out, such as a link to where the first record is made.
  below?: ReactNode;
}) {
  return (
    <Table.Tr>
      <Table.Td colSpan={span} className={classes.recordNone}>
        <div className={classes.recordNoneWords}>
          <Text component="span" fz="sm" c="dimmed">
            {emptyTableWords(table, leavesOut)}
          </Text>
          {!leavesOut && below}
        </div>
      </Table.Td>
    </Table.Tr>
  );
}
