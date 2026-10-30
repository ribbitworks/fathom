// SPDX-License-Identifier: Apache-2.0

// Starts Fathom's front end in the browser.

import "@mantine/core/styles.css";
import { QueryClient } from "@tanstack/react-query";
import { createBrowserHistory } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { shouldRetry } from "./api.ts";
import { App } from "./app.tsx";

const root = document.getElementById("root");
if (root === null) throw new Error("The page has no root element");

createRoot(root).render(
  <StrictMode>
    <App
      queryClient={
        new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } })
      }
      history={createBrowserHistory()}
    />
  </StrictMode>,
);
