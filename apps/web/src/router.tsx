// SPDX-License-Identifier: Apache-2.0

// Fathom's pages and how to reach them. Every page but the sign-in page needs a signed-in user;
// anyone else is sent to sign in, then brought back. A user signed in with a password Fathom
// generated sees only the page that changes it, at the start page's address. An address that names
// no page, or a server that cannot be reached, gets a page that says so.

import type { QueryClient } from "@tanstack/react-query";
import {
  approvableKinds,
  historySearchLength,
  type Permission,
  personLengths,
  showSchema,
} from "@fathom/shared";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  getRouteApi,
  notFound,
  type RouterHistory,
  redirect,
} from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { AccountsPage } from "./accounts-page.tsx";
import { FirstPasswordChange } from "./change-password.tsx";
import { DraftsHelpPage, RolesHelpPage } from "./help-page.tsx";
import { ChangeHistoryPage } from "./change-history-page.tsx";
import { DraftsPage } from "./drafts-page.tsx";
import { HistoryPage } from "./history-page.tsx";
import { Home } from "./home.tsx";
import { firstPage, Layout } from "./layout.tsx";
import { ListsPage } from "./lists-page.tsx";
import { listKindSchema } from "./lists.ts";
import { OrgChartPage } from "./org-chart-page.tsx";
import { SettingsPage } from "./settings-page.tsx";
import { setTimeZone } from "./today.ts";
import { ReleasesPage } from "./releases-page.tsx";
import { PeoplePage } from "./people-page.tsx";
import { PageNotFound, ServerProblem } from "./problems.tsx";
import { RolesPage } from "./roles-page.tsx";
import { sessionQuery } from "./session.ts";
import { SignIn } from "./sign-in.tsx";
import { viewProps, viewSearchSchema } from "./table-view.ts";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  notFoundComponent: PageNotFound,
});

// The signed-in user and their permissions, as the signed-in routes check them below.
const signedIn = getRouteApi("/signed-in");
const people = getRouteApi("/signed-in/people");

// The org chart's address: the person found on it, and the manager whose team alone is shown, each
// by Employee ID, or by Fathom's own ID for readers who do not see people, what the Draft menu
// shows, and the person whose details are shown beside it.
const fathomIdLength = 36;
const chartAddressLength = Math.max(personLengths.employeeId, fathomIdLength);
const chartSearch = z.object({
  person: z.string().max(chartAddressLength).optional().catch(undefined),
  team: z.string().max(chartAddressLength).optional().catch(undefined),
  show: showSchema.optional().catch(undefined),
  open: z.string().max(personLengths.employeeId).optional().catch(undefined),
});

// Pages only for users with a permission; anyone else is told there is no such page.
function requiring(...permissions: Permission[]) {
  return ({ context }: { context: { permissions: Permission[] } }) => {
    if (!permissions.some((one) => context.permissions.includes(one))) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to say so
      throw notFound();
    }
  };
}

const signedInRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "signed-in",
  beforeLoad: async ({ context, location }) => {
    // Checked afresh on every change of page, so an expired session is noticed.
    const session = await context.queryClient.query(sessionQuery);
    if (session === null) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    if (session.mustChangePassword && location.pathname !== "/") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
      throw redirect({ to: "/", replace: true });
    }
    // Every page works out today in Fathom's time zone, as the session has it now.
    setTimeZone(session.settings.timeZone);
    return {
      user: session.user,
      role: session.role,
      roles: session.roles,
      permissions: session.permissions,
      mustChangePassword: session.mustChangePassword,
      timeZone: session.settings.timeZone,
      passwords: session.settings.passwords,
    };
  },
  component: function SignedIn() {
    const { user, role, roles, permissions, mustChangePassword, passwords } =
      signedIn.useRouteContext();
    if (mustChangePassword) {
      return <FirstPasswordChange rules={passwords.rules} owner={user} />;
    }
    return (
      <Layout
        user={user}
        role={role}
        roles={roles}
        permissions={permissions}
        passwordRules={passwords.rules}
      />
    );
  },
});

