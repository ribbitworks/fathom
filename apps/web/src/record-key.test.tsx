// SPDX-License-Identifier: Apache-2.0

// Tests for a record's key under a panel's title: its menu copies the record's whole link or its
// key, saying so or saying it couldn't, and a record not yet saved shows no key.

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { unsavedKeyNumber } from "./drafts.ts";
import { RecordKey } from "./record-key.tsx";
import { testTheme } from "./test-support.tsx";

afterEach(() => {
  vi.restoreAllMocks();
});

function showKey(keyNumber: number) {
  // Set up before the key is drawn, so the simulated browser has a clipboard to copy to.
  const user = userEvent.setup();
  render(
    <MantineProvider theme={testTheme}>
      <Notifications />
      <RecordKey record={{ kind: "feature", keyNumber }} />
    </MantineProvider>,
  );
  return user;
}

async function choose(user: ReturnType<typeof userEvent.setup>, item: string) {
  await user.click(
    screen.getByRole("button", { name: "#FEATURE-12, copy link or key" }),
  );
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

describe("a record's key", () => {
  it("shows the key, and copies the record's whole link from its menu", async () => {
    const user = showKey(12);
    expect(screen.getByRole("button").textContent).toBe("#FEATURE-12");
    await choose(user, "Copy link");
    expect(await screen.findByText("Link copied.")).toBeDefined();
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/go/feature/12`,
    );
  });

  it("copies the key itself", async () => {
    const user = showKey(12);
    await choose(user, "Copy key");
    expect(await screen.findByText("Key copied.")).toBeDefined();
    expect(await navigator.clipboard.readText()).toBe("#FEATURE-12");
  });

  it.each([
    ["Copy link", "The link couldn't be copied."],
    ["Copy key", "The key couldn't be copied."],
  ])("says so when %s can't reach the clipboard", async (item, message) => {
    const user = showKey(12);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("Denied"),
    );
    await choose(user, item);
    expect(await screen.findByText(message)).toBeDefined();
  });

  it("shows nothing for a record not yet saved", () => {
    showKey(unsavedKeyNumber);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
