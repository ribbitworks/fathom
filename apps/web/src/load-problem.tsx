// SPDX-License-Identifier: Apache-2.0

// What a page shows when what it needs could not be loaded, with a way to try again.

import { Alert, Button, Group, Text } from "@mantine/core";

export function LoadProblem({
  what,
  onRetry,
}: {
  // What could not be loaded, such as "the projects".
  what: string;
  onRetry: () => void;
}) {
  return (
    <Alert color="red" role="alert">
      <Group justify="space-between">
        <Text fz="sm">Fathom could not load {what}.</Text>
        <Button size="compact-sm" variant="light" color="red" onClick={onRetry}>
          Try again
        </Button>
      </Group>
    </Alert>
  );
}
