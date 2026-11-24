// SPDX-License-Identifier: Apache-2.0

// Helpers for the tests of the Releases page's Schedules tab: fictional answers and roles, and
// ways to open a schedule, use its row's menu and read what was sent.

import type { ReleaseStream } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, vi } from "vitest";
import {
  fictionalPattern,
  fictionalRelease,
  streamId,
  streamsAnswer,
} from "./test-releases.ts";
import {
  fictionalUser,
  renderApp,
  serverAnswers,
  signedIn,
  changesSent,
} from "./test-support.tsx";

export function setUpEachTest() {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
}

export const editsAll = { canEditStreams: true, canEditReleases: true };
export const approver = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "plan:view",
      "features:view",
      "plan:approve",
      "features:approve",
      "people:approve",
      "hiring-plan:approve",
      "configuration:approve",
    ],
  });
export const changeSetId = "00000000-0000-4000-8000-000000000001";

export const streamPath = `/api/release-streams/${streamId}`;
export const pattern = fictionalPattern();
export const release = fictionalRelease();

type Answers = Parameters<typeof serverAnswers>[0];

// Opens the schedule's panel, with the streams given, and any other answers the test needs.
export async function openStream(
  shown: ReleaseStream[],
  {
    can = {},
    answers = {},
  }: { can?: typeof editsAll | object; answers?: Answers } = {},
) {
  const fetch = serverAnswers({
    "GET /api/session": signedIn,
    "GET /api/release-streams": streamsAnswer(shown, can),
    ...answers,
  });
  const history = renderApp(`/releases/${streamId}`);
  await screen.findByRole("heading", {
    name: (shown[0] as ReleaseStream).name,
    level: 2,
  });
  return { fetch, history };
}

export const panel = () =>
  screen.getByRole("region", { name: "Fictional Majors" });

// The record whose details the address opens, if any.
export const openIn = (history: { location: { search: string } }) =>
  new URLSearchParams(history.location.search).get("open") ?? undefined;

// Opens the menu of the schedule's row in the table, from the ⋯ beside its Schedule cell.
export async function openRowMenu() {
  const [more] = within(
    screen.getByRole("grid", { name: "Schedules" }),
  ).getAllByRole("button", { name: "Actions for Fictional Majors" });
  await userEvent.click(more as HTMLElement);
  return screen.findByRole("menu");
}

// Chooses an action from the menu of the schedule's row.
export async function chooseRowAction(item: string) {
  await openRowMenu();
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

const schedulesGrid = ["grid", { name: "Schedules" }] as const;

export const streamsGrid = () => screen.findByRole(...schedulesGrid);

// The rows of the table, after its header, as read.
export const rowTexts = () =>
  within(screen.getByRole(...schedulesGrid))
    .getAllByRole("row")
    .slice(1)
    .map(({ textContent }) => textContent);
// A stream's cell in a column, by its row's name.
export const cellOf = (name: string, column: number) =>
  within(
    screen
      .getByRole("button", { name: `Show details of ${name}` })
      .closest("tr") as HTMLElement,
  )
    .getAllByRole("gridcell")
    .at(column) as HTMLElement;
export const detailsOf = (name: string) =>
  screen.findByRole("button", { name: `Show details of ${name}` });

// Chooses an item from a column's menu, from its heading.
export async function chooseInColumn(label: string, item: string) {
  await userEvent.click(
    screen.getByRole("button", {
      name: (name) => name.startsWith(`${label} column`),
    }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
  await waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
}

export function calls(fetch: ReturnType<typeof serverAnswers>, method: string) {
  return changesSent(fetch, method).map(([url]) => url);
}
