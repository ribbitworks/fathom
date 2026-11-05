// SPDX-License-Identifier: Apache-2.0

// Tests for the Settings page, with the server's responses simulated: who sees it, choosing Fathom's
// time zone with the day and time it is there, saving it for everyone, and the server's refusals.

import { act, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

const settingsEditor =
  (timeZone = "America/Vancouver") =>
  () =>
    Response.json({
      ...fictionalUser,
      roles: ["administrator"],
      permissions: ["settings:edit", "plan:view"],
      settings: { timeZone },
    });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const picker = () =>
  screen.getByRole<HTMLInputElement>("combobox", { name: "Time zone" });

async function choose(timeZone: string) {
  await userEvent.clear(picker());
  await userEvent.type(picker(), timeZone);
  await userEvent.click(await screen.findByRole("option", { name: timeZone }));
}

describe("who sees the Settings page", () => {
  it("links to it under Administration for users who may edit settings", async () => {
    serverAnswers({
      "GET /api/session": settingsEditor(),
      "GET /api/greeting": greeting,
    });
    const history = renderApp("/");
    await screen.findByText("Hello, Fathom");
    await userEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/settings");
  });

  it("is not shown to anyone else", async () => {
    serverAnswers({ "GET /api/session": signedIn });
    renderApp("/settings");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
  });
});

describe("the time zone", () => {
  it("shows the one saved, and the day it is there for the one chosen", async () => {
    // Still the evening of 4 November in Vancouver, and already the 5th in Tokyo.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T03:30:00Z"));
    serverAnswers({ "GET /api/session": settingsEditor() });
    renderApp("/settings");
    expect(
      (await screen.findByRole("combobox", { name: "Time zone" })).getAttribute(
        "value",
      ),
    ).toBe("America/Vancouver");
    expect(screen.getByText(/^It is/).textContent).toMatch(
      /November 4, 2026.* PM there\.$/,
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Save" }).disabled,
    ).toBe(true);
    await choose("Asia/Tokyo");
    expect(screen.getByText(/^It is/).textContent).toMatch(
      /November 5, 2026.*12:30\sPM there\.$/,
    );
  });

  it("keeps the time there to the minute while the page is open", async () => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout"],
      shouldAdvanceTime: true,
    });
    vi.setSystemTime(new Date("2026-11-05T03:30:40Z"));
    serverAnswers({ "GET /api/session": settingsEditor("Asia/Tokyo") });
    renderApp("/settings");
    await screen.findByText(/12:30\sPM there/);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(screen.getByText(/^It is/).textContent).toMatch(/12:31\sPM there/);
  });

  it("offers a saved time zone the browser does not list, such as an old name for one", async () => {
    serverAnswers({ "GET /api/session": settingsEditor("US/Pacific") });
    renderApp("/settings");
    const picker = await screen.findByRole("combobox", { name: "Time zone" });
    expect(picker.getAttribute("value")).toBe("US/Pacific");
    await userEvent.click(picker);
    expect(
      screen.getAllByRole("option").map(({ textContent }) => textContent)[0],
    ).toBe("US/Pacific");
  });

  it("leaves out the time there for a saved time zone this browser cannot use", async () => {
    serverAnswers({ "GET /api/session": settingsEditor("Fictional/Nowhere") });
    renderApp("/settings");
    await screen.findByRole("combobox", { name: "Time zone" });
    expect(screen.queryByText(/^It is/)).toBeNull();
  });

  it("saves the one chosen for everyone", async () => {
    let saved = "America/Vancouver";
    const fetch = serverAnswers({
      "GET /api/session": () => settingsEditor(saved)(),
      "PUT /api/settings/time-zone": () => {
        saved = "Asia/Tokyo";
        return Response.json({ timeZone: saved });
      },
    });
    renderApp("/settings");
    await screen.findByRole("combobox", { name: "Time zone" });
    await choose("Asia/Tokyo");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Fathom's time zone is now Asia/Tokyo."),
    ).toBeDefined();
    const sent = fetch.mock.calls.find(
      ([url]) => url === "/api/settings/time-zone",
    );
    expect(JSON.parse(sent?.[1]?.body as string)).toEqual({
      timeZone: "Asia/Tokyo",
    });
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Save" }).disabled,
    ).toBe(true);
  });

  it("says why the server refused a change", async () => {
    serverAnswers({
      "GET /api/session": settingsEditor(),
      "PUT /api/settings/time-zone": () =>
        Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    renderApp("/settings");
    await screen.findByRole("combobox", { name: "Time zone" });
    await choose("Asia/Tokyo");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "You do not have permission to do this. Your roles may have changed.",
    );
  });
});
