// SPDX-License-Identifier: Apache-2.0

// Tests for a feature team's panel on its own, with what it asks to save recorded.

import type { FeatureTeam } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noFeatureTeamEdits } from "./feature-team-panel.tsx";
import { formatDay, plannedWords } from "./day-formats.ts";
import marks from "./status-mark.module.css";
import { detailRow } from "./test-support.tsx";
import {
  changeButton,
  draft,
  everything,
  headingRow,
  memberLines,
  openPanel,
  optionNames,
  pick,
  rowText,
  team,
} from "./test-feature-team-panel.tsx";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-03-10T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a new feature team", () => {
  it("is added with its name, trimmed, its lead and its members", async () => {
    const { asked } = openPanel({ shown: null });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      "  Fictional Beacon ",
    );
    await pick("Members", /^Blake Fictional/);
    await userEvent.click(screen.getByRole("option", { name: /^Avery/ }));
    await userEvent.keyboard("{Enter}");
    await pick("Feature lead", /^Avery Fictional/);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(asked.create).toHaveBeenCalledWith(
      { name: "Fictional Beacon", leadId: "m1", members: ["m1", "m2"] },
      expect.any(Function),
    );
  });

  it("names the server's refusal under Name, with focus in it", async () => {
    const reason = "Another feature team has that name";
    const { asked } = openPanel({ shown: null });
    vi.mocked(asked.create).mockImplementation(
      (
        _request,
        refused: (refusal: { reason: string; field: string }) => boolean,
      ) => {
        refused({ reason, field: "name" });
      },
    );
    const name = screen.getByRole("textbox", { name: "Name" });
    await userEvent.type(name, "Fictional Beacon");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(reason)).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(name);
    });
    expect(name.getAttribute("aria-invalid")).toBe("true");
  });

  it("opens with the cursor in Name, ready to type into", async () => {
    openPanel({ shown: null });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "Name" }),
      );
    });
  });

  it("is refused with no name, saying a name is needed", async () => {
    const { asked } = openPanel({ shown: null });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Name needed")).toBeDefined();
    expect(asked.create).not.toHaveBeenCalled();
  });

  it("is added from the day the chart shows", async () => {
    const { asked } = openPanel({ shown: null, day: "2027-05-01" });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Fictional Beacon",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(asked.create).toHaveBeenCalledWith(
      {
        name: "Fictional Beacon",
        leadId: null,
        members: [],
        from: "2027-05-01",
      },
      expect.any(Function),
    );
  });

  it("closes on Cancel", async () => {
    const { asked, onClose } = openPanel({ shown: null });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(asked.create).not.toHaveBeenCalled();
  });
});