// The Overview, for those who may see the plan. Anyone else is sent to the first page their role
// lets them open, or, with none, to Help's Roles page.
const homeRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    if (context.mustChangePassword || context.permissions.includes("plan:view"))
      return;
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
    throw redirect({
      to: firstPage(context.permissions) ?? "/help/roles",
      replace: true,
    });
  },
  component: Home,
});

const accountsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/accounts",
  beforeLoad: requiring("accounts:view"),
  component: function Accounts() {
    const { user, permissions } = signedIn.useRouteContext();
    return (
      <AccountsPage
        user={user}
        canManage={permissions.includes("accounts:manage")}
        canEditRoles={permissions.includes("roles:edit")}
      />
    );
  },
});

const rolesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/roles",
  beforeLoad: requiring("roles:view"),
  component: function Roles() {
    const { user, permissions } = signedIn.useRouteContext();
    return (
      <RolesPage user={user} canEdit={permissions.includes("roles:edit")} />
    );
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/settings",
  beforeLoad: requiring("settings:view"),
  component: function Settings() {
    const { timeZone, passwords, permissions } = signedIn.useRouteContext();
    return (
      <SettingsPage
        timeZone={timeZone}
        passwords={passwords}
        canEdit={permissions.includes("settings:edit")}
      />
    );
  },
});

// A history page's search, kept in the address; one too long, as a hand-edited address might
// have, is ignored.
const historySearch = z.object({
  search: z.string().max(historySearchLength).optional().catch(undefined),
});

const changesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/changes",
  validateSearch: historySearch,
  beforeLoad: requiring("changes:view"),
  component: function Changes() {
    const navigate = changesRoute.useNavigate();
    return (
      <ChangeHistoryPage
        search={changesRoute.useSearch().search ?? ""}
        onSearch={(search, replace) => {
          void navigate({ search: { search: search || undefined }, replace });
        }}
      />
    );
  },
});

// Drafts, for those who see the data they change, with their search in the address; Approvers
// approve and reject here those of the areas their role approves.
const draftsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/drafts",
  validateSearch: historySearch,
  beforeLoad: requiring("people:view", "configuration:view", "plan:view"),
  component: function Drafts() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = draftsRoute.useNavigate();
    return (
      <DraftsPage
        approves={approvableKinds(permissions)}
        seesPeople={permissions.includes("people:view")}
        seesLists={
          permissions.includes("people:view") ||
          permissions.includes("configuration:view")
        }
        seesPlan={
          permissions.includes("plan:view") ||
          permissions.includes("configuration:view")
        }
        search={draftsRoute.useSearch().search ?? ""}
        onSearch={(search, replace) => {
          void navigate({ search: { search: search || undefined }, replace });
        }}
      />
    );
  },
});

const historyRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/history",
  validateSearch: historySearch,
  beforeLoad: requiring("history:view"),
  component: function AccessHistory() {
    const navigate = historyRoute.useNavigate();
    return (
      <HistoryPage
        search={historyRoute.useSearch().search ?? ""}
        onSearch={(search, replace) => {
          void navigate({ search: { search: search || undefined }, replace });
        }}
      />
    );
  },
});

// The Lists page, with the list in the address, if any, open in its side panel. One route, so
// opening and closing the panel keeps the rest of the page as it was.
const listsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/lists/{-$listId}",
  validateSearch: z.object({
    show: showSchema.optional().catch(undefined),
    search: z.string().max(historySearchLength).optional().catch(undefined),
    kind: listKindSchema.exclude(["all"]).optional().catch(undefined),
  }),
  beforeLoad: requiring("configuration:view"),
  component: function Lists() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = listsRoute.useNavigate();
    const { show, search, kind } = listsRoute.useSearch();
    return (
      <ListsPage
        listId={listsRoute.useParams().listId}
        canEdit={permissions.includes("configuration:edit")}
        approves={approvableKinds(permissions)}
        seesPeople={permissions.includes("people:view")}
        show={show ?? "both"}
        search={search ?? ""}
        kind={kind ?? "all"}
        onShow={(next) => {
          void navigate({
            search: { show: next === "both" ? undefined : next, search, kind },
            replace: true,
          });
        }}
        onSearch={(next, replace) => {
          void navigate({
            search: { show, search: next === "" ? undefined : next, kind },
            replace,
          });
        }}
        onKind={(next) => {
          void navigate({
            search: { show, search, kind: next === "all" ? undefined : next },
            replace: true,
          });
        }}
      />
    );
  },
});

