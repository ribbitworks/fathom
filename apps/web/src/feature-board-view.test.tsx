// SPDX-License-Identifier: Apache-2.0

// Tests for the Features Board against a simulated server.

import type { Feature, ProjectPlan, ReleaseStream } from "@fathom/shared";
import { startingEffortConversions } from "@fathom/shared";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  featureDraft,
  fictionalRelease,
  fictionalStream,
  fictionalUser,
  noFeatureColumns,
  quarters,
  recordDraft,
  renderApp,
  serverAnswers,
  streamId,
  tipOn,
} from "./test-support.tsx";

// The board's width, which the simulated browser can't measure, changed by the tests.
const size = vi.hoisted(() => ({
  width: 1000,
  set: (width: number) => {
    size.width = width;
  },
}));

// Semgrep can't parse typeof import() as a type argument.
type Hooks = typeof import("@mantine/hooks");

vi.mock("@mantine/hooks", async (importOriginal) => {
  const actual = await importOriginal<Hooks>();
  const { useState } = await import("react");
  return {
    ...actual,
    useElementSize: () => {
      const [width, setWidth] = useState(size.width);
      size.set = setWidth;
      return { ref: () => undefined, width, height: 0 };
    },
  };
});

// 2027-05-10 is in the second of the stream's quarters, 27.2.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-05-10T12:00:00Z"));
  size.width = 1000;
});

afterEach(() => {
  vi.useRealTimers();
});

const ids = {
  planned: "f0000000-0000-4000-8000-000000000001",
  likely: "f0000000-0000-4000-8000-000000000002",
  started: "f0000000-0000-4000-8000-000000000003",
  critical: "f0000000-0000-4000-8000-000000000004",
  low: "f0000000-0000-4000-8000-000000000005",
  medium: "f0000000-0000-4000-8000-000000000006",
  high: "f0000000-0000-4000-8000-000000000007",
  calm: "f0000000-0000-4000-8000-000000000008",
};

const feature = (name: string, more: Partial<Feature> = {}): Feature => ({
  id: crypto.randomUUID(),
  keyNumber: 1,
  name,
  statusId: ids.planned,
  priorityId: null,
  sizeId: null,
  riskId: null,
  neededBy: null,
  customerIds: [],
  targetStreamId: null,
  targetCycle: null,
  estimateHours: null,
  featureTeamId: null,
  description: null,
  note: null,
  values: {},
  links: {},
  staffed: false,
  staffedLive: false,
  ...more,
});

const target = (cycle: string) => ({
  targetStreamId: streamId,
  targetCycle: cycle,
});

const alpha = feature("Fictional Alpha", {
  ...target("2027-04-01"),
  priorityId: ids.critical,
  sizeId: ids.medium,
  riskId: ids.high,
  neededBy: "2027-06",
});
const beta = feature("Fictional Beta", {
  ...target("2027-04-01"),
  statusId: ids.likely,
  priorityId: ids.low,
});
const gamma = feature("Fictional Gamma", {
  ...target("2027-07-01"),
  statusId: ids.started,
  staffed: true,
  draft: featureDraft({
    changed: ["targetCycle"],
    live: { targetCycle: "2027-04-01" },
    unpublished: true,
  }),
});
const later = feature("Fictional Later", { staffed: true });

const customers = [
  {
    id: "c0000000-0000-4000-8000-000000000001",
    keyNumber: 1,
    name: "Fictional Harbour",
  },
  {
    id: "c0000000-0000-4000-8000-000000000002",
    keyNumber: 2,
    name: "Fictional Quay",
  },
];

const plan = (features: Feature[]): ProjectPlan => ({
  customers,
  projects: [],
  proposals: [],
  features,
  featureColumns: noFeatureColumns,
  canEdit: false,
  canEditFeatures: true,
});

