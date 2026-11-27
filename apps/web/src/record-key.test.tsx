// SPDX-License-Identifier: Apache-2.0

// Tests for a record's key under a panel's title, Copy link in a menu, and a name after its key.

import { Notifications } from "@mantine/notifications";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { unsavedKeyNumber } from "./drafts.ts";
import { MantineProvider, Menu } from "@mantine/core";
import { CopyLinkItem, KeyAfter, KeyedName, RecordKey } from "./record-key.tsx";
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

describe("a random key", () => {
  it("shows a private row's key, and copies its link by the whole key", async () => {
    const user = userEvent.setup();
    render(
      <MantineProvider theme={testTheme}>
        <Notifications />
        <RecordKey record={{ kind: "row", code: "4X9T" }} />
      </MantineProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: "#ROW-4X9T, copy link or key" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Copy link" }),
    );
    expect(await screen.findByText("Link copied.")).toBeDefined();
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/go/ROW-4X9T`,
    );
  });
});

describe("a name after its key", () => {
  const showName = (record: Parameters<typeof KeyedName>[0]["record"]) =>
    render(
      <MantineProvider theme={testTheme}>
        <p>
          <KeyedName record={record} name="Fictional Skills" />
        </p>
      </MantineProvider>,
    );

  it("shows the key, then the name", () => {
    showName({ kind: "list", keyNumber: 7 });
    expect(screen.getByRole("paragraph").textContent).toBe(
      "#LIST-7 Fictional Skills",
    );
  });

  it.each([
    ["no key", undefined],
    [
      "a record not yet saved",
      { kind: "list" as const, keyNumber: unsavedKeyNumber },
    ],
  ])("shows the name alone for %s", (_case, record) => {
    showName(record);
    expect(screen.getByRole("paragraph").textContent).toBe("Fictional Skills");
  });
});

describe("Copy link in a menu", () => {
  it("is left out for a record with no key", () => {
    render(
      <MantineProvider theme={testTheme}>
        <Menu opened>
          <Menu.Target>
            <button type="button">Actions</button>
          </Menu.Target>
          <Menu.Dropdown>
            <CopyLinkItem record={undefined} />
            <Menu.Item>Show details</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </MantineProvider>,
    );
    expect(
      screen.getByRole("menuitem", { name: "Show details" }),
    ).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: "Copy link" })).toBeNull();
  });
});

describe("a key after a name", () => {
  const showAfter = (keyNumber: number) =>
    render(
      <MantineProvider theme={testTheme}>
        <p>
          Fictional Hire
          <KeyAfter record={{ kind: "hire", keyNumber }} />
        </p>
      </MantineProvider>,
    );

  it("follows the name", () => {
    showAfter(12);
    expect(screen.getByRole("paragraph").textContent).toBe(
      "Fictional Hire #HIRE-12",
    );
  });

  it("is left out for a record not yet saved", () => {
    showAfter(unsavedKeyNumber);
    expect(screen.getByRole("paragraph").textContent).toBe("Fictional Hire");
  });
});
