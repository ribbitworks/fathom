// SPDX-License-Identifier: Apache-2.0

// Tests for Help in Fathom, with the server simulated: every user reaches the index from the
// sidebar; a page shows its title, its headings as anchors and its diagrams; links between pages
// stay in Fathom, at the heading named; and an address naming no page says there's no such page.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { helpPage, helpPageNames } from "./help-pages.ts";
import { headingsOf } from "./test-help-pages.ts";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

// A user who may open no page but Help.
const withNoPages = () => Response.json({ ...fictionalUser, permissions: [] });

describe("Help", () => {
  it("opens its index from the sidebar, for a user whose role opens no other page", async () => {
    serverAnswers({ "GET /api/session": withNoPages });
    const history = renderApp("/help/roles");
    await screen.findByRole("heading", { name: "Roles", level: 1 });
    await userEvent.click(
      within(screen.getByRole("navigation", { name: "Sections" })).getByRole(
        "link",
        { name: "Help pages" },
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Help", level: 1 }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/help");
    expect(
      screen.getByRole("link", { name: "Pages" }).getAttribute("href"),
    ).toBe("/help/pages");
  });

  it("shows a page's title as its heading, and its headings as anchors", async () => {
    serverAnswers({
      "GET /api/session": () => Response.json(fictionalUser),
    });
    renderApp("/help/features");
    expect(
      await screen.findByRole("heading", { name: "Features", level: 1 }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "Group the Table" }).id).toBe(
      "group-the-table",
    );
  });

  it("draws a page's diagram, named by its title", async () => {
    serverAnswers({
      "GET /api/session": () => Response.json(fictionalUser),
    });
    renderApp("/help/how-fathom-fits-together");
    await screen.findByRole("heading", {
      name: "How Fathom Fits Together",
      level: 1,
    });
    expect(
      screen.getByRole("img", {
        name: "How Fathom's records fit together",
      }),
    ).toBeDefined();
  });

  it("follows a link to another Help page in the same tab, to the heading named", async () => {
    serverAnswers({
      "GET /api/session": () => Response.json(fictionalUser),
    });
    const history = renderApp("/help/working-as-a-team-member");
    await screen.findByRole("heading", {
      name: "Working as a Team Member",
      level: 1,
    });
    const link = screen
      .getAllByRole("link", { name: "Features" })
      .find(
        (found) =>
          found.getAttribute("href") === "/help/features#group-the-table",
      ) as HTMLElement;
    expect(link.getAttribute("target")).toBeNull();
    await userEvent.click(link);
    expect(
      await screen.findByRole("heading", { name: "Features", level: 1 }),
    ).toBeDefined();
    expect([history.location.pathname, history.location.hash]).toEqual([
      "/help/features",
      "#group-the-table",
    ]);
  });

  it("names the page in the top bar, after a link back to the index", async () => {
    serverAnswers({
      "GET /api/session": () => Response.json(fictionalUser),
    });
    const history = renderApp("/help/pages");
    await screen.findByRole("heading", { name: "Pages", level: 1 });
    const header = within(screen.getByRole("banner"));
    await userEvent.click(header.getByRole("link", { name: "Help pages" }));
    expect(
      await screen.findByRole("heading", { name: "Help", level: 1 }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/help");
  });

  it.each(["/help/no-such-page", "/help/index"])(
    "says there is no page at %s",
    async (path) => {
      serverAnswers({ "GET /api/session": () => Response.json(fictionalUser) });
      renderApp(path);
      expect(
        await screen.findByText("There is no page at this address."),
      ).toBeDefined();
    },
  );
});

describe("a Help page's headings", () => {
  it.each(helpPageNames().filter((name) => name.startsWith("working-as-")))(
    "are drawn with the anchors the Overview links to, on %s",
    async (name) => {
      serverAnswers({ "GET /api/session": withNoPages });
      renderApp(`/help/${name}`);
      const page = helpPage(name);
      await screen.findByRole("heading", { name: page?.title ?? "", level: 1 });
      expect(
        [...document.querySelectorAll("h2[id], h3[id]")].map(({ id }) => id),
      ).toEqual(page && headingsOf(page).map(({ anchor }) => anchor));
    },
  );
});
