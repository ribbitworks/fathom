// SPDX-License-Identifier: Apache-2.0

// Tests for removing and renaming on a page under Mine, with the server's responses simulated:
// Remove column… and Remove page… asking first, then offering Undo, and the page's ⋯.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dueField,
  followUps,
  listed,
  pageAnswers,
  pageId,
  pagePath,
  row,
} from "./test-private-pages.ts";
import { changesSent, renderApp, serverAnswers } from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const changeSetId = "40000000-0000-4000-8000-000000000001";
const otherId = "20000000-0000-4000-8000-000000000002";
const undoPath = `/api/undo/${changeSetId}`;
const undone = () =>
  Response.json({ changeSetId: "40000000-0000-4000-8000-000000000002" });

const openPage = async (answers: Record<string, () => Response> = {}) => {
  const fetch = serverAnswers({
    ...pageAnswers(followUps([row("r1", "Check offline conflicts")])),
    ...answers,
  });
  renderApp(`/mine/${pageId}`);
  await screen.findByRole("grid", { name: "Follow-ups" });
  return fetch;
};

const columnMenu = async (name: string) => {
  await userEvent.click(
    screen.getByRole("button", { name: new RegExp(`^${name} column`, "u") }),
  );
};

const pageMenu = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: "Actions for Follow-ups" }),
  );
};

const noticeUndo = async (words: string) => {
  const notice = await screen.findByText(words);
  return within(notice.closest("[role=status]") ?? document.body).getByRole(
    "button",
    { name: "Undo" },
  );
};

describe("Remove column… on a page under Mine", () => {
  it("is offered for every column but the first", async () => {
    await openPage();
    await columnMenu("Name");
    await screen.findByRole("menuitem", { name: "Sort A to Z" });
    expect(
      screen.queryByRole("menuitem", { name: "Remove column…" }),
    ).toBeNull();
    await userEvent.keyboard("{Escape}");
    await columnMenu("Due");
    expect(
      await screen.findByRole("menuitem", { name: "Remove column…" }),
    ).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: "Edit column…" })).toBeNull();
  });

  it("asks first, and Cancel keeps the column, its heading focused", async () => {
    // Given the Due column's Remove column…
    const fetch = await openPage();
    await columnMenu("Due");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove column…" }),
    );

    // Then it asks, with Cancel focused
    const question = await screen.findByRole("dialog", {
      name: "Remove the Due column?",
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(question).getByRole("button", { name: "Cancel" }),
      );
    });

    // And Cancel removes nothing, putting focus back on the column's heading
    await userEvent.click(
      within(question).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(document.activeElement?.getAttribute("aria-label")).toMatch(
        /^Due column/u,
      );
    });
    expect(changesSent(fetch)).toEqual([]);
  });

  it("removes the column once asked, saying so with Undo", async () => {
    // Given Remove column… answered with Remove
    const before = followUps([row("r1", "Check offline conflicts")]);
    let page = before;
    const removed = {
      ...before,
      columns: before.columns.filter(({ id }) => id !== dueField),
    };
    const fetch = await openPage({
      [`GET ${pagePath}`]: () => Response.json(page),
      [`DELETE ${pagePath}/columns/${dueField}`]: () => {
        page = removed;
        return Response.json({ page, changeSetId });
      },
      [`POST ${undoPath}`]: undone,
    });
    await columnMenu("Due");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove column…" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove" }),
    );

    // Then the column is removed, and a notification says so
    await waitFor(() => {
      expect(changesSent(fetch)).toEqual([
        [`${pagePath}/columns/${dueField}`, undefined],
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Due column/u })).toBeNull();
    });

    // And its Undo takes the removal back
    await userEvent.click(await noticeUndo("Removed the Due column."));
    await waitFor(() => {
      expect(changesSent(fetch).at(-1)).toEqual([undoPath, {}]);
    });
  });
});

