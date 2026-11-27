// SPDX-License-Identifier: Apache-2.0

// Tests for a proposal's Features in its details: choosing features, and adding a new one linked to
// the proposal, against a simulated server.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addingAnswer,
  answers,
  feature,
  newId,
  openPage,
  plan,
  proposal,
  proposalId,
  rowMenu,
  saved,
  sent,
  sidePanel,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const atProposal = `/projects?tab=proposals&open=${proposalId}`;
const added = { ...feature("Fictional Dock Lights", null), id: newId };
// The plan for a role that may change proposals and add features.
const editing = (more = {}) => plan({ canEditFeatures: true, ...more });
const withAdded = editing({ features: [added] });
const linked = editing({
  features: [added],
  proposals: [proposal({ featureIds: [newId] })],
});
const newForm = () => document.getElementById("linked-record-panel");

async function openProposal(
  more = {},
  permissions?: string[],
  start = editing(),
) {
  const opened = await openPage(
    atProposal,
    start,
    { ...answers, ...more },
    permissions,
  );
  await screen.findByRole("heading", { name: /Fictional Proposal/ });
  return opened;
}

describe("a proposal's Features in its details", () => {
  it("offers Choose features and New feature under the list, in place of the row's pencil", async () => {
    await openProposal();
    const panel = sidePanel();
    expect([
      within(panel).getByRole("button", { name: "Choose features" }),
      within(panel).getByRole("button", { name: "New feature" }),
      within(panel).queryByRole("button", { name: "Change Features" }),
    ]).toEqual([expect.anything(), expect.anything(), null]);
  });

  it("opens the picker of features with Choose features", async () => {
    await openProposal();
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "Choose features" }),
    );
    expect(
      await within(sidePanel()).findByRole("textbox", { name: "Features" }),
    ).toBeDefined();
  });

  it("adds a new feature and links it as the proposal's own draft, then puts focus back on New feature", async () => {
    const { fetch, held } = await openProposal({
      "POST /api/features": addingAnswer(() => withAdded),
      [`PUT /api/proposals/${proposalId}`]: saved(() => linked),
    });
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "New feature" }),
    );
    const form = newForm() as HTMLElement;
    expect(
      within(form).getByRole("heading", { name: "New feature" }),
    ).toBeDefined();
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Name" }),
      "Fictional Dock Lights",
    );
    held.plan = withAdded;
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(sent(fetch, `PUT /api/proposals/${proposalId}`)).toEqual([
        expect.objectContaining({ featureIds: [newId] }),
      ]);
    });
    expect(sent(fetch, "POST /api/features")).toEqual([
      { records: [expect.objectContaining({ name: "Fictional Dock Lights" })] },
    ]);
    await waitFor(() => {
      expect(newForm()).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("New feature");
    });
  });

  it("offers Choose features alone to a role that may change proposals but not add features", async () => {
    await openProposal({}, undefined, plan({ canEditFeatures: false }));
    const panel = sidePanel();
    expect([
      within(panel).queryByRole("button", { name: "Choose features" }),
      within(panel).queryByRole("button", { name: "New feature" }),
      within(panel).queryByRole("button", { name: "Change Features" }),
    ]).toEqual([expect.anything(), null, null]);
  });

  it("puts focus back on Choose features once its picker closes with Esc", async () => {
    await openProposal();
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "Choose features" }),
    );
    await within(sidePanel()).findByRole("textbox", { name: "Features" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Choose features");
    });
  });

  it("puts focus back on New feature once its form is cancelled", async () => {
    await openProposal();
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "New feature" }),
    );
    await userEvent.click(
      within(newForm() as HTMLElement).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(newForm()).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("New feature");
    });
  });

  it("opens Features filtered to the proposal from the Features row's name", async () => {
    // Given a proposal naming a feature
    const { history } = await openProposal({}, undefined, linked);

    // When the Features row's name is selected
    await userEvent.click(
      within(sidePanel()).getByRole("button", {
        name: "Features, show on Features",
      }),
    );

    // Then Features opens, filtered to the proposal
    await waitFor(() => {
      expect(history.location.pathname).toBe("/features");
    });
    expect(decodeURIComponent(history.location.search)).toContain(proposalId);
  });

  it("offers no link on the Features row's name, nor Show on Features in its menu, while the proposal names no feature", async () => {
    await openProposal();
    expect(
      within(sidePanel()).queryByRole("button", {
        name: "Features, show on Features",
      }),
    ).toBeNull();
    expect(
      within(await rowMenu("Fictional Proposal")).queryByRole("menuitem", {
        name: "Show on Features",
      }),
    ).toBeNull();
  });

  it("reads None under an empty list, above the buttons", async () => {
    await openProposal();
    const features = within(sidePanel()).getByText("Features").closest("div");
    expect(features?.textContent).toContain("None");
  });
});
