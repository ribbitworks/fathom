// SPDX-License-Identifier: Apache-2.0

// Tests for the Features page: a feature's key, saved views, grouping and sorting, warnings,
// following links from a feature's details, adding, changing and removing features, and loading.

import { startingEffortConversions } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  featureDraft,
  fictionalUser,
  findRowActions,
  recordCell,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";
import { formatDay } from "./day-formats.ts";
import { operationsOf } from "./projects.ts";
import {
  projectId,
  changeSetId,
  project,
  customer,
  saved,
  deleted,
  openPage,
  sent,
  sentTo,
  sidePanel,
  newButton,
  rowMenu,
  chooseFrom,
  projectStreamId,
  teamId,
  cycleOne,
  streams,
  withRelease,
  plannedId,
  choices,
  feature,
  later,
  second,
  first,
  featurePlan,
  answers,
  featureEditor,
  open,
  byCycle,
  headings,
  groupButton,
  groupBy,
  rowNames,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Features page", () => {
  describe("a feature's key", () => {
    const keyed = () =>
      featurePlan({
        features: [
          { ...later, keyNumber: 2 },
          { ...second, keyNumber: 20 },
          first,
        ],
      });

    it.each([
      ["#FEATURE-2", ["Fictional Later"]],
      ["feature-2", ["Fictional Later"]],
      ["#Feature-20", ["Fictional Second"]],
      ["#PROJECT-2", []],
    ])(
      "finds from the search %s only the feature with it",
      async (typed, shown) => {
        await open(keyed());
        await userEvent.type(
          screen.getByRole("textbox", { name: "Search features" }),
          typed,
        );
        await waitFor(() => {
          expect(rowNames()).toEqual(shown);
        });
      },
    );

    it("copies a feature's link from its row's menu", async () => {
      const user = userEvent.setup();
      await open(keyed());
      await user.click(await findRowActions("Fictional Second"));
      await user.click(
        await screen.findByRole("menuitem", { name: "Copy link" }),
      );
      expect(await navigator.clipboard.readText()).toBe(
        `${window.location.origin}/go/feature/20`,
      );
    });
  });

  describe("saved views on Features", () => {
    const roadmap = {
      id: crypto.randomUUID(),
      name: "Roadmap",
      scope: "personal",
      definition: {
        search: "first",
        choices: { stream: projectStreamId, hide: ["risk"] },
      },
      canChange: true,
      canShare: false,
    };
    const views = (listed: object[]) => () => Response.json(listed);
    const viewsMenu = async () => {
      await userEvent.click(screen.getByRole("button", { name: /^Views/ }));
      return screen.findByRole("menu");
    };

    it("keeps the Board's stream and card parts in a view, naming them, but not Table or Board", async () => {
      // Given Features showing the board's stream and card parts in its address
      const { fetch } = await open(
        featurePlan(),
        {
          "GET /api/views/features": views([]),
          "POST /api/views/features": () =>
            Response.json({ view: roadmap, changeSetId }, { status: 201 }),
        },
        `/features?mode=table&stream=${projectStreamId}&hide=["risk"]&search=first`,
      );

      // When the view is saved
      await userEvent.click(
        within(await viewsMenu()).getByRole("menuitem", {
          name: "Save view…",
        }),
      );
      const dialog = await screen.findByRole("dialog", { name: "Save view" });

      // Then Includes names the board, and the view keeps its choices alone
      expect(dialog.textContent).toContain(
        "ColumnsFictional Stream cyclesCardKey, Status, Priority, Size, Needed by, Staffed months",
      );
      await userEvent.type(
        within(dialog).getByRole("textbox", { name: "Name" }),
        "Roadmap",
      );
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Save view" }),
      );
      await waitFor(() => {
        expect(sent(fetch, "POST /api/views/features")).toHaveLength(1);
      });
      expect(sent(fetch, "POST /api/views/features")[0]).toMatchObject({
        definition: {
          search: "first",
          choices: { stream: projectStreamId, hide: ["risk"] },
        },
      });
    });

    it("applies a view on the board, keeping the board shown", async () => {
      // Given the board shown
      const { history } = await open(featurePlan(), {
        "GET /api/views/features": views([roadmap]),
      });
      await userEvent.click(screen.getByRole("radio", { name: "Board" }));
      await waitFor(() => {
        expect(history.location.search).toContain("mode=board");
      });

      // When a saved view is applied
      await userEvent.click(
        within(await viewsMenu()).getByRole("menuitem", { name: "Roadmap" }),
      );

      // Then it sets the search and the board's choices, and the board still shows
      await waitFor(() => {
        expect(history.location.search).toContain("search=first");
      });
      expect(history.location.search).toContain(`stream=${projectStreamId}`);
      expect(history.location.search).toContain("hide=");
      expect(history.location.search).toContain("mode=board");
    });
  });

  it("lists a project's features in its panel, each a link to its details on Features", async () => {
    // Given a project needing two features, open beside Projects
    const { history } = await open(
      featurePlan({
        projects: [project({ featureIds: [first.id, second.id] })],
      }),
      {},
      `/projects?open=${projectId}`,
    );
    const link = await within(sidePanel()).findByRole("button", {
      name: "Fictional First",
    });
    expect(link.parentElement?.textContent).toBe("Fictional First");
    // When the first is chosen
    await userEvent.click(link);
    // Then Features opens with its details beside the table
    await waitFor(() => {
      expect(history.location.pathname).toBe("/features");
    });
    expect(history.location.search).toContain(first.id);
    await screen.findByRole("heading", { name: "Fictional First" });
  });

  it("opens a feature's details beside the table from its Name cell", async () => {
    const { history } = await open();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Fictional First",
        hidden: true,
      }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain(`open=${first.id}`);
    });
    expect(
      await screen.findByRole("button", { name: "Close details" }),
    ).not.toBeNull();
  });

  const warningBox = (words: HTMLElement) =>
    words.closest('[class*="warningKind"]');

  it("marks a feature whose status means Planned and that has no feature team, in red words in place of the team, with no box", async () => {
    await open(featurePlan({ features: [{ ...first, statusId: plannedId }] }));
    const words = await screen.findByText("No feature team");
    expect(words.className).toContain("warningWords");
    expect(warningBox(words)).toBeNull();
  });

  it("shows the warning alone where a draft empties the team, rather than the same words twice", async () => {
    await open(
      featurePlan({
        features: [
          {
            ...first,
            statusId: plannedId,
            draft: featureDraft({
              changed: ["featureTeamId"],
              live: { featureTeamId: teamId },
            }),
          },
        ],
      }),
    );
    const [words, ...others] = await screen.findAllByText("No feature team");
    expect(others).toEqual([]);
    expect(words?.className).toContain("warningWords");
    expect(warningBox(words as HTMLElement)).toBeNull();
    expect(words?.closest("td")?.textContent).toContain(
      "Draft: changed from “Fictional Team”",
    );
  });

  it("shows the warning alone in the Live row of a draft giving a planned feature its team", async () => {
    await open(
      featurePlan({
        features: [
          {
            ...first,
            statusId: plannedId,
            featureTeamId: teamId,
            draft: featureDraft({
              changed: ["featureTeamId"],
              live: { featureTeamId: null },
            }),
          },
        ],
      }),
    );
    const [words, ...others] = await screen.findAllByText("No feature team");
    expect(others).toEqual([]);
    expect(words?.className).toContain("warningWords");
    expect(warningBox(words as HTMLElement)).toBeNull();
  });

  it("follows a customer from a feature's details to the Customers tab", async () => {
    const buyer = customer();
    const start = featurePlan({
      customers: [buyer],
      features: [{ ...first, customerIds: [buyer.id] }],
    });
    const { history } = await open(start, {}, `/features?open=${first.id}`);
    await userEvent.click(
      await screen.findByRole("button", { name: buyer.name }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/projects");
    });
    expect(history.location.search).toContain("tab=customers");
    expect(history.location.search).toContain(`open=${buyer.id}`);
  });

  it("follows a feature's release from its details to its stream on Releases", async () => {
    const { history } = await open(
      featurePlan(),
      withRelease,
      `/features?open=${first.id}`,
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Fictional Stream: Fictional Release",
      }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/releases");
    });
    expect(history.location.search).toContain("tab=schedules");
    expect(history.location.search).toContain(`open=${projectStreamId}`);
  });

  it("groups features by release, then each stream's cycles in none, then Later", async () => {
    await open(featurePlan(), withRelease);
    await groupBy("None", "Release");
    expect(
      screen
        .queryAllByRole("rowheader")
        .map((cell) => cell.textContent)
        .filter((text) => / features?$/.test(text)),
    ).toEqual([
      `Fictional Stream: Fictional Release, ships ${formatDay("2027-03-31")}1 feature`,
      "Fictional Stream: Not released yet1 feature",
      "Later1 feature",
    ]);
  });

  it("titles the page Features, with no tabs", async () => {
    await open();
    expect(screen.getByRole("heading", { name: "Features" })).not.toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("opens with the features in one list", async () => {
    await open();
    expect([headings(), rowNames()]).toEqual([
      [],
      ["Fictional Later", "Fictional Second", "Fictional First"],
    ]);
    expect(groupButton("None").textContent).toBe("Group by");
  });

  it("groups features by cycle, in the cycles' order, with Later last", async () => {
    await open(featurePlan(), {}, byCycle);
    expect(headings()).toEqual([
      "Fictional Stream: 27.11 feature",
      "Fictional Stream: 27.21 feature",
      "Later1 feature",
    ]);
    expect(rowNames()).toEqual([
      "Fictional First",
      "Fictional Second",
      "Fictional Later",
    ]);
  });

  it("counts each group's rows that show, under a search", async () => {
    await open(
      featurePlan({
        features: [
          feature("Fictional First", cycleOne),
          feature("Fictional First Again", cycleOne),
          later,
        ],
      }),
      {},
      byCycle,
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search features" }),
      "Again",
    );
    await waitFor(() => {
      expect(headings()).toEqual(["Fictional Stream: 27.11 feature"]);
    });
  });

  it("sorts within each group, keeping the groups in order", async () => {
    await open(
      featurePlan({
        features: [
          later,
          feature("Fictional Zebra", cycleOne),
          feature("Fictional Aardvark", cycleOne),
        ],
      }),
      {},
      `${byCycle}&sort=%5B%22name%22%5D`,
    );
    expect(
      screen
        .getAllByRole("row")
        .map(
          ({ textContent }) =>
            /Fictional (Zebra|Aardvark|Later)/.exec(textContent)?.[0],
        )
        .filter((name) => name !== undefined),
    ).toEqual(["Fictional Aardvark", "Fictional Zebra", "Fictional Later"]);
  });

  it("moves down past a heading to the next group's first row", async () => {
    await open(featurePlan(), {}, byCycle);
    await userEvent.click(recordCell(first.id, "name") as HTMLElement);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(recordCell(second.id, "name"));
  });

  it("shows one list once grouping is turned off, leaving it out of the address", async () => {
    const { history } = await open(featurePlan(), {}, byCycle);
    await groupBy("Cycle", "None");
    await waitFor(() => {
      expect(headings()).toEqual([]);
    });
    expect(history.location.search).not.toContain("grouping=");
  });

  it("groups features by the month they are needed by, with No date last, kept in the address", async () => {
    const start = featurePlan({
      features: [
        { ...later, neededBy: "2027-11" },
        { ...second, neededBy: "2027-03" },
        first,
      ],
    });
    const { history } = await open(start);
    await groupBy("None", "Needed by");
    await waitFor(() => {
      expect(
        screen
          .queryAllByRole("rowheader")
          .map((cell) => /^[A-Za-z ]*\d*/.exec(cell.textContent)?.[0])
          .filter((text) => /Mar|Nov|No date/.test(String(text))),
      ).toHaveLength(3);
    });
    const shownHeadings = screen
      .queryAllByRole("rowheader")
      .map((cell) => cell.textContent)
      .filter((text) => /Mar|Nov|No date/.test(text));
    expect(shownHeadings.at(0)).toContain("Mar");
    expect(shownHeadings.at(1)).toContain("Nov");
    expect(shownHeadings.at(2)).toContain("No date");
    expect(history.location.search).toContain("grouping=neededBy");
    expect(groupButton("Needed by")).not.toBeNull();
  });

  it("groups features under each project that needs them, then those no project needs", async () => {
    await open(
      featurePlan({
        projects: [
          project({ featureIds: [first.id, second.id] }),
          project({
            id: "70000000-0000-4000-8000-000000000002",
            name: "Fictional Other",
            externalId: "FP-2",
            featureIds: [first.id],
          }),
        ],
      }),
    );
    await groupBy("None", "Projects");
    await waitFor(() => {
      expect(
        screen
          .queryAllByRole("rowheader")
          .map((cell) => cell.textContent)
          .filter((text) => / features?$/.test(text)),
      ).toEqual([
        "FP-1 Fictional Project2 features",
        "FP-2 Fictional Other1 feature",
        "No projects1 feature",
      ]);
    });
    expect(rowNames()).toEqual([
      "Fictional Second",
      "Fictional First",
      "Fictional First",
      "Fictional Later",
    ]);
    expect(screen.getByRole("status").textContent).toBe("3 features");
    expect(
      screen.getAllByText("+1").map((mark) => mark.parentElement?.dataset.tip),
    ).toEqual([
      "Also under FP-2 Fictional Other",
      "Also under FP-1 Fictional Project",
    ]);
  });

  it("groups them again when turned back on", async () => {
    await open(featurePlan(), {}, byCycle);
    await groupBy("Cycle", "None");
    await waitFor(() => {
      expect(headings()).toEqual([]);
    });
    await groupBy("None", "Cycle");
    await waitFor(() => {
      expect(headings()).toHaveLength(3);
    });
  });

  it("shows those who only see the plan the table with no way to add", async () => {
    await openPage(
      "/features",
      featurePlan({ canEditFeatures: false }),
      answers,
      ["plan:view", "features:view"],
    );
    expect(screen.queryByRole("button", { name: "New feature" })).toBeNull();
  });

  it("offers one who edits features but not the plan the New button", async () => {
    await open();
    expect(await newButton("feature")).not.toBeNull();
  });

  it("sends a change of status with the feature's other values", async () => {
    const path = `PUT /api/features/${later.id}`;
    const { fetch } = await open(featurePlan(), {
      [path]: saved(featurePlan),
    });
    const operations = operationsOf("feature");
    await operations.change(later, { statusId: plannedId });
    expect(sent(fetch, path)).toEqual([
      {
        name: "Fictional Later",
        statusId: plannedId,
        priorityId: null,
        sizeId: null,
        riskId: null,
        neededBy: null,
        customerIds: [],
        estimateHours: 40,
        featureTeamId: null,
        description: null,
        note: null,
        values: {},
        links: {},
        notes: {},
        numbers: {},
        target: null,
      },
    ]);
  });

  it("sends a target as a stream and a cycle together", async () => {
    const path = `PUT /api/features/${later.id}`;
    const { fetch } = await open(featurePlan(), {
      [path]: saved(featurePlan),
    });
    await operationsOf("feature").change(later, {
      targetStreamId: projectStreamId,
      targetCycle: cycleOne,
    });
    expect(sent(fetch, path)).toMatchObject([
      { target: { streamId: projectStreamId, cycle: cycleOne } },
    ]);
  });

  it("adds a feature with what is entered and the rest empty", async () => {
    const { fetch } = await open(featurePlan(), {
      "POST /api/features": saved(featurePlan),
    });
    await operationsOf("feature").add({ name: "Fictional New" });
    expect(sent(fetch, "POST /api/features")).toEqual([
      {
        name: "Fictional New",
        priorityId: null,
        sizeId: null,
        riskId: null,
        neededBy: null,
        customerIds: [],
        estimateHours: null,
        featureTeamId: null,
        description: null,
        note: null,
        values: {},
        links: {},
        notes: {},
        numbers: {},
        target: null,
      },
    ]);
  });

  it("removes a feature from its row's menu", async () => {
    const path = `DELETE /api/features/${later.id}`;
    const { fetch } = await open(featurePlan(), { [path]: deleted });
    await chooseFrom(await rowMenu("Fictional Later"), "Remove feature");
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(path);
    });
  });

  it("keeps a row under its heading until the view changes", async () => {
    const path = `DELETE /api/features/${later.id}`;
    const { held } = await open(featurePlan(), { [path]: deleted }, byCycle);
    held.plan = featurePlan({
      features: [
        later,
        { ...second, targetCycle: cycleOne },
        first,
        feature("Fictional Arrived", cycleOne),
      ],
    });
    await chooseFrom(await rowMenu("Fictional Later"), "Remove feature");
    await waitFor(() => {
      expect(rowNames()).toEqual([
        "Fictional First",
        "Fictional Second",
        "Fictional Later",
      ]);
    });
    // The row that arrived since stays at the end, under a heading of its own.
    await waitFor(() => {
      expect(headings()).toEqual([
        "Fictional Stream: 27.11 feature",
        "Fictional Stream: 27.21 feature",
        "Later1 feature",
        "Fictional Stream: 27.11 feature",
      ]);
    });
  });

  it("says when the release streams could not be loaded", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({ ...fictionalUser, permissions: featureEditor }),
      "GET /api/projects": () => Response.json(featurePlan()),
      "GET /api/projects/choices": choices,
      "GET /api/release-streams": () => new Response(null, { status: 500 }),
      "GET /api/effort-conversions": answers["GET /api/effort-conversions"],
    });
    renderApp("/features");
    expect(
      await screen.findByText(/could not load the features/i),
    ).not.toBeNull();
  });

  it("tries the release streams again when asked", async () => {
    let healthy = false;
    serverAnswers({
      "GET /api/session": () =>
        Response.json({ ...fictionalUser, permissions: featureEditor }),
      "GET /api/projects": () => Response.json(featurePlan()),
      "GET /api/projects/choices": choices,
      "GET /api/release-streams": () =>
        healthy ? streams() : new Response(null, { status: 500 }),
      "GET /api/effort-conversions": answers["GET /api/effort-conversions"],
    });
    renderApp("/features");
    const again = await screen.findByRole("button", { name: "Try again" });
    healthy = true;
    await userEvent.click(again);
    expect(await screen.findByRole("grid")).not.toBeNull();
  });

  it("tries the conversions between units of effort again when asked", async () => {
    let healthy = false;
    serverAnswers({
      "GET /api/session": () =>
        Response.json({ ...fictionalUser, permissions: featureEditor }),
      "GET /api/projects": () => Response.json(featurePlan()),
      "GET /api/projects/choices": choices,
      "GET /api/release-streams": streams,
      "GET /api/effort-conversions": () =>
        healthy
          ? Response.json(startingEffortConversions)
          : new Response(null, { status: 500 }),
    });
    renderApp("/features");
    const again = await screen.findByRole("button", { name: "Try again" });
    healthy = true;
    await userEvent.click(again);
    expect(await screen.findByRole("grid")).not.toBeNull();
  });
});
