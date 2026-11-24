// SPDX-License-Identifier: Apache-2.0

// Tests for the Projects page's row marked as the record whose details are open beside its table.

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  newId,
  openPage,
  plan,
  proposal,
  proposalId,
} from "./test-projects-page.tsx";
import { currentRows, markedUntilClosed } from "./test-open-row.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a proposal's row", () => {
  it("is marked while the proposal's details are open, until they close", async () => {
    // Given two proposals, the first's details open beside the Proposals table
    await openPage(
      `/projects?tab=proposals&open=${proposalId}`,
      plan({
        proposals: [
          proposal(),
          proposal({ id: newId, keyNumber: 2, name: "Fictional Bid" }),
        ],
      }),
    );
    // Then its row alone is marked, until the details close
    await markedUntilClosed("Fictional Proposal");
  });

  it("is not marked while a new proposal's form takes the details' place", async () => {
    // Given a proposal's details open beside the Proposals table
    await openPage(
      `/projects?tab=proposals&open=${proposalId}`,
      plan({ proposals: [proposal()] }),
    );
    await waitFor(() => {
      expect(currentRows()).toHaveLength(1);
    });
    // When a new proposal is started
    await userEvent.click(screen.getByRole("button", { name: "New proposal" }));
    // Then no row is marked
    await waitFor(() => {
      expect(currentRows()).toEqual([]);
    });
  });
});
