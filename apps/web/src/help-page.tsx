// SPDX-License-Identifier: Apache-2.0

// Help's pages, reference rather than instruction, as Visual Design allows. Roles: what each role
// Fathom starts with lets a user do, with the signed-in user's own role marked, first if it is one
// made later, and what each sensitivity of people's details covers; each starting role's description
// is the one Fathom gives it, as shown wherever roles are chosen until it is changed.
// Drafts: the marks the People table and the Lists page show beside records with drafts, what
// happens to a draft, and what the Draft menu shows.

import {
  roleSchema,
  type SessionResponse,
  startingRoles,
} from "@fathom/shared";
import {
  Group,
  Paper,
  Stack,
  Table,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import type { ReactNode } from "react";
import { Icon } from "./icons.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { DraftedItem, MarkedItem } from "./status-mark.tsx";

const sensitivities: [string, string][] = [
  ["General", "Everything not marked Personal or Confidential."],
  ["Personal", "Start and end dates, and columns marked Personal."],
  ["Confidential", "Columns marked Confidential."],
];

// An example name, as each mark draws it.
const example = "Example";

const marks: [string, ReactNode, string][] = [
  [
    "draft",
    <DraftedItem slot draft={{ action: "changed", state: "waiting" }}>
      {example}
    </DraftedItem>,
    "A change waiting for approval, before what changed: a row added, removed or moved, or each value changed. Point at the dot to see what it is.",
  ],
  [
    "removed",
    <DraftedItem slot draft={{ action: "deleted", state: "waiting" }}>
      <span className={classes.struck}>{example}</span>
    </DraftedItem>,
    "Struck through when the change removes it.",
  ],
  [
    "unpublished",
    <DraftedItem
      slot
      draft={{ action: "changed", state: "waiting", unpublished: true }}
    >
      {example}
    </DraftedItem>,
    "A hollow dot: a change not yet published, which nobody else sees.",
  ],
  [
    "rejected",
    <DraftedItem slot draft={{ action: "changed", state: "rejected" }}>
      {example}
    </DraftedItem>,
    "A red dot in a ring: the draft was rejected. Point at the dot to see what was rejected and why.",
  ],
  [
    "held",
    <DraftedItem slot heldBy="Someone">
      {example}
    </DraftedItem>,
    "A grey lock: someone else has unpublished changes to this. Point at it to see who. It can't be changed until they publish or discard them.",
  ],
  [
    "kind",
    <DraftedItem
      slot
      draft={{ action: "changed", state: "waiting", moved: true }}
    >
      {example}
    </DraftedItem>,
    "What a dot can't say, in a yellow box after the name: Moved, Reordered, Retired or Restored.",
  ],
  [
    "from",
    <DraftedItem
      slot
      draft={{ action: "changed", state: "waiting" }}
      from="Dec 1, 2026"
    >
      {example}
    </DraftedItem>,
    "When a change takes effect, where that's not the date shown.",
  ],
  [
    "live",
    <MarkedItem slot tone="live">
      {example}
    </MarkedItem>,
    "A green dot: the current record or value, without the draft's changes.",
  ],
  [
    "fact",
    <MarkedItem slot tone="warning" words="Left">
      {example}
    </MarkedItem>,
    "A grey or red box after a name: a fact about it, not a draft, such as Built in, Planned, expected and a month or Planned, no date, or a warning such as Left.",
  ],
  [
    "tint",
    <span className={classes.draftRow}>
      <MarkedItem slot tone={undefined}>
        {example}
      </MarkedItem>
    </span>,
    "A faint yellow row, column or card, or faint red once rejected: it has a draft. Shown only with drafts beside live, where changed values are in bold too.",
  ],
];

const lifecycle: [string, string][] = [
  [
    "Saved",
    "Nobody else sees it until it's published with Publish at the top of the page.",
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

// A role's name, with a check before it, read aloud as "Current role", when it is the user's own.
function RoleName({ name, own }: { name: string; own: boolean }) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <span className={classes.roleMark}>{own && <Icon name="check" />}</span>
      <span>
        {own && (
          <>
            <VisuallyHidden>Current role:</VisuallyHidden>{" "}
          </>
        )}
        {name}
      </span>
    </Group>
  );
}

export function RolesHelpPage({ role }: { role: SessionResponse["role"] }) {
  const madeLater =
    role === null || roleSchema.safeParse(role.key).success ? [] : [role];
  return (
    <Stack gap="xl" maw={960}>
      <Stack gap="md">
        <PageHeader title="Roles" />
        <Rows
          rows={[
            ...madeLater.map(
              ({ id, name, description }): [string, ReactNode, string] => [
                id,
                <RoleName name={name} own />,
                description,
              ],
            ),
            ...roleSchema.options.map((key): [string, ReactNode, string] => {
              // The key is always one of the starting roles.
              // eslint-disable-next-line security/detect-object-injection
              const { name, description } = startingRoles[key];
              return [
                key,
                <RoleName name={name} own={role?.key === key} />,
                description,
              ];
            }),
          ]}
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
      <Stack gap="md">
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
