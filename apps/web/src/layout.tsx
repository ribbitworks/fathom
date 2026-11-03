// SPDX-License-Identifier: Apache-2.0

// The frame around every page for a signed-in user: a sidebar of Fathom's sections, showing only
// the pages, current and still to come, that the user's roles allow, marking those still to come,
// and a top bar saying where they are, with their own account's menu for changing their password
// and signing out, which also happens after a time without use. The sidebar collapses to a rail of
// icons, each naming its page on hover or focus, and remembers the choice. On narrow screens the
// sidebar opens from a menu button instead.

import { AboutBox, build } from "./about.tsx";
import { AppMenu } from "./app-menu.tsx";
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
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import { useDisclosure, useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brand } from "./brand.tsx";
import { DevBadge, devLabel } from "./dev-label.tsx";
import { Icon, type IconName } from "./icons.tsx";
import { useSignOutWhenIdle } from "./idle.ts";
import classes from "./layout.module.css";
import { initials } from "./names.ts";
import { type SignedInUser, sessionQuery, signOut } from "./session.ts";

const headerHeight = 56;
const sidebarWidth = 228;
const railWidth = 56;
const sidebarId = "sections";

type Page =
  | "/"
  | "/accounts"
  | "/history"
  | "/changes"
  | "/drafts"
  | "/lists/{-$listId}"
  | "/people"
  | "/password"
  | "/help/roles"
  | "/help/drafts";

interface Item {
  label: string;
  icon: IconName;
  // Absent for pages still to come, and for boxes.
  to?: Page;
  // Opens a box over the current page instead of going to another.
  box?: "about";
  // The permission the page needs, or several, any one of which opens it.
  permission?: Permission | readonly Permission[];
  // Pages with addresses below their own, such as each list's, are marked as the current page for
  // all of them.
  nested?: boolean;
}

// Whether the user's permissions open an item's page.
function opens(item: Item, permissions: readonly Permission[]): boolean {
  if (item.permission === undefined) return true;
  const needed: readonly Permission[] =
    typeof item.permission === "string" ? [item.permission] : item.permission;
  return needed.some((permission) => permissions.includes(permission));
}

const sections: { label: string; items: Item[] }[] = [
  {
    label: "Plan",
    items: [
      {
        label: "Overview",
        icon: "overview",
        to: "/",
        permission: "plan:view",
      },
      { label: "Projects", icon: "projects", permission: "plan:view" },
      { label: "Releases", icon: "releases", permission: "plan:view" },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "People",
        icon: "people",
        to: "/people",
        permission: "people:view",
      },
      {
        label: "Drafts",
        icon: "drafts",
        to: "/drafts",
        // Drafts of people, and of lists, which Approvers see.
        permission: ["people:view", "configuration:view"],
      },
      {
        label: "Capacity",
        icon: "capacity",
        permission: "allocations:view",
      },
      {
        label: "Lists",
        icon: "lists",
        to: "/lists/{-$listId}",
        permission: "configuration:view",
        nested: true,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Accounts",
        icon: "accounts",
        to: "/accounts",
        permission: "accounts:manage",
      },
    ],
  },
  {
    label: "History",
    items: [
      {
        label: "Change history",
        icon: "changes",
        to: "/changes",
        permission: "changes:view",
      },
      {
        label: "Access history",
        icon: "history",
        to: "/history",
        permission: "history:view",
      },
    ],
  },
  {
    label: "Help",
    items: [
      { label: "Roles", icon: "rolesHelp", to: "/help/roles" },
      { label: "Drafts", icon: "draftsHelp", to: "/help/drafts" },
      { label: "About Fathom", icon: "aboutHelp", box: "about" },
    ],
  },
];

// The first page in the sidebar, other than the Overview, that the user's roles let them open, if
// any: where someone who may not see the Overview starts. Never the Overview, so sending them there
// cannot loop back, and never Help, which is open to everyone.
export function firstPage(
  permissions: readonly Permission[],
): Page | undefined {
  return sections
    .flatMap(({ items }) => items)
    .find(
      (item) =>
        item.to !== undefined &&
        item.to !== "/" &&
        item.permission !== undefined &&
        opens(item, permissions),
    )?.to;
}

// Where the user is, as the top bar names it: the sidebar's section and page, or their own account.
const places = new Map<string, [string, string]>([
  ...sections.flatMap((section) =>
    section.items.flatMap((item): [string, [string, string]][] =>
      item.to === undefined
        ? []
        : [[item.to.replace("/{-$listId}", ""), [section.label, item.label]]],
    ),
  ),
  ["/password", ["Your account", "Change password"]],
]);

// In the rail, each page's name shows beside its icon on hover or focus.
function RailTip({
  rail,
  label,
  children,
}: {
  rail: boolean;
  label: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip
      label={label}
      position="right"
      disabled={!rail}
      events={{ hover: true, focus: true, touch: false }}
      withinPortal
    >
      {children}
    </Tooltip>
  );
}

// A button, not a link, since it opens a box over the page rather than going to another.
function AboutItem({ item, rail }: { item: Item; rail: boolean }) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <RailTip rail={rail} label={item.label}>
        <UnstyledButton className={classes.link} onClick={open}>
          <Icon name={item.icon} />
          {rail ? (
            <VisuallyHidden>{item.label}</VisuallyHidden>
          ) : (
            <span>{item.label}</span>
          )}
        </UnstyledButton>
      </RailTip>
      <AboutBox opened={opened} onClose={close} build={build} />
    </>
  );
}

