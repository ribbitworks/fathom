// SPDX-License-Identifier: Apache-2.0

// The grid of boxes setting what a role grants: its areas and classes of data with their actions,
// and the permissions of their own.

import {
  classNames,
  gridActions,
  type GridRow,
  impliedPermissions,
  eitherOf,
  type Permission,
  permissionDescriptions,
  permissionGrid,
  permissionLabel,
  withImplied,
} from "@fathom/shared";
import { Checkbox, Stack, Table } from "@mantine/core";
import { actionHeadings, needsMet } from "./roles.ts";

// The permission granted with another, such as viewing with editing, if a granted one brings it.
function impliedBy(
  permission: Permission,
  granted: readonly Permission[],
): Permission | undefined {
  return granted.find(
    // The permission is always one of the shared list.
    // eslint-disable-next-line security/detect-object-injection
    (other) => impliedPermissions[other] === permission,
  );
}

// One permission's box: ticked when granted, or ticked and greyed when another granted one brings
// it, such as viewing with editing, or when it must stay. It is turned off while it would do
// nothing without others not granted.
function PermissionBox({
  permission,
  granted,
  locked,
  disabled,
  onChange,
  label,
  description,
}: {
  permission: Permission;
  granted: readonly Permission[];
  locked: readonly Permission[];
  disabled: boolean;
  onChange: ((granted: Permission[]) => void) | undefined;
  label?: string;
  description?: string;
}) {
  const comesWith = impliedBy(permission, granted);
  const name = permissionLabel(permission);
  const kept = locked.includes(permission);
  const checked = granted.includes(permission) || comesWith !== undefined;
  // A box already ticked stays free to untick, even on a role saved before its needs were kept to.
  const waiting =
    onChange !== undefined &&
    !checked &&
    !needsMet(permission, withImplied(granted));
  // The permission is always one of the shared list.
  // eslint-disable-next-line security/detect-object-injection
  const { needs = [] } = permissionDescriptions[permission];
  return (
    <Checkbox
      display={label === undefined ? "inline-block" : undefined}
      label={label}
      description={description}
      aria-label={
        label !== undefined
          ? undefined
          : comesWith !== undefined
            ? `${name}, which comes with ${permissionLabel(comesWith)}`
            : kept
              ? `${name}, which some active account must keep`
              : waiting
                ? `${name}, which needs ${eitherOf(needs.map(permissionLabel))}`
                : name
      }
      checked={checked}
      disabled={disabled || comesWith !== undefined || kept || waiting}
      readOnly={onChange === undefined}
      onChange={
        onChange &&
        ((event) => {
          const on = event.currentTarget.checked;
          onChange(
            on
              ? [...granted, permission]
              : granted.filter((other) => other !== permission),
          );
        })
      }
    />
  );
}

type BoxProps = Omit<Parameters<typeof PermissionBox>[0], "permission">;

// What a role grants, in two parts: a grid of the areas it reaches, with View, Approve and Edit,
// followed by the classes of data it sees and changes within them, with View and Edit; and the
// permissions of their own. General data comes with each area. Read only without a way to change
// it.
export function PermissionGrid({
  granted,
  locked = [],
  disabled,
  onChange,
}: {
  granted: readonly Permission[];
  locked?: readonly Permission[];
  disabled: boolean;
  onChange?: (granted: Permission[]) => void;
}) {
  const box: BoxProps = { granted, locked, disabled, onChange };
  const cells = (actions: GridRow["actions"]) =>
    gridActions.map((action) => {
      // The action is always one of the fixed list.
      // eslint-disable-next-line security/detect-object-injection
      const permission = actions[action];
      return permission === undefined ? (
        <Table.Td key={action} />
      ) : (
        <Table.Td key={action} ta="center">
          <PermissionBox permission={permission} {...box} />
        </Table.Td>
      );
    });
  return (
    <Stack gap="sm" role="group" aria-label="What the role grants">
      <Table withTableBorder verticalSpacing={4}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Area</Table.Th>
            {gridActions.map((action) => (
              <Table.Th key={action} ta="center">
                {
                  // The action is always one of the fixed list.
                  // eslint-disable-next-line security/detect-object-injection
                  actionHeadings[action]
                }
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {permissionGrid
            .filter(({ kind }) => kind === "area")
            .map(({ area, actions }) => (
              <Table.Tr key={area}>
                <Table.Td>{area}</Table.Td>
                {cells(actions)}
              </Table.Tr>
            ))}
          <Table.Tr>
            <Table.Th colSpan={gridActions.length + 1} scope="colgroup">
              Data classification
            </Table.Th>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>{classNames.general}</Table.Td>
            {gridActions.map((action) => (
              <Table.Td key={action} ta="center">
                {action !== "approve" && (
                  <Checkbox
                    display="inline-block"
                    // The action is always one of the fixed list.
                    // eslint-disable-next-line security/detect-object-injection
                    aria-label={`${actionHeadings[action]} ${classNames.general}, which comes with each area`}
                    checked
                    disabled
                    readOnly
                  />
                )}
              </Table.Td>
            ))}
          </Table.Tr>
          {permissionGrid.flatMap((row) =>
            row.kind === "class"
              ? [
                  <Table.Tr key={row.area}>
                    <Table.Td>{classNames[row.dataClass]}</Table.Td>
                    {cells(row.actions)}
                  </Table.Tr>,
                ]
              : [],
          )}
        </Table.Tbody>
      </Table>
      {permissionGrid
        .filter(({ kind }) => kind === "single")
        .flatMap(({ actions }) => Object.values(actions))
        .map((permission) => (
          <PermissionBox
            key={permission}
            permission={permission}
            label={permissionLabel(permission)}
            description={
              // The permission is always one of the shared list.
              // eslint-disable-next-line security/detect-object-injection
              permissionDescriptions[permission].allows
            }
            {...box}
          />
        ))}
    </Stack>
  );
}
