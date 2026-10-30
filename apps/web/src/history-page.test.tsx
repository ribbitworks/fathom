// SPDX-License-Identifier: Apache-2.0

// Tests for the History page, with the server's responses simulated: who sees it, how each entry is
// put in words, and the messages while the history loads or when it cannot be loaded.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

const historyViewer = () =>
  Response.json({
    ...fictionalUser,
    roles: ["administrator"],
    permissions: ["accounts:manage", "history:view"],
  });

const admin = { id: "user-1", name: "Fictional Person" };
const subject = { id: "user-2", name: "Fictional Planner" };
const entries = [
  {
    id: 4,
    occurredAt: "2026-10-30T15:00:00.000Z",
    actor: admin,
    action: "roles-changed",
    subject,
    details: { previousRoles: ["viewer"], roles: [] },
  },
  {
    id: 3,
    occurredAt: "2026-10-30T14:00:00.000Z",
    actor: admin,
    action: "password-reset",
    subject: { id: "user-9", name: null },
    details: {},
  },
  {
    id: 1,
    occurredAt: "2026-10-30T12:00:00.000Z",
    actor: { id: "user-8", name: null },
    action: "future-action",
    subject,
    details: {},
  },
  {
    id: 2,
    occurredAt: "2026-10-30T13:00:00.000Z",
    actor: null,
    action: "account-created",
    subject,
    details: { roles: ["viewer", "project-planner"] },
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("who sees the History page", () => {
  it("links to it for users who may view the access history", async () => {
    serverAnswers({
      "GET /api/session": historyViewer,
      "GET /api/greeting": greeting,
      "GET /api/access-history": () => Response.json({ entries: [] }),
    });
    renderApp("/");
    await userEvent.click(await screen.findByRole("link", { name: "History" }));
    expect(
      await screen.findByRole("heading", { name: "Access history" }),
    ).toBeDefined();
  });

  it("neither links to it nor shows it to anyone else", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/history");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "History" })).toBeNull();
  });
});

describe("the entries", () => {
  it("say who did what to whose account, and which roles were involved", async () => {
    serverAnswers({
      "GET /api/session": historyViewer,
      "GET /api/access-history": () => Response.json({ entries }),
    });
    renderApp("/history");
    const rows = (await screen.findAllByRole("row")).slice(1);
    const cells = rows.map((row) =>
      within(row)
        .getAllByRole("cell")
        .slice(1)
        .map((cell) => cell.textContent),
    );
    expect(cells).toEqual([
      [
        "Fictional Person",
        "Changed the roles",
        "Fictional Planner",
        "From Viewer to no roles",
      ],
      ["Fictional Person", "Reset the password", "A removed account", ""],
      ["A removed account", "future-action", "Fictional Planner", ""],
      [
        "Fathom's operators",
        "Created the account",
        "Fictional Planner",
        "With Viewer, Project Planner",
      ],
    ]);
  });

  it("show a loading indicator until they arrive", async () => {
    serverAnswers({
      "GET /api/session": historyViewer,
      "GET /api/access-history": () => new Promise<Response>(() => undefined),
    });
    renderApp("/history");
    expect(await screen.findByLabelText("Loading")).toBeDefined();
  });

  it("are replaced by a message when they cannot be loaded", async () => {
    serverAnswers({
      "GET /api/session": historyViewer,
      "GET /api/access-history": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/history");
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not load the access history/,
    );
  });
});
