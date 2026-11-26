// SPDX-License-Identifier: Apache-2.0

// Requests the UI tests send to the server straight from the page, such as to discard what a test
// drafted.

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
