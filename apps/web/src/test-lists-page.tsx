// SPDX-License-Identifier: Apache-2.0

// Helpers for the Lists page's tests: fictional lists and accounts, the server's answers, and
// ways to open a list's panel, find its rows and menus, and undo.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect } from "vitest";
import {
  fictionalUser,
  findRowActions,
  recordCell,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

// Sight of people and of every class, which changing a list of each class needs.
const everyClass = ["people:view", "personal:view", "confidential:view"];

export const viewer = () =>
  Response.json({
    ...fictionalUser,
    permissions: ["configuration:view", "plan:view", "features:view"],
  });

// An editor who sees people and every class, as every role that edits lists does.
export const editor = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "configuration:edit",
      "configuration:view",
      "plan:view",
      "features:view",
      ...everyClass,
    ],
  });

// An editor who may move data between classes, seeing Personal data but not Confidential.
export const classifier = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "configuration:edit",
      "configuration:view",
      "plan:view",
      "features:view",
      "people:view",
      "personal:view",
      "data:classify",
    ],
  });

export const choice = (id: string, label: string, extra: object = {}) => ({
  id,
  label,
  description: "",
  retired: false,
  ...extra,
});

export const locations = {
  id: "l1",
  keyNumber: 1,
  name: "Locations",
  description: "Offices and labs.",
  visibility: "general",
  retired: false,
  choices: [
    choice("c1", "Kestrel Bay", { description: "Head office." }),
    choice("c2", "Northmere"),
    choice("c3", "Corran Quay"),
    choice("c4", "Old Mill", { retired: true }),
  ],
};
export const skills = {
  id: "l2",
  keyNumber: 1,
  name: "Skills",
  description: "",
  visibility: "personal",
  retired: false,
  choices: [choice("c5", "Rust")],
};
export const empty = {
  id: "l3",
  keyNumber: 1,
  name: "Empty List",
  description: "",
  visibility: "general",
  retired: false,
  choices: [],
};
export const regions = {
  id: "l4",
  keyNumber: 1,
  name: "Regions",
  description: "",
  visibility: "confidential",
  retired: true,
  choices: [choice("c6", "North"), choice("c7", "South", { retired: true })],
};

// A draft removing a list or choice, as the server sends it.
export const removal = {
  action: "deleted",
  changed: [],
  live: {},
  state: "waiting",
  madeBy: "Fictional Editor",
  madeAt: "2026-11-01T10:00:00.000Z",
};

export const listsAnswer = () =>
  Response.json({ lists: [locations, skills, empty, regions] });
// Change sets: the one each change is saved in, and the one undoing it makes.
export const s1 = "00000000-0000-4000-8000-000000000001";
export const u1 = "00000000-0000-4000-8000-000000000002";

// A change saved in the given change set, which undoing names.
export const savedAs =
  (changeSetId: string | null = s1) =>
  () =>
    Response.json({ changeSetId });
export const refused = (status: number) => () =>
  Response.json({ error: "Refused" }, { status });

export type Answers = Parameters<typeof serverAnswers>[0];

// No people, which an Approver who sees people reads before deciding, since a list's drafts may be
// used by people's.
export const noPeople = () =>
  Response.json({ people: [], fields: [], order: [] });

export async function openPanel(answers: Answers = {}, path = "/lists/l1") {
  const fetch = serverAnswers({
    "GET /api/session": editor,
    "GET /api/lists": listsAnswer,
    [`POST /api/undo/${s1}`]: savedAs(u1),
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("heading", { name: "Locations", level: 2 });
  // Opening the panel moves focus into it a moment later; waiting for that keeps it from taking
  // focus away from a row the test focuses next.
  await waitFor(() => {
    expect(panel().contains(document.activeElement)).toBe(true);
  });
  return { fetch, history };
}

// The panel, which is a dialog on a narrow screen.
export function panel(): HTMLElement {
  return (
    screen.queryByRole("region", { name: /./ }) ??
    screen.getByRole("dialog", { name: /./ })
  );
}

export function row(id: string): HTMLElement {
  return document.getElementById(`choice-${id}`) as HTMLElement;
}

export function focusRow(id: string) {
  act(() => {
    row(id).focus();
  });
}

export function entryName() {
  return screen.getByLabelText<HTMLInputElement>("New choice name");
}

// The change sets the page asked the server to undo, in order.
export function undone(fetch: ReturnType<typeof serverAnswers>): string[] {
  return fetch.mock.calls
    .filter(
      ([url, init]) => url.startsWith("/api/undo/") && init?.method === "POST",
    )
    .map(([url]) => url.slice("/api/undo/".length));
}

// Matches an accessible name that starts with the text, such as a menu item followed by its
// shortcut.
export function startsWith(text: string) {
  return (name: string) => name.startsWith(text);
}

export async function undoLast() {
  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
}

// An Approver who may not edit lists, so has their menus only to decide drafts.
export const approverOnly = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "configuration:view",
      "plan:approve",
      "features:approve",
      "people:approve",
      "hiring-plan:approve",
      "configuration:approve",
      "plan:view",
      "features:view",
      ...everyClass,
    ],
  });

