// SPDX-License-Identifier: Apache-2.0

// Tests for Help's Roles page, with the server's responses simulated: every signed-in user reaches it
// from the sidebar, whatever their roles, and it says what each role lets a user do, marking the
// roles the user holds, and what each sensitivity covers.

import { roleSchema } from "@fathom/shared";
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

// The rows of the page's tables, each as the text of its cells: its roles, then its sensitivities.
async function tables() {
  await screen.findByRole("heading", { name: "Roles", level: 1 });
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
    expect(screen.queryByText("Yours")).toBeNull();
  });

  it("says what each role lets a user do, marking the user's own, and what each sensitivity covers", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          roles: ["viewer", "leadership"],
          permissions: ["plan:view", "people:view"],
        }),
    });
    renderApp("/help/roles");
    const [roles, sensitivities] = await tables();
    expect(roles).toEqual(
      roleSchema.options.map((role) => [
        `${roleName(role)}${["viewer", "leadership"].includes(role) ? "Yours" : ""}`,
        roleDescription(role),
      ]),
    );
    expect(sensitivities?.map(([name]) => name)).toEqual([
      "General",
      "Restricted",
      "Confidential",
    ]);
  });
});