describe("a feature team's panel", () => {
  it("is titled with the team's name, with its details and members in rows", () => {
    openPanel({ shown: team({ members: ["m2", "m1", "gone"] }) });
    expect(
      screen.getByRole("region", { name: "Fictional Lighthouse" }),
    ).toBeDefined();
    expect([
      rowText("Name"),
      rowText("Colour"),
      rowText("Feature lead"),
    ]).toEqual(["Fictional Lighthouse", "None", "Avery Fictional"]);
    expect(memberLines()).toEqual([
      "Avery Fictional",
      "Blake Fictional",
      "Someone this role can't see",
    ]);
  });

  it("names no members and no lead as None", () => {
    openPanel({ shown: team({ leadId: null, members: [] }) });
    expect([rowText("Feature lead"), rowText("Members")]).toEqual([
      "None",
      "None",
    ]);
  });

  it("names its colour in words", () => {
    openPanel({ shown: team({ colour: "teal" }) });
    expect(rowText("Colour")).toBe("Teal");
  });

  it("closes from its close button", async () => {
    const { onClose } = openPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Close feature team" }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renames the team, trimmed", async () => {
    const { asked } = openPanel();
    await userEvent.click(changeButton("Name") as HTMLElement);
    const name = screen.getByRole("textbox", { name: "Name" });
    expect((name as HTMLInputElement).value).toBe("Fictional Lighthouse");
    await userEvent.clear(name);
    await userEvent.type(name, " Fictional Pier {Enter}");
    expect(asked.rename).toHaveBeenCalledWith(team(), "Fictional Pier");
  });

  it("renames nothing on Esc", async () => {
    const { asked } = openPanel();
    await userEvent.click(changeButton("Name") as HTMLElement);
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      " More{Escape}",
    );
    expect(asked.rename).not.toHaveBeenCalled();
    expect(rowText("Name")).toBe("Fictional Lighthouse");
  });

  it("refuses an empty name, saying a name is needed", async () => {
    const { asked } = openPanel();
    await userEvent.click(changeButton("Name") as HTMLElement);
    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("Name needed")).toBeDefined();
    expect(asked.rename).not.toHaveBeenCalled();
  });

  it("offers None first, then each person who may lead, with their position and the team they are on or whom they report to, then each planned hire, by when it's expected or why it can't join yet", async () => {
    openPanel();
    await userEvent.click(changeButton("Feature lead") as HTMLElement);
    expect(optionNames()).toEqual([
      "None",
      "Avery FictionalFictional Engineer, Fictional Harbour Crew",
      "Blake FictionalFictional Designer, Fictional Harbour Crew",
      "Casey FictionalFictional Engineer, reports to Sasha Fictional",
      "Drew Fictional",
      "Robin FictionalFictional Director",
      "Sasha FictionalFictional Manager",
      "Ellis FictionalCan't join before Jun 2027",
      "Fictional Tester, TBD-7No target date",
    ]);
  });

  it("chooses the lead", async () => {
    const { asked } = openPanel();
    await pick("Feature lead", /^Blake Fictional/);
    expect(asked.lead).toHaveBeenCalledWith(
      team(),
      "m2",
      undefined,
      expect.objectContaining({ about: "leadId" }),
    );
  });

  it("takes the lead away with None", async () => {
    const { asked } = openPanel();
    await pick("Feature lead", "None");
    expect(asked.lead).toHaveBeenCalledWith(
      team(),
      null,
      undefined,
      expect.objectContaining({ about: "leadId" }),
    );
  });

  it("finds people by their position and the team they are on", async () => {
    openPanel();
    await userEvent.click(changeButton("Members") as HTMLElement);
    await userEvent.keyboard("harbour");
    expect(optionNames()).toEqual([
      "Avery FictionalFictional Engineer, Fictional Harbour Crew",
      "Blake FictionalFictional Designer, Fictional Harbour Crew",
    ]);
  });

  it("adds and removes members together, from today", async () => {
    const { asked } = openPanel();
    await userEvent.click(changeButton("Members") as HTMLElement);
    await userEvent.click(screen.getByRole("option", { name: /^Casey/ }));
    await userEvent.click(screen.getByRole("option", { name: /^Blake/ }));
    await userEvent.keyboard("{Enter}");
    expect(asked.members).toHaveBeenCalledWith(
      team(),
      { add: ["p1"], remove: ["m2"] },
      undefined,
      expect.objectContaining({ about: "members" }),
    );
  });

  it("saves nothing when the members chosen are those already on the team", async () => {
    const { asked } = openPanel();
    await userEvent.click(changeButton("Members") as HTMLElement);
    await userEvent.click(screen.getByRole("option", { name: /^Blake/ }));
    await userEvent.click(screen.getByRole("option", { name: /^Blake/ }));
    await userEvent.keyboard("{Enter}");
    expect(asked.members).not.toHaveBeenCalled();
  });

  it("keeps members it does not offer, such as someone the reader does not see", async () => {
    const { asked } = openPanel({
      shown: team({
        members: ["m1", "starting"],
        names: { starting: "Ellis Fictional" },
      }),
    });
    await userEvent.click(changeButton("Members") as HTMLElement);
    await userEvent.click(screen.getByRole("option", { name: /^Casey/ }));
    await userEvent.keyboard("{Enter}");
    expect(asked.members).toHaveBeenCalledWith(
      expect.anything(),
      { add: ["p1"], remove: [] },
      undefined,
      expect.objectContaining({ about: "members" }),
    );
  });

  it("does not offer someone who has left", async () => {
    openPanel();
    await userEvent.click(changeButton("Members") as HTMLElement);
    expect(optionNames().join()).not.toMatch(/Gale/);
  });

  it("makes changes from the day the chart shows", async () => {
    const { asked } = openPanel({ day: "2027-05-01" });
    await pick("Feature lead", /^Blake Fictional/);
    await userEvent.click(changeButton("Members") as HTMLElement);
    await userEvent.click(screen.getByRole("option", { name: /^Casey/ }));
    await userEvent.keyboard("{Enter}");
    expect(asked.lead).toHaveBeenCalledWith(
      team(),
      "m2",
      "2027-05-01",
      expect.objectContaining({ about: "leadId" }),
    );
    expect(asked.members).toHaveBeenCalledWith(
      team(),
      { add: ["p1"], remove: [] },
      "2027-05-01",
      expect.objectContaining({ about: "members" }),
    );
  });

  it("renames, colours and removes nothing on another day, which they take no date from", () => {
    openPanel({ edits: { ...everything, undated: false } });
    expect([changeButton("Name"), changeButton("Colour")]).toEqual([
      null,
      null,
    ]);
    expect(
      screen.queryByRole("button", { name: "Remove feature team" }),
    ).toBeNull();
  });

  it("chooses the team's colour", async () => {
    const { asked } = openPanel({ shown: team({ colour: "teal" }) });
    await userEvent.click(
      screen.getByRole("button", { name: "Change Colour" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Grape" }),
    );
    expect(asked.colour).toHaveBeenCalledWith(team({ colour: "teal" }));
  });

  it("removes the team", async () => {
    const { asked } = openPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove feature team" }),
    );
    expect(asked.removeTeam).toHaveBeenCalledWith(team());
  });
});

