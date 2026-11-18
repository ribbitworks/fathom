// SPDX-License-Identifier: Apache-2.0

// Prepares the simulated browser the front-end tests run in: browser features Mantine and the router
// rely on that it lacks, how long tests wait for the page, and removing each test's page cleanly.

import { notifications } from "@mantine/notifications";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// How long a test waits for something to appear, such as a menu that fades in. A wait ends as soon
// as it appears, so a long limit slows no test that passes; it keeps a busy computer from failing
// one. The default second is far too short for that.
configure({ asyncUtilTimeout: 10_000 });

// Taken before any test can put fake timers in its place.
const realSetTimeout = globalThis.setTimeout;

if (typeof window !== "undefined") {
  // Tests run as people who ask for less motion, since the simulated browser runs no animations,
  // so a side panel goes as soon as it closes rather than waiting for its slide to end.
  window.matchMedia = (query: string) =>
    ({
      matches: query === "(prefers-reduced-motion: reduce)",
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
  // The simulated browser lays nothing out, so its page is as wide as its window, with no scroll bar.
  Object.defineProperty(document.documentElement, "clientWidth", {
    get: () => window.innerWidth,
  });
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(async () => {
  cleanup();
  // Notifications are kept outside the page, so each test starts without any.
  notifications.clean();
  notifications.cleanQueue();
  // Some components tidy up on a timer once removed, such as drag and drop's announcer, which would
  // otherwise fire after a file's last test, once the simulated browser is gone.
  await new Promise((resolve) => realSetTimeout(resolve, 0));
});
