// SPDX-License-Identifier: Apache-2.0

// The test every UI test runs in: Playwright's, with each browser context kept from saving the view
// its pages show as the account's last view on the server, so each test opens a page on its default.

import { type BrowserContext, test as playwrightTest } from "@playwright/test";
import { lastViewPaths } from "./test-requests.ts";

const noContent = 204;

// A page saves its view a second after the view last changes, so whether a test leaves one behind
// for the next test on the same account depends on how fast the computer runs it.
export const keepViewsInBrowser = (context: BrowserContext) =>
  context.route(`**${lastViewPaths}*`, (route) =>
    route.fulfill({ status: noContent }),
  );

export const test = playwrightTest.extend({
  context: async ({ context }, use) => {
    await keepViewsInBrowser(context);
    await use(context);
  },
});

export { expect } from "@playwright/test";
