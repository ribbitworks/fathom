// SPDX-License-Identifier: Apache-2.0

// Tests for Fathom's front end, with the server's responses simulated: signing in, being sent to
// sign in and brought back, including when a session ends, signing out, by choice or after a time
// without use, the Overview every role opens on, and the pages and messages shown when something
// goes wrong.

import { act, fireEvent, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  overviewGreeting,
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
    role: {
      ...fictionalUser.role,
      key: "administrator",
      name: "Administrator",
    },
    permissions: ["administration:view", "administration:edit"],
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("home page", () => {
  it("greets the person by name, with the role they act as, and shows who is signed in", async () => {
    serverAnswers({ "GET /api/session": signedIn });
    renderApp("/");
    expect((await screen.findByText(overviewGreeting)).textContent).toMatch(
      /, Fictional Person$/u,
    );
    expect(screen.getByText("Acting as Team Member")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Account, Fictional Person" }),
    ).toBeDefined();
  });

  it("opens on the Overview for an administrator, who may not see the plan, with their jobs", async () => {
    serverAnswers({ "GET /api/session": administratorOnly });
    const history = renderApp("/");
    const jobs = await screen.findByRole("region", { name: "Jobs" });
    expect(
      within(jobs)
        .getAllByRole("heading", { level: 2 })
        .map(({ textContent }) => textContent),
    ).toEqual(["Administration", "History"]);
    expect(
      within(jobs).getByRole("button", { name: "Look After Accounts" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/");
  });

  it("brings an administrator back to the Overview after signing in", async () => {
    let session = signedOut;
    serverAnswers({
      "GET /api/session": () => session(),
      "POST /api/auth/sign-in/email": () => {
        session = administratorOnly;
        return Response.json({});
      },
    });
    const history = renderApp("/sign-in?redirect=/");
    await fillIn("person@example.test", "fictional password 1");
    expect(await screen.findByText(overviewGreeting)).toBeDefined();
    expect(history.location.pathname).toBe("/");
  });

  it("greets someone whose role allows no job, saying it has none", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({ ...fictionalUser, role: null, permissions: [] }),
    });
    renderApp("/");
    expect(await screen.findByText(overviewGreeting)).toBeDefined();
    expect(
      within(screen.getByRole("region", { name: "Jobs" })).getByText("No jobs"),
    ).toBeDefined();
  });

  it("shows a plain message when the server fails", async () => {
    serverAnswers({
      "GET /api/session": administratorOnly,
      "GET /api/accounts": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/accounts");
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not load the accounts/,
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
    });
    const history = renderApp("/?tab=fictional");
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    await fillIn("person@example.test", "fictional password 1");
    expect(await screen.findByText(overviewGreeting)).toBeDefined();
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
    });
    const history = renderApp("/sign-in");
    await fillIn("person@example.test", "fictional password 1");
    expect(await screen.findByText(overviewGreeting)).toBeDefined();
    expect(history.location.pathname).toBe("/");
  });

  it("asks for a valid email address and a password before sending anything", async () => {
    const fetch = serverAnswers({ "GET /api/session": signedOut });
    renderApp("/sign-in");
    await fillIn("not an address", "");
    expect(await screen.findByText("Enter the email address.")).toBeDefined();
    expect(screen.getByText("Enter the password.")).toBeDefined();
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
      name: "Account, Fictional Person",
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
      "POST /api/auth/sign-out": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/");
    await signOutFromMenu();
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not sign out/,
    );
    expect(
      screen.getByRole("button", { name: "Account, Fictional Person" }),
    ).toBeDefined();
  });
});

