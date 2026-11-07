// SPDX-License-Identifier: Apache-2.0

// Tests for the frame around every signed-in page: which sections the sidebar shows, how it marks
// the current page and pages still to come, how it collapses to a rail of icons, where the top bar
// says the user is, how each person chooses light or dark mode, and how the sidebar opens and closes
// on narrow screens.

import { permissionSchema } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
  signedOut,
} from "./test-support.tsx";
import { firstPage } from "./layout.tsx";

// An administrator who also sees the plan, as through the Viewer role.
const administrator = () =>
  Response.json({
    ...fictionalUser,
    permissions: ["plan:view", "accounts:manage", "history:view"],
  });

const sidebar = () => screen.getByRole("navigation", { name: "Sections" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the first page a user may open", () => {
  it("is never the Overview, so someone sent there from it cannot be sent back", () => {
    expect(firstPage(permissionSchema.options)).toBe("/releases/{-$streamId}");
    expect(firstPage(["people:view"])).toBe("/people");
    expect(firstPage(["allocations:view"])).toBeUndefined();
  });
});

describe("the sidebar", () => {
  it("shows Capacity, still to come, only to those who may see allocations", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["plan:view", "allocations:view"],
        }),
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    await screen.findByText("Hello, Fathom");
    expect(
      within(sidebar()).getByText("Capacity").parentElement?.textContent,
    ).toBe("Capacity, Later");
  });

  it("leaves Capacity out for those who may not see allocations", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    await screen.findByText("Hello, Fathom");
    expect(within(sidebar()).queryByText("Capacity")).toBeNull();
  });

  it("shows no plan or people pages, current or to come, to those who may not see them", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["accounts:manage", "history:view"],
        }),
      "GET /api/accounts": () => Response.json({ accounts: [] }),
    });
    renderApp("/accounts");
    await screen.findByRole("heading", { name: "Accounts" });
    for (const name of [
      "Plan",
      "Overview",
      "Projects",
      "Releases",
      "People",
      "Capacity",
      "Lists",
    ]) {
      expect(within(sidebar()).queryByText(name)).toBeNull();
    }
    expect(within(sidebar()).getByText("Administration")).toBeDefined();
  });

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

  it("shows Roles under Administration to those who may edit roles, without Accounts", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["plan:view", "roles:edit"],
        }),
      "GET /api/roles": () => Response.json({ roles: [] }),
    });
    renderApp("/roles");
    const header = await screen.findByText("Roles", { selector: "header *" });
    expect(header.parentElement?.textContent).toBe("Administration/Roles");
    expect(within(sidebar()).getByText("Administration")).toBeDefined();
    expect(
      within(sidebar())
        .getAllByRole("link", { name: "Roles" })
        .map((link) => [
          link.getAttribute("href"),
          link.getAttribute("aria-current"),
        ]),
    ).toEqual([
      ["/roles", "page"],
      ["/help/roles", null],
    ]);
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
    expect(
      within(sidebar()).getByText("Projects").parentElement?.textContent,
    ).toBe("Projects, Later");
    expect(
      within(sidebar()).queryByRole("link", { name: /Projects/ }),
    ).toBeNull();
  });
});

describe("the collapsed sidebar", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("collapses to a rail of icons that keeps every page's name, remembers it, and expands again", async () => {
    serverAnswers({
      "GET /api/session": administrator,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    await screen.findByText("Hello, Fathom");
    await userEvent.click(
      within(sidebar()).getByRole("button", { name: "Collapse sidebar" }),
    );
    expect(localStorage.getItem("fathom-sidebar-collapsed")).toBe("true");
    const expand = within(sidebar()).getByRole("button", {
      name: "Expand sidebar",
    });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    expect(
      within(sidebar()).getByRole("link", { name: "Accounts" }),
    ).toBeDefined();
    expect(within(sidebar()).getByText("Projects, Later")).toBeDefined();
    await userEvent.hover(
      within(sidebar()).getByRole("link", { name: "Accounts" }),
    );
    expect(
      await screen.findByRole("tooltip", { name: "Accounts" }),
    ).toBeDefined();
    await userEvent.click(expand);
    expect(
      within(sidebar()).getByRole("button", { name: "Collapse sidebar" }),
    ).toBeDefined();
  });

  it("starts collapsed when it was left collapsed", async () => {
    localStorage.setItem("fathom-sidebar-collapsed", "true");
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    await screen.findByText("Hello, Fathom");
    expect(
      within(sidebar()).getByRole("button", { name: "Expand sidebar" }),
    ).toBeDefined();
  });
});

describe("the top bar", () => {
  it.each([
    ["/", "Plan/Overview"],
    ["/help/roles", "Help/Roles"],
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

describe("choosing light or dark mode", () => {
  const stored = "mantine-color-scheme-value";
  const shown = () =>
    document.documentElement.getAttribute("data-mantine-color-scheme");
  const accountMenu = () =>
    screen.getByRole("button", { name: /^Your account,/ });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-mantine-color-scheme");
  });

  async function openSignedIn() {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    await screen.findByText("Hello, Fathom");
  }

  it("offers System, Light, and Dark under Appearance, with System chosen at first", async () => {
    await openSignedIn();
    await userEvent.click(accountMenu());
    const group = await screen.findByRole("group", { name: "Appearance" });
    expect(
      within(group)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["System, chosen", "Light", "Dark"]);
  });

  it("switches at once to the mode chosen, marks it chosen, and keeps it in the browser", async () => {
    await openSignedIn();
    await userEvent.click(accountMenu());
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Dark" }),
    );
    expect(shown()).toBe("dark");
    expect(localStorage.getItem(stored)).toBe("dark");
    await userEvent.click(accountMenu());
    expect(
      await screen.findByRole("menuitem", { name: "Dark, chosen" }),
    ).toBeDefined();
    await userEvent.click(screen.getByRole("menuitem", { name: "System" }));
    expect(localStorage.getItem(stored)).toBe("auto");
  });

  it("is chosen with the keyboard, and Escape leaves the choice as it was", async () => {
    await openSignedIn();
    accountMenu().focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("menuitem", { name: "Dark" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menuitem", { name: "Dark" })).toBeNull();
    });
    expect(localStorage.getItem(stored)).toBeNull();
    accountMenu().focus();
    await userEvent.keyboard("{Enter}");
    const dark = await screen.findByRole("menuitem", { name: "Dark" });
    while (document.activeElement !== dark) {
      await userEvent.keyboard("{ArrowDown}");
    }
    await userEvent.keyboard("{Enter}");
    expect(shown()).toBe("dark");
  });

  it("opens signed-in pages in the mode chosen before", async () => {
    localStorage.setItem(stored, "dark");
    await openSignedIn();
    expect(shown()).toBe("dark");
  });

  it("shows the sign-in page in the mode chosen before", async () => {
    localStorage.setItem(stored, "light");
    serverAnswers({ "GET /api/session": signedOut });
    renderApp("/");
    await screen.findByRole("heading", { name: "Sign in" });
    expect(shown()).toBe("light");
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
