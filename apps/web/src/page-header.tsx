// SPDX-License-Identifier: Apache-2.0

// The heading of a page: its title, an optional line saying what the page is for, and the page's
// main action.

import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-end" gap="md" mb="lg">
      <Stack gap={2}>
        <Title order={1} fz={22}>
          {title}
        </Title>
        {description && (
          <Text fz="sm" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
      {action}
    </Group>
  );
}
