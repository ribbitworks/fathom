// SPDX-License-Identifier: Apache-2.0

// Test helpers for the row marked as the record whose details are open beside a shared table.

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect } from "vitest";

// The words of each table row marked as the record whose details are open.
export const currentRows = () =>
  [...document.querySelectorAll('tr[aria-current="true"]')].map(
    (row) => row.textContent,
  );

// Checks that only the row with the words given is marked, then that closing the details clears it.
export async function markedUntilClosed(words: string) {
  await waitFor(() => {
    expect(currentRows()).toEqual([expect.stringContaining(words)]);
  });
  await userEvent.click(screen.getByRole("button", { name: "Close details" }));
  await waitFor(() => {
    expect(currentRows()).toEqual([]);
  });
}
