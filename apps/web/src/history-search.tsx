// SPDX-License-Identifier: Apache-2.0

// The search field above a history page, kept in the page address like a table's, so Back undoes a
// search. Esc, once the field is empty, leaves it. A spinner beside it shows a search being read.

import { Group, Loader } from "@mantine/core";
import { TableSearch } from "./table-controls.tsx";

export function HistorySearch({
  label,
  search,
  onSearch,
  busy = false,
}: {
  label: string;
  search: string;
  onSearch: (search: string, replace: boolean) => void;
  // While a search is being read, a small spinner beside the field says so.
  busy?: boolean;
}) {
  return (
    <Group>
      <TableSearch
        label={label}
        value={search}
        onChange={onSearch}
        onLeave={() => {
          (document.activeElement as HTMLElement | null)?.blur();
        }}
      />
      {busy && <Loader size="xs" role="status" aria-label="Searching" />}
    </Group>
  );
}
