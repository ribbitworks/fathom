// SPDX-License-Identifier: Apache-2.0

// Fathom's front end: its theme, the data it has loaded, and its pages. When the server refuses a
// request, whether to load or change data, because the session has ended, everything loaded is
// forgotten and the user is sent to sign in, then brought back.

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cssVariables, theme } from "./theme.ts";
import { isSignedOut } from "./api.ts";
import { createAppRouter } from "./router.tsx";

export function App({
  queryClient,
  history,
}: {
  queryClient: QueryClient;
  // The browser's address, or, in tests, a page of their choosing.
  history: RouterHistory;
}) {
  const [router] = useState(() => createAppRouter(queryClient, history));
  // Both loading data and changing it can find the session has ended.
  useEffect(() => {
    const onFailure = (event: {
      type: string;
      action?: { type: string; error?: unknown };
    }) => {
      if (
        event.type === "updated" &&
        event.action?.type === "error" &&
        isSignedOut(event.action.error)
      ) {
        queryClient.clear();
        void router.invalidate();
      }
    };
    const stopQueries = queryClient.getQueryCache().subscribe(onFailure);
    const stopMutations = queryClient.getMutationCache().subscribe(onFailure);
    return () => {
      stopQueries();
      stopMutations();
    };
  }, [queryClient, router]);
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariables}
      defaultColorScheme="auto"
    >
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>
  );
}
