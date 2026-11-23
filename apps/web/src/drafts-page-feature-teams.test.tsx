// SPDX-License-Identifier: Apache-2.0

// Tests for the Drafts page's drafts of feature teams.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf } from "./test-support.tsx";
import {
  s1,
  session,
  draft,
  peopleWith,
  type Answers,
  openDrafts,
  showOn,
  entries,
} from "./test-drafts-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("drafts of feature teams on the Drafts page", () => {
  const t1 = "00000000-0000-4000-8000-0000000000f1";
  const featureTeam = (name: string, fields: object) => ({
    id: t1,
    keyNumber: 1,
    name,
    leadId: null,
    colour: null,
    members: [],
    names: {},
    ...fields,
  });
  const chart = {
    people: [
      { id: "m1", preferredName: "Avery Fictional" },
      { id: "m2", preferredName: "Blake Fictional" },
    ].map((one) => ({
      ...one,
      keyNumber: 1,
      employeeId: `E-${one.id}`,
      position: "Fictional Engineer",
      teamName: null,
      teamColour: null,
      managerId: null,
    })),
    drafted: [],
  };
  const open = (teams: object[], answers: Answers = {}) =>
    openDrafts({
      "GET /api/session": session([
        "feature-teams:approve",
        "people:view",
        "feature-teams:view",
      ]),
      "GET /api/people": peopleWith([]),
      "GET /api/feature-teams": () => Response.json({ teams }),
      "GET /api/org-chart": () => Response.json(chart),
      ...answers,
    });

  it("puts a team's changes in words, naming its lead and members", async () => {
    await open([
      featureTeam("Fictional Pier", {
        leadId: "m1",
        members: ["m1", "m2", "gone"],
        draft: draft({
          action: "changed",
          changed: ["name", "leadId", "members", "memberFrom"],
          live: {
            name: "Fictional Quay",
            leadId: "m2",
            members: ["m1"],
          },
          days: { m2: "2026-01-06", m1: "2026-01-05", gone: "2026-01-07" },
        }),
      }),
    ]);
    expect(await entries()).toEqual([
      "Fictional Pier, Draft | Changed | Waiting | Name from Fictional Quay to Fictional Pier; Feature lead from Blake Fictional to Avery Fictional; Members from Avery Fictional to Avery Fictional, Blake Fictional, Someone this role can't see; Joining and leaving dates set to Avery Fictional, Jan 5, 2026; Blake Fictional, Jan 6, 2026; Someone this role can't see, Jan 7, 2026 | Feature team | Feature teams | Fictional Editor | Oct 30, 2026 | ",
    ]);
    expect(await showOn("Fictional Pier", "org chart")).toBe("/go/team/1");
  });

  it("names someone who has not started from the team's own names", async () => {
    await open([
      featureTeam("Fictional Pier", {
        members: ["starting"],
        names: { starting: "Ellis Fictional" },
        draft: draft({
          action: "changed",
          changed: ["members", "memberFrom"],
          live: { members: [] },
          days: { starting: "2026-01-05" },
        }),
      }),
    ]);
    expect(await entries()).toEqual([
      "Fictional Pier, Draft | Changed | Waiting | Members set to Ellis Fictional; Joining and leaving dates set to Ellis Fictional, Jan 5, 2026 | Feature team | Feature teams | Fictional Editor | Oct 30, 2026 | ",
    ]);
  });

  it("says the day a change of lead takes effect", async () => {
    await open([
      featureTeam("Fictional Pier", {
        leadId: "m1",
        members: ["m1", "m2"],
        draft: draft({
          action: "changed",
          changed: ["leadId", "leadFrom"],
          live: { leadId: "m2" },
          leadDay: "2026-01-05",
        }),
      }),
    ]);
    expect(await entries()).toEqual([
      "Fictional Pier, Draft | Changed | Waiting | Feature lead from Blake Fictional to Avery Fictional; Date the feature lead changes set to Jan 5, 2026 | Feature team | Feature teams | Fictional Editor | Oct 30, 2026 | ",
    ]);
  });

  it("says a change of lead's day changed without naming it for a reader not sent it", async () => {
    await open([
      featureTeam("Fictional Pier", {
        draft: draft({ action: "changed", changed: ["leadFrom"], live: {} }),
      }),
    ]);
    expect(await entries()).toEqual([
      "Fictional Pier, Draft | Changed | Waiting | Date the feature lead changes changed | Feature team | Feature teams | Fictional Editor | Oct 30, 2026 | ",
    ]);
  });

  it("says the day the lead of a team added starts", async () => {
    await open([
      featureTeam("Fictional Pier", {
        leadId: "m1",
        members: ["m1"],
        draft: draft({
          action: "created",
          changed: ["leadId", "members", "leadFrom"],
          live: {},
          leadDay: "2026-01-05",
        }),
      }),
    ]);
    expect((await entries())[0]).toContain(
      "Date the feature lead changes set to Jan 5, 2026",
    );
  });

  it("says when nothing is left to change in a draft", async () => {
    await open([
      featureTeam("Fictional Pier", {
        draft: draft({ action: "changed", changed: [], live: {} }),
      }),
    ]);
    expect(await entries()).toEqual([
      "Fictional Pier, Draft | Changed | Waiting | Nothing is left to change, since the people it named have left | Feature team | Feature teams | Fictional Editor | Oct 30, 2026 | ",
    ]);
  });

  it("says the dates changed without naming them for a reader not sent them", async () => {
    await open([
      featureTeam("Fictional Pier", {
        draft: draft({ action: "changed", changed: ["memberFrom"], live: {} }),
      }),
    ]);
    expect(await entries()).toEqual([
      "Fictional Pier, Draft | Changed | Waiting | Joining and leaving dates changed | Feature team | Feature teams | Fictional Editor | Oct 30, 2026 | ",
    ]);
  });

  it("words what a draft's live values leave out as empty", async () => {
    await open([
      featureTeam("Fictional Pier", {
        draft: draft({
          action: "changed",
          changed: ["name", "leadId", "members"],
          live: {},
        }),
      }),
    ]);
    expect(await entries()).toEqual([
      "Fictional Pier, Draft | Changed | Waiting | Name set to Fictional Pier; Feature lead changed; Members changed | Feature team | Feature teams | Fictional Editor | Oct 30, 2026 | ",
    ]);
  });

  it("lists the lead, members and days of a team added or removed, not its name", async () => {
    await open([
      featureTeam("Fictional Beacon", {
        leadId: "m1",
        members: ["m1", "m2"],
        draft: draft({
          action: "created",
          changed: ["name", "leadId", "members", "memberFrom"],
          days: { m2: "2026-01-06" },
        }),
      }),
      featureTeam("Fictional Wharf", {
        id: "00000000-0000-4000-8000-0000000000f2",
        members: ["m1"],
        draft: draft({ action: "deleted", changed: ["name"], live: {} }),
      }),
    ]);
    expect(await entries()).toEqual([
      "Fictional Beacon, Draft: added | Added | Waiting | Feature lead Avery Fictional; Members Avery Fictional, Blake Fictional; Joining and leaving dates set to Blake Fictional, Jan 6, 2026 | Feature team | Feature teams | Fictional Editor | Oct 30, 2026 | ",
      "Fictional Wharf, Draft: removed | Removed | Waiting | Members Avery Fictional | Feature team | Feature teams | Fictional Editor | Oct 30, 2026 | ",
    ]);
  });

  it("names a team added or removed without listing fields, and leaves out teams with no draft", async () => {
    await open([
      featureTeam("Fictional Beacon", {
        draft: draft({ action: "created", changed: ["name"] }),
      }),
      featureTeam("Fictional Wharf", {
        id: "00000000-0000-4000-8000-0000000000f2",
        draft: draft({ action: "deleted", changed: ["name"], live: {} }),
      }),
      featureTeam("Fictional Quay", {
        id: "00000000-0000-4000-8000-0000000000f3",
      }),
    ]);
    expect(await entries()).toEqual([
      "Fictional Beacon, Draft: added | Added | Waiting |  | Feature team | Feature teams | Fictional Editor | Oct 30, 2026 | ",
      "Fictional Wharf, Draft: removed | Removed | Waiting |  | Feature team | Feature teams | Fictional Editor | Oct 30, 2026 | ",
    ]);
  });

  it("approves a team's draft as a feature team", async () => {
    const { fetch } = await open(
      [
        featureTeam("Fictional Beacon", {
          draft: draft({ action: "created", changed: ["name"] }),
        }),
      ],
      { "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }) },
    );
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Fictional Beacon",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    expect(await screen.findByText("Approved 1 draft.")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
      expect.objectContaining({ featureTeams: [t1], people: [] }),
    ]);
  });

  it("says when the feature teams cannot be loaded, and tries them again", async () => {
    let failing = true;
    await open([], {
      "GET /api/feature-teams": () =>
        failing
          ? Response.json({ error: "Down" }, { status: 503 })
          : Response.json({ teams: [] }),
    });
    expect(
      await screen.findByText("Fathom could not load the drafts."),
    ).toBeDefined();
    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(
        screen.queryByText("Fathom could not load the drafts."),
      ).toBeNull();
    });
  });

  it("says when the org chart cannot be loaded", async () => {
    await open([], {
      "GET /api/org-chart": () =>
        Response.json({ error: "Down" }, { status: 503 }),
    });
    expect(
      await screen.findByText("Fathom could not load the drafts."),
    ).toBeDefined();
  });
});
