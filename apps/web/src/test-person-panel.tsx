// SPDX-License-Identifier: Apache-2.0

// Helpers for the tests of a person's details panel: fictional people, positions and org chart, the
// server's answers, ways to find the panel and its rows, and ways to change a person's details.

import type { OrgChartPerson } from "@fathom/shared";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, vi, expect } from "vitest";
import {
  background,
  detailRow,
  fictionalUser,
  positions,
  serverAnswers,
} from "./test-support.tsx";
import { userEvent } from "@testing-library/user-event";

export function setUpEachTest() {
  beforeAll(() => {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect = () => new DOMRect();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
}

export const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });

export const viewer = session([
  "people:view",
  "feature-teams:view",
  "personal:view",
  "plan:view",
  "features:view",
]);

export const profile = {
  ...background,
  id: "f2",
  name: "Profile",
  type: "link",
};

export const person = (
  id: string,
  preferredName: string,
  details: object = {},
): object => ({
  id,
  keyNumber: 1,
  preferredName,
  employeeId: `E${id}`,
  positionId: "position-1",
  startDate: "2020-01-01",
  endDate: null,
  isManager: false,
  manager: null,
  team: null,
  teamName: null,
  values: {},
  links: {},
  notes: {},
  ...details,
});

export const robin = person("1", "Robin Fictional", {
  isManager: true,
  teamName: "Fictional team",
});

export const sasha = person("2", "Sasha Fictional", {
  manager: { id: "1", preferredName: "Robin Fictional" },
  managerFrom: "2024-03-01",
  team: "Fictional team",
  isManager: true,
  notes: { f1: "**Joined** from the platform team" },
  links: { f2: { address: "https://example.com/sasha", text: "Profile page" } },
  teamName: "Fictional crew",
  draft: {
    action: "changed",
    changed: ["teamName"],
    live: { teamName: null, values: {}, links: {} },
    state: "waiting",
    madeBy: null,
    madeAt: null,
  },
});

export const uma = person("3", "Uma Fictional", {
  manager: { id: "2", preferredName: "Sasha Fictional" },
  team: "Fictional crew",
});

export const peopleAnswer =
  (people: object[] = [robin, sasha, uma]) =>
  () =>
    Response.json({
      people,
      fields: [background, profile],
      order: ["preferredName", "employeeId", "positionId", "f1", "f2"],
    });

const chartPerson = (
  id: string,
  name: string,
  managerId: string | null,
): OrgChartPerson => ({
  id,
  keyNumber: 1,
  preferredName: name,
  employeeId: `E${id}`,
  position: "Fictional Engineer",
  teamName: null,
  teamColour: null,
  managerId,
});

export const chart = [
  {
    ...chartPerson("1", "Robin Fictional", null),
    teamName: "Fictional team",
    teamColour: "teal" as const,
  },
  chartPerson("2", "Sasha Fictional", "1"),
  // A colour for a team with no name, as a chart drawn before a name came off may hold.
  { ...chartPerson("3", "Uma Fictional", "2"), teamColour: "grape" as const },
];

export function answers(
  people?: object[],
  lists: () => Response = () => Response.json({ lists: [positions] }),
  positionHidden = false,
) {
  serverAnswers({
    "GET /api/session": viewer,
    "GET /api/people": positionHidden
      ? () =>
          Response.json({
            people: people ?? [robin, sasha, uma],
            fields: [],
            order: [],
            positionHidden: true,
          })
      : peopleAnswer(people),
    "GET /api/lists": lists,
    "GET /api/unpublished": () => Response.json({ changes: [] }),
    "GET /api/org-chart": () =>
      Response.json({ people: chart, drafted: chart }),
  });
}

export const panel = (name: string) => screen.findByRole("region", { name });

export const row = (label: string) => detailRow(label);

export const editor = session([
  "people:view",
  "people:edit",
  "feature-teams:view",
  "personal:view",
  "plan:view",
  "features:view",
]);
export const saved = "00000000-0000-4000-8000-0000000000c1";
export const savedAs = () => Response.json({ changeSetId: saved });
const architect = {
  id: "position-2",
  label: "Fictional Architect",
  description: "",
  retired: false,
};

export function editAnswers(more: Record<string, () => Response> = {}) {
  return serverAnswers({
    "GET /api/session": editor,
    "GET /api/people": peopleAnswer(),
    "GET /api/lists": () =>
      Response.json({
        lists: [{ ...positions, choices: [...positions.choices, architect] }],
      }),
    "GET /api/unpublished": () => Response.json({ changes: [] }),
    "GET /api/org-chart": () =>
      Response.json({ people: chart, drafted: chart }),
    "PATCH /api/people/1": savedAs,
    [`POST /api/undo/${saved}`]: () => Response.json({ changeSetId: null }),
    ...more,
  });
}

export const undone = (fetch: ReturnType<typeof serverAnswers>) =>
  fetch.mock.calls.filter(([url]) => url === `/api/undo/${saved}`).length;

export const change = (label: string) =>
  screen.getByRole("button", { name: `Change ${label}` });

// Waits for a change to finish saving, once the count of unsaved changes is asked for again.
export const settled = (fetch: ReturnType<typeof serverAnswers>) =>
  waitFor(() => {
    expect(fetch).toHaveBeenCalledWith("/api/unpublished", expect.anything());
  });

export async function typeInto(label: string, text: string) {
  await userEvent.click(change(label));
  const field = await screen.findByRole("textbox", { name: label });
  await userEvent.clear(field);
  await userEvent.type(field, text);
  return field;
}

// People as the server has them, with Robin's ID as last saved or undone.
export function renaming() {
  let employeeId = "E1";
  const fetch = editAnswers({
    "GET /api/people": () =>
      peopleAnswer([{ ...robin, employeeId }, sasha, uma])(),
    "PATCH /api/people/1": () => {
      employeeId = "E7";
      return savedAs();
    },
    [`POST /api/undo/${saved}`]: () => {
      employeeId = "E1";
      return Response.json({ changeSetId: null });
    },
  });
  return fetch;
}
