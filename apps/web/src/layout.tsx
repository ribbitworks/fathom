// SPDX-License-Identifier: Apache-2.0

// The frame around every page for a signed-in user: Fathom's name, who is signed in, and signing
// out.

import { AppShell, Button, Group, Text, Title } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { type SignedInUser, sessionQuery, signOut } from "./session.ts";

const headerHeight = 56;

export function Layout({ user }: { user: SignedInUser }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      queryClient.clear();
      queryClient.setQueryData(sessionQuery.queryKey, null);
      await navigate({ to: "/sign-in" });
    } catch {
      setFailed(true);
      setSigningOut(false);
    }
  }

  return (
    <AppShell header={{ height: headerHeight }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={1} size="h3">
            Fathom
          </Title>
          <Group>
            <Text>{user.name}</Text>
            <Button
              variant="default"
              loading={signingOut}
              onClick={() => void handleSignOut()}
            >
              Sign out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        {failed && (
          <Text c="red" role="alert" mb="md">
            Fathom could not sign you out. Try again in a moment.
          </Text>
        )}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
