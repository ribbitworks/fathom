// SPDX-License-Identifier: Apache-2.0

// The Overview page: for now, the greeting the server reads from the database, while it loads, and
// when it cannot be loaded. The first stage's summary of the plan takes its place. Only those who
// may see the plan reach it.

import { Alert, Loader, Paper, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { describeProblem } from "./api.ts";
import { fetchGreeting } from "./greeting.ts";
import { PageHeader } from "./page-header.tsx";

function Greeting() {
  const greeting = useQuery({ queryKey: ["greeting"], queryFn: fetchGreeting });
  if (greeting.isPending) return <Loader role="status" aria-label="Loading" />;
  if (greeting.isError) {
    return (
      <Alert color="red" role="alert">
        {describeProblem(
          greeting.error,
          "Fathom could not reach its server. Try again in a moment.",
        )}
      </Alert>
    );
  }
  return (
    <Paper withBorder p="lg">
      <Text fz="lg">{greeting.data.greeting}</Text>
    </Paper>
  );
}

export function Home() {
  return (
    <Stack gap="md">
      <PageHeader title="Overview" />
      <Greeting />
    </Stack>
  );
}
