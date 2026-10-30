// SPDX-License-Identifier: Apache-2.0

// The pages shown when something goes wrong: the server could not be reached, with a way to try
// again, or the address names no page in Fathom.

import { Alert, Anchor, Button, Center, Stack, Text } from "@mantine/core";
import { Link, useRouter } from "@tanstack/react-router";

export function ServerProblem() {
  const router = useRouter();
  return (
    <Center mih="100vh" p="md">
      <Stack maw={400}>
        <Alert color="red" role="alert">
          Fathom could not reach its server.
        </Alert>
        <Button onClick={() => void router.invalidate()}>Try again</Button>
      </Stack>
    </Center>
  );
}

export function PageNotFound() {
  return (
    <Center mih="100vh" p="md">
      <Stack align="center">
        <Text>There is no page at this address.</Text>
        <Anchor component={Link} to="/">
          Go to the home page
        </Anchor>
      </Stack>
    </Center>
  );
}
