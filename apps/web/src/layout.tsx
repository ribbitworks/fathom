// SPDX-License-Identifier: Apache-2.0

// The frame around every page for a signed-in user: the sidebar of Fathom's sections, and the top
// bar with the user's account menu and its dialogs.

import { AboutBox, build } from "./about.tsx";
import { AppMenu, MenuChoices } from "./app-menu.tsx";
import {
  type AccountRole,
  type ClassAccess,
  type DataClasses,
  draftingPermissions,
  pageNeeds,
  type PasswordRules,
  type Permission,
  reaches,
} from "@fathom/shared";
import {
  Alert,
  Anchor,
  AppShell,
  Avatar,
  Breadcrumbs,
  Burger,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
  type MantineColorScheme,
  UnstyledButton,
  useMantineColorScheme,
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
import { PageExportProvider } from "./page-export.tsx";
import { PublishDraftProvider } from "./publish-draft.tsx";
import { DevBadge, devLabel } from "./dev-label.tsx";
import { Icon } from "./icons.tsx";
import { useSignOutWhenIdle } from "./idle.ts";
import classes from "./layout.module.css";
import { ChangeNameDialog } from "./change-name.tsx";
import { ChangePasswordDialog } from "./change-password.tsx";
import { menuChoice } from "./last-views.ts";
import { type Item, opens, sections } from "./navigation.ts";
import {
  MineSection,
  opensUnderMine,
  showsMine,
  useMinePlace,
} from "./mine-section.tsx";
import { initials } from "./names.ts";
import { useCutTip } from "./cut-tip.ts";
import { RailTip, SidebarGroup, sidebarId } from "./sidebar-group.tsx";
import {
  type SignedInUser,
  sessionQuery,
  signOut,
  switchRole,
} from "./session.ts";
import { UnpublishedControl } from "./unpublished.tsx";

const headerHeight = 56;
const sidebarWidth = 228;
const railWidth = 56;

// How Fathom looks for the person using this browser: following the computer's setting, or always
// light or dark. Mantine keeps the choice in the browser, so it applies on every page, signing in
// included, and to nobody else.
const appearances: readonly { scheme: MantineColorScheme; label: string }[] = [
  { scheme: "auto", label: "System" },
  { scheme: "light", label: "Light" },
  { scheme: "dark", label: "Dark" },
];

function AppearanceChoices() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <MenuChoices
      label="Appearance"
      choices={appearances.map(({ scheme, label }) => ({
        value: scheme,
        label,
      }))}
      chosen={colorScheme}
      onChoose={setColorScheme}
    />
  );
}

// The pages in the sidebar that some access opens, by name, leaving out those open to everyone,
// such as Help, so the result of setting roles can say which pages a role's holders see.
export function pagesOpened(access: ClassAccess): string[] {
  return sections.flatMap(({ items }) =>
    items
      .filter((item) => item.page !== undefined && opens(item, access))
      .map((item) => item.label),
  );
}

// The pages some permissions would open, whatever data they see, by name, as pagesOpened leaves
// them, so the result of setting roles can say why a page reached is not opened.
export function pagesReached(permissions: readonly Permission[]): string[] {
  return sections.flatMap(({ items }) =>
    items
      .filter(
        (item) =>
          item.page !== undefined && reaches(pageNeeds[item.page], permissions),
      )
      .map((item) => item.label),
  );
}

// The sidebar's section and page at an address, which the top bar names: a page's own address, or,
// for a page with addresses below its own, such as each list's, any of them, with the name of what
// that one shows, where the page names it.
function placeAt(
  pathname: string,
):
  | { section: string; item: Item; base: string; detail?: string | undefined }
  | undefined {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.to === undefined) continue;
      const base = item.to.replace(/\/\{-\$\w+\}$/, "");
      if (pathname === base) return { section: section.label, item, base };
      if (item.nested === true && pathname.startsWith(`${base}/`)) {
        const below = pathname.slice(base.length + 1);
        return {
          section: section.label,
          item,
          base,
          detail: item.detailOf?.(below),
        };
      }
    }
  }
  return undefined;
}

