// SPDX-License-Identifier: Apache-2.0

// Tests for a draft's details beside the Drafts table.

import type { DraftsTab } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Entry } from "./draft-entries.ts";
import { targetSelection } from "./draft-targets.ts";
import type { NamedDraft } from "./draft-reading.ts";
import {
  DraftPanel,
  type DraftActions,
  type LinkedDraft,
} from "./drafts-panel.tsx";
import { draftColumns, draftRows } from "./drafts-table.tsx";
import { testTheme } from "./test-support.tsx";

const entry = (more: Partial<Entry> = {}): Entry => ({
  key: "person p1",
  madeAt: "2026-11-01T10:00:00.000Z",
  action: "changed",
  state: "waiting",
  who: "Fictional Editor",
  kind: "person",
  name: "Avery Fictional",
  details: [[{ strong: "Start" }, " filled in: ", { value: "Nov 2, 2026" }]],
  reason: undefined,
  unpublished: false,
  heldBy: undefined,
  needsOtherApprover: false,
  discardable: false,
  target: { kind: "person", id: "p1" },
  selects: targetSelection(more.target ?? { kind: "person", id: "p1" }),
  place: { kind: "person", keyNumber: 1 },
  ...more,
  decided: more.decided ?? { kind: more.kind ?? "person" },
});

function show({
  one = entry(),
  related = [],
  actions,
  approves = true,
  waits = false,
  unseen,
  tab = "all",
  linked,
  recordLink,
}: {
  one?: Entry;
  related?: NamedDraft[];
  linked?: LinkedDraft[];
  actions?: DraftActions;
  approves?: boolean;
  waits?: boolean;
  unseen?: string;
  tab?: DraftsTab;
  recordLink?: ReactNode;
}) {
  const rows = draftRows([one], {
    waits: () => waits,
    choosable: () => approves,
    unseen: () => unseen,
    needsOtherApproval: () => false,
  });
  const [row] = rows;
  if (row === undefined) throw new Error("No row");
  render(
    <MantineProvider theme={testTheme}>
      <DraftPanel
        row={row}
        columns={draftColumns(rows, tab)}
        related={related}
        {...(linked === undefined ? {} : { linked })}
        actions={actions}
        approves={approves}
        waits={waits}
        unseen={unseen}
        narrow={false}
        recordLink={recordLink}
        onClose={vi.fn()}
      />
    </MantineProvider>,
  );
}

const deciding = (): DraftActions => ({ approve: vi.fn(), reject: vi.fn() });

