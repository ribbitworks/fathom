// SPDX-License-Identifier: Apache-2.0

// The pages shown when something goes wrong: the server could not be reached, with a way to try
// again, or the address names no page in Fathom. Like the sign-in page, they show only Fathom's
// name and mark above the message.

import { Alert, Anchor, Button, Center, Stack, Text } from "@mantine/core";
import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Brand } from "./brand.tsx";
import classes from "./pages.module.css";

function ProblemPage({ children }: { children: ReactNode }) {
  return (
    <Center mih="100vh" p="md" className={classes.signIn}>
      <Stack w="100%" maw={400} gap="xl" align="center">
        <Brand size="large" />
        {children}
      </Stack>
    </Center>
  );
}

export function ServerProblem() {
  const router = useRouter();
  return (
    <ProblemPage>
      <Alert color="red" role="alert" w="100%">
        Fathom could not reach its server.
      </Alert>
      <Button onClick={() => void router.invalidate()}>Try again</Button>
    </ProblemPage>
  );
}

export function PageNotFound() {
  return (
    <ProblemPage>
      <Text>There is no page at this address.</Text>
      <Anchor component={Link} to="/">
        Go to the start page
      </Anchor>
    </ProblemPage>
  );
}
