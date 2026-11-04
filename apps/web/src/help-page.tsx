// SPDX-License-Identifier: Apache-2.0

// Help's pages, reference rather than instruction, as Visual Design allows. Roles: what each role
// lets a user do, with the roles the signed-in user holds marked, and what each sensitivity of
// people's details covers; each role's description is the one shown wherever roles are chosen.
// Drafts: the marks the People table and the Lists page show beside records with drafts, what
// happens to a draft, and what the Draft menu shows.

import { type Role, roleSchema } from "@fathom/shared";
import {
  Group,
  Paper,
  Stack,
  Table,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import type { ReactNode } from "react";
import { roleDescription, roleName } from "./accounts.ts";
import { Icon } from "./icons.tsx";
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
    "A change waiting for approval.",
  ],
  [
    "added",
    <StatusMark tone="draft">Draft: added</StatusMark>,
    "Added once approved.",
  ],
  [
    "removed",
    <StatusMark tone="draft">Draft: removed</StatusMark>,
    "Removed once approved.",
  ],
  [
    "moved",
    <StatusMark tone="draft">Draft: moved</StatusMark>,
    "A moved column or choice, waiting for approval.",
  ],
  [
    "reordered",
    <StatusMark tone="draft">Draft: reordered</StatusMark>,
    "A list whose choices are in a new order, waiting for approval.",
  ],
  [
    "retired",
    <StatusMark tone="draft">Draft: retired</StatusMark>,
    "Retired once approved. Draft: restored means brought back once approved.",
  ],
  [
    "rejected",
    <StatusMark tone="rejected">Rejected</StatusMark>,
    "The draft was rejected. The reason is in the record's menu.",
  ],
  [
    "unpublished",
    <StatusMark tone="unpublished">Unpublished</StatusMark>,
    "Your own change, which only you see until you publish it. Other marks show it with a hollow dot, such as Draft: added.",
  ],
  [
    "held",
    <StatusMark tone="held">Being changed</StatusMark>,
    "Someone else has unpublished changes to this. You can't change it until they publish or discard them.",
  ],
  [
    "live",
    <StatusMark tone="live">Live</StatusMark>,
    "The current record, without the draft's changes.",
  ],
];

const lifecycle: [string, string][] = [
  [
    "Saved",
    "Only you see it, until you publish your changes with Publish at the top of the page.",
  ],
  [
    "Published",
    "It waits for an Approver. If someone changes it, only they see their changes until they publish them.",
  ],
  [
    "Approved",
    "The change goes live. Any new list, column, or choice it depends on is approved with it. This can't be undone.",
  ],
  [
    "Rejected",
    "It goes back to the person who made it, who can change it, resubmit it, or discard it. Drafts that depend on it wait. Rejecting a new list, column, or choice also rejects the drafts that depend on it.",
  ],
  [
    "Discarded",
    "The draft is deleted, and the record stays as it is. A new list, column, or choice can't be discarded while other drafts depend on it; discard or change those drafts first.",
  ],
];

// What the Draft menu above each table with drafts shows.
const views: [string, string][] = [
  ["Drafts beside live", "Each draft next to how the record is now."],
  [
    "Drafts applied",
    "Everything as it will be once the waiting drafts are approved.",
  ],
  ["Live only", "Everything as it is now."],
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
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <span className={classes.roleMark}>
                {roles.includes(role) && <Icon name="check" />}
              </span>
              <span>
                {roles.includes(role) && (
                  <>
                    <VisuallyHidden>Your role:</VisuallyHidden>{" "}
                  </>
                )}
                {roleName(role)}
              </span>
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
