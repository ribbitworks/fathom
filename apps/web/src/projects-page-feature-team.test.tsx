// SPDX-License-Identifier: Apache-2.0

// Tests for who sets a feature's Feature team on the Features page: those who edit feature teams,
// in its cell, its details and New feature, and nobody else.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordCell } from "./test-support.tsx";
import {
  answers,
  featurePlan,
  first,
  openPage,
  planEditor,
  sidePanel,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const teamEditor = [...planEditor, "people:view", "feature-teams:edit"];
// Seeing people reads the lists too.
const withLists = {
  ...answers,
  "GET /api/lists": () => Response.json({ lists: [] }),
};
const who = [
  ["those who edit feature teams", teamEditor, true],
  ["those who edit features but not feature teams", planEditor, false],
] as const;
const openAs = (permissions: readonly string[], path = "/features") =>
  openPage(path, featurePlan({ canEdit: true }), withLists, [...permissions]);

describe("a feature's Feature team", () => {
  it.each(who)(
    "is changed in the table only by those who edit feature teams: %s",
    async (_who, permissions, edits) => {
      await openAs(permissions);
      const cell = recordCell(first.id, "featureTeamId");

      expect(cell).not.toBeNull();
      expect(cell?.getAttribute("aria-readonly") === "true").toBe(!edits);
    },
  );

  it.each(who)(
    "offers a pencil on it in a feature's details to %s: %s",
    async (_who, permissions, edits) => {
      await openAs(permissions, `/features?open=${first.id}`);
      await screen.findByRole("heading", { name: first.name });

      expect(within(sidePanel()).getByText("Feature team")).toBeTruthy();
      expect(
        within(sidePanel()).queryByRole("button", {
          name: "Change Feature team",
        }) !== null,
      ).toBe(edits);
    },
  );

  it.each(who)(
    "is offered in New feature to %s: %s",
    async (_who, permissions, edits) => {
      await openAs(permissions);
      await userEvent.click(
        await screen.findByRole("button", { name: "New feature" }),
      );
      await screen.findByRole("heading", { name: "New feature" });

      expect(within(sidePanel()).queryByText("Feature team") !== null).toBe(
        edits,
      );
    },
  );
});
