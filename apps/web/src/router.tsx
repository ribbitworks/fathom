// SPDX-License-Identifier: Apache-2.0

// Fathom's pages and how to reach them. Every page but the sign-in page needs a signed-in user;
// anyone else is sent to sign in, then brought back. An address that names no page, or a server
// that cannot be reached, gets a page that says so.

import type { QueryClient } from "@tanstack/react-query";
import type { Permission } from "@fathom/shared";
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
import { ChangePassword } from "./change-password.tsx";
import { HistoryPage } from "./history-page.tsx";
import { Home } from "./home.tsx";
import { Layout } from "./layout.tsx";
import { PageNotFound, ServerProblem } from "./problems.tsx";
import { sessionQuery } from "./session.ts";
import { SignIn } from "./sign-in.tsx";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  notFoundComponent: PageNotFound,
});

// The signed-in user and their permissions, as the signed-in routes check them below.
const signedIn = getRouteApi("/signed-in");

// Pages only for users with a permission; anyone else is told there is no such page.
function requiring(permission: Permission) {
  return ({ context }: { context: { permissions: Permission[] } }) => {
    if (!context.permissions.includes(permission)) {
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
    return { user: session.user, permissions: session.permissions };
  },
  component: function SignedIn() {
    const { user, permissions } = signedIn.useRouteContext();
    return <Layout user={user} permissions={permissions} />;
  },
});

const homeRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/",
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

const historyRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/history",
  beforeLoad: requiring("history:view"),
  component: HistoryPage,
});

const changePasswordRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/password",
  component: ChangePassword,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  // A redirect that is not text, as a hand-edited address might have, is ignored.
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
  }),
  component: function SignInPage() {
    return <SignIn redirect={signInRoute.useSearch().redirect} />;
  },
});

const routeTree = rootRoute.addChildren([
  signedInRoute.addChildren([
    homeRoute,
    accountsRoute,
    historyRoute,
    changePasswordRoute,
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
