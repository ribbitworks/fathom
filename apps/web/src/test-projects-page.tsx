// SPDX-License-Identifier: Apache-2.0

// Helpers for the plan pages' tests: a fictional plan, features and release streams, the server's
// answers, and ways to open a page, read what was sent and find its panel and menus.

import type { Activity, ProjectPlan, Release } from "@fathom/shared";
import { startingEffortConversions } from "@fathom/shared";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
  fictionalCycle,
  fictionalRelease,
  fictionalStream,
  streamsAnswer,
} from "./test-releases.ts";
import {
  bodyOf,
  fictionalUser,
  findRowActions,
  noFeatureColumns,
  renderApp,
  serverAnswers,
  choiceUnder,
} from "./test-support.tsx";

export const customerId = "c0000000-0000-4000-8000-000000000001";
export const proposalId = "b0000000-0000-4000-8000-000000000001";
export const projectId = "a0000000-0000-4000-8000-000000000001";
export const milestoneId = "d0000000-0000-4000-8000-000000000001";
export const ownerId = "e0000000-0000-4000-8000-000000000001";
export const statusId = "f0000000-0000-4000-8000-000000000001";
export const newId = "90000000-0000-4000-8000-000000000001";
export const changeSetId = "80000000-0000-4000-8000-000000000001";

export type Plan = ProjectPlan;
export type Project = Plan["projects"][number];
export type Milestone = Project["milestones"][number];

export const milestone = (more: Partial<Milestone> = {}): Milestone => ({
  id: milestoneId,
  keyNumber: 1,
  projectId,
  name: "Fictional Kickoff",
  date: "2030-03-15",
  customerDelivery: true,
  ...more,
});

export const project = (more: Partial<Project> = {}): Project => ({
  id: projectId,
  keyNumber: 1,
  name: "Fictional Project",
  externalId: "FP-1",
  ownerId,
  customerIds: [customerId],
  proposalIds: [proposalId],
  featureIds: [],
  milestones: [],
  dates: { first: null, last: null, nextDelivery: null },
  ...more,
});

export const proposal = (more: Partial<Plan["proposals"][number]> = {}) => ({
  id: proposalId,
  keyNumber: 1,
  name: "Fictional Proposal",
  externalId: null,
  link: null,
  ownerId: null,
  customerIds: [customerId],
  statusId,
  featureIds: [],
  removalReasons: {},
  ...more,
});

export const customer = (
  more: Partial<Plan["customers"][number]> = {},
): Plan["customers"][number] => ({
  id: customerId,
  keyNumber: 1,
  name: "Fictional Customer",
  description: null,
  note: null,
  ...more,
});

export const plan = (more: Partial<Plan> = {}): Plan => ({
  customers: [customer()],
  projects: [project()],
  proposals: [proposal()],
  features: [],
  featureColumns: noFeatureColumns,
  activities: [],
  activityColumns: noFeatureColumns,
  canEdit: true,
  canEditFeatures: false,
  ...more,
});

export const editor = ["plan:view", "features:view", "plan:edit"];
export const approver = [...editor, "plan:approve"];

export const saved = (current: () => Plan) => () =>
  Response.json({ plan: current(), changeSetId });
export const deleted = () => Response.json({ changeSetId });