// Release streams, with their cycles and releases, seen with the plan or planning configuration,
// with the stream in the address, if any, open in its side panel.
const releasesRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/releases/{-$streamId}",
  beforeLoad: requiring("plan:view", "configuration:view"),
  component: function Releases() {
    const { permissions } = signedIn.useRouteContext();
    return (
      <ReleasesPage
        streamId={releasesRoute.useParams().streamId}
        approves={approvableKinds(permissions)}
      />
    );
  },
});

// People's address: its view, and the person whose details are shown beside it, by Employee ID.
const peopleSearch = viewSearchSchema.extend({
  open: z.string().max(personLengths.employeeId).optional().catch(undefined),
});

const peopleRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/people",
  validateSearch: peopleSearch,
  beforeLoad: requiring("people:view"),
  component: function People() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = people.useNavigate();
    const { open, ...search } = people.useSearch();
    return (
      <PeoplePage
        canEdit={permissions.includes("people:edit")}
        canEditHires={
          permissions.includes("people:edit") &&
          permissions.includes("hiring-plan:edit")
        }
        approves={approvableKinds(permissions)}
        canEditColumns={permissions.includes("configuration:edit")}
        showDates={permissions.includes("restricted:view")}
        showHireDates={permissions.includes("hiring-plan:view")}
        {...viewProps(search, (next, replace) => {
          void navigate({ search: { ...next, open }, replace });
        })}
        open={open}
        seesChart={permissions.includes("org-chart:view")}
        onOpen={(next, replace = false) => {
          void navigate({ search: { ...search, open: next }, replace });
        }}
      />
    );
  },
});

const orgChartRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/org-chart",
  validateSearch: chartSearch,
  beforeLoad: requiring("org-chart:view"),
  component: function OrgChart() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = orgChartRoute.useNavigate();
    const teamEdits = useMemo(
      () => ({
        names: permissions.includes("people:edit"),
        colours: permissions.includes("team-colours:edit"),
      }),
      [permissions],
    );
    return (
      <OrgChartPage
        seesPeople={permissions.includes("people:view")}
        showDates={permissions.includes("restricted:view")}
        canEdit={permissions.includes("people:edit")}
        teamEdits={teamEdits}
        search={orgChartRoute.useSearch()}
        onSearch={(search, replace) => {
          void navigate({ search, replace });
        }}
      />
    );
  },
});

// What each role allows, open to every signed-in user, whatever their role.
const helpRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/help/roles",
  component: function RolesHelp() {
    return <RolesHelpPage role={signedIn.useRouteContext().role} />;
  },
});

// Open to every signed-in user, whatever their role.
const draftsHelpRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/help/drafts",
  component: DraftsHelpPage,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  // A redirect that is not text, as a hand-edited address might have, is ignored.
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
    idle: z.boolean().optional().catch(undefined),
  }),
  component: function SignInPage() {
    const { redirect, idle } = signInRoute.useSearch();
    return <SignIn redirect={redirect} idle={idle === true} />;
  },
});

const routeTree = rootRoute.addChildren([
  signedInRoute.addChildren([
    homeRoute,
    accountsRoute,
    rolesRoute,
    settingsRoute,
    historyRoute,
    changesRoute,
    listsRoute,
    releasesRoute,
    peopleRoute,
    orgChartRoute,
    draftsRoute,
    helpRoute,
    draftsHelpRoute,
  ]),
  signInRoute,
]);

export function createAppRouter(
  queryClient: QueryClient,
  history: RouterHistory,
) {
  return createRouter({
    routeTree,
    context: { queryClient },
    history,
    defaultErrorComponent: ServerProblem,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
