// SPDX-License-Identifier: Apache-2.0

// Tests for the Application settings page, with the server's responses simulated: who sees it, choosing Fathom's
// time zone with the day and time it is there, saving it for everyone, and the server's refusals.

import { act, fireEvent, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { notAllowedMessage } from "./api.ts";
import {
  fictionalUser,
  overviewGreeting,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

const settingsEditor =
  (timeZone = "America/Vancouver") =>
  () =>
    Response.json({
      ...fictionalUser,
      permissions: [
        "administration:view",
        "administration:edit",
        "plan:view",
        "features:view",
      ],
      settings: { ...fictionalUser.settings, timeZone },
    });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const timeZoneSave = () =>
  within(
    screen.getByRole("region", { name: "Time zone" }),
  ).getByRole<HTMLButtonElement>("button", { name: "Save" });

const picker = () =>
  screen.getByRole<HTMLInputElement>("combobox", { name: "Time zone" });

// React reads the form's data from the submit event's target, which in a browser is always the form.
function submitFormOf(field: HTMLInputElement) {
  const form = field.closest("form");
  if (form === null) throw new Error("The field is in no form");
  fireEvent.submit(form);
}

async function choose(timeZone: string) {
  await userEvent.clear(picker());
  await userEvent.type(picker(), timeZone);
  await userEvent.click(await screen.findByRole("option", { name: timeZone }));
}

describe("who sees the Application settings page", () => {
  it("links to it under Administration for users who may edit settings", async () => {
    serverAnswers({
      "GET /api/session": settingsEditor(),
    });
    const history = renderApp("/");
    await screen.findByText(overviewGreeting);
    await userEvent.click(
      within(screen.getByRole("navigation", { name: "Sections" })).getByRole(
        "link",
        { name: "Application settings" },
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Application settings" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/settings");
  });

  it("shows the settings read only to users who may only see them", async () => {
    // Given
    const fetch = serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["administration:view"],
        }),
    });
    // When
    const history = renderApp("/settings");
    // Then
    const passwords = await screen.findByRole("region", { name: "Passwords" });
    expect(history.location.pathname).toBe("/settings");
    expect(
      within(screen.getByRole("navigation", { name: "Sections" })).getByRole(
        "link",
        { name: "Application settings" },
      ),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(picker().readOnly).toBe(true);
    submitFormOf(picker());
    const minimum = within(passwords).getByRole<HTMLInputElement>("textbox", {
      name: "Minimum length",
    });
    expect(minimum.readOnly).toBe(true);
    submitFormOf(minimum);
    for (const name of [
      "A digit",
      "Leave out characters that look alike: I L O i l o 0 1",
    ]) {
      const box = within(passwords).getByRole<HTMLInputElement>("checkbox", {
        name,
      });
      const before = box.checked;
      await userEvent.click(box);
      expect(box.checked).toBe(before);
    }
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method !== undefined),
    ).toEqual([]);
  });

  it("is not shown to anyone else", async () => {
    serverAnswers({ "GET /api/session": signedIn });
    renderApp("/settings");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "Application settings" })).toBeNull();
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
    expect(timeZoneSave().disabled).toBe(true);
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
    await userEvent.click(timeZoneSave());
    expect(
      await screen.findByText("Fathom's time zone is now Asia/Tokyo."),
    ).toBeDefined();
    const sent = fetch.mock.calls.find(
      ([url]) => url === "/api/settings/time-zone",
    );
    expect(JSON.parse(sent?.[1]?.body as string)).toEqual({
      timeZone: "Asia/Tokyo",
    });
    expect(timeZoneSave().disabled).toBe(true);
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
    await userEvent.click(timeZoneSave());
    expect((await screen.findByRole("alert")).textContent).toBe(
      notAllowedMessage,
    );
  });
});

