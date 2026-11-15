// SPDX-License-Identifier: Apache-2.0

// Tests for Help in Fathom, with the server's responses simulated: every signed-in user reaches the
// index from the sidebar, whatever their role; each page shows its title as the page's heading and
// its headings as anchors; links between Help pages stay in Fathom, at the heading named; and an
// address naming no Help page says there is no such page.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
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
      "GET /api/greeting": greeting,
    });
    renderApp("/help/features");
    expect(
      await screen.findByRole("heading", { name: "Features", level: 1 }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "Group the Table" }).id).toBe(
      "group-the-table",
    );
  });

  it("follows a link to another Help page in the same tab, to the heading named", async () => {
    serverAnswers({
      "GET /api/session": () => Response.json(fictionalUser),
      "GET /api/greeting": greeting,
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
      "GET /api/greeting": greeting,
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
