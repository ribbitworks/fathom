// SPDX-License-Identifier: Apache-2.0

// Tests for a feature team's panel on its own, with what it asks to save recorded: naming a new
// team, choosing another team, renaming, choosing the lead, adding and removing members, from the
// day the chart shows, when each drafted change takes effect, each person shown with their position
// and reporting team, a draft's marks and live values, its discard, resubmit and removal, and what
// readers who may not propose, or who see the teams as they are live, are shown.

import type { FeatureTeam, OrgChartPerson, Show } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type FeatureTeamActions,
  type FeatureTeamEdits,
  FeatureTeamPanel,
  noFeatureTeamEdits,
} from "./feature-team-panel.tsx";
import { formatDay } from "./table-view.ts";
import { testTheme, wholeText } from "./test-support.tsx";

const person = (
  id: string,
  preferredName: string,
  details: Partial<OrgChartPerson> = {},
): OrgChartPerson => ({
  id,
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
  person("departed", "Gale Fictional", { left: true }),
] as OrgChartPerson[];

const team = (fields: Partial<FeatureTeam> = {}): FeatureTeam => ({
  id: "t1",
  name: "Fictional Lighthouse",
  leadId: "m1",
  colour: null,
  members: ["m2", "m1"],
  names: {},
  ...fields,
});

const draft = (fields: Partial<NonNullable<FeatureTeam["draft"]>> = {}) => ({
  action: "changed" as const,
  changed: [],
  live: {},
  state: "waiting" as const,
  madeBy: "Fictional Editor",
  madeAt: "2026-10-30T15:00:00.000Z",
  ...fields,
});

const everything: FeatureTeamEdits = {
  propose: true,
  edit: true,
  colours: true,
  dates: true,
};

const actions = () =>
  ({
    create: vi.fn(),
    rename: vi.fn(),
    lead: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
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
  const onTeam = vi.fn();
  const onNew = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider theme={testTheme}>
        <FeatureTeamPanel
          team={shown ?? undefined}
          day={day}
          teams={[team(), team({ id: "t2", name: "Fictional Quay" })]}
          onTeam={onTeam}
          onNew={onNew}
          people={people}
          edits={edits}
          show={show}
          narrow={false}
          actions={asked}
          onClose={onClose}
        />
      </MantineProvider>
    </QueryClientProvider>,
  );
  return { asked, onTeam, onNew, onClose };
}

const optionNames = () =>
  screen.queryAllByRole("option").map(({ textContent }) => textContent);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-03-10T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a new feature team", () => {
  it("is added once named, with the name trimmed", async () => {
    const { asked } = openPanel({ shown: null });
    const add = screen.getByRole("button", { name: "Add feature team" });
    expect(add).toHaveProperty("disabled", true);
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      "  Fictional Beacon ",
    );
    await userEvent.click(add);
    expect(asked.create).toHaveBeenCalledWith("Fictional Beacon");
  });

  it("is not added with a name of spaces alone", async () => {
    const { asked } = openPanel({ shown: null });
    const name = screen.getByRole("textbox", { name: "Name" });
    await userEvent.type(name, "   ");
    fireEvent.submit(name.closest("form") as HTMLFormElement);
    expect(asked.create).not.toHaveBeenCalled();
  });

  it("closes on Cancel", async () => {
    const { asked, onClose } = openPanel({ shown: null });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(asked.create).not.toHaveBeenCalled();
  });
});

