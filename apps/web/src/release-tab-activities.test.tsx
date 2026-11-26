// SPDX-License-Identifier: Apache-2.0

// Tests for a release's activities on Releases: its details' Activities row, showing them on
// Activities, adding one there with the release set, and the table's Activities column.

import { type Activity, startingEffortConversions } from "@fathom/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { activity } from "./test-projects-page.tsx";
import { fictionalRelease, fictionalStream } from "./test-releases.ts";
import {
  detailRow,
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

  it("adds one on Activities filtered to the release, with the release set", async () => {
    const user = userEvent.setup();
    const { history } = await openRelease(inStream(release), {
      answers: plan(twoAndAnother),
    });

    await user.click(
      within(await activitiesRow()).getByRole("button", {
        name: "Add activity",
      }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/activities");
    });
    expect(searchOf(history).get("filters")).toContain(release.id);
    const form = await screen.findByRole("region", { name: "New activity" });
    expect(form.textContent).toContain("Fictional One");
    expect(searchOf(history).get("adding")).toBeNull();
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
