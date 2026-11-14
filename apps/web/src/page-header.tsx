// SPDX-License-Identifier: Apache-2.0

// The heading of a page: its title, with what switches how the page shows its records beside it, so
// the row under the heading starts where it does on every page, the Export icon while a table on the
// page offers its export, and the page's main action.

import { Group, Title } from "@mantine/core";
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
    <Group justify="space-between" align="flex-end" gap="md" mb="lg">
      <Group gap="lg" align="baseline">
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