// Whether some access opens the page at an address. Pages outside the sidebar, but for Mine's, are
// open to all.
function opensPage(pathname: string, access: ClassAccess) {
  const place = placeAt(pathname);
  return (
    opensUnderMine(pathname, access.permissions) &&
    (place === undefined || opens(place.item, access))
  );
}

// An item's icon and name, the name read aloud but not shown in the rail.
function ItemContent({ item, rail }: { item: Item; rail: boolean }) {
  return (
    <>
      <Icon name={item.icon} />
      {rail ? (
        <VisuallyHidden>{item.label}</VisuallyHidden>
      ) : (
        <span>{item.label}</span>
      )}
    </>
  );
}

// A button, not a link, since it opens a box over the page rather than going to another.
function AboutItem({ item, rail }: { item: Item; rail: boolean }) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <RailTip rail={rail} label={item.label}>
        <UnstyledButton className={classes.link} onClick={open}>
          <ItemContent item={item} rail={rail} />
        </UnstyledButton>
      </RailTip>
      <AboutBox opened={opened} onClose={close} build={build} />
    </>
  );
}

function Sidebar({ access, rail }: { access: ClassAccess; rail: boolean }) {
  return (
    <Stack gap={22}>
      {showsMine(access.permissions) && <MineSection rail={rail} />}
      {sections.map((section) => {
        const items = section.items.filter((item) => opens(item, access));
        if (items.length === 0) return null;
        return (
          <SidebarGroup key={section.label} label={section.label} rail={rail}>
            {items.map((item) =>
              item.box === "about" ? (
                <AboutItem key={item.label} item={item} rail={rail} />
              ) : (
                <RailTip key={item.label} rail={rail} label={item.label}>
                  <Link
                    to={item.to}
                    state={(previous) => ({ ...previous, ...menuChoice })}
                    className={classes.link}
                    // The current page stays marked whatever its address shows, such as a
                    // record's details or a grouping.
                    activeOptions={{
                      exact: item.nested !== true,
                      includeSearch: false,
                    }}
                  >
                    <ItemContent item={item} rail={rail} />
                  </Link>
                </RailTip>
              ),
            )}
          </SidebarGroup>
        );
      })}
    </Stack>
  );
}

