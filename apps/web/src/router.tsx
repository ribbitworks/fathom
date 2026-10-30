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
    const user = await context.queryClient.query(sessionQuery);
    if (user === null) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to redirect
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    return { user };
  },
  component: function SignedIn() {
    return <Layout user={signedInRoute.useRouteContext().user} />;
  },
});

const homeRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: "/",
  component: Home,
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
  signedInRoute.addChildren([homeRoute]),
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