describe("a feature team's panel", () => {
  it("lists its members by name, marking the lead", () => {
    openPanel({ shown: team({ members: ["m2", "m1", "gone"] }) });
    const panel = screen.getByRole("region", { name: "Feature team" });
    expect(
      [...panel.querySelectorAll("p")]
        .map(({ textContent }) => textContent)
        .filter(
          (text) =>
            text.endsWith("Fictional") ||
            text.includes("(lead)") ||
            text === "Someone this role can't see",
        ),
    ).toEqual([
      "Avery Fictional (lead)",
      "Blake Fictional",
      "Someone this role can't see",
    ]);
  });

  it("says when it has no members", () => {
    openPanel({ shown: team({ leadId: null, members: [] }) });
    expect(screen.getByText("No members yet.")).toBeDefined();
  });

  it("closes from its close button", async () => {
    const { onClose } = openPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Close feature team" }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("opens another team chosen from the Team picker", async () => {
    const { onTeam, onNew } = openPanel();
    await userEvent.click(screen.getByRole("combobox", { name: "Team" }));
    expect(optionNames()).toEqual([
      "Fictional Lighthouse",
      "Fictional Quay",
      "New feature team…",
    ]);
    await userEvent.click(
      screen.getByRole("option", { name: "Fictional Quay" }),
    );
    expect([onTeam.mock.calls, onNew.mock.calls]).toEqual([[["t2"]], []]);
  });

  it("starts a new team from the Team picker", async () => {
    const { onTeam, onNew } = openPanel();
    await userEvent.click(screen.getByRole("combobox", { name: "Team" }));
    await userEvent.click(
      screen.getByRole("option", { name: "New feature team…" }),
    );
    expect([onTeam.mock.calls, onNew.mock.calls]).toEqual([[], [[]]]);
  });

  it("renames the team with Enter, trimmed", async () => {
    const { asked } = openPanel();
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const name = screen.getByRole("textbox", { name: "Name" });
    expect((name as HTMLInputElement).value).toBe("Fictional Lighthouse");
    await userEvent.clear(name);
    await userEvent.type(name, " Fictional Pier {Enter}");
    expect(asked.rename).toHaveBeenCalledWith(team(), "Fictional Pier");
    expect(screen.getByRole("combobox", { name: "Team" })).toBeDefined();
  });

  it("renames nothing on Esc, keeping the name", async () => {
    const { asked } = openPanel();
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      " More{Escape}",
    );
    expect(asked.rename).not.toHaveBeenCalled();
    expect(
      screen.getByRole<HTMLInputElement>("combobox", { name: "Team" }).value,
    ).toBe("Fictional Lighthouse");
  });

  it("renames nothing when the name is left unchanged or empty", async () => {
    const { asked } = openPanel();
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    await userEvent.click(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.tab();
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Rename" })).toBeDefined();
    expect(asked.rename).not.toHaveBeenCalled();
  });

  it("offers members, then others who would join, as lead", async () => {
    const { asked } = openPanel();
    await userEvent.click(
      screen.getByRole("combobox", { name: "Feature lead" }),
    );
    const groups = screen.getAllByRole("group");
    expect(
      groups.map((group) => [
        group.getAttribute("aria-label") ??
          group.firstElementChild?.textContent,
        within(group)
          .getAllByRole("option")
          .map(
            (option) =>
              option.firstElementChild?.firstElementChild?.textContent,
          ),
      ]),
    ).toEqual([
      ["Members", ["Avery Fictional", "Blake Fictional"]],
      [
        "Anyone else, who will join the team",
        [
          "Casey Fictional",
          "Drew Fictional",
          "Robin Fictional",
          "Sasha Fictional",
        ],
      ],
    ]);
    await userEvent.click(
      screen.getByRole("option", { name: /^Blake Fictional/ }),
    );
    expect(asked.lead).toHaveBeenCalledWith(team(), "m2", undefined);
  });

  it("takes the lead away when cleared", async () => {
    const { asked } = openPanel();
    const lead = screen.getByRole("combobox", { name: "Feature lead" });
    await userEvent.click(
      (lead.parentElement?.parentElement as HTMLElement).querySelector(
        "button",
      ) as HTMLElement,
    );
    expect(asked.lead).toHaveBeenCalledWith(team(), null, undefined);
  });

  it("shows each person with their position and reporting team", async () => {
    openPanel();
    await userEvent.click(screen.getByRole("combobox", { name: "Add member" }));
    expect(optionNames()).toEqual([
      "Casey FictionalFictional Engineer, Sasha Fictional's team",
      "Drew Fictional",
      "Robin FictionalFictional Director",
      "Sasha FictionalFictional Manager",
    ]);
  });

  it("finds people by their position and reporting team", async () => {
    openPanel();
    const add = screen.getByRole("combobox", { name: "Add member" });
    await userEvent.type(add, "sasha team");
    expect(optionNames()).toEqual([
      "Casey FictionalFictional Engineer, Sasha Fictional's team",
    ]);
  });

  it("finds members to lead by their position, leaving out groups with nobody found", async () => {
    openPanel({ shown: team({ leadId: null }) });
    await userEvent.type(
      screen.getByRole("combobox", { name: "Feature lead" }),
      "designer",
    );
    expect([screen.getAllByRole("group").length, optionNames()]).toEqual([
      1,
      ["Blake FictionalFictional Designer, Fictional Harbour Crew"],
    ]);
  });

  it("says when nobody is found, offering no member again", async () => {
    openPanel();
    await userEvent.type(
      screen.getByRole("combobox", { name: "Add member" }),
      "harbour crew",
    );
    expect(await screen.findByText("Nobody by that name")).toBeDefined();
    expect(optionNames()).toEqual([]);
  });

  it("adds a member from today, sending no day", async () => {
    const { asked } = openPanel();
    await userEvent.click(screen.getByRole("combobox", { name: "Add member" }));
    await userEvent.click(
      screen.getByRole("option", { name: /^Casey Fictional/ }),
    );
    expect(asked.add).toHaveBeenCalledWith(team(), "p1", undefined);
  });

  it("makes each change from the day the chart shows", async () => {
    const { asked } = openPanel({ day: "2027-05-01" });
    await userEvent.click(screen.getByRole("combobox", { name: "Add member" }));
    await userEvent.click(
      screen.getByRole("option", { name: /^Casey Fictional/ }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Remove Blake Fictional from Fictional Lighthouse",
      }),
    );
    await userEvent.click(
      screen.getByRole("combobox", { name: "Feature lead" }),
    );
    await userEvent.click(
      screen.getByRole("option", { name: /^Blake Fictional/ }),
    );
    expect(asked.add).toHaveBeenCalledWith(team(), "p1", "2027-05-01");
    expect(asked.remove).toHaveBeenCalledWith(team(), "m2", "2027-05-01");
    expect(asked.lead).toHaveBeenCalledWith(team(), "m2", "2027-05-01");
  });

  it("offers no box for the day changes take effect from", () => {
    openPanel();
    expect(screen.queryByRole("textbox", { name: /Takes effect/ })).toBeNull();
  });

  it("names someone the org chart does not hold from the team's own names", () => {
    openPanel({
      shown: team({
        members: ["m1", "starting"],
        names: { starting: "Ellis Fictional" },
      }),
    });
    expect(
      screen.getByRole("button", {
        name: "Remove Ellis Fictional from Fictional Lighthouse",
      }),
    ).toBeDefined();
  });

  it("does not offer someone who has left as a member", async () => {
    openPanel();
    await userEvent.click(screen.getByRole("combobox", { name: "Add member" }));
    expect(optionNames().join()).not.toContain("Gale Fictional");
  });

  it("removes the team", async () => {
    const { asked } = openPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove feature team" }),
    );
    expect(asked.removeTeam).toHaveBeenCalledWith(team());
  });

  it("chooses the team's colour", async () => {
    const { asked } = openPanel({ shown: team({ colour: "teal" }) });
    await userEvent.click(
      screen.getByRole("button", {
        name: /^Colour of Fictional Lighthouse/,
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Grape" }),
    );
    expect(asked.colour).toHaveBeenCalledWith(team({ colour: "teal" }));
  });

  it("offers those who propose but do not edit feature teams no renaming or removing", () => {
    openPanel({ edits: { ...everything, edit: false, dates: false } });
    expect([
      screen.queryByRole("button", { name: "Rename" }),
      screen.queryByRole("button", { name: "Remove feature team" }),
      screen.queryByRole("textbox", { name: /Takes effect from/ }),
    ]).toEqual([null, null, null]);
    expect(screen.getByRole("combobox", { name: "Add member" })).toBeDefined();
  });
});

