// SPDX-License-Identifier: Apache-2.0

// The home page: shows the greeting the server reads from the database, while it loads, and when it
// cannot be loaded.

import { Alert, Loader, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { fetchGreeting } from "./greeting.ts";

export function Home() {
  const greeting = useQuery({ queryKey: ["greeting"], queryFn: fetchGreeting });
  if (greeting.isPending) return <Loader role="status" aria-label="Loading" />;
  if (greeting.isError) {
    return (
      <Alert color="red" role="alert">
        Fathom could not reach its server. Try again in a moment.
      </Alert>
    );
  }
  return <Text size="xl">{greeting.data.greeting}</Text>;
}
