// SPDX-License-Identifier: Apache-2.0

// Tests for a feature team's panel on its own, with what it asks to save recorded.

import type { FeatureTeam, OrgChartPerson, Show } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type FeatureTeamActions,
  type FeatureTeamEdits,
  FeatureTeamPanel,
  noFeatureTeamEdits,
} from "./feature-team-panel.tsx";
import { DraftView } from "./status-mark.tsx";
import { formatDay, formatMonth } from "./day-formats.ts";
import { detailRow, detailValue, testTheme } from "./test-support.tsx";

const person = (
  id: string,
  preferredName: string,
  details: Partial<OrgChartPerson> = {},
): OrgChartPerson => ({
  id,
  keyNumber: 1,
  preferredName,
  employeeId: `E-${id}`,
  position: "Fictional Engineer",
  teamName: null,
  teamColour: null,
  managerId: "boss",
  ...details,
});

const people = [
  person("boss", "Robin Fictional", {
    position: "Fictional Director",
    managerId: null,
    teamName: "Fictional Harbour Crew",
  }),
  person("other-boss", "Sasha Fictional", {
    position: "Fictional Manager",
    managerId: null,
  }),
  person("m1", "Avery Fictional"),
  person("m2", "Blake Fictional", { position: "Fictional Designer" }),
  person("p1", "Casey Fictional", { managerId: "other-boss" }),
  person("p2", "Drew Fictional", { managerId: "nobody", position: "" }),
  person("hire", "Ellis Fictional", { planned: { expected: "2027-06" } }),
  person("tbd", "Fictional Tester, TBD-7", {
    planned: { expected: "2027-04", undated: true, shownId: "TBD-7" },
  }),
  person("departed", "Gale Fictional", { left: true }),
] as OrgChartPerson[];

const team = (fields: Partial<FeatureTeam> = {}): FeatureTeam => ({
  id: "t1",
  keyNumber: 1,
  name: "Fictional Lighthouse",
  leadId: "m1",
  colour: null,
  members: ["m2", "m1"],
  names: {},
  ...fields,
});

// The planned hires the team read gives, as it names them.
const hireNames = {
  hire: "Ellis Fictional",
  tbd: "Fictional Tester, TBD-7",
  filled: "Fictional Data Engineer",
  later: "Fictional Analyst",
};

const teamHires: FeatureTeam["hires"] = {
  hire: { keyNumber: 9, expected: "2027-06" },
  tbd: { keyNumber: 12, shownId: "TBD-7", expected: "2027-04", undated: true },
  filled: {
    keyNumber: 5,
    expected: "2027-02",
    filledBy: { name: "Fictional Joiner", starts: "2027-02-01" },
  },
  later: { keyNumber: 3, expected: "2027-09" },
};

const draft = (fields: Partial<NonNullable<FeatureTeam["draft"]>> = {}) => ({
  action: "changed" as const,
  changed: [],
  live: {},
  state: "waiting" as const,
  madeBy: "Fictional Editor",
  madeAt: "2026-10-30T15:00:00.000Z",
  discardable: true,
  ...fields,
});

const everything: FeatureTeamEdits = {
  members: true,
  undated: true,
  dates: true,
};

const actions = () =>
  ({
    create: vi.fn(),
    rename: vi.fn(),
    lead: vi.fn(),
    members: vi.fn(),
    removeTeam: vi.fn(),
    discard: vi.fn(),
    resubmit: vi.fn(),
    colour: vi.fn(() => () => Promise.resolve()),
  }) satisfies FeatureTeamActions;

function openPanel({
  shown = team(),
  edits = everything,
  show = "both",
  day,
}: {
  // None for a new team.
  shown?: FeatureTeam | null;
  edits?: FeatureTeamEdits;
  show?: Show;
  // The day the chart shows, when not today.
  day?: string;
} = {}) {
  const asked = actions();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider theme={testTheme}>
        <DraftView show={show}>
          <FeatureTeamPanel
            team={shown ?? undefined}
            day={day}
            people={people}
            edits={edits}
            show={show}
            narrow={false}
            actions={asked}
            onClose={onClose}
          />
        </DraftView>
      </MantineProvider>
    </QueryClientProvider>,
  );
  return { asked, onClose };
}

// The panel's heading with the marks beside it, such as a draft's, which are kept out of the heading
// itself so it names the team alone.
const headingRow = () =>
  screen.getByRole("heading", { name: "Fictional Lighthouse", level: 2 })
    .parentElement as HTMLElement;

// What a row of the panel reads, by its label: its value, and any marks and live value under it.
const rowText = (label: string) => detailValue(label);

// The members listed, each with what screen readers hear of a draft's change to them.
const memberLines = () =>
  within(detailRow("Members"))
    .getAllByRole("listitem")
    .map(({ textContent }) => textContent.trim());

// The planned hires listed, each its two lines.
const hireLines = () =>
  within(detailRow("Planned hires"))
    .getAllByRole("listitem")
    .map(({ textContent }) => textContent.trim());

const optionNames = () =>
  screen.queryAllByRole("option").map(({ textContent }) => textContent);

const changeButton = (label: string) =>
  screen.queryByRole("button", { name: `Change ${label}` });

async function pick(label: string, option: RegExp | string) {
  await userEvent.click(changeButton(label) as HTMLElement);
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

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
    openPanel();
    expect(screen.queryByText("Planned hires")).toBeNull();
    cleanup();
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

  it("offers None first, then each person who may lead, with their position and the team they are on or whom they report to", async () => {
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
    ]);
  });

  it("chooses the lead", async () => {
    const { asked } = openPanel();
    await pick("Feature lead", /^Blake Fictional/);
    expect(asked.lead).toHaveBeenCalledWith(team(), "m2", undefined);
  });

  it("takes the lead away with None", async () => {
    const { asked } = openPanel();
    await pick("Feature lead", "None");
    expect(asked.lead).toHaveBeenCalledWith(team(), null, undefined);
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
    );
  });

  it("does not offer someone who has left, or a planned hire", async () => {
    openPanel();
    await userEvent.click(changeButton("Members") as HTMLElement);
    expect(optionNames().join()).not.toMatch(/Gale|Ellis/);
  });

  it("makes changes from the day the chart shows", async () => {
    const { asked } = openPanel({ day: "2027-05-01" });
    await pick("Feature lead", /^Blake Fictional/);
    await userEvent.click(changeButton("Members") as HTMLElement);
    await userEvent.click(screen.getByRole("option", { name: /^Casey/ }));
    await userEvent.keyboard("{Enter}");
    expect(asked.lead).toHaveBeenCalledWith(team(), "m2", "2027-05-01");
    expect(asked.members).toHaveBeenCalledWith(
      team(),
      { add: ["p1"], remove: [] },
      "2027-05-01",
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
