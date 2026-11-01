// SPDX-License-Identifier: Apache-2.0

// Help's Roles page: what each role lets a user do, with the roles the signed-in user holds marked,
// and what each sensitivity of people's details covers. Reference rather than instruction, as
// Visual Design allows. Each role's description is the one shown wherever roles are chosen.

import { type Role, roleSchema } from "@fathom/shared";
import { Badge, Group, Paper, Stack, Table, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { roleDescription, roleName } from "./accounts.ts";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";

const sensitivities: [string, string][] = [
  ["General", "Everything not marked Restricted or Confidential."],
  ["Restricted", "Start and end dates, and columns marked Restricted."],
  ["Confidential", "Columns marked Confidential."],
];

function Rows({ rows }: { rows: [string, ReactNode, string][] }) {
  return (
    <Paper withBorder className={classes.tablePanel}>
      <Table verticalSpacing="sm" horizontalSpacing="md">
        <Table.Tbody>
          {rows.map(([key, name, description]) => (
            <Table.Tr key={key}>
              <Table.Th w={240} fw={600}>
                {name}
              </Table.Th>
              <Table.Td>{description}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

export function RolesHelpPage({ roles }: { roles: readonly Role[] }) {
  return (
    <Stack gap="xl" maw={960}>
      <Stack gap={0}>
        <PageHeader title="Roles" />
        <Rows
          rows={roleSchema.options.map((role) => [
            role,
            <Group gap="xs" wrap="nowrap">
              <span>{roleName(role)}</span>
              {roles.includes(role) && (
                <Badge size="sm" variant="light" color="sea">
                  Yours
                </Badge>
              )}
            </Group>,
            roleDescription(role),
          ])}
        />
      </Stack>
      <Stack gap="xs">
        <Title order={2} fz="sm">
          Sensitivity
        </Title>
        <Rows rows={sensitivities.map(([name, text]) => [name, name, text])} />
      </Stack>
    </Stack>
  );
}
