// SPDX-License-Identifier: Apache-2.0

// Requests between a UI test's page and the server: those a test sends straight from the page, such
// as to discard what it drafted, and those the page sends to save a change.

import type { Page } from "@playwright/test";

// A request sent from the page, signed in as it is, answering whether it was done and its body.
export const send = (page: Page, method: string, path: string, body?: object) =>
  page.evaluate(
    async ({ method, path, body }) => {
      // The server refuses a JSON content type with no body, as a DELETE has.
      const response = await fetch(path, {
        method,
        ...(body === undefined
          ? {}
          : {
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }),
      });
      return { ok: response.ok, body: await response.json() };
    },
    { method, path, body },
  );

// The start of the path a page saves the view it shows to, as the account's last view.
export const lastViewPaths = "/api/last-views/";

// The changes the page sends to be saved, from when it starts watching, as method and path. Saving
// the view shown isn't one: a page does it a second after the view changes, on a busy computer even
// within a test.
export function changesSent(page: Page): string[] {
  const changes: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() !== "GET" &&
      path.startsWith("/api/") &&
      !path.startsWith(lastViewPaths)
    )
      changes.push(`${request.method()} ${path}`);
  });
  return changes;
}
