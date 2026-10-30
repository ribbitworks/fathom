// SPDX-License-Identifier: Apache-2.0

// Fathom's pages and how to reach them. Every page but the sign-in page needs a signed-in user;
// anyone else is sent to sign in, then brought back. An address that names no page, or a server
// that cannot be reached, gets a page that says so.

import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  type RouterHistory,
  redirect,
} from "@tanstack/react-router";
import { z } from "zod";
import { AccountsPage } from "./accounts-page.tsx";
import { ChangePassword } from "./change-password.tsx";
import { Home } from "./home.tsx";
import { Layout } from "./layout.tsx";
import { PageNotFound, ServerProblem } from "./problems.tsx";
import { sessionQuery } from "./session.ts";
import { SignIn } from "./sign-in.tsx";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  notFoundComponent: PageNotFound,
});

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
    const { user, permissions } = signedInRoute.useRouteContext();
    return <Layout user={user} permissions={permissions} />;
  },
});

const homeRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/",
  component: Home,
});

// Only for users who may manage accounts; anyone else is told the page is not theirs to see.
const accountsRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/accounts",
  component: function Accounts() {
    const { user, permissions } = signedInRoute.useRouteContext();
    return permissions.includes("accounts:manage") ? (
      <AccountsPage user={user} />
    ) : (
      <PageNotFound />
    );
  },
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
  signedInRoute.addChildren([homeRoute, accountsRoute, changePasswordRoute]),
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
