// SPDX-License-Identifier: Apache-2.0

// Tests for the Drafts page's drafts of the plan: customers, proposals, projects, milestones,
// features, release streams, cycles and releases, each put in words, linked and approved.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  streamId,
  streamsAnswer,
} from "./test-releases.ts";
import {
  bodyOf,
  featureDraft,
  noFeatureColumns,
  recordDraft,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";
import {
  noStreams,
  s1,
  session,
  peopleWith,
  noPlan,
  noPlanChoices,
  openDrafts,
  showOn,
  entries,
} from "./test-drafts-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Drafts page", () => {
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
              description: null,
              note: null,
              draft: recordDraft({ action: "created" }),
            },
            {
              id: "c0000000-0000-4000-8000-000000000002",
              keyNumber: 2,
              name: "Settled",
              description: null,
              note: null,
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
          canColourFeatures: false,
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
      "GET /api/release-streams": streamsAnswer([]),
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
          canColourFeatures: false,
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
          canColourFeatures: false,
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
});
