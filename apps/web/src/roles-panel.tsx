// SPDX-License-Identifier: Apache-2.0

// A role's details beside the Roles table, read only: its key, the table's columns, the active
// accounts holding it, and the grid of what it grants.

import type { Account } from "@fathom/shared";
import { Loader, Text } from "@mantine/core";
import type { Column } from "./record-table.ts";
import { ColumnRows, RecordPanel, RecordSection } from "./record-details.tsx";
import { RecordKey } from "./record-key.tsx";
import { PermissionGrid } from "./roles-permission-grid.tsx";
import type { RoleRow } from "./roles-table.tsx";
import { ShortList } from "./short-list.tsx";

export const rolePanelId = "role-panel";

const noChange = () => undefined;

// The accounts holding the role, each opening its details on Accounts, once they are read.
function HeldBy({
  holders,
  onShowAccount,
}: {
  holders: readonly Account[] | "loading" | "failed";
  onShowAccount: (id: string) => void;
}) {
  if (holders === "loading") {
    return <Loader size="sm" role="status" aria-label="Loading" />;
  }
  if (holders === "failed") {
    return <Text c="dimmed">Fathom could not load the accounts.</Text>;
  }
  return (
    <ShortList
      items={holders}
      noun="accounts"
      onShow={onShowAccount}
      actions={[]}
    />
  );
}

export function RolePanel({
  row,
  columns,
  holders,
  narrow,
  onShowAccount,
  onClose,
}: {
  row: RoleRow;
  columns: readonly Column<RoleRow, never>[];
  holders: readonly Account[] | "loading" | "failed";
  narrow: boolean;
  onShowAccount: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <RecordPanel
      id={rolePanelId}
      titleId="role-panel-title"
      recordId={row.id}
      title={row.name}
      subtitle={
        <RecordKey record={{ kind: "role", keyNumber: row.role.keyNumber }} />
      }
      narrow={narrow}
      onClose={onClose}
    >
      <RecordSection id="role-details" title="Details">
        <ColumnRows
          columns={columns}
          shown={row}
          draft={undefined}
          live={row}
          changeOf={noChange}
        />
      </RecordSection>
      <RecordSection
        id="role-holders"
        title="Held by"
        body={<HeldBy holders={holders} onShowAccount={onShowAccount} />}
      />
      <RecordSection
        id="role-grants"
        title="Grants"
        body={
          <PermissionGrid granted={row.role.permissions} disabled={false} />
        }
      />
    </RecordPanel>
  );
}
