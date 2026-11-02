// SPDX-License-Identifier: Apache-2.0

// Tests for the Drafts page, with the server's responses simulated: each draft in words, newest
// first, with what it changes from the live values; rejected drafts with their reason; selecting
// drafts, and approving or rejecting them after asking, with a reason for rejecting; who may; and
// what the page says when there are none or they cannot be loaded.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { drafts } from "./decision-dialog.tsx";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";

const s1 = "00000000-0000-4000-8000-000000000001";

const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });
const approver = session(["drafts:approve", "people:view", "restricted:view"]);
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

type Answers = Parameters<typeof serverAnswers>[0];

async function openDrafts(answers: Answers = {}) {
  const fetch = serverAnswers({
    "GET /api/session": approver,
    "GET /api/people": peopleWith([changed, added, removed, rejected, live]),
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
      "Fictional Editor drafted adding Blake Fictional: Employee ID set to E-p2; Site set to Harbour",
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
      "Fictional Editor drafted a new order of Sites: Order from Harbour, Northmere Labs, a removed choice to Northmere Labs, Harbour Rejected: Keep the order",
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
    expect(within(dialog).getByText("the list Teams")).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([
        {
          people: [],
          lists: ["l2"],
          choices: ["c3"],
          orders: [],
          columns: [],
          columnOrder: false,
        },
      ]);
    });
  });

  it("puts drafts of columns and of the column order in words, and approves the order with the columns it places", async () => {
    const levels = {
      ...sites,
      id: "l2",
      name: "Levels",
      choices: [],
    };
    const fetch = serverAnswers({
      "GET /api/session": approver,
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
          ],
          order: ["preferredName", "f2", "employeeId", "f1"],
          orderDraft: draft({
            live: ["preferredName", "employeeId", "f1"],
            uses: ["f2"],
          }),
          views: [],
        }),
      "POST /api/drafts/approval": () => Response.json({ changeSetId: s1 }),
    });
    renderApp("/drafts");
    expect(await screen.findByText("the column Site")).toBeDefined();
    expect(screen.getByText(/List from Sites to Levels/)).toBeDefined();
    expect(screen.getByText("the column Previous site")).toBeDefined();
    expect(
      screen.getByText(
        /Order from Name, Employee ID, Site to Name, Previous site, Employee ID, Site/,
      ),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of People's columns",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("the column Previous site")).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([
        {
          people: [],
          lists: [],
          choices: [],
          orders: [],
          columns: ["f2"],
          columnOrder: true,
        },
      ]);
    });
  });

  it("opens for Approvers who see lists but not people, with only the drafts of lists", async () => {
    const fetch = serverAnswers({
      "GET /api/session": session(["drafts:approve", "configuration:view"]),
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
    // A rejected draft may be approved after all.
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Select the draft of Drew Fictional",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve 3 drafts" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 3 drafts?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    expect(await screen.findByText("Approved 3 drafts.")).toBeDefined();
    expect(bodiesOf(fetch, "/api/drafts/approval")).toEqual([
      {
        people: ["p1", "p2", "p4"],
        lists: [],
        choices: [],
        orders: [],
        columns: [],
        columnOrder: false,
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
        lists: [],
        choices: [],
        orders: [],
        columns: [],
        columnOrder: false,
        reason: "Fictional reason",
      },
    ]);
  });

  it("says when rejecting changed nothing, as for a draft already rejected for that reason", async () => {
    await openDrafts({
      "POST /api/drafts/rejection": () => Response.json({ changeSetId: null }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the draft of Drew Fictional",
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
