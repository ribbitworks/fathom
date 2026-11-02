// SPDX-License-Identifier: Apache-2.0

// Help's pages, reference rather than instruction, as Visual Design allows. Roles: what each role
// lets a user do, with the roles the signed-in user holds marked, and what each sensitivity of
// people's details covers; each role's description is the one shown wherever roles are chosen.
// Drafts: the marks the People table and the Lists page show beside records with drafts, what
// happens to a draft, and what the Draft menu shows.

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
    "A change to a person, a list, or a choice, waiting for approval, on a light blue row. On People, each cell it changes is in yellow.",
  ],
  [
    "added",
    <StatusMark tone="draft">Draft: added</StatusMark>,
    "A person, a list, or a choice to be added once approved.",
  ],
  [
    "removed",
    <StatusMark tone="draft">Draft: removed</StatusMark>,
    "A person, a list, or a choice to be removed once approved, struck through.",
  ],
  [
    "rejected",
    <StatusMark tone="rejected">Rejected</StatusMark>,
    "A draft an Approver rejected, in red. Any reason is at the top of the record's menu, or in its bar on the Lists page, and on the Drafts page.",
  ],
  [
    "moved",
    <StatusMark tone="draft">Draft: moved</StatusMark>,
    "A choice in the place a draft of its list's order moves it to.",
  ],
  [
    "order",
    <StatusMark tone="draft">Draft: order</StatusMark>,
    "A list whose draft changes only the order of its choices.",
  ],
  [
    "live",
    <StatusMark tone="live">Live</StatusMark>,
    "The record as it is now, in green under a draft that changes it, or a moved choice in its place now. Read only.",
  ],
];

const lifecycle: [string, string][] = [
  [
    "Saved",
    "Waits for approval at once. Later edits, by anyone, change the same draft, so a record has at most one; its menu says who changed each field.",
  ],
  [
    "Approved",
    "Becomes live, with any draft it uses, such as a choice added to a list that is itself drafted to be added, which the Approver is told of first. Approving cannot be undone; a new draft changes it.",
  ],
  [
    "Rejected",
    "Stays until it is changed, which sends it for approval again, or until it is sent again unchanged or discarded. An Approver may still approve it, or reject it again for another reason. A draft that others use is rejected only together with them.",
  ],
  [
    "Discarded",
    "Gone. The record stays as it is, or, if the draft added it, is not added.",
  ],
];

// What the Draft menu above each table with drafts shows.
const views: [string, string][] = [
  ["Drafts beside live", "Each draft marked, with the live record beside it."],
  [
    "Drafts applied",
    "Everything as it will be once the drafts are approved, without live rows.",
  ],
  [
    "Live only",
    "Everything as it is now, without drafts. Read only, and not filtered by draft.",
  ],
];

function Rows({ rows }: { rows: [string, ReactNode, string][] }) {
  return (
    <Paper withBorder className={classes.tablePanel}>
      <Table>
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
      <Stack gap="xs">
        <Title order={2} fz="sm">
          What the Draft menu shows
        </Title>
        <Rows rows={views.map(([name, text]) => [name, name, text])} />
      </Stack>
    </Stack>
  );
}
