// SPDX-License-Identifier: Apache-2.0

// Tests for Fathom's page, with the server's responses simulated: the greeting once it loads, a
// loading message until then, and a plain message when the server cannot be reached.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app.tsx";

function renderApp() {
  // Failed requests are not retried, so each test sees the server's first answer.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

function serverAnswers(response: Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response)),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("page", () => {
  it("shows the greeting from the server", async () => {
    serverAnswers(Response.json({ greeting: "Hello, Fathom" }));
    renderApp();
    expect(await screen.findByText("Hello, Fathom")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Fathom" })).toBeDefined();
  });

  it("shows a loading message until the server answers", () => {
    serverAnswers(new Promise<Response>(() => undefined));
    renderApp();
    expect(screen.getByRole("status").textContent).toBe("Loading…");
  });

  it("shows a plain message when the server fails", async () => {
    serverAnswers(
      Response.json({ error: "Internal Server Error" }, { status: 500 }),
    );
    renderApp();
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not reach its server/,
    );
  });
});
