// SPDX-License-Identifier: Apache-2.0

// Helpers for the tests of filling a planned hire: fictional people, a hire and its lists, the
// server's answers, and ways to open the form and fill it.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { fictionalUser, serverAnswers } from "./test-support.tsx";

export function setUpEachTest() {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
}

export const person = (id: string, name: string, details: object = {}) => ({
  id,
  keyNumber: 1,
  preferredName: name,
  employeeId: `E${id}`,
  positionId: "engineer",
  startDate: "2020-01-01",
  endDate: null,
  isManager: false,
  manager: null,
  values: {},
  links: {},
  ...details,
});

export const robin = person("m1", "Robin Fictional", { isManager: true });

export const hire = (details: object = {}) =>
  person("h1", "Fictional Hire", {
    kind: "planned-hire",
    employeeId: "TBD-1",
    stateId: "open",
    startDate: "2030-03-01",
    expected: "2030-03",
    manager: { id: "m1", preferredName: "Robin Fictional" },
    ...details,
  });

export const builtIn = (id: string, choices: object[]) => ({
  id,
  keyNumber: 1,
  name: id,
  description: "",
  visibility: "general",
  retired: false,
  builtIn: id,
  choices,
});

export const choice = (id: string, label: string, meaning?: string) => ({
  id,
  label,
  description: "",
  retired: false,
  ...(meaning === undefined ? {} : { meaning }),
});

const grades = {
  ...builtIn("grades", [choice("p1", "P1")]),
  builtIn: null,
};

export function answers(
  people: object[],
  options: {
    fields?: object[];
    positionHidden?: boolean;
    fill?: () => Response;
    permissions?: string[];
    // Further answers, such as a refusal, which take the place of those above.
    more?: Parameters<typeof serverAnswers>[0];
  } = {},
) {
  return serverAnswers({
    "GET /api/session": () =>
      Response.json({
        ...fictionalUser,
        permissions: options.permissions ?? [
          "people:view",
          "people:edit",
          "hiring-plan:view",
          "confidential:view",
          "hiring-plan:edit",
          "confidential:edit",
          "personal:view",
          "plan:view",
          "features:view",
        ],
      }),
    "GET /api/people": () =>
      Response.json({
        people,
        fields: options.fields ?? [],
        order: [],
        ...(options.positionHidden === true ? { positionHidden: true } : {}),
      }),
    "GET /api/lists": () =>
      Response.json({
        lists: [
          builtIn("positions", [
            choice("engineer", "Fictional Engineer"),
            choice("tester", "Fictional Tester"),
          ]),
          builtIn("hiring-states", [
            choice("open", "Approved to hire", "open"),
            choice("proposed", "Request to hire", "proposed"),
          ]),
          grades,
        ],
      }),
    "GET /api/unpublished": () => Response.json({ changes: [] }),
    "POST /api/planned-hires/h1/fill":
      options.fill ?? (() => Response.json({ changeSetId: null })),
    ...options.more,
  });
}

export async function openForm() {
  await userEvent.click(
    await screen.findByRole("button", { name: "Fill Fictional Hire" }),
  );
  await screen.findByRole("heading", { name: "Fill this planned hire" });
}

export const fillNow = () =>
  userEvent.click(
    within(
      screen
        .getByRole("heading", { name: "Fill this planned hire" })
        .closest("section") as HTMLElement,
    ).getByRole("button", { name: "Fill" }),
  );

export const type = (label: string, text: string) =>
  userEvent.type(screen.getByRole("textbox", { name: label }), text);
