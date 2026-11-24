// SPDX-License-Identifier: Apache-2.0

// Tests for drafting releases: making one, and removing and deciding one from its row's menu.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  fictionalRelease,
  fictionalStream,
  streamId,
} from "./test-releases.ts";
import { bodyOf, fictionalUser, recordDraft } from "./test-support.tsx";
import {
  setUpEachTest,
  changeSetId,
  release,
  releasePath,
  editsReleases,
  openPage,
  inStream,
  searchOf,
  chooseRowAction,
} from "./test-release-tab.tsx";

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

describe("a release's row menu", () => {
  it("drafts removing the release, saying so", async () => {
    const { fetch } = await openPage(inStream(release), {
      can: editsReleases,
      answers: { [`DELETE ${releasePath}`]: savedAs },
    });
    await chooseRowAction("Fictional One", "Remove release");
    expect(
      await screen.findByText("Drafted removing Fictional One."),
    ).toBeDefined();
    expect(
      fetch.mock.calls
        .filter(([, init]) => init?.method === "DELETE")
        .map(([url]) => url),
    ).toEqual([releasePath]);
  });

  const draftPath = `/api/records/release/${release.id}/draft`;

  it("discards the release's draft", async () => {
    await openPage(inStream(fictionalRelease({ draft: recordDraft() })), {
      can: editsReleases,
      answers: { [`DELETE ${draftPath}`]: savedAs },
    });
    await chooseRowAction("Fictional One", "Discard draft");
    expect(await screen.findByText("Discarded the draft.")).toBeDefined();
  });

  it("resubmits the release's rejected draft", async () => {
    await openPage(
      inStream(
        fictionalRelease({
          draft: recordDraft({ state: "rejected", reason: "Fictional reason" }),
        }),
      ),
      {
        can: editsReleases,
        answers: { [`DELETE ${draftPath}/rejection`]: savedAs },
      },
    );
    await chooseRowAction("Fictional One", "Resubmit");
    expect(await screen.findByText("Resubmitted the draft.")).toBeDefined();
  });

  it("approves the release's draft", async () => {
    const { fetch } = await openPage(
      inStream(fictionalRelease({ draft: recordDraft() })),
      {
        answers: {
          "GET /api/session": approver,
          "POST /api/drafts/approval": savedAs,
        },
      },
    );
    await chooseRowAction("Fictional One", "Approve draft…");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        expect.objectContaining({
          records: [{ type: "release", id: release.id }],
        }),
      ]);
    });
  });
});

describe("making a release", () => {
  const added = fictionalRelease({
    id: "30000000-0000-4000-8000-000000000003",
    name: "Fictional New",
    firstCycle: "2027-04-01",
    lastCycle: "2027-04-01",
  });

  it("makes a release in the schedule chosen, opening it once drafted", async () => {
    // Given a schedule that takes releases
    const { fetch, history } = await openPage(inStream(release), {
      can: editsReleases,
      answers: {
        [`POST /api/release-streams/${streamId}/releases`]: () =>
          Response.json({
            stream: fictionalStream({ releases: [release, added] }),
            changeSetId,
          }),
      },
    });

    // When a release is made in it
    await userEvent.click(screen.getByRole("button", { name: "New release" }));
    const dialog = await screen.findByRole("dialog", { name: "New release" });
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: "Schedule" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Fictional Majors" }),
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Fictional New",
    );
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: "First cycle" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /^27\.2/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Make release" }),
    );

    // Then it is drafted, and opened
    expect(await screen.findByText("Drafted the new release.")).toBeDefined();
    await waitFor(() => {
      expect(searchOf(history).get("open")).toBe(added.id);
    });
    expect(
      bodyOf(fetch, "POST", `/api/release-streams/${streamId}/releases`),
    ).toEqual([
      {
        name: "Fictional New",
        firstCycle: "2027-04-01",
        lastCycle: "2027-04-01",
        shipsOn: null,
        colour: null,
      },
    ]);
  });

  it("offers only the schedules that take releases", async () => {
    await openPage(
      [
        fictionalStream({ releases: [release] }),
        fictionalStream({
          id: "10000000-0000-4000-8000-000000000002",
          name: "Fictional Retired",
          retired: true,
        }),
        fictionalStream({
          id: "10000000-0000-4000-8000-000000000003",
          name: "Fictional Removed",
          draft: recordDraft({ action: "deleted" }),
        }),
        fictionalStream({
          id: "10000000-0000-4000-8000-000000000004",
          name: "Fictional Empty",
          patterns: [],
          cycles: [],
        }),
      ],
      { can: editsReleases },
    );
    await userEvent.click(screen.getByRole("button", { name: "New release" }));
    const dialog = await screen.findByRole("dialog", { name: "New release" });
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: "Schedule" }),
    );
    expect(
      (await screen.findAllByRole("option")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Fictional Majors"]);
  });

  it("can't be done while no schedule has cycles", async () => {
    await openPage(
      [fictionalStream({ patterns: [], cycles: [], releases: [release] })],
      { can: editsReleases },
    );
    expect(
      screen
        .getByRole("button", { name: "New release" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("is not offered to a role that doesn't change releases", async () => {
    await openPage(inStream(release));
    expect(screen.queryByRole("button", { name: "New release" })).toBeNull();
  });

  it("is not offered under Live only", async () => {
    await openPage(inStream(release), {
      can: editsReleases,
      path: "/releases?show=live",
    });
    expect(screen.queryByRole("button", { name: "New release" })).toBeNull();
  });

  it("says why it can't be done while only a retired schedule has cycles", async () => {
    await openPage([fictionalStream({ retired: true, releases: [release] })], {
      can: editsReleases,
    });
    await userEvent.hover(
      screen.getByRole("button", { name: "New release" })
        .parentElement as HTMLElement,
    );
    expect(
      await screen.findByText("No schedule takes new releases now"),
    ).toBeDefined();
  });
});
