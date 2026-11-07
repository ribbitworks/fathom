// SPDX-License-Identifier: Apache-2.0

// Helpers for the front-end tests: a simulated server that answers each request the test expects, a
// fictional signed-in user, fictional release streams, and Fathom's front end started on a page of
// the test's choosing.

import type {
  Cycle,
  CyclePattern,
  RecordDraft,
  Release,
  ReleaseStream,
} from "@fathom/shared";
import { defaultPasswordSettings } from "@fathom/shared";
import { mergeThemeOverrides } from "@mantine/core";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { App } from "./app.tsx";
import { theme } from "./theme.ts";

type Answer = Response | Promise<Response>;

// Simulates the server: each request is answered by the first matching answer, and recorded.
export function serverAnswers(answers: Record<string, () => Answer>) {
  const byRequest = new Map(Object.entries(answers));
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const answer = byRequest.get(key);
    if (answer === undefined) throw new Error(`No answer for ${key}`);
    return Promise.resolve(answer());
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

export const fictionalUser = {
  user: {
    id: "user-1",
    name: "Fictional Person",
    email: "person@example.test",
  },
  role: {
    id: "00000000-0000-4000-8000-0000000000a1",
    key: "team-member",
    name: "Team Member",
    description: "Sees the plan, including everyone's work assignments.",
  },
  permissions: ["plan:view"],
  mustChangePassword: false,
  settings: {
    timeZone: "America/Vancouver",
    passwords: defaultPasswordSettings,
  },
};
export const signedIn = () => Response.json(fictionalUser);
export const signedOut = () =>
  Response.json({ error: "Unauthorized" }, { status: 401 });
export const greeting = () => Response.json({ greeting: "Hello, Fathom" });

export function renderApp(path: string) {
  // Failed requests are not retried, so each test sees the server's first answer.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({ initialEntries: [path] });
  render(<App queryClient={queryClient} history={history} theme={testTheme} />);
  return history;
}

// The simulated browser has no layout, so everything seems off screen, and a tooltip or menu would
// hide itself once placed, sometimes before the test looked.
export const testTheme = mergeThemeOverrides(theme, {
  components: {
    Tooltip: { defaultProps: { hideDetached: false } },
    Popover: { defaultProps: { hideDetached: false } },
  },
});

// Finds the element whose whole text matches, though parts of it, such as the values a change
// names, are marked in elements of their own.
export const wholeText =
  (expected: string | RegExp) =>
  (_content: string, element: Element | null): boolean => {
    const matches = (found: Element) =>
      typeof expected === "string"
        ? found.textContent === expected
        : expected.test(found.textContent);
    return (
      element !== null &&
      matches(element) &&
      ![...element.children].some((child) => matches(child))
    );
  };

// A fictional release stream, cycle pattern, release, and draft of one of them, with ids as the
// server gives them, for each test to override what it needs.
export const streamId = "10000000-0000-4000-8000-000000000001";

export const recordDraft = (
  fields: Partial<RecordDraft> = {},
): RecordDraft => ({
  action: "changed",
  changed: [],
  live: {},
  uses: [],
  state: "waiting",
  madeBy: "Fictional Editor",
  madeAt: "2026-10-30T15:00:00.000Z",
  ...fields,
});

export const fictionalPattern = (
  fields: Partial<CyclePattern> = {},
): CyclePattern => ({
  id: "20000000-0000-4000-8000-000000000001",
  startsOn: "2027-01-01",
  length: 3,
  unit: "months",
  naming: "{YY}.{N}",
  ...fields,
});

export const fictionalRelease = (fields: Partial<Release> = {}): Release => ({
  id: "30000000-0000-4000-8000-000000000001",
  name: "Fictional One",
  firstCycle: "2027-01-01",
  lastCycle: "2027-01-01",
  shipsOn: null,
  colour: null,
  note: null,
  ...fields,
});

// Cycles of three months from 2027-01-01, named 27.1 to 27.4 and so on.
export const quarters = (count: number): Cycle[] =>
  Array.from({ length: count }, (_, at) => {
    const year = 2027 + Math.floor(at / 4);
    const quarter = at % 4;
    const month = (offset: number) =>
      `${String(year)}-${String(quarter * 3 + offset + 1).padStart(2, "0")}`;
    // Day 0 of the month after the quarter is the quarter's last day.
    const endsOn = new Date(Date.UTC(year, quarter * 3 + 3, 0))
      .toISOString()
      .slice(0, 10);
    return {
      startsOn: `${month(0)}-01`,
      endsOn,
      name: `${String(year).slice(2)}.${String(quarter + 1)}`,
      months: [0, 1, 2].map((offset) => ({ month: month(offset), share: 1 })),
    };
  });

export const fictionalStream = (
  fields: Partial<ReleaseStream> = {},
): ReleaseStream => ({
  id: streamId,
  name: "Fictional Majors",
  retired: false,
  cyclesUntil: "2027-12-31",
  patterns: [fictionalPattern()],
  cycles: quarters(4),
  releases: [],
  ...fields,
});
