// SPDX-License-Identifier: Apache-2.0

// Helpers for the front-end tests: a simulated server that answers each request the test expects,
// a fictional signed-in user, and Fathom's front end started on a page of the test's choosing.

import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { App } from "./app.tsx";

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
  roles: ["viewer"],
  permissions: ["plan:view"],
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
  render(<App queryClient={queryClient} history={history} />);
  return history;
}

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