const majors = fictionalStream({
  cycles: quarters(6),
  releases: [
    fictionalRelease({
      name: "Fictional Two LTS",
      firstCycle: "2027-04-01",
      lastCycle: "2027-04-01",
      colour: "grape",
      draft: recordDraft({
        changed: ["name"],
        live: { name: "Fictional Two" },
      }),
    }),
    fictionalRelease({
      id: "30000000-0000-4000-8000-000000000002",
      name: "Fictional Three",
      firstCycle: "2027-10-01",
      lastCycle: "2027-10-01",
      draft: recordDraft({
        changed: ["firstCycle", "lastCycle"],
        live: { firstCycle: "2027-07-01", lastCycle: "2027-07-01" },
      }),
    }),
  ],
});
const retiring: ReleaseStream = {
  ...fictionalStream({ name: "Fictional Minors" }),
  id: "10000000-0000-4000-8000-000000000002",
  retired: true,
  draft: recordDraft({ changed: ["retired"], live: { retired: false } }),
};
const retired: ReleaseStream = {
  ...fictionalStream({ name: "Fictional Old" }),
  id: "10000000-0000-4000-8000-000000000003",
  retired: true,
};

const choices = {
  owners: [],
  statuses: [],
  featureStatuses: [
    { id: ids.likely, name: "Likely", retired: false, meaning: "possible" },
    { id: ids.planned, name: "Planned", retired: false, meaning: "planned" },
    {
      id: ids.started,
      name: "In progress",
      retired: false,
      meaning: "in-progress",
    },
  ],
  featureTeams: [],
  priorities: [
    { id: ids.critical, name: "Critical", retired: false },
    { id: ids.low, name: "Low", retired: false },
  ],
  sizes: [{ id: ids.medium, name: "M", retired: false, weight: 2 }],
  risks: [
    { id: ids.calm, name: "Low", retired: false },
    { id: "f0000000-0000-4000-8000-000000000009", name: "Old", retired: true },
    { id: ids.high, name: "High", retired: false },
  ],
};

async function openBoard(
  path = "/features?mode=board",
  {
    features = [alpha, beta, gamma, later],
    streams = [majors, retiring, retired],
    answers = {},
  }: {
    features?: Feature[];
    streams?: ReleaseStream[];
    answers?: Parameters<typeof serverAnswers>[0];
  } = {},
) {
  serverAnswers({
    "GET /api/session": () =>
      Response.json({
        ...fictionalUser,
        permissions: ["plan:view", "features:view", "features:edit"],
      }),
    "GET /api/projects": () => Response.json(plan(features)),
    "GET /api/projects/choices": () => Response.json(choices),
    "GET /api/release-streams": () =>
      Response.json({ streams, canEditStreams: false, canEditReleases: false }),
    "GET /api/effort-conversions": () =>
      Response.json(startingEffortConversions),
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("button", { name: /^Group by/ });
  return history;
}

const column = (name: string) => screen.getByRole("list", { name });

const cardNames = (name: string) =>
  within(column(name))
    .queryAllByRole("button")
    .filter(
      (button) => !button.getAttribute("aria-label")?.startsWith("Actions for"),
    )
    .map(({ textContent }) =>
      [alpha, beta, gamma, later]
        .map(({ name }) => name)
        .find((name) => textContent.startsWith(name)),
    );

const card = (name: string) =>
  screen.getByRole("button", { name: (label) => label.startsWith(name) });

const headings = () =>
  screen
    .getAllByText(/^(Cycle \d\d\.\d|Later)$/)
    .filter((text) => text.tagName === "P")
    .map(({ textContent }) => textContent);

describe("switching Features between its table and its board", () => {
  it("shows the table, then the board, keeping the choice in the address", async () => {
    const history = await openBoard("/features");
    expect(screen.getByRole("grid", { name: "Features" })).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "Board" }));
    await screen.findByRole("list", { name: "Later" });
    expect(screen.queryByRole("grid")).toBeNull();
    expect(history.location.search).toContain("mode=board");
    await userEvent.click(screen.getByRole("radio", { name: "Table" }));
    await screen.findByRole("grid", { name: "Features" });
    expect(history.location.search).not.toContain("mode");
  });
});

