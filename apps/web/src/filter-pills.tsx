// SPDX-License-Identifier: Apache-2.0

// The pills above a table naming the filters in use, and a filter of a page's own, kept outside its
// columns.

import { Pill } from "@mantine/core";
import type { ReactNode } from "react";
import type { View } from "./table-view.ts";

// A filter of the page's own, outside the table's columns and kept among its view's choices, such
// as Features' customer: the records it keeps, which the columns' filters narrow further, the words
// of its pill, and the view without it, which the pill's × shows.
export interface PageFilter<Rec> {
  words: string;
  keeps: (record: Rec) => boolean;
  off: (view: View) => View;
}

// A page filter as the bar above the table names it and takes it away.
export type ShownPageFilter = Pick<PageFilter<unknown>, "words" | "off">;

// A pill naming a filter in use, beside the others above the table, whose × takes the filter away.
export function FilterPill({
  removeLabel,
  onRemove,
  children,
}: {
  removeLabel: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <Pill
      size="md"
      withRemoveButton
      removeButtonProps={{
        // Mantine hides the button from the keyboard, but filters are removed from it too.
        "aria-hidden": false,
        tabIndex: 0,
        "aria-label": removeLabel,
      }}
      onRemove={onRemove}
    >
      {children}
    </Pill>
  );
}
