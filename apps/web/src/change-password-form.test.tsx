// SPDX-License-Identifier: Apache-2.0

// Tests for users changing their own password, with the server's responses simulated: in the
// Change password dialog, with the checklist of what a new password must meet, and on the page that
// changes a generated password before anything else.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generated } from "./test-accounts-page.tsx";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
  signedOut,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

// Each requirement in the checklist under New password, as a screen reader reads it, with its
// state: met, pending (not met, while typing), or unmet (not met, shown in red).
const checklist = (container: HTMLElement) =>
  within(container)
    .getAllByRole("listitem")
    .map((item) => [item.textContent, item.dataset.state]);

describe("changing one's own password", () => {
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

  async function changePassword(
    dialog: HTMLElement,
    current: string,
    next: string,
    repeated = next,
  ) {
    await userEvent.type(
      within(dialog).getByLabelText("Current password"),
      current,
    );
    await userEvent.type(within(dialog).getByLabelText("New password"), next);
    await userEvent.type(
      within(dialog).getByLabelText("New password again"),
      repeated,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change password" }),
    );
  }

  it("is offered to every user, and confirms the change like other changes", async () => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () => Response.json({}),
    });
    renderApp("/");
    await changePassword(
      await openDialog(),
      "fictional password 1",
      "fictional password 2",
    );
    expect(
      await screen.findByText(
        "The password has been changed, and every other session has been signed out.",
      ),
    ).toBeDefined();
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Change password" }),
      ).toBeNull();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.objectContaining({
        body: JSON.stringify({
          currentPassword: "fictional password 1",
          newPassword: "fictional password 2",
        }),
      }),
    );
  });

  it("asks for the new password twice, the same each time", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 2",
      "different",
    );
    expect(
      await within(dialog).findByText("The new passwords do not match."),
    ).toBeDefined();
  });

  it("shows the rules from the start, and asks for the current password and a long enough new one", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    expect(checklist(dialog)).toEqual([
      ["12 to 128 characters (not met)", "pending"],
      ["Not a common or easily guessed password (not met)", "pending"],
    ]);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change password" }),
    );
    expect(
      await within(dialog).findByText("Enter the current password."),
    ).toBeDefined();
    expect(
      within(dialog).getByText(
        "The password must have at least 12 characters.",
      ),
    ).toBeDefined();
  });

  it("follows the rules in the password settings, saying what a new password lacks", async () => {
    const fetch = serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          settings: {
            ...fictionalUser.settings,
            passwords: {
              ...fictionalUser.settings.passwords,
              rules: {
                minimumLength: 14,
                uppercase: true,
                lowercase: false,
                digits: false,
                symbols: true,
              },
            },
          },
        }),
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    expect(checklist(dialog).map(([text]) => text)).toEqual([
      "14 to 128 characters (not met)",
      "An uppercase letter (not met)",
      "A symbol (not met)",
      "Not a common or easily guessed password (not met)",
    ]);
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 2",
    );
    expect(
      await within(dialog).findByText(
        "The password must include an uppercase letter and a symbol.",
      ),
    ).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.anything(),
    );
  });

  it("puts the server's refusal of a new password plainly", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () =>
        Response.json(
          { error: "The password must include a symbol." },
          { status: 400 },
        ),
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 2",
    );
    expect(
      await within(dialog).findByText("The password must include a symbol."),
    ).toBeDefined();
  });

  it("asks for a new password that differs from the current one", async () => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 1",
    );
    expect(
      await within(dialog).findByText(
        "The new password must differ from the current password.",
      ),
    ).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.anything(),
    );
  });

  it("names a wrong current password beside it, keeping the dialog open", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () =>
        Response.json({ code: "INVALID_PASSWORD" }, { status: 400 }),
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(dialog, "not the password", "fictional password 2");
    expect(
      await within(dialog).findByText("The current password is not right."),
    ).toBeDefined();
    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(document.activeElement).toBe(
      within(dialog).getByLabelText("Current password"),
    );
  });

  it("starts afresh when opened again", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () =>
        Response.json({ code: "INVALID_PASSWORD" }, { status: 400 }),
    });
    renderApp("/");
    const first = await openDialog();
    await changePassword(first, "not the password", "fictional password 2");
    await within(first).findByText("The current password is not right.");
    await userEvent.click(
      within(first).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Change password" }),
      ).toBeNull();
    });
    const dialog = await openDialog();
    for (const label of [
      "Current password",
      "New password",
      "New password again",
    ]) {
      expect(within(dialog).getByLabelText<HTMLInputElement>(label).value).toBe(
        "",
      );
    }
    expect(
      within(dialog).queryByText("The current password is not right."),
    ).toBeNull();
  });

  it("stays open while the change is being saved", async () => {
    let answer: (response: Response) => void = () => undefined;
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 2",
    );
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByRole("dialog", { name: "Change password" }),
    ).toBeDefined();
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    answer(Response.json({}));
    expect(
      await screen.findByText(
        "The password has been changed, and every other session has been signed out.",
      ),
    ).toBeDefined();
  });

  it("explains another refusal plainly", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () =>
        Response.json({ error: "Fictional" }, { status: 500 }),
    });
    renderApp("/");
    const dialog = await openDialog();
    await changePassword(
      dialog,
      "fictional password 1",
      "fictional password 2",
    );
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "Fathom could not make this change. Try again in a moment.",
    );
  });
});

