// SPDX-License-Identifier: Apache-2.0

// Tests for adding planned hires to a feature team in its panel, as members and as its lead: how
// the pickers describe them, those turned off, the days a drafted hire shows, and the server's
// refusals, named in the row they were chosen in.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Refusal } from "./api.ts";
import { formatDay, formatMonth } from "./day-formats.ts";
import type { RefusedIn } from "./feature-team-panel.tsx";
import { detailRow } from "./test-support.tsx";
import {
  changeButton,
  draft,
  hireLines,
  hireNames,
  memberLines,
  openPanel,
  optionNames,
  pick,
  rowText,
  team,
  teamHires,
} from "./test-feature-team-panel.tsx";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-03-10T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

const cantJoin = "This planned hire can't join or lead a team.";

// The server's answer, given after the change is sent, once the row's editor has closed, with
// whether the panel named it.
const answerLater = (refused: RefusedIn, refusal: Omit<Refusal, "field">) =>
  new Promise<boolean>((resolve) => {
    void Promise.resolve().then(() => {
      resolve(
        refused.onRefused({ ...refusal, field: refused.about as string }),
      );
    });
  });

describe("planned hires in a feature team's details", () => {
  it("lists people under Members and planned hires under Planned hires, filled first, then by the month expected, with no target date last", () => {
    openPanel({
      shown: team({
        members: ["tbd", "m2", "later", "hire", "filled", "m1"],
        names: hireNames,
        hires: teamHires,
      }),
    });
    expect(memberLines()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(hireLines()).toEqual([
      `Fictional Data Engineer #HIRE-5Filled by Fictional Joiner, starts ${formatDay("2027-02-01")}`,
      `Ellis Fictional #HIRE-9Expected ${formatMonth("2027-06")}`,
      `Fictional Analyst #HIRE-3Expected ${formatMonth("2027-09")}`,
      "Fictional Tester, TBD-7 #HIRE-12No target date",
    ]);
  });

  it("marks no planned hire with a Planned box, which its row's label says", () => {
    openPanel({
      shown: team({
        members: ["m1", "hire"],
        names: hireNames,
        hires: teamHires,
      }),
    });
    expect(rowText("Planned hires")).not.toMatch(/Planned/);
  });

  it("names a planned hire with no name of its own by its position and ID in grey italics", () => {
    openPanel({
      shown: team({
        members: ["m1", "tbd", "hire"],
        names: hireNames,
        hires: teamHires,
      }),
    });
    const hires = within(detailRow("Planned hires"));
    expect(
      hires.getByText("Fictional Tester, TBD-7").getAttribute("style"),
    ).toContain("italic");
    expect(
      hires.getByText("Ellis Fictional").getAttribute("style") ?? "",
    ).not.toContain("italic");
  });

  it("names a planned hire leading the team on the same two lines, listing it under Planned hires too", () => {
    openPanel({
      shown: team({
        leadId: "tbd",
        members: ["tbd", "m1"],
        names: hireNames,
        hires: teamHires,
      }),
    });
    expect(rowText("Feature lead")).toBe(
      "Fictional Tester, TBD-7 #HIRE-12No target date",
    );
    expect(hireLines()).toEqual([
      "Fictional Tester, TBD-7 #HIRE-12No target date",
    ]);
  });

  it("has no Planned hires row without planned hires, and never a pencil of its own", () => {
    const { unmount } = openPanel();
    expect(screen.queryByText("Planned hires")).toBeNull();
    unmount();
    openPanel({
      shown: team({
        members: ["m1", "hire"],
        names: hireNames,
        hires: teamHires,
      }),
    });
    expect(screen.getByText("Planned hires")).toBeDefined();
    expect(changeButton("Planned hires")).toBeNull();
    expect(changeButton("Members")).not.toBeNull();
  });

  it("gives a planned hire a draft takes off the day of the draft alone", () => {
    openPanel({
      day: "2027-05-01",
      shown: team({
        members: ["m1", "m2"],
        names: hireNames,
        hires: teamHires,
        hiresFrom: { hire: "2027-03-01" },
        draft: draft({
          changed: ["members"],
          live: { members: ["m1", "m2", "hire"] },
          hireDays: { hire: "2027-06-01" },
        }),
      }),
    });
    const [line] = hireLines();
    expect(line).toContain(`from ${formatDay("2027-06-01")}, removed`);
    expect(line).not.toContain(formatDay("2027-03-01"));
  });

  it("marks a planned hire a draft adds under Planned hires", () => {
    openPanel({
      shown: team({
        members: ["m1", "m2", "hire"],
        names: hireNames,
        hires: teamHires,
        draft: draft({ changed: ["members"], live: { members: ["m1", "m2"] } }),
      }),
    });
    expect(memberLines()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(hireLines()).toEqual([
      `Ellis Fictional #HIRE-9, addedExpected ${formatMonth("2027-06")}`,
    ]);
  });
});

describe("planned hires in a feature team's pickers", () => {
  it("offers them after people, each by when it's expected, after its position where its name isn't made from it", async () => {
    openPanel({ day: "2027-06-01" });
    await userEvent.click(changeButton("Members") as HTMLElement);
    expect(optionNames().slice(-2)).toEqual([
      "Ellis FictionalFictional Engineer, expected Jun 2027",
      "Fictional Tester, TBD-7No target date",
    ]);
  });

  it.each(["Members", "Feature lead"] as const)(
    "names a planned hire in %s's picker by its position and ID in grey italics, as everywhere else",
    async (label) => {
      openPanel({ day: "2027-06-01" });
      await userEvent.click(changeButton(label) as HTMLElement);
      const made = screen.getByRole("option", { name: /^Fictional Tester/ });
      const named = screen.getByRole("option", { name: /^Ellis Fictional/ });
      expect(
        within(made).getByText("Fictional Tester, TBD-7").getAttribute("style"),
      ).toContain("italic");
      expect(
        within(named).getByText("Ellis Fictional").getAttribute("style") ?? "",
      ).not.toContain("italic");
    },
  );

  it("finds a planned hire by the month it's expected", async () => {
    openPanel({ day: "2027-06-01" });
    await userEvent.click(changeButton("Members") as HTMLElement);
    await userEvent.keyboard("jun 2027");
    expect(optionNames()).toEqual([
      "Ellis FictionalFictional Engineer, expected Jun 2027",
    ]);
  });

  it("turns off a planned hire not yet expected on the day shown, saying from when it can join", async () => {
    // Given the chart on a day before June 2027, when Ellis is expected
    const { asked } = openPanel({ day: "2027-05-01" });

    // When Ellis is chosen in Members
    await userEvent.click(changeButton("Members") as HTMLElement);
    const ellis = screen.getByRole("option", { name: /^Ellis Fictional/ });
    await userEvent.click(ellis);
    await userEvent.keyboard("{Enter}");

    // Then it is turned off with its reason, and nothing is saved
    expect(ellis.getAttribute("aria-disabled")).toBe("true");
    expect(ellis.textContent).toBe("Ellis FictionalCan't join before Jun 2027");
    expect(asked.members).not.toHaveBeenCalled();
  });

  it("lets the keyboard reach a turned-off hire, which Enter doesn't pick", async () => {
    // Given the chart before June 2027, Ellis expected then, and Members' picker open on Ellis
    const { asked } = openPanel({ day: "2027-05-01" });
    await userEvent.click(changeButton("Members") as HTMLElement);
    await userEvent.keyboard("Ellis");
    const ellis = screen.getByRole("option", { name: /^Ellis Fictional/ });

    // When the arrow keys move onto it and Enter is pressed
    await userEvent.keyboard("{ArrowDown}");
    const picker = screen.getByRole("textbox", { name: "Members" });
    await waitFor(() => {
      expect(picker.getAttribute("aria-activedescendant")).toBe(ellis.id);
    });
    await userEvent.keyboard("{Enter}{Enter}");

    // Then it is the option the keyboard is on, read with its reason, and nothing is saved
    expect(ellis.getAttribute("aria-disabled")).toBe("true");
    expect(asked.members).not.toHaveBeenCalled();
  });

  it("turns off a planned hire a draft removes, in the Feature lead picker too", async () => {
    openPanel({ day: "2027-06-01", removing: new Set(["hire"]) });
    await userEvent.click(changeButton("Feature lead") as HTMLElement);
    const ellis = screen.getByRole("option", { name: /^Ellis Fictional/ });
    expect(ellis.getAttribute("aria-disabled")).toBe("true");
    expect(ellis.textContent).toBe("Ellis FictionalDrafted to be removed");
  });

  it("leaves a planned hire already on the team free to be taken off, whatever the day", async () => {
    const { asked } = openPanel({
      day: "2027-05-01",
      shown: team({
        members: ["m1", "m2", "hire"],
        names: hireNames,
        hires: teamHires,
      }),
    });
    await pick("Members", /^Ellis Fictional/);
    await userEvent.keyboard("{Enter}");
    expect(asked.members).toHaveBeenCalledWith(
      expect.anything(),
      { add: [], remove: ["hire"] },
      "2027-05-01",
      expect.objectContaining({ about: "members" }),
    );
  });

  it("offers the same in New feature team, adding a hire as member and lead, listed under Planned hires", async () => {
    const { asked } = openPanel({ shown: null, day: "2027-06-01" });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Fictional Beacon",
    );
    await pick("Members", /^Ellis Fictional/);
    await userEvent.keyboard("{Enter}");
    await pick("Feature lead", /^Ellis Fictional/);
    expect(hireLines()).toEqual([
      `Ellis Fictional #HIRE-1Expected ${formatMonth("2027-06")}`,
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(asked.create).toHaveBeenCalledWith(
      {
        name: "Fictional Beacon",
        leadId: "hire",
        members: ["hire"],
        from: "2027-06-01",
      },
      expect.any(Function),
    );
  });
});

describe("adding planned hires in a feature team's panel", () => {
  it("adds a planned hire as a member, from the day the chart shows", async () => {
    const { asked } = openPanel({ day: "2027-06-01" });
    await pick("Members", /^Ellis Fictional/);
    await userEvent.keyboard("{Enter}");
    expect(asked.members).toHaveBeenCalledWith(
      team(),
      { add: ["hire"], remove: [] },
      "2027-06-01",
      expect.objectContaining({ about: "members" }),
    );
  });

  it("makes a planned hire not on the team its lead straight away", async () => {
    const { asked } = openPanel();
    await pick("Feature lead", /^Fictional Tester, TBD-7/);
    expect(asked.lead).toHaveBeenCalledWith(
      team(),
      "tbd",
      undefined,
      expect.objectContaining({ about: "leadId" }),
    );
  });

  it("gives a planned hire a draft adds the day it joins, as a person's, unless it's the day shown", () => {
    openPanel({
      shown: team({
        members: ["m1", "m2", "tbd"],
        leadId: "tbd",
        names: hireNames,
        hires: teamHires,
        draft: draft({
          changed: ["members", "leadId"],
          live: { members: ["m1", "m2"], leadId: "m1" },
          hireDays: { tbd: "2027-06-01" },
          hireLeadDay: "2027-06-01",
        }),
      }),
    });
    expect(hireLines()).toEqual([
      expect.stringContaining(`from ${formatDay("2027-06-01")}`),
    ]);
    expect(rowText("Feature lead")).toContain(
      `from ${formatDay("2027-06-01")}`,
    );
  });

  it("gives no day for a planned hire a draft adds from the day shown", () => {
    openPanel({
      shown: team({
        members: ["m1", "m2", "tbd"],
        names: hireNames,
        hires: teamHires,
        draft: draft({
          changed: ["members"],
          live: { members: ["m1", "m2"] },
        }),
      }),
    });
    expect(hireLines()).toEqual([
      "Fictional Tester, TBD-7 #HIRE-12, addedNo target date",
    ]);
  });
});

describe("the server's refusal of a planned hire in a team's panel", () => {
  it("opens Members again on what was chosen, with the reason under it, and nothing else", async () => {
    // Given a server that refuses the hire
    const { asked } = openPanel({ day: "2027-06-01" });
    let named: Promise<boolean> | undefined;
    asked.members.mockImplementation((_team, _change, _from, refused) => {
      named = answerLater(refused, { reason: cantJoin });
    });

    // When Ellis is added
    await pick("Members", /^Ellis Fictional/);
    await userEvent.keyboard("{Enter}");

    // Then Members' picker is open again, holding Ellis, refused, with the reason under the row
    expect(await named).toBe(true);
    const picker = await screen.findByRole("textbox", { name: "Members" });
    await waitFor(() => {
      expect(document.activeElement).toBe(picker);
    });
    expect(picker.getAttribute("aria-invalid")).toBe("true");
    expect(within(detailRow("Members")).getByText(cantJoin)).toBeDefined();
    // The reason heads the open list too, which covers the row's line under the field
    expect(screen.getAllByText(cantJoin)).toHaveLength(2);
    expect(
      screen
        .getByRole("option", { name: /^Ellis Fictional/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(within(detailRow("Feature lead")).queryByText(cantJoin)).toBeNull();
  });

  it("names a refusal of the lead in Feature lead", async () => {
    const { asked } = openPanel();
    let named: Promise<boolean> | undefined;
    asked.lead.mockImplementation((_team, _lead, _from, refused) => {
      named = answerLater(refused, { reason: cantJoin });
    });
    await pick("Feature lead", /^Fictional Tester, TBD-7/);
    expect(await named).toBe(true);
    expect(
      await within(detailRow("Feature lead")).findAllByText(cantJoin),
    ).not.toHaveLength(0);
    // The hire chosen stays in the box, in red, and the list finds it
    const picker = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Feature lead",
    });
    expect(picker.value).toBe("Fictional Tester, TBD-7");
    expect(optionNames()).toEqual(["Fictional Tester, TBD-7No target date"]);
  });

  it("puts the value back and takes the reason away on Esc", async () => {
    const { asked } = openPanel({ day: "2027-06-01" });
    let named: Promise<boolean> | undefined;
    asked.members.mockImplementationOnce((_team, _change, _from, refused) => {
      named = answerLater(refused, { reason: cantJoin });
    });
    await pick("Members", /^Ellis Fictional/);
    await userEvent.keyboard("{Enter}");
    await named;
    await screen.findAllByText(cantJoin);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText(cantJoin)).toBeNull();
    expect(rowText("Members")).not.toContain("Ellis");
  });

  it("leaves a refusal to a notification once the panel is closed", async () => {
    const { asked, unmount } = openPanel({ day: "2027-06-01" });
    let refused: RefusedIn | undefined;
    asked.members.mockImplementation((_team, _change, _from, given) => {
      refused = given;
    });
    await pick("Members", /^Ellis Fictional/);
    await userEvent.keyboard("{Enter}");
    unmount();
    expect(refused?.onRefused({ reason: cantJoin, field: "members" })).toBe(
      false,
    );
  });

  it("leaves a refusal to a notification while another value is being changed", async () => {
    const { asked } = openPanel({ day: "2027-06-01" });
    let refused: RefusedIn | undefined;
    asked.members.mockImplementation((_team, _change, _from, given) => {
      refused = given;
    });
    await pick("Members", /^Ellis Fictional/);
    await userEvent.keyboard("{Enter}");
    await userEvent.click(changeButton("Name") as HTMLElement);
    const name = await screen.findByRole("textbox", { name: "Name" });

    expect(refused?.onRefused({ reason: cantJoin, field: "members" })).toBe(
      false,
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(name);
    });
    expect(screen.queryByText(cantJoin)).toBeNull();
  });

  it("leaves a refusal of a field the row doesn't show to a notification", async () => {
    const { asked } = openPanel({ day: "2027-06-01" });
    let refused: RefusedIn | undefined;
    asked.members.mockImplementation((_team, _change, _from, given) => {
      refused = given;
    });
    await pick("Members", /^Ellis Fictional/);
    await userEvent.keyboard("{Enter}");
    expect(refused?.onRefused({ reason: cantJoin, field: "name" })).toBe(false);
  });
});
