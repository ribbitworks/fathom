// SPDX-License-Identifier: Apache-2.0

// Tests for exporting the People page, with the server's responses simulated.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp, savedFiles, serverAnswers } from "./test-support.tsx";
import { exportedCsv } from "./test-exports.tsx";
import { today } from "./today.ts";
import {
  avery,
  blake,
  chooseInDraftMenu,
  editor,
  listsAnswer,
  openPeople,
  order,
  peopleAnswer,
  role,
  session,
  site,
} from "./test-people-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("exporting People", () => {
  it("starts each row with the day shown, as on today", async () => {
    // Given People with its Personal columns hidden, shown as of today
    const files = savedFiles();
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": peopleAnswer,
      "GET /api/lists": listsAnswer,
    });
    renderApp('/people?hidden=["startDate","endDate","managerFrom","f2"]');
    await screen.findByRole("grid", { name: "People" });

    // When People is exported
    const { lines } = await exportedCsv(files);

    // Then an As on column comes first, holding the day on every row
    expect(lines[0]).toMatch(/^As on,Draft,Change,Name,/u);
    const rows = lines.slice(1).filter((line) => line !== "");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.startsWith(`${today()},`)).toBe(true);
  });

  it("starts each row with another day shown, and names the file after it", async () => {
    // Given People as on another day, read by a role that sees other dates
    const onDay = "2025-03-01";
    const files = savedFiles();
    serverAnswers({
      "GET /api/session": session([
        "people:view",
        "configuration:view",
        "plan:view",
        "features:view",
        "personal:view",
      ]),
      "GET /api/people": peopleAnswer,
      [`GET /api/people?on=${onDay}`]: peopleAnswer,
      "GET /api/lists": listsAnswer,
      "POST /api/exports": () => Response.json({ recorded: true }),
    });
    renderApp(`/people?day=${onDay}`);
    await screen.findByRole("grid", { name: "People" });

    // When People is exported, confirming its Personal data
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Export",
      }),
    );

    // Then every row is as on that day, and so is the file's name
    await waitFor(() => {
      expect(files).toHaveLength(1);
    });
    expect(files[0]?.name).toMatch(new RegExp(`_${onDay}\\.csv$`, "u"));
    const rows = ((await files[0]?.text()) ?? "")
      .split("\r\n")
      .slice(1)
      .filter((line) => line !== "");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.startsWith(`${onDay},`)).toBe(true);
  });

  it("asks before exporting Personal data, without the hiring plan when no planned hire is shown", async () => {
    await openPeople();
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Export Personal data?",
    });
    expect(dialog.textContent).not.toContain("Hiring plan");
  });

  it("leaves hidden columns out of the file, asking nothing when only they hold Personal data", async () => {
    // Given People with its Personal columns hidden
    const files = savedFiles();
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": peopleAnswer,
      "GET /api/lists": listsAnswer,
    });
    renderApp('/people?hidden=["startDate","endDate","managerFrom","f2"]');
    await screen.findByRole("grid", { name: "People" });

    // When People is exported
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );

    // Then the file is saved without asking, holding no hidden column
    await waitFor(() => {
      expect(files).toHaveLength(1);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    const [heading = ""] = (await files[0]?.text())?.split(/\r?\n/u) ?? [];
    const headings = heading.split(",");
    expect(headings).toEqual(expect.arrayContaining(["Name", "Site"]));
    for (const hidden of ["Start", "End", "Manager assigned", "Role on team"]) {
      expect(headings).not.toContain(hidden);
    }
  });

  it("exports a shown Key column as each record's key number, after Name", async () => {
    // Given People with the Key column shown, and its Personal columns hidden
    const files = savedFiles();
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": peopleAnswer,
      "GET /api/lists": listsAnswer,
    });
    renderApp(
      '/people?hidden=["startDate","endDate","managerFrom","f2"]&shown=["recordKey"]',
    );
    await screen.findByRole("grid", { name: "People" });

    // When People is exported
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );

    // Then the file holds each key's number under Key, after Name
    await waitFor(() => {
      expect(files).toHaveLength(1);
    });
    const [heading = "", ...lines] =
      (await files[0]?.text())?.split(/\r?\n/u) ?? [];
    const headings = heading.split(",");
    const keyAt = headings.indexOf("Key");
    expect(keyAt).toBe(headings.indexOf("Name") + 1);
    const averyLine = lines.find((line) => line.includes("Avery Fictional"));
    expect(averyLine?.split(",").at(keyAt)).toBe(String(avery.keyNumber));
  });

  it("names past managers for a drafted change of manager", async () => {
    // Given a person drafted to another manager
    const moved = {
      ...blake,
      manager: { id: "p1", preferredName: "Avery Fictional" },
      draft: {
        action: "changed",
        changed: ["managerId"],
        live: { managerId: null, values: {}, links: {} },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
    };
    await openPeople({
      "GET /api/people": () =>
        Response.json({
          people: [avery, moved],
          fields: [site, role],
          order,
        }),
    });

    // When People is exported beside live
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );

    // Then the question names past managers, Personal by default
    const dialog = await screen.findByRole("dialog", {
      name: "Export Personal data?",
    });
    expect(dialog.textContent).toContain("Past managers");

    // When it is exported live only, holding only the live manager
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await chooseInDraftMenu("Live only");
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );

    // Then past managers aren't named
    expect(
      (await screen.findByRole("dialog", { name: "Export Personal data?" }))
        .textContent,
    ).not.toContain("Past managers");
  });
});