describe("a draft's details", () => {
  it("lists its columns as rows, beside its record", () => {
    show({});
    expect(
      screen.getByRole("heading", { name: /Avery Fictional/u }),
    ).toBeDefined();
    const details = screen.getByRole("region", { name: "Details" });
    expect(within(details).getByText("Start")).toBeDefined();
    expect(within(details).getByText("Fictional Editor")).toBeDefined();
    expect(within(details).queryByText("Record")).toBeNull();
  });

  it("leaves Made by out on Not published", () => {
    show({ one: entry({ unpublished: true }), tab: "unpublished" });
    expect(screen.queryByText("Made by")).toBeNull();
  });

  it("links to each change it's published and discarded with, opening that change's details", async () => {
    // Given one's own change linked to another
    const onShow = vi.fn();
    show({
      one: entry({ unpublished: true }),
      tab: "unpublished",
      linked: [
        {
          id: "list l1",
          name: "Equipment",
          key: { kind: "list", keyNumber: 4 },
          onShow,
        },
      ],
    });
    const linked = screen.getByRole("region", { name: "Linked to" });
    expect(within(linked).getByText("Change")).toBeDefined();

    // When its link, its key before its name, is followed
    await userEvent.click(
      within(linked).getByRole("button", { name: "#LIST-4 Equipment" }),
    );

    // Then that change's details are asked for
    expect(onShow).toHaveBeenCalled();
  });

  it("names several linked changes under Changes, and has no Linked to section with none", () => {
    show({
      one: entry({ unpublished: true }),
      tab: "unpublished",
      linked: [
        { id: "list l1", name: "Equipment", key: undefined, onShow: vi.fn() },
        {
          id: "choice c1",
          name: "Laptop in Equipment",
          key: undefined,
          onShow: vi.fn(),
        },
      ],
    });
    expect(
      within(screen.getByRole("region", { name: "Linked to" })).getByText(
        "Changes",
      ),
    ).toBeDefined();
    cleanup();
    show({ one: entry({ unpublished: true }), tab: "unpublished" });
    expect(screen.queryByRole("region", { name: "Linked to" })).toBeNull();
  });

  it("names the drafts approved with a waiting draft, each after its key where it has one", () => {
    show({
      related: [
        { name: "Skills", key: { kind: "list", keyNumber: 7 } },
        { name: "the new order for Sites", key: undefined },
      ],
    });
    const approved = screen.getByRole("region", { name: "Approved with it" });
    expect(
      within(approved)
        .getAllByRole("paragraph")
        .map(({ textContent }) => textContent),
    ).toEqual(["#LIST-7 Skills", "the new order for Sites"]);
  });

  it("shows its record's key under its title", () => {
    show({});
    expect(
      screen.getByRole("button", { name: "#PERSON-1, copy link or key" }),
    ).toBeDefined();
  });

  it("shows no key for a draft of the planning settings", () => {
    show({ one: entry({ place: "planning-settings" }) });
    expect(
      screen.queryByRole("button", { name: /copy link or key/u }),
    ).toBeNull();
  });

  it("heads the drafts a rejected draft holds back Waiting on it", () => {
    show({
      one: entry({ state: "rejected", reason: "Fictional reason" }),
      related: [{ name: "the new order for Sites", key: undefined }],
    });
    expect(screen.getByRole("region", { name: "Waiting on it" })).toBeDefined();
  });

  it("approves or rejects a draft this role may decide now", async () => {
    const actions = deciding();
    show({ actions });
    await userEvent.click(screen.getByRole("button", { name: "Approve…" }));
    await userEvent.click(screen.getByRole("button", { name: "Reject…" }));
    expect(actions.approve).toHaveBeenCalledOnce();
    expect(actions.reject).toHaveBeenCalledOnce();
  });

  it("offers no approval of a draft this account changed, saying why", () => {
    show({ one: entry({ needsOtherApprover: true }), actions: deciding() });
    expect(screen.getByRole("button", { name: "Approve…" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByText("Needs another approver")).toBeDefined();
  });

  it.each([
    [
      "one's own, not yet published",
      { one: entry({ unpublished: true }) },
      "Nobody else sees these changes until they're published.",
    ],
    [
      "being changed by someone else",
      { one: entry({ heldBy: "Fictional Other" }) },
      "Being changed by Fictional Other. It can be changed once they publish or discard their changes.",
    ],
    [
      "rejected",
      { one: entry({ state: "rejected" }) },
      "Back with Fictional Editor to change and resubmit.",
    ],
    [
      "of an area this role doesn't approve",
      { approves: false },
      "This role doesn't approve people.",
    ],
    [
      "waiting on a rejected draft",
      { waits: true },
      "This draft can't be decided until the rejected draft it waits on is resubmitted.",
    ],
    [
      "of a list whose class this role can't see",
      { unseen: "This role can't see Personal data" },
      "This role can't see Personal data, so another approver must decide this draft.",
    ],
  ] as const)("says why a draft %s can't be decided", (_case, given, why) => {
    show(given);
    expect(screen.getByText(why)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Approve…" })).toBeNull();
  });

  it("gives no reason beside a decision this role may make now", () => {
    show({ actions: deciding() });
    expect(
      screen.queryByText(
        /another approver|resubmitted|Back with|doesn't approve/u,
      ),
    ).toBeNull();
  });

  it("ends with the link to its record, where given", () => {
    show({ recordLink: <a href="/lists/l1">Show on Lists</a> });
    expect(screen.getByRole("link", { name: "Show on Lists" })).toBeDefined();
  });
});
