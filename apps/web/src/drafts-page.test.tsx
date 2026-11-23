// SPDX-License-Identifier: Apache-2.0

// Tests for the Drafts page against a simulated server: reading, searching and counting the
// drafts, its tabs, deciding one draft alone from its row's menu or its details, and loading for
// a role that sees part of the drafts.

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
  bodyOf,
  renderApp,
  serverAnswers,
  testTheme,
} from "./test-support.tsx";
import {
  noStreams,
  s1,
  session,
  approver,
  reader,
  sites,
  draft,
  person,
  changed,
  added,
  removed,
  rejected,
  live,
  peopleWith,
  noPlan,
  noPlanChoices,
  openDrafts,
  entries,
} from "./test-drafts-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Drafts page", () => {
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