export const approver = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "configuration:edit",
      "configuration:view",
      "plan:approve",
      "features:approve",
      "people:approve",
      "hiring-plan:approve",
      "configuration:approve",
      "plan:view",
      "features:view",
      ...everyClass,
    ],
  });
export const waiting = {
  state: "waiting",
  madeBy: "Fictional Editor",
  madeAt: "2026-11-01T10:00:00.000Z",
};
// A list drafted to be added, with a choice drafted into it; a live list with a renamed, rejected
// choice and a draft of its order.
export const added = {
  id: "l5",
  keyNumber: 1,
  name: "Teams",
  description: "",
  visibility: "general",
  retired: false,
  choices: [
    {
      ...choice("c8", "Platform"),
      draft: {
        ...waiting,
        action: "created",
        changed: ["label", "description", "retired"],
        live: {},
      },
    },
  ],
  draft: {
    ...waiting,
    action: "created",
    changed: ["name", "description", "visibility", "retired"],
    live: {},
  },
};
export const changed = {
  ...locations,
  choices: [
    locations.choices[1],
    {
      ...locations.choices[0],
      label: "Kestrel Harbour",
      draft: {
        ...waiting,
        state: "rejected",
        reason: "Keep the old name",
        action: "changed",
        changed: ["label"],
        live: { label: "Kestrel Bay" },
      },
    },
    ...locations.choices.slice(2),
  ],
  orderDraft: { ...waiting, live: ["c1", "c2", "c3", "c4"] },
};
export const draftedAnswer = () =>
  Response.json({ lists: [changed, skills, empty, regions, added] });

export const listMenu = async (name: string) => {
  await waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
  await userEvent.click(
    await screen.findByRole("button", { name: `Drafts of ${name}` }),
  );
  return screen.findByRole("menu");
};
export const chooseInListMenu = async (name: string, item: string) => {
  await userEvent.click(
    within(await listMenu(name)).getByRole("menuitem", { name: item }),
  );
};

export const sent = (
  fetch: ReturnType<typeof serverAnswers>,
  method: string,
  path: string,
) =>
  fetch.mock.calls.some(
    ([url, init]) => url.endsWith(path) && init?.method === method,
  );

export const listsGrid = () => screen.findByRole("grid", { name: "Lists" });

const detailsOf = "Show details of ";

// The names of the lists the table shows, in its order, by the buttons that open them.
export const shownLists = () =>
  screen
    .queryAllByRole("button", { name: (name) => name.startsWith(detailsOf) })
    .map((button) =>
      (button.getAttribute("aria-label") ?? "").slice(detailsOf.length),
    );

export const openList = async (name: string) => {
  await userEvent.click(
    await screen.findByRole("button", { name: `${detailsOf}${name}` }),
  );
};

// What a list's cell in a column of the table reads.
export const cellText = (id: string, column: string) =>
  recordCell(id, column)?.textContent;

// The ⋯ menu at the end of a list's row.
export const rowMenu = async (name: string) => {
  await userEvent.click(await findRowActions(name));
  return screen.findByRole("menu");
};

// Turns Show retired on or off in the Views menu, by the item's whole name.
export const chooseInViews = async (item: string) => {
  await userEvent.click(await screen.findByRole("button", { name: /^Views/ }));
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
};

export const openDraftMenu = async () => {
  await userEvent.click(
    // Not a list's menu of drafts, "Drafts of" the list, beside its name in the panel.
    await screen.findByRole("button", { name: /^Draft(?!s of)/ }),
  );
  return screen.findByRole("menu");
};
