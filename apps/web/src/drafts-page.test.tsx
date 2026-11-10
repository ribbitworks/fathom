// SPDX-License-Identifier: Apache-2.0

// Tests for the Drafts page, with the server's responses simulated: each draft in words, newest
// first, with what it changes from the live values; rejected drafts with their reason; selecting
// drafts, and approving or rejecting them after asking, with a reason for rejecting; who may; what
// the page says when there are none or they cannot be loaded; and drafts of feature teams.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { drafts } from "./decision-dialog.tsx";
import {
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  fictionalUser,
  recordDraft,
  renderApp,
  serverAnswers,
  streamId,
  wholeText,
  noFeatureColumns,
  featureDraft,
} from "./test-support.tsx";

// No release streams, for drafts of other kinds.
const noStreams = () =>
  Response.json({ streams: [], canEditStreams: false, canEditReleases: false });

const s1 = "00000000-0000-4000-8000-000000000001";

const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });
const approver = session([
  "plan:approve",
  "releases:approve",
  "people:approve",
  "hiring-plan:approve",
  "configuration:approve",
  "people:view",
  "restricted:view",
]);
const reader = session(["people:view"]);

const sites = {
  id: "l1",
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
  Response.json({ people, fields: [site], order: [], views: [] });

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
  });

type Answers = Parameters<typeof serverAnswers>[0];

async function openDrafts(answers: Answers = {}) {
  const fetch = serverAnswers({
    "GET /api/session": approver,
    "GET /api/people": peopleWith([changed, added, removed, rejected, live]),
    "GET /api/release-streams": noStreams,
    "GET /api/lists": () => Response.json({ lists: [sites] }),
    ...answers,
  });
  renderApp("/drafts");
  await screen.findByRole("heading", { name: "Drafts" });
  return fetch;
}

const entries = async () =>
  (await screen.findAllByRole("listitem")).map(({ textContent }) =>
    textContent.replace(/^.*?(AM|PM|\d\d:\d\d)/, ""),
  );

function bodiesOf(fetch: ReturnType<typeof serverAnswers>, url: string) {
  return fetch.mock.calls
    .filter(([called, init]) => called === url && init?.method === "POST")
    .map(([, init]) => JSON.parse(init?.body as string) as unknown);
}

