// SPDX-License-Identifier: Apache-2.0

// Helpers for the Features Board's tests: fictional features, schedules and choices, the board's
// width the tests set, and ways to open the board and read its columns and cards.

import type { Feature, ProjectPlan, ReleaseStream } from "@fathom/shared";
import { startingEffortConversions } from "@fathom/shared";
import { screen, within } from "@testing-library/react";
import {
  featureDraft,
  fictionalRelease,
  fictionalStream,
  fictionalFeature,
  fictionalUser,
  noFeatureColumns,
  quarters,
  recordDraft,
  renderApp,
  serverAnswers,
  streamId,
} from "./test-support.tsx";
import { size } from "./test-board-width.ts";

export { size };

export const ids = {
  planned: "f0000000-0000-4000-8000-000000000001",
  likely: "f0000000-0000-4000-8000-000000000002",
  started: "f0000000-0000-4000-8000-000000000003",
  critical: "f0000000-0000-4000-8000-000000000004",
  low: "f0000000-0000-4000-8000-000000000005",
  medium: "f0000000-0000-4000-8000-000000000006",
  high: "f0000000-0000-4000-8000-000000000007",
  calm: "f0000000-0000-4000-8000-000000000008",
};

export const feature = (name: string, more: Partial<Feature> = {}): Feature =>
  fictionalFeature({
    id: crypto.randomUUID(),
    name,
    statusId: ids.planned,
    ...more,
  });

export const target = (cycle: string) => ({
  targetStreamId: streamId,
  targetCycle: cycle,
});

export const alpha = feature("Fictional Alpha", {
  ...target("2027-04-01"),
  priorityId: ids.critical,
  sizeId: ids.medium,
  riskId: ids.high,
  neededBy: "2027-06",
});
export const beta = feature("Fictional Beta", {
  ...target("2027-04-01"),
  statusId: ids.likely,
  priorityId: ids.low,
});
export const gamma = feature("Fictional Gamma", {
  ...target("2027-07-01"),
  statusId: ids.started,
  staffed: true,
  draft: featureDraft({
    changed: ["targetCycle"],
    live: { targetCycle: "2027-04-01" },
    unpublished: true,
  }),
});
export const later = feature("Fictional Later", { staffed: true });

export const customers = [
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

export const plan = (features: Feature[]): ProjectPlan => ({
  customers,
  projects: [],
  proposals: [],
  features,
  activities: [],
  featureColumns: noFeatureColumns,
  canEdit: false,
  canEditFeatures: true,
});

export const majors = fictionalStream({
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
export const retiring: ReleaseStream = {
  ...fictionalStream({ name: "Fictional Minors" }),
  id: "10000000-0000-4000-8000-000000000002",
  retired: true,
  draft: recordDraft({ changed: ["retired"], live: { retired: false } }),
};
export const retired: ReleaseStream = {
  ...fictionalStream({ name: "Fictional Old" }),
  id: "10000000-0000-4000-8000-000000000003",
  retired: true,
};

export const choices = {
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

// Opens the board, on the first schedule's cycles unless the address chooses or months are asked
// for.
export async function openBoard(
  path = "/features?mode=board",
  {
    features = [alpha, beta, gamma, later],
    streams = [majors, retiring, retired],
    answers = {},
    months = false,
  }: {
    features?: Feature[];
    streams?: ReleaseStream[];
    answers?: Parameters<typeof serverAnswers>[0];
    months?: boolean;
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
  const history = renderApp(
    months || path.includes("stream=")
      ? path
      : `${path}${path.includes("?") ? "&" : "?"}stream=${majors.id}`,
  );
  await screen.findByRole("button", { name: /^Group by/ });
  return history;
}

export const column = (name: string) => screen.getByRole("list", { name });

// The names of the cards in a column, among the features given.
export const cardNames = (
  name: string,
  among: readonly Feature[] = [alpha, beta, gamma, later],
) =>
  within(column(name))
    .queryAllByRole("button")
    .filter(
      (button) => !button.getAttribute("aria-label")?.startsWith("Actions for"),
    )
    .map(({ textContent }) =>
      among
        .map(({ name }) => name)
        .find((name) => textContent.startsWith(name)),
    );

export const card = (name: string) =>
  screen.getByRole("button", { name: (label) => label.startsWith(name) });

export const headings = () =>
  screen
    .getAllByText(/^(Cycle \d\d\.\d|Later|[A-Z][a-z]{2} \d{4}|No date)$/u)
    .filter(
      (text) =>
        text.tagName === "P" &&
        text.closest("[data-card-of], [data-side-panel]") === null,
    )
    .map(({ textContent }) => textContent);
