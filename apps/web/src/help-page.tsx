// SPDX-License-Identifier: Apache-2.0

// Help's pages, reference rather than instruction, as Visual Design allows. Roles: what each role
// lets a user do, with the roles the signed-in user holds marked, and what each sensitivity of
// people's details covers; each role's description is the one shown wherever roles are chosen.
// Drafts: the marks the People table shows beside people with drafts, and what happens to a draft.

import { type Role, roleSchema } from "@fathom/shared";
import { Badge, Group, Paper, Stack, Table, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { roleDescription, roleName } from "./accounts.ts";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { StatusMark } from "./status-mark.tsx";

const sensitivities: [string, string][] = [
  ["General", "Everything not marked Restricted or Confidential."],
  ["Restricted", "Start and end dates, and columns marked Restricted."],
  ["Confidential", "Columns marked Confidential."],
];

const marks: [string, ReactNode, string][] = [
  [
    "draft",
    <StatusMark tone="draft">Draft</StatusMark>,
    "A change to a person, waiting for approval, on a light blue row with each cell it changes in yellow.",
  ],
  [
    "added",
    <StatusMark tone="draft">Draft: added</StatusMark>,
    "A person to be added once approved.",
  ],
  [
    "removed",
    <StatusMark tone="draft">Draft: removed</StatusMark>,
    "A person to be removed once approved, struck through.",
  ],
  [
    "rejected",
    <StatusMark tone="rejected">Rejected</StatusMark>,
    "A draft an Approver rejected, with each cell it changes in red. Any reason is at the top of the person's menu and on the Drafts page.",
  ],
  [
    "live",
    <StatusMark tone="live">Live</StatusMark>,
    "The person as they are now, in green under a draft that changes them. Read only.",
  ],
];

const lifecycle: [string, string][] = [
  [
    "Saved",
    "Waits for approval at once. Later edits, by anyone, change the same draft, so a person has at most one.",
  ],
  [
    "Approved",
    "Becomes live. Approving cannot be undone; a new draft changes it.",
  ],
  [
    "Rejected",
    "Stays until it is changed, which sends it for approval again, or until it is sent again unchanged or discarded. An Approver may still approve it, or reject it again for another reason.",
  ],
  [
    "Discarded",
    "Gone. The person stays as they are, or, if the draft added them, is not added.",
  ],
];

function Rows({ rows }: { rows: [string, ReactNode, string][] }) {
  return (
    <Paper withBorder className={classes.tablePanel}>
      <Table verticalSpacing="sm" horizontalSpacing="md">
        <Table.Tbody>
          {rows.map(([key, name, description]) => (
            <Table.Tr key={key}>
              <Table.Th scope="row" w={240} fw={600}>
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

export function DraftsHelpPage() {
  return (
    <Stack gap="xl" maw={960}>
      <Stack gap={0}>
        <PageHeader title="Drafts" />
        <Rows rows={marks} />
      </Stack>
      <Stack gap="xs">
        <Title order={2} fz="sm">
          What happens to a draft
        </Title>
        <Rows rows={lifecycle.map(([name, text]) => [name, name, text])} />
      </Stack>
    </Stack>
  );
}
