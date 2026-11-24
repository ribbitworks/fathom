// SPDX-License-Identifier: Apache-2.0

// Tests for the Drafts page against a simulated server.

import { startingPlanningSettings } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { drafts } from "./decision-dialog.tsx";
import { DraftsPage } from "./drafts-page.tsx";
import { draftPanelId } from "./drafts-panel.tsx";
import { noDrafts } from "./drafts.ts";
import { peopleQuery } from "./people.ts";
import { emptyView } from "./table-view.ts";
import {
  fictionalMinors,
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  streamId,
  streamsAnswer,
} from "./test-releases.ts";
import {
  bodyOf,
  featureDraft,
  fictionalUser,
  noFeatureColumns,
  recordDraft,
  renderApp,
  serverAnswers,
  testTheme,
  wholeText,
} from "./test-support.tsx";

// No schedules, for drafts of other kinds.
const noStreams = streamsAnswer([]);

const s1 = "00000000-0000-4000-8000-000000000001";

const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });
const approver = session([
  "plan:approve",
  "features:approve",
  "people:approve",
  "hiring-plan:approve",
  "configuration:approve",
  "people:view",
  "people:edit",
  "personal:view",
]);
const reader = session(["people:view"]);

const sites = {
  id: "l1",
  keyNumber: 1,
  name: "Sites",
  description: "",
  visibility: "general",
  retired: false,
  choices: [
    { id: "c1", label: "Harbour", description: "", retired: false },
    { id: "c2", label: "Northmere", description: "", retired: false },
  ],
};
const site = {
  id: "f1",
  keyNumber: 1,
  name: "Site",
  listId: "l1",
  multiple: false,
  required: false,
};

const draft = (fields: object) => ({
  changed: [],
  live: { values: {} },
  state: "waiting",
  madeBy: "Fictional Editor",
  madeAt: "2026-10-30T15:00:00.000Z",
  ...fields,
});

const person = (id: string, preferredName: string, more: object = {}) => ({
  id,
  keyNumber: 1,
  preferredName,
  employeeId: `E-${id}`,
  positionId: "position-1",
  startDate: null,
  endDate: null,
  values: {},
  ...more,
});

const changed = person("p1", "Avery Fictional", {
  startDate: "2026-11-02",
  values: { f1: ["c1"] },
  draft: draft({
    action: "changed",
    changed: ["startDate", "f1", "gone"],
    live: { startDate: null, values: { f1: ["c2"] } },
    madeAt: "2026-10-31T09:00:00.000Z",
  }),
});
const added = person("p2", "Blake Fictional", {
  values: { f1: ["c1", "unknown"] },
  draft: draft({
    action: "created",
    changed: ["preferredName", "employeeId", "f1"],
  }),
});
const removed = person("p3", "Casey Fictional", {
  draft: draft({ action: "deleted", changed: ["preferredName"], madeBy: null }),
});
const rejected = person("p4", "Drew Fictional", {
  draft: draft({
    action: "changed",
    changed: ["preferredName"],
    live: { preferredName: "Drew Before", values: {} },
    state: "rejected",
    reason: "Fictional reason",
    madeAt: "2026-10-29T09:00:00.000Z",
  }),
});
const live = person("p5", "Emery Fictional");

const peopleWith = (people: object[]) => () =>
  Response.json({ people, fields: [site], order: [] });

afterEach(() => {
  vi.unstubAllGlobals();
});

const noPlan = () =>
  Response.json({
    customers: [],
    projects: [],
    proposals: [],
    features: [],
    canEdit: false,
    canEditFeatures: false,
    featureColumns: noFeatureColumns,
  });
const noPlanChoices = () =>
  Response.json({
    owners: [],
    statuses: [],
    featureStatuses: [],
    featureTeams: [],
    priorities: [],
    sizes: [],
    risks: [],
  });

const columnCount = 9;

type Answers = Parameters<typeof serverAnswers>[0];

// Opens the Drafts page on the tab the address names, or on the role's first tab.
async function openDrafts(answers: Answers = {}, address = "/drafts") {
  const fetch = serverAnswers({
    "GET /api/session": approver,
    "GET /api/people": peopleWith([changed, added, removed, rejected, live]),
    "GET /api/release-streams": noStreams,
    "GET /api/lists": () => Response.json({ lists: [sites] }),
    ...answers,
  });
  const app = renderApp(address);
  await screen.findByRole("heading", { name: "Drafts" });
  return { fetch, app };
}

// Opens a draft's details from its row, giving where its link to the record's own page leads.
async function showOn(record: string, page: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: `Show details of ${record}` }),
  );
  return (
    await screen.findByRole("link", { name: `Show on ${page}` })
  ).getAttribute("href");
}

// Each row's cells, from Record to Reason, as the table shows them.
const entries = async () => {
  const table = await screen.findByRole("grid", { name: "Drafts" });
  return within(table)
    .getAllByRole("row")
    .filter((row) => within(row).queryAllByRole("gridcell").length > 0)
    .map((row) =>
      within(row)
        .getAllByRole("gridcell")
        .slice(0, columnCount)
        .map((cell) => cell.textContent.trim())
        .join(" | "),
    );
};