export function Layout({
  user,
  role,
  roles,
  permissions,
  dataClasses,
  passwordRules,
}: {
  user: SignedInUser;
  // The role the session acts as, and every role the user holds, which they may switch to.
  role: AccountRole | null;
  roles: readonly AccountRole[];
  permissions: Permission[];
  // The classes the organization keeps its details in, which decide the pages opened with them.
  dataClasses: DataClasses;
  // What a new password must meet, which the Change password dialog shows.
  passwordRules: PasswordRules;
}) {
  const queryClient = useQueryClient();
  // Those who may make drafts have unpublished changes to publish.
  const makesDrafts = draftingPermissions.some((permission) =>
    permissions.includes(permission),
  );
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
  const [problem, setProblem] = useState<string>();
  const {
    words: nameWords,
    shown: nameTipShown,
    target: nameTipTarget,
  } = useCutTip();
  const [changingName, setChangingName] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const narrow = useMediaQuery("(max-width: 48em)");
  const place = placeAt(pathname);
  const minePlace = useMinePlace(pathname, permissions);

  const rail = collapsed && !narrow;

  // On narrow screens, the sidebar covers the page, so it closes once the user moves to another
  // one.
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
      setProblem("Fathom could not sign out. Try again in a moment.");
    }
  }

  // Everything follows the new role at once: the sidebar, the page's data, and, when the role does
  // not open the page, the page itself, which gives way to the first the role opens.
  async function handleSwitch(roleId: string) {
    if (roleId === role?.id) return;
    try {
      await switchRole(roleId);
      const session = await queryClient.query({
        ...sessionQuery,
        staleTime: 0,
      });
      if (
        session !== null &&
        !opensPage(pathname, {
          permissions: session.permissions,
          dataClasses: session.settings.dataClasses,
        })
      ) {
        await navigate({ to: "/" });
      }
      await queryClient.resetQueries();
      await router.invalidate();
      setProblem(undefined);
    } catch {
      setProblem("Fathom could not switch the role. Try again in a moment.");
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
        <Group h="100%" px="lg" gap="sm" wrap="nowrap" className={classes.bar}>
          <Burger
            opened={opened}
            onClick={toggle}
            hiddenFrom="sm"
            size="sm"
            aria-label="Show sections"
            aria-expanded={opened}
            aria-controls={sidebarId}
          />
          {minePlace && (
            <Breadcrumbs
              separator="/"
              fz="sm"
              c="dimmed"
              className={classes.place}
            >
              <span>{minePlace.section}</span>
              <Text span fz="sm" fw={500} c="var(--mantine-color-text)">
                {minePlace.label}
              </Text>
            </Breadcrumbs>
          )}
          {place && (
            <Breadcrumbs
              separator="/"
              fz="sm"
              c="dimmed"
              className={classes.place}
            >
              <span>{place.section}</span>
              {place.detail === undefined ? (
                <Text span fz="sm" fw={500} c="var(--mantine-color-text)">
                  {place.item.label}
                </Text>
              ) : (
                <Anchor component={Link} to={place.base} fz="sm" c="dimmed">
                  {place.item.label}
                </Anchor>
              )}
              {place.detail !== undefined && (
                <Text span fz="sm" fw={500} c="var(--mantine-color-text)">
                  {place.detail}
                </Text>
              )}
            </Breadcrumbs>
          )}
          <div className={classes.barMiddle}>
            <DevBadge label={devLabel} />
          </div>
          {makesDrafts && <UnpublishedControl />}
          <AppMenu position="bottom-end" width="max-content">
            <AppMenu.Target>
              <Tooltip label={user.name} opened={nameTipShown}>
                <UnstyledButton
                  aria-label={`Account, ${user.name}`}
                  className={classes.account}
                  {...nameTipTarget}
                >
                  <Group gap="xs" wrap="nowrap">
                    <Text
                      component="div"
                      fz="sm"
                      visibleFrom="xs"
                      className={classes.accountName}
                    >
                      <span ref={nameWords} className={classes.cutShort}>
                        {user.name}
                      </span>
                    </Text>
                    <Avatar size={30} color="sea" radius="xl">
                      {initials(user.name)}
                    </Avatar>
                  </Group>
                </UnstyledButton>
              </Tooltip>
            </AppMenu.Target>
            <AppMenu.Dropdown miw={200} maw="calc(100vw - 2rem)">
              <Menu.Label>{user.email}</Menu.Label>
              {roles.length > 1 ? (
                <MenuChoices
                  label="Role"
                  choices={roles.map(({ id, name }) => ({
                    value: id,
                    label: name,
                  }))}
                  chosen={role?.id}
                  onChoose={(roleId) => void handleSwitch(roleId)}
                />
              ) : (
                role !== null && <Menu.Label>{role.name}</Menu.Label>
              )}
              <Menu.Divider />
              <Menu.Item
                onClick={() => {
                  setChangingName(true);
                }}
              >
                Change name…
              </Menu.Item>
              <Menu.Item
                onClick={() => {
                  setChangingPassword(true);
                }}
              >
                Change password…
              </Menu.Item>
              <AppearanceChoices />
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
        py="md"
        px={rail ? "xs" : "md"}
        // Hidden off screen on narrow screens until opened, so it must not be reachable either.
        inert={narrow && !opened}
      >
        <Stack gap={24}>
          <Group
            px={rail ? 0 : 8}
            justify={rail ? "center" : "space-between"}
            wrap="nowrap"
            gap={rail ? 10 : 8}
            className={[classes.brandRow, rail ? classes.railBrand : ""].join(
              " ",
            )}
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
          <Sidebar access={{ permissions, dataClasses }} rail={rail} />
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main className={classes.main}>
        {problem !== undefined && (
          <Alert color="red" role="alert" mb="md">
            {problem}
          </Alert>
        )}
        <PageExportProvider person={user.name}>
          <PublishDraftProvider publishes={makesDrafts}>
            <Outlet />
          </PublishDraftProvider>
        </PageExportProvider>
      </AppShell.Main>
      <ChangeNameDialog
        name={user.name}
        opened={changingName}
        onClose={() => {
          setChangingName(false);
        }}
      />
      <ChangePasswordDialog
        rules={passwordRules}
        owner={user}
        opened={changingPassword}
        onClose={() => {
          setChangingPassword(false);
        }}
      />
    </AppShell>
  );
}
