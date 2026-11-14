// SPDX-License-Identifier: Apache-2.0

// Tests for Help's pages, with the server's responses simulated: every signed-in user reaches them
// from the sidebar, whatever their role. The Roles page says what each starting role lets a user do,
// marking the user's own role, and what each sensitivity covers; the Drafts page says what each mark
// beside a person with a draft means, and what happens to a draft.

import { type Role, roleSchema, startingRoles } from "@fathom/shared";
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

  it("opens for a user with no role, marking none as theirs", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({ ...fictionalUser, role: null, permissions: [] }),
    });
    renderApp("/help/roles");
    const [roles] = await tables();
    expect(roles).toHaveLength(roleSchema.options.length);
    expect(screen.queryByText(/Current role/)).toBeNull();
  });

  it("says what each starting role lets a user do, marking the user's own, and what each sensitivity covers", async () => {
    const held: Role = "executive";
    const headerName = (role: Role) =>
      // The role is always one of the starting roles.
      // eslint-disable-next-line security/detect-object-injection
      `${role === held ? "Current role: " : ""}${startingRoles[role].name}`;
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          role: {
            id: "00000000-0000-4000-8000-0000000000a2",
            key: held,
            name: "Executive",
            description: "Fictional description.",
          },
          permissions: ["plan:view", "features:view", "people:view"],
        }),
    });
    renderApp("/help/roles");
    const [roles, sensitivities] = await tables();
    expect(roles).toEqual(
      roleSchema.options.map((role) => [
        headerName(role),
        // eslint-disable-next-line security/detect-object-injection
        startingRoles[role].description,
      ]),
    );
    for (const role of roleSchema.options) {
      const header = screen.getByRole("rowheader", { name: headerName(role) });
      expect(header.querySelector("svg") !== null).toBe(role === held);
    }
    expect(sensitivities?.map(([name]) => name)).toEqual([
      "General",
      "Personal",
      "Confidential",
    ]);
  });

  it("puts a role made later first, as the user's own, with its description", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          role: {
            id: "00000000-0000-4000-8000-0000000000a3",
            key: null,
            name: "Fictional Auditors",
            description: "Checks Personal data for audits.",
          },
          permissions: ["people:view"],
        }),
    });
    renderApp("/help/roles");
    const [roles] = await tables();
    expect(roles).toHaveLength(roleSchema.options.length + 1);
    expect(roles?.[0]).toEqual([
      "Current role: Fictional Auditors",
      "Checks Personal data for audits.",
    ]);
    expect(screen.getAllByText(/Current role/)).toHaveLength(1);
  });
});

describe("Help's Drafts page", () => {
  it("is reached from the sidebar's Help section, apart from the People section's Drafts page", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
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
      "Example, Draft",
      "Example, Draft: removed",
      "Example, Draft, unpublished",
      "Example, Rejected",
      "Example, being changed by Someone",
      "Example, Draft: moved",
      "Example, Draft, from Dec 1, 2026",
      "Example, live",
    ];
    expect(screen.getAllByRole("rowheader").slice(0, names.length)).toEqual(
      names.map((name) => screen.getByRole("rowheader", { name })),
    );
    expect(lifecycle?.map(([state]) => state)).toEqual([
      "Saved",
      "Published",
      "Approved",
      "Rejected",
      "Discarded",
    ]);
    expect(views?.map(([view]) => view)).toEqual([
      "Drafts & Live",
      "Drafts applied",
      "Live only",
    ]);
  });
});
