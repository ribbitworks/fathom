// SPDX-License-Identifier: Apache-2.0

// Tests for People's New person form, against a simulated server: Enter checking it as Add does, and
// a value the server refuses, with the reason under the field it is about and focus in it.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { positions, renderApp, serverAnswers } from "./test-support.tsx";
import { editor, peopleAnswer } from "./people-note-fixtures.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

// What a field's description and error under it say, as screen readers read them with it.
const saidUnder = (field: HTMLElement) =>
  (field.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

describe("a value refused in People's New person form", () => {
  it("names an Employee ID the server refuses under ID, with focus in it", async () => {
    const reason = "Someone already has that ID";
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": peopleAnswer(),
      "GET /api/lists": () => Response.json({ lists: [positions] }),
      "POST /api/people": () =>
        Response.json({ error: reason, field: "employeeId" }, { status: 409 }),
    });
    renderApp("/people");
    await userEvent.click(
      await screen.findByRole("button", { name: "New person" }),
    );
    const form = (
      await screen.findByRole("heading", { name: "New person" })
    ).closest("section, [role=dialog], aside, div[id]") as HTMLElement;
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Name" }),
      "Casey Fictional",
    );
    const id = within(form).getByRole<HTMLInputElement>("textbox", {
      name: "ID",
    });
    await userEvent.type(id, "E9");
    await userEvent.click(
      within(form).getByRole("button", { name: "Change Position" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Fictional Engineer" }),
    );
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(saidUnder(id)).toContain(reason);
    });
    expect([
      id.value,
      id.getAttribute("aria-invalid"),
      document.activeElement,
    ]).toEqual(["E9", "true", id]);
  });
});

describe("Enter in People's New person form", () => {
  it("checks the form as Add does, naming a value still needed and sending nothing", async () => {
    // Given a new person with Position still empty
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": peopleAnswer(),
      "GET /api/lists": () => Response.json({ lists: [positions] }),
    });
    renderApp("/people");
    await userEvent.click(
      await screen.findByRole("button", { name: "New person" }),
    );
    const name = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Name",
    });
    // When Enter is pressed in Name
    await userEvent.type(name, "Casey Fictional{Enter}");
    // Then Position is named as needed, and nothing is sent
    expect(await screen.findByText("Position needed")).toBeTruthy();
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toEqual([]);
  });
});