describe("the columns", () => {
  it("shows the stream's cycles from the current one, as many as fit, then Later", async () => {
    await openBoard();
    expect(headings()).toEqual([
      "Cycle 27.2",
      "Cycle 27.3",
      "Cycle 27.4",
      "Cycle 28.1",
      "Later",
    ]);
  });

  it("marks the current cycle, and its release's draft with what it was", async () => {
    await openBoard();
    const current = screen.getByText("Cycle 27.2").parentElement as HTMLElement;
    expect(current.getAttribute("aria-current")).toBe("date");
    expect(current.textContent).toContain("Fictional Two LTS");
    expect(current.textContent).toContain(
      "Draft: changed from “Fictional Two”",
    );
  });

  it("shows a release a draft moves, and where it is live, dimmed", async () => {
    await openBoard();
    const header = (name: string) =>
      screen.getByText(name).parentElement as HTMLElement;
    expect(header("Cycle 27.3").textContent).toContain("Fictional Three");
    expect(header("Cycle 27.3").textContent).toContain("live");
    expect(header("Cycle 27.4").textContent).toContain("Moved");
  });

  it("shows the cards each cycle holds, in order, and Later's", async () => {
    await openBoard();
    expect(cardNames("Cycle 27.2")).toEqual([
      "Fictional Alpha",
      "Fictional Beta",
    ]);
    expect(cardNames("Later")).toEqual(["Fictional Later"]);
  });

  it("shows Later alone without a stream", async () => {
    await openBoard(undefined, { streams: [] });
    expect(headings()).toEqual(["Later"]);
    expect(screen.queryByRole("toolbar", { name: "Cycles" })).toBeNull();
  });

  it("says so when no feature matches the search", async () => {
    await openBoard("/features?mode=board&search=nothing");
    expect(screen.getByText("No matching features")).toBeTruthy();
  });
});