describe("the checklist for a new password", () => {
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

  const withAllRules = () =>
    Response.json({
      ...fictionalUser,
      settings: {
        ...fictionalUser.settings,
        passwords: {
          ...fictionalUser.settings.passwords,
          rules: {
            minimumLength: 14,
            uppercase: true,
            lowercase: true,
            digits: true,
            symbols: true,
          },
        },
      },
    });

  it("marks each requirement met as it is typed, and leaves the others neutral", async () => {
    serverAnswers({ "GET /api/session": withAllRules });
    renderApp("/");
    const dialog = await openDialog();
    const field = within(dialog).getByLabelText("New password");
    await userEvent.type(field, "a1");
    expect(checklist(dialog)).toEqual([
      ["14 to 128 characters (not met)", "pending"],
      ["An uppercase letter (not met)", "pending"],
      ["A lowercase letter (met)", "met"],
      ["A digit (met)", "met"],
      ["A symbol (not met)", "pending"],
      ["Not a common or easily guessed password (not met)", "pending"],
    ]);
    await userEvent.clear(field);
    await userEvent.type(field, "Correct-horse-91");
    await waitFor(() => {
      expect(checklist(dialog).every(([, state]) => state === "met")).toBe(
        true,
      );
    });
    expect(checklist(dialog).map(([text]) => text)).toEqual([
      "14 to 128 characters (met)",
      "An uppercase letter (met)",
      "A lowercase letter (met)",
      "A digit (met)",
      "A symbol (met)",
      "Not a common or easily guessed password (met)",
    ]);
  });

  it("is read with the field, and turns what is not met red only once the field is left", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    const field = within(dialog).getByLabelText("New password");
    const list = within(dialog).getByRole("list");
    expect(field.getAttribute("aria-describedby")).toContain(
      list.parentElement?.id,
    );
    await userEvent.type(field, "test1234");
    expect(checklist(dialog)).toEqual([
      ["12 to 128 characters (not met)", "pending"],
      ["Not a common or easily guessed password (not met)", "pending"],
    ]);
    await userEvent.tab();
    expect(checklist(dialog)).toEqual([
      ["12 to 128 characters (not met)", "unmet"],
      ["Not a common or easily guessed password (not met)", "unmet"],
    ]);
  });

  it("turns what is not met red once the form is sent, though the field is not left", async () => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.type(
      within(dialog).getByLabelText("New password"),
      "short{Enter}",
    );
    await waitFor(() => {
      expect(checklist(dialog)).toEqual([
        ["12 to 128 characters (not met)", "unmet"],
        ["Not a common or easily guessed password (not met)", "unmet"],
      ]);
    });
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.anything(),
    );
  });

  it.each([
    ["a common password", "test12345678"],
    ["a password built from the person's own name", "Fictional2026!"],
  ])("refuses %s before sending it", async (_, password) => {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    const dialog = await openDialog();
    await userEvent.type(
      within(dialog).getByLabelText("Current password"),
      "fictional password 1",
    );
    const field = within(dialog).getByLabelText("New password");
    // A strong password first, so the check has loaded before the one tried is sent.
    await userEvent.type(field, "Correct-horse-91");
    await waitFor(() => {
      expect(checklist(dialog).at(-1)?.[1]).toBe("met");
    });
    await userEvent.clear(field);
    await userEvent.type(field, password);
    expect(checklist(dialog).at(-1)).toEqual([
      "Not a common or easily guessed password (not met)",
      "pending",
    ]);
    await userEvent.type(
      within(dialog).getByLabelText("New password again"),
      password,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change password" }),
    );
    expect(
      await within(dialog).findByText(
        "This password is too common or easy to guess.",
      ),
    ).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.anything(),
    );
  });
});