describe("the Drafts page", () => {
  it("puts each draft in words, newest first, with what it changes", async () => {
    await openDrafts({}, "/drafts?tab=all");
    expect(await entries()).toEqual([
      "Avery Fictional, Draft | Changed | Waiting | Start set to Nov 2, 2026; Site from Northmere to Harbour; A removed column changed | Person | People | Fictional Editor | Oct 31, 2026 | ",
      "Blake Fictional, Draft: added | Added | Waiting | ID set to E-p2; Site set to Harbour | Person | People | Fictional Editor | Oct 30, 2026 | ",
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
      "Sites, Draft | Changed | Waiting | Description set to Our offices | List | Configuration | Fictional Editor | Oct 30, 2026 | ",
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

  it("offers only drafts of the areas the role approves, and names those of other areas a decision would take", async () => {
    const created = (more: object = {}) =>
      draft({ action: "created", changed: [], live: {}, ...more });
    const guild = {
      id: "f2",
      keyNumber: 1,
      name: "Guild",
      listId: "l1",
      multiple: false,
      required: false,
      draft: created(),
    };
    const given = person("p6", "Finley Fictional", {
      values: { f2: ["c1"] },
      draft: draft({ action: "changed", changed: ["f2"] }),
    });
    const answers = (permissions: string[]) => ({
      "GET /api/session": session([...permissions, "people:view"]),
      "GET /api/people": () =>
        Response.json({
          people: [given],
          fields: [site, guild],
          order: [],
        }),
    });
    const { fetch } = await openDrafts(answers(["people:approve"]));
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Finley Fictional",
      }),
    );
    // A draft this role doesn't approve isn't one to decide.
    expect(
      screen.queryByRole("checkbox", { name: "Select the draft of Guild" }),
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
    expect(within(dialog).getByText("the column Guild")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([]);
  });

  it("names the drafts of other areas that rejecting would take with it", async () => {
    const guild = {
      id: "f2",
      keyNumber: 1,
      name: "Guild",
      listId: "l1",
      multiple: false,
      required: false,
      draft: draft({ action: "created", changed: [], live: {} }),
    };
    const given = person("p6", "Finley Fictional", {
      values: { f2: ["c1"] },
      draft: draft({ action: "changed", changed: ["f2"] }),
    });
    await openDrafts({
      "GET /api/session": session(["configuration:approve", "people:view"]),
      "GET /api/people": () =>
        Response.json({
          people: [given],
          fields: [site, guild],
          order: [],
        }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Guild",
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

  it("opens for Approvers who see lists but not people, with only the drafts of lists, for another approver to decide", async () => {
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
      "Sites, DraftNeeds another approver | Changed | Waiting | Name from Old Sites to Sites | List | Configuration | Fictional Editor | Oct 30, 2026 | ",
      "Harbour in Sites, DraftNeeds another approver | Changed | Waiting | Name from Old Harbour to Harbour | Choice | Configuration | Fictional Editor | Oct 30, 2026 | ",
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
    expect(await showOn("Planning settings", "Capacity")).toBe(
      "/capacity?mode=settings",
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

  it("lists drafts of customers, proposals, projects, and milestones in words", async () => {
    const projectId = "a0000000-0000-4000-8000-000000000001";
    serverAnswers({
      "GET /api/session": session([
        "plan:approve",
        "plan:view",
        "features:view",
      ]),
      "GET /api/release-streams": noStreams,
      "GET /api/projects/choices": noPlanChoices,
      "GET /api/projects": () =>
        Response.json({
          customers: [
            {
              id: "c0000000-0000-4000-8000-000000000001",
              keyNumber: 1,
              name: "Fictional Customer",
              draft: recordDraft({ action: "created" }),
            },
            {
              id: "c0000000-0000-4000-8000-000000000002",
              keyNumber: 2,
              name: "Settled",
            },
          ],
          proposals: [
            {
              id: "b0000000-0000-4000-8000-000000000001",
              keyNumber: 1,
              name: "Fictional Proposal",
              externalId: null,
              link: null,
              ownerId: null,
              customerIds: [],
              statusId: "f0000000-0000-4000-8000-000000000001",
              featureIds: [],
              removalReasons: {},
              draft: recordDraft({ action: "deleted" }),
            },
          ],
          projects: [
            {
              id: projectId,
              keyNumber: 1,
              name: "Fictional Project",
              externalId: null,
              ownerId: null,
              customerIds: [],
              proposalIds: [],
              featureIds: [],
              dates: { first: null, last: null, nextDelivery: null },
              draft: recordDraft({ action: "created" }),
              milestones: [
                {
                  id: "d0000000-0000-4000-8000-000000000001",
                  keyNumber: 1,
                  projectId,
                  name: "Fictional Kickoff",
                  date: "2030-03-15",
                  customerDelivery: false,
                  draft: recordDraft({
                    changed: ["name"],
                    live: { name: "Before" },
                  }),
                },
              ],
            },
          ],
          features: [],
          canEdit: false,
          canEditFeatures: false,
          featureColumns: noFeatureColumns,
        }),
    });
    renderApp("/drafts");
    const listed = (await entries()).join(" ");
    expect(listed).toContain("Fictional Customer, Draft: added | Added");
    expect(listed).toContain("Fictional Proposal");
    expect(listed).toContain("Fictional Project");
    expect(listed).toContain("Fictional Kickoff of Fictional Project");
    expect(listed).not.toContain("Settled");
    expect(
      await showOn("Fictional Kickoff of Fictional Project", "Projects"),
    ).toBe("/go/milestone/1");
    expect(await showOn("Fictional Customer", "Projects")).toBe(
      "/go/customer/1",
    );
    expect(await showOn("Fictional Proposal", "Projects")).toBe(
      "/go/proposal/1",
    );
    expect(await showOn("Fictional Project", "Projects")).toBe("/go/project/1");
  });

  it("names a draft of a column on Features as being on Features", async () => {
    serverAnswers({
      "GET /api/session": session([
        "configuration:approve",
        "plan:view",
        "features:view",
      ]),
      "GET /api/release-streams": noStreams,
      "GET /api/people": peopleWith([]),
      "GET /api/lists": () => Response.json({ lists: [] }),
      "GET /api/projects/choices": noPlanChoices,
      "GET /api/projects": () =>
        Response.json({
          customers: [],
          projects: [],
          proposals: [],
          features: [],
          featureColumns: {
            fields: [
              {
                id: "f1",
                keyNumber: 1,
                name: "Fictional Size",
                type: "choice",
                listId: "also-not-sent",
                visibility: "general",
                multiple: false,
                required: false,
                onPlannedHires: false,
                draft: {
                  action: "changed",
                  changed: ["listId"],
                  live: { listId: "not-sent" },
                  state: "waiting",
                  madeBy: "Fictional Editor",
                  madeAt: "2026-10-30T15:00:00.000Z",
                },
              },
            ],
            order: ["name", "f1"],
            lists: [],
          },
          canEdit: false,
          canEditFeatures: false,
        }),
    });
    renderApp("/drafts");
    expect(await screen.findByText("Fictional Size on Features")).toBeDefined();
    expect(await showOn("Fictional Size on Features", "Features")).toBe(
      "/go/column/1",
    );
  });

  it("lists a feature's draft, naming the cycle in words", async () => {
    const streamOfCycles = fictionalStream();
    const [first, second] = streamOfCycles.cycles;
    serverAnswers({
      "GET /api/session": session([
        "plan:approve",
        "plan:view",
        "features:view",
      ]),
      "GET /api/release-streams": streamsAnswer([streamOfCycles]),
      "GET /api/people": peopleWith([]),
      "GET /api/lists": () => Response.json({ lists: [] }),
      "GET /api/projects/choices": noPlanChoices,
      "GET /api/projects": () =>
        Response.json({
          customers: [],
          projects: [],
          proposals: [],
          features: [
            {
              id: "00000000-0000-4000-8000-0000000000f1",
              keyNumber: 1,
              name: "Fictional Moving",
              statusId: "s1",
              priorityId: null,
              sizeId: null,
              riskId: null,
              neededBy: null,
              staffed: false,
              staffedLive: false,
              customerIds: [],
              note: null,
              values: {},
              links: {},
              targetStreamId: streamOfCycles.id,
              targetCycle: second?.startsOn,
              estimateHours: null,
              featureTeamId: null,
              description: null,
              draft: featureDraft({
                changed: ["targetStreamId", "targetCycle"],
                live: {
                  targetStreamId: streamOfCycles.id,
                  targetCycle: String(first?.startsOn),
                },
              }),
            },
          ],
          canEdit: false,
          canEditFeatures: false,
          featureColumns: noFeatureColumns,
        }),
    });
    // Approving the plan doesn't approve features, so the draft is under All drafts.
    renderApp("/drafts?tab=all");
    expect((await entries()).join(" ")).toContain(
      "Fictional Moving, Draft | Changed | Waiting | ",
    );
    expect(document.body.textContent).toContain(
      `${streamOfCycles.name}: ${String(second?.name)}`,
    );
    expect(await showOn("Fictional Moving", "Features")).toBe("/go/feature/1");
  });

  it("tries the plan's records again when they could not be loaded", async () => {
    let healthy = false;
    serverAnswers({
      "GET /api/session": session([
        "plan:approve",
        "plan:view",
        "features:view",
      ]),
      "GET /api/release-streams": noStreams,
      "GET /api/people": peopleWith([]),
      "GET /api/lists": () => Response.json({ lists: [] }),
      "GET /api/projects/choices": noPlanChoices,
      "GET /api/projects": () =>
        healthy ? noPlan() : Response.json({ error: "Down" }, { status: 500 }),
    });
    renderApp("/drafts");
    const again = await screen.findByRole("button", { name: "Try again" });
    healthy = true;
    await userEvent.click(again);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    });
  });

  it("lists the plan's drafts for a role seeing only the plan, without asking for schedules", async () => {
    const fetch = serverAnswers({
      "GET /api/session": session(["plan:view"]),
      "GET /api/projects": noPlan,
      "GET /api/projects/choices": noPlanChoices,
      "GET /api/release-streams": () =>
        Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    renderApp("/drafts");
    expect(await screen.findByText("No drafts")).not.toBeNull();
    expect(screen.queryByText("Fathom could not load the drafts.")).toBeNull();
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain(
      "/api/release-streams",
    );
  });

  it("puts a release's changed note in words without its formatting", async () => {
    serverAnswers({
      "GET /api/session": session([
        "plan:approve",
        "features:approve",
        "people:approve",
        "hiring-plan:approve",
        "configuration:approve",
        "plan:view",
        "features:view",
      ]),
      "GET /api/projects": noPlan,
      "GET /api/projects/choices": noPlanChoices,
      "GET /api/release-streams": streamsAnswer([
        fictionalStream({
          releases: [
            fictionalRelease({
              note: "Scope **frozen**",
              draft: recordDraft({
                changed: ["note"],
                live: { note: "Scope *open*" },
              }),
            }),
          ],
        }),
      ]),
    });
    renderApp("/drafts");
    expect(await entries()).toEqual([
      "Fictional One in Fictional Majors, Draft | Changed | Waiting | Note from Scope open to Scope frozen | Release | Features and releases | Fictional Editor | Oct 30, 2026 | ",
    ]);
  });

  it("opens for Approvers who see only the plan, putting drafts of streams, cycles, and releases in words, and approves a release with the stream it uses", async () => {
    const stream = fictionalStream({
      draft: recordDraft({ action: "created" }),
      patterns: [
        fictionalPattern({
          draft: recordDraft({ changed: ["length"], live: { length: "2" } }),
        }),
      ],
      releases: [
        fictionalRelease({
          draft: recordDraft({
            action: "created",
            uses: [{ type: "release-stream", id: streamId }],
          }),
        }),
      ],
    });
    const fetch = serverAnswers({
      "GET /api/session": session([
        "plan:approve",
        "features:approve",
        "people:approve",
        "hiring-plan:approve",
        "configuration:approve",
        "plan:view",
        "features:view",
      ]),
      "GET /api/projects": noPlan,
      "GET /api/projects/choices": noPlanChoices,
      "GET /api/release-streams": streamsAnswer([
        fictionalMinors({
          patterns: [
            fictionalPattern({
              id: "20000000-0000-4000-8000-000000000002",
            }),
          ],
        }),
        stream,
      ]),
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    renderApp("/drafts");
    expect(await entries()).toEqual([
      "Fictional Majors, Draft: added | Added | Waiting |  | Schedule | The plan or configuration | Fictional Editor | Oct 30, 2026 | ",
      "Fictional Majors from Jan 1, 2027, Draft | Changed | Waiting | Length from 2 to 3 | Cycles | The plan or configuration | Fictional Editor | Oct 30, 2026 | ",
      "Fictional One in Fictional Majors, Draft: added | Added | Waiting |  | Release | Features and releases | Fictional Editor | Oct 30, 2026 | ",
    ]);
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Fictional One in Fictional Majors",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    expect(
      within(dialog).getByText("the schedule Fictional Majors"),
    ).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        expect.objectContaining({
          records: [
            { type: "release", id: fictionalRelease().id },
            { type: "release-stream", id: streamId },
          ],
        }),
      ]);
    });
    expect(await showOn("Fictional Majors", "Releases")).toBe("/go/schedule/1");
    expect(await showOn("Fictional Majors from Jan 1, 2027", "Releases")).toBe(
      "/go/schedule/1",
    );
  });

  it("links a release's draft to the release on Releases", async () => {
    const release = fictionalRelease({
      draft: recordDraft({ action: "created" }),
    });
    await openDrafts({
      "GET /api/session": session([
        "features:approve",
        "features:view",
        "plan:view",
      ]),
      "GET /api/projects": noPlan,
      "GET /api/projects/choices": noPlanChoices,
      "GET /api/release-streams": streamsAnswer([
        fictionalStream({ releases: [release] }),
      ]),
    });

    expect(await showOn("Fictional One in Fictional Majors", "Releases")).toBe(
      "/go/release/1",
    );
  });

  it("names everyone who changed a draft", async () => {
    await openDrafts({
      "GET /api/people": peopleWith([
        person("p6", "Finley Fictional", {
          draft: draft({
            action: "deleted",
            editors: ["Ann Fictional", null, "Ben Fictional"],
          }),
        }),
        person("p7", "Gray Fictional", {
          draft: draft({ action: "deleted", editors: ["Ann Fictional"] }),
        }),
      ]),
    });
    expect(await entries()).toEqual([
      "Finley Fictional, Draft: removed | Removed | Waiting |  | Person | People | Ann Fictional, Fathom, and Ben Fictional | Oct 30, 2026 | ",
      "Gray Fictional, Draft: removed | Removed | Waiting |  | Person | People | Ann Fictional | Oct 30, 2026 | ",
    ]);
  });

  it("credits each change to who made it when several people changed a draft", async () => {
    await openDrafts({
      "GET /api/people": peopleWith([
        person("p8", "Hollis Fictional", {
          startDate: "2026-11-02",
          values: { f1: ["c1"] },
          draft: draft({
            action: "changed",
            changed: ["preferredName", "startDate", "f1"],
            live: {
              preferredName: "Hollis Before",
              startDate: null,
              values: { f1: ["c2"] },
            },
            editors: ["Ann Fictional", "Ben Fictional"],
            changedBy: { preferredName: "Ann Fictional", f1: null },
          }),
        }),
      ]),
      "GET /api/release-streams": noStreams,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...sites,
              description: "Offices",
              draft: draft({
                action: "changed",
                changed: ["description"],
                live: { description: "" },
                editors: ["Ann Fictional", "Ben Fictional"],
              }),
            },
          ],
        }),
    });
    expect(await entries()).toEqual([
      "Hollis Fictional, Draft | Changed | Waiting | Name from Hollis Before to Hollis Fictional (Ann Fictional); Start set to Nov 2, 2026; Site from Northmere to Harbour (Fathom) | Person | People | Ann Fictional and Ben Fictional | Oct 30, 2026 | ",
      "Sites, Draft | Changed | Waiting | Description set to Offices | List | Configuration | Ann Fictional and Ben Fictional | Oct 30, 2026 | ",
    ]);
  });

  it("offers no approval of drafts this account changed, which it may still reject", async () => {
    await openDrafts({
      "GET /api/people": peopleWith([
        person("p1", "Avery Fictional", {
          draft: draft({
            action: "changed",
            changed: ["preferredName"],
            live: { preferredName: "Avery Before", values: {} },
            needsOtherApprover: true,
          }),
        }),
        person("p2", "Blake Fictional", {
          draft: draft({
            action: "created",
            changed: ["preferredName", "employeeId"],
            needsOtherApprover: true,
          }),
        }),
        live,
      ]),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Reject…" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(
      screen.getByText("1 chosen draft needs another approver."),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Blake Fictional",
      }),
    );
    expect(
      screen.getByText("2 chosen drafts need another approver."),
    ).toBeDefined();
  });

  it("approves the drafts ticked it may, leaving those this account changed for another approver", async () => {
    // Given a draft this account changed, and one someone else did
    await openDrafts({
      "GET /api/people": peopleWith([
        person("p1", "Avery Fictional", {
          draft: draft({
            action: "changed",
            changed: ["preferredName"],
            live: { preferredName: "Avery Before", values: {} },
            needsOtherApprover: true,
          }),
        }),
        person("p2", "Cleo Fictional", {
          draft: draft({
            action: "changed",
            changed: ["preferredName"],
            live: { preferredName: "Cleo Before", values: {} },
          }),
        }),
        live,
      ]),
    });

    // When both are ticked
    for (const name of ["Avery Fictional", "Cleo Fictional"]) {
      await userEvent.click(
        await screen.findByRole("checkbox", {
          name: `Select the draft of ${name}`,
        }),
      );
    }

    // Then Approve counts only the one it approves, and its dialog names both
    expect(
      screen.getByText("1 chosen draft needs another approver."),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    expect(dialog.textContent).toContain("Cleo Fictional");
    expect(dialog.textContent).toContain(
      "This needs another approver and stays waiting:Avery Fictional",
    );
  });

  it("reloads the schedules after an approval, so a release's approved draft leaves the page", async () => {
    const { fetch } = await openDrafts({
      "GET /api/session": session([
        "people:approve",
        "people:view",
        "personal:view",
        "features:view",
      ]),
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    );
    const streamReads = () =>
      fetch.mock.calls.filter(([url]) => url === "/api/release-streams").length;
    const before = streamReads();

    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Approve",
      }),
    );

    await waitFor(() => {
      expect(streamReads()).toBeGreaterThan(before);
    });
  });

  it("approves the drafts selected, after asking", async () => {
    const { fetch } = await openDrafts({
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Blake Fictional",
      }),
    );
    // A rejected draft is back with its makers until they send it again, so isn't one to decide.
    expect(
      screen.queryByRole("checkbox", {
        name: "Select the draft of Drew Fictional",
      }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 2 drafts…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    expect(await screen.findByText("Approved 2 drafts.")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
      {
        people: ["p1", "p2"],
        plannedHires: [],
        featureTeams: [],
        lists: [],
        choices: [],
        orders: [],
        columns: [],
        records: [],
      },
    ]);
  });

  it("names a planned hire's draft by its position and ID, and approves it as a planned hire", async () => {
    const positions = {
      ...sites,
      id: "positions",
      keyNumber: 1,
      name: "Positions",
      builtIn: "positions",
      choices: [
        {
          id: "position-1",
          label: "Engineer",
          description: "",
          retired: false,
        },
      ],
    };
    const states = {
      ...sites,
      id: "states",
      keyNumber: 1,
      name: "Hiring states",
      builtIn: "hiring-states",
      choices: [
        {
          id: "s-proposed",
          label: "Request to hire",
          description: "",
          retired: false,
          meaning: "proposed",
        },
        {
          id: "s-open",
          label: "Approved to hire",
          description: "",
          retired: false,
          meaning: "open",
        },
      ],
    };
    const hire = person("h1", "", {
      kind: "planned-hire",
      employeeId: "REQ-7",
      stateId: "s-open",
      draft: draft({
        action: "changed",
        changed: ["stateId"],
        live: { stateId: "s-proposed", values: {} },
      }),
    });
    const { fetch } = await openDrafts({
      "GET /api/people": peopleWith([hire]),
      "GET /api/lists": () =>
        Response.json({ lists: [sites, positions, states] }),
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    expect(await entries()).toEqual([
      "Engineer, REQ-7, Draft | Changed | Waiting | State from Request to hire to Approved to hire | Planned hire | Planned hires | Fictional Editor | Oct 30, 2026 | ",
    ]);
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Engineer, REQ-7",
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
      {
        people: [],
        plannedHires: ["h1"],
        featureTeams: [],
        lists: [],
        choices: [],
        orders: [],
        columns: [],
        records: [],
      },
    ]);
    expect(await showOn("Engineer, REQ-7", "People")).toBe("/go/hire/1");
  });

  it("selects all waiting drafts at once, and none again", async () => {
    await openDrafts();
    const all = await screen.findByRole("checkbox", {
      name: "Select all drafts this role can decide",
    });
    // Nothing to do while nothing is ticked.
    expect(screen.queryByRole("button", { name: /^Approve/u })).toBeNull();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    );
    expect(all).toHaveProperty("indeterminate", true);
    await userEvent.click(all);
    expect(
      screen.getByRole("button", { name: "Approve 3 drafts…" }),
    ).toBeDefined();
    // Screen readers hear how many are ticked.
    expect(screen.getByText("3 selected")).toBeDefined();
    await userEvent.click(all);
    expect(screen.queryByRole("button", { name: /^Approve/u })).toBeNull();
    expect(screen.queryByText(/selected$/u)).toBeNull();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    );
    expect(screen.queryByRole("button", { name: /^Approve/u })).toBeNull();
  });

  it("keeps a new order that waits on a rejected choice from being selected, and approves the rest", async () => {
    const { fetch } = await openDrafts(
      {
        "GET /api/people": peopleWith([changed]),
        "GET /api/release-streams": noStreams,
        "GET /api/lists": () =>
          Response.json({
            lists: [
              {
                ...sites,
                choices: [
                  {
                    id: "c9",
                    label: "Fenwick",
                    description: "",
                    retired: false,
                    draft: draft({
                      action: "created",
                      live: {},
                      state: "rejected",
                      reason: "Not yet",
                    }),
                  },
                  ...sites.choices,
                ],
                orderDraft: draft({ live: ["c1", "c2"], uses: ["c9"] }),
              },
            ],
          }),
        "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
      },
      "/drafts?tab=all",
    );
    // Under All drafts, the new order says why it waits, with nothing to tick.
    expect(await screen.findByText("Waits on a rejected draft")).toBeDefined();
    expect(screen.queryByRole("checkbox")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: /^To decide/u }));
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select all drafts this role can decide",
      }),
    );
    expect(
      screen.queryByRole("checkbox", { name: "Select the draft of Sites" }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    expect(within(dialog).queryByText(/skipped/)).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        {
          people: ["p1"],
          plannedHires: [],
          featureTeams: [],
          lists: [],
          choices: [],
          orders: [],
          columns: [],
          records: [],
        },
      ]);
    });
  });

  it("rejects the drafts selected, asking for a reason", async () => {
    const { fetch } = await openDrafts({
      "POST /api/drafts/rejection": () => Response.json({ changeSetId: s1 }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Casey Fictional",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Reject…" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Reject 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject" }),
    );
    expect(within(dialog).getByText("Give a reason")).toBeDefined();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Reason" }),
      "  Fictional reason ",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject" }),
    );
    expect(await screen.findByText("Rejected 1 draft.")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/drafts/rejection")).toEqual([
      {
        people: ["p3"],
        plannedHires: [],
        featureTeams: [],
        lists: [],
        choices: [],
        orders: [],
        columns: [],
        records: [],
        reason: "Fictional reason",
      },
    ]);
  });

  it("says when rejecting changed nothing, as when another Approver rejected the drafts for that reason first", async () => {
    await openDrafts({
      "POST /api/drafts/rejection": () => Response.json({ changeSetId: null }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Reject…" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Reject 1 draft?",
    });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Reason" }),
      "Fictional reason",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject" }),
    );
    expect(
      await screen.findByText(
        "Nothing changed: those drafts were already rejected for that reason.",
      ),
    ).toBeDefined();
  });

  it("says when approving changed nothing", async () => {
    await openDrafts({
      "POST /api/drafts/approval": () => Response.json({ changeSetId: null }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Approve 1 draft?" }),
      ).getByRole("button", { name: "Approve" }),
    );
    expect(
      await screen.findByText(
        "Nothing changed: those drafts no longer change anything.",
      ),
    ).toBeDefined();
  });

  it("says why approving was refused, and can be cancelled", async () => {
    await openDrafts({
      "POST /api/drafts/approval": () =>
        Response.json({ error: "A draft no longer fits" }, { status: 409 }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
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
    expect(
      await within(dialog).findByText("A draft no longer fits"),
    ).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    // Escape closes it too.
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    await screen.findByRole("dialog", { name: "Approve 1 draft?" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("lets those who may not approve only read the drafts", async () => {
    await openDrafts({ "GET /api/session": reader }, "/drafts?tab=all");
    expect(await entries()).toHaveLength(4);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Approve/u })).toBeNull();
  });

  it("says when there are no drafts, and offers nothing to select", async () => {
    await openDrafts({ "GET /api/people": peopleWith([live]) });
    expect(await screen.findByText("No drafts")).toBeDefined();
    expect(
      screen.getByRole("checkbox", {
        name: "Select all drafts this role can decide",
      }),
    ).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: /^Approve/u })).toBeNull();
  });

  it("offers no waiting drafts to select all when every draft is rejected", async () => {
    await openDrafts({ "GET /api/people": peopleWith([rejected]) });
    expect(
      await screen.findByRole("checkbox", {
        name: "Select all drafts this role can decide",
      }),
    ).toHaveProperty("disabled", true);
  });

  it("says when the drafts cannot be loaded, and tries again", async () => {
    let failing = true;
    const { fetch } = await openDrafts({
      "GET /api/people": () =>
        failing
          ? Response.json({ error: "Down" }, { status: 503 })
          : peopleWith([changed])(),
    });
    expect(
      await screen.findByText("Fathom could not load the drafts."),
    ).toBeDefined();
    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await entries()).toHaveLength(1);
    expect(
      fetch.mock.calls.filter(([url]) => url === "/api/people").length,
    ).toBeGreaterThan(1);
  });

  it("shows a detail the user does not receive as empty", async () => {
    const withoutDate: Record<string, unknown> = person("p6", "Fin Fictional");
    delete withoutDate.startDate;
    await openDrafts({
      "GET /api/people": peopleWith([
        {
          ...withoutDate,
          draft: draft({ action: "changed", changed: ["startDate"] }),
        },
      ]),
    });
    expect(await entries()).toEqual([
      "Fin Fictional, Draft | Changed | Waiting | Start changed | Person | People | Fictional Editor | Oct 30, 2026 | ",
    ]);
  });

  it("searches the drafts, saying when none match", async () => {
    await openDrafts({}, "/drafts?tab=all");
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Search drafts" }),
      "fictional reason",
    );
    await waitFor(async () => {
      expect(await entries()).toHaveLength(1);
    });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search drafts" }),
      " nobody",
    );
    expect(await screen.findByText("No matching drafts")).toBeDefined();
    await userEvent.clear(
      screen.getByRole("textbox", { name: "Search drafts" }),
    );
    await waitFor(async () => {
      expect(await entries()).toHaveLength(4);
    });
  });

  it("leaves Drafted empty for a draft whose time was not recorded, after those with one", async () => {
    await openDrafts(
      {
        "GET /api/people": peopleWith([
          person("p7", "Gale Fictional", {
            draft: draft({
              action: "created",
              changed: [],
              madeBy: null,
              madeAt: null,
            }),
          }),
          changed,
          person("p8", "Hollis Fictional", {
            // Rejected, with a reason this user may not see.
            draft: draft({
              action: "deleted",
              madeBy: null,
              madeAt: null,
              state: "rejected",
            }),
          }),
        ]),
      },
      "/drafts?tab=all",
    );
    // Those with no time come last, their Drafted empty.
    expect(await entries()).toEqual([
      "Avery Fictional, Draft | Changed | Waiting | Start set to Nov 2, 2026; Site from Northmere to Harbour; A removed column changed | Person | People | Fictional Editor | Oct 31, 2026 | ",
      "Gale Fictional, Draft: added | Added | Waiting |  | Person | People | Fathom |  | ",
      "Hollis Fictional, Rejected, removed | Removed | Rejected |  | Person | People | Fathom |  | ",
    ]);
  });

  it("shows only the drafts the reader may decide now under To decide, and every published draft under All drafts, keeping the tab in the address", async () => {
    // Given three waiting drafts and a rejected one
    serverAnswers({
      "GET /api/session": approver,
      "GET /api/people": peopleWith([changed, added, removed, rejected, live]),
      "GET /api/release-streams": noStreams,
      "GET /api/lists": () => Response.json({ lists: [sites] }),
    });
    const app = renderApp("/drafts");

    // Then an Approver opens on To decide, with only the waiting drafts, and the address names no tab
    expect(await entries()).toHaveLength(3);
    expect(app.location.search).not.toContain("tab");

    // When All drafts is chosen
    await userEvent.click(screen.getByRole("tab", { name: /^All drafts/u }));

    // Then every published draft shows, and the address keeps the tab
    await waitFor(async () => {
      expect(await entries()).toHaveLength(4);
    });
    expect(app.location.search).toContain("tab=all");

    // And going back to To decide leaves the address without a tab
    await userEvent.click(screen.getByRole("tab", { name: /^To decide/u }));
    await waitFor(async () => {
      expect(await entries()).toHaveLength(3);
    });
    expect(app.location.search).not.toContain("tab");
  });

  it("opens a role that makes drafts but approves none on Not published, with no To decide, whatever an old address asks", async () => {
    serverAnswers({
      "GET /api/session": session(["people:view", "people:edit"]),
      "GET /api/people": peopleWith([changed, rejected]),
      "GET /api/lists": () => Response.json({ lists: [sites] }),
    });
    renderApp("/drafts?tab=decide&decide=mine");
    expect(await screen.findByText("No drafts")).toBeDefined();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map(({ textContent }) => textContent)).toEqual([
      "Not published 0",
      "All drafts 2",
    ]);
    expect(
      screen.getByRole("tab", { name: /^Not published/u, selected: true }),
    ).toBeDefined();
  });

  it("shows a role that neither makes nor approves drafts only All drafts", async () => {
    serverAnswers({
      "GET /api/session": reader,
      "GET /api/people": peopleWith([changed, rejected]),
      "GET /api/lists": () => Response.json({ lists: [sites] }),
    });
    renderApp("/drafts?tab=unpublished");
    expect(
      await screen.findByRole("tab", { name: /^All drafts/u, selected: true }),
    ).toBeDefined();
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("decides one draft from its row's menu", async () => {
    const { fetch } = await openDrafts({
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    // A row has two, one beside its name and one at its end, which open the same menu.
    const [rowMenu] = await screen.findAllByRole("button", {
      name: "Actions for Blake Fictional",
    });
    await userEvent.click(rowMenu as HTMLElement);
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Approve draft…" }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Approve",
      }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        { ...noDrafts(), people: ["p2"] },
      ]);
    });
  });

  it("shows why a draft this account changed can't be approved by it, after its record", async () => {
    await openDrafts({
      "GET /api/people": peopleWith([
        person("p9", "Kit Fictional", {
          draft: draft({
            action: "changed",
            changed: ["preferredName"],
            live: { preferredName: "Kit Before", values: {} },
            needsOtherApprover: true,
          }),
        }),
      ]),
    });
    expect(
      (await screen.findByText("Needs another approver")).closest(
        "[role=gridcell]",
      )?.textContent,
    ).toContain("Kit Fictional");
  });

  it("opens a draft's details, with the drafts approved with it, and decides it from there", async () => {
    // Given a person given a choice only drafted to be added
    const given = person("p6", "Kai Fictional", {
      values: { f1: ["c3"] },
      draft: draft({
        action: "changed",
        changed: ["f1"],
        live: { values: {} },
      }),
    });
    const withPlatform = {
      ...sites,
      choices: [
        ...sites.choices,
        {
          id: "c3",
          label: "Platform",
          description: "",
          retired: false,
          draft: draft({ action: "created", changed: [], live: {} }),
        },
      ],
    };
    const { fetch, app } = await openDrafts({
      "GET /api/people": peopleWith([given]),
      "GET /api/lists": () => Response.json({ lists: [withPlatform] }),
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });

    // When its details are opened
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Kai Fictional",
      }),
    );

    // Then they name the choice approved with it, and the address keeps them open
    expect(
      within(
        await screen.findByRole("region", { name: "Approved with it" }),
      ).getByText("the choice Platform in Sites"),
    ).toBeDefined();
    expect(app.location.search).toContain("open=");

    // And approving from there approves both
    const panel = document.getElementById(draftPanelId) as HTMLElement;
    await userEvent.click(
      within(panel).getByRole("button", { name: "Approve…" }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Approve",
      }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        { ...noDrafts(), people: ["p6"], choices: ["c3"] },
      ]);
    });
  });

  it("rejects a draft from its details", async () => {
    await openDrafts();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Blake Fictional",
      }),
    );
    const panel = document.getElementById(draftPanelId) as HTMLElement;
    await userEvent.click(
      within(panel).getByRole("button", { name: "Reject…" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Reject 1 draft?" }),
    ).toBeDefined();
  });

  it("closes a draft's details back to its row", async () => {
    const { app } = await openDrafts();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Blake Fictional",
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain("Blake Fictional");
    });
    expect(app.location.search).not.toContain("open=");
  });

  it("counts each tab's drafts, and keeps the tab in the address", async () => {
    const { app } = await openDrafts({
      "GET /api/people": peopleWith([
        changed,
        {
          ...added,
          draft: draft({
            action: "created",
            changed: [],
            unpublished: true,
          }),
        },
      ]),
    });
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map(({ textContent }) => textContent)).toEqual([
      "To decide 1",
      "Not published 1",
      "All drafts 1",
    ]);
    await userEvent.click(screen.getByRole("tab", { name: /^Not published/u }));
    expect(app.location.search).toContain("tab=unpublished");
    expect(screen.getByRole("tab", { name: /^Not published/u })).toHaveProperty(
      "ariaSelected",
      "true",
    );
    // And one's own change's details say nobody else sees it yet, naming nothing approved with it
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Blake Fictional",
      }),
    );
    expect(
      await screen.findByText(
        "Nobody else sees these changes until they're published.",
      ),
    ).toBeDefined();
    expect(
      screen.queryByRole("region", { name: "Approved with it" }),
    ).toBeNull();
  });

  it("names the drafts waiting on a rejected draft in its details", async () => {
    const listDraft = (action: string, more: object = {}) =>
      draft({ action, changed: [], live: {}, ...more });
    await openDrafts(
      {
        "GET /api/people": peopleWith([]),
        "GET /api/lists": () =>
          Response.json({
            lists: [
              {
                ...sites,
                choices: [
                  ...sites.choices,
                  {
                    id: "c3",
                    label: "Platform",
                    description: "",
                    retired: false,
                    draft: listDraft("created", {
                      state: "rejected",
                      reason: "Fictional reason",
                    }),
                  },
                ],
                orderDraft: draft({ live: ["c1", "c2"], uses: ["c3"] }),
              },
            ],
          }),
      },
      "/drafts?tab=all",
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Platform in Sites",
      }),
    );
    expect(
      within(
        await screen.findByRole("region", { name: "Waiting on it" }),
      ).getByText("the new order for Sites"),
    ).toBeDefined();
  });

  it("offers no link to a record's page this role can't open", async () => {
    // Given a reader of people, who sees a list's draft but not the Lists page
    await openDrafts(
      {
        "GET /api/session": session(["people:view"]),
        "GET /api/people": peopleWith([]),
        "GET /api/lists": () =>
          Response.json({
            lists: [
              {
                ...sites,
                draft: draft({
                  action: "changed",
                  changed: ["name"],
                  live: { name: "Old Sites" },
                }),
              },
            ],
          }),
      },
      "/drafts?tab=all",
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Show details of Sites" }),
    );
    await screen.findByRole("region", { name: "Details" });
    expect(screen.queryByRole("link", { name: /^Show on/u })).toBeNull();
  });

  it("starts each tab unticked, keeping no draft's details from the other tab", async () => {
    // Given a draft ticked, and another's details open
    const { app } = await openDrafts({
      "GET /api/people": peopleWith([
        changed,
        removed,
        {
          ...added,
          draft: draft({ action: "created", changed: [], unpublished: true }),
        },
      ]),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Show details of Casey Fictional" }),
    );
    expect(app.location.search).toContain("open=");

    // When Not published, then To decide, is chosen
    await userEvent.click(screen.getByRole("tab", { name: /^Not published/u }));
    await userEvent.click(screen.getByRole("tab", { name: /^To decide/u }));

    // Then nothing is ticked, and no details are open
    expect(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    ).toHaveProperty("checked", false);
    expect(screen.queryByRole("button", { name: /^Approve/u })).toBeNull();
    expect(app.location.search).not.toContain("open=");
  });

  it("closes the details of a draft no longer listed, such as once decided", async () => {
    serverAnswers({
      "GET /api/session": approver,
      "GET /api/people": peopleWith([changed]),
      "GET /api/release-streams": noStreams,
      "GET /api/lists": () => Response.json({ lists: [sites] }),
    });
    const app = renderApp("/drafts?open=person%20gone");
    await screen.findByRole("grid", { name: "Drafts" });
    await waitFor(() => {
      expect(app.location.search).not.toContain("open=");
    });
  });

  it("counts drafts in words", () => {
    expect([1, 2, 1200].map(drafts)).toEqual([
      "1 draft",
      "2 drafts",
      "1,200 drafts",
    ]);
  });
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

describe("unpublished and held drafts on the Drafts page", () => {
  it("lists drafts someone is changing under All drafts, not To decide, and one's own unpublished drafts under Not published", async () => {
    await openDrafts(
      {
        "GET /api/people": peopleWith([
          { ...changed, heldBy: "Second Fictional Editor" },
          {
            ...added,
            draft: draft({
              action: "created",
              changed: ["preferredName", "employeeId", "f1"],
              unpublished: true,
            }),
          },
          removed,
        ]),
      },
      "/drafts?tab=all",
    );
    const records = async () =>
      (await entries()).map((text) => text.split(" | ")[0]);
    expect(await records()).toEqual([
      "Avery Fictional, Draft, being changed by Second Fictional Editor",
      "Casey Fictional, Draft: removed",
    ]);

    // And To decide holds only the draft nobody is changing
    await userEvent.click(screen.getByRole("tab", { name: /^To decide/u }));
    await waitFor(async () => {
      expect(await records()).toEqual(["Casey Fictional, Draft: removed"]);
    });

    // And one's own unpublished draft is under Not published, with no Made by
    await userEvent.click(screen.getByRole("tab", { name: /^Not published/u }));
    await waitFor(async () => {
      expect(await entries()).toEqual([
        "Blake Fictional, Draft: added, unpublished | Added | Not published | ID set to E-p2; Site set to Harbour | Person | People | Oct 30, 2026 | ",
      ]);
    });
    expect(
      screen.getByRole("checkbox", {
        name: "Select the change to Blake Fictional",
      }),
    ).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /^Made by column/u }),
    ).toBeNull();
  });
});

