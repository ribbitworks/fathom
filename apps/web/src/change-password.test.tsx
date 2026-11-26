// SPDX-License-Identifier: Apache-2.0

// Tests for the Change password dialog before the check for guessable passwords has loaded, or when
// it cannot load: the checklist does not mark that requirement met, and the form leaves the check
// to the server, whose refusal it shows.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderApp, serverAnswers, signedIn } from "./test-support.tsx";

vi.mock("./guessable.ts", () => ({ useGuessableCheck: () => undefined }));

async function openDialog(): Promise<HTMLElement> {
  await userEvent.click(
    await screen.findByRole("button", {
      name: "Account, Fictional Person",
    }),
  );
  await userEvent.click(
    await screen.findByRole("menuitem", { name: "Change password…" }),
  );
  return screen.findByRole("dialog", { name: "Change password" });
}

describe("before the check for guessable passwords has loaded", () => {
  it("does not mark that requirement met, and leaves the check to the server", async () => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "POST /api/auth/change-password": () =>
        Response.json(
          { error: "This password is too common or easy to guess." },
          { status: 400 },
        ),
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.type(
      within(dialog).getByLabelText("Current password"),
      "fictional password 1",
    );
    await userEvent.type(
      within(dialog).getByLabelText("New password"),
      "test12345678",
    );
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "12 to 128 characters (met)",
      "Not a common or easily guessed password (not met)",
    ]);
    await userEvent.type(
      within(dialog).getByLabelText("New password again"),
      "test12345678",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change password" }),
    );
    expect(
      await within(dialog).findByText(
        "This password is too common or easy to guess.",
      ),
    ).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.anything(),
    );
  });
});
