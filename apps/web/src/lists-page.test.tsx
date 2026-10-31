// SPDX-License-Identifier: Apache-2.0

// Tests for the Lists page, with the server's responses simulated: who sees it, the lists with who
// last changed each choice, and adding, renaming, and removing choices, including the server's
// refusals.

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

const viewer = () =>
  Response.json({
    ...fictionalUser,
    permissions: ["configuration:view", "plan:view"],
  });

const editor = () =>
  Response.json({
    ...fictionalUser,
    roles: ["viewer", "workforce-administrator"],
    permissions: ["configuration:edit", "configuration:view", "plan:view"],
  });

const stamp = (at: string, by: { id: string; name: string } | null) => ({
  by,
  at,
});

const harbour = {
  id: "item-1",
  label: "Harbour Site",
  description: "The fictional office by the water",
  created: stamp("2026-10-20T09:00:00.000Z", {
    id: "user-2",
    name: "Fictional Editor",
  }),
  changed: stamp("2026-10-21T09:00:00.000Z", {
    id: "user-2",
    name: "Fictional Editor",
  }),
};
const hillside = {
  id: "item-2",
  label: "Hillside Site",
  description: "",
  created: stamp("2026-10-22T09:00:00.000Z", null),
  changed: stamp("2026-10-22T09:00:00.000Z", null),
};
const engineer = {
  id: "item-3",
  label: "Fictional Engineer",
  description: "",
  created: stamp("2026-10-23T09:00:00.000Z", {
    id: "user-9",
    name: "Fictional Planner",
  }),
  changed: stamp("2026-10-23T09:00:00.000Z", {
    id: "user-9",
    name: "Fictional Planner",
  }),
};

const listsAnswer = () =>
  Response.json({
    lists: [
      { name: "sites", items: [harbour, hillside] },
      { name: "positions", items: [engineer] },
      { name: "levels", items: [] },
      { name: "team-roles", items: [] },
    ],
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

function panel(title: string) {
  return screen.findByRole("region", { name: title });
}

describe("who sees the Lists page", () => {
  it("links to it for users who may see planning configuration", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/greeting": greeting,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/");
    await userEvent.click(await screen.findByRole("link", { name: "Lists" }));
    expect(await screen.findByRole("heading", { name: "Lists" })).toBeDefined();
  });

  it("is not linked or shown for anyone else", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    const history = renderApp("/");
    expect(await screen.findByText("Hello, Fathom")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Lists" })).toBeNull();
    history.push("/lists");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});

describe("the lists", () => {
  it("shows every list with its choices, and who last changed each and when", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists");
    const sites = await panel("Sites");
    const changed = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
    const harbourRow = within(sites).getByText("Harbour Site").closest("tr");
    expect(harbourRow?.textContent).toContain(
      "The fictional office by the water",
    );
    expect(harbourRow?.textContent).toContain(
      `${changed.format(new Date(harbour.changed.at))}, Fictional Editor`,
    );
    expect(
      within(sites).getByText("Hillside Site").closest("tr")?.textContent,
    ).toContain(", Fathom");
    expect(
      within(await panel("Positions"))
        .getByText("Fictional Engineer")
        .closest("tr")?.textContent,
    ).toContain(", Fictional Planner");
    expect(
      within(await panel("Levels")).getByText("No choices yet."),
    ).toBeDefined();
    expect(
      within(await panel("Roles on the team")).getByText("No choices yet."),
    ).toBeDefined();
  });

  it("offers no changes to users who may not edit them", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists");
    await screen.findByText("Harbour Site");
    expect(screen.queryByRole("button", { name: /^Add to/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
  });

  it("shows a loading indicator until the lists arrive", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () => new Promise<Response>(() => undefined),
    });
    renderApp("/lists");
    expect(await screen.findByLabelText("Loading")).toBeDefined();
  });

  it("shows a message when the lists cannot be loaded", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/lists");
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not load the lists/,
    );
  });
});

describe("changing the lists", () => {
  it("adds a choice and says so", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "POST /api/lists/levels/items": () =>
        Response.json(
          { item: { ...hillside, id: "item-4", label: "Fictional P1" } },
          { status: 201 },
        ),
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "Add to Levels" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Add to Levels" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Fictional P1");
    await userEvent.type(
      within(dialog).getByLabelText(/^Description/),
      "A fictional first level",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByRole("status").textContent).toBe(
      "Added Fictional P1 to Levels.",
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/lists/levels/items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          label: "Fictional P1",
          description: "A fictional first level",
        }),
      }),
    );
  });

  it("asks for a description of at most 500 characters", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "Add to Sites" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Site",
    );
    await userEvent.click(within(dialog).getByLabelText(/^Description/));
    await userEvent.paste("x".repeat(501));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(
      await within(dialog).findByText("Use up to 500 characters."),
    ).toBeDefined();
  });

  it("asks for a name", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "Add to Sites" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "   ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(
      await within(dialog).findByText("Enter a name of up to 100 characters."),
    ).toBeDefined();
  });

  it("shows the server's message when it refuses, and stays open", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "POST /api/lists/sites/items": () =>
        Response.json(
          { error: "This list already has that choice" },
          { status: 409 },
        ),
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "Add to Sites" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "harbour site");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "This list already has that choice",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("edits a choice, starting from its current name and description", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "PUT /api/lists/sites/items/item-1": () =>
        Response.json({ item: { ...harbour, label: "Harbour Campus" } }),
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for Harbour Site" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Edit" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Edit Harbour Site",
    });
    const name = within(dialog).getByLabelText("Name");
    expect((name as HTMLInputElement).value).toBe("Harbour Site");
    expect(
      within(dialog).getByLabelText<HTMLTextAreaElement>(/^Description/).value,
    ).toBe("The fictional office by the water");
    await userEvent.clear(name);
    await userEvent.type(name, "Harbour Campus");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByRole("status").textContent).toBe(
      "Saved Harbour Campus.",
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/lists/sites/items/item-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          label: "Harbour Campus",
          description: "The fictional office by the water",
        }),
      }),
    );
  });

  it("removes a choice once confirmed", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "DELETE /api/lists/positions/items/item-3": () =>
        new Response(null, { status: 204 }),
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Fictional Engineer",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Remove Fictional Engineer",
    });
    expect(dialog.textContent).toContain("change history keeps a record");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Remove" }),
    );
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByRole("status").textContent).toBe(
      "Removed Fictional Engineer from Positions.",
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/lists/positions/items/item-3",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shows why a removal was refused", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "DELETE /api/lists/sites/items/item-1": () =>
        Response.json({ error: "There is no such choice" }, { status: 404 }),
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for Harbour Site" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Remove" }),
    );
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "There is no such choice",
    );
  });

  it("closes with Escape when nothing is being saved", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "Add to Sites" }),
    );
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("cannot be closed while a change is being saved", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "POST /api/lists/sites/items": () =>
        new Promise<Response>(() => undefined),
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "Add to Sites" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Site",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await vi.waitFor(() => {
      expect(
        within(dialog).getByRole<HTMLButtonElement>("button", {
          name: "Cancel",
        }).disabled,
      ).toBe(true);
    });
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});