// Opens the page at an address, with the server holding the plan the test can change.
export async function openPage(
  path: string,
  start: Plan,
  answers: Parameters<typeof serverAnswers>[0] = {},
  permissions: string[] = editor,
) {
  const held = { plan: start };
  const fetch = serverAnswers({
    "GET /api/session": () => Response.json({ ...fictionalUser, permissions }),
    "GET /api/projects": () => Response.json(held.plan),
    "GET /api/projects/choices": () =>
      Response.json({
        owners: [{ id: ownerId, name: "Fictional Owner", retired: false }],
        statuses: [{ id: statusId, name: "Open", retired: false }],
        featureStatuses: [],
        featureTeams: [],
        priorities: [],
        sizes: [],
        risks: [],
      }),
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("grid");
  return { fetch, history, held };
}

// The bodies sent with a request named as its method and address, such as "POST /api/customers".
export const sent = (fetch: ReturnType<typeof serverAnswers>, key: string) => {
  const [method = "", url = ""] = key.split(" ");
  return bodyOf(fetch, method, url);
};

export const sentTo = (fetch: ReturnType<typeof serverAnswers>) =>
  fetch.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);

export const sidePanel = () => {
  const found = document.getElementById("project-record-panel");
  if (found === null) throw new Error("No side panel");
  return found;
};

export const newButton = (name: string) =>
  screen.findByRole("button", { name: `New ${name}` });

export const rowMenu = async (name: string) => {
  await userEvent.click(await findRowActions(name));
  return screen.findByRole("menu");
};

export const chooseFrom = async (menu: HTMLElement, name: string) => {
  await userEvent.click(within(menu).getByRole("menuitem", { name }));
};

export const projectStreamId = "00000000-0000-4000-8000-0000000000aa";
export const teamId = "00000000-0000-4000-8000-0000000000ab";
export const cycleOne = "2027-01-01";
const cycleTwo = "2027-04-01";
const streamsWith = (releases: Release[]) =>
  streamsAnswer(
    [
      fictionalStream({
        id: projectStreamId,
        name: "Fictional Stream",
        patterns: [],
        cycles: [
          fictionalCycle("27.1", cycleOne, "2027-03-31"),
          fictionalCycle("27.2", cycleTwo, "2027-06-30"),
        ],
        releases,
      }),
    ],
    { canEditStreams: true, canEditReleases: true },
  );
export const streams = streamsWith([]);
export const withRelease = {
  "GET /api/release-streams": streamsWith([
    fictionalRelease({
      name: "Fictional Release",
      firstCycle: cycleOne,
      lastCycle: cycleOne,
    }),
  ]),
};
const possibleId = crypto.randomUUID();
export const plannedId = crypto.randomUUID();
export const choices = () =>
  Response.json({
    owners: [],
    statuses: [],
    featureStatuses: [
      {
        id: possibleId,
        name: "Possible",
        retired: false,
        meaning: "possible",
      },
      {
        id: plannedId,
        name: "Planned",
        retired: false,
        meaning: "planned",
      },
    ],
    featureTeams: [
      { id: teamId, name: "Fictional Team", colour: "teal", retired: false },
    ],
    priorities: [],
    sizes: [],
    risks: [],
  });
export const feature = (name: string, targetCycle: string | null) => ({
  id: crypto.randomUUID(),
  keyNumber: 1,
  name,
  statusId: possibleId,
  priorityId: null,
  sizeId: null,
  riskId: null,
  neededBy: null,
  customerIds: [],
  targetStreamId: targetCycle === null ? null : projectStreamId,
  targetCycle,
  estimateHours: 40,
  featureTeamId: null,
  description: null,
  note: null,
  values: {},
  links: {},
  staffed: false,
  staffedLive: false,
});
export const later = feature("Fictional Later", null);
export const second = feature("Fictional Second", cycleTwo);
export const first = feature("Fictional First", cycleOne);
export const featurePlan = (more: Partial<Plan> = {}) =>
  plan({
    features: [later, second, first],
    canEdit: false,
    canEditFeatures: true,
    ...more,
  });
export const answers = {
  "GET /api/release-streams": streams,
  "GET /api/projects/choices": choices,
  "GET /api/effort-conversions": () => Response.json(startingEffortConversions),
};
export const featureEditor = ["plan:view", "features:view", "features:edit"];
export const planEditor = [...featureEditor, "plan:edit"];
export const open = (
  start = featurePlan(),
  more: typeof answers | object = {},
  path = "/features",
) => openPage(path, start, { ...answers, ...more }, featureEditor);
export const byCycle = "/features?grouping=targetCycle";
const groupHeading = /^(Fictional Stream: 27\.[12]|Later)\d+ features?$/;
export const headings = () =>
  screen
    .queryAllByRole("rowheader")
    .map((cell) => cell.textContent)
    .filter((text) => groupHeading.test(text));
export const groupButton = (shown: string) =>
  screen.getByRole("button", {
    name: shown === "None" ? "Group by" : `Group by: ${shown}`,
  });
// With no grouping, the menu holds Group by's choices alone, under no label.
export const groupBy = async (shown: string, next: string) => {
  await userEvent.click(groupButton(shown));
  await userEvent.click(
    shown === "None"
      ? await screen.findByRole("menuitem", { name: next })
      : await choiceUnder("Group by", next),
  );
};
export const rowNames = () =>
  screen
    .getAllByRole("row")
    .map(
      ({ textContent }) =>
        /Fictional (Later|Second|First)/.exec(textContent)?.[0],
    )
    .filter((name) => name !== undefined);

export const activity = (more: Partial<Activity> = {}): Activity => ({
  id: "50000000-0000-4000-8000-000000000001",
  keyNumber: 7,
  name: "Fictional Migration",
  statusId: "",
  priorityId: null,
  sizeId: null,
  riskId: null,
  neededBy: null,
  estimateHours: null,
  featureTeamId: null,
  description: null,
  note: null,
  values: {},
  links: {},
  staffed: false,
  staffedLive: false,
  releaseId: null,
  projectId,
  ...more,
});