describe("a page's ⋯", () => {
  it("offers Rename page…, Copy link, Copy key and Remove page…", async () => {
    await openPage();
    await pageMenu();
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Rename page…", "Copy link", "Copy key", "Remove page…"]);
  });

  it("copies the page's key and its link", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(
      screen.getByRole("button", { name: "Actions for Follow-ups" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Copy key" }));
    expect(await navigator.clipboard.readText()).toBe("#PAGE-K7QM");
    await user.click(
      screen.getByRole("button", { name: "Actions for Follow-ups" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Copy link" }),
    );
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/go/PAGE-K7QM`,
    );
  });

  it("offers no copying for a page made before keys were", async () => {
    serverAnswers({
      ...pageAnswers({ ...followUps([]), key: null }),
    });
    renderApp(`/mine/${pageId}`);
    await screen.findByRole("grid", { name: "Follow-ups" });
    await pageMenu();
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Rename page…", "Remove page…"]);
  });

  it("renames the page, refusing another page's name, and Cmd+Z undoes it", async () => {
    // Given Rename page…
    let page = followUps([]);
    let pages = listed;
    const fetch = await openPage({
      [`GET ${pagePath}`]: () => Response.json(page),
      "GET /api/private-pages": () => Response.json(pages),
      [`PATCH ${pagePath}`]: () => {
        page = { ...page, name: "Open questions" };
        pages = pages.map((one) =>
          one.id === pageId ? { ...one, name: page.name } : one,
        );
        return Response.json({ page, changeSetId });
      },
      [`POST ${undoPath}`]: undone,
    });
    await pageMenu();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Rename page…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Rename page" });
    const name = within(dialog).getByRole("textbox", { name: "Name" });

    // When another page's name is typed, it's refused, and nothing is sent
    await userEvent.clear(name);
    await userEvent.type(name, "customer asks{Enter}");
    expect(
      within(dialog).getByText("Another page has that name"),
    ).toBeDefined();
    expect(changesSent(fetch)).toEqual([]);

    // When a new name is typed, it's saved, and the heading shows it
    await userEvent.clear(name);
    await userEvent.type(name, "Open questions{Enter}");
    await waitFor(() => {
      expect(changesSent(fetch)).toEqual([
        [pagePath, { name: "Open questions" }],
      ]);
    });
    expect(
      (await screen.findByRole("heading", { level: 1 })).textContent,
    ).toContain("Open questions");
    await waitFor(() => {
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "Actions for Open questions",
      );
    });

    // And Cmd+Z undoes it
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => {
      expect(changesSent(fetch).at(-1)).toEqual([undoPath, {}]);
    });
  });

  it("asks before removing the page, and Esc keeps it, the ⋯ focused", async () => {
    const fetch = await openPage();
    await pageMenu();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove page…" }),
    );
    await screen.findByRole("dialog", { name: "Remove the Follow-ups page?" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "Actions for Follow-ups",
      );
    });
    expect(changesSent(fetch)).toEqual([]);
  });

  it("removes the page once asked, opening the next, and Undo opens it again", async () => {
    // Given a page followed by another under Mine
    const fetch = await openPage({
      [`DELETE ${pagePath}`]: () => Response.json({ changeSetId }),
      [`GET /api/private-pages/${otherId}`]: () =>
        Response.json({ ...followUps([]), id: otherId, name: "Customer asks" }),
      [`POST ${undoPath}`]: undone,
    });

    // When it's removed from its ⋯
    await pageMenu();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove page…" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove" }),
    );

    // Then the next page opens, and a notification says so
    await waitFor(() => {
      expect(changesSent(fetch)).toEqual([[pagePath, undefined]]);
    });
    await screen.findByRole("grid", { name: "Customer asks" });

    // And its Undo puts the page back and opens it
    await userEvent.click(await noticeUndo("Removed the Follow-ups page."));
    await waitFor(() => {
      expect(changesSent(fetch).at(-1)).toEqual([undoPath, {}]);
    });
    await screen.findByRole("grid", { name: "Follow-ups" });
  });

  it("lands on the Overview once the only page is removed", async () => {
    serverAnswers({
      ...pageAnswers(followUps([])),
      "GET /api/private-pages": () => Response.json(listed.slice(0, 1)),
      [`DELETE ${pagePath}`]: () => Response.json({ changeSetId }),
    });
    renderApp(`/mine/${pageId}`);
    await screen.findByRole("grid", { name: "Follow-ups" });
    await pageMenu();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove page…" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove" }),
    );
    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
    });
  });
});
