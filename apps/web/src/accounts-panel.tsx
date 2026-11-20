// SPDX-License-Identifier: Apache-2.0

// An account's details beside the Accounts table, as every record's are: its name, with This
// account after the reader's own, its email address, its roles, the default first, whether it is
// active, and the day it was made, and, for those who may manage accounts, what can be done to it,
// each in its dialog: editing it, resetting its password, but not one's own, and deactivating or
// reactivating it.

import { Button, Group, Stack, Text } from "@mantine/core";
import { useEffect } from "react";
import { type AccountRow, rolesText } from "./accounts-table.tsx";
import { focusSoon } from "./focus.ts";
import type { Column } from "./record-table.ts";
import { RecordSection, Row } from "./record-details.tsx";
import { RecordKey } from "./record-key.tsx";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import { FactBox } from "./status-mark.tsx";

export const accountPanelId = "account-panel";
const titleId = "account-panel-title";

export interface AccountActions {
  edit: () => void;
  resetPassword: () => void;
  // Deactivates or reactivates the account; undefined while deactivating it would leave no active
  // account able to manage accounts, which the server refuses.
  changeActive: (() => void) | undefined;
}

export function AccountPanel({
  row,
  columns,
  own,
  actions,
  narrow,
  onClose,
}: {
  row: AccountRow;
  columns: readonly Column<AccountRow, never>[];
  own: boolean;
  // What can be done to the account, for those who may manage accounts.
  actions: AccountActions | undefined;
  narrow: boolean;
  onClose: () => void;
}) {
  const { account } = row;
  // Opening an account puts focus on its name in the panel.
  useEffect(() => {
    focusSoon(titleId);
  }, [account.id]);
  return (
    <SidePanelFrame
      id={accountPanelId}
      titleId={titleId}
      title={
        <span>
          {account.name}
          {own && (
            <>
              {" "}
              <FactBox>This account</FactBox>
            </>
          )}
        </span>
      }
      subtitle={
        <RecordKey record={{ kind: "account", keyNumber: account.keyNumber }} />
      }
      narrow={narrow}
      close={{ label: "Close details", onClose }}
    >
      <div className={sidePanelScroll}>
        <Stack gap="lg">
          <RecordSection id="account-details" title="Details">
            {columns.map((column) => (
              <Row key={column.key} column={column} value={column.value(row)}>
                {column.key === "roles" && account.roles.length > 0 ? (
                  <Text>{rolesText(account)}</Text>
                ) : undefined}
              </Row>
            ))}
          </RecordSection>
          {actions !== undefined && (
            <Group gap="xs">
              <Button variant="default" onClick={actions.edit}>
                Edit…
              </Button>
              {!own && (
                <Button variant="default" onClick={actions.resetPassword}>
                  Reset password…
                </Button>
              )}
              <Button
                {...(account.active
                  ? { variant: "outline", color: "red" }
                  : { variant: "default" })}
                disabled={actions.changeActive === undefined}
                onClick={() => {
                  actions.changeActive?.();
                }}
              >
                {account.active ? "Deactivate…" : "Reactivate…"}
              </Button>
            </Group>
          )}
        </Stack>
      </div>
    </SidePanelFrame>
  );
}