describe("a feature team's draft in its panel", () => {
  const drafted = team({
    name: "Fictional Drafted",
    leadId: "m2",
    members: ["m2", "p1"],
    draft: draft({
      live: {
        name: "Fictional Lighthouse",
        leadId: "m1",
        members: ["m1", "m2"],
      },
    }),
  });

  it("marks the draft, with the live name and lead, members it adds, and those it removes", () => {
    openPanel({ shown: drafted });
    const panel = screen.getByRole("region", { name: "Feature team" });
    expect(within(panel).getAllByText("Draft").length).toBe(2);
    expect(within(panel).getByText("Fictional Lighthouse")).toBeDefined();
    expect(within(panel).getByText("Avery Fictional, leaving")).toBeDefined();
    expect(
      within(panel)
        .getAllByText("Avery Fictional")
        .map((line) => line.textContent),
    ).toEqual(["Avery Fictional"]);
    expect(within(panel).getAllByText("Live").length).toBe(3);
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
    const panel = screen.getByRole("region", { name: "Feature team" });
    expect(within(panel).getAllByText("Draft").length).toBe(2);
    expect(
      within(panel).getByText(
        `Avery Fictional, leaving from ${formatDay("2027-06-01")}`,
      ),
    ).toBeDefined();
    expect(
      within(panel).getByText(
        `Avery Fictional, until ${formatDay("2027-04-01")}`,
      ),
    ).toBeDefined();
  });

  it("gives the day of a change given no day, on another day shown, to readers who see days", () => {
    openPanel({ shown: drafted, day: "2027-06-01" });
    expect(
      screen.getByText(
        `Avery Fictional, leaving from ${formatDay("2027-03-10")}`,
      ),
    ).toBeDefined();
  });

  it("names no live lead as None", () => {
    openPanel({
      shown: team({ draft: draft({ live: { leadId: null } }) }),
    });
    expect(screen.getByText("None")).toBeDefined();
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

  it("offers no removing of a team the draft removes", () => {
    openPanel({ shown: team({ draft: draft({ action: "deleted" }) }) });
    expect(screen.getByText("Draft: removed")).toBeDefined();
    expect(
      screen.queryByRole("button", { name: "Remove feature team" }),
    ).toBeNull();
  });

  it("offers no colour for a team only drafted to be added", () => {
    openPanel({ shown: team({ draft: draft({ action: "created" }) }) });
    expect(screen.getAllByText("Draft: added").length).toBe(3);
    expect(screen.queryByRole("button", { name: /^Colour of/ })).toBeNull();
  });

  it("says who is changing a team, offering no changes", () => {
    openPanel({ shown: { ...drafted, heldBy: "Fictional Editor" } });
    expect(
      screen.getByText("Fictional Editor is changing this team"),
    ).toBeDefined();
    expect([
      screen.queryByRole("combobox", { name: "Feature lead" }),
      screen.queryByRole("combobox", { name: "Add member" }),
      screen.queryByRole("button", { name: "Rename" }),
      screen.queryByRole("button", { name: "Discard draft" }),
      screen.queryByRole("button", { name: /^Remove / }),
    ]).toEqual([null, null, null, null, null]);
    expect(screen.getByText("Blake Fictional")).toBeDefined();
  });
});

describe("a feature team's panel read only", () => {
  it("shows the team, its lead, and members, to those who may not propose", async () => {
    openPanel({ edits: noFeatureTeamEdits });
    expect(
      screen.getByText(wholeText("Feature lead Avery Fictional")),
    ).toBeDefined();
    expect([
      screen.queryByRole("combobox", { name: "Add member" }),
      screen.queryByRole("button", { name: /^Colour of/ }),
      screen.queryByRole("button", { name: /^Remove / }),
    ]).toEqual([null, null, null]);
    await userEvent.click(screen.getByRole("combobox", { name: "Team" }));
    expect(optionNames()).toEqual(["Fictional Lighthouse", "Fictional Quay"]);
  });

  it("names no lead as None", () => {
    openPanel({ shown: team({ leadId: null }), edits: noFeatureTeamEdits });
    expect(screen.getByText(wholeText("Feature lead None"))).toBeDefined();
  });

  it("shows the team as it is live with Live only, offering no changes", () => {
    openPanel({
      shown: team({
        name: "Fictional Drafted",
        members: ["m1", "p1"],
        draft: draft({
          live: { name: "Fictional Lighthouse", members: ["m1", "m2"] },
        }),
      }),
      show: "live",
    });
    expect(
      screen.getByRole<HTMLInputElement>("combobox", { name: "Team" }).value,
    ).toBe("Fictional Lighthouse");
    expect(screen.getByText("Blake Fictional")).toBeDefined();
    expect([
      screen.queryByText("Casey Fictional"),
      screen.queryByText("Draft"),
      screen.queryByRole("combobox", { name: "Add member" }),
      screen.queryByRole("button", { name: "Discard draft" }),
    ]).toEqual([null, null, null, null]);
  });

  it("shows a team only drafted to be added as drafted, with Live only", () => {
    openPanel({
      shown: team({ draft: draft({ action: "created" }) }),
      show: "live",
    });
    expect(screen.getByText("Avery Fictional (lead)")).toBeDefined();
  });
});
