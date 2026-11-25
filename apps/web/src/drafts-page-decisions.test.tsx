// SPDX-License-Identifier: Apache-2.0

// Tests for deciding several drafts together on the Drafts page: ticking them, approving and
// rejecting them after asking, who changed each, and what the page says when that changes
// nothing or fails.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf } from "./test-support.tsx";
import {
  noStreams,
  s1,
  session,
  sites,
  draft,
  person,
  changed,
  live,
  peopleWith,
  openDrafts,
  showOn,
  entries,
} from "./test-drafts-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Drafts page", () => {
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

  it("clears the ticks once the drafts are approved", async () => {
    await openDrafts({
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    const avery = await screen.findByRole("checkbox", {
      name: "Select the draft of Avery Fictional",
    });
    await userEvent.click(avery);
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 1 draft…" }),
    );
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Approve 1 draft?" }),
      ).getByRole("button", { name: "Approve" }),
    );
    expect(await screen.findByText("Approved 1 draft.")).toBeDefined();
    await waitFor(() => {
      expect(
        screen.queryByRole("checkbox", {
          name: "Select the draft of Avery Fictional",
          checked: true,
        }),
      ).toBeNull();
    });
    expect(
      screen.queryByRole("button", { name: "Approve 1 draft…" }),
    ).toBeNull();
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
    expect(within(dialog).getByText("Reason needed")).toBeDefined();
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
});
