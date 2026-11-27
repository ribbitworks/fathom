// SPDX-License-Identifier: Apache-2.0

// Tests for the Drafts page's drafts of people, lists, columns and the planning settings: each
// put in words, the areas a role approves, and approving one with the drafts it uses.

import { startingPlanningSettings } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  recordDraft,
  renderApp,
  serverAnswers,
  wholeText,
} from "./test-support.tsx";
import {
  noStreams,
  s1,
  session,
  approver,
  sites,
  site,
  draft,
  person,
  peopleWith,
  openDrafts,
  showOn,
  entries,
} from "./test-drafts-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Drafts page", () => {
  it("puts each draft in words, newest first, with what it changes", async () => {
    await openDrafts({}, "/drafts?tab=all");
    expect(await entries()).toEqual([
      "Avery Fictional, Draft | Changed | Waiting | Start filled in: Nov 2, 2026; Site from Northmere to Harbour; A removed column changed | Person | People | Fictional Editor | Oct 31, 2026 | ",
      "Blake Fictional, Draft: added | Added | Waiting | ID filled in: E-p2; Site filled in: Harbour | Person | People | Fictional Editor | Oct 30, 2026 | ",
      "Casey Fictional, Draft: removed | Removed | Waiting |  | Person | People | Fathom | Oct 30, 2026 | ",
      "Drew Fictional, Rejected: Fictional reason | Changed | Rejected | Name from Drew Before to Drew Fictional | Person | People | Fictional Editor | Oct 29, 2026 | Fictional reason",
    ]);
    expect(await showOn("Avery Fictional", "People")).toBe("/go/person/1");
  });

  it("puts drafts of lists, choices, and orders in words, and approves one with the drafts it uses", async () => {
    const listDraft = (action: string, more: object = {}) =>
      draft({ action, changed: [], live: {}, ...more });
    const drafted = {
      ...sites,
      description: "Our offices",
      choices: [
        {
          ...(sites.choices[1] as object),
          label: "Northmere Labs",
          draft: listDraft("changed", {
            changed: ["label", "gone"],
            live: { label: "Northmere" },
          }),
        },
        sites.choices[0],
      ],
      draft: listDraft("changed", {
        changed: ["description"],
        live: { description: "" },
      }),
      orderDraft: draft({
        live: ["c1", "c2", "gone"],
        state: "rejected",
        reason: "Keep the order",
      }),
    };
    const teams = {
      id: "l2",
      keyNumber: 1,
      name: "Teams",
      description: "",
      visibility: "general",
      retired: false,
      choices: [
        {
          id: "c3",
          label: "Platform",
          description: "",
          retired: false,
          draft: listDraft("created"),
        },
      ],
      draft: listDraft("created"),
    };
    const lockers = {
      ...teams,
      id: "l4",
      name: "Lockers",
      visibility: "confidential",
      choices: [],
    };
    const { fetch } = await openDrafts(
      {
        // Lockers is Confidential, so deciding its drafts needs sight of Confidential data.
        "GET /api/session": session([
          "configuration:approve",
          "people:view",
          "personal:view",
          "confidential:view",
        ]),
        "GET /api/people": peopleWith([]),
        "GET /api/release-streams": noStreams,
        "GET /api/lists": () =>
          Response.json({ lists: [drafted, teams, lockers] }),
        "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
      },
      "/drafts?tab=all",
    );
    const shown = await entries();
    expect(shown).toContain(
      "Sites, Draft | Changed | Waiting | Description filled in: Our offices | List | Configuration | Fictional Editor | Oct 30, 2026 | ",
    );
    expect(shown).toContain(
      "Northmere Labs in Sites, Draft | Changed | Waiting | Name from Northmere to Northmere Labs; gone changed | Choice | Configuration | Fictional Editor | Oct 30, 2026 | ",
    );
    expect(shown).toContain(
      "Sites, Rejected: Keep the order | Reordered | Rejected | Order from Harbour, Northmere, a removed choice to Northmere Labs, Harbour | Order of choices | Configuration | Fictional Editor | Oct 30, 2026 | Keep the order",
    );
    await userEvent.click(screen.getByRole("tab", { name: /^To decide/u }));
    expect(shown).toContain(
      "Teams, Draft: added | Added | Waiting |  | List | Configuration | Fictional Editor | Oct 30, 2026 | ",
    );
    expect(shown).toContain(
      "Lockers, Draft: added | Added | Waiting | Class Confidential | List | Configuration | Fictional Editor | Oct 30, 2026 | ",
    );
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Platform in Teams",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    expect(
      within(dialog).getByText("Also approves the drafts these depend on:"),
    ).toBeDefined();
    expect(within(dialog).getByText("the list Teams")).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        {
          people: [],
          plannedHires: [],
          featureTeams: [],
          lists: ["l2"],
          choices: ["c3"],
          orders: [],
          columns: [],
          records: [],
        },
      ]);
    });
  });

  it("approves a person with the new list, column, and choice they are given, naming them", async () => {
    const created = (more: object = {}) =>
      draft({ action: "created", changed: [], live: {}, ...more });
    const guilds = {
      id: "l3",
      keyNumber: 1,
      name: "Guilds",
      description: "",
      visibility: "general",
      retired: false,
      choices: [
        {
          id: "c4",
          label: "Tooling",
          description: "",
          retired: false,
          draft: created(),
        },
      ],
      draft: created(),
    };
    const guild = {
      id: "f2",
      keyNumber: 1,
      name: "Guild",
      listId: "l3",
      multiple: false,
      required: false,
      draft: created(),
    };
    const given = person("p6", "Finley Fictional", {
      values: { f2: ["c4"] },
      draft: draft({ action: "changed", changed: ["f2"] }),
    });
    const { fetch } = await openDrafts({
      "GET /api/people": () =>
        Response.json({
          people: [given],
          fields: [site, guild],
          order: [],
        }),
      "GET /api/release-streams": noStreams,
      "GET /api/lists": () => Response.json({ lists: [sites, guilds] }),
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Finley Fictional",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 4 drafts?",
    });
    for (const name of [
      "the column Guild",
      "the list Guilds",
      "the choice Tooling in Guilds",
    ]) {
      expect(within(dialog).getByText(name)).toBeDefined();
    }
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        {
          people: ["p6"],
          plannedHires: [],
          featureTeams: [],
          lists: ["l3"],
          choices: ["c4"],
          orders: [],
          columns: ["f2"],
          records: [],
        },
      ]);
    });
  });

  // A column on People, and a person given a value in it, drawing on a list drafted on Lists.
  const created = (more: object = {}) =>
    draft({ action: "created", changed: [], live: {}, ...more });
  const guilds = {
    ...sites,
    id: "l9",
    name: "Guilds",
    choices: [{ id: "c9", label: "Makers", description: "", retired: false }],
    draft: created(),
  };
  const guild = {
    id: "f2",
    keyNumber: 1,
    name: "Guild",
    listId: "l9",
    multiple: false,
    required: false,
    table: "people",
    draft: created(),
  };
  const given = person("p6", "Finley Fictional", {
    values: { f2: ["c9"] },
    draft: draft({ action: "changed", changed: ["f2"] }),
  });
  const guildAnswers = (permissions: string[]) => ({
    "GET /api/session": session([...permissions, "people:view"]),
    "GET /api/people": () =>
      Response.json({ people: [given], fields: [site, guild], order: [] }),
    "GET /api/lists": () => Response.json({ lists: [sites, guilds] }),
  });

  it("offers a People column's draft to Approve People, and names the list made on Lists approving it would take", async () => {
    const { fetch } = await openDrafts(guildAnswers(["people:approve"]));
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Finley Fictional",
      }),
    );
    expect(
      screen.getByRole("checkbox", { name: "Select the draft of Guild" }),
    ).toBeDefined();
    expect(
      screen.queryByRole("checkbox", { name: "Select the draft of Guilds" }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Another approver needed",
    });
    expect(
      within(dialog).getByText("This role can't approve these drafts:"),
    ).toBeDefined();
    expect(within(dialog).getByText("the list Guilds")).toBeDefined();
    expect(within(dialog).queryByText("the column Guild")).toBeNull();
    expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([]);
  });

  it("names the drafts of other areas that rejecting would take with it", async () => {
    await openDrafts(guildAnswers(["configuration:approve"]));
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Guilds",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Reject…" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Another approver needed",
    });
    expect(
      within(dialog).getByText("This role can't reject these drafts:"),
    ).toBeDefined();
    expect(within(dialog).getByText("Finley Fictional")).toBeDefined();
  });

  it("puts drafts of columns, web link columns included, in words, and approves one", async () => {
    const levels = {
      ...sites,
      id: "l2",
      name: "Levels",
      choices: [],
    };
    const fetch = serverAnswers({
      "GET /api/session": approver,
      "GET /api/release-streams": noStreams,
      "GET /api/lists": () => Response.json({ lists: [sites, levels] }),
      "GET /api/people": () =>
        Response.json({
          people: [],
          fields: [
            {
              ...site,
              listId: "l2",
              draft: draft({
                action: "changed",
                changed: ["listId"],
                live: { listId: "l1" },
              }),
            },
            {
              ...site,
              id: "f2",
              name: "Previous site",
              draft: draft({ action: "created", changed: ["name"], live: {} }),
            },
            {
              ...site,
              id: "f3",
              name: "Grade",
              draft: draft({
                action: "changed",
                changed: ["name"],
                live: { name: "Level" },
              }),
            },
            { ...site, id: "f4", name: "Team" },
            {
              ...site,
              id: "f5",
              keyNumber: 1,
              name: "Wiki",
              type: "link",
              listId: null,
              visibility: "general",
              draft: draft({ action: "created", changed: ["name"], live: {} }),
            },
          ],
          order: ["preferredName", "f2", "employeeId", "f1", "f3", "f4"],
        }),
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    renderApp("/drafts");
    expect(await screen.findByText("Site")).toBeDefined();
    expect(
      screen.getByText(wholeText(/List from Sites to Levels/)),
    ).toBeDefined();
    expect(screen.getByText("Previous site")).toBeDefined();
    expect(screen.getByText("Wiki")).toBeDefined();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Previous site",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        {
          people: [],
          plannedHires: [],
          featureTeams: [],
          lists: [],
          choices: [],
          orders: [],
          columns: ["f2"],
          records: [],
        },
      ]);
    });
    expect(await showOn("Previous site", "People")).toBe("/go/column/1");
  });

  it("opens for Approvers who see lists but not people, with only the drafts of lists, none for them to decide", async () => {
    const fetch = serverAnswers({
      "GET /api/session": session([
        "plan:approve",
        "features:approve",
        "people:approve",
        "hiring-plan:approve",
        "configuration:approve",
        "configuration:view",
      ]),
      "GET /api/release-streams": noStreams,
      "GET /api/planning-settings": () =>
        Response.json(startingPlanningSettings),
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...sites,
              keyNumber: 7,
              choices: [
                {
                  ...sites.choices[0],
                  draft: draft({
                    action: "changed",
                    changed: ["label"],
                    live: { label: "Old Harbour" },
                  }),
                },
                sites.choices[1],
              ],
              draft: draft({
                action: "changed",
                changed: ["name"],
                live: { name: "Old Sites" },
              }),
            },
          ],
        }),
    });
    // A list's values are people's details, so deciding its drafts needs sight of people.
    renderApp("/drafts?tab=all");
    expect(await entries()).toEqual([
      "Sites, Draft | Changed | Waiting | Name from Old Sites to Sites | List | Configuration | Fictional Editor | Oct 30, 2026 | ",
      "Harbour in Sites, Draft | Changed | Waiting | Name from Old Harbour to Harbour | Choice | Configuration | Fictional Editor | Oct 30, 2026 | ",
    ]);
    expect(screen.getByRole("tab", { name: /^To decide\s*0$/u })).toBeDefined();
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/api/people"))).toBe(
      false,
    );
    expect(await showOn("Sites", "Lists")).toBe("/go/list/7");
    expect(await showOn("Harbour in Sites", "Lists")).toBe("/go/list/7");
  });

  it("lists a draft of the planning settings in words, for Approvers of configuration to approve", async () => {
    const fetch = serverAnswers({
      "GET /api/session": session([
        "configuration:view",
        "configuration:approve",
      ]),
      "GET /api/release-streams": noStreams,
      "GET /api/lists": () => Response.json({ lists: [] }),
      "GET /api/planning-settings": () =>
        Response.json({
          ...startingPlanningSettings,
          hoursPerDay: 7.5,
          draft: recordDraft({
            changed: ["hoursPerDay"],
            live: { hoursPerDay: 8 },
          }),
        }),
      "POST /api/drafts/approval": () =>
        Response.json({ changeSetId: "20000000-0000-4000-8000-000000000001" }),
    });
    renderApp("/drafts");
    expect(await entries()).toEqual([
      "Planning settings, Draft | Changed | Waiting | Hours a day from 8 to 7.5 | Planning settings | Configuration | Fictional Editor | Oct 30, 2026 | ",
    ]);
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Planning settings",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Approve",
      }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        expect.objectContaining({
          records: [{ type: "planning-settings", id: "planning-settings" }],
        }),
      ]);
    });
    expect(await showOn("Planning settings", "Planning settings")).toBe(
      "/planning-settings",
    );
  });

  it("tries the planning settings again when they could not be loaded", async () => {
    let healthy = false;
    serverAnswers({
      "GET /api/session": session([
        "configuration:view",
        "configuration:approve",
      ]),
      "GET /api/release-streams": noStreams,
      "GET /api/lists": () => Response.json({ lists: [] }),
      "GET /api/planning-settings": () =>
        healthy
          ? Response.json(startingPlanningSettings)
          : Response.json({ error: "Down" }, { status: 500 }),
    });
    renderApp("/drafts");
    const again = await screen.findByRole("button", { name: "Try again" });
    healthy = true;
    await userEvent.click(again);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    });
  });
});
