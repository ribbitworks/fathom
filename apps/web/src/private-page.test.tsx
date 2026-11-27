// SPDX-License-Identifier: Apache-2.0

// Tests for a page under Mine, with the server's responses simulated: Mine in the sidebar, the
// page's table typed in and saved at once with Undo, and a page nobody may read not found.

import type { PrivateRow } from "@fathom/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dueField,
  followUps,
  maker,
  nameField,
  pageAnswers,
  pageId,
  pagePath,
  row,
} from "./test-private-pages.ts";
import {
  changesSent,
  findSidebar,
  fictionalUser,
  recordCell,
  renderApp,
  savedFiles,
  serverAnswers,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const savedPage = (page: ReturnType<typeof followUps>) => () =>
  Response.json({ page, changeSetId: "40000000-0000-4000-8000-000000000001" });

describe("Mine in the sidebar", () => {
  it("lists the maker's pages first, each after the private ring, then New page", async () => {
    // Given a role that may make private pages
    serverAnswers({
      ...pageAnswers(followUps([])),
      "GET /api/private-pages": () =>
        Response.json([
          { id: pageId, name: "Follow-ups", position: 0 },
          {
            id: "20000000-0000-4000-8000-000000000002",
            name: "Customer asks",
            position: 1,
          },
        ]),
    });
    renderApp("/help");

    // Then Mine comes first, holding its pages in order and New page
    const sidebar = await findSidebar();
    const [first] = within(sidebar).getAllByRole("group");
    expect(within(first as HTMLElement).getByText("Mine")).toBeDefined();
    const mine = within(first as HTMLElement);
    await waitFor(() => {
      expect(mine.getAllByRole("link").map((link) => link.textContent)).toEqual(
        ["Follow-ups", "Customer asks"],
      );
    });
    expect(mine.getByRole("button", { name: "New page" })).toBeDefined();
  });

  it("isn't shown to a role that may not make private pages", async () => {
    // Given a role without the permission
    serverAnswers({ "GET /api/session": () => Response.json(fictionalUser) });
    renderApp("/help");

    // Then the sidebar has no Mine
    const sidebar = await findSidebar();
    expect(within(sidebar).queryByText("Mine")).toBeNull();
  });
});

describe("a page's export", () => {
  it("holds its columns alone, with nothing of drafts, named after the page", async () => {
    const files = savedFiles();
    serverAnswers(
      pageAnswers(
        followUps([row("r1", "Check offline conflicts", "2026-12-04")]),
      ),
    );
    renderApp(`/mine/${pageId}`);
    await screen.findByRole("grid", { name: "Follow-ups" });
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );
    await waitFor(() => {
      expect(files).toHaveLength(1);
    });
    const [header, first] = ((await files[0]?.text()) ?? "")
      .replace(/^\uFEFF/u, "")
      .split("\r\n");
    expect(header).toBe("Name,Due");
    expect(first).toBe("Check offline conflicts,2026-12-04");
    expect(files[0]?.name).toMatch(
      /^fathom_follow-ups_fictional-person_\d{4}-\d{2}-\d{2}\.csv$/u,
    );
  });
});

describe("Mine for a role that may not make private pages", () => {
  it("leaves a page's address not found, reading nothing of it", async () => {
    const fetch = serverAnswers({
      "GET /api/session": () => Response.json(fictionalUser),
    });
    renderApp(`/mine/${pageId}`);
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
    expect(
      fetch.mock.calls.filter(([url]) => url.startsWith("/api/private-pages")),
    ).toEqual([]);
  });
});

describe("Mine in the collapsed rail", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("shows each page as its first character after the ring, named in its tip", async () => {
    localStorage.setItem("fathom-sidebar-collapsed", "true");
    serverAnswers(pageAnswers(followUps([])));
    renderApp("/help");
    const sidebar = await findSidebar();
    const page = await within(sidebar).findByRole("link", {
      name: "Follow-ups",
    });
    expect(page.textContent).toBe("FFollow-ups");
    expect(
      within(sidebar).getByRole("button", { name: "New page" }).textContent,
    ).toBe("New page");
  });
});

