// SPDX-License-Identifier: Apache-2.0

// Tests for changing a month's teams on Capacity's Feature teams tab: from which day a change takes
// effect, undoing it, and who may change which months.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answer,
  featureTeamsAt,
  reader,
  session,
} from "./test-feature-teams.tsx";
import {
  bodyOf,
  fictionalTeamMonths,
  gridNow,
  mobile,
  monthsUrl,
  platform,
  renderApp,
} from "./test-support.tsx";

const months = fictionalTeamMonths;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${gridNow}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("changing a month's teams", () => {
  const proposes = session([
    "people:view",
    "feature-teams:view",
    "feature-teams:edit",
  ]);
  const caseyUrl = "/api/feature-teams/members/p-casey";
  const saved = "00000000-0000-4000-8000-000000000001";
  const undone = "00000000-0000-4000-8000-000000000002";

  async function openEditing(permissions = proposes, search = "") {
    const fetch = answer({
      "GET /api/session": permissions,
      [monthsUrl]: () => Response.json(months),
      [`PATCH ${caseyUrl}`]: () => Response.json({ changeSetId: saved }),
      [`POST /api/undo/${saved}`]: () => Response.json({ changeSetId: undone }),
    });
    renderApp(featureTeamsAt(search));
    await screen.findByRole("grid", { name: "Feature teams by month" });
    return fetch;
  }

  const cell = (month: string) =>
    document.getElementById(`cell-p-casey-${month}`) as HTMLElement;

  it("adds a team from a later month's first day", async () => {
    const fetch = await openEditing();
    act(() => {
      cell("2027-05").focus();
    });

    await userEvent.keyboard("mob");
    await screen.findByRole("option", { name: "Mobile apps" });
    await userEvent.keyboard("{Tab}");

    expect(bodyOf(fetch, "PATCH", caseyUrl)).toEqual([
      { add: [mobile.id], remove: [], from: "2027-05-01" },
    ]);
  });

  it("takes a team away in the current month from today", async () => {
    const fetch = await openEditing();
    act(() => {
      cell("2027-03").focus();
    });

    await userEvent.keyboard("{Delete}");

    expect(bodyOf(fetch, "PATCH", caseyUrl)).toEqual([
      { add: [], remove: [platform.id] },
    ]);
  });

  it("undoes a change with Cmd+Z", async () => {
    const fetch = await openEditing();
    act(() => {
      cell("2027-03").focus();
    });
    await userEvent.keyboard("{Delete}");

    // Undo is offered once the change is saved; pressing it before then does nothing.
    await waitFor(async () => {
      await userEvent.keyboard("{Meta>}z{/Meta}");
      expect(bodyOf(fetch, "POST", `/api/undo/${saved}`)).toEqual([{}]);
    });
  });

  it("leaves a change alone with Cmd+Z while a view is being named", async () => {
    // Given a change saved, and the Save view dialog open on a sorted view
    const fetch = await openEditing(proposes, "?sort=%5B%22name%22%5D");
    act(() => {
      cell("2027-03").focus();
    });
    await userEvent.keyboard("{Delete}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", caseyUrl)).toHaveLength(1);
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Save view…" }),
    );
    await screen.findByRole("dialog", { name: "Save view" });

    // When Cmd+Z is pressed
    await userEvent.keyboard("{Meta>}z{/Meta}");

    // Then nothing is undone until the dialog closes
    expect(bodyOf(fetch, "POST", `/api/undo/${saved}`)).toEqual([]);
    await userEvent.keyboard("{Escape}");
    await waitFor(async () => {
      await userEvent.keyboard("{Meta>}z{/Meta}");
      expect(bodyOf(fetch, "POST", `/api/undo/${saved}`)).toEqual([{}]);
    });
  });

  it("leaves earlier months and the person as they are, with no row menu", async () => {
    await openEditing();

    expect(cell("2027-02").getAttribute("aria-readonly")).toBe("true");
    expect(cell("2027-03").hasAttribute("aria-readonly")).toBe(false);
    expect(cell("name").getAttribute("aria-readonly")).toBe("true");
    expect(screen.queryByRole("button", { name: /^Actions for/u })).toBeNull();
  });

  it("lets those who may change Personal details change earlier months", async () => {
    await openEditing(
      session([
        "people:view",
        "feature-teams:view",
        "feature-teams:edit",
        "personal:edit",
      ]),
    );

    expect(cell("2027-02").hasAttribute("aria-readonly")).toBe(false);
  });

  it("changes nothing for those who may not propose team changes", async () => {
    const fetch = await openEditing(reader);
    act(() => {
      cell("2027-03").focus();
    });

    await userEvent.keyboard("{Delete}");

    expect(bodyOf(fetch, "PATCH", caseyUrl)).toEqual([]);
    expect(within(cell("2027-03")).getByText(platform.name)).toBeDefined();
  });
});
