// SPDX-License-Identifier: Apache-2.0

// Tests for the frame around every signed-in page: which sections the sidebar shows, how it marks
// the current page and pages still to come, where the top bar says the user is, and how the sidebar
// opens and closes on narrow screens.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

const administrator = () =>
  Response.json({
    ...fictionalUser,
    roles: ["administrator"],
    permissions: ["accounts:manage", "history:view"],
  });

const sidebar = () => screen.getByRole("navigation", { name: "Sections" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the sidebar", () => {
  it("shows administration only to those who may use it", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    await screen.findByText("Hello, Fathom");
    expect(within(sidebar()).queryByText("Administration")).toBeNull();
    expect(
      within(sidebar()).queryByRole("link", { name: "Accounts" }),
    ).toBeNull();
  });

  it("marks the current page, and pages still to come", async () => {
    serverAnswers({
      "GET /api/session": administrator,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    await screen.findByText("Hello, Fathom");
    expect(
      within(sidebar())
        .getByRole("link", { name: "Overview" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(sidebar())
        .getByRole("link", { name: "Accounts" })
        .getAttribute("aria-current"),
    ).toBeNull();
    expect(within(sidebar()).getByText("Projects").textContent).toBe(
      "Projects, Later",
    );
    expect(
      within(sidebar()).queryByRole("link", { name: /Projects/ }),
    ).toBeNull();
  });
});

describe("the top bar", () => {
  it.each([
    ["/", "Plan/Overview"],
    ["/password", "Your account/Change password"],
  ])("names where the user is on %s", async (path, place) => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp(path);
    const breadcrumbs = await screen.findByText(place.split("/")[1] ?? "", {
      selector: "header *",
    });
    expect(breadcrumbs.parentElement?.textContent).toBe(place);
  });

  it("is not shown on an address that names no page", async () => {
    serverAnswers({ "GET /api/session": signedIn });
    renderApp("/no-such-page");
    await screen.findByText("There is no page at this address.");
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Sections" })).toBeNull();
  });
});

describe("on a narrow screen", () => {
  it("keeps the sidebar out of reach until it is opened, and closes it after moving page", async () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: true,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    serverAnswers({
      "GET /api/session": administrator,
      "GET /api/greeting": greeting,
      "GET /api/access-history": () => Response.json({ entries: [] }),
    });
    renderApp("/");
    await screen.findByText("Hello, Fathom");
    const menu = screen.getByRole("button", { name: "Show sections" });
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(menu.getAttribute("aria-controls")).toBe(sidebar().id);
    expect(sidebar().hasAttribute("inert")).toBe(true);

    await userEvent.click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(sidebar().hasAttribute("inert")).toBe(false);

    await userEvent.click(
      within(sidebar()).getByRole("link", { name: "Access history" }),
    );
    await screen.findByRole("heading", { name: "Access history" });
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(sidebar().hasAttribute("inert")).toBe(true);
  });
});
