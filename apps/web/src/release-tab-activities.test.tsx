// SPDX-License-Identifier: Apache-2.0

// Tests for a release's activities on Releases: its details' Activities row, showing them on
// Activities, adding one in a form stacked under the details with the release set, and the table's
// Activities column.

import { type Activity, startingEffortConversions } from "@fathom/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { activity, choices, sent } from "./test-projects-page.tsx";
import { fictionalRelease, fictionalStream } from "./test-releases.ts";
import {
  detailRow,
  featureDraft,
  fictionalUser,
  noFeatureColumns,
  recordCell,
  recordDraft,
} from "./test-support.tsx";
import {
  inStream,
  openRelease,
  release,
  releasePanel,
  searchOf,
  setUpEachTest,
} from "./test-release-tab.tsx";

setUpEachTest();

const otherRelease = "30000000-0000-4000-8000-0000000000ff";

const releaseActivity = (id: number, name: string, more = {}): Activity =>
  activity({
    id: `50000000-0000-4000-8000-00000000000${String(id)}`,
    keyNumber: id,
    name,
    projectId: null,
    releaseId: release.id,
    ...more,
  });

const plan = (activities: readonly Activity[], canEditFeatures = true) => ({
  "GET /api/projects": () =>
    Response.json({
      customers: [],
      projects: [],
      proposals: [],
      features: [],
      featureColumns: noFeatureColumns,
      activities,
      activityColumns: noFeatureColumns,
      canEdit: false,
      canEditFeatures,
    }),
  "GET /api/effort-conversions": () => Response.json(startingEffortConversions),
  "GET /api/projects/choices": () =>
    Response.json({
      owners: [],
      statuses: [],
      featureStatuses: [],
      featureTeams: [],
      priorities: [],
      sizes: [],
      risks: [],
    }),
});

const twoAndAnother = [
  releaseActivity(1, "Fictional Testing"),
  releaseActivity(2, "Fictional Notes"),
  releaseActivity(3, "Fictional Elsewhere", { releaseId: otherRelease }),
];

// The Activities row of the release's details, once the plan is read.
const activitiesRow = async () => {
  await within(releasePanel()).findByRole("button", {
    name: "Fictional Testing",
  });
  return detailRow("Activities", releasePanel());
};

