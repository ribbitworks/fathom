// SPDX-License-Identifier: Apache-2.0

// Tests for exporting the Lists page's table.

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exportedCsv } from "./test-exports.tsx";
import { renderApp, savedFiles, serverAnswers } from "./test-support.tsx";
import { listsAnswer, listsGrid, viewer } from "./test-lists-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("exporting the Lists page", () => {
  it("saves the lists the role sees at once, asking nothing, since lists are General", async () => {
    // Given the Lists page as a viewer
    const files = savedFiles();
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists");
    await listsGrid();

    // When it is exported as a CSV file
    const { name, lines } = await exportedCsv(files);

    // Then no question is asked, and the file holds each list
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(name).toMatch(/^fathom_lists_fictional-person_.*\.csv$/u);
    expect(lines[0]).toMatch(/^Draft,Change,Name,/u);
    expect(lines.some((line) => line.includes("Locations"))).toBe(true);
  });
});
