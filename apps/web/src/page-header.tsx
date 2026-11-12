// SPDX-License-Identifier: Apache-2.0

// The heading of a page: its title, the Export icon while a table on the page offers its export,
// and the page's main action.

import { Group, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { PageExportMenu } from "./page-export.tsx";

export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-end" gap="md" mb="lg">
      <Title order={1} fz={22}>
        {title}
      </Title>
      <Group gap="xs">
        <PageExportMenu />
        {action}
      </Group>
    </Group>
  );
}
