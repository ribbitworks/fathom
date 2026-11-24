// SPDX-License-Identifier: Apache-2.0

// Tests for the Accounts page's row marked as the account whose details are open beside its table,
// with the server's responses simulated.

import { screen } from "@testing-library/react";
import { afterEach, describe, it, vi } from "vitest";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";
import { markedUntilClosed } from "./test-open-row.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const administrator = {
  id: "00000000-0000-4000-8000-000000000001",
  keyNumber: 1,
  key: "administrator",
  name: "Administrator",
  description: "Manages user accounts, roles, and system settings.",
  permissions: ["administration:edit", "administration:view"],
  accounts: 2,
  updatedAt: "2026-11-01T12:00:00.000Z",
};
const holding = { id: administrator.id, name: administrator.name };
const account = (id: string, name: string, email: string) => ({
  id,
  keyNumber: 1,
  name,
  email,
  role: holding,
  roles: [holding],
  active: true,
  createdAt: "2026-10-12T09:00:00.000Z",
});
const own = account(
  "10000000-0000-4000-8000-000000000001",
  "Fictional Person",
  "person@example.test",
);
const planner = account(
  "10000000-0000-4000-8000-000000000002",
  "Fictional Planner",
  "planner@example.test",
);

describe("an account's row", () => {
  it("is marked while the account's details are open, until they close", async () => {
    // Given the planner's details open beside a table of two accounts
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          role: { ...holding, key: "administrator", description: "" },
          permissions: [
            "administration:view",
            "administration:edit",
            "plan:view",
            "features:view",
          ],
        }),
      "GET /api/roles": () => Response.json({ roles: [administrator] }),
      "GET /api/accounts": () => Response.json({ accounts: [own, planner] }),
    });
    renderApp(`/accounts?open=${planner.id}`);
    await screen.findByRole("region", { name: "Fictional Planner" });
    // Then the planner's row alone is marked, until the details close
    await markedUntilClosed("Fictional Planner");
  });
});
