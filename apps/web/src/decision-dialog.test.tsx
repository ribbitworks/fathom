// SPDX-License-Identifier: Apache-2.0

// Tests for the dialog that asks before approving drafts: the drafts it names, and those approving
// all leaves for another approver.

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DecisionModal } from "./decision-dialog.tsx";
import { noDrafts } from "./drafts.ts";
import { type Decision } from "./draft-decisions.ts";
import { serverAnswers, testTheme } from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const fictional = (total: number, from = 1) =>
  Array.from(
    { length: total },
    (_, index) => `Fictional ${String(from + index)}`,
  );

function showDecision(decision: Decision) {
  const fetch = serverAnswers({
    "POST /api/drafts/approval": () =>
      Response.json({ changeSetId: "00000000-0000-4000-8000-000000000001" }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider theme={testTheme}>
        <Notifications />
        <DecisionModal
          decision={decision}
          opened
          onClose={() => undefined}
          onDone={() => undefined}
        />
      </MantineProvider>
    </QueryClientProvider>,
  );
  return fetch;
}

const approving = (named: string[], othersLeft: string[]): Decision => ({
  asking: "approve",
  selection: { ...noDrafts(), people: named },
  named,
  othersLeft,
});

describe("the dialog before approving", () => {
  it("names five drafts, counts the rest, and names those left for another approver", async () => {
    // Given seven drafts to approve, and two another approver must approve
    showDecision(approving(fictional(7), fictional(2, 8)));
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 7 drafts?",
    });

    // Then five are named, then the rest counted, then the two left
    expect(dialog.textContent).toContain(
      [...fictional(5), "and 2 others"].join(""),
    );
    expect(dialog.textContent).not.toContain("Fictional 6");
    expect(dialog.textContent).toContain(
      "These need another approver and stay waiting:Fictional 8Fictional 9",
    );

    // When they are approved
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    // Then the notice counts those left
    expect(
      await screen.findByText("Approved 7 drafts. 2 need another approver."),
    ).toBeDefined();
  });

  it("counts one more draft as one other, and one left for another approver alone", async () => {
    // Given six drafts to approve, and one another approver must approve
    showDecision(approving(fictional(6), ["Fictional 9"]));
    const dialog = await screen.findByRole("dialog");

    // Then the sixth is counted, and the one left named alone
    expect(dialog.textContent).toContain("and 1 other");
    expect(dialog.textContent).toContain(
      "This needs another approver and stays waiting:Fictional 9",
    );

    // When they are approved
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    // Then the notice counts the one left
    expect(
      await screen.findByText("Approved 6 drafts. 1 needs another approver."),
    ).toBeDefined();
  });

  it("names five drafts with no count after them, and nothing left for another approver", async () => {
    showDecision(approving(fictional(5), []));
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 5 drafts?",
    });
    expect(dialog.textContent).toContain(fictional(5).join(""));
    expect(dialog.textContent).not.toContain("other");
  });

  it("puts focus in Reason when rejecting without one, rejecting nothing", async () => {
    // Given the dialog asking to reject a draft
    const fetch = showDecision({
      asking: "reject",
      selection: { ...noDrafts(), people: fictional(1) },
      named: fictional(1),
    });
    const dialog = await screen.findByRole("dialog");

    // When it is rejected with no reason
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject" }),
    );

    // Then the reason is asked for under Reason, which has the focus
    expect(within(dialog).getByText("Reason needed")).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(dialog).getByRole("textbox", { name: "Reason" }),
      );
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
