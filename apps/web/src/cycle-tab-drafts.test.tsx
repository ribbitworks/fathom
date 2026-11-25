// SPDX-License-Identifier: Apache-2.0

// Tests for cycles' drafts: how the table, details and row menu show them, and deciding them.

import type { Cycle, RecordDraft } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  fictionalCycle,
  fictionalMinors,
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  minorsId,
  quarters,
  streamId,
} from "./test-releases.ts";
import {
  bodyOf,
  detailValue,
  fictionalUser,
  recordCell,
  recordDraft,
  serverAnswers,
} from "./test-support.tsx";
import {
  setUpEachTest,
  changeSetId,
  patternId,
  editsStreams,
  bySchedule,
  openPage,
  cycleId,
  openCycle,
  cyclePanel,
  grid,
  rowTexts,
  shortened,
} from "./test-cycle-tab.tsx";

setUpEachTest();

const savedAs = () => Response.json({ changeSetId });

const approver = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "plan:view",
      "features:view",
      "plan:approve",
      "features:approve",
      "configuration:approve",
    ],
  });

// Chooses an item from the menu of a cycle's row, from the ⋯ beside its name.
async function chooseRowAction(name: string, item: string) {
  const [more] = within(grid()).getAllByRole("button", {
    name: `Actions for ${name}`,
  });
  await userEvent.click(more as HTMLElement);
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

// The texts of the menu of a cycle's row, from the ⋯ beside its name.
async function rowMenuTexts(name: string) {
  const [more] = within(grid()).getAllByRole("button", {
    name: `Actions for ${name}`,
  });
  await userEvent.click(more as HTMLElement);
  const menu = await screen.findByRole("menu");
  return [...menu.querySelectorAll("[role='menuitem'], p, div[class*='label']")]
    .map(({ textContent }) => textContent)
    .filter((text) => text !== "");
}

describe("a cycle's drafts", () => {
  it("mark the values a draft of its schedule's cycles changes, with each as it is live, and the row for its Duration", async () => {
    await openPage([shortened()], bySchedule);
    expect(rowTexts()).toEqual([
      "Fictional Majors2 cycles",
      "27.2, DraftFictional MajorsApr 1, 2027May 31, 2027, Draft: changed from “Jun 30, 2027”, draft, live Jun 30, 2027Current",
      "27.3, DraftFictional MajorsJun 1, 2027, Draft: changed from “Jul 1, 2027”, draft, live Jul 1, 2027Sep 30, 2027",
    ]);
  });

  it("mark the Duration in the cycle's details, with its length as it is live", async () => {
    await openCycle([shortened()]);
    expect(
      ["Ends", "Duration"].map((label) => detailValue(label, cyclePanel())),
    ).toEqual([
      "May 31, 2027, Draft: changed from “Jun 30, 2027”Jun 30, 2027, live",
      "2 months, Draft: changed from “3 months”3 months, live",
    ]);
  });

  it("say in the row's menu what the draft is and what it changes", async () => {
    await openPage([shortened()], { can: editsStreams });
    expect(await rowMenuTexts("Fictional Majors: 27.2")).toEqual(
      expect.arrayContaining([
        "Part of a change to the cycles of Fictional Majors from 27.2",
        "Discard draft",
      ]),
    );
  });

  it("mark a cycle's Release that its release's own draft changes, saying so in the row's menu", async () => {
    const renamed = fictionalRelease({
      firstCycle: "2027-04-01",
      lastCycle: "2027-04-01",
      name: "Fictional New",
      draft: recordDraft({
        changed: ["name"],
        live: { name: "Fictional Old" },
      }),
    });
    await openPage([fictionalStream({ releases: [renamed] })], {
      can: editsStreams,
    });

    expect(recordCell(cycleId("2027-04-01"), "release")?.textContent).toContain(
      "Draft",
    );
    expect(await rowMenuTexts("Fictional Majors: 27.2")).toEqual(
      expect.arrayContaining(["Part of a change to Fictional New"]),
    );
  });

  it("are discarded from the row's menu, as the draft of the pattern behind the cycle", async () => {
    const { fetch } = await openPage([shortened()], {
      can: editsStreams,
      answers: {
        [`DELETE /api/records/cycle-pattern/${patternId}/draft`]: savedAs,
      },
    });
    await chooseRowAction("Fictional Majors: 27.3", "Discard draft");
    expect(await screen.findByText("Discarded the draft.")).toBeDefined();
    expect(
      fetch.mock.calls
        .filter(([, init]) => init?.method === "DELETE")
        .map(([url]) => url),
    ).toEqual([`/api/records/cycle-pattern/${patternId}/draft`]);
  });

  it("discard a release's own draft from a cycle's menu, as the release's draft", async () => {
    const renamed = fictionalRelease({
      firstCycle: "2027-04-01",
      lastCycle: "2027-04-01",
      draft: recordDraft({
        changed: ["name"],
        live: { name: "Fictional Old" },
      }),
    });
    const { fetch } = await openPage(
      [fictionalStream({ releases: [renamed] })],
      {
        can: { canEditReleases: true },
        answers: {
          [`DELETE /api/records/release/${renamed.id}/draft`]: savedAs,
        },
      },
    );

    await chooseRowAction("Fictional Majors: 27.2", "Discard draft");

    expect(await screen.findByText("Discarded the draft.")).toBeDefined();
    expect(
      fetch.mock.calls
        .filter(([, init]) => init?.method === "DELETE")
        .map(([url]) => url),
    ).toEqual([`/api/records/release/${renamed.id}/draft`]);
  });

  it.each([
    ["those who change releases", { canEditReleases: true }, true],
    ["those who change only schedules", editsStreams, false],
  ])(
    "offer a release's own draft in a cycle's menu to %s alone",
    async (_who, can, offered) => {
      const renamed = fictionalRelease({
        firstCycle: "2027-04-01",
        lastCycle: "2027-04-01",
        draft: recordDraft({
          changed: ["name"],
          live: { name: "Fictional Old" },
        }),
      });
      await openPage([fictionalStream({ releases: [renamed] })], { can });

      expect(
        (await rowMenuTexts("Fictional Majors: 27.2")).includes(
          "Discard draft",
        ),
      ).toBe(offered);
    },
  );

  it("are resubmitted from the row's menu once rejected", async () => {
    const rejected = shortened({
      patterns: [
        fictionalPattern(),
        fictionalPattern({
          id: patternId,
          startsOn: "2027-04-01",
          length: 2,
          draft: recordDraft({
            action: "created",
            state: "rejected",
            reason: "Fictional reason",
          }),
        }),
      ],
    });
    await openPage([rejected], {
      can: editsStreams,
      answers: {
        [`DELETE /api/records/cycle-pattern/${patternId}/draft/rejection`]:
          savedAs,
      },
    });
    await chooseRowAction("Fictional Majors: 27.2", "Resubmit");
    expect(await screen.findByText("Resubmitted the draft.")).toBeDefined();
  });

  it("are approved all at once from the Draft menu as one draft, though it changes several cycles", async () => {
    await openPage([shortened()], {
      answers: { "GET /api/session": approver },
    });
    await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Approve/ }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Approve 1 draft?" }),
    ).toBeDefined();
  });

  it("are approved from the row's menu, as the draft of the pattern behind the cycle", async () => {
    const { fetch } = await openPage([shortened()], {
      answers: {
        "GET /api/session": approver,
        "POST /api/drafts/approval": savedAs,
      },
    });
    await chooseRowAction("Fictional Majors: 27.2", "Approve draft…");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        expect.objectContaining({
          records: [{ type: "cycle-pattern", id: patternId }],
        }),
      ]);
    });
  });

  describe("with the release's own draft changing the cycle too", () => {
    const releaseId = "30000000-0000-4000-8000-000000000001";
    // 27.2's release drafted to be renamed, besides the new pattern that shortens 27.2.
    const renamedToo = (release: Partial<RecordDraft> = {}) =>
      shortened({
        releases: [
          fictionalRelease({
            name: "Harbour",
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
            draft: recordDraft({
              changed: ["name"],
              live: { name: "Fictional One" },
              ...release,
            }),
          }),
        ],
      });

    const approvedBody = async (fetch: Parameters<typeof bodyOf>[0]) => {
      const dialog = await screen.findByRole("dialog", {
        name: /^Approve \d drafts?\?$/,
      });
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Approve" }),
      );
      await waitFor(() => {
        expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toHaveLength(1);
      });
      return bodyOf(fetch, "POST", "/api/drafts/approval");
    };

    async function approveFromRow(session: () => Response) {
      const { fetch } = await openPage([renamedToo()], {
        answers: {
          "GET /api/session": session,
          "POST /api/drafts/approval": savedAs,
        },
      });
      await chooseRowAction("Fictional Majors: 27.2", "Approve draft…");
      return approvedBody(fetch);
    }

    // The release's rename waiting, and the new length's draft as given.
    const withLength = (
      draft: Partial<RecordDraft>,
      release: Partial<RecordDraft> = {},
    ) => ({
      ...renamedToo(release),
      patterns: [
        fictionalPattern(),
        fictionalPattern({
          id: patternId,
          startsOn: "2027-04-01",
          length: 2,
          draft: recordDraft({ action: "created", ...draft }),
        }),
      ],
    });
    const releaseAlone = [
      expect.objectContaining({
        records: [{ type: "release", id: releaseId }],
      }),
    ];

    it("are approved from the Draft menu as the release's draft alone once the new length is rejected", async () => {
      const { fetch } = await openPage([withLength({ state: "rejected" })], {
        answers: {
          "GET /api/session": approver,
          "POST /api/drafts/approval": savedAs,
        },
      });

      await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
      const menu = await screen.findByRole("menu");
      expect(within(menu).getByText("Waiting drafts")).toBeDefined();
      await userEvent.click(
        within(menu).getByRole("menuitem", { name: /^Approve/ }),
      );

      expect(await approvedBody(fetch)).toEqual(releaseAlone);
    });

    it.each([
      ["rejected", { state: "rejected" }, "Reject Harbour's draft…"],
      [
        "rejected, and the approver's own",
        { state: "rejected", needsOtherApprover: true },
        "Reject Harbour's draft…",
      ],
      ["the approver's own", { needsOtherApprover: true }, "Reject draft…"],
    ] as const)(
      "are approved from the row's menu as the release's draft alone, named, where the new length is %s",
      async (_case, draft, reject) => {
        const { fetch } = await openPage([withLength(draft)], {
          answers: {
            "GET /api/session": approver,
            "POST /api/drafts/approval": savedAs,
          },
        });

        expect(await rowMenuTexts("Fictional Majors: 27.2")).toEqual(
          expect.arrayContaining(["Approve Harbour's draft…", reject]),
        );
        await userEvent.click(
          screen.getByRole("menuitem", { name: "Approve Harbour's draft…" }),
        );

        expect(await approvedBody(fetch)).toEqual(releaseAlone);
      },
    );

    it.each([
      [
        "Draft menu",
        () => screen.getByRole("button", { name: /^Draft/ }),
        /^Reject /,
      ],
      [
        "row's menu",
        () =>
          within(grid()).getAllByRole("button", {
            name: "Actions for Fictional Majors: 27.2",
          })[0] as HTMLElement,
        "Reject Harbour's draft…",
      ],
    ])(
      "are rejected from the %s as the release's draft alone once the new length is rejected",
      async (_case, menuButton, item) => {
        const { fetch } = await openPage([withLength({ state: "rejected" })], {
          answers: {
            "GET /api/session": approver,
            "POST /api/drafts/rejection": savedAs,
          },
        });

        await userEvent.click(menuButton());
        await userEvent.click(
          await screen.findByRole("menuitem", { name: item }),
        );
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

        await waitFor(() => {
          expect(bodyOf(fetch, "POST", "/api/drafts/rejection")).toEqual([
            expect.objectContaining({
              records: [{ type: "release", id: releaseId }],
            }),
          ]);
        });
      },
    );

    it("turn the row's Approve off, saying why, where both drafts are the approver's own", async () => {
      await openPage(
        [
          withLength(
            { needsOtherApprover: true },
            { needsOtherApprover: true },
          ),
        ],
        { answers: { "GET /api/session": approver } },
      );

      await rowMenuTexts("Fictional Majors: 27.2");
      const menu = screen.getByRole("menu");

      expect(
        within(menu)
          .getByRole("menuitem", { name: "Approve draft…" })
          .hasAttribute("data-disabled"),
      ).toBe(true);
      expect(within(menu).getByText("Needs another approver")).toBeDefined();
    });

    it("are both approved from the row's menu", async () => {
      expect(await approveFromRow(approver)).toEqual([
        expect.objectContaining({
          records: [
            { type: "cycle-pattern", id: patternId },
            { type: "release", id: releaseId },
          ],
        }),
      ]);
    });

    it("leave the release's draft for a role that doesn't approve releases", async () => {
      const plansOnly = () =>
        Response.json({
          ...fictionalUser,
          permissions: ["plan:view", "features:view", "plan:approve"],
        });
      expect(await approveFromRow(plansOnly)).toEqual([
        expect.objectContaining({
          records: [{ type: "cycle-pattern", id: patternId }],
        }),
      ]);
    });
  });

  it("offer nothing to decide on a cycle no draft changes", async () => {
    await openPage([shortened()], {
      path: "/releases?tab=cycles&later=shown",
      answers: { "GET /api/session": approver },
    });
    expect(await rowMenuTexts("Fictional Majors: 27.4")).toEqual([
      "Fictional Majors: 27.4",
      "Show details",
    ]);
  });

  // Fictional Majors' 27.2 drafted to be cut into months, named by month: the first takes 27.2's
  // first day, the second is new, and 27.3 goes.
  const split = () => {
    const [first, second, third] = quarters(3) as [Cycle, Cycle, Cycle];
    return fictionalStream({
      patterns: [
        fictionalPattern(),
        fictionalPattern({
          id: patternId,
          startsOn: "2027-04-01",
          length: 1,
          naming: "{YY}.{MM}",
          draft: recordDraft({ action: "created" }),
        }),
      ],
      cycles: [
        first,
        { ...second, endsOn: "2027-04-30", name: "27.04" },
        {
          ...second,
          startsOn: "2027-05-01",
          endsOn: "2027-05-31",
          name: "27.05",
        },
      ],
      liveCycles: [first, second, third],
    });
  };

  it("mark a cycle a draft adds, one it removes, and one starting the same day as it is live renamed", async () => {
    await openPage([split()], {
      path: "/releases?tab=cycles&grouping=schedule&past=shown",
    });
    expect(rowTexts()).toEqual([
      "Fictional Majors4 cycles",
      "27.1Fictional MajorsJan 1, 2027Mar 31, 2027",
      "27.04, Draft: changed from “27.2”, Draft, draft, live 27.2Fictional MajorsApr 1, 2027Apr 30, 2027, Draft: changed from “Jun 30, 2027”, draft, live Jun 30, 2027, Draft: changed from “Current”, draft, live Current",
      "27.05, Draft: added, draftFictional Majors, draftMay 1, 2027, draftMay 31, 2027, draftCurrent, draft, draft",
      "27.3, Draft: removedFictional MajorsJul 1, 2027Sep 30, 2027",
    ]);
  });

  describe("Live rows", () => {
    const everyCycle = "/releases?tab=cycles&past=shown&later=shown";
    // The Live rows under drafted ones, as seen; assistive technology hears each changed cell's live
    // value instead.
    const liveRowTexts = () =>
      [...grid().querySelectorAll('tr[aria-hidden="true"]')].map(
        ({ textContent }) => textContent,
      );

    it("name a cycle a new length moves", async () => {
      // Given 27.3 drafted to start on Jun 1, so its identifier as it is live is another
      await openPage([shortened()], { path: everyCycle });

      // Then its Live row names it
      expect(liveRowTexts()).toContainEqual(
        expect.stringMatching(/^27\.3, live.*Jul 1, 2027/),
      );
      expect(liveRowTexts().join()).not.toContain(streamId);
    });

    it("name a cycle and its release as they are live, where drafts rename both", async () => {
      // Given 27.2 renamed 27.04, and its release renamed
      await openPage(
        [
          {
            ...split(),
            releases: [
              fictionalRelease({
                name: "Harbour",
                colour: "teal",
                firstCycle: "2027-04-01",
                lastCycle: "2027-04-01",
                draft: recordDraft({
                  changed: ["name"],
                  live: { name: "Fictional One" },
                }),
              }),
            ],
          },
        ],
        { path: everyCycle },
      );

      // Then its Live row names both as they are live
      expect(liveRowTexts()).toContainEqual(
        expect.stringMatching(/^27\.2, live.*Fictional One, live$/),
      );
      // And the release keeps its colour's square in both rows
      const renamedRow = within(grid())
        .getAllByRole("row")
        .find(({ textContent }) => textContent.startsWith("27.04"));
      const liveRow = grid().querySelector('tr[aria-hidden="true"]');
      expect(renamedRow?.querySelector('[data-colour="teal"]')).not.toBeNull();
      expect(liveRow?.querySelector('[data-colour="teal"]')).not.toBeNull();
    });

    it("name a cycle moved off a first day another drafted cycle now has", async () => {
      // Given 27.2 moved from Apr 1 to Feb 1, and 27.04 drafted to start on Apr 1
      await openPage(
        [
          fictionalStream({
            patterns: [
              fictionalPattern({
                draft: recordDraft({ changed: ["length"] }),
              }),
            ],
            cycles: [
              fictionalCycle("27.1", "2027-01-01", "2027-01-31"),
              fictionalCycle("27.2", "2027-02-01", "2027-02-28"),
              fictionalCycle("27.3", "2027-03-01", "2027-03-31"),
              fictionalCycle("27.04", "2027-04-01", "2027-04-30"),
            ],
            liveCycles: [
              fictionalCycle("27.1", "2027-01-01", "2027-03-31"),
              fictionalCycle("27.2", "2027-04-01", "2027-06-30"),
            ],
          }),
        ],
        { path: everyCycle },
      );

      // Then 27.2's Live row names it, not the cycle now starting on its old first day
      expect(liveRowTexts()).toContainEqual(
        expect.stringMatching(/^27\.2, live.*Apr 1, 2027/),
      );
    });
  });

  it("leave out a cycle a draft removes once drafts are applied", async () => {
    await openPage([split()], {
      path: "/releases?tab=cycles&grouping=schedule&past=shown&show=drafts",
    });
    expect(rowTexts().map((text) => text.slice(0, 5))).toEqual([
      "Ficti",
      "27.1F",
      "27.04",
      "27.05",
    ]);
  });

  it("say which change of a schedule's end is behind a cycle it cuts short", async () => {
    const [first, second] = quarters(2) as [Cycle, Cycle];
    await openPage(
      [
        fictionalStream({
          endsOn: "2027-05-31",
          draft: recordDraft({ changed: ["endsOn"], live: { endsOn: null } }),
          cycles: [first, { ...second, endsOn: "2027-05-31" }],
          liveCycles: [first, second],
        }),
      ],
      { can: editsStreams },
    );
    expect(await rowMenuTexts("Fictional Majors: 27.2")).toEqual(
      expect.arrayContaining([
        "Part of a change to when Fictional Majors ends",
      ]),
    );
  });

  it("leave out a schedule drafted to be removed once drafts are applied", async () => {
    await openPage(
      [
        fictionalStream({ draft: recordDraft({ action: "deleted" }) }),
        fictionalMinors(),
      ],
      { path: "/releases?tab=cycles&grouping=schedule&show=drafts" },
    );
    expect(rowTexts()[0]).toBe("Fictional Minors2 cycles");
  });

  it("show a schedule only drafted to be added with every cycle added, none under Live only, where its cycles don't open", async () => {
    const added = fictionalMinors({
      draft: recordDraft({ action: "created" }),
    });
    await openPage([fictionalStream(), added], {
      path: `/releases?tab=cycles&grouping=schedule&show=live&open=${encodeURIComponent(cycleId("2027-04-01", minorsId))}`,
    });
    expect(rowTexts()[0]).toBe("Fictional Majors2 cycles");
    expect(rowTexts()).toHaveLength(3);
    expect(
      screen.queryByRole("heading", { level: 2, name: /^Fictional Minors: / }),
    ).toBeNull();
  });
  describe("published as the change behind the cycle", () => {
    const schedulesEditor = () =>
      Response.json({
        ...fictionalUser,
        permissions: ["plan:view", "features:view", "configuration:edit"],
      });
    // The user's own new pattern for Fictional Majors from 27.2, which goes with no other change.
    const unpublished = shortened({
      patterns: [
        fictionalPattern(),
        fictionalPattern({
          id: patternId,
          startsOn: "2027-04-01",
          length: 2,
          draft: recordDraft({ action: "created", unpublished: true }),
        }),
      ],
    });
    const answers = {
      "GET /api/session": schedulesEditor,
      "GET /api/unpublished": () =>
        Response.json({
          changes: [
            {
              subject: "the cycles of Fictional Majors from 27.2",
              action: "created",
              key: `cycle-pattern ${patternId}`,
              linked: [],
            },
          ],
        }),
      "POST /api/unpublished/publish": () =>
        Response.json({ total: 1, left: 0 }),
    };
    const publishedRecords = (fetch: ReturnType<typeof serverAnswers>) =>
      (
        bodyOf(fetch, "POST", "/api/unpublished/publish") as {
          drafts: { records: unknown[] };
        }[]
      ).map(({ drafts }) => drafts.records);

    it("from its row's menu", async () => {
      const { fetch } = await openPage([unpublished], {
        can: editsStreams,
        answers,
      });

      await chooseRowAction("Fictional Majors: 27.3", "Publish draft…");

      expect(await screen.findByText("Published 1 change.")).toBeDefined();
      expect(publishedRecords(fetch)).toEqual([
        [{ type: "cycle-pattern", id: patternId }],
      ]);
    });

    it("from the ⋯ in its details", async () => {
      const { fetch } = await openCycle([unpublished], {
        can: editsStreams,
        answers,
      });
      await userEvent.click(
        within(cyclePanel()).getByRole("button", { name: /^Actions for / }),
      );

      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Publish draft…" }),
      );

      expect(await screen.findByText("Published 1 change.")).toBeDefined();
      expect(publishedRecords(fetch)).toEqual([
        [{ type: "cycle-pattern", id: patternId }],
      ]);
    });
  });
});