describe("a card", () => {
  it("shows its status, priority, size, risk and month needed by", async () => {
    await openBoard();
    const shown = card("Fictional Alpha");
    expect(shown.textContent).toContain("Planned · Critical priority");
    expect(
      within(shown).getByRole("img", { name: "Size M, 2 × S" }),
    ).toBeTruthy();
    expect(within(shown).getByRole("img", { name: "Risk High" })).toBeTruthy();
    expect(shown.textContent).toContain("Needed by Jun 2027");
  });

  it("is marked Not staffed when committed with no allocations", async () => {
    await openBoard();
    expect(card("Fictional Alpha").textContent).toContain("Not staffed");
    const words = within(card("Fictional Alpha")).getByText("Not staffed");
    expect(words.closest('[class*="warningKind"]')).toBeNull();
    expect(card("Fictional Beta").textContent).not.toContain("Not staffed");
    expect(card("Fictional Gamma").textContent).not.toContain("Not staffed");
  });

  it("shows a move with its box, and a dimmed copy where it is live", async () => {
    await openBoard();
    expect(card("Fictional Gamma").textContent).toContain("Moved");
    expect(
      within(column("Cycle 27.2")).getByText("Fictional Gamma"),
    ).toBeTruthy();
  });

  it("is where it is live, judged by live allocations, under Live only", async () => {
    await openBoard("/features?mode=board&show=live");
    expect(cardNames("Cycle 27.2")).toContain("Fictional Gamma");
    expect(card("Fictional Gamma").textContent).toContain("Not staffed");
  });

  it("leaves out the status's and priority's line when neither shows", async () => {
    await openBoard(
      `/features?mode=board&hide=${encodeURIComponent('["status"]')}`,
    );
    expect(card("Fictional Alpha").textContent).toContain("Critical priority");
    expect(card("Fictional Alpha").textContent).not.toContain("Planned");
    expect(card("Fictional Later").textContent).not.toContain("·");
  });

  it("shows only what the Card menu chooses, kept in the address", async () => {
    const history = await openBoard();
    await userEvent.click(screen.getByRole("button", { name: "Card" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Risk, chosen" }),
    );
    expect(screen.queryByRole("img", { name: /^Risk/ })).toBeNull();
    expect(decodeURIComponent(history.location.search)).toContain("risk");
    await userEvent.click(screen.getByRole("menuitem", { name: "Risk" }));
    expect(screen.getByRole("img", { name: "Risk High" })).toBeTruthy();
    expect(history.location.search).not.toContain("hide");
  });

  it("shows each card's key under its name until the Card menu turns it off", async () => {
    const history = await openBoard();
    expect(card("Fictional Alpha").textContent).toContain("#FEATURE-1");
    await userEvent.click(screen.getByRole("button", { name: "Card" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Key, chosen" }),
    );
    expect(card("Fictional Alpha").textContent).not.toContain("#FEATURE-");
    expect(decodeURIComponent(history.location.search)).toContain('"key"');
  });
});

describe("a card's menu", () => {
  const menuItems = async () =>
    (await screen.findAllByRole("menuitem")).map(
      ({ textContent }) => textContent,
    );

  it("opens from the ⋯ beside the card, titled with the feature, and shows its details", async () => {
    await openBoard();
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Fictional Beta" }),
    );
    expect(await menuItems()).toEqual(["Show details", "Copy link"]);
    expect(screen.getByRole("menu").textContent).toContain("Fictional Beta");
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Show details" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Fictional Beta" }),
    ).toBeTruthy();
  });

  it("opens from a right-click on the card, and copies the feature's link", async () => {
    const user = userEvent.setup();
    const history = await openBoard();
    await user.pointer({
      keys: "[MouseRight]",
      target: card("Fictional Alpha"),
    });
    await user.click(
      await screen.findByRole("menuitem", { name: "Copy link" }),
    );
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/go/feature/1`,
    );
    expect(history.location.search).not.toContain("open=");
  });

  it("offers no link, and shows no key, for a feature still being added", async () => {
    await openBoard(undefined, {
      answers: {
        "POST /api/features": () => new Promise<Response>(() => undefined),
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "New feature" }));
    await userEvent.type(
      await screen.findByRole("textbox", { name: /^Name/ }),
      "Fictional Pending",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    const pending = await screen.findByRole("button", {
      name: (label) => label.startsWith("Fictional Pending"),
    });
    expect(pending.textContent).not.toContain("#FEATURE-");
    fireEvent.contextMenu(pending);
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Show details"]);
  });

  it("opens from Shift+F10 on the card, leaving its details closed", async () => {
    const history = await openBoard();
    card("Fictional Alpha").focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(await menuItems()).toEqual(["Show details", "Copy link"]);
    expect(history.location.search).not.toContain("open=");
  });
});

describe("the strip and the Schedule menu", () => {
  it("steps by cycle, and Today goes back to the current one", async () => {
    await openBoard();
    await userEvent.click(screen.getByRole("button", { name: "Next cycle" }));
    expect(headings().at(0)).toBe("Cycle 27.3");
    expect(
      screen.getByRole("button", { name: "27.3, in view, selected" }),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Previous cycle" }),
    );
    expect(headings().at(0)).toBe("Cycle 27.2");
    await userEvent.click(screen.getByRole("button", { name: /^27\.1/ }));
    expect(headings().at(0)).toBe("Cycle 27.1");
    expect(
      screen
        .getByRole("button", { name: "Previous cycle" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(headings().at(0)).toBe("Cycle 27.2");
  });

  it("goes no further than the last cycles that fit", async () => {
    await openBoard("/features?mode=board&from=2028-04-01");
    expect(headings().at(0)).toBe("Cycle 27.3");
    expect(
      screen
        .getByRole("button", { name: "Next cycle" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("offers schedules not retired as they are live, under Schedule, and shows the one chosen", async () => {
    const history = await openBoard();
    await userEvent.click(
      screen.getByRole("button", { name: "Schedule: Fictional Majors" }),
    );
    expect(await screen.findByRole("group", { name: "Schedule" })).toBeTruthy();
    expect(
      (await screen.findAllByRole("menuitem")).map(({ textContent }) =>
        textContent.replace(", chosen", ""),
      ),
    ).toEqual(["Fictional Majors", "Fictional MinorsRetired, Draft: retired"]);
    await userEvent.click(
      screen.getByRole("menuitem", {
        name: "Fictional Minors, Draft: retired",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Schedule: Fictional Minors" }),
    ).toBeTruthy();
    expect(history.location.search).toContain(retiring.id);
  });
});

describe("rows from Group by", () => {
  it("starts with none, listed first, and leaves out Cycle", async () => {
    await openBoard();
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    expect(
      (await screen.findAllByRole("menuitem")).map(({ textContent }) =>
        textContent.replace(", chosen", ""),
      ),
    ).toEqual([
      "None",
      "Release",
      "Needed by",
      "Status",
      "Customers",
      "Projects",
      "Proposals",
      "Priority",
      "Size",
      "Risk",
      "Feature team",
      "Staffed",
    ]);
  });

  it("puts the cards in a row for each group, those with none last", async () => {
    await openBoard("/features?mode=board&grouping=priorityId");
    expect(
      screen.getByRole("list", { name: "Cycle 27.2, Critical" }).textContent,
    ).toContain("Fictional Alpha");
    expect(
      screen.getByRole("list", { name: "Later, No priority" }).textContent,
    ).toContain("Fictional Later");
  });

  it("turns the rows round once the second order is chosen, the row for none first", async () => {
    const history = await openBoard("/features?mode=board&grouping=priorityId");
    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Priority" }),
    );
    const order = await screen.findByRole("group", { name: "Group order" });
    await userEvent.click(
      within(order).getByRole("menuitem", { name: "Reverse list order" }),
    );

    const rowLabel = (name: string) =>
      screen.getByText(name, { selector: "div" });
    const follows = (first: string, second: string) =>
      rowLabel(first).compareDocumentPosition(rowLabel(second)) &
      Node.DOCUMENT_POSITION_FOLLOWING;
    expect(follows("No priority", "Critical")).toBeTruthy();
    expect(history.location.search).toContain("groupsReversed=true");
  });

  it("names the order of records listed by name A to Z", async () => {
    await openBoard("/features?mode=board&grouping=projectIds");
    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Projects" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Z to A" }),
    ).toBeTruthy();
  });

  it("counts and groups only the features on the board, not other streams'", async () => {
    const elsewhere = feature("Fictional Elsewhere", {
      targetStreamId: retiring.id,
      targetCycle: "2027-04-01",
      priorityId: ids.critical,
    });
    await openBoard("/features?mode=board&grouping=priorityId", {
      features: [alpha, beta, gamma, later, elsewhere],
    });
    const rowLabel = (name: string) =>
      screen.getByText(name, { selector: "div" }).textContent;
    expect(rowLabel("Critical")).toBe("Critical1");
    expect(screen.queryByText("Fictional Elsewhere")).toBeNull();
  });

  it("offers no Then by, keeping the table's while another grouping is chosen", async () => {
    const history = await openBoard(
      "/features?mode=board&grouping=priorityId&thenBy=statusId",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Priority" }),
    );
    expect(screen.queryByRole("group", { name: "Then by" })).toBeNull();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Size" }),
    );

    expect(screen.getByRole("button", { name: "Group by: Size" })).toBeTruthy();
    expect(history.location.search).toContain("thenBy=statusId");
  });

  it("shows none for a grouping the board doesn't offer", async () => {
    await openBoard("/features?mode=board&grouping=targetCycle");
    expect(screen.getByRole("button", { name: "Group by" })).toBeTruthy();
  });
});

describe("a feature under several values", () => {
  const shared = feature("Fictional Shared", {
    ...target("2027-04-01"),
    customerIds: customers.map(({ id }) => id),
  });
  const copies = () =>
    screen.getAllByRole("button", {
      name: (label) => label.startsWith("Fictional Shared"),
    });
  const open = () =>
    openBoard("/features?mode=board&grouping=customerIds", {
      features: [shared, beta],
    });

  it("has a card in the row of each, keyed apart, marked with the others", async () => {
    await open();

    for (const name of customers.map(({ name }) => name)) {
      expect(
        screen.getByRole("list", { name: `Cycle 27.2, ${name}` }).textContent,
      ).toContain("Fictional Shared");
    }
    expect(
      screen.getByRole("list", { name: "Cycle 27.2, No customers" })
        .textContent,
    ).toContain("Fictional Beta");
    const [first, second] = copies();
    expect(first?.id).not.toBe(second?.id);
    expect(first?.textContent).toContain("+1");
    expect(await tipOn(within(first as HTMLElement).getByText("+1"))).toBe(
      "Also under Fictional Quay",
    );
    expect(await tipOn(within(second as HTMLElement).getByText("+1"))).toBe(
      "Also under Fictional Harbour",
    );
  });

  it("steps through each card with the keyboard, and puts focus back on the one opened", async () => {
    await open();
    const [first, second] = copies();
    first?.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(second);

    await userEvent.keyboard("{Enter}");
    await screen.findByRole("heading", { name: "Fictional Shared" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toBe(copies()[1]);
    });
  });

  it("puts focus on the first card of the feature closed, once another card had it", async () => {
    await openBoard(
      `/features?mode=board&grouping=customerIds&open=${shared.id}`,
      { features: [shared, beta] },
    );
    await screen.findByRole("heading", { name: "Fictional Shared" });
    card("Fictional Beta").focus();

    await userEvent.click(screen.getByRole("button", { name: /^Close/ }));

    await waitFor(() => {
      expect(document.activeElement).toBe(copies()[0]);
    });
  });

  it("gives each card an id with no spaces, where a row's key has one, such as a release's", async () => {
    await openBoard("/features?mode=board&grouping=release");

    expect(
      screen
        .getAllByRole("button", {
          name: (label) => label.startsWith("Fictional"),
        })
        .map(({ id }) => id)
        .filter((id) => id.startsWith("card-") && /\s/.test(id)),
    ).toEqual([]);
    expect(card("Fictional Alpha").id).toMatch(/^card-\S+$/);
  });
});

describe("the keyboard and a feature's details", () => {
  it("moves between the cards with the arrow keys, one stop for Tab", async () => {
    await openBoard();
    expect(card("Fictional Alpha").getAttribute("tabindex")).toBe("0");
    expect(card("Fictional Beta").getAttribute("tabindex")).toBe("-1");
    card("Fictional Alpha").focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(card("Fictional Beta"));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(card("Fictional Gamma"));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(card("Fictional Later"));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(card("Fictional Later"));
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(card("Fictional Gamma"));
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(card("Fictional Alpha"));
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(card("Fictional Alpha"));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.activeElement).toBe(card("Fictional Beta"));
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(document.activeElement).toBe(card("Fictional Beta"));
  });

  it("opens a card's details from Enter, and puts focus back on close", async () => {
    await openBoard();
    card("Fictional Beta").focus();
    await userEvent.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", { name: "Fictional Beta" }),
    ).toBeTruthy();
    expect(card("Fictional Beta").getAttribute("aria-current")).toBe("true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toBe(card("Fictional Beta"));
    });
  });

  it("holds its columns while a side panel is open, and fits again once it has gone", async () => {
    await openBoard();
    await userEvent.click(card("Fictional Alpha"));
    await screen.findByRole("heading", { name: "Fictional Alpha" });
    act(() => {
      size.set(500);
    });
    expect(headings()).toHaveLength(5);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Fictional Alpha" }),
      ).toBeNull();
    });
    expect(headings()).toHaveLength(5);
    await userEvent.click(card("Fictional Beta"));
    await screen.findByRole("heading", { name: "Fictional Beta" });
    act(() => {
      size.set(520);
    });
    expect(headings()).toHaveLength(5);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Fictional Beta" }),
      ).toBeNull();
    });
    act(() => {
      size.set(540);
    });
    expect(headings()).toEqual(["Cycle 27.2", "Later"]);
  });

  it("holds nothing while the board's width isn't known yet", async () => {
    size.width = 0;
    await openBoard(`/features?mode=board&open=${alpha.id}`);
    expect(headings()).toEqual(["Cycle 27.2", "Later"]);
    act(() => {
      size.set(1000);
    });
    expect(headings()).toHaveLength(5);
  });
});
