// SPDX-License-Identifier: Apache-2.0

// A feature team's panel on its own for its tests, with what it asks to save recorded, and the
// fictional people and team they show.

import type { FeatureTeam, OrgChartPerson, Show } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { type Mock, vi } from "vitest";
import {
  type FeatureTeamActions,
  type FeatureTeamEdits,
  FeatureTeamPanel,
} from "./feature-team-panel.tsx";
import { DraftView } from "./status-mark.tsx";
import { detailRow, detailValue, testTheme } from "./test-support.tsx";

export const person = (
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

export const people = [
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

export const team = (fields: Partial<FeatureTeam> = {}): FeatureTeam => ({
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
export const hireNames = {
  hire: "Ellis Fictional",
  tbd: "Fictional Tester, TBD-7",
  filled: "Fictional Data Engineer",
  later: "Fictional Analyst",
};

export const teamHires: FeatureTeam["hires"] = {
  hire: { keyNumber: 9, expected: "2027-06" },
  tbd: { keyNumber: 12, shownId: "TBD-7", expected: "2027-04", undated: true },
  filled: {
    keyNumber: 5,
    expected: "2027-02",
    filledBy: { id: "joiner", name: "Fictional Joiner", starts: "2027-02-01" },
  },
  later: { keyNumber: 3, expected: "2027-09" },
};

export const draft = (
  fields: Partial<NonNullable<FeatureTeam["draft"]>> = {},
) => ({
  action: "changed" as const,
  changed: [],
  live: {},
  state: "waiting" as const,
  madeBy: "Fictional Editor",
  madeAt: "2026-10-30T15:00:00.000Z",
  discardable: true,
  ...fields,
});

export const everything: FeatureTeamEdits = {
  members: true,
  undated: true,
  dates: true,
};

// Each action recorded, so a test can see what it was asked and answer as the server would.
export type AskedActions = {
  [Action in keyof FeatureTeamActions]: Mock<FeatureTeamActions[Action]>;
};

export const actions = (): AskedActions => ({
  create: vi.fn(),
  rename: vi.fn(),
  lead: vi.fn(),
  members: vi.fn(),
  removeTeam: vi.fn(),
  discard: vi.fn(),
  resubmit: vi.fn(),
  colour: vi.fn(() => () => Promise.resolve()),
});

export function openPanel({
  shown = team(),
  edits = everything,
  show = "both",
  day,
  removing,
}: {
  // None for a new team.
  shown?: FeatureTeam | null;
  edits?: FeatureTeamEdits;
  show?: Show;
  // The day the chart shows, when not today.
  day?: string;
  // The planned hires a draft removes.
  removing?: ReadonlySet<string>;
} = {}): {
  asked: AskedActions;
  onClose: Mock<() => void>;
  unmount: () => void;
} {
  const asked = actions();
  const onClose = vi.fn();
  const { unmount } = render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider theme={testTheme}>
        <DraftView show={show}>
          <FeatureTeamPanel
            team={shown ?? undefined}
            day={day}
            people={people}
            {...(removing === undefined ? {} : { removing })}
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
  return { asked, onClose, unmount };
}

// The panel's heading with the marks beside it, such as a draft's, which are kept out of the heading
// itself so it names the team alone.
export const headingRow = () =>
  screen.getByRole("heading", { name: "Fictional Lighthouse", level: 2 })
    .parentElement as HTMLElement;

// What a row of the panel reads, by its label: its value, and any marks and live value under it.
export const rowText = (label: string) => detailValue(label);

// The members listed, each with what screen readers hear of a draft's change to them.
export const memberLines = () =>
  within(detailRow("Members"))
    .getAllByRole("listitem")
    .map(({ textContent }) => textContent.trim());

// The planned hires listed, each its two lines.
export const hireLines = () =>
  within(detailRow("Planned hires"))
    .getAllByRole("listitem")
    .map(({ textContent }) => textContent.trim());

export const optionNames = () =>
  screen.queryAllByRole("option").map(({ textContent }) => textContent);

export const changeButton = (label: string) =>
  screen.queryByRole("button", { name: `Change ${label}` });

export async function pick(label: string, option: RegExp | string) {
  await userEvent.click(changeButton(label) as HTMLElement);
  await userEvent.click(await screen.findByRole("option", { name: option }));
}
