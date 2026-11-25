// SPDX-License-Identifier: Apache-2.0

// Tests for links to records by their keys, with the server's answers simulated: a link to a record
// found gives way to the page of each kind of record, with the record open, so Back skips the link;
// a link finding nothing, or a record removed, says so; and a link that names no key asks the
// server nothing.

import type { RecordKeyKind, RecordLookup } from "@fathom/shared";
import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const recordId = "40000000-0000-4000-8000-000000000001";
const otherId = "40000000-0000-4000-8000-000000000002";

const lookup = (answer: RecordLookup) => () => Response.json(answer);

const found = (kind: RecordKeyKind, more = {}) =>
  lookup({ result: "found", kind, id: recordId, ...more });

const peopleAnswer = () =>
  Response.json({
    people: [
      {
        id: recordId,
        keyNumber: 3,
        preferredName: "Quinn Fictional",
        employeeId: "FX-301",
        positionId: "position-1",
        values: {},
      },
    ],
    fields: [],
    order: [],
  });

// Follows a link from the home page, as a reader would, giving the browser's history and the
// requests the page sent.
async function follow(
  link: string,
  answers: Parameters<typeof serverAnswers>[0],
) {
  const fetch = serverAnswers({
    "GET /api/session": () =>
      Response.json({ ...fictionalUser, permissions: ["plan:view"] }),
    "GET /api/greeting": greeting,
    ...answers,
  });
  const history = renderApp("/");
  await screen.findByText("Hello, Fathom");
  act(() => {
    history.push(link);
  });
  return { history, fetch };
}

describe("a link to a record found", () => {
  it.each([
    ["feature", "/features", `?open=${recordId}`],
    ["project", "/projects", `?open=${recordId}`],
    ["proposal", "/projects", `?tab=proposals&open=${recordId}`],
    ["customer", "/projects", `?tab=customers&open=${recordId}`],
    ["milestone", "/projects", `?tab=milestones&open=${recordId}`],
    ["schedule", "/releases", `?tab=schedules&open=${recordId}`],
    ["release", "/releases", `?open=${recordId}`],
    ["team", "/org-chart", `?teams=feature&featureTeam=${recordId}`],
    ["list", `/lists/${recordId}`, ""],
    ["account", "/accounts", `?open=${recordId}`],
    ["role", "/roles", `?open=${recordId}`],
  ] as const)(
    "opens a %s on its page, with its details open",
    async (kind, pathname, search) => {
      const { history } = await follow(`/go/${kind}/2`, {
        [`GET /api/go/${kind}/2`]: found(kind),
      });
      await waitFor(() => {
        expect(history.location.pathname).toBe(pathname);
      });
      expect(history.location.search).toBe(search);
    },
  );

  it("gives way to the record's page, so Back returns to the page the link was followed from", async () => {
    const { history } = await follow("/go/feature/2", {
      "GET /api/go/feature/2": found("feature"),
    });
    await waitFor(() => {
      expect(history.location.pathname).toBe("/features");
    });
    act(() => {
      history.back();
    });
    await waitFor(() => {
      expect(history.location.pathname).toBe("/");
    });
  });

  it("reads a key typed in any letter case, with or without the #", async () => {
    const { history } = await follow("/go/%23Feature-2", {
      "GET /api/go/feature/2": found("feature"),
    });
    await waitFor(() => {
      expect(history.location.pathname).toBe("/features");
    });
  });

  it.each(["person", "hire"] as const)(
    "opens a %s's details on People by their Employee ID",
    async (kind) => {
      const { history } = await follow(`/go/${kind}/3`, {
        [`GET /api/go/${kind}/3`]: found(kind),
        "GET /api/people": peopleAnswer,
      });
      await waitFor(() => {
        expect(history.location.pathname).toBe("/people");
      });
      expect(history.location.search).toBe("?open=FX-301");
    },
  );

  it("opens People alone for someone People doesn't list", async () => {
    const { history } = await follow("/go/person/3", {
      "GET /api/go/person/3": lookup({
        result: "found",
        kind: "person",
        id: otherId,
      }),
      "GET /api/people": peopleAnswer,
    });
    await waitFor(() => {
      expect(history.location.pathname).toBe("/people");
    });
    expect(history.location.search).toBe("");
  });

  it.each([
    ["features", "/features"],
    ["people", "/people"],
  ] as const)(
    "opens an added column on the %s table it is on",
    async (table, pathname) => {
      const { history } = await follow("/go/column/4", {
        "GET /api/go/column/4": found("column", { table }),
      });
      await waitFor(() => {
        expect(history.location.pathname).toBe(pathname);
      });
    },
  );
});

describe("a link to no record", () => {
  it("says nothing was found, the same whether no record has the key or the reader may not see it", async () => {
    await follow("/go/feature/9", {
      "GET /api/go/feature/9": lookup({ result: "nothing" }),
    });
    expect(
      await screen.findByRole("heading", {
        name: "Nothing found for #FEATURE-9",
      }),
    ).toBeDefined();
    expect(
      screen.queryByRole("link", { name: "Show change history" }),
    ).toBeNull();
  });

  it("says a record was removed, linking to the change history", async () => {
    const { history } = await follow("/go/FEATURE-9", {
      "GET /api/go/feature/9": lookup({
        result: "removed",
        kind: "feature",
        id: recordId,
      }),
    });
    expect(
      await screen.findByRole("heading", { name: "#FEATURE-9 was removed" }),
    ).toBeDefined();
    act(() => {
      screen.getByRole("link", { name: "Show change history" }).click();
    });
    await waitFor(() => {
      expect(history.location.pathname).toBe("/changes");
    });
  });

  it.each([
    ["/go/nonsense", "Nothing found for nonsense"],
    ["/go/feature/first", "Nothing found for #FEATURE-first"],
  ])(
    "says nothing was found for %s, which names no key, without asking the server",
    async (link, shown) => {
      const { fetch } = await follow(link, {});
      expect(await screen.findByText(shown)).toBeDefined();
      expect(fetch.mock.calls.some(([url]) => url.startsWith("/api/go/"))).toBe(
        false,
      );
    },
  );
});

describe("a link whose lookup fails", () => {
  it("shows the server problem page rather than a blank one", async () => {
    await follow("/go/feature/9", {
      "GET /api/go/feature/9": () =>
        Response.json({ error: "Down" }, { status: 500 }),
    });
    expect(
      await screen.findByText("Fathom could not reach its server."),
    ).toBeDefined();
  });
});