function Sidebar({
  permissions,
  rail,
}: {
  permissions: Permission[];
  rail: boolean;
}) {
  return (
    <Stack gap={rail ? 14 : 22}>
      {sections.map((section) => {
        const items = section.items.filter((item) => opens(item, permissions));
        if (items.length === 0) return null;
        return (
          <Stack
            key={section.label}
            gap={2}
            className={rail ? classes.railSection : undefined}
            role="group"
            aria-labelledby={`${sidebarId}-${section.label}`}
          >
            {rail ? (
              <VisuallyHidden id={`${sidebarId}-${section.label}`}>
                {section.label}
              </VisuallyHidden>
            ) : (
              <Text
                id={`${sidebarId}-${section.label}`}
                className={classes.section}
              >
                {section.label}
              </Text>
            )}
            {items.map((item) =>
              item.box === "about" ? (
                <AboutItem key={item.label} item={item} rail={rail} />
              ) : item.to === undefined ? (
                <RailTip
                  key={item.label}
                  rail={rail}
                  label={`${item.label} (Later)`}
                >
                  <span className={classes.later}>
                    <Icon name={item.icon} />
                    {rail ? (
                      <VisuallyHidden>{item.label}, Later</VisuallyHidden>
                    ) : (
                      <>
                        <span className={classes.grow}>{item.label}</span>
                        <VisuallyHidden>, </VisuallyHidden>
                        <span className={classes.laterTag}>Later</span>
                      </>
                    )}
                  </span>
                </RailTip>
              ) : (
                <RailTip key={item.label} rail={rail} label={item.label}>
                  <Link
                    to={item.to}
                    className={classes.link}
                    activeOptions={{ exact: item.nested !== true }}
                  >
                    <Icon name={item.icon} />
                    {rail ? (
                      <VisuallyHidden>{item.label}</VisuallyHidden>
                    ) : (
                      <span>{item.label}</span>
                    )}
                  </Link>
                </RailTip>
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
  const router = useRouter();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [opened, { toggle, close }] = useDisclosure(false);
  // Collapsed to a rail on wide screens, remembered for next time.
  const [collapsed, setCollapsed] = useLocalStorage({
    key: "fathom-sidebar-collapsed",
    defaultValue: false,
  });
  const [failed, setFailed] = useState(false);
  const narrow = useMediaQuery("(max-width: 48em)");
  // A list's address, such as /lists/ followed by its identifier, is a place within the Lists page.
  const place =
    places.get(pathname) ?? places.get(pathname.replace(/\/[^/]*$/, ""));

  const rail = collapsed && !narrow;

  // On narrow screens, the sidebar covers the page, so it closes once the user moves to another one.
  useEffect(close, [pathname, close]);

  function leave() {
    queryClient.clear();
    queryClient.setQueryData(sessionQuery.queryKey, null);
  }

  async function handleSignOut() {
    try {
      await signOut();
      leave();
      await navigate({ to: "/sign-in" });
    } catch {
      setFailed(true);
    }
  }

  // Signed out after a time without use, the user comes back to this page after signing in again.
  // If the server cannot be told, the session still ends there, since nothing keeps it alive.
  useSignOutWhenIdle({
    onIdle: () => {
      const { href } = router.state.location;
      void signOut()
        .catch(() => undefined)
        .then(async () => {
          leave();
          await navigate({
            to: "/sign-in",
            search: { redirect: href, idle: true },
          });
        });
    },
    // A session found to have ended sends the user to sign in too: by a password change, say, or by
    // the server's own limit, which can come up to two minutes before this one.
    keepAlive: () => {
      void queryClient
        .query(sessionQuery)
        .then(async (session) => {
          if (session === null) await router.invalidate();
        })
        .catch(() => undefined);
    },
  });

  return (
    <AppShell
      header={{ height: headerHeight }}
      navbar={{
        width: rail ? railWidth : sidebarWidth,
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
            <DevBadge label={devLabel} />
          </Group>
          <AppMenu position="bottom-end" width="max-content">
            <AppMenu.Target>
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
            </AppMenu.Target>
            <AppMenu.Dropdown miw={200} maw="calc(100vw - 2rem)">
              <Menu.Label>{user.email}</Menu.Label>
              <Menu.Item component={Link} to="/password">
                Change password
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item onClick={() => void handleSignOut()}>
                Sign out
              </Menu.Item>
            </AppMenu.Dropdown>
          </AppMenu>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar
        id={sidebarId}
        aria-label="Sections"
        className={classes.sidebar}
        p={rail ? "xs" : "md"}
        // Hidden off screen on narrow screens until opened, so it must not be reachable either.
        inert={narrow && !opened}
      >
        <Stack gap={24}>
          <Group
            px={rail ? 0 : 8}
            justify={rail ? "center" : "space-between"}
            wrap="nowrap"
            gap={rail ? 10 : 8}
            className={rail ? classes.railBrand : undefined}
          >
            <Brand onDark markOnly={rail} />
            <Tooltip
              label={rail ? "Expand sidebar" : "Collapse sidebar"}
              position="right"
              events={{ hover: true, focus: true, touch: false }}
            >
              <UnstyledButton
                visibleFrom="sm"
                className={classes.railToggle}
                aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!rail}
                aria-controls={sidebarId}
                onClick={() => {
                  setCollapsed(!collapsed);
                }}
              >
                <Icon name="rail" />
              </UnstyledButton>
            </Tooltip>
          </Group>
          <Sidebar permissions={permissions} rail={rail} />
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
