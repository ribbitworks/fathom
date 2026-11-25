// SPDX-License-Identifier: Apache-2.0

// Tests for a value the server refuses in People's New person form, against a simulated server: the
// reason under the field it is about, with focus in it.

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
