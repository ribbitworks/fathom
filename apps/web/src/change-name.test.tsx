// SPDX-License-Identifier: Apache-2.0

// Tests for the Change name dialog, in which users change the name their own account shows, with
// the server's responses simulated.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("changing one's own name", () => {
  async function openDialog(): Promise<HTMLElement> {
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Account, Fictional Person",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Change name…" }),
    );
    return screen.findByRole("dialog", { name: "Change name" });
  }

  it("is offered to every user, starts from their name, and confirms the change like other changes", async () => {
    let session = signedIn;
    const fetch = serverAnswers({
      "GET /api/session": () => session(),
      "PUT /api/account/name": () => {
        session = () =>
          Response.json({
            ...fictionalUser,
            user: { ...fictionalUser.user, name: "Fictional Renamed" },
          });
        return new Response(null, { status: 204 });
      },
    });
    renderApp("/");
    const dialog = await openDialog();
    const name = within(dialog).getByLabelText("Name");
    expect((name as HTMLInputElement).value).toBe("Fictional Person");
    await userEvent.clear(name);
    await userEvent.type(name, "Fictional Renamed");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("The name has been changed.")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Change name" })).toBeNull();
    });
    expect(
      await screen.findByRole("button", {
        name: "Account, Fictional Renamed",
      }),
    ).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/account/name",
      expect.objectContaining({
        body: JSON.stringify({ name: "Fictional Renamed" }),
      }),
    );
  });

  it("asks for a name", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.clear(within(dialog).getByLabelText("Name"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Name needed")).toBeDefined();
  });

  it("names the rule a name breaks", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
    });
    renderApp("/");
    const dialog = await openDialog();
    const name = within(dialog).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "n".repeat(101));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await within(dialog).findByText("Use at most 100 characters."),
    ).toBeDefined();
  });

  it("explains a refusal plainly, keeping the dialog open", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "PUT /api/account/name": () =>
        Response.json(
          { error: "Another account has that name" },
          { status: 409 },
        ),
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "Another account has that name",
    );
  });

  it("stays open while the change is being saved", async () => {
    let answer: (response: Response) => void = () => undefined;
    serverAnswers({
      "GET /api/session": signedIn,
      "PUT /api/account/name": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Change name" })).toBeDefined();
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    answer(new Response(null, { status: 204 }));
    expect(await screen.findByText("The name has been changed.")).toBeDefined();
  });

  it("closes without saving on Cancel", async () => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Change name" })).toBeNull();
    });
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/account/name",
      expect.anything(),
    );
  });
});