describe("the Drafts page", () => {
  it("puts each draft in words, newest first, with what it changes", async () => {
    await openDrafts();
    expect(await entries()).toEqual([
      "Fictional Editor drafted changes to Avery Fictional: Start set to Nov 2, 2026; Site from Northmere to Harbour; A deleted column changed",
      "Fictional Editor drafted adding Blake Fictional: ID set to E-p2; Site set to Harbour",
      "Fathom drafted removing Casey Fictional",
      "Fictional Editor drafted changes to Drew Fictional: Name from Drew Before to Drew Fictional Rejected: Fictional reason",
    ]);
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
    const fetch = await openDrafts({
      "GET /api/people": peopleWith([]),
      "GET /api/release-streams": noStreams,
      "GET /api/lists": () => Response.json({ lists: [drafted, teams] }),
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    const shown = await entries();
    expect(shown).toContain(
      "Fictional Editor drafted changes to the list Sites: Description set to Our offices",
    );
    expect(shown).toContain(
      "Fictional Editor drafted changes to the choice Northmere Labs in Sites: Name from Northmere to Northmere Labs; gone changed",
    );
    expect(shown).toContain(
      "Fictional Editor drafted a new order for Sites: From Harbour, Northmere, a removed choice to Northmere Labs, Harbour Rejected: Keep the order",
    );
    expect(shown).toContain("Fictional Editor drafted adding the list Teams");
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of the choice Platform in Teams",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft" }),
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
      expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([
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
    const fetch = await openDrafts({
      "GET /api/people": () =>
        Response.json({
          people: [given],
          fields: [site, guild],
          order: [],
          views: [],
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
      screen.getByRole("button", { name: "Approve 1 draft" }),
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
      expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([
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
          views: [],
        }),
    });
    const fetch = await openDrafts(answers(["people:approve"]));
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Finley Fictional",
      }),
    );
    expect(
      screen.queryByRole("checkbox", {
        name: "Select the draft of the column Guild",
      }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Another approver needed",
    });
    expect(
      within(dialog).getByText(
        "Your role doesn't let you approve these drafts:",
      ),
    ).toBeDefined();
    expect(within(dialog).getByText("the column Guild")).toBeDefined();
    expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([]);
  });

  it("names the drafts of other areas that rejecting would take with it", async () => {
    const guild = {
      id: "f2",
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
          views: [],
        }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of the column Guild",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Reject…" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Another approver needed",
    });
    expect(
      within(dialog).getByText(
        "Your role doesn't let you reject these drafts:",
      ),
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
              name: "Wiki",
              type: "link",
              listId: null,
              visibility: "general",
              draft: draft({ action: "created", changed: ["name"], live: {} }),
            },
          ],
          order: ["preferredName", "f2", "employeeId", "f1", "f3", "f4"],
          views: [],
        }),
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    renderApp("/drafts");
    expect(await screen.findByText("the column Site")).toBeDefined();
    expect(
      screen.getByText(wholeText(/List from Sites to Levels/)),
    ).toBeDefined();
    expect(screen.getByText("the column Previous site")).toBeDefined();
    expect(screen.getByText("the column Wiki")).toBeDefined();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of the column Previous site",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([
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
  });

  it("opens for Approvers who see lists but not people, with only the drafts of lists", async () => {
    const fetch = serverAnswers({
      "GET /api/session": session([
        "plan:approve",
        "releases:approve",
        "people:approve",
        "hiring-plan:approve",
        "configuration:approve",
        "configuration:view",
      ]),
      "GET /api/release-streams": noStreams,
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
    });
    renderApp("/drafts");
    expect(await screen.findByText("the list Sites")).toBeDefined();
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/api/people"))).toBe(
      false,
    );
  });

  it("lists drafts of customers, proposals, projects, and milestones in words", async () => {
    const projectId = "a0000000-0000-4000-8000-000000000001";
    serverAnswers({
      "GET /api/session": session(["plan:approve", "plan:view"]),
      "GET /api/release-streams": noStreams,
      "GET /api/projects/choices": noPlanChoices,
      "GET /api/projects": () =>
        Response.json({
          customers: [
            {
              id: "c0000000-0000-4000-8000-000000000001",
              name: "Fictional Customer",
              draft: recordDraft({ action: "created" }),
            },
            { id: "c0000000-0000-4000-8000-000000000002", name: "Settled" },
          ],
          proposals: [
            {
              id: "b0000000-0000-4000-8000-000000000001",
              name: "Fictional Proposal",
              externalId: null,
              link: null,
              ownerId: null,
              customerIds: [],
              statusId: "f0000000-0000-4000-8000-000000000001",
              draft: recordDraft({ action: "deleted" }),
            },
          ],
          projects: [
            {
              id: projectId,
              name: "Fictional Project",
              externalId: null,
              ownerId: null,
              customerIds: [],
              proposalIds: [],
              dates: { first: null, last: null, nextDelivery: null },
              draft: recordDraft({ action: "created" }),
              milestones: [
                {
                  id: "d0000000-0000-4000-8000-000000000001",
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
    expect(listed).toContain("the customer Fictional Customer");
    expect(listed).toContain("the proposal Fictional Proposal");
    expect(listed).toContain("the project Fictional Project");
    expect(listed).toContain(
      "the milestone Fictional Kickoff of Fictional Project",
    );
    expect(listed).not.toContain("Settled");
  });

  it("names a draft of a column on Features as being on Features", async () => {
    serverAnswers({
      "GET /api/session": session(["configuration:approve", "plan:view"]),
      "GET /api/release-streams": () =>
        Response.json({
          streams: [],
          canEditStreams: false,
          canEditReleases: false,
        }),
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
    expect(
      await screen.findByText(/the column Fictional Size on Features/),
    ).toBeDefined();
  });

  it("lists a feature's draft, naming the cycle in words", async () => {
    const streamOfCycles = fictionalStream();
    const [first, second] = streamOfCycles.cycles;
    serverAnswers({
      "GET /api/session": session(["plan:approve", "plan:view"]),
      "GET /api/release-streams": () =>
        Response.json({
          streams: [streamOfCycles],
          canEditStreams: false,
          canEditReleases: false,
        }),
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
              name: "Fictional Moving",
              statusId: "s1",
              neededBy: null,
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
    renderApp("/drafts");
    const entry = await screen.findByText(/the feature Fictional Moving/);
    expect(entry).not.toBeNull();
    expect(document.body.textContent).toContain(
      `${streamOfCycles.name}: ${String(second?.name)}`,
    );
  });

  it("tries the plan's records again when they could not be loaded", async () => {
    let healthy = false;
    serverAnswers({
      "GET /api/session": session(["plan:approve", "plan:view"]),
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

  it("puts a release's changed note in words without its formatting", async () => {
    serverAnswers({
      "GET /api/session": session([
        "plan:approve",
        "releases:approve",
        "people:approve",
        "hiring-plan:approve",
        "configuration:approve",
        "plan:view",
      ]),
      "GET /api/projects": noPlan,
      "GET /api/projects/choices": noPlanChoices,
      "GET /api/release-streams": () =>
        Response.json({
          streams: [
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
          ],
          canEditStreams: false,
          canEditReleases: false,
        }),
    });
    renderApp("/drafts");
    expect(await entries()).toEqual([
      "Fictional Editor drafted changes to the release Fictional One in Fictional Majors: Note from Scope open to Scope frozen",
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
        "releases:approve",
        "people:approve",
        "hiring-plan:approve",
        "configuration:approve",
        "plan:view",
      ]),
      "GET /api/projects": noPlan,
      "GET /api/projects/choices": noPlanChoices,
      "GET /api/release-streams": () =>
        Response.json({
          streams: [
            fictionalStream({
              id: "10000000-0000-4000-8000-000000000002",
              name: "Fictional Minors",
              patterns: [
                fictionalPattern({
                  id: "20000000-0000-4000-8000-000000000002",
                }),
              ],
            }),
            stream,
          ],
          canEditStreams: false,
          canEditReleases: false,
        }),
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    renderApp("/drafts");
    expect(await entries()).toEqual([
      "Fictional Editor drafted adding the release stream Fictional Majors",
      "Fictional Editor drafted changes to the cycles of Fictional Majors from 2027-01-01: Length from 2 to 3",
      "Fictional Editor drafted adding the release Fictional One in Fictional Majors",
    ]);
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of the release Fictional One in Fictional Majors",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    expect(
      within(dialog).getByText("the release stream Fictional Majors"),
    ).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([
        expect.objectContaining({
          records: [
            { type: "release", id: fictionalRelease().id },
            { type: "release-stream", id: streamId },
          ],
        }),
      ]);
    });
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
      "Ann Fictional, Fathom and Ben Fictional drafted removing Finley Fictional",
      "Ann Fictional drafted removing Gray Fictional",
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
      "Ann Fictional and Ben Fictional drafted changes to Hollis Fictional: Name from Hollis Before to Hollis Fictional (Ann Fictional); Start set to Nov 2, 2026; Site from Northmere to Harbour (Fathom)",
      "Ann Fictional and Ben Fictional drafted changes to the list Sites: Description set to Offices",
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
      screen.getByRole("button", { name: "Approve 1 draft" }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Reject…" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(
      screen.getByText(
        "1 chosen draft was changed by this account, so another approver must approve it.",
      ),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Blake Fictional",
      }),
    );
    expect(
      screen.getByText(
        "2 chosen drafts were changed by this account, so another approver must approve them.",
      ),
    ).toBeDefined();
  });

  it("approves the drafts selected, after asking", async () => {
    const fetch = await openDrafts({
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    const approve = await screen.findByRole("button", { name: "Approve" });
    expect(approve).toHaveProperty("disabled", true);
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Blake Fictional",
      }),
    );
    // A rejected draft is back with its makers until they send it again.
    expect(
      screen.getByRole("checkbox", {
        name: "Select the draft of Drew Fictional",
      }),
    ).toHaveProperty("disabled", true);
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 2 drafts" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    expect(await screen.findByText("Approved 2 drafts.")).toBeDefined();
    expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([
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
    const fetch = await openDrafts({
      "GET /api/people": peopleWith([hire]),
      "GET /api/lists": () =>
        Response.json({ lists: [sites, positions, states] }),
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    expect(await entries()).toEqual([
      "Fictional Editor drafted changes to the planned hire Engineer, REQ-7: State from Request to hire to Approved to hire",
    ]);
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of the planned hire Engineer, REQ-7",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    expect(await screen.findByText("Approved 1 draft.")).toBeDefined();
    expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([
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
  });

  it("selects all waiting drafts at once, and none again", async () => {
    await openDrafts();
    const all = await screen.findByRole("checkbox", {
      name: "Select all waiting",
    });
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Avery Fictional",
      }),
    );
    expect(all).toHaveProperty("indeterminate", true);
    await userEvent.click(all);
    expect(
      screen.getByRole("button", { name: "Approve 3 drafts" }),
    ).toBeDefined();
    await userEvent.click(all);
    expect(screen.getByRole("button", { name: "Approve" })).toHaveProperty(
      "disabled",
      true,
    );
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
    expect(screen.getByRole("button", { name: "Approve" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("keeps a new order that waits on a rejected choice from being selected, and approves the rest", async () => {
    const fetch = await openDrafts({
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
    });
    const order = await screen.findByRole("checkbox", {
      name: "Select the draft of Sites",
    });
    expect(order).toHaveProperty("disabled", true);
    expect(
      screen.getByText("Waiting for a rejected draft to be resubmitted"),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select all waiting" }),
    );
    expect(order).toHaveProperty("checked", false);
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    expect(within(dialog).queryByText(/skipped/)).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([
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
    const fetch = await openDrafts({
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
    expect(bodiesOf(fetch, "/api/drafts/rejection")).toEqual([
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
      screen.getByRole("button", { name: "Approve 1 draft" }),
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
      screen.getByRole("button", { name: "Approve 1 draft" }),
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
      screen.getByRole("button", { name: "Approve 1 draft" }),
    );
    await screen.findByRole("dialog", { name: "Approve 1 draft?" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("lets those who may not approve only read the drafts", async () => {
    await openDrafts({ "GET /api/session": reader });
    expect(await entries()).toHaveLength(4);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("says when there are no drafts, and offers nothing to select", async () => {
    await openDrafts({ "GET /api/people": peopleWith([live]) });
    expect(
      await screen.findByText("No drafts waiting for approval."),
    ).toBeDefined();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("offers no waiting drafts to select all when every draft is rejected", async () => {
    await openDrafts({ "GET /api/people": peopleWith([rejected]) });
    expect(
      await screen.findByRole("checkbox", { name: "Select all waiting" }),
    ).toHaveProperty("disabled", true);
  });

  it("says when the drafts cannot be loaded, and tries again", async () => {
    let failing = true;
    const fetch = await openDrafts({
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
      "Fictional Editor drafted changes to Fin Fictional: Start changed",
    ]);
  });

  it("searches the drafts, saying when none match", async () => {
    await openDrafts();
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
    expect(
      await screen.findByText("No drafts match the search."),
    ).toBeDefined();
    await userEvent.clear(
      screen.getByRole("textbox", { name: "Search drafts" }),
    );
    await waitFor(async () => {
      expect(await entries()).toHaveLength(4);
    });
  });

  it("says when a draft's time was not recorded", async () => {
    await openDrafts({
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
    });
    const items = await screen.findAllByRole("listitem");
    expect(
      items.map(({ textContent }) =>
        textContent.startsWith("Time not recorded"),
      ),
    ).toEqual([false, true, true]);
    expect(items[2]?.textContent).toMatch(/Hollis Fictional\s*Rejected$/);
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
        "org-chart:view",
        "people:view",
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
      "Fictional Editor drafted changes to the feature team Fictional Pier: Name from Fictional Quay to Fictional Pier; Feature lead from Blake Fictional to Avery Fictional; Members from Avery Fictional to Avery Fictional, Blake Fictional, Someone you can't see; Joining and leaving dates set to Avery Fictional, Jan 5, 2026; Blake Fictional, Jan 6, 2026; Someone you can't see, Jan 7, 2026",
    ]);
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
      "Fictional Editor drafted changes to the feature team Fictional Pier: Members set to Ellis Fictional; Joining and leaving dates set to Ellis Fictional, Jan 5, 2026",
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
      "Fictional Editor drafted changes to the feature team Fictional Pier: Feature lead from Blake Fictional to Avery Fictional; Date the feature lead changes set to Jan 5, 2026",
    ]);
  });

  it("says a change of lead's day changed without naming it for a reader not sent it", async () => {
    await open([
      featureTeam("Fictional Pier", {
        draft: draft({ action: "changed", changed: ["leadFrom"], live: {} }),
      }),
    ]);
    expect(await entries()).toEqual([
      "Fictional Editor drafted changes to the feature team Fictional Pier: Date the feature lead changes changed",
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
      "Fictional Editor drafted changes to the feature team Fictional Pier: Nothing is left to change, since the people it named have left",
    ]);
  });

  it("says the dates changed without naming them for a reader not sent them", async () => {
    await open([
      featureTeam("Fictional Pier", {
        draft: draft({ action: "changed", changed: ["memberFrom"], live: {} }),
      }),
    ]);
    expect(await entries()).toEqual([
      "Fictional Editor drafted changes to the feature team Fictional Pier: Joining and leaving dates changed",
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
      "Fictional Editor drafted changes to the feature team Fictional Pier: Name set to Fictional Pier; Feature lead changed; Members changed",
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
      "Fictional Editor drafted adding the feature team Fictional Beacon: Feature lead Avery Fictional; Members Avery Fictional, Blake Fictional; Joining and leaving dates set to Blake Fictional, Jan 6, 2026",
      "Fictional Editor drafted removing the feature team Fictional Wharf: Members Avery Fictional",
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
      "Fictional Editor drafted adding the feature team Fictional Beacon",
      "Fictional Editor drafted removing the feature team Fictional Wharf",
    ]);
  });

  it("approves a team's draft as a feature team", async () => {
    const fetch = await open(
      [
        featureTeam("Fictional Beacon", {
          draft: draft({ action: "created", changed: ["name"] }),
        }),
      ],
      { "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }) },
    );
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of the feature team Fictional Beacon",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    expect(await screen.findByText("Approved 1 draft.")).toBeDefined();
    expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([
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
  it("keeps drafts someone is changing, and one's own unpublished drafts, from being selected", async () => {
    await openDrafts({
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
    });
    const box = (name: string) =>
      screen.getByRole("checkbox", { name: `Select the draft of ${name}` });
    await screen.findByRole("checkbox", { name: "Select all waiting" });
    expect(
      screen.getByText(wholeText(/Being changed by Second Fictional Editor$/)),
    ).toBeDefined();
    expect(screen.getByText("Unpublished")).toBeDefined();
    expect(box("Avery Fictional")).toHaveProperty("disabled", true);
    expect(box("Blake Fictional")).toHaveProperty("disabled", true);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select all waiting" }),
    );
    expect(box("Casey Fictional")).toHaveProperty("checked", true);
    expect(box("Avery Fictional")).toHaveProperty("checked", false);
    expect(
      screen.getByRole("button", { name: "Approve 1 draft" }),
    ).toBeDefined();
  });
});
