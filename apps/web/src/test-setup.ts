// SPDX-License-Identifier: Apache-2.0

// Prepares the simulated browser the front-end tests run in: browser features Mantine and the router
// rely on that it lacks, how long tests wait for the page, and removing each test's page and
// notifications afterwards.

import { notifications } from "@mantine/notifications";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// How long a test waits for something to appear, such as a menu or a tooltip that fades in. The
// default second is too short while every test suite runs at once, as `pnpm check` runs them.
configure({ asyncUtilTimeout: 3000 });

if (typeof window !== "undefined") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
  window.scrollTo = () => undefined;
  // Choice pickers scroll the highlighted choice into view.
  Element.prototype.scrollIntoView = () => undefined;
  // Text areas that grow with their text wait for fonts to load.
  Object.defineProperty(document, "fonts", {
    value: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      ready: Promise.resolve(),
    },
  });
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
  // Notifications are kept outside the page, so each test starts without any.
  notifications.clean();
  notifications.cleanQueue();
});
