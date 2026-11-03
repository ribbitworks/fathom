// SPDX-License-Identifier: Apache-2.0

// Tests for the History page, with the server's responses simulated: who sees it, how each entry is
// put in words, and the messages while the history loads or when it cannot be loaded.

import { screen } from "@testing-library/react";
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
    await userEvent.click(
      await screen.findByRole("link", { name: "Access history" }),
    );
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
    expect(screen.queryByRole("link", { name: "Access history" })).toBeNull();
  });
});

describe("the entries", () => {
  it("say who viewed people's Restricted details, and whose they changed, by name", async () => {
    serverAnswers({
      "GET /api/session": historyViewer,
      "GET /api/access-history": () =>
        Response.json({
          entries: [
            {
              id: 7,
              occurredAt: "2026-10-30T17:00:00.000Z",
              actor: admin,
              action: "restricted-changed",
              subject: { id: "p1", name: "Avery Fictional" },
              details: {},
            },
            {
              id: 6,
              occurredAt: "2026-10-30T16:30:00.000Z",
              actor: admin,
              action: "restricted-changed",
              subject: { id: "p2", name: null },
              details: {},
            },
            {
              id: 5,
              occurredAt: "2026-10-30T16:00:00.000Z",
              actor: admin,
              action: "restricted-viewed",
              subject: null,
              details: {},
            },
          ],
        }),
    });
    renderApp("/history");
    const lines = (await screen.findAllByRole("listitem")).map((item) =>
      item.textContent.slice(
        String(item.querySelector("time")?.textContent).length,
      ),
    );
    expect(lines).toEqual([
      "Fictional Person changed the Restricted or Confidential details of Avery Fictional",
      "Fictional Person changed the Restricted or Confidential details of a person",
      "Fictional Person viewed people's Restricted or Confidential details",
    ]);
  });

  it("say who did what to whose account, and which roles were involved", async () => {
    serverAnswers({
      "GET /api/session": historyViewer,
      "GET /api/access-history": () => Response.json({ entries }),
    });
    renderApp("/history");
    // Each entry's sentence, without its time, whose format depends on the computer's settings.
    const lines = (await screen.findAllByRole("listitem")).map((item) =>
      item.textContent.slice(
        String(item.querySelector("time")?.textContent).length,
      ),
    );
    expect(lines).toEqual([
      "Fictional Person changed the roles of Fictional Planner: from Viewer to no roles",
      "Worth checking: Fictional Person reset the password for A removed account",
      "A removed account future-action: Fictional Planner",
      "Fathom's operators created the account for Fictional Planner: with Viewer, Project Planner",
    ]);
  });

  it("say whose name or email address changed, without the values", async () => {
    serverAnswers({
      "GET /api/session": historyViewer,
      "GET /api/access-history": () =>
        Response.json({
          entries: [
            {
              id: 9,
              occurredAt: "2026-10-30T19:00:00.000Z",
              actor: admin,
              action: "email-changed",
              subject,
              details: {},
            },
            {
              id: 8,
              occurredAt: "2026-10-30T18:00:00.000Z",
              actor: admin,
              action: "name-changed",
              subject,
              details: {},
            },
          ],
        }),
    });
    renderApp("/history");
    const lines = (await screen.findAllByRole("listitem")).map((item) =>
      item.textContent.slice(
        String(item.querySelector("time")?.textContent).length,
      ),
    );
    expect(lines).toEqual([
      "Fictional Person changed the email address of Fictional Planner",
      "Fictional Person changed the name of Fictional Planner",
    ]);
  });

  it("show each entry's date, with its year, and time, in the time zone the tests fix", async () => {
    serverAnswers({
      "GET /api/session": historyViewer,
      "GET /api/access-history": () =>
        Response.json({
          entries: [
            { ...entries[0], id: 6, occurredAt: "2026-10-30T00:30:00.000Z" },
          ],
        }),
    });
    renderApp("/history");
    await screen.findAllByRole("listitem");
    const [time] = [...document.querySelectorAll("time")];
    expect(time?.dateTime).toBe("2026-10-30T00:30:00.000Z");
    expect(time?.textContent).toMatch(/2026/);
  });

  it("are searched for every word typed, in the words each entry shows", async () => {
    serverAnswers({
      "GET /api/session": historyViewer,
      "GET /api/access-history": () => Response.json({ entries }),
    });
    const history = renderApp("/history?search=planner%20viewer");
    expect(
      (await screen.findAllByRole("listitem")).map((item) =>
        item.textContent.slice(
          String(item.querySelector("time")?.textContent).length,
        ),
      ),
    ).toEqual([
      "Fictional Person changed the roles of Fictional Planner: from Viewer to no roles",
      "Fathom's operators created the account for Fictional Planner: with Viewer, Project Planner",
    ]);
    const field = screen.getByRole("textbox", {
      name: "Search access history",
    });
    await userEvent.clear(field);
    await userEvent.type(field, "nobody");
    expect(
      await screen.findByText("No entries match the search."),
    ).toBeDefined();
    expect(history.location.search).toBe("?search=nobody");
  });

  it("mark changes worth checking in words, not only by colour", async () => {
    serverAnswers({
      "GET /api/session": historyViewer,
      "GET /api/access-history": () => Response.json({ entries }),
    });
    renderApp("/history");
    expect(await screen.findAllByText("Worth checking:")).toHaveLength(1);
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
