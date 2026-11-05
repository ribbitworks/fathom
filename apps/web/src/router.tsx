// SPDX-License-Identifier: Apache-2.0

// Fathom's pages and how to reach them. Every page but the sign-in page needs a signed-in user;
// anyone else is sent to sign in, then brought back. An address that names no page, or a server
// that cannot be reached, gets a page that says so.

import type { QueryClient } from "@tanstack/react-query";
import {
  historySearchLength,
  type Permission,
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
import { z } from "zod";
import { AccountsPage } from "./accounts-page.tsx";
import { DraftsHelpPage, RolesHelpPage } from "./help-page.tsx";
import { ChangeHistoryPage } from "./change-history-page.tsx";
import { DraftsPage } from "./drafts-page.tsx";
import { HistoryPage } from "./history-page.tsx";
import { Home } from "./home.tsx";
import { firstPage, Layout } from "./layout.tsx";
import { ListsPage } from "./lists-page.tsx";
import { PeoplePage } from "./people-page.tsx";
import { PageNotFound, ServerProblem } from "./problems.tsx";
import { sessionQuery } from "./session.ts";
import { SignIn } from "./sign-in.tsx";
import { viewProps, viewSearchSchema } from "./table-view.ts";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  notFoundComponent: PageNotFound,
});

// The signed-in user and their permissions, as the signed-in routes check them below.
const signedIn = getRouteApi("/signed-in");
const people = getRouteApi("/signed-in/people");

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
    return {
      user: session.user,
      roles: session.roles,
      permissions: session.permissions,
    };
  },
  component: function SignedIn() {
    const { user, permissions } = signedIn.useRouteContext();
    return <Layout user={user} permissions={permissions} />;
  },
});

// The Overview, for those who may see the plan. Anyone else is sent to the first page their roles
// let them open, or, with none, to Help's Roles page.
const homeRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    if (context.permissions.includes("plan:view")) return;
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
  beforeLoad: requiring("accounts:manage"),
  component: function Accounts() {
    return <AccountsPage user={signedIn.useRouteContext().user} />;
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
// approve and reject them here.
const draftsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/drafts",
  validateSearch: historySearch,
  beforeLoad: requiring("people:view", "configuration:view"),
  component: function Drafts() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = draftsRoute.useNavigate();
    return (
      <DraftsPage
        canApprove={permissions.includes("drafts:approve")}
        seesPeople={permissions.includes("people:view")}
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
  }),
  beforeLoad: requiring("configuration:view"),
  component: function Lists() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = listsRoute.useNavigate();
    const { show, search } = listsRoute.useSearch();
    return (
      <ListsPage
        listId={listsRoute.useParams().listId}
        canEdit={permissions.includes("configuration:edit")}
        canApprove={permissions.includes("drafts:approve")}
        seesPeople={permissions.includes("people:view")}
        show={show ?? "both"}
        search={search ?? ""}
        onShow={(next) => {
          void navigate({
            search: { show: next === "both" ? undefined : next, search },
            replace: true,
          });
        }}
        onSearch={(next, replace) => {
          void navigate({
            search: { show, search: next === "" ? undefined : next },
            replace,
          });
        }}
      />
    );
  },
});

const peopleRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/people",
  validateSearch: viewSearchSchema,
  beforeLoad: requiring("people:view"),
  component: function People() {
    const { permissions } = signedIn.useRouteContext();
    const navigate = people.useNavigate();
    return (
      <PeoplePage
        canEdit={permissions.includes("people:edit")}
        canApprove={permissions.includes("drafts:approve")}
        canEditColumns={permissions.includes("configuration:edit")}
        showDates={permissions.includes("restricted:view")}
        {...viewProps(people.useSearch(), (search, replace) => {
          void navigate({ search, replace });
        })}
      />
    );
  },
});

// What each role allows, open to every signed-in user, whatever their roles.
const helpRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/help/roles",
  component: function RolesHelp() {
    return <RolesHelpPage roles={signedIn.useRouteContext().roles} />;
  },
});

// Open to every signed-in user, whatever their roles.
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
    historyRoute,
    changesRoute,
    listsRoute,
    peopleRoute,
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