describe("a release's activities on Releases", () => {
  it("lists the release's own activities in its details, and names them in its row", async () => {
    await openRelease(inStream(release), { answers: plan(twoAndAnother) });

    const row = await activitiesRow();
    expect(
      within(row)
        .getAllByRole("button")
        .map(({ textContent }) => textContent),
    ).toEqual([
      "Activities",
      "Fictional Testing",
      "Fictional Notes",
      "Add activity",
    ]);
    expect(recordCell(release.id, "activityIds")?.textContent).toBe(
      "Fictional Testing, Fictional Notes",
    );
  });

  it("marks an activity a draft adds with its dot, hollow while it is the reader's own and unpublished", async () => {
    await openRelease(inStream(release), {
      answers: plan([
        ...twoAndAnother,
        releaseActivity(4, "Fictional Rehearsal", {
          draft: featureDraft({ action: "created", unpublished: true }),
        }),
      ]),
    });

    const added = within(await activitiesRow()).getByText(", added")
      .parentElement as HTMLElement;
    expect(added.textContent).toContain("Fictional Rehearsal");
    expect(added.querySelector("[class*=unpublishedMark]")).not.toBeNull();
  });

  it("still lists an activity a draft moves to another release, marked as removed", async () => {
    await openRelease(inStream(release), {
      answers: plan([
        ...twoAndAnother,
        releaseActivity(4, "Fictional Rehearsal", {
          releaseId: otherRelease,
          draft: featureDraft({
            changed: ["releaseId"],
            live: { releaseId: release.id },
          }),
        }),
      ]),
    });

    const removed = within(await activitiesRow()).getByText(", removed")
      .parentElement as HTMLElement;
    expect(removed.textContent).toContain("Fictional Rehearsal");
    expect(removed.querySelector("[class*=draftMark]")).not.toBeNull();
  });

  it("opens one on Activities", async () => {
    const user = userEvent.setup();
    const { history } = await openRelease(inStream(release), {
      answers: plan(twoAndAnother),
    });

    await user.click(
      within(await activitiesRow()).getByRole("button", {
        name: "Fictional Notes",
      }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/activities");
    });
    expect(searchOf(history).get("open")).toBe(
      releaseActivity(2, "Fictional Notes").id,
    );
  });

  it("shows them on Activities, filtered to the release, from the row's name", async () => {
    const user = userEvent.setup();
    const { history } = await openRelease(inStream(release), {
      answers: plan(twoAndAnother),
    });

    await user.click(
      within(await activitiesRow()).getByRole("button", {
        name: "Activities, show on Activities",
      }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/activities");
    });
    expect(searchOf(history).get("filters")).toContain(release.id);
  });

  it("offers Show on Activities in the release's menu, filtered to it", async () => {
    const user = userEvent.setup();
    const { history } = await openRelease(inStream(release), {
      answers: plan(twoAndAnother),
    });

    await activitiesRow();
    await user.click(
      within(releasePanel()).getByRole("button", { name: /^Actions for/ }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Show on Activities" }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/activities");
    });
    expect(searchOf(history).get("filters")).toContain(release.id);
  });

  it("offers Show on Activities in the release's menu in the Live view too", async () => {
    const user = userEvent.setup();
    await openRelease(inStream(release), {
      answers: plan(twoAndAnother),
      path: `/releases?open=${release.id}&show=live`,
    });

    await activitiesRow();
    await user.click(
      within(releasePanel()).getByRole("button", { name: /^Actions for/ }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Show on Activities" }),
    ).toBeDefined();
  });

  it("offers no Show on Activities for a release with none", async () => {
    await openRelease(inStream(release), {
      answers: plan([
        releaseActivity(3, "Fictional Elsewhere", { releaseId: otherRelease }),
      ]),
    });

    const row = await waitFor(() => detailRow("Activities", releasePanel()));
    expect(within(row).getByText("None")).toBeDefined();
    await userEvent.click(
      within(releasePanel()).getByRole("button", { name: /^Actions for/ }),
    );
    await screen.findByRole("menuitem", { name: "Copy link" });
    expect(
      screen.queryByRole("menuitem", { name: "Show on Activities" }),
    ).toBeNull();
    expect(
      within(releasePanel()).queryByRole("button", {
        name: "Activities, show on Activities",
      }),
    ).toBeNull();
  });

  it("adds one in a form stacked under the release's details, with the release set", async () => {
    const user = userEvent.setup();
    const { history } = await openRelease(inStream(release), {
      answers: plan(twoAndAnother),
    });

    await user.click(
      within(await activitiesRow()).getByRole("button", {
        name: "Add activity",
      }),
    );
    const form = await screen.findByRole("region", { name: "New activity" });
    expect(history.location.pathname).toBe("/releases");
    expect(releasePanel()).toBeDefined();
    expect(form.textContent).toContain("Fictional One");

    // What it opened with isn't anything entered, so Cancel closes it without asking
    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New activity" })).toBeNull();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Add activity");
    });
  });

  it("sends the new activity with the release, then lists it in the details, focus back on Add activity", async () => {
    const user = userEvent.setup();
    const added = releaseActivity(4, "Fictional Rehearsal");
    let activities: readonly Activity[] = twoAndAnother;
    const answers = plan(twoAndAnother);
    const { fetch } = await openRelease(inStream(release), {
      answers: {
        ...answers,
        // Status is needed, so the form starts with the first one.
        "GET /api/projects/choices": choices,
        "GET /api/projects": async () => {
          const shown = (await answers["GET /api/projects"]().json()) as object;
          return Response.json({ ...shown, activities });
        },
        "POST /api/activities": async () => {
          activities = [...twoAndAnother, added];
          const shown = (await answers["GET /api/projects"]().json()) as object;
          return Response.json({
            plan: { ...shown, activities },
            ids: [added.id],
            changeSetId: "00000000-0000-4000-8000-000000000001",
          });
        },
      },
    });

    await user.click(
      within(await activitiesRow()).getByRole("button", {
        name: "Add activity",
      }),
    );
    const form = await screen.findByRole("region", { name: "New activity" });
    await user.type(
      within(form).getByRole("textbox", { name: "Name" }),
      "Fictional Rehearsal",
    );
    await user.click(within(form).getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New activity" })).toBeNull();
    });
    expect(sent(fetch, "POST /api/activities")).toEqual([
      {
        records: [
          expect.objectContaining({
            name: "Fictional Rehearsal",
            releaseId: release.id,
          }),
        ],
      },
    ]);
    expect(
      await within(releasePanel()).findByRole("button", {
        name: "Fictional Rehearsal",
      }),
    ).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Add activity");
    });
  });

  it("asks before closing the details with a name typed in the stacked form", async () => {
    const user = userEvent.setup();
    await openRelease(inStream(release), { answers: plan(twoAndAnother) });

    await user.click(
      within(await activitiesRow()).getByRole("button", {
        name: "Add activity",
      }),
    );
    const form = await screen.findByRole("region", { name: "New activity" });
    await user.type(
      within(form).getByRole("textbox", { name: "Name" }),
      "Fictional Rehearsal",
    );
    await user.click(screen.getByRole("button", { name: "Close details" }));

    expect(
      await screen.findByRole("dialog", { name: "Discard the new activity?" }),
    ).toBeDefined();
  });

  it("closes the stacked form with the details, without asking, when nothing is typed", async () => {
    const user = userEvent.setup();
    await openRelease(inStream(release), { answers: plan(twoAndAnother) });

    await user.click(
      within(await activitiesRow()).getByRole("button", {
        name: "Add activity",
      }),
    );
    await screen.findByRole("region", { name: "New activity" });
    await user.click(screen.getByRole("button", { name: "Close details" }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New activity" })).toBeNull();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers Add activity only once New activity's choices are read", async () => {
    await openRelease(inStream(release), {
      answers: {
        ...plan(twoAndAnother),
        "GET /api/projects/choices": () => new Promise<Response>(() => {}),
      },
    });

    expect(
      within(await activitiesRow()).queryByRole("button", {
        name: "Add activity",
      }),
    ).toBeNull();
  });

  it("offers a role that may not change activities no Add activity", async () => {
    await openRelease(inStream(release), {
      answers: plan(twoAndAnother, false),
    });

    expect(
      within(await activitiesRow()).queryByRole("button", {
        name: "Add activity",
      }),
    ).toBeNull();
  });

  it("offers no Add activity on a release being removed", async () => {
    await openRelease(
      inStream(fictionalRelease({ draft: recordDraft({ action: "deleted" }) })),
      { answers: plan(twoAndAnother) },
    );

    expect(
      within(await activitiesRow()).queryByRole("button", {
        name: "Add activity",
      }),
    ).toBeNull();
  });

  it("offers no Add activity on a retired schedule's release", async () => {
    await openRelease(
      [fictionalStream({ releases: [release], retired: true })],
      {
        answers: plan(twoAndAnother),
      },
    );

    expect(
      within(await activitiesRow()).queryByRole("button", {
        name: "Add activity",
      }),
    ).toBeNull();
  });

  it("offers no Add activity in the Live view", async () => {
    await openRelease(inStream(release), {
      answers: plan(twoAndAnother),
      path: `/releases?open=${release.id}&show=live`,
    });

    expect(
      within(await activitiesRow()).queryByRole("button", {
        name: "Add activity",
      }),
    ).toBeNull();
  });

  it("shows a role that doesn't see features no activities", async () => {
    const { fetch } = await openRelease(inStream(release), {
      answers: {
        ...plan(twoAndAnother),
        "GET /api/session": () =>
          Response.json({
            ...fictionalUser,
            permissions: ["configuration:view"],
          }),
      },
    });

    // The plan, read once its answer has been taken in, so its activities would show by now.
    await waitFor(async () => {
      const answer = (await fetch.mock.results
        .filter(
          (_, index) => fetch.mock.calls.at(index)?.[0] === "/api/projects",
        )
        .at(0)?.value) as Response | undefined;
      expect(answer?.bodyUsed).toBe(true);
    });
    await act(async () => {});
    expect(
      within(releasePanel()).queryByText("Activities", { selector: "dt" }),
    ).toBeNull();
    expect(recordCell(release.id, "activityIds")).toBeUndefined();
  });
});