describe("changing a generated password first", () => {
  const mustChange = () =>
    Response.json({ ...fictionalUser, mustChangePassword: true });

  async function change(current: string, next: string) {
    await userEvent.type(
      await screen.findByLabelText("Current password"),
      current,
    );
    await userEvent.type(screen.getByLabelText("New password"), next);
    await userEvent.type(screen.getByLabelText("New password again"), next);
    await userEvent.click(
      screen.getByRole("button", { name: "Change password" }),
    );
  }

  it("shows only the page that changes it, at the start page's address, whatever page was asked for", async () => {
    serverAnswers({ "GET /api/session": mustChange });
    const history = renderApp("/people");
    expect(
      await screen.findByRole("heading", { name: "Change password" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Fathom generated this password. A new password is required to continue.",
      ),
    ).toBeDefined();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Account, Fictional Person" }),
    ).toBeNull();
    expect(history.location.pathname).toBe("/");
  });

  it("shows the rules in the password settings from the start", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          mustChangePassword: true,
          settings: {
            ...fictionalUser.settings,
            passwords: {
              ...fictionalUser.settings.passwords,
              rules: {
                minimumLength: 16,
                uppercase: false,
                lowercase: false,
                digits: true,
                symbols: false,
              },
            },
          },
        }),
    });
    renderApp("/");
    await screen.findByLabelText("New password");
    expect(checklist(document.body).map(([text]) => text)).toEqual([
      "16 to 128 characters (not met)",
      "A digit (not met)",
      "Not a common or easily guessed password (not met)",
    ]);
    await change(generated, "fictional 2");
    expect(
      await screen.findByText("The password must have at least 16 characters."),
    ).toBeDefined();
  });

  it("opens Fathom once the password is changed", async () => {
    let session = mustChange;
    const fetch = serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/greeting": greeting,
      "POST /api/auth/change-password": () => {
        session = signedIn;
        return Response.json({});
      },
    });
    renderApp("/");
    await change(generated, "fictional password 2");
    expect(
      await screen.findByRole("button", {
        name: "Account, Fictional Person",
      }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "The password has been changed, and every other session has been signed out.",
      ),
    ).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.objectContaining({
        body: JSON.stringify({
          currentPassword: generated,
          newPassword: "fictional password 2",
        }),
      }),
    );
  });

  it("refuses the same password again, and names a wrong current one", async () => {
    serverAnswers({
      "GET /api/session": mustChange,
      "POST /api/auth/change-password": () =>
        Response.json({ code: "INVALID_PASSWORD" }, { status: 400 }),
    });
    renderApp("/");
    await change(generated, generated);
    expect(
      await screen.findByText(
        "The new password must differ from the current password.",
      ),
    ).toBeDefined();
    await userEvent.clear(screen.getByLabelText("Current password"));
    await userEvent.type(
      screen.getByLabelText("Current password"),
      "not the password",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Change password" }),
    );
    expect(
      await screen.findByText("The current password is not right."),
    ).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the change fails", async () => {
    serverAnswers({
      "GET /api/session": mustChange,
      "POST /api/auth/change-password": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/");
    await change(generated, "fictional password 2");
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Fathom could not change the password. Try again in a moment.",
    );
  });

  it("signs out", async () => {
    let session = mustChange;
    serverAnswers({
      "GET /api/session": () => session(),
      "POST /api/auth/sign-out": () => {
        session = signedOut;
        return Response.json({ success: true });
      },
    });
    const history = renderApp("/");
    await userEvent.click(
      await screen.findByRole("button", { name: "Sign out" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/sign-in");
  });

  it("says when signing out fails", async () => {
    serverAnswers({
      "GET /api/session": mustChange,
      "POST /api/auth/sign-out": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/");
    await userEvent.click(
      await screen.findByRole("button", { name: "Sign out" }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Fathom could not sign out. Try again in a moment.",
    );
  });
});
