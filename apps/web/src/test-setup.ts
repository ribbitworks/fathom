// SPDX-License-Identifier: Apache-2.0

// Prepares the simulated browser the front-end tests run in: browser features Mantine and the router
// rely on that it lacks, and removing each test's page and notifications afterwards.

import { notifications } from "@mantine/notifications";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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
