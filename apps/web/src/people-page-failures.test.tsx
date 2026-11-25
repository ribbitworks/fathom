// SPDX-License-Identifier: Apache-2.0

// Tests for what People says when the server fails to remove a row, send its draft again, or
// discard it, for a person and a planned hire.

import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { person } from "./test-people-grid.tsx";
import { openPeopleWith } from "./test-people-page.tsx";
import { findRowActions, recordDraft } from "./test-support.tsx";

const rejected = (changed: string, live: object) =>
  recordDraft({
    state: "rejected",
    reason: "Fictional reason.",
    changed: [changed],
    live: { values: {}, links: {}, ...live },
  });

const someone = {
  ...person("p1", { preferredName: "Avery Fictional" }),
  draft: rejected("preferredName", { preferredName: "Avery Live" }),
};
const hire = {
  ...person("h1", {
    kind: "planned-hire",
    positionId: "engineer",
    preferredName: "",
    employeeId: "REQ-1",
    stateId: "open",
    expected: "2027-01",
    startDate: null,
  }),
  draft: rejected("stateId", { stateId: "proposed" }),
};

const failed = () =>
  Response.json({ error: "Fictional failure" }, { status: 500 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("what People says when a change to a row fails", () => {
  it.each([
    {
      kind: "a person",
      row: "Avery Fictional",
      item: "Remove person",
      request: "DELETE /api/people/p1",
      notice: "Fathom could not remove Avery Fictional.",
    },
    {
      kind: "a person",
      row: "Avery Fictional",
      item: "Resubmit",
      request: "DELETE /api/people/p1/draft/rejection",
      notice:
        "Fathom could not send the draft of Avery Fictional for approval again.",
    },
    {
      kind: "a person",
      row: "Avery Fictional",
      item: "Discard draft",
      request: "DELETE /api/people/p1/draft",
      notice: "Fathom could not discard the draft of Avery Fictional.",
    },
    {
      kind: "a planned hire",
      row: "Fictional Engineer, REQ-1",
      item: "Remove planned hire",
      request: "DELETE /api/planned-hires/h1",
      notice:
        "Fathom could not remove the planned hire Fictional Engineer, REQ-1.",
    },
    {
      kind: "a planned hire",
      row: "Fictional Engineer, REQ-1",
      item: "Resubmit",
      request: "DELETE /api/planned-hires/h1/draft/rejection",
      notice:
        "Fathom could not send the draft of the planned hire Fictional Engineer, REQ-1 for approval again.",
    },
    {
      kind: "a planned hire",
      row: "Fictional Engineer, REQ-1",
      item: "Discard draft",
      request: "DELETE /api/planned-hires/h1/draft",
      notice:
        "Fathom could not discard the draft of the planned hire Fictional Engineer, REQ-1.",
    },
  ])(
    "names $kind when its $item fails",
    async ({ row, item, request, notice }) => {
      // Given People with a person and a planned hire, each with a rejected draft, and a server
      // that fails the change
      await openPeopleWith([someone, hire], { [request]: failed });

      // When the change is chosen from the row's menu
      await userEvent.click(await findRowActions(row));
      await userEvent.click(
        await screen.findByRole("menuitem", { name: item }),
      );

      // Then the notice names the row
      expect(await screen.findByText(notice)).toBeDefined();
    },
  );
});
