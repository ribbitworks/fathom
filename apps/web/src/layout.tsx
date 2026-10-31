// SPDX-License-Identifier: Apache-2.0

// The frame around every page for a signed-in user: a sidebar of Fathom's sections, showing only
// the pages the user's roles allow and marking sections still to come, and a top bar saying where
// they are, with their own account's menu for changing their password and signing out. On narrow
// screens the sidebar opens from a menu button.

import type { Permission } from "@fathom/shared";
import {
  Alert,
  AppShell,
  Avatar,
  Breadcrumbs,
  Burger,
  Group,
  Menu,
  Stack,
  Text,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brand } from "./brand.tsx";
import classes from "./layout.module.css";
import { initials } from "./names.ts";
import { type SignedInUser, sessionQuery, signOut } from "./session.ts";

const headerHeight = 56;
const sidebarWidth = 228;
const sidebarId = "sections";

type Page = "/" | "/accounts" | "/history" | "/lists" | "/password";

interface Item {
  label: string;
  // Absent for pages still to come.
  to?: Page;
  permission?: Permission;
}

const sections: { label: string; items: Item[] }[] = [
  {
    label: "Plan",
    items: [
      { label: "Overview", to: "/" },
      { label: "Projects" },
      { label: "Releases" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "People" },
      { label: "Capacity" },
      { label: "Lists", to: "/lists", permission: "configuration:view" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Accounts", to: "/accounts", permission: "accounts:manage" },
      { label: "Access history", to: "/history", permission: "history:view" },
    ],
  },
];

// Where the user is, as the top bar names it: the sidebar's section and page, or their own account.
const places = new Map<string, [string, string]>([
  ...sections.flatMap((section) =>
    section.items.flatMap((item): [string, [string, string]][] =>
      item.to === undefined ? [] : [[item.to, [section.label, item.label]]],
    ),
  ),
  ["/password", ["Your account", "Change password"]],
]);

function Sidebar({ permissions }: { permissions: Permission[] }) {
  return (
    <Stack gap={22}>
      {sections.map((section) => {
        const items = section.items.filter(
          (item) =>
            item.permission === undefined ||
            permissions.includes(item.permission),
        );
        if (items.length === 0) return null;
        return (
          <Stack key={section.label} gap={2}>
            <Text className={classes.section}>{section.label}</Text>
            {items.map((item) =>
              item.to === undefined ? (
                <span key={item.label} className={classes.later}>
                  {item.label}
                  <VisuallyHidden>, </VisuallyHidden>
                  <span className={classes.laterTag}>Later</span>
                </span>
              ) : (
                <Link
                  key={item.label}
                  to={item.to}
                  className={classes.link}
                  activeOptions={{ exact: true }}
                >
                  {item.label}
                </Link>
              ),
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}

export function Layout({
  user,
  permissions,
}: {
  user: SignedInUser;
  permissions: Permission[];
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [opened, { toggle, close }] = useDisclosure(false);
  const [failed, setFailed] = useState(false);
  const narrow = useMediaQuery("(max-width: 48em)");
  const place = places.get(pathname);

  // On narrow screens, the sidebar covers the page, so it closes once the user moves to another one.
  useEffect(close, [pathname, close]);

  async function handleSignOut() {
    try {
      await signOut();
      queryClient.clear();
      queryClient.setQueryData(sessionQuery.queryKey, null);
      await navigate({ to: "/sign-in" });
    } catch {
      setFailed(true);
    }
  }

  return (
    <AppShell
      header={{ height: headerHeight }}
      navbar={{
        width: sidebarWidth,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label="Show sections"
              aria-expanded={opened}
              aria-controls={sidebarId}
            />
            {place && (
              <Breadcrumbs separator="/" fz="sm" c="dimmed">
                <span>{place[0]}</span>
                <Text span fz="sm" fw={500} c="var(--mantine-color-text)">
                  {place[1]}
                </Text>
              </Breadcrumbs>
            )}
          </Group>
          <Menu position="bottom-end" width={200}>
            <Menu.Target>
              <UnstyledButton aria-label={`Your account, ${user.name}`}>
                <Group gap="xs" wrap="nowrap">
                  <Text fz="sm" visibleFrom="xs">
                    {user.name}
                  </Text>
                  <Avatar size={30} color="sea" radius="xl">
                    {initials(user.name)}
                  </Avatar>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{user.email}</Menu.Label>
              <Menu.Item component={Link} to="/password">
                Change password
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item onClick={() => void handleSignOut()}>
                Sign out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar
        id={sidebarId}
        aria-label="Sections"
        className={classes.sidebar}
        p="md"
        // Hidden off screen on narrow screens until opened, so it must not be reachable either.
        inert={narrow && !opened}
      >
        <Stack gap={24}>
          <Group px={8}>
            <Brand onDark />
          </Group>
          <Sidebar permissions={permissions} />
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main className={classes.main}>
        {failed && (
          <Alert color="red" role="alert" mb="md">
            Fathom could not sign you out. Try again in a moment.
          </Alert>
        )}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