describe("the password settings", () => {
  const panel = () => screen.getByRole("region", { name: "Passwords" });
  const save = () =>
    within(panel()).getByRole<HTMLButtonElement>("button", { name: "Save" });
  const box = (name: string) =>
    within(panel()).getByRole<HTMLInputElement>("checkbox", { name });
  const length = (name: string) =>
    within(panel()).getByRole<HTMLInputElement>("textbox", { name });

  async function open() {
    renderApp("/settings");
    await screen.findByRole("region", { name: "Passwords" });
  }

  async function retype(name: string, value: string) {
    await userEvent.clear(length(name));
    if (value !== "") await userEvent.type(length(name), value);
  }

  it("shows the ones saved, with Save turned off until something changes", async () => {
    serverAnswers({ "GET /api/session": settingsEditor() });
    await open();
    expect([
      length("Minimum length").value,
      box("An uppercase letter").checked,
      box("A lowercase letter").checked,
      box("A digit").checked,
      box("A symbol").checked,
      length("Length").value,
      box("Uppercase letters").checked,
      box("Lowercase letters").checked,
      box("Digits").checked,
      box("Symbols: ! # $ % & * + - = ? @ ^ _ ~").checked,
      box("Leave out characters that look alike: I L O i l o 0 1").checked,
    ]).toEqual([
      "12",
      false,
      false,
      false,
      false,
      "20",
      true,
      true,
      true,
      false,
      true,
    ]);
    expect(
      screen.getByText(
        "Changes apply the next time each person changes their password.",
      ),
    ).toBeDefined();
    expect(save().disabled).toBe(true);
    await userEvent.click(box("A digit"));
    expect(save().disabled).toBe(false);
    await userEvent.click(box("A digit"));
    expect(save().disabled).toBe(true);
  });

  it("saves new rules and recipe for everyone", async () => {
    const changed = {
      rules: {
        uppercase: false,
        lowercase: false,
        digits: false,
        symbols: true,
        minimumLength: 14,
      },
      recipe: {
        uppercase: true,
        lowercase: true,
        digits: true,
        symbols: true,
        length: 20,
        avoidLookAlikes: false,
      },
    };
    const fetch = serverAnswers({
      "GET /api/session": settingsEditor(),
      "PUT /api/settings/passwords": () => Response.json(changed),
    });
    await open();
    await retype("Minimum length", "14");
    await userEvent.click(box("A symbol"));
    await userEvent.click(box("Symbols: ! # $ % & * + - = ? @ ^ _ ~"));
    await userEvent.click(
      box("Leave out characters that look alike: I L O i l o 0 1"),
    );
    await userEvent.click(save());
    expect(
      await screen.findByText("Saved the password settings."),
    ).toBeDefined();
    const sent = fetch.mock.calls.find(
      ([url]) => url === "/api/settings/passwords",
    );
    expect(JSON.parse(sent?.[1]?.body as string)).toEqual(changed);
  });

  it("says why a recipe would break the rules, and will not save it", async () => {
    serverAnswers({ "GET /api/session": settingsEditor() });
    await open();
    await retype("Minimum length", "24");
    await userEvent.click(box("A symbol"));
    expect(
      within(panel()).getByText(
        "Generated passwords must have at least 24 characters.",
      ),
    ).toBeDefined();
    expect(
      within(panel()).getByText(
        "Generated passwords must include symbols, because passwords must contain a symbol.",
      ),
    ).toBeDefined();
    expect(save().disabled).toBe(true);
    for (const name of ["Uppercase letters", "Lowercase letters", "Digits"]) {
      await userEvent.click(box(name));
    }
    expect(
      within(panel()).getByText(
        "Generated passwords need at least one character type.",
      ),
    ).toBeDefined();
  });

  it("asks for lengths in range", async () => {
    serverAnswers({ "GET /api/session": settingsEditor() });
    await open();
    await retype("Length", "");
    // Typed last, since leaving the box brings a number back into its range.
    await retype("Minimum length", "5");
    expect(
      within(panel()).getByText("Type a number from 8 to 128"),
    ).toBeDefined();
    expect(within(panel()).getByText("Number needed")).toBeDefined();
    expect(save().disabled).toBe(true);
  });

  it("says why the server refused a change", async () => {
    serverAnswers({
      "GET /api/session": settingsEditor(),
      "PUT /api/settings/passwords": () =>
        Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    await open();
    await userEvent.click(box("A digit"));
    await userEvent.click(save());
    expect((await within(panel()).findByRole("alert")).textContent).toBe(
      notAllowedMessage,
    );
  });
});