describe("signing out after a time without use", () => {
  const minute = 60_000;
  const seen = () => {
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  };
  // The page is open, and the clock then moves on only when the test moves it.
  async function openHome(answers: Parameters<typeof serverAnswers>[0]) {
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      ...answers,
    });
    const history = renderApp("/");
    await screen.findByText(overviewGreeting);
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() });
    return { fetch, history };
  }
  const later = (time: number) => {
    vi.setSystemTime(Date.now() + time);
  };
  const calls = (fetch: ReturnType<typeof serverAnswers>, url: string) =>
    fetch.mock.calls.filter(([called]) => called === url).length;

  it("signs out after 30 minutes without use, once, says why, and offers to come back to the same page", async () => {
    let session = signedIn;
    const { fetch, history } = await openHome({
      "GET /api/session": () => session(),
      "POST /api/auth/sign-out": () => {
        session = signedOut;
        return Response.json({ success: true });
      },
    });
    later(29 * minute);
    seen();
    expect(screen.getByText(overviewGreeting)).toBeDefined();
    later(2 * minute);
    seen();
    seen();
    expect((await screen.findByRole("status")).textContent).toBe(
      "Signed out after 30 minutes without use.",
    );
    expect(history.location.pathname).toBe("/sign-in");
    expect(history.location.search).toBe("?redirect=%2F&idle=true");
    expect(
      document.querySelector("form")?.getAttribute("aria-describedby"),
    ).toBe(screen.getByRole("status").id);
    expect(calls(fetch, "/api/auth/sign-out")).toBe(1);
  });

  it("signs out on use that comes after the time is up, rather than starting it again", async () => {
    await openHome({
      "POST /api/auth/sign-out": () => Response.json({ success: true }),
    });
    later(31 * minute);
    fireEvent.keyDown(window);
    expect(await screen.findByRole("status")).toBeDefined();
  });

  it("still signs out when the server cannot be told", async () => {
    const { history } = await openHome({
      "POST /api/auth/sign-out": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    later(31 * minute);
    seen();
    expect(await screen.findByRole("status")).toBeDefined();
    expect(history.location.pathname).toBe("/sign-in");
  });

  it("stays signed in while another tab is in use, and goes by its own use when browser storage holds something else", async () => {
    await openHome({
      "POST /api/auth/sign-out": () => Response.json({ success: true }),
    });
    later(31 * minute);
    localStorage.setItem("fathom-last-use", String(Date.now() - minute));
    seen();
    expect(screen.getByText(overviewGreeting)).toBeDefined();
    localStorage.setItem("fathom-last-use", "not a time");
    seen();
    expect(await screen.findByRole("status")).toBeDefined();
  });

  it("goes by the tab's own use when browser storage cannot be used", async () => {
    const storage = [
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("Storage is turned off");
      }),
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Storage is turned off");
      }),
    ];
    try {
      await openHome({
        "POST /api/auth/sign-out": () => Response.json({ success: true }),
      });
      later(10 * minute);
      fireEvent.keyDown(window);
      later(29 * minute);
      seen();
      expect(screen.getByText(overviewGreeting)).toBeDefined();
      later(2 * minute);
      seen();
      expect(await screen.findByRole("status")).toBeDefined();
    } finally {
      for (const spy of storage) spy.mockRestore();
    }
  });

  it("keeps the server's session alive while in use, telling it at most once a minute", async () => {
    const { fetch } = await openHome({});
    const before = calls(fetch, "/api/session");
    fireEvent.keyDown(window);
    expect(calls(fetch, "/api/session")).toBe(before);
    later(6 * minute);
    fireEvent.pointerMove(window);
    fireEvent.pointerMove(window);
    await act(() => Promise.resolve());
    expect(calls(fetch, "/api/session")).toBe(before + 1);
    expect(localStorage.getItem("fathom-last-use")).toBe(String(Date.now()));
  });

  it("sends the user to sign in when keeping the session alive finds it has ended", async () => {
    let session = signedIn;
    const { history } = await openHome({
      "GET /api/session": () => session(),
    });
    session = signedOut;
    later(2 * minute);
    fireEvent.keyDown(window);
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    expect(history.location.search).toBe("?redirect=%2F");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a refusal in place of saying why the user was signed out", async () => {
    serverAnswers({
      "GET /api/session": signedOut,
      "POST /api/auth/sign-in/email": () =>
        Response.json({ error: "Fictional" }, { status: 401 }),
    });
    renderApp("/sign-in?idle=true");
    expect(await screen.findByRole("status")).toBeDefined();
    await fillIn("person@example.test", "not the password");
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      document.querySelector("form")?.hasAttribute("aria-describedby"),
    ).toBe(false);
  });
});

describe("when something goes wrong", () => {
  it("says when the server cannot be reached, and tries again on request", async () => {
    let session = () =>
      Response.json({ error: "Internal Server Error" }, { status: 500 });
    serverAnswers({
      "GET /api/session": () => session(),
    });
    renderApp("/");
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Fathom could not reach its server.",
    );
    session = signedIn;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(overviewGreeting)).toBeDefined();
  });

  it("says when an address names no page, with a way home", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
    });
    const history = renderApp("/no-such-page");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("link", { name: "Go to the start page" }),
    );
    expect(await screen.findByText(overviewGreeting)).toBeDefined();
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
    });
    const history = renderApp("/sign-in?redirect=123");
    await fillIn("person@example.test", "fictional password 1");
    expect(await screen.findByText(overviewGreeting)).toBeDefined();
    expect(history.location.pathname).toBe("/");
  });

  it("sends someone whose session has ended to sign in, then back", async () => {
    let session = administratorOnly;
    serverAnswers({
      "GET /api/session": () => session(),
      "GET /api/accounts": () => {
        session = signedOut;
        return signedOut();
      },
    });
    const history = renderApp("/accounts?search=fictional");
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/sign-in");
    expect(history.location.search).toContain("search%3Dfictional");
  });
});