describe("a feature team's draft in its panel", () => {
  const drafted = team({
    name: "Fictional Drafted",
    leadId: "m2",
    members: ["m2", "p1"],
    draft: draft({
      changed: ["name", "leadId", "members"],
      live: {
        name: "Fictional Lighthouse",
        leadId: "m1",
        members: ["m1", "m2"],
      },
    }),
  });

  it("gives each drafted value with its live one, and marks the members it adds and removes", () => {
    openPanel({ shown: drafted });
    expect(rowText("Name")).toBe(
      "Fictional Drafted, Draft: changed from “Fictional Lighthouse”Fictional Lighthouse, live",
    );
    expect(rowText("Feature lead")).toBe(
      "Blake Fictional, Draft: changed from “Avery Fictional”Avery Fictional, live",
    );
    expect(memberLines()).toEqual([
      "Avery Fictional, removed",
      "Blake Fictional",
      "Casey Fictional, added",
    ]);
    expect(screen.getByRole("button", { name: "Discard draft" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Resubmit" })).toBeNull();
  });

  it("says when each change takes effect where it is not the day shown", () => {
    openPanel({
      shown: team({
        ...drafted,
        draft: {
          ...drafted.draft,
          days: { p1: "2027-05-01", m1: "2027-06-01" },
          leadDay: "2027-04-01",
        },
      } as FeatureTeam),
      day: "2027-05-01",
    });
    expect(memberLines()).toEqual([
      `Avery Fictionalfrom ${formatDay("2027-06-01")}, removed`,
      "Blake Fictional",
      "Casey Fictional, added",
    ]);
    expect(rowText("Feature lead")).toContain(
      `Draft: changed from “Avery Fictional”, from ${formatDay("2027-04-01")}`,
    );
  });

  it("gives the day of a change given no day, on another day shown", () => {
    openPanel({ shown: drafted, day: "2027-06-01" });
    expect(memberLines()).toContain(
      `Avery Fictionalfrom ${formatDay("2027-03-10")}, removed`,
    );
  });

  it("reads no live lead as empty, with no words for none", () => {
    openPanel({
      shown: team({
        draft: draft({ changed: ["leadId"], live: { leadId: null } }),
      }),
    });
    expect(rowText("Feature lead")).toBe(
      "Avery Fictional, Draft: filled in, live, empty",
    );
  });

  it("leaves a rejected draft's reason out of when a member's change takes effect", () => {
    openPanel({
      shown: team({
        ...drafted,
        draft: {
          ...drafted.draft,
          state: "rejected",
          reason: "Fictional reason",
          days: { m1: "2027-06-01" },
        },
      } as FeatureTeam),
      day: "2027-05-01",
    });
    expect(memberLines()).toContain(
      `Avery Fictionalfrom ${formatDay("2027-06-01")}, removed, rejected`,
    );
  });

  it("discards the draft", async () => {
    const { asked } = openPanel({ shown: drafted });
    await userEvent.click(
      screen.getByRole("button", { name: "Discard draft" }),
    );
    expect(asked.discard).toHaveBeenCalledWith(drafted);
  });

  it("gives a rejected draft's reason, and sends it again", async () => {
    const rejected = team({
      draft: draft({ state: "rejected", reason: "Fictional reason" }),
    });
    const { asked } = openPanel({ shown: rejected });
    expect(screen.getByText("Reason: Fictional reason")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Resubmit" }));
    expect(asked.resubmit).toHaveBeenCalledWith(rejected);
  });

  it("gives no reason for a rejected draft without one", () => {
    openPanel({ shown: team({ draft: draft({ state: "rejected" }) }) });
    expect(screen.queryByText(/^Reason:/)).toBeNull();
    expect(screen.getByRole("button", { name: "Resubmit" })).toBeDefined();
  });

  it("offers no changes to a team the draft removes, marking it in the title", () => {
    openPanel({ shown: team({ draft: draft({ action: "deleted" }) }) });
    expect(headingRow().textContent).toBe(
      "Fictional Lighthouse, Draft: removed",
    );
    expect([
      screen.queryByRole("button", { name: "Remove feature team" }),
      screen.queryByRole("button", { name: /^Change / }),
      screen.queryByRole("button", { name: "Change Colour" }),
    ]).toEqual([null, null, null]);
  });

  it("offers no colour for a team only drafted to be added, marking it in the title", () => {
    openPanel({ shown: team({ draft: draft({ action: "created" }) }) });
    expect(headingRow().textContent).toBe("Fictional Lighthouse, Draft: added");
    expect(screen.queryByRole("button", { name: "Change Colour" })).toBeNull();
  });

  it("offers no changes to a team someone else is changing, but for its colour, which is no draft", () => {
    openPanel({ shown: { ...drafted, heldBy: "Fictional Editor" } });
    expect([
      screen.queryByRole("button", {
        name: /^Change (Name|Feature lead|Members)$/,
      }),
      screen.queryByRole("button", { name: "Discard draft" }),
      screen.queryByRole("button", { name: /^Remove / }),
    ]).toEqual([null, null, null]);
    expect(memberLines()).toContain("Blake Fictional");
  });
});

describe("a feature team's panel read only", () => {
  it("shows the team's rows with nothing to change, to those who may not change teams", () => {
    openPanel({ edits: noFeatureTeamEdits });
    expect(rowText("Feature lead")).toBe("Avery Fictional");
    expect([
      screen.queryByRole("button", { name: /^Change / }),
      screen.queryByRole("button", { name: "Change Colour" }),
      screen.queryByRole("button", { name: /^Remove / }),
    ]).toEqual([null, null, null]);
  });

  it("shows the team as it is live with Live only, offering no changes but for its colour", () => {
    openPanel({
      shown: team({
        name: "Fictional Drafted",
        members: ["m1", "p1"],
        draft: draft({
          changed: ["name", "members"],
          live: { name: "Fictional Lighthouse", members: ["m1", "m2"] },
        }),
      }),
      show: "live",
    });
    expect(rowText("Name")).toBe(
      "Fictional Lighthouse, Live. A change is waiting for approval.",
    );
    expect(memberLines()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect([
      screen.queryByText(/Draft/),
      screen.queryByRole("button", {
        name: /^Change (Name|Feature lead|Members)$/,
      }),
      screen.queryByRole("button", { name: "Discard draft" }),
    ]).toEqual([null, null, null]);
  });

  it("shows a team only drafted to be added as drafted, with Live only", () => {
    openPanel({
      shown: team({ draft: draft({ action: "created" }) }),
      show: "live",
    });
    expect(memberLines()).toEqual(["Avery Fictional", "Blake Fictional"]);
  });
});
