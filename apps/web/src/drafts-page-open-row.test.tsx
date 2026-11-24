// SPDX-License-Identifier: Apache-2.0

// Tests for the Drafts page's row marked as the draft whose details are open beside its table,
// against a simulated server.

import { startingPlanningSettings } from "@fathom/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, it, vi } from "vitest";
import { added, noPeople } from "./test-lists-page.tsx";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";
import { markedUntilClosed } from "./test-open-row.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a draft's row", () => {
  it("is marked while the draft's details are open, until they close", async () => {
    // Given a list's drafts, its own and its choice's
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: [
            "configuration:approve",
            "configuration:view",
            "people:view",
          ],
        }),
      "GET /api/people": noPeople,
      "GET /api/lists": () => Response.json({ lists: [added] }),
      "GET /api/release-streams": () =>
        Response.json({
          streams: [],
          canEditStreams: false,
          canEditReleases: false,
        }),
      "GET /api/planning-settings": () =>
        Response.json(startingPlanningSettings),
    });
    renderApp("/drafts");
    // When the choice's draft's details are opened
    await userEvent.click(
      await screen.findByRole("button", {
        name: /^Show details of .*Platform/u,
      }),
    );
    // Then its row alone is marked, until the details close
    await markedUntilClosed("Platform");
  });
});
