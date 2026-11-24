// SPDX-License-Identifier: Apache-2.0

// Tests for publishing the user's own draft from a record's menu, with the changes it goes with, on
// the shared table, with a made-up kind of record, gadgets.

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { noDrafts } from "./drafts.ts";
import { PublishDraftProvider } from "./publish-draft.tsx";
import { RecordGrid } from "./record-grid.tsx";
import { emptyView } from "./table-view.ts";
import {
  type Gadget,
  actions,
  bodyOf,
  gadget,
  gadgetTable,
  noop,
  rowActions,
  serverAnswers,
  testTheme,
  waiting,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const unpublished = {
  ...waiting,
  action: "changed" as const,
  changed: ["code"],
  live: { code: "OLD", values: {}, links: {} },
  unpublished: true,
};

// The user's own change to a gadget, as the server lists it, by the key of its draft.
const change = (id: string, linked: string[] = []) => ({
  subject: `the gadget ${id}`,
  action: "changed" as const,
  key: `list ${id}`,
  linked,
});

function renderPublishing(gadgets: Gadget[], publishes = true) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MantineProvider theme={testTheme}>
        <Notifications />
        <PublishDraftProvider publishes={publishes}>
          <RecordGrid
            records={gadgets}
            table={gadgetTable()}
            fields={[]}
            order={[]}
            lists={[]}
            canEdit
            canEditColumns={false}
            view={emptyView}
            onView={noop}
            actions={actions()}
          />
        </PublishDraftProvider>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const publishFromMenu = async () => {
  await userEvent.click(rowActions("Gadget g1"));
  await userEvent.click(
    await screen.findByRole("menuitem", { name: "Publish draft…" }),
  );
};

const published = { drafts: { ...noDrafts(), lists: ["g1"] } };

describe("publishing a draft from its record's menu", () => {
  it("offers it before Discard draft, for the user's own unpublished draft", async () => {
    renderPublishing([gadget("g1", { draft: unpublished })]);

    await userEvent.click(rowActions("Gadget g1"));

    expect(
      within(await screen.findByRole("menu"))
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Publish draft…", "Discard draft", "Remove gadget"]);
  });

  it("isn't offered to a user who makes no drafts to publish", async () => {
    renderPublishing([gadget("g1", { draft: unpublished })], false);

    await userEvent.click(rowActions("Gadget g1"));
    await screen.findByRole("menuitem", { name: "Discard draft" });

    expect(
      screen.queryByRole("menuitem", { name: "Publish draft…" }),
    ).toBeNull();
  });

  it("publishes at once a draft that goes alone, saying so without Undo", async () => {
    // Given the user's draft, which goes with none of their other changes
    const fetch = serverAnswers({
      "GET /api/unpublished": () =>
        Response.json({ changes: [change("g1"), change("g2")] }),
      "POST /api/unpublished/publish": () =>
        Response.json({ total: 1, left: 0 }),
    });
    renderPublishing([gadget("g1", { draft: unpublished })]);

    // When it is published from its menu
    await publishFromMenu();

    // Then it alone is sent, with no question asked, and the notification says so
    expect(await screen.findByText("Published 1 change.")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/unpublished/publish")).toEqual([
      published,
    ]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("asks first when other changes go with it, naming them, then publishes them together", async () => {
    // Given the user's draft, which uses another of their changes, which uses a third
    const fetch = serverAnswers({
      "GET /api/unpublished": () =>
        Response.json({
          changes: [
            change("g1", ["list g2"]),
            change("g2", ["list g3"]),
            change("g3"),
            change("g4"),
          ],
        }),
      "POST /api/unpublished/publish": () =>
        Response.json({ total: 3, left: 0 }),
    });
    renderPublishing([gadget("g1", { draft: unpublished })]);

    // When it is published from its menu
    await publishFromMenu();

    // Then the question names it, then the changes going with it
    const dialog = await screen.findByRole("dialog", {
      name: "Publish 3 changes?",
    });
    expect(
      [...dialog.querySelectorAll("li, p")].map((item) => item.textContent),
    ).toEqual([
      "Changed the gadget g1",
      "Also publishes the changes it goes with:",
      "Changed the gadget g2",
      "Changed the gadget g3",
    ]);
    expect(bodyOf(fetch, "POST", "/api/unpublished/publish")).toEqual([]);

    // And when it is answered, they are published together
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Publish" }),
    );
    expect(await screen.findByText("Published 3 changes.")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/unpublished/publish")).toEqual([
      published,
    ]);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("puts focus back on the row's cell once it publishes at once", async () => {
    serverAnswers({
      "GET /api/unpublished": () => Response.json({ changes: [change("g1")] }),
      "POST /api/unpublished/publish": () =>
        Response.json({ total: 1, left: 0 }),
    });
    renderPublishing([gadget("g1", { draft: unpublished })]);

    await publishFromMenu();

    expect(await screen.findByText("Published 1 change.")).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement?.id).toMatch(/^cell-g1-/);
    });
  });

  it("puts focus back on the row's cell once the question is cancelled", async () => {
    serverAnswers({
      "GET /api/unpublished": () =>
        Response.json({ changes: [change("g1", ["list g2"]), change("g2")] }),
    });
    renderPublishing([gadget("g1", { draft: unpublished })]);
    await publishFromMenu();
    const dialog = await screen.findByRole("dialog");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    await waitFor(() => {
      expect(document.activeElement?.id).toMatch(/^cell-g1-/);
    });
  });

  it("publishes nothing when the question is cancelled", async () => {
    const fetch = serverAnswers({
      "GET /api/unpublished": () =>
        Response.json({ changes: [change("g1", ["list g2"]), change("g2")] }),
    });
    renderPublishing([gadget("g1", { draft: unpublished })]);
    await publishFromMenu();
    const dialog = await screen.findByRole("dialog", {
      name: "Publish 2 changes?",
    });

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(bodyOf(fetch, "POST", "/api/unpublished/publish")).toEqual([]);
  });

  it.each([
    [7, "and 1 other"],
    [8, "and 2 others"],
  ])(
    "names five of the changes going with it, then counts the rest, when %i go",
    async (going, rest) => {
      const others = Array.from({ length: going - 1 }, (_, index) =>
        change(`o${String(index)}`),
      );
      serverAnswers({
        "GET /api/unpublished": () =>
          Response.json({
            changes: [
              change(
                "g1",
                others.map(({ key }) => key),
              ),
              ...others,
            ],
          }),
      });
      renderPublishing([gadget("g1", { draft: unpublished })]);

      await publishFromMenu();

      const [, alongList] = within(
        await screen.findByRole("dialog"),
      ).getAllByRole("list") as [HTMLElement, HTMLElement];
      expect([
        within(alongList).getAllByRole("listitem").length,
        screen.getByText(rest).textContent,
      ]).toEqual([5, rest]);
    },
  );

  it("says so when the changes to publish can't be read", async () => {
    serverAnswers({
      "GET /api/unpublished": () => new Response(null, { status: 500 }),
    });
    renderPublishing([gadget("g1", { draft: unpublished })]);

    await publishFromMenu();

    expect(
      await screen.findByText("Fathom could not publish the changes."),
    ).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
