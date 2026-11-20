// SPDX-License-Identifier: Apache-2.0

// Tests for the view a page last showed: what is kept of it, the address a page opens on, and the
// hook that keeps it.

import { historySearchLength, type LastView } from "@fathom/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isKept,
  lastViewAddress,
  lastViewsQuery,
  namesNoView,
  requestFor,
  type Shown,
  useLastView,
} from "./last-views.ts";
import { emptyView, type View } from "./table-view.ts";
import { bodyOf, serverAnswers } from "./test-support.tsx";

const savedId = "20000000-0000-4000-8000-000000000001";
const sorted: View = {
  ...emptyView,
  sort: [{ key: "name", descending: true }],
};
const peopleShown = (more: Partial<Shown> = {}): Shown => ({
  table: "people",
  view: emptyView,
  applied: undefined,
  ...more,
});

describe("what is kept of a page's view", () => {
  it("keeps the view as a saved view does, with the saved view and the page's mode", () => {
    expect(
      requestFor({
        table: "features",
        view: { ...sorted, choices: { hide: ["status"] } },
        applied: savedId,
        mode: "board",
      }),
    ).toEqual({
      table: "features",
      definition: { sort: ["-name"], choices: { hide: ["status"] } },
      view: savedId,
      mode: "board",
    });
  });

  it("keeps only the table of a view that sets nothing", () => {
    expect(requestFor(peopleShown())).toEqual({
      table: "people",
      definition: {},
    });
  });
});

describe("whether an address names no view", () => {
  it.each([
    ["a view", peopleShown({ view: sorted })],
    ["a saved view", peopleShown({ applied: savedId })],
    ["a mode", peopleShown({ mode: "board" })],
  ])("is false when it names %s", (_, shown) => {
    expect(namesNoView(shown)).toBe(false);
  });

  it("is true for the page's default", () => {
    expect(namesNoView(peopleShown())).toBe(true);
  });
});

describe("the address a page opens on", () => {
  const last: LastView = {
    table: "proposals",
    definition: { sort: ["-name"], choices: { hide: ["status"] } },
    view: savedId,
    mode: "board",
  };
  const proposals = {
    table: "proposals",
    address: {
      sort: ["-name"],
      hide: ["status"],
      view: savedId,
      mode: "board",
    },
  };

  it("is the last view's, each choice under its own name, on its own tab or the page's first", () => {
    expect([
      lastViewAddress({ ...peopleShown(), table: "proposals" }, last),
      lastViewAddress({ ...peopleShown(), table: "projects" }, last),
    ]).toEqual([proposals, proposals]);
  });

  it("is none on another tab the address names, with a view named, or with nothing kept", () => {
    expect([
      lastViewAddress({ ...peopleShown(), table: "customers" }, last),
      lastViewAddress(
        { ...peopleShown({ view: sorted }), table: "proposals" },
        last,
      ),
      lastViewAddress(peopleShown(), undefined),
    ]).toEqual([undefined, undefined, undefined]);
  });

  it("is the tab alone of a cleared view on another tab, and none once that tab is shown", () => {
    const cleared: LastView = { table: "proposals", definition: {} };
    expect([
      lastViewAddress({ ...peopleShown(), table: "projects" }, cleared),
      lastViewAddress({ ...peopleShown(), table: "proposals" }, cleared),
      lastViewAddress(peopleShown(), { table: "people", definition: {} }),
    ]).toEqual([{ table: "proposals", address: {} }, undefined, undefined]);
  });
});

describe("whether a view is the one kept", () => {
  const kept: LastView = { table: "people", definition: { sort: ["-name"] } };

  it("is true for the same view, however its parts are ordered", () => {
    expect(isKept(peopleShown({ view: sorted }), kept)).toBe(true);
  });

  it.each([
    ["another view", peopleShown()],
    ["a saved view applied", peopleShown({ view: sorted, applied: savedId })],
    ["a mode", peopleShown({ view: sorted, mode: "board" })],
    ["another table", { ...peopleShown({ view: sorted }), table: "drafts" }],
  ] as const)("is false for %s", (_, shown) => {
    expect(isKept(shown, kept)).toBe(false);
  });

  it("is false with nothing kept", () => {
    expect(isKept(peopleShown(), undefined)).toBe(false);
  });
});

