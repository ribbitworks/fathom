// SPDX-License-Identifier: Apache-2.0

// The heading of a page: its title, with what switches how the page shows its records beside it, the
// Export icon while a table on the page offers its export, and the page's main action. It is one
// height on every page, as tall as a button, unless a narrow window wraps it, with no space of its
// own under it: each page puts the same gap after it, so the row under the heading starts at the
// same place on every page.

import { Group, SegmentedControl, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { PageExportMenu } from "./page-export.tsx";

export function PageHeader({
  title,
  beside,
  action,
}: {
  title: string;
  beside?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Group
      justify="space-between"
      align="center"
      gap="md"
      mih="var(--fathom-heading-height)"
    >
      <Group gap="lg" align="center">
        <Title order={1} fz={22}>
          {title}
        </Title>
        {beside}
      </Group>
      <Group gap="xs">
        <PageExportMenu />
        {action}
      </Group>
    </Group>
  );
}

// The switch between the ways a page shows its records, such as Table and Board, for the heading's
// beside.
export function ModeSwitch<Mode extends string>({
  label = "What the page shows",
  modes,
  mode,
  onMode,
}: {
  label?: string;
  modes: readonly { value: Mode; label: string }[];
  mode: Mode;
  onMode: (mode: Mode) => void;
}) {
  return (
    <SegmentedControl<Mode>
      aria-label={label}
      value={mode}
      onChange={onMode}
      data={[...modes]}
    />
  );
}
