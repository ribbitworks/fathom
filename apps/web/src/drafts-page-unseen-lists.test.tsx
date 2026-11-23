// SPDX-License-Identifier: Apache-2.0

// Tests for drafts of a list of a class the role can't see on the Drafts page, against a simulated
// server.

import { startingPlanningSettings } from "@fathom/shared";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { draftPanelId } from "./drafts-panel.tsx";
import { added, noPeople } from "./test-lists-page.tsx";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

// A Personal list only drafted to be added, with a choice drafted into it.
const personalList = { ...added, visibility: "personal" };

// Approves lists and sees people, and, given it, Personal data.
const approving =
  (extra: readonly string[] = []) =>
  () =>
    Response.json({
      ...fictionalUser,
      permissions: [
        "configuration:approve",
        "configuration:view",
        "people:view",
        ...extra,
      ],
    });

const openDrafts = (session: () => Response, address: string) => {
  serverAnswers({
    "GET /api/session": session,
    "GET /api/people": noPeople,
    "GET /api/lists": () => Response.json({ lists: [personalList] }),
    "GET /api/release-streams": () =>
      Response.json({
        streams: [],
        canEditStreams: false,
        canEditReleases: false,
      }),
    "GET /api/planning-settings": () => Response.json(startingPlanningSettings),
  });
  renderApp(address);
};

describe("drafts of a list of a class the role can't see", () => {
  it("are left out of To decide", async () => {
    openDrafts(approving(), "/drafts");
    expect(
      await screen.findByRole("tab", { name: /^To decide\s*0$/u }),
    ).toBeDefined();
  });

  it("need another approver, saying why in their details", async () => {
    // Given the list's two drafts on All drafts, for a role that can't see Personal data
    openDrafts(approving(), "/drafts?tab=all");
    expect(
      await screen.findByRole("tab", { name: /^All drafts\s*2$/u }),
    ).toBeDefined();
    const [first] = await screen.findAllByText("Needs another approver");
    const row = first?.closest("tr") ?? null;
    expect(row).not.toBeNull();
    // When one's details are opened
    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: /details/u }),
    );
    // Then they say why, and offer no decision
    const details = await screen.findByText(
      "This role can't see Personal data, so another approver must decide this draft.",
    );
    expect(details.closest(`#${draftPanelId}`)).not.toBeNull();
    expect(
      within(document.getElementById(draftPanelId) as HTMLElement).queryByRole(
        "button",
        { name: "Approve…" },
      ),
    ).toBeNull();
  });

  it("are decided by a role that sees their class", async () => {
    openDrafts(approving(["personal:view"]), "/drafts");
    expect(
      await screen.findByRole("tab", { name: /^To decide\s*2$/u }),
    ).toBeDefined();
  });
});
