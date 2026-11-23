// SPDX-License-Identifier: Apache-2.0

// Helpers for the Drafts page's tests: a fictional session, people and lists with their drafts,
// the server's answers, and ways to open the page and read its drafts.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
  fictionalUser,
  noFeatureColumns,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

// No schedules, for drafts of other kinds.
export const noStreams = () =>
  Response.json({ streams: [], canEditStreams: false, canEditReleases: false });

export const s1 = "00000000-0000-4000-8000-000000000001";

export const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });
export const approver = session([
  "plan:approve",
  "features:approve",
  "people:approve",
  "hiring-plan:approve",
  "configuration:approve",
  "people:view",
  "people:edit",
  "personal:view",
]);
export const reader = session(["people:view"]);

export const sites = {
  id: "l1",
  keyNumber: 1,
  name: "Sites",
  description: "",
  visibility: "general",
  retired: false,
  choices: [
    { id: "c1", label: "Harbour", description: "", retired: false },
    { id: "c2", label: "Northmere", description: "", retired: false },
  ],
};
export const site = {
  id: "f1",
  keyNumber: 1,
  name: "Site",
  listId: "l1",
  multiple: false,
  required: false,
};

export const draft = (fields: object) => ({
  changed: [],
  live: { values: {} },
  state: "waiting",
  madeBy: "Fictional Editor",
  madeAt: "2026-10-30T15:00:00.000Z",
  ...fields,
});

export const person = (
  id: string,
  preferredName: string,
  more: object = {},
) => ({
  id,
  keyNumber: 1,
  preferredName,
  employeeId: `E-${id}`,
  positionId: "position-1",
  startDate: null,
  endDate: null,
  values: {},
  ...more,
});

export const changed = person("p1", "Avery Fictional", {
  startDate: "2026-11-02",
  values: { f1: ["c1"] },
  draft: draft({
    action: "changed",
    changed: ["startDate", "f1", "gone"],
    live: { startDate: null, values: { f1: ["c2"] } },
    madeAt: "2026-10-31T09:00:00.000Z",
  }),
});
export const added = person("p2", "Blake Fictional", {
  values: { f1: ["c1", "unknown"] },
  draft: draft({
    action: "created",
    changed: ["preferredName", "employeeId", "f1"],
  }),
});
export const removed = person("p3", "Casey Fictional", {
  draft: draft({ action: "deleted", changed: ["preferredName"], madeBy: null }),
});
export const rejected = person("p4", "Drew Fictional", {
  draft: draft({
    action: "changed",
    changed: ["preferredName"],
    live: { preferredName: "Drew Before", values: {} },
    state: "rejected",
    reason: "Fictional reason",
    madeAt: "2026-10-29T09:00:00.000Z",
  }),
});
export const live = person("p5", "Emery Fictional");

export const peopleWith = (people: object[]) => () =>
  Response.json({ people, fields: [site], order: [] });

export const noPlan = () =>
  Response.json({
    customers: [],
    projects: [],
    proposals: [],
    features: [],
    canEdit: false,
    canEditFeatures: false,
    featureColumns: noFeatureColumns,
  });
export const noPlanChoices = () =>
  Response.json({
    owners: [],
    statuses: [],
    featureStatuses: [],
    featureTeams: [],
    priorities: [],
    sizes: [],
    risks: [],
  });

const columnCount = 9;

export type Answers = Parameters<typeof serverAnswers>[0];

// Opens the Drafts page on the tab the address names, or on the role's first tab.
export async function openDrafts(answers: Answers = {}, address = "/drafts") {
  const fetch = serverAnswers({
    "GET /api/session": approver,
    "GET /api/people": peopleWith([changed, added, removed, rejected, live]),
    "GET /api/release-streams": noStreams,
    "GET /api/lists": () => Response.json({ lists: [sites] }),
    ...answers,
  });
  const app = renderApp(address);
  await screen.findByRole("heading", { name: "Drafts" });
  return { fetch, app };
}

// Opens a draft's details from its row, giving where its link to the record's own page leads.
export async function showOn(record: string, page: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: `Show details of ${record}` }),
  );
  return (
    await screen.findByRole("link", { name: `Show on ${page}` })
  ).getAttribute("href");
}

// Each row's cells, from Record to Reason, as the table shows them.
export const entries = async () => {
  const table = await screen.findByRole("grid", { name: "Drafts" });
  return within(table)
    .getAllByRole("row")
    .filter((row) => within(row).queryAllByRole("gridcell").length > 0)
    .map((row) =>
      within(row)
        .getAllByRole("gridcell")
        .slice(0, columnCount)
        .map((cell) => cell.textContent.trim())
        .join(" | "),
    );
};