describe("publishing and discarding one's own changes on the Drafts page", () => {
  const own = (fields: object = {}) =>
    draft({
      action: "created",
      changed: [],
      live: {},
      unpublished: true,
      ...fields,
    });
  // A list only drafted to be added, with choices added to it, and an unrelated person, all the
  // reader's own unpublished changes.
  const equipment = (labels: string[]) => ({
    id: "l9",
    keyNumber: 9,
    name: "Equipment",
    description: "",
    visibility: "general",
    retired: false,
    choices: labels.map((label, index) => ({
      id: `c9${String(index)}`,
      label,
      description: "",
      retired: false,
      draft: own(),
    })),
    draft: own(),
  });
  const ownPerson = {
    ...added,
    draft: draft({
      action: "created",
      changed: ["preferredName"],
      unpublished: true,
    }),
  };
  // The changes as the server lists and links them: each choice uses the list it is added to.
  const linked = (labels: string[]) => () =>
    Response.json({
      changes: [
        {
          subject: "the list Equipment",
          action: "created",
          key: "list l9",
          linked: [],
        },
        ...labels.map((label, index) => ({
          subject: `the choice ${label} in Equipment`,
          action: "created",
          key: `list-item c9${String(index)}`,
          linked: ["list l9"],
        })),
        // A change the page doesn't list, linked to the list.
        {
          subject: "a column",
          action: "created",
          key: "field f-unlisted",
          linked: ["list l9"],
        },
        {
          subject: "Blake Fictional",
          action: "created",
          key: `person ${added.id}`,
          linked: [],
        },
      ],
    });
  const openOwn = (labels: string[] = ["Laptop"], answers: Answers = {}) =>
    openDrafts(
      {
        "GET /api/people": peopleWith([ownPerson]),
        "GET /api/lists": () =>
          Response.json({ lists: [sites, equipment(labels)] }),
        "GET /api/unpublished": linked(labels),
        ...answers,
      },
      "/drafts?tab=unpublished",
    );
  const box = (record: string) =>
    screen.getByRole("checkbox", { name: `Select the change to ${record}` });
  const selection = (more: object) => ({
    people: [],
    plannedHires: [],
    featureTeams: [],
    lists: [],
    choices: [],
    orders: [],
    columns: [],
    records: [],
    ...more,
  });

  it("ticks a change with every change linked to it, both ways, and unticks them together", async () => {
    // Given a list only drafted to be added, a choice added to it, and an unrelated change
    await openOwn();
    await screen.findByRole("checkbox", {
      name: "Select the change to Equipment",
    });

    // When the list is ticked
    await userEvent.click(box("Equipment"));

    // Then the choice that uses it is ticked too, and nothing else
    expect(box("Laptop in Equipment")).toHaveProperty("checked", true);
    expect(box("Blake Fictional")).toHaveProperty("checked", false);
    expect(
      screen.getByRole("button", { name: "Publish 2 changes" }),
    ).toBeDefined();

    // And unticking the choice unticks the list it uses
    await userEvent.click(box("Laptop in Equipment"));
    expect(box("Equipment")).toHaveProperty("checked", false);
    expect(
      screen.queryByRole("button", { name: "Publish 2 changes" }),
    ).toBeNull();

    // And ticking the choice ticks the list it uses
    await userEvent.click(box("Laptop in Equipment"));
    expect(box("Equipment")).toHaveProperty("checked", true);
  });

  it("names the changes a tick is linked to in its tip, and gives an unlinked change none", async () => {
    await openOwn();
    await screen.findByRole("checkbox", {
      name: "Select the change to Equipment",
    });
    const tipOf = (record: string) =>
      box(record).closest("[data-tip]")?.getAttribute("data-tip");
    expect(tipOf("Equipment")).toBe(
      "Linked to the change to Laptop in Equipment",
    );
    expect(box("Equipment").getAttribute("aria-description")).toBe(
      "Linked to the change to Laptop in Equipment",
    );
    expect(tipOf("Laptop in Equipment")).toBe(
      "Linked to the change to Equipment",
    );
    expect(tipOf("Blake Fictional")).toBeUndefined();
    expect(box("Blake Fictional").getAttribute("aria-description")).toBeNull();
  });

  it("names several linked changes in one tip", async () => {
    await openOwn(["Laptop", "Monitor"]);
    await screen.findByRole("checkbox", {
      name: "Select the change to Equipment",
    });
    expect(
      box("Equipment").closest("[data-tip]")?.getAttribute("data-tip"),
    ).toBe(
      "Linked to the changes to Laptop in Equipment and Monitor in Equipment",
    );
  });

  it("publishes exactly the changes ticked, saying how many, and unticks them", async () => {
    // Given the list and its choice ticked together
    const { fetch } = await openOwn(["Laptop"], {
      "POST /api/unpublished/publish": () =>
        Response.json({ total: 2, left: 0 }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the change to Laptop in Equipment",
      }),
    );

    // When Publish is chosen, which doesn't ask first
    await userEvent.click(
      screen.getByRole("button", { name: "Publish 2 changes" }),
    );

    // Then the ticked changes alone are published, and the page says so
    expect(await screen.findByText("Published 2 changes.")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/unpublished/publish")).toEqual([
      { drafts: selection({ lists: ["l9"], choices: ["c90"] }) },
    ]);
    await waitFor(() => {
      expect(box("Equipment")).toHaveProperty("checked", false);
    });
  });

  it("asks before discarding the changes ticked, and keeps them ticked when cancelled", async () => {
    const { fetch } = await openOwn(["Laptop"], {
      "POST /api/unpublished/discard": () => Response.json({ total: 1 }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the change to Blake Fictional",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Discard 1 change…" }),
    );
    const asking = await screen.findByRole("dialog", {
      name: "Discard 1 change?",
    });
    expect(
      within(asking).getByText(
        "The chosen change is discarded. This cannot be undone.",
      ),
    ).toBeDefined();
    await userEvent.click(
      within(asking).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(bodyOf(fetch, "POST", "/api/unpublished/discard")).toEqual([]);
    expect(box("Blake Fictional")).toHaveProperty("checked", true);

    // And discarding it, once asked, discards only that change
    await userEvent.click(
      screen.getByRole("button", { name: "Discard 1 change…" }),
    );
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Discard 1 change?" }),
      ).getByRole("button", { name: "Discard" }),
    );
    expect(await screen.findByText("Discarded 1 change.")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/unpublished/discard")).toEqual([
      { drafts: selection({ people: ["p2"] }) },
    ]);
  });

  it("asks before discarding several changes in the plural", async () => {
    await openOwn();
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the change to Equipment",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Discard 2 changes…" }),
    );
    expect(
      within(
        await screen.findByRole("dialog", { name: "Discard 2 changes?" }),
      ).getByText("The chosen changes are discarded. This cannot be undone."),
    ).toBeDefined();
  });

  it("unticks changes a search hides, so only changes in sight are published", async () => {
    await openOwn();
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the change to Equipment",
      }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search drafts" }),
      "Blake",
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Publish 2 changes" }),
      ).toBeNull();
    });
    await userEvent.clear(
      screen.getByRole("textbox", { name: "Search drafts" }),
    );
    expect(
      await screen.findByRole("checkbox", {
        name: "Select the change to Equipment",
      }),
    ).toHaveProperty("checked", false);
  });

  it("names the first three linked changes in a tip, and counts the rest", async () => {
    await openOwn(["Laptop", "Monitor", "Dock", "Mouse", "Stand"]);
    await screen.findByRole("checkbox", {
      name: "Select the change to Equipment",
    });
    expect(box("Equipment").getAttribute("aria-description")).toBe(
      "Linked to the changes to Laptop in Equipment, Monitor in Equipment, Dock in Equipment and 2 more",
    );
  });

  it("settles with nothing ticked once the changes ticked are published from the top bar", async () => {
    // Given the list and its choice ticked
    let published = false;
    await openOwn(["Laptop"], {
      "GET /api/unpublished": () =>
        published ? Response.json({ changes: [] }) : linked(["Laptop"])(),
      "GET /api/lists": () =>
        Response.json({
          lists: published ? [sites] : [sites, equipment(["Laptop"])],
        }),
      "POST /api/unpublished/publish": () => {
        published = true;
        return Response.json({ total: 4, left: 0 });
      },
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the change to Equipment",
      }),
    );

    // When every change is published from the top bar
    await userEvent.click(
      screen.getByRole("button", { name: "Publish 4 changes" }),
    );

    // Then the page settles, with nothing left to publish from its heading
    expect(await screen.findByText("Published 4 changes.")).toBeDefined();
    await waitFor(() => {
      expect(
        screen.queryByRole("checkbox", {
          name: "Select the change to Equipment",
        }),
      ).toBeNull();
    });
    expect(
      screen.queryByRole("button", { name: "Publish 2 changes" }),
    ).toBeNull();
  });

  it("can't tick a change whose linked change the search hides, and says so", async () => {
    // Given a search that shows the choice but not the list it uses
    await openOwn();
    await screen.findByRole("checkbox", {
      name: "Select the change to Equipment",
    });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search drafts" }),
      "Laptop",
    );

    // Then the choice can't be ticked, and its tip says the list isn't shown
    await waitFor(() => {
      expect(box("Laptop in Equipment")).toHaveProperty("disabled", true);
    });
    expect(box("Laptop in Equipment").getAttribute("aria-description")).toBe(
      "Linked to the change to Equipment, not shown in the table",
    );
  });

  it("links a change's details to the changes linked to it, each opening its own details", async () => {
    // Given the list's details open on Not published
    await openOwn();
    await userEvent.click(
      await screen.findByRole("button", { name: "Show details of Equipment" }),
    );
    const linked = await screen.findByRole("region", { name: "Linked to" });

    // When the linked choice is followed
    await userEvent.click(
      within(linked).getByRole("button", {
        name: /^#LIST-\d+ Laptop in Equipment$/u,
      }),
    );

    // Then the choice's details open, linked back to the list
    await waitFor(() => {
      expect(
        within(screen.getByRole("region", { name: "Linked to" })).getByRole(
          "button",
          { name: /^#LIST-\d+ Equipment$/u },
        ),
      ).toBeDefined();
    });
  });

  it("gives an unlinked change's details no Linked to", async () => {
    await openOwn();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Blake Fictional",
      }),
    );
    await screen.findByRole("region", { name: "Details" });
    expect(screen.queryByRole("region", { name: "Linked to" })).toBeNull();
  });

  it("names no Linked to in the details of a published draft", async () => {
    // A published list only drafted to be added, with a choice added to it
    const published = (more: object = {}) =>
      draft({ action: "created", changed: [], live: {}, ...more });
    await openDrafts({
      "GET /api/people": peopleWith([]),
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...equipment(["Laptop"]),
              draft: published(),
              choices: [
                {
                  id: "c90",
                  label: "Laptop",
                  description: "",
                  retired: false,
                  draft: published(),
                },
              ],
            },
          ],
        }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Show details of Equipment" }),
    );
    await screen.findByRole("region", { name: "Details" });
    expect(screen.queryByRole("region", { name: "Linked to" })).toBeNull();
  });
});

describe("loading for a role that sees part of the drafts", () => {
  it("ignores a failed read the role no longer makes, such as people's from before its role changed", async () => {
    // Given people that could not be loaded, still held from before the role changed
    serverAnswers({
      "GET /api/people": () =>
        Response.json({ error: "Down" }, { status: 503 }),
      "GET /api/lists": () => Response.json({ lists: [] }),
      "GET /api/release-streams": noStreams,
      "GET /api/projects": noPlan,
      "GET /api/projects/choices": noPlanChoices,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await queryClient.query(peopleQuery).catch(() => undefined);
    expect(queryClient.getQueryState(peopleQuery.queryKey)?.status).toBe(
      "error",
    );

    // When the Drafts page opens for a role that doesn't see people
    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={testTheme}>
          <DraftsPage
            approves={[]}
            seesPeople={false}
            view={emptyView}
            onView={() => undefined}
            applied={undefined}
            onApply={() => undefined}
            open={undefined}
            onOpen={() => undefined}
            recordLink={() => undefined}
          />
        </MantineProvider>
      </QueryClientProvider>,
    );

    // Then it loads
    expect(await screen.findByText("No drafts")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
