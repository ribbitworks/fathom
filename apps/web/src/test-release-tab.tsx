// SPDX-License-Identifier: Apache-2.0

// Helpers for the tests of the Releases page's Releases tab: a fixed day, fictional releases and
// answers, and ways to open the tab or a release and read its table.

import type { Release, ReleaseStream } from "@fathom/shared";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import {
  fictionalRelease,
  fictionalStream,
  streamId,
  streamsAnswer,
} from "./test-releases.ts";
import { renderApp, serverAnswers, signedIn } from "./test-support.tsx";

export function setUpEachTest() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
}

type Answers = Parameters<typeof serverAnswers>[0];

export const changeSetId = "00000000-0000-4000-8000-000000000001";

export const release = fictionalRelease();
export const releasePath = `/api/release-streams/${streamId}/releases/${release.id}`;
export const shippedId = "30000000-0000-4000-8000-000000000002";
export const shipped = fictionalRelease({
  id: shippedId,
  name: "Fictional Shipped",
  shipsOn: "2027-02-01",
});
export const editsReleases = { canEditReleases: true };

// Opens the page at the address given, with the schedules given, and any other answers the test
// needs, once the table of releases shows.
export async function openPage(
  shown: ReleaseStream[],
  {
    path = "/releases",
    can = {},
    answers = {},
  }: {
    path?: string;
    can?: { canEditReleases?: boolean };
    answers?: Answers;
  } = {},
) {
  const fetch = serverAnswers({
    "GET /api/session": signedIn,
    "GET /api/release-streams": streamsAnswer(shown, can),
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("grid", { name: "Releases" });
  return { fetch, history };
}

// Opens the page with the release's details open.
export async function openRelease(
  shown: ReleaseStream[],
  options: {
    path?: string;
    can?: { canEditReleases?: boolean };
    answers?: Answers;
  } = {},
) {
  const opened = await openPage(shown, {
    ...options,
    path: options.path ?? `/releases?open=${release.id}`,
  });
  await screen.findByRole("heading", { name: "Fictional One", level: 2 });
  return opened;
}

export const inStream = (...releases: Release[]) => [
  fictionalStream({ releases }),
];
export const bySchedule = { path: "/releases?grouping=schedule" };

export const searchOf = (history: { location: { search: string } }) =>
  new URLSearchParams(history.location.search);
// The rows of the table, after its header, as read.
export const rowTexts = () =>
  within(screen.getByRole("grid", { name: "Releases" }))
    .getAllByRole("row")
    .slice(1)
    .map(({ textContent }) => textContent);
export const detailsOf = (name: string) =>
  screen.findByRole("button", { name: `Show details of ${name}` });

// Chooses an item from the menu of a release's row, from the ⋯ beside its name.
export async function chooseRowAction(name: string, item: string) {
  const [more] = within(
    screen.getByRole("grid", { name: "Releases" }),
  ).getAllByRole("button", { name: `Actions for ${name}` });
  await userEvent.click(more as HTMLElement);
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

// The details panel of the release the tests open, Fictional One.
export const releasePanel = () =>
  screen.getByRole("region", { name: "Fictional One" });
