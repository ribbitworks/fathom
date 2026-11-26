// SPDX-License-Identifier: Apache-2.0

// Tests for the Overview: its greeting by the time of day, and the role's jobs, each opening to its
// tasks, linking to where it's done and to its Help.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
  permissionSchema,
  type Role,
  startingRoles,
  withImplied,
} from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { greetingFor } from "./home.tsx";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";

// A session acting as a starting role, with what it grants.
const actingAs = (key: Role, name: string) => () =>
  Response.json({
    ...fictionalUser,
    role: { ...fictionalUser.role, key, name },
    // The key is always one of the starting roles'.
    // eslint-disable-next-line security/detect-object-injection
    permissions: withImplied(startingRoles[key].permissions),
  });

afterEach(() => {
  vi.useRealTimers();
});

describe("the Overview's greeting", () => {
  it("greets by the computer's clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 26, 14, 30));
    serverAnswers({
      "GET /api/session": actingAs("product-manager", "Product Manager"),
    });
    renderApp("/");
    expect(
      await screen.findByText("Good afternoon, Fictional Person"),
    ).toBeDefined();
  });

  it("says good morning before noon, good afternoon before six, and good evening after", () => {
    expect(greetingFor(0, "Wren Castellano")).toBe(
      "Good morning, Wren Castellano",
    );
    expect(greetingFor(11, "Wren")).toBe("Good morning, Wren");
    expect(greetingFor(12, "Wren")).toBe("Good afternoon, Wren");
    expect(greetingFor(17, "Wren")).toBe("Good afternoon, Wren");
    expect(greetingFor(18, "Wren")).toBe("Good evening, Wren");
  });
});

describe("the Overview's jobs", () => {
  it("are the role's, each closed at first, opening and closing to its tasks", async () => {
    // Given a Product Manager on the Overview
    serverAnswers({
      "GET /api/session": actingAs("product-manager", "Product Manager"),
    });
    renderApp("/");
    const jobs = await screen.findByRole("region", { name: "Jobs" });
    const plan = within(jobs).getByRole("button", {
      name: "Plan the Features",
    });
    expect(plan.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByRole("list", { name: "Plan the Features" }),
    ).toBeNull();

    // When its first job is opened
    await userEvent.click(plan);
    expect(
      document.getElementById(plan.getAttribute("aria-controls") ?? ""),
    ).toBe(screen.getByRole("list", { name: "Plan the Features" }));

    // Then it shows its tasks, and closes again
    expect(plan.getAttribute("aria-expanded")).toBe("true");
    const tasks = screen.getByRole("list", { name: "Plan the Features" });
    expect(
      within(tasks)
        .getAllByRole("listitem")
        .map((task) => task.firstChild?.textContent),
    ).toEqual([
      "Add a Feature",
      "Say When a Feature Is Needed",
      "Choose the Target Cycle and Team",
      "Add a Column to Features",
    ]);
    await userEvent.click(plan);
    expect(
      screen.queryByRole("list", { name: "Plan the Features" }),
    ).toBeNull();
  });

  it("link to where each is done, and to its Help", async () => {
    serverAnswers({
      "GET /api/session": actingAs("product-manager", "Product Manager"),
    });
    renderApp("/");
    const jobs = await screen.findByRole("region", { name: "Jobs" });
    expect(
      within(jobs)
        .getByRole("link", { name: "Help: Approve or Reject Drafts" })
        .getAttribute("href"),
    ).toBe("/help/working-as-a-product-manager#approve-or-reject-drafts");
    expect(
      within(jobs)
        .getByRole("link", { name: "Drafts, To decide" })
        .getAttribute("href"),
    ).toBe("/drafts?tab=decide");
    expect(
      within(jobs)
        .getAllByRole("link", { name: "Features" })[0]
        ?.getAttribute("href"),
    ).toBe("/features");
    expect(
      within(jobs).getByRole("link", {
        name: "Features",
        description: "Plan the Features",
      }),
    ).toBeDefined();
  });
});

describe("every starting role", () => {
  it.each(Object.entries(startingRoles))(
    "opens on the Overview, with its jobs, for %s",
    async (key, { name, permissions }) => {
      serverAnswers({
        "GET /api/session": () =>
          Response.json({
            ...fictionalUser,
            role: { ...fictionalUser.role, key, name },
            permissions: withImplied(permissions),
          }),
      });
      const history = renderApp("/");
      const jobs = await screen.findByRole("region", { name: "Jobs" });
      expect(
        within(jobs).getAllByRole("heading", { level: 2 }).length,
      ).toBeGreaterThan(0);
      expect(history.location.pathname).toBe("/");
    },
  );
});

describe("a role Fathom doesn't start with", () => {
  it("is shown every job its permissions allow, by area, as a Superuser is all of them", async () => {
    // Given a role made later, with no starting role's key, holding every permission
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          role: { ...fictionalUser.role, key: null, name: "Superuser" },
          permissions: permissionSchema.options,
        }),
    });
    renderApp("/");
    const jobs = await screen.findByRole("region", { name: "Jobs" });

    // Then every area is headed in the sidebar's order, under the greeting acting as it
    expect(screen.getByText("Acting as Superuser")).toBeDefined();
    expect(
      within(jobs)
        .getAllByRole("heading", { level: 2 })
        .map(({ textContent }) => textContent),
    ).toEqual([
      "Plan",
      "People",
      "Capacity",
      "Administration",
      "Drafts",
      "History",
    ]);
    expect(
      within(jobs).getByRole("list", { name: "Administration" }),
    ).toBeDefined();
  });

  it("says it has no jobs when its permissions allow none", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          role: { ...fictionalUser.role, key: null, name: "Nothing Yet" },
          permissions: [],
        }),
    });
    renderApp("/");
    const jobs = await screen.findByRole("region", { name: "Jobs" });
    expect(within(jobs).getByText("No jobs")).toBeDefined();
  });
});

describe("a job's place", () => {
  it("opens its part of the page", async () => {
    serverAnswers({
      "GET /api/session": actingAs("product-manager", "Product Manager"),
    });
    const history = renderApp("/");
    await userEvent.click(
      await screen.findByRole("link", { name: "Drafts, To decide" }),
    );
    expect(history.location.pathname).toBe("/drafts");
    expect(history.location.search).toBe("?tab=decide");
  });

  it("follows the role's permissions, not its key, once its role is changed", async () => {
    // Given a Product Manager whose role now sees only people
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          role: {
            ...fictionalUser.role,
            key: "product-manager",
            name: "Product Manager",
          },
          permissions: ["people:view"],
        }),
    });
    renderApp("/");
    const jobs = await screen.findByRole("region", { name: "Jobs" });

    // Then it's shown the jobs on people, and none on features
    expect(
      within(jobs).getByRole("button", { name: "Find Someone" }),
    ).toBeDefined();
    expect(
      within(jobs).queryByRole("button", { name: "Plan the Features" }),
    ).toBeNull();
    expect(within(jobs).queryByRole("link", { name: "Features" })).toBeNull();
  });
});
