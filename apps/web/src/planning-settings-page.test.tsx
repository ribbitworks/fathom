// SPDX-License-Identifier: Apache-2.0

// Tests for the Planning settings page: the settings read only and changed in place, the working
// week, refusals, undo, ramp-up months, a failed load, and a draft of the settings.

import {
  type PlanningSettings,
  type PlanningSettingsChange,
  changedSettings,
  effortConversionsOf,
  startingEffortConversions,
  startingPlanningSettings,
} from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  detailRow,
  detailValue,
  fictionalUser,
  recordDraft,
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
    "GET /api/effort-conversions": () =>
      Response.json(effortConversionsOf(held)),
  });
  return fetch;
}

const editor = [
  "plan:view",
  "features:view",
  "configuration:view",
  "configuration:edit",
];

async function openSettings() {
  renderApp("/planning-settings");
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

describe("the settings read only", () => {
  it("shows every setting, with no pencils or buttons", async () => {
    settingsServer(["plan:view", "features:view", "configuration:view"]);
    await openSettings();
    expect(
      screen.getByRole("heading", { name: "Planning settings" }),
    ).toBeDefined();
    expect(
      [
        "Hours a day",
        "Working days",
        "Week starts on",
        "Working days a month",
        "Default focus",
        "Default buffer",
        "Month 1",
        "Month 2",
        "From month 3",
      ].map((label) => detailValue(label)),
    ).toEqual([
      "8",
      "Mon to Fri",
      "Monday",
      "20",
      "80%",
      "0%",
      "50%",
      "75%",
      "100%",
    ]);
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
    renderApp("/planning-settings");
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
    expect(screen.getByText("Use 1% to 100% for Default focus")).toBeDefined();
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
    expect(screen.getByText("Use 1% to 100% for Month 2")).toBeDefined();
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

describe("the working week", () => {
  const box = (day: string) => screen.getByRole("button", { name: day });
  const weekdaysShown = () =>
    within(screen.getByRole("toolbar", { name: "Working days" }))
      .getAllByRole("button")
      .map(({ textContent }) => textContent);

  async function openDays() {
    await userEvent.click(pencil("Working days"));
    const [first] = within(
      screen.getByRole("toolbar", { name: "Working days" }),
    ).getAllByRole("button");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(first);
    });
  }

  it("opens a box for each day, the week's first first, the working days ticked", async () => {
    settingsServer(editor, { ...startingPlanningSettings, weekStartsOn: 6 });
    await openSettings();
    await openDays();
    expect(weekdaysShown()).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(box("Friday").getAttribute("aria-pressed")).toBe("true");
    expect(box("Saturday").getAttribute("aria-pressed")).toBe("false");
  });

  it("saves the days ticked with Enter, with focus back on the pencil", async () => {
    // Given
    const fetch = settingsServer(editor);
    await openSettings();
    await openDays();
    // When
    await userEvent.click(box("Saturday"));
    await userEvent.keyboard("{Enter}");
    // Then
    expect(bodyOf(fetch, "PATCH", path)).toEqual([
      { workingDays: [0, 1, 2, 3, 4, 5] },
    ]);
    expect(detailValue("Working days")).toBe("Mon to Sat");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(pencil("Working days"));
    });
  });

  it("moves between the days with the arrow keys, round the week, and ticks one with Space", async () => {
    const fetch = settingsServer(editor);
    await openSettings();
    await openDays();
    await userEvent.keyboard("{ArrowLeft}");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(box("Sunday"));
    });
    await userEvent.keyboard("{ArrowRight}");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(box("Monday"));
    });
    await userEvent.keyboard(" ");
    await userEvent.tab();
    expect(bodyOf(fetch, "PATCH", path)).toEqual([
      { workingDays: [1, 2, 3, 4] },
    ]);
  });

  it("refuses no working day, keeping the boxes open, and saves nothing", async () => {
    // Given
    const fetch = settingsServer(editor);
    await openSettings();
    await openDays();
    // When
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday"]) {
      await userEvent.click(box(day));
    }
    expect(screen.queryByText("Working day needed")).toBeNull();
    await userEvent.click(box("Friday"));
    await userEvent.keyboard("{Enter}");
    // Then
    // The focused box is read with the reason.
    expect(document.activeElement).toBe(box("Friday"));
    expect(
      document.getElementById(
        box("Friday").getAttribute("aria-describedby") ?? "",
      )?.textContent,
    ).toBe("Working day needed");
    expect(bodyOf(fetch, "PATCH", path)).toEqual([]);
  });

  it("clears the refusal once a day is ticked", async () => {
    settingsServer(editor, { ...startingPlanningSettings, workingDays: [2] });
    await openSettings();
    await openDays();
    await userEvent.click(box("Wednesday"));
    await userEvent.click(box("Thursday"));
    expect(screen.queryByText("Working day needed")).toBeNull();
  });

  it("puts the days back with Esc, with focus back on the pencil", async () => {
    const fetch = settingsServer(editor);
    await openSettings();
    await openDays();
    await userEvent.click(box("Monday"));
    await userEvent.keyboard("{Escape}");
    expect(detailValue("Working days")).toBe("Mon to Fri");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(pencil("Working days"));
    });
    expect(bodyOf(fetch, "PATCH", path)).toEqual([]);
  });

  it("puts the days back when left with none ticked", async () => {
    settingsServer(editor, { ...startingPlanningSettings, workingDays: [2] });
    await openSettings();
    await openDays();
    await userEvent.click(box("Wednesday"));
    await userEvent.click(screen.getByRole("heading", { name: "Forecasts" }));
    expect(detailValue("Working days")).toBe("Wed");
  });

  it("saves nothing when the days are left as they were", async () => {
    const fetch = settingsServer(editor);
    await openSettings();
    await openDays();
    await userEvent.keyboard("{Enter}");
    expect(detailValue("Working days")).toBe("Mon to Fri");
    expect(bodyOf(fetch, "PATCH", path)).toEqual([]);
  });

  it("changes the day a week starts on, which orders the days' words", async () => {
    // Given
    const fetch = settingsServer(editor, {
      ...startingPlanningSettings,
      workingDays: [0, 1, 2, 3, 6],
    });
    await openSettings();
    expect(detailValue("Working days")).toBe("Mon to Thu, Sun");
    // When
    await userEvent.click(pencil("Week starts on"));
    await userEvent.click(
      await screen.findByRole("option", { name: "Sunday" }),
    );
    // Then
    expect(bodyOf(fetch, "PATCH", path)).toEqual([{ weekStartsOn: 6 }]);
    expect(detailValue("Week starts on")).toBe("Sunday");
    expect(detailValue("Working days")).toBe("Sun to Thu");
  });

  it("marks drafted days, with the live days under them", async () => {
    serverAnswers({
      "GET /api/session": sessionWith(...editor),
      [`GET ${path}`]: () =>
        Response.json({
          ...startingPlanningSettings,
          workingDays: [0, 1, 2, 3, 6],
          weekStartsOn: 6,
          draft: recordDraft({
            changed: ["workingDays", "weekStartsOn"],
            live: { workingDays: [0, 1, 2, 3, 4], weekStartsOn: 0 },
          }),
        }),
    });
    await openSettings();
    expect(detailValue("Working days")).toMatch(
      /^Sun to Thu.*Mon to Fri, live$/,
    );
    expect(detailValue("Week starts on")).toMatch(/^Sunday.*Monday, live$/);
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

describe("a draft of the settings", () => {
  const draftPath = "/api/records/planning-settings/planning-settings/draft";
  const drafted = {
    ...startingPlanningSettings,
    hoursPerDay: 7.5,
    rampUpPercents: [50],
    draft: recordDraft({
      changed: ["hoursPerDay", "rampUpPercents"],
      live: { hoursPerDay: 8, rampUpPercents: [50, 75] },
    }),
  };
  const approver = [...editor, "configuration:approve"];

  function draftServer(permissions: string[], settings: object = drafted) {
    return serverAnswers({
      "GET /api/session": sessionWith(...permissions),
      [`GET ${path}`]: () => Response.json(settings),
      "POST /api/drafts/approval": () => Response.json({ changeSetId }),
      [`DELETE ${draftPath}`]: () => Response.json({ changeSetId }),
      [`DELETE ${draftPath}/rejection`]: () => Response.json({ changeSetId }),
      "GET /api/effort-conversions": () =>
        Response.json(startingEffortConversions),
    });
  }

  async function chooseInDraftMenu(item: string) {
    await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
    await userEvent.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: item,
      }),
    );
  }

  it("marks each setting it changes, with the live value under it", async () => {
    draftServer(editor);
    await openSettings();
    expect(
      ["Hours a day", "Working days a month", "Month 1", "Month 2"].map(
        (label) => detailValue(label),
      ),
    ).toEqual([
      "7.5, Draft: changed from “8”8, live",
      "20",
      "50%",
      "No month 2, Draft: changed from “75”75, live",
    ]);
  });

  it("marks a month it adds, with no month live", async () => {
    draftServer(editor, {
      ...drafted,
      rampUpPercents: [50, 75, 90],
      draft: recordDraft({
        changed: ["rampUpPercents"],
        live: { rampUpPercents: [50, 75] },
      }),
    });
    await openSettings();
    expect(detailValue("Month 3")).toMatch(/^90%.*No month 3, live$/);
  });

  it("takes a rejected draft back under Drafts applied", async () => {
    draftServer(editor, {
      ...drafted,
      draft: { ...drafted.draft, state: "rejected", reason: "Too short" },
    });
    await openSettings();
    await chooseInDraftMenu("Drafts applied");
    expect(detailValue("Hours a day")).toMatch(/^8/);
  });

  it("keeps the Draft menu's choice in the address, and none for Drafts & Live", async () => {
    draftServer(editor);
    const history = renderApp("/planning-settings");
    await screen.findByText("Hours a day", { selector: "dt" });
    await chooseInDraftMenu("Live only");
    expect(history.location.search).toBe("?show=live");
    await chooseInDraftMenu("Drafts & Live");
    expect(history.location.search).toBe("");
  });

  it("shows the settings as they are live, read only, under Live only", async () => {
    draftServer(editor);
    await openSettings();
    await chooseInDraftMenu("Live only");
    expect(detailValue("Hours a day")).toMatch(/^8/);
    expect(detailValue("Month 2")).toMatch(/^75%/);
    expect(screen.queryByRole("button", { name: /^Change / })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add month" })).toBeNull();
  });

  const rowMenu = "Actions for Planning settings";

  async function openRowMenu() {
    const [first] = screen.getAllByRole("button", { name: rowMenu });
    if (first !== undefined) await userEvent.click(first);
    return screen.findByRole("menu");
  }

  async function chooseInRowMenu(item: string) {
    await userEvent.click(
      within(await openRowMenu()).getByRole("menuitem", { name: item }),
    );
  }

  it("offers a menu on each changed row alone, naming every change", async () => {
    draftServer(approver);
    await openSettings();
    expect(screen.getAllByRole("button", { name: rowMenu })).toHaveLength(2);
    const menu = await openRowMenu();
    expect(
      within(menu)
        .getAllByRole("paragraph")
        .map(({ textContent }) => textContent),
    ).toEqual([
      "Hours a day from 8 to 7.5, by Fictional Editor",
      "Ramp-up from 50%, 75% to 50%, by Fictional Editor",
    ]);
  });

  it.each<[string, object, Parameters<typeof recordDraft>[0], string[]]>([
    [
      "with the week's start",
      { workingDays: [0, 1, 2, 3, 6], weekStartsOn: 6 },
      {
        changed: ["workingDays", "weekStartsOn"],
        live: { workingDays: [0, 1, 2, 3, 4], weekStartsOn: 0 },
      },
      [
        "Working days from Mon, Tue, Wed, Thu, Fri to Sun, Mon, Tue, Wed, Thu, by Fictional Editor",
        "Week starts on from Monday to Sunday, by Fictional Editor",
      ],
    ],
    [
      "alone",
      { workingDays: [0, 1, 2, 3, 6], weekStartsOn: 6 },
      { changed: ["workingDays"], live: { workingDays: [0, 1, 2, 3, 4] } },
      [
        "Working days from Mon, Tue, Wed, Thu, Fri to Sun, Mon, Tue, Wed, Thu, by Fictional Editor",
      ],
    ],
  ])(
    "names drafted days %s in each week's own order",
    async (_how, settings, draft, lines) => {
      draftServer(approver, {
        ...startingPlanningSettings,
        ...settings,
        draft: recordDraft(draft),
      });
      await openSettings();
      const menu = await openRowMenu();
      expect(
        within(menu)
          .getAllByRole("paragraph")
          .map(({ textContent }) => textContent),
      ).toEqual(lines);
    },
  );

  it("publishes the user's own unpublished draft from a changed row's menu", async () => {
    // Given
    const fetch = serverAnswers({
      "GET /api/session": sessionWith(...editor),
      [`GET ${path}`]: () =>
        Response.json({
          ...drafted,
          draft: { ...drafted.draft, unpublished: true },
        }),
      "GET /api/unpublished": () =>
        Response.json({
          changes: [
            {
              subject: "the planning settings",
              action: "changed",
              key: "planning-settings planning-settings",
              linked: [],
            },
          ],
        }),
      "POST /api/unpublished/publish": () =>
        Response.json({ total: 1, left: 0 }),
    });
    await openSettings();
    // When
    await chooseInRowMenu("Publish draft…");
    // Then
    expect(await screen.findByText("Published 1 change.")).toBeDefined();
    expect(
      (
        bodyOf(fetch, "POST", "/api/unpublished/publish") as {
          drafts: { records: unknown[] };
        }[]
      ).map(({ drafts }) => drafts.records),
    ).toEqual([[{ type: "planning-settings", id: "planning-settings" }]]);
  });

  it("offers no row menus under Live only", async () => {
    draftServer(approver);
    await openSettings();
    await chooseInDraftMenu("Live only");
    expect(screen.queryByRole("button", { name: rowMenu })).toBeNull();
  });

  it("is approved from a changed row's menu", async () => {
    const fetch = draftServer(approver);
    await openSettings();
    await chooseInRowMenu("Approve…");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        expect.objectContaining({
          records: [{ type: "planning-settings", id: "planning-settings" }],
        }),
      ]);
    });
  });

  it("offers no Approve to those who can't approve configuration", async () => {
    draftServer(editor);
    await openSettings();
    const menu = await openRowMenu();
    expect(
      within(menu).queryByRole("menuitem", { name: "Approve…" }),
    ).toBeNull();
    expect(
      within(menu).getByRole("menuitem", { name: "Discard draft" }),
    ).toBeDefined();
  });

  it("is discarded from a changed row's menu", async () => {
    const fetch = draftServer(editor);
    await openSettings();
    await chooseInRowMenu("Discard draft");
    await waitFor(() => {
      expect(
        fetch.mock.calls.some(
          ([url, init]) => url === draftPath && init?.method === "DELETE",
        ),
      ).toBe(true);
    });
  });

  it("leaves the draft waiting when the approval dialog is closed", async () => {
    const fetch = draftServer(approver);
    await openSettings();
    await chooseInRowMenu("Approve…");
    await screen.findByRole("dialog", { name: "Approve 1 draft?" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([]);
  });

  it("is sent for approval again from a changed row's menu once rejected", async () => {
    const fetch = draftServer(editor, {
      ...drafted,
      draft: { ...drafted.draft, state: "rejected", reason: "Too short" },
    });
    await openSettings();
    await chooseInRowMenu("Resubmit");
    await waitFor(() => {
      expect(
        fetch.mock.calls.some(
          ([url, init]) =>
            url === `${draftPath}/rejection` && init?.method === "DELETE",
        ),
      ).toBe(true);
    });
  });

  it("is read only while someone else is changing the settings, saying who", async () => {
    draftServer(editor, {
      ...startingPlanningSettings,
      heldBy: "Fictional Other",
    });
    await openSettings();
    expect(screen.getByText("Being changed by Fictional Other")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Change / })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add month" })).toBeNull();
  });
});
