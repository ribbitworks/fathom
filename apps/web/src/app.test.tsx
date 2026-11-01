// SPDX-License-Identifier: Apache-2.0

// Tests for Fathom's front end, with the server's responses simulated: signing in, being sent to
// sign in and brought back, including when a session ends, signing out, the greeting on the home
// page, and the pages and messages shown when something goes wrong.

import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
  signedOut,
} from "./test-support.tsx";

async function fillIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Email address"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

// An administrator with only the Administrator role, granted what the server grants it.
const administratorOnly = () =>
  Response.json({
    ...fictionalUser,
    roles: ["administrator"],
    permissions: ["accounts:manage", "history:view"],
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("home page", () => {
  it("shows the greeting and who is signed in", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    expect(await screen.findByText("Hello, Fathom")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Your account, Fictional Person" }),
    ).toBeDefined();
  });

  it("shows a loading indicator until the greeting arrives", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": () => new Promise<Response>(() => undefined),
    });
    renderApp("/");
    expect(await screen.findByLabelText("Loading")).toBeDefined();
  });

  it("says so when the server refuses the greeting, rather than that it could not be reached", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": () =>
        Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    renderApp("/");
    expect((await screen.findByRole("alert")).textContent).toBe(
      "You do not have permission to do this. Your roles may have changed.",
    );
  });

  it("sends an administrator who may not see the plan to the first page their roles open", async () => {
    serverAnswers({
      "GET /api/session": administratorOnly,
      "GET /api/accounts": () => Response.json({ accounts: [] }),
    });
    const history = renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Accounts" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/accounts");
  });

  it("sends someone who may only see the access history there", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          roles: [],
          permissions: ["history:view"],
        }),
      "GET /api/access-history": () => Response.json({ entries: [] }),
    });
    const history = renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Access history" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/history");
  });

  it("brings an administrator who may not see the plan to their first page after signing in", async () => {
    let session = signedOut;
    serverAnswers({
      "GET /api/session": () => session(),
      "POST /api/auth/sign-in/email": () => {
        session = administratorOnly;
        return Response.json({});
      },
      "GET /api/accounts": () => Response.json({ accounts: [] }),
    });
    const history = renderApp("/sign-in?redirect=/");
    await fillIn("person@example.test", "fictional password 1");
    expect(
      await screen.findByRole("heading", { name: "Accounts" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/accounts");
  });

  it("sends someone whose roles open no page to Help's Roles page", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({ ...fictionalUser, roles: [], permissions: [] }),
    });
    const history = renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Roles", level: 1 }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/help/roles");
  });

  it("shows a plain message when the server fails", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/");
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not reach its server/,
    );
  });
});

describe("signing in", () => {
  it("sends someone who is not signed in to sign in, then back to the page they wanted", async () => {
    let session = signedOut;
    const fetch = serverAnswers({
      "GET /api/session": () => session(),
      "POST /api/auth/sign-in/email": () => {
        session = signedIn;
        return Response.json({});
      },
      "GET /api/greeting": greeting,
    });
    const history = renderApp("/?tab=fictional");
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    await fillIn("person@example.test", "fictional password 1");
    expect(await screen.findByText("Hello, Fathom")).toBeDefined();
    expect(history.location.href).toBe("/?tab=fictional");
    expect(fetch).toHaveBeenCalledWith("/api/auth/sign-in/email", {
      method: "POST",
      headers: expect.objectContaining({
        "content-type": "application/json",
      }) as unknown,
      body: JSON.stringify({
        email: "person@example.test",
        password: "fictional password 1",
      }),
    });
  });

  it("goes to the home page after signing in, when no page was asked for", async () => {
    let session = signedOut;
    serverAnswers({
      "GET /api/session": () => session(),
      "POST /api/auth/sign-in/email": () => {
        session = signedIn;
        return Response.json({});
      },
      "GET /api/greeting": greeting,
    });
    const history = renderApp("/sign-in");
    await fillIn("person@example.test", "fictional password 1");
    expect(await screen.findByText("Hello, Fathom")).toBeDefined();
    expect(history.location.pathname).toBe("/");
  });

  it("asks for a valid email address and a password before sending anything", async () => {
    const fetch = serverAnswers({ "GET /api/session": signedOut });
    renderApp("/sign-in");
    await fillIn("not an address", "");
    expect(await screen.findByText("Enter your email address.")).toBeDefined();
    expect(screen.getByText("Enter your password.")).toBeDefined();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/auth/sign-in/email",
      expect.anything(),
    );
  });

  it.each([
    [401, "That email address and password do not match an account."],
    [429, "Too many attempts. Wait a minute, then try again."],
    [500, "Fathom could not reach its server. Try again in a moment."],
  ])("explains a refusal with status %i plainly", async (status, message) => {
    serverAnswers({
      "GET /api/session": signedOut,
      "POST /api/auth/sign-in/email": () =>
        Response.json({ error: "Fictional" }, { status }),
    });
    renderApp("/sign-in");
    await fillIn("person@example.test", "not the password");
    expect((await screen.findByRole("alert")).textContent).toBe(message);
  });
});

async function signOutFromMenu() {
  await userEvent.click(
    await screen.findByRole("button", {
      name: "Your account, Fictional Person",
    }),
  );
  await userEvent.click(
    await screen.findByRole("menuitem", { name: "Sign out" }),
  );
}

describe("signing out", () => {
  it("ends the session and returns to the sign-in page", async () => {
    let session = signedIn;
    const fetch = serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/greeting": greeting,
      "POST /api/auth/sign-out": () => {
        session = signedOut;
        return Response.json({ success: true });
      },
    });
    const history = renderApp("/");
    await signOutFromMenu();
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/sign-in");
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/sign-out",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("says so when signing out fails, and stays signed in", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
      "POST /api/auth/sign-out": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/");
    await signOutFromMenu();
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not sign you out/,
    );
    expect(
      screen.getByRole("button", { name: "Your account, Fictional Person" }),
    ).toBeDefined();
  });
});

describe("when something goes wrong", () => {
  it("says when the server cannot be reached, and tries again on request", async () => {
    let session = () =>
      Response.json({ error: "Internal Server Error" }, { status: 500 });
    serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/greeting": greeting,
    });
    renderApp("/");
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Fathom could not reach its server.",
    );
    session = signedIn;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Hello, Fathom")).toBeDefined();
  });

  it("says when an address names no page, with a way home", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    const history = renderApp("/no-such-page");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("link", { name: "Go to Fathom's start page" }),
    );
    expect(await screen.findByText("Hello, Fathom")).toBeDefined();
    expect(history.location.pathname).toBe("/");
  });

  it("ignores a page to return to that is not text", async () => {
    let session = signedOut;
    serverAnswers({
      "GET /api/session": () => session(),
      "POST /api/auth/sign-in/email": () => {
        session = signedIn;
        return Response.json({});
      },
      "GET /api/greeting": greeting,
    });
    const history = renderApp("/sign-in?redirect=123");
    await fillIn("person@example.test", "fictional password 1");
    expect(await screen.findByText("Hello, Fathom")).toBeDefined();
    expect(history.location.pathname).toBe("/");
  });

  it("sends someone whose session has ended to sign in, then back", async () => {
    let session = signedIn;
    serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/greeting": () => {
        session = signedOut;
        return signedOut();
      },
    });
    const history = renderApp("/?tab=fictional");
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/sign-in");
    expect(history.location.search).toContain("tab%3Dfictional");
  });
});
