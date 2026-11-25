// SPDX-License-Identifier: Apache-2.0

// Tests for a choice's rejected draft on the Lists page: its reason in its menu, and resubmitting it,
// a removal included.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp, serverAnswers } from "./test-support.tsx";
import {
  draftedAnswer,
  editor,
  empty,
  focusRow,
  locations,
  regions,
  removal,
  savedAs,
  sent,
  skills,
} from "./test-lists-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a choice's rejected draft on the Lists page", () => {
  it("shows a rejected choice's reason in its menu, and resubmits it", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": draftedAnswer,
      "DELETE /api/lists/l1/choices/c1/draft/rejection": savedAs(),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    focusRow("c1");
    await userEvent.keyboard("{ContextMenu}");
    const item = await screen.findByRole("menuitem", {
      name: "Resubmit",
    });
    expect(screen.getByText("Reason: Keep the old name")).toBeDefined();
    await userEvent.click(item);
    await waitFor(() => {
      expect(
        fetch.mock.calls.some(
          ([url, init]) =>
            url.endsWith("/api/lists/l1/choices/c1/draft/rejection") &&
            init?.method === "DELETE",
        ),
      ).toBe(true);
    });
  });

  it("resubmits a choice's rejected removal, which it also offers to discard", async () => {
    // Given a choice whose removal was rejected
    const rejectedRemoval = {
      ...locations,
      choices: [
        {
          ...locations.choices[0],
          draft: { ...removal, state: "rejected", reason: "Keep it" },
        },
        ...locations.choices.slice(1),
      ],
    };
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () =>
        Response.json({ lists: [rejectedRemoval, skills, empty, regions] }),
      "DELETE /api/lists/l1/choices/c1/draft/rejection": savedAs(),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Locations", level: 2 });

    // When its menu is opened and Resubmit chosen
    focusRow("c1");
    await userEvent.keyboard("{ContextMenu}");
    const menu = await screen.findByRole("menu");
    expect(
      within(menu).getByRole("menuitem", { name: "Discard draft" }),
    ).toBeDefined();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Resubmit" }),
    );

    // Then the removal is sent for approval again
    await waitFor(() => {
      expect(
        sent(fetch, "DELETE", "/api/lists/l1/choices/c1/draft/rejection"),
      ).toBe(true);
    });
  });

  // Opens the menu of a list's drafts, beside its name in the panel, once no other menu is open.
});
