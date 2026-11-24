// SPDX-License-Identifier: Apache-2.0

// Tests for the People page's row marked as the person whose details are open beside its table,
// with the server's responses simulated.

import { screen } from "@testing-library/react";
import { afterEach, describe, it, vi } from "vitest";
import { editor, peopleAnswer, positions } from "./people-note-fixtures.ts";
import { renderApp, serverAnswers } from "./test-support.tsx";
import { markedUntilClosed } from "./test-open-row.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a person's row", () => {
  it("is marked while the person's details are open, until they close", async () => {
    // Given Avery's details open beside a table of two people
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": peopleAnswer(),
      "GET /api/lists": () => Response.json({ lists: [positions] }),
    });
    renderApp("/people?open=E1");
    await screen.findByRole("grid", { name: "People" });
    // Then Avery's row alone is marked, until the details close
    await markedUntilClosed("Avery Fictional");
  });
});
