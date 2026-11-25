// SPDX-License-Identifier: Apache-2.0

// The fictional people, lists and server answers the People page's tests share, helpers that drive
// its table, menus and pickers, and the page opened on the rows given, as the planned hire tests'
// server answers have it.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect } from "vitest";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";
import { answers } from "./test-hire-fill-form.tsx";

export const s1 = "00000000-0000-4000-8000-000000000001";
export const u1 = "00000000-0000-4000-8000-000000000002";

export const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });
export const viewer = session([
  "people:view",
  "configuration:view",
  "plan:view",
  "features:view",
]);
export const editor = session([
  "configuration:edit",
  "configuration:view",
  "people:edit",
  "people:view",
  "plan:view",
  "features:view",
  "personal:edit",
  "personal:view",
]);
export const hiringEditor = session([
  "configuration:view",
  "hiring-plan:edit",
  "confidential:edit",
  "hiring-plan:view",
  "confidential:view",
  "people:edit",
  "people:view",
  "plan:view",
  "features:view",
  "personal:edit",
  "personal:view",
]);

export const choice = (id: string, label: string, retired = false) => ({
  id,
  label,
  description: "",
  retired,
});
export const list = (
  id: string,
  name: string,
  choices: object[],
  retired = false,
) => ({
  id,
  keyNumber: 1,
  name,
  description: "",
  visibility: "general",
  retired,
  choices,
});
export const sites = list("l1", "Sites", [
  choice("c1", "Harbour"),
  choice("c2", "Northmere"),
  choice("c3", "Old Mill", true),
]);
export const roles = {
  ...list("l2", "Roles on the team", [
    choice("r1", "Team Lead"),
    choice("r2", "Design Authority"),
  ]),
  visibility: "personal",
};
export const old = list("l3", "Old List", [], true);
// The built-in Positions list.
export const positions = {
  ...list("positions", "Positions", [
    choice("position-1", "Engineer"),
    choice("position-2", "Tester"),
    // Drafted to be added, so not yet offered as a position.
    {
      ...choice("position-3", "Technician"),
      draft: {
        action: "created",
        changed: ["label"],
        live: {},
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
    },
  ]),
  builtIn: "positions",
};
export const listsAnswer = () =>
  Response.json({ lists: [sites, roles, old, positions] });
// The built-in hiring states list, with a state of each meaning.
export const states = {
  ...list("states", "Hiring states", [
    { ...choice("s-proposed", "Request to hire"), meaning: "proposed" },
    { ...choice("s-open", "Approved to hire"), meaning: "open" },
    { ...choice("s-hired", "Hired"), meaning: "hired" },
    { ...choice("s-left", "Fictional Resigned"), meaning: "left" },
  ]),
  builtIn: "hiring-states",
};

export const site = {
  id: "f1",
  keyNumber: 1,
  name: "Site",
  listId: "l1",
  multiple: false,
  required: true,
};
export const role = {
  id: "f2",
  keyNumber: 1,
  name: "Role on team",
  listId: "l2",
  multiple: true,
  required: false,
};
export const avery = {
  id: "p1",
  keyNumber: 1,
  preferredName: "Avery Fictional",
  employeeId: "E1",
  positionId: "position-1",
  startDate: "2024-03-01",
  endDate: null,
  values: { f1: ["c1"], f2: ["r1", "r2"] },
};
export const blake = {
  id: "p2",
  keyNumber: 1,
  preferredName: "Blake Fictional",
  employeeId: "E2",
  positionId: "position-1",
  startDate: null,
  endDate: null,
  values: { f1: ["c3"] },
};
export const order = [
  "preferredName",
  "employeeId",
  "positionId",
  "f1",
  "f2",
  "startDate",
  "endDate",
  "managerId",
  "managerFrom",
  "team",
  "teamName",
];
export const peopleAnswer = () =>
  Response.json({
    people: [avery, blake],
    fields: [site, role],
    order,
  });
export const savedAs =
  (changeSetId: string | null = s1) =>
  () =>
    Response.json({ changeSetId });
export const refused =
  (status: number, error = "Refused") =>
  () =>
    Response.json({ error }, { status });

export type Answers = Parameters<typeof serverAnswers>[0];

export async function openPeople(answers: Answers = {}) {
  const fetch = serverAnswers({
    "GET /api/session": editor,
    "GET /api/people": peopleAnswer,
    "GET /api/lists": listsAnswer,
    [`POST /api/undo/${s1}`]: savedAs(u1),
    ...answers,
  });
  renderApp("/people");
  await screen.findByRole("grid", { name: "People" });
  return fetch;
}

export function cell(row: string, key: string): HTMLElement {
  return document.getElementById(`cell-${row}-${key}`) as HTMLElement;
}

// The keys of the columns, by the name each column's header shows.
const columnKeys = new Map([
  ["Name", "preferredName"],
  ["ID", "employeeId"],
  ["Position", "positionId"],
  ["State", "stateId"],
  ["Site", "f1"],
  ["Role on team", "f2"],
  ["Start", "startDate"],
  ["End", "endDate"],
]);

// A row's cell in the column with the given header.
export function inRow(row: HTMLElement, label: string): HTMLElement {
  return row.querySelector(
    `[id$="-${String(columnKeys.get(label))}"]`,
  ) as HTMLElement;
}

export function focusCell(row: string, key: string) {
  act(() => {
    cell(row, key).focus();
  });
}

export function undone(fetch: ReturnType<typeof serverAnswers>): string[] {
  return fetch.mock.calls
    .filter(
      ([url, init]) => url.startsWith("/api/undo/") && init?.method === "POST",
    )
    .map(([url]) => url.slice("/api/undo/".length));
}

export async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

// The choices the open picker offers.
export async function offeredOptions(): Promise<string[]> {
  const options = await screen.findAllByRole("option");
  return options.map((option) => option.textContent);
}

export async function pick(name: string | RegExp) {
  await userEvent.click(await screen.findByRole("option", { name }));
}

// Pastes text into a cell, as from a spreadsheet.
export async function paste(target: HTMLElement, text: string) {
  act(() => {
    target.focus();
  });
  await userEvent.paste(text);
}

// The Draft menu above the table, opened once no other menu is.
export async function openDraftMenu() {
  await waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
  await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
  return screen.findByRole("menu");
}

export async function chooseInDraftMenu(item: string | RegExp) {
  await userEvent.click(
    within(await openDraftMenu()).getByRole("menuitem", { name: item }),
  );
}

// A draft made by a fictional editor.
export const draftOf = (draft: object) => ({
  changed: [],
  live: { values: {} },
  state: "waiting",
  madeBy: "Fictional Editor",
  madeAt: "2026-10-30T15:00:00.000Z",
  ...draft,
});

export const manySites = list(
  "l1",
  "Sites",
  [
    "Harbour",
    "Northmere",
    "Ashby",
    "Bramble",
    "Coldwater",
    "Dunmore",
    "Eastvale",
    "Fernhill",
    "Glenrock",
  ].map((label, index) =>
    choice(
      index === 0 ? "c1" : index === 1 ? "c2" : `s${String(index)}`,
      label,
    ),
  ),
);

export async function openAt(path: string, answers: Answers = {}) {
  const fetch = serverAnswers({
    "GET /api/session": editor,
    "GET /api/people": peopleAnswer,
    "GET /api/views/people": () => Response.json([]),
    "GET /api/lists": listsAnswer,
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("grid", { name: "People" });
  return { fetch, history };
}

// The names of the people shown, in order.
export const shownNames = () =>
  screen
    .getAllByRole("row")
    .filter(
      (row) =>
        row.querySelector('[id$="-preferredName"]') &&
        !row.getAttribute("aria-label"),
    )
    .map((row) => inRow(row, "Name").textContent);

// A column's header, whatever its sort and filter.
export const header = (label: string) =>
  screen.getByRole("button", {
    name: (name) => name.startsWith(`${label} column`),
  });

// Chooses an item from a column's menu, then waits for the menu to finish closing.
export async function choose(label: string, item: string | RegExp) {
  await userEvent.click(header(label));
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
  await waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
}

export const viewsButton = () =>
  screen.getByRole("button", { name: (name) => name.startsWith("Views") });

// Found by name, since a column's menu just used may still be closing.
export async function viewsMenu() {
  await userEvent.click(viewsButton());
  return screen.findByRole("menu", { name: /^Views/ });
}

export async function viewsMenuItems() {
  return within(await viewsMenu())
    .getAllByRole("menuitem")
    .map((item) => item.textContent);
}

// The Views menu's items, headings, and dividers, each divider as "—", to check how it is laid
// out.
export async function viewsMenuLayout() {
  const menu = await viewsMenu();
  return [
    ...menu.querySelectorAll(
      ".mantine-Menu-item, .mantine-Menu-label, .mantine-Menu-divider",
    ),
  ].map((part) =>
    part.classList.contains("mantine-Menu-divider") ? "—" : part.textContent,
  );
}

export async function chooseView(item: string | RegExp) {
  await userEvent.click(
    within(await viewsMenu()).getByRole("menuitem", { name: item }),
  );
  await waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
}

export const address = (history: ReturnType<typeof renderApp>) =>
  decodeURIComponent(history.location.search);

// The page opened on the rows given, for a role that changes people and planned hires.
export async function openPeopleWith(
  rows: readonly object[],
  more: Parameters<typeof serverAnswers>[0] = {},
) {
  const fetch = answers([...rows], { more });
  renderApp("/people");
  await screen.findByRole("grid", { name: "People" });
  return fetch;
}
