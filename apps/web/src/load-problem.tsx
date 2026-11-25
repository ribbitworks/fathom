// SPDX-License-Identifier: Apache-2.0

// What a page shows while what it needs is loading, and when it could not be loaded, with a way to
// try again.

import { Alert, Button, Group, Loader, Text } from "@mantine/core";

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

export function Loading() {
  return <Loader role="status" aria-label="Loading" />;
}

// In place of what is read: the loader while it loads, then why it could not be loaded, and
// nothing once it has.
export function QueryState({
  pending,
  failed,
  what,
  onRetry,
}: {
  pending: boolean;
  failed: boolean;
  what: string;
  onRetry: () => void;
}) {
  if (pending) return <Loading />;
  if (failed) return <LoadProblem what={what} onRetry={onRetry} />;
  return null;
}
