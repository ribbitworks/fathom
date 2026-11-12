// SPDX-License-Identifier: Apache-2.0

// Tests for the Capacity page and its Settings tab, with the server's responses simulated: the
// settings read only and changed in place, a value refused, undoing a change, months of ramp-up
// added and removed, and the settings that cannot be loaded.

import {
  type PlanningSettings,
  type PlanningSettingsChange,
  changedSettings,
  startingPlanningSettings,
} from "@fathom/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  detailRow,
  detailValue,
  fictionalUser,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

const path = "/api/planning-settings";
const changeSetId = "20000000-0000-4000-8000-000000000001";

afterEach(() => {
  vi.unstubAllGlobals();
});

const sessionWith =
  (...permissions: string[]) =>
  () =>
    Response.json({ ...fictionalUser, permissions });

// The server, holding the settings as each change leaves them, and putting them back on undo.
function settingsServer(
  permissions: string[],
  starting: PlanningSettings = startingPlanningSettings,
) {
  let held = starting;
  let before = starting;
  const fetch = serverAnswers({
    "GET /api/session": sessionWith(...permissions),
    [`GET ${path}`]: () => Response.json(held),
    [`PATCH ${path}`]: () => {
      const [change] = bodyOf(fetch, "PATCH", path).slice(-1) as [
        PlanningSettingsChange,
      ];
      before = held;
      held = changedSettings(held, change);
      return Response.json({ settings: held, changeSetId });
    },
    [`POST /api/undo/${changeSetId}`]: () => {
      held = before;
      return Response.json({ changeSetId: null });
    },
    "GET /api/effort-conversions": () => Response.json(held),
  });
  return fetch;
}

const editor = ["plan:view", "configuration:view", "configuration:edit"];

async function openSettings() {
  renderApp("/capacity");
  await screen.findByText("Hours a day", { selector: "dt" });
}

const pencil = (label: string) =>
  screen.getByRole("button", { name: `Change ${label}` });

async function change(label: string, typed: string) {
  await userEvent.click(pencil(label));
  const field = screen.getByRole<HTMLInputElement>("textbox", { name: label });
  await userEvent.clear(field);
  await userEvent.type(field, `${typed}{Enter}`);
}