describe("keeping a page's view", () => {
  const every = "/api/last-views";
  const path = `${every}/people`;
  const kept = { table: "people", definition: { sort: ["-name"] } };
  const keepsIt = () => new Response(null, { status: 204 });
  const keep = async (client: QueryClient, first: Shown) => {
    const hook = renderHook(
      ({ shown }: { shown: Shown }) => {
        useLastView(shown);
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
        initialProps: { shown: first },
      },
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    return hook;
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends nothing for a page opened on the view kept, or on its default with nothing kept", async () => {
    const fetch = serverAnswers({
      [`GET ${every}`]: () => Response.json({ people: kept }),
      [`PUT ${path}`]: keepsIt,
    });
    await keep(new QueryClient(), peopleShown({ view: sorted }));
    serverAnswers({ [`GET ${every}`]: () => Response.json({}) });
    await keep(new QueryClient(), peopleShown());

    expect(bodyOf(fetch, "PUT", path)).toEqual([]);
  });

  it("keeps another tab on its default, with nothing kept, so the page opens on that tab again", async () => {
    // Given nothing kept for Capacity
    const fetch = serverAnswers({
      [`GET ${every}`]: () => Response.json({}),
      [`PUT ${every}/capacity`]: keepsIt,
    });

    // When its Allocations tab, not its first, shows its default view
    await keep(new QueryClient(), peopleShown({ table: "capacity" }));

    // Then that tab is kept
    expect(bodyOf(fetch, "PUT", `${every}/capacity`)).toEqual([
      { table: "capacity", definition: {} },
    ]);
  });

  it("keeps a view a link names in place of the one kept", async () => {
    const fetch = serverAnswers({
      [`GET ${every}`]: () =>
        Response.json({ people: { table: "people", definition: {} } }),
      [`PUT ${path}`]: keepsIt,
    });

    await keep(new QueryClient(), peopleShown({ view: sorted }));

    expect(bodyOf(fetch, "PUT", path)).toEqual([kept]);
  });

  it("keeps the view once a moment after the last of several changes, and the cleared view after it", async () => {
    // Given a page that opened with nothing kept
    const fetch = serverAnswers({
      [`GET ${every}`]: () => Response.json({}),
      [`PUT ${path}`]: keepsIt,
    });
    const { rerender } = await keep(new QueryClient(), peopleShown());

    // When the search is typed, then the view cleared
    for (const search of ["F", "Fi", "Fic"]) {
      rerender({ shown: peopleShown({ view: { ...emptyView, search } }) });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
    }
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    rerender({ shown: peopleShown() });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Then the last search is kept once, and the cleared view after it
    expect(bodyOf(fetch, "PUT", path)).toEqual([
      { table: "people", definition: { search: "Fic" } },
      { table: "people", definition: {} },
    ]);
  });

  it("changes the copy read as it keeps a view, so the views are read only once", async () => {
    const fetch = serverAnswers({
      [`GET ${every}`]: () => Response.json({}),
      [`PUT ${path}`]: keepsIt,
    });
    const client = new QueryClient();

    await keep(client, peopleShown({ view: sorted }));
    await keep(client, peopleShown({ view: sorted }));

    expect([
      client.getQueryData(lastViewsQuery.queryKey),
      fetch.mock.calls.filter(([url]) => url === every).length,
      bodyOf(fetch, "PUT", path),
    ]).toEqual([{ people: kept }, 1, [kept]]);
  });

  it("keeps a change made just before the page is left", async () => {
    const fetch = serverAnswers({
      [`GET ${every}`]: () => Response.json({}),
      [`PUT ${path}`]: keepsIt,
    });
    const { rerender, unmount } = await keep(new QueryClient(), peopleShown());

    rerender({ shown: peopleShown({ view: sorted }) });
    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(bodyOf(fetch, "PUT", path)).toEqual([kept]);
  });

  it("keeps nothing more when a change is undone before it is kept", async () => {
    const fetch = serverAnswers({
      [`GET ${every}`]: () => Response.json({}),
      [`PUT ${path}`]: keepsIt,
    });
    const { rerender, unmount } = await keep(new QueryClient(), peopleShown());

    rerender({ shown: peopleShown({ view: sorted }) });
    rerender({ shown: peopleShown() });
    unmount();
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(bodyOf(fetch, "PUT", path)).toEqual([]);
  });

  it("keeps a view once when React mounts the page twice", async () => {
    const fetch = serverAnswers({
      [`GET ${every}`]: () => Response.json({}),
      [`PUT ${path}`]: keepsIt,
    });
    const client = new QueryClient();
    await client.query(lastViewsQuery);
    renderHook(
      () => {
        useLastView(peopleShown({ view: sorted }));
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <StrictMode>
            <QueryClientProvider client={client}>
              {children}
            </QueryClientProvider>
          </StrictMode>
        ),
      },
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(bodyOf(fetch, "PUT", path)).toEqual([kept]);
  });

  it("keeps no view the server would refuse", async () => {
    const fetch = serverAnswers({
      [`GET ${every}`]: () => Response.json({}),
      [`PUT ${path}`]: keepsIt,
    });
    const search = "x".repeat(historySearchLength + 1);

    await keep(
      new QueryClient(),
      peopleShown({ view: { ...emptyView, search } }),
    );

    expect(bodyOf(fetch, "PUT", path)).toEqual([]);
  });

  it("leaves a failure to keep it unsaid", async () => {
    serverAnswers({
      [`GET ${every}`]: () => Response.json({}),
      [`PUT ${path}`]: () => new Response(null, { status: 500 }),
    });

    await expect(
      keep(new QueryClient(), peopleShown({ view: sorted })),
    ).resolves.toBeDefined();
  });
});
