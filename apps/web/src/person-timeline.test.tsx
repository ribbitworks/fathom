// SPDX-License-Identifier: Apache-2.0

// Tests for a person's timeline in words: each change in the one form, the field then its new value
// and what it changed from, a first value alone, a list's part added or removed, Start and End
// alone, a change shared with others, and its records linking where they can.

import type { TimelineChange } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type TimelineLinks, timelineWords } from "./person-timeline.tsx";
import { PhraseText, phraseText } from "./phrase.tsx";
import { testTheme } from "./test-support.tsx";

const noLinks: TimelineLinks = {
  person: () => undefined,
  team: () => undefined,
  hire: () => undefined,
};
const ana = { id: "m1", name: "Fictional Ana" };
const ben = { id: "m2", name: "Fictional Ben" };
const search = { id: "t1", name: "Fictional Search" };

const words = (change: TimelineChange, links = noLinks) =>
  phraseText(timelineWords(change, links));

describe("a timeline's change in words", () => {
  it.each<[string, TimelineChange, string]>([
    ["Start alone", { field: "start" }, "Start"],
    ["End alone", { field: "end" }, "End"],
    [
      "a first manager",
      { field: "manager", value: ana },
      "Manager Fictional Ana",
    ],
    [
      "a new manager, from the last",
      { field: "manager", value: ben, was: ana },
      "Manager Fictional Ben changed from Fictional Ana",
    ],
    [
      "no manager",
      { field: "manager", value: null, was: ben },
      "Manager No manager changed from Fictional Ben",
    ],
    [
      "a manager after none",
      { field: "manager", value: ana, was: null },
      "Manager Fictional Ana changed from no manager",
    ],
    [
      "a change shared with others",
      { field: "manager", value: ben, was: ana, others: 11 },
      "Manager Fictional Ben changed from Fictional Ana, with 11 others",
    ],
    [
      "a change shared with one other",
      { field: "manager", value: ben, was: ana, others: 1 },
      "Manager Fictional Ben changed from Fictional Ana, with 1 other",
    ],
    [
      "a team joined",
      { field: "featureTeams", value: search, part: "added" },
      "Feature teams Fictional Search added",
    ],
    [
      "a team no longer led",
      { field: "leads", value: search, part: "removed" },
      "Leads Fictional Search removed",
    ],
    [
      "a planned hire filled, by its key",
      { field: "filled", value: { id: "h1", name: "HIRE-42" } },
      "Filled #HIRE-42",
    ],
    [
      "a record on a field that links nowhere, unlinked",
      { field: "start", value: ana },
      "Start Fictional Ana",
    ],
  ])("reads %s", (_case, change, expected) => {
    expect(words(change)).toBe(expected);
  });

  it("links a manager to their details and a team to the org chart where they can open", async () => {
    const person = vi.fn();
    const team = vi.fn();
    const links: TimelineLinks = {
      person: ({ id }) => (id === ana.id ? person : undefined),
      team: () => team,
      hire: () => undefined,
    };
    render(
      <MantineProvider theme={testTheme}>
        <PhraseText
          phrase={timelineWords(
            { field: "manager", value: ben, was: ana },
            links,
          )}
        />
        <PhraseText
          phrase={timelineWords(
            { field: "leads", value: search, part: "added" },
            links,
          )}
        />
      </MantineProvider>,
    );

    expect(screen.queryByRole("button", { name: ben.name })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: ana.name }));
    await userEvent.click(screen.getByRole("button", { name: search.name }));
    expect(person).toHaveBeenCalled();
    expect(team).toHaveBeenCalled();
  });
});
