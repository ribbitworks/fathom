// SPDX-License-Identifier: Apache-2.0

// Tests of the mark beside a record with a draft, for the user's own unpublished drafts.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DraftMark } from "./status-mark.tsx";
import { testTheme } from "./test-support.tsx";

function renderMark(draft: Parameters<typeof DraftMark>[0]["draft"]) {
  return render(
    <MantineProvider theme={testTheme}>
      <DraftMark draft={draft} />
    </MantineProvider>,
  );
}

describe("the draft mark", () => {
  it("is one mark for an unpublished draft, read aloud as unpublished", () => {
    renderMark({ action: "created", state: "waiting", unpublished: true });
    expect(screen.getByText("Draft: added")).toBeDefined();
    expect(screen.getByText(", unpublished")).toBeDefined();
    expect(screen.queryByText("Unpublished")).toBeNull();
  });

  it("says nothing of publishing for a published draft", () => {
    renderMark({ action: "created", state: "waiting" });
    expect(screen.getByText("Draft: added")).toBeDefined();
    expect(screen.queryByText(", unpublished")).toBeNull();
    expect(screen.queryByText("Unpublished")).toBeNull();
  });

  it("keeps a rejected draft's unpublished changes in a mark of their own", () => {
    renderMark({
      action: "changed",
      state: "rejected",
      reason: "Fictional reason",
      unpublished: true,
    });
    expect(screen.getByText("Rejected")).toBeDefined();
    expect(screen.getByText(": Fictional reason")).toBeDefined();
    expect(screen.getByText("Unpublished")).toBeDefined();
  });
});
