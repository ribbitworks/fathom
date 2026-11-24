// SPDX-License-Identifier: Apache-2.0

// Tests for a person's draft holding details the role can't see on the Drafts page, against a
// simulated server.

import { startingPlanningSettings } from "@fathom/shared";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { draftPanelId } from "./drafts-panel.tsx";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

// A change of name, which the role sees, in a draft the server marks as holding more it can't.
const renamed = (holdsUnseen: boolean) => ({
  id: "p1",
  keyNumber: 1,
  preferredName: "Avery Fictional",
  employeeId: "E-p1",
  positionId: "position-1",
  values: {},
  links: {},
  draft: {
    action: "changed",
    changed: ["preferredName"],
    live: { preferredName: "Avery Old", values: {}, links: {} },
    state: "waiting",
    madeBy: "Fictional Editor",
    madeAt: "2026-10-30T15:00:00.000Z",
    ...(holdsUnseen ? { holdsUnseen: true } : {}),
  },
});

const openDrafts = (holdsUnseen: boolean, address: string) => {
  serverAnswers({
    "GET /api/session": () =>
      Response.json({
        ...fictionalUser,
        permissions: ["people:approve", "people:view"],
      }),
    "GET /api/people": () =>
      Response.json({
        people: [renamed(holdsUnseen)],
        fields: [],
        order: [],
      }),
    "GET /api/lists": () => Response.json({ lists: [] }),
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

describe("a person's draft holding details the role can't see", () => {
  it("is left out of To decide", async () => {
    openDrafts(true, "/drafts");
    expect(
      await screen.findByRole("tab", { name: /^To decide\s*0$/u }),
    ).toBeDefined();
  });

  it("needs another approver, saying why in its details", async () => {
    // Given the draft on All drafts
    openDrafts(true, "/drafts?tab=all");
    const marked = await screen.findByText("Needs another approver");
    const row = marked.closest("tr");
    expect(row).not.toBeNull();
    // When its details are opened
    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: /details/u }),
    );
    // Then they say why, and offer no decision
    const details = await screen.findByText(
      "This role can't see all of this draft's details, so another approver must decide this draft.",
    );
    expect(details.closest(`#${draftPanelId}`)).not.toBeNull();
    expect(
      within(document.getElementById(draftPanelId) as HTMLElement).queryByRole(
        "button",
        { name: "Approve…" },
      ),
    ).toBeNull();
  });

  it("is decided when the role sees all it holds", async () => {
    openDrafts(false, "/drafts");
    expect(
      await screen.findByRole("tab", { name: /^To decide\s*1$/u }),
    ).toBeDefined();
  });
});
