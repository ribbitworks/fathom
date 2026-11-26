// SPDX-License-Identifier: Apache-2.0

// Helpers for side panels' tests: a window whose width may turn narrow, and panels laid out beside
// some content.

import { MantineProvider } from "@mantine/core";
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { type SidePanel, WithSidePanel } from "./side-panel.tsx";
import { testTheme } from "./test-support.tsx";

// The window's width, narrow or not, told to whatever listens for it to change.
let narrow = false;
const listeners = new Set<(event: { matches: boolean }) => void>();
const narrowQuery = "(max-width: 48em)";

// Mocks the window's width for the tests of the file calling it, wide until narrowed.
export function withWindowWidth() {
  beforeEach(() => {
    narrow = false;
    listeners.clear();
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          get matches() {
            return query === narrowQuery && narrow;
          },
          media: query,
          onchange: null,
          addEventListener: (
            _type: string,
            listener: (event: { matches: boolean }) => void,
          ) => {
            if (query === narrowQuery) listeners.add(listener);
          },
          removeEventListener: (
            _type: string,
            listener: (event: { matches: boolean }) => void,
          ) => {
            listeners.delete(listener);
          },
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
}

export const narrowTo = (narrowed: boolean) => {
  narrow = narrowed;
  act(() => {
    for (const listener of listeners) listener({ matches: narrowed });
  });
};

export const layout = (panels: SidePanel[]) => (
  <MantineProvider theme={testTheme}>
    <WithSidePanel panels={panels} storageKey="fathom-test-panel-width">
      <p>Content</p>
    </WithSidePanel>
  </MantineProvider>
);

export const one = (text: string, key = "one"): SidePanel => ({
  key,
  id: key,
  name: key,
  node: <p id={key}>{text}</p>,
});

// The simulated browser has no animation events, so React listens for the older, prefixed name.
export const slideEnds = (element: Element) =>
  fireEvent(element, new Event("webkitAnimationEnd", { bubbles: true }));

export const layoutOf = (element: Element) =>
  element.closest("[data-side-panel]")?.parentElement as HTMLElement;

export const sliding = (element: Element) =>
  /sliding/u.test(
    (element.closest("[data-side-panel]") as HTMLElement).className,
  );

export const place = () =>
  screen.getByText("Panel").closest("[data-side-panel]") as HTMLElement;