describe("a page under Mine", () => {
  it("shows its name after the private ring, in the heading and the top bar", async () => {
    serverAnswers(
      pageAnswers(followUps([row("r1", "Check offline conflicts")])),
    );
    renderApp(`/mine/${pageId}`);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).toBe(
      "Private. Nobody else sees this page. Follow-ups",
    );
    await screen.findByRole("grid", { name: "Follow-ups" });
    expect(within(screen.getByRole("banner")).getByText("Mine")).toBeDefined();
  });

  it("saves a changed value at once, with no draft, and undoes it", async () => {
    // Given a page with two rows
    const before = followUps([
      row("r1", "Check offline conflicts"),
      row("r2", "Ask about bulk edits"),
    ]);
    const fetch = serverAnswers({
      ...pageAnswers(before),
      [`PATCH ${pagePath}/rows/r1`]: savedPage(
        followUps([row("r1", "Check offline conflicts", "2026-12-04")]),
      ),
      "POST /api/undo/40000000-0000-4000-8000-000000000001": () =>
        Response.json({ changeSetId: "40000000-0000-4000-8000-000000000002" }),
    });
    renderApp(`/mine/${pageId}`);
    await screen.findByRole("grid", { name: "Follow-ups" });

    // When a due date is typed in
    act(() => {
      recordCell("r1", dueField)?.focus();
    });
    await userEvent.keyboard("2026-12-04{Enter}");

    // Then it's saved at once as the row's change
    await waitFor(() => {
      expect(changesSent(fetch)).toEqual([
        [`${pagePath}/rows/r1`, { days: { [dueField]: "2026-12-04" } }],
      ]);
    });

    // And Cmd+Z undoes it
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => {
      expect(changesSent(fetch).at(-1)).toEqual([
        "/api/undo/40000000-0000-4000-8000-000000000001",
        {},
      ]);
    });
  });

  it("adds a row typed in the empty row, by its first column", async () => {
    const fetch = serverAnswers({
      ...pageAnswers(followUps([])),
      [`POST ${pagePath}/rows`]: savedPage(
        followUps([row("r2", "Ask about bulk edits")]),
      ),
    });
    renderApp(`/mine/${pageId}`);
    await screen.findByRole("grid", { name: "Follow-ups" });
    act(() => {
      document.getElementById(`cell-new-0-${nameField}`)?.focus();
    });
    await userEvent.keyboard("Ask about bulk edits{Enter}");
    await waitFor(() => {
      expect(changesSent(fetch)).toEqual([
        [
          `${pagePath}/rows`,
          {
            values: {},
            links: {},
            texts: { [nameField]: "Ask about bulk edits" },
            days: { [dueField]: null },
          },
        ],
      ]);
    });
  });

  it("tints no row being typed in, as it will be no draft", async () => {
    serverAnswers(pageAnswers(followUps([])));
    renderApp(`/mine/${pageId}`);
    await screen.findByRole("grid", { name: "Follow-ups" });
    act(() => {
      document.getElementById(`cell-new-0-${nameField}`)?.focus();
    });
    await userEvent.keyboard("Ask about bulk edits{Tab}");
    const newRow = screen.getByRole("row", { name: "New row" });
    expect(newRow.className).not.toContain("recordFillingRow");
  });

  it("adds pasted rows one after another, and Undo takes back the last alone", async () => {
    // Given a page with no rows, whose server adds each pasted row in turn
    const one = row("r1", "Check offline conflicts");
    const two = row("r2", "Ask about bulk edits");
    let rows: PrivateRow[] = [];
    const fetch = serverAnswers({
      ...pageAnswers(followUps([])),
      [`GET ${pagePath}`]: () => Response.json(followUps(rows)),
      [`POST ${pagePath}/rows`]: () => {
        rows = rows.length === 0 ? [one] : [one, two];
        return savedPage(followUps(rows))();
      },
      "POST /api/undo/40000000-0000-4000-8000-000000000001": () => {
        rows = [one];
        return Response.json({
          changeSetId: "40000000-0000-4000-8000-000000000002",
        });
      },
    });
    renderApp(`/mine/${pageId}`);
    await screen.findByRole("grid", { name: "Follow-ups" });

    // When two rows are pasted into the empty row
    act(() => {
      document.getElementById(`cell-new-0-${nameField}`)?.focus();
    });
    await userEvent.paste("Check offline conflicts\nAsk about bulk edits");
    await waitFor(() => {
      expect(changesSent(fetch)).toHaveLength(2);
    });

    // Then Cmd+Z undoes the last, keeping the first in view
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => {
      expect(changesSent(fetch).at(-1)?.[0]).toBe(
        "/api/undo/40000000-0000-4000-8000-000000000001",
      );
    });
    expect(screen.getByText("Check offline conflicts")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText("Ask about bulk edits")).toBeNull();
    });
  });

  it("takes back the rows already saved when a later pasted row is refused", async () => {
    const one = row("r1", "Check offline conflicts");
    let added = 0;
    const fetch = serverAnswers({
      ...pageAnswers(followUps([])),
      [`POST ${pagePath}/rows`]: () => {
        added += 1;
        return added === 1
          ? savedPage(followUps([one]))()
          : Response.json({ error: "Problem" }, { status: 500 });
      },
      [`DELETE ${pagePath}/rows/r1`]: savedPage(followUps([])),
    });
    renderApp(`/mine/${pageId}`);
    await screen.findByRole("grid", { name: "Follow-ups" });
    act(() => {
      document.getElementById(`cell-new-0-${nameField}`)?.focus();
    });
    await userEvent.paste("Check offline conflicts\nAsk about bulk edits");
    await waitFor(() => {
      expect(changesSent(fetch, "DELETE")).toEqual([
        [`${pagePath}/rows/r1`, undefined],
      ]);
    });
  });

  it("removes a row at once from its menu, saying so with Undo", async () => {
    // Given a page with two rows
    const fetch = serverAnswers({
      ...pageAnswers(
        followUps([
          row("r1", "Check offline conflicts"),
          row("r2", "Ask about bulk edits"),
        ]),
      ),
      [`DELETE ${pagePath}/rows/r2`]: savedPage(
        followUps([row("r1", "Check offline conflicts")]),
      ),
    });
    renderApp(`/mine/${pageId}`);
    await screen.findByRole("grid", { name: "Follow-ups" });

    // When the second row is removed from its menu
    await userEvent.click(
      screen.getAllByRole("button", {
        name: "Actions for Ask about bulk edits",
      })[0] as HTMLElement,
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove row" }),
    );

    // Then it's removed at once, and a notification says so with Undo
    await waitFor(() => {
      expect(changesSent(fetch)).toEqual([[`${pagePath}/rows/r2`, undefined]]);
    });
    const notice = await screen.findByText("Removed Ask about bulk edits.");
    expect(
      within(notice.closest("[role=alert]") ?? document.body).getByRole(
        "button",
        { name: "Undo" },
      ),
    ).toBeDefined();
  });

  it("finds rows by what is typed in its search", async () => {
    serverAnswers(
      pageAnswers(
        followUps([
          row("r1", "Check offline conflicts"),
          row("r2", "Ask about bulk edits"),
        ]),
      ),
    );
    renderApp(`/mine/${pageId}`);
    await screen.findByRole("grid", { name: "Follow-ups" });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search rows" }),
      "bulk",
    );
    await waitFor(() => {
      expect(screen.queryByText("Check offline conflicts")).toBeNull();
    });
    expect(screen.getByText("Ask about bulk edits")).toBeDefined();
  });

  it("says so when its lists can't be read, and reads them again on Try again", async () => {
    let failing = true;
    serverAnswers({
      ...pageAnswers(followUps([])),
      "GET /api/lists": () =>
        failing
          ? Response.json({ error: "Problem" }, { status: 500 })
          : Response.json({ lists: [] }),
    });
    renderApp(`/mine/${pageId}`);
    expect(
      await screen.findByText("Fathom could not load the page."),
    ).toBeDefined();
    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("grid", { name: "Follow-ups" }),
    ).toBeDefined();
  });

  it("says the server can't be reached when the page can't be read", async () => {
    serverAnswers({
      ...pageAnswers(followUps([])),
      [`GET ${pagePath}`]: () =>
        Response.json({ error: "Problem" }, { status: 500 }),
    });
    renderApp(`/mine/${pageId}`);
    expect(
      await screen.findByText("Fathom could not reach its server."),
    ).toBeDefined();
  });

  it("is not found at an address that names no page", async () => {
    serverAnswers(pageAnswers(followUps([])));
    renderApp("/mine/follow-ups");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });

  it("is not found where the server finds no page the reader may read", async () => {
    serverAnswers({
      "GET /api/session": () => Response.json(maker),
      "GET /api/private-pages": () => Response.json([]),
      [`GET ${pagePath}`]: () =>
        Response.json({ error: "Not found" }, { status: 404 }),
    });
    renderApp(`/mine/${pageId}`);
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
    expect(screen.queryByRole("grid")).toBeNull();
  });
});
