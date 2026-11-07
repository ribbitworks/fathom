// SPDX-License-Identifier: Apache-2.0

// Starts Fathom's front end in the browser.

// Each weight covers every script the typeface has; the browser fetches only the ones a page uses.
// Mantine's bold text, such as table headings, uses 700.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import { QueryClient } from "@tanstack/react-query";
import { createBrowserHistory } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { shouldRetry } from "./api.ts";
import { App } from "./app.tsx";
import { devLabel, devTitle } from "./dev-label.tsx";

const root = document.getElementById("root");
if (root === null) throw new Error("The page has no root element");
document.title = devTitle(document.title, devLabel);

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
