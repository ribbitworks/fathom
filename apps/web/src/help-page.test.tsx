// SPDX-License-Identifier: Apache-2.0

// Tests for Help's pages, with the server's responses simulated: every signed-in user reaches them
// from the sidebar, whatever their roles. The Roles page says what each role lets a user do, marking
// the roles the user holds, and what each sensitivity covers; the Drafts page says what each mark
// beside a person with a draft means, and what happens to a draft.

import { type Role, roleSchema } from "@fathom/shared";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { roleDescription, roleName } from "./accounts.ts";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

// The rows of a Help page's tables, each as the text of its cells.
async function tables(title = "Roles") {
  await screen.findByRole("heading", { name: title, level: 1 });
  return screen.getAllByRole("table").map((table) =>
    within(table)
      .getAllByRole("row")
      .map((row) =>
        [...row.querySelectorAll("th, td")].map((cell) => cell.textContent),
      ),
  );
}

describe("Help's Roles page", () => {
  it("is reached from the sidebar", async () => {
    serverAnswers({
      "GET /api/session": () => Response.json(fictionalUser),
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    await userEvent.click(await screen.findByRole("link", { name: "Roles" }));
    expect(
      await screen.findByRole("heading", { name: "Roles", level: 1 }),
    ).toBeDefined();
  });

  it("opens for a user with no roles, marking none as theirs", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({ ...fictionalUser, roles: [], permissions: [] }),
    });
    renderApp("/help/roles");
    const [roles] = await tables();
    expect(roles).toHaveLength(roleSchema.options.length);
    expect(screen.queryByText(/Your role/)).toBeNull();
  });

  it("says what each role lets a user do, marking the user's own, and what each sensitivity covers", async () => {
    const held: Role[] = ["viewer", "leadership"];
    const headerName = (role: Role) =>
      `${held.includes(role) ? "Your role: " : ""}${roleName(role)}`;
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          roles: held,
          permissions: ["plan:view", "people:view"],
        }),
    });
    renderApp("/help/roles");
    const [roles, sensitivities] = await tables();
    expect(roles).toEqual(
      roleSchema.options.map((role) => [
        headerName(role),
        roleDescription(role),
      ]),
    );
    for (const role of roleSchema.options) {
      const header = screen.getByRole("rowheader", { name: headerName(role) });
      expect(header.querySelector("svg") !== null).toBe(held.includes(role));
    }
    expect(sensitivities?.map(([name]) => name)).toEqual([
      "General",
      "Restricted",
      "Confidential",
    ]);
  });
});

describe("Help's Drafts page", () => {
  it("is reached from the sidebar's Help section, apart from the People section's Drafts page", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          roles: ["viewer"],
          permissions: ["people:view"],
        }),
    });
    renderApp("/help/roles");
    const help = await screen.findByRole("group", { name: "Help" });
    expect(
      within(screen.getByRole("group", { name: "People" })).getByRole("link", {
        name: "Drafts",
      }),
    ).toHaveProperty("pathname", "/drafts");
    await userEvent.click(within(help).getByRole("link", { name: "Drafts" }));
    expect(
      await screen.findByRole("heading", { name: "Drafts", level: 1 }),
    ).toBeDefined();
  });

  it("says what each mark means, what happens to a draft, and what the Draft menu shows", async () => {
    serverAnswers({
      "GET /api/session": () => Response.json(fictionalUser),
    });
    renderApp("/help/drafts");
    const [, lifecycle, views] = await tables("Drafts");
    const names = [
      "Draft",
      "Draft: added",
      "Draft: removed",
      "Draft: moved",
      "Draft: reordered",
      "Draft: retired",
      "Rejected",
      "Unpublished",
      "Being changed",
      "Live",
    ];
    // The marks come first; "Rejected" also names a row of the second table.
    expect(screen.getAllByRole("rowheader").slice(0, names.length)).toEqual(
      names.map((name) => screen.getAllByRole("rowheader", { name })[0]),
    );
    expect(lifecycle?.map(([state]) => state)).toEqual([
      "Saved",
      "Published",
      "Approved",
      "Rejected",
      "Discarded",
    ]);
    expect(views?.map(([view]) => view)).toEqual([
      "Drafts beside live",
      "Drafts applied",
      "Live only",
    ]);
  });
});
