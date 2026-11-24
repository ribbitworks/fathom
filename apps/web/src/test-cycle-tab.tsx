// SPDX-License-Identifier: Apache-2.0

// Helpers for the tests of the Releases page's Cycles tab: a fixed day, fictional schedules and
// answers, and ways to open the tab or a cycle and read its table.

import type { Cycle, ReleaseStream } from "@fathom/shared";
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import {
  fictionalPattern,
  fictionalStream,
  quarters,
  streamId,
  streamsAnswer,
} from "./test-releases.ts";
import {
  recordDraft,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

export function setUpEachTest() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-05-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
}

type Answers = Parameters<typeof serverAnswers>[0];
type Can = Parameters<typeof streamsAnswer>[1];

export const changeSetId = "00000000-0000-4000-8000-000000000001";

export const patternId = "20000000-0000-4000-8000-000000000002";
export const editsStreams = { canEditStreams: true };

export const bySchedule = { path: "/releases?tab=cycles&grouping=schedule" };

// Opens the page at the address given, with the schedules given, and any other answers the test
// needs, once the table of cycles shows.
export async function openPage(
  shown: ReleaseStream[],
  {
    path = "/releases?tab=cycles",
    can = {},
    answers = {},
  }: { path?: string; can?: Can; answers?: Answers } = {},
) {
  const fetch = serverAnswers({
    "GET /api/session": signedIn,
    "GET /api/release-streams": streamsAnswer(shown, can),
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("grid", { name: "Cycles" });
  return { fetch, history };
}

export const cycleId = (startsOn: string, stream = streamId) =>
  `${stream} ${startsOn}`;
export const searchOf = (history: { location: { search: string } }) =>
  new URLSearchParams(history.location.search);

// Opens the page with a cycle's details open, the second of Fictional Majors to start.
export async function openCycle(
  shown: ReleaseStream[],
  options: { can?: Can; answers?: Answers; view?: string } = {},
  startsOn = "2027-04-01",
) {
  const opened = await openPage(shown, {
    ...options,
    path: `/releases?tab=cycles&open=${encodeURIComponent(cycleId(startsOn))}${options.view ?? ""}`,
  });
  await screen.findByRole("heading", { level: 2, name: cycleHeading });
  return opened;
}

export const cycleHeading = /^Fictional Majors: /;
export const cyclePanel = () =>
  screen.getByRole("region", { name: cycleHeading });

export const grid = () => screen.getByRole("grid", { name: "Cycles" });
// The rows of the table, after its header, as read.
export const rowTexts = () =>
  within(grid())
    .getAllByRole("row")
    .slice(1)
    .map(({ textContent }) => textContent);

// Fictional Majors' second cycle, 27.2, drafted to end a month early, the next starting a month
// early to keep its end, by a new pattern from 27.2 on.
export const shortened = (fields: Partial<ReleaseStream> = {}) => {
  const [first, second, third, fourth] = quarters(4) as [
    Cycle,
    Cycle,
    Cycle,
    Cycle,
  ];
  return fictionalStream({
    patterns: [
      fictionalPattern(),
      fictionalPattern({
        id: patternId,
        startsOn: "2027-04-01",
        length: 2,
        draft: recordDraft({ action: "created" }),
      }),
    ],
    cycles: [
      first,
      { ...second, endsOn: "2027-05-31" },
      { ...third, startsOn: "2027-06-01" },
      fourth,
    ],
    liveCycles: quarters(4),
    ...fields,
  });
};