describe("the Capacity page", () => {
  it("opens on its Settings tab, kept in the address", async () => {
    settingsServer(["plan:view", "configuration:view"]);
    const history = renderApp("/capacity?tab=settings");
    expect(
      await screen.findByRole("heading", { name: "Capacity" }),
    ).toBeDefined();
    expect(
      screen
        .getByRole("tab", { name: "Settings" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    await userEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(history.location.search).toContain("tab=settings");
  });
});

describe("the settings read only", () => {
  it("shows every setting, with no pencils or buttons", async () => {
    settingsServer(["plan:view", "configuration:view"]);
    await openSettings();
    expect(
      [
        "Hours a day",
        "Working days a week",
        "Working days a month",
        "Default focus",
        "Default buffer",
        "Month 1",
        "Month 2",
        "From month 3",
      ].map((label) => detailValue(label)),
    ).toEqual(["8", "5", "20", "80%", "0%", "50%", "75%", "100%"]);
    expect(screen.queryByRole("button", { name: /^Change / })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add month" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
  });

  it("says when the settings cannot be loaded, and tries again", async () => {
    let attempts = 0;
    serverAnswers({
      "GET /api/session": sessionWith("plan:view", "configuration:view"),
      [`GET ${path}`]: () => {
        attempts += 1;
        return attempts === 1
          ? Response.json({ error: "Failed" }, { status: 500 })
          : Response.json(startingPlanningSettings);
      },
    });
    renderApp("/capacity");
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not load the planning settings/,
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("Hours a day", { selector: "dt" }),
    ).toBeDefined();
  });
});

describe("changing a setting", () => {
  it("saves only the setting changed, at once", async () => {
    // Given
    const fetch = settingsServer(editor);
    await openSettings();
    // When
    await change("Hours a day", "7.5");
    // Then
    expect(detailValue("Hours a day")).toBe("7.5");
    expect(bodyOf(fetch, "PATCH", path)).toEqual([{ hoursPerDay: 7.5 }]);
  });

  it("shows a percentage as one", async () => {
    settingsServer(editor);
    await openSettings();
    await change("Default buffer", "15");
    expect(detailValue("Default buffer")).toBe("15%");
  });

  it("refuses a value out of range, keeping it to correct, and saves nothing", async () => {
    // Given
    const fetch = settingsServer(editor);
    await openSettings();
    // When
    await change("Default focus", "0");
    // Then
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Default focus" })
        .value,
    ).toBe("0");
    expect(screen.getByText("Default focus: use 1% to 100%")).toBeDefined();
    expect(bodyOf(fetch, "PATCH", path)).toEqual([]);
  });

  it("is undone with Cmd+Z, with focus back on its pencil", async () => {
    // Given
    settingsServer(editor);
    await openSettings();
    await change("Working days a month", "21");
    expect(detailValue("Working days a month")).toBe("21");
    // When
    await userEvent.keyboard("{Meta>}z{/Meta}");
    // Then
    await vi.waitFor(() => {
      expect(detailValue("Working days a month")).toBe("20");
    });
    expect(document.activeElement).toBe(pencil("Working days a month"));
  });

  it("names a refused month of ramp-up by its row", async () => {
    settingsServer(editor);
    await openSettings();
    await change("Month 2", "120");
    expect(screen.getByText("Month 2: use 1% to 100%")).toBeDefined();
  });

  it("changes one month of ramp-up, keeping the others", async () => {
    const fetch = settingsServer(editor);
    await openSettings();
    await change("Month 2", "80");
    expect(bodyOf(fetch, "PATCH", path)).toEqual([
      { rampUpPercents: [50, 80] },
    ]);
  });
});

describe("months of ramp-up", () => {
  it("adds a month at full output, with focus on its pencil", async () => {
    // Given
    const fetch = settingsServer(editor);
    await openSettings();
    // When
    await userEvent.click(screen.getByRole("button", { name: "Add month" }));
    // Then
    expect(detailValue("Month 3")).toBe("100%");
    expect(detailRow("From month 4")).toBeDefined();
    expect(bodyOf(fetch, "PATCH", path)).toEqual([
      { rampUpPercents: [50, 75, 100] },
    ]);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(pencil("Month 3"));
    });
  });

  it("removes a month from among the others, with focus on the × now in its place", async () => {
    // Given
    const fetch = settingsServer(editor);
    await openSettings();
    // When
    await userEvent.click(
      screen.getByRole("button", { name: "Remove month 1" }),
    );
    // Then
    expect(detailValue("Month 1")).toBe("75%");
    expect(detailRow("From month 2")).toBeDefined();
    expect(bodyOf(fetch, "PATCH", path)).toEqual([{ rampUpPercents: [75] }]);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Remove month 1" }),
      );
    });
  });

  it("removes the last month, saying so and offering Undo", async () => {
    // Given
    settingsServer(editor);
    await openSettings();
    // When
    await userEvent.click(
      screen.getByRole("button", { name: "Remove month 2" }),
    );
    // Then
    expect(screen.queryByText("Month 2", { selector: "dt" })).toBeNull();
    expect(
      await screen.findByText("Removed month 2 of ramp-up."),
    ).toBeDefined();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Remove month 1" }),
      );
    });
    // When
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    // Then
    await vi.waitFor(() => {
      expect(detailValue("Month 2")).toBe("75%");
    });
  });

  it("puts focus on Add month once the only month is removed", async () => {
    settingsServer(editor, {
      ...startingPlanningSettings,
      rampUpPercents: [50],
    });
    await openSettings();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove month 1" }),
    );
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Add month" }),
      );
    });
  });

  it("has nothing to remove without months, when new starters work at full output from the first", async () => {
    settingsServer(editor, {
      ...startingPlanningSettings,
      rampUpPercents: [],
    });
    await openSettings();
    expect(detailValue("From month 1")).toBe("100%");
    expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
  });

  it("turns Add month off at twelve months, saying why", async () => {
    settingsServer(editor, {
      ...startingPlanningSettings,
      rampUpPercents: Array.from({ length: 12 }, () => 50),
    });
    await openSettings();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Add month" })
        .disabled,
    ).toBe(true);
    expect(screen.getByText("Ramp-up holds up to 12 months.")).toBeDefined();
  });
});
