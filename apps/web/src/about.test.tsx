// SPDX-License-Identifier: Apache-2.0

// Tests of Help's About box: how it describes the release, commit and commit date, and that every
// signed-in user opens it from the sidebar, expanded, collapsed to a rail, or on a narrow screen.

import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AboutBox,
  type Build,
  build,
  describeCommit,
  describeDate,
  describeVersion,
} from "./about.tsx";
import {
  fictionalUser,
  greeting,
  onNarrowScreen,
  renderApp,
  sectionsButton,
  serverAnswers,
  testTheme,
} from "./test-support.tsx";

const sidebar = () => screen.findByRole("navigation", { name: "Sections" });

// A user with no permissions at all, who still sees Help.
const noPermissions = () =>
  Response.json({ ...fictionalUser, permissions: [] });

const rowsOf = (box: HTMLElement) =>
  within(box)
    .getAllByRole("row")
    .map((row) => row.textContent);

function renderBox(shown: Build) {
  render(
    <MantineProvider theme={testTheme}>
      <AboutBox opened onClose={() => undefined} build={shown} />
    </MantineProvider>,
  );
  return screen.getByRole("dialog", { name: "About Fathom" });
}

async function openFromSidebar() {
  serverAnswers({
    "GET /api/session": noPermissions,
    "GET /api/greeting": greeting,
  });
  renderApp("/help/roles");
  await userEvent.click(
    within(await sidebar()).getByRole("button", { name: "About Fathom" }),
  );
  return screen.findByRole("dialog", { name: "About Fathom" });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe("the About box's version", () => {
  it("names the release, and how many commits a build is past it", () => {
    expect(describeVersion("0.3.0")).toBe("0.3.0");
    expect(describeVersion("0.3.0+1")).toBe("0.3.0, plus 1 commit");
    expect(describeVersion("1.0.0-rc.1+1500")).toBe(
      "1.0.0-rc.1, plus 1,500 commits",
    );
  });

  it("keeps anything else after a plus as part of the version", () => {
    expect(describeVersion("1.0.0+build.7")).toBe("1.0.0+build.7");
  });

  it("is Unreleased before the first release", () => {
    expect(describeVersion("")).toBe("Unreleased");
  });
});

describe("the About box's commit", () => {
  it("says when the build's files differ from the commit", () => {
    expect(describeCommit("abc1234")).toBe("abc1234");
    expect(describeCommit("abc1234-modified")).toBe("abc1234, modified");
    expect(describeCommit("")).toBe("Unknown");
  });
});

describe("the About box's commit date", () => {
  it("is the day of the commit, even in a time zone behind UTC", async () => {
    vi.stubEnv("TZ", "America/Denver");
    vi.resetModules();
    const about = await import("./about.tsx");
    expect(about.describeDate("2026-11-02")).toBe("November 2, 2026");
  });

  it("is Unknown when the build had none", () => {
    expect(describeDate("")).toBe("Unknown");
    expect(describeDate("not a date")).toBe("Unknown");
  });
});

describe("the About box", () => {
  it("shows the release, the commit and the commit's date", () => {
    const box = renderBox({
      version: "0.3.0+4",
      commit: "abc1234",
      date: "2026-11-02",
    });
    expect(rowsOf(box)).toEqual([
      "Version0.3.0, plus 4 commits",
      "Commitabc1234",
      "CommittedNovember 2, 2026",
    ]);
  });

  it("says Unreleased for a commit before the first release", () => {
    const box = renderBox({ version: "", commit: "abc1234", date: "" });
    expect(rowsOf(box)[0]).toBe("VersionUnreleased");
  });

  it("says Unknown for everything when the build had nothing from git", () => {
    const box = renderBox({ version: "", commit: "", date: "" });
    expect(rowsOf(box)).toEqual([
      "VersionUnknown",
      "CommitUnknown",
      "CommittedUnknown",
    ]);
  });

  it("is built without a release, commit or date in tests", () => {
    expect(build).toEqual({ version: "", commit: "", date: "" });
  });

  it("opens from Help for a user with no permissions, and closes", async () => {
    const box = await openFromSidebar();
    expect(rowsOf(box)[0]).toBe("VersionUnknown");
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("opens from the collapsed sidebar's rail", async () => {
    localStorage.setItem("fathom-sidebar-collapsed", "true");
    expect(await openFromSidebar()).toBeDefined();
  });

  it("opens from the sidebar on a narrow screen", async () => {
    onNarrowScreen();
    serverAnswers({
      "GET /api/session": noPermissions,
      "GET /api/greeting": greeting,
    });
    renderApp("/help/roles");
    await userEvent.click(await sectionsButton());
    await userEvent.click(
      within(await sidebar()).getByRole("button", { name: "About Fathom" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "About Fathom" }),
    ).toBeDefined();
  });
});
