// SPDX-License-Identifier: Apache-2.0

// Tests for the Capacity page's tabs, which a role sees and which the address keeps, the planning
// settings' old tab, and the link to Planning settings.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  address,
  grid,
  openAllocations,
  seesAllocations,
} from "./test-capacity.tsx";
import { gridNow } from "./test-support.tsx";

const tab = (name: string) => screen.getByRole("tab", { name });

const settingsLink = () =>
  within(screen.getByRole("main")).queryByRole("link", {
    name: "Planning settings",
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${gridNow}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the tabs of the Capacity page", () => {
  it("opens on Feature teams for a role that sees every tab", async () => {
    const history = openAllocations("?mode=feature-teams");
    await screen.findByRole("grid", { name: "Feature teams by month" });

    expect(
      ["Feature teams", "Allocations"].map((name) =>
        tab(name).getAttribute("aria-selected"),
      ),
    ).toEqual(["true", "false"]);
    expect(screen.queryByRole("tab", { name: "Settings" })).toBeNull();
    expect(address(history)).toBe("?mode=feature-teams");
  });

  it("switches tabs, kept in the address", async () => {
    const history = openAllocations("?mode=feature-teams");
    await screen.findByRole("grid", { name: "Feature teams by month" });

    await userEvent.click(tab("Allocations"));
    await grid();
    expect(address(history)).toBe("?mode=allocations");
  });

  it("keeps the tab as the view changes", async () => {
    const history = openAllocations();
    await grid();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "Casey",
    );

    await waitFor(() => {
      expect(address(history)).toBe("?search=Casey&mode=allocations");
    });
  });

  it("opens on the first tab, naming none in the address, when none is asked for", async () => {
    const history = openAllocations("", { tab: null });
    await screen.findByRole("grid", { name: "Feature teams by month" });

    expect(tab("Feature teams").getAttribute("aria-selected")).toBe("true");
    expect(address(history)).toBe("");
  });

  it("opens Allocations for People, its name before", async () => {
    const history = openAllocations("?mode=people");
    await grid();

    expect(tab("Allocations").getAttribute("aria-selected")).toBe("true");
    expect(address(history)).toBe("?mode=allocations");
  });

  it("keeps the tab shown in the address, not one the role doesn't see", async () => {
    const history = openAllocations("?mode=allocations", {
      permissions: ["feature-teams:view", "personal:view"],
    });
    await screen.findByRole("grid", { name: "Feature teams by month" });

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "Casey",
    );

    await waitFor(() => {
      expect(address(history)).toBe("?search=Casey&mode=feature-teams");
    });
  });

  it("offers Allocations only with the feature teams and people its grid reads", async () => {
    openAllocations("?mode=allocations", {
      permissions: ["allocations:view", "feature-teams:view", "personal:view"],
    });

    await screen.findByRole("grid", { name: "Feature teams by month" });
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it.each([
    ["sees no tab", ["allocations:view", "feature-teams:view", "people:view"]],
    ["sees only configuration", ["configuration:view", "people:view"]],
  ])("is not there for a role that %s", async (_role, permissions) => {
    openAllocations("", { permissions });

    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});

describe("the planning settings' old tab", () => {
  it("opens Planning settings", async () => {
    const history = openAllocations("?mode=settings");

    expect(
      await screen.findByRole("heading", { name: "Planning settings" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/planning-settings");
  });
});

describe("the link to Planning settings", () => {
  it("opens Planning settings for a role that sees configuration", async () => {
    const history = openAllocations();
    await grid();

    await userEvent.click(
      within(screen.getByRole("main")).getByRole("link", {
        name: "Planning settings",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Planning settings" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/planning-settings");
  });

  it("isn't there for a role that doesn't see configuration", async () => {
    openAllocations("", { permissions: seesAllocations });
    await grid();

    expect(settingsLink()).toBeNull();
  });
});
