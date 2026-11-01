// SPDX-License-Identifier: Apache-2.0

// Prepares the simulated browser the front-end tests run in: browser features Mantine and the router
// rely on that it lacks, how long tests wait for the page, and removing each test's page and
// notifications afterwards.

import { notifications } from "@mantine/notifications";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// How long a test waits for something to appear, such as a menu that fades in. A wait ends as soon
// as it appears, so a long limit slows no test that passes; it keeps a busy computer from failing
// one. The default second is far too short for that.
configure({ asyncUtilTimeout: 10_000 });

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
