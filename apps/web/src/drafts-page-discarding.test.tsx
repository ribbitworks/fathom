// SPDX-License-Identifier: Apache-2.0

// Tests for discarding and resubmitting a published draft from its row's menu and its details'
// menu on the Drafts page, for those the server lets discard it, against a simulated server.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { notAllowedMessage } from "./api.ts";
import { draftPanelId } from "./drafts-panel.tsx";
import {
  draft,
  openDrafts,
  peopleWith,
  person,
  rejected,
  s1,
} from "./test-drafts-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const saved = () => Response.json({ changeSetId: s1 });

const renamed = (fields: object = {}) =>
  person("p1", "Avery Fictional", {
    draft: draft({
      action: "changed",
      changed: ["preferredName"],
      live: { preferredName: "Avery Before", values: {} },
      ...fields,
    }),
  });

// A server whose draft of Avery Fictional, which the user may discard, goes once discarded and
// comes back once the discard is undone, beside another draft.
function discardingServer(
  discard: () => Response | Promise<Response> = saved,
  newer: object[] = [],
) {
  let discarded = false;
  return {
    "GET /api/people": () =>
      peopleWith(
        discarded
          ? [...newer, rejected]
          : [...newer, renamed({ discardable: true }), rejected],
      )(),
    "DELETE /api/people/p1/draft": async () => {
      const answer = await discard();
      discarded = answer.ok;
      return answer;
    },
    [`POST /api/undo/${s1}`]: () => {
      discarded = false;
      return Response.json({ changeSetId: null });
    },
  };
}

const detailsButton = (record: string) =>
  screen.queryByRole("button", { name: `Show details of ${record}` });

// The items of a draft's row menu, by its record's name.
async function rowMenuItems(record: string) {
  // A row has two, one beside its name and one at its end, which open the same menu.
  const [rowMenu] = await screen.findAllByRole("button", {
    name: `Actions for ${record}`,
  });
  await userEvent.click(rowMenu as HTMLElement);
  return (await screen.findAllByRole("menuitem")).map(
    ({ textContent }) => textContent,
  );
}

async function discardFromRow(record: string) {
  expect(await rowMenuItems(record)).toContain("Discard draft");
  await userEvent.click(
    screen.getByRole("menuitem", { name: "Discard draft" }),
  );
}

const sentTo = (fetch: ReturnType<typeof vi.fn>, method: string) =>
  fetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === method)
    .map(([url]) => url as string);

describe("a published draft on the Drafts page", () => {
  it("is discarded from its row's menu by whoever may discard it, its row leaving", async () => {
    const { fetch } = await openDrafts(discardingServer(), "/drafts?tab=all");
    await discardFromRow("Avery Fictional");
    expect(
      await screen.findByText("Discarded the draft of Avery Fictional."),
    ).toBeDefined();
    expect(sentTo(fetch, "DELETE")).toEqual(["/api/people/p1/draft"]);
    expect(detailsButton("Avery Fictional")).toBeNull();
  });

  it("leaves the table at once, before the drafts are read again", async () => {
    let answer: (response: Response) => void = () => undefined;
    await openDrafts(
      discardingServer(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      ),
      "/drafts?tab=all",
    );
    await discardFromRow("Avery Fictional");
    expect(detailsButton("Avery Fictional")).toBeNull();
    answer(saved());
    expect(
      await screen.findByText("Discarded the draft of Avery Fictional."),
    ).toBeDefined();
  });

  it("is discarded from To decide too", async () => {
    await openDrafts(discardingServer());
    await discardFromRow("Avery Fictional");
    expect(
      await screen.findByText("Discarded the draft of Avery Fictional."),
    ).toBeDefined();
  });

  it("comes back when its discard is undone from the notification", async () => {
    const { fetch } = await openDrafts(discardingServer(), "/drafts?tab=all");
    await discardFromRow("Avery Fictional");
    await screen.findByText("Discarded the draft of Avery Fictional.");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(detailsButton("Avery Fictional")).not.toBeNull();
    });
    expect(sentTo(fetch, "POST")).toContain(`/api/undo/${s1}`);
  });

  it("comes back when its discard is undone from the keyboard", async () => {
    const { fetch } = await openDrafts(discardingServer(), "/drafts?tab=all");
    await discardFromRow("Avery Fictional");
    await screen.findByText("Discarded the draft of Avery Fictional.");
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => {
      expect(detailsButton("Avery Fictional")).not.toBeNull();
    });
    expect(sentTo(fetch, "POST")).toContain(`/api/undo/${s1}`);
  });

  it("stays, saying so, when the server refuses its discard", async () => {
    await openDrafts(
      discardingServer(() =>
        Response.json(
          { error: "Only someone who changed this draft can discard it." },
          { status: 403 },
        ),
      ),
      "/drafts?tab=all",
    );
    await discardFromRow("Avery Fictional");
    expect(await screen.findByText(notAllowedMessage)).toBeDefined();
    await waitFor(() => {
      expect(detailsButton("Avery Fictional")).not.toBeNull();
    });
  });

  it("offers no Discard draft to those the server doesn't let discard it", async () => {
    await openDrafts(
      { "GET /api/people": peopleWith([renamed()]) },
      "/drafts?tab=all",
    );
    expect(await rowMenuItems("Avery Fictional")).not.toContain(
      "Discard draft",
    );
  });

  it("is discarded from its details' menu too, focus going back to the table", async () => {
    const { fetch } = await openDrafts(discardingServer(), "/drafts?tab=all");
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Avery Fictional",
      }),
    );
    await screen.findByRole("region", { name: "Details" });
    const panel = document.getElementById(draftPanelId) as HTMLElement;
    await userEvent.click(
      within(panel).getByRole("button", {
        name: "Actions for Avery Fictional",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Discard draft" }),
    );
    await waitFor(() => {
      expect(sentTo(fetch, "DELETE")).toEqual(["/api/people/p1/draft"]);
    });
    await waitFor(() => {
      expect(
        document.activeElement
          ?.closest('[role="grid"]')
          ?.getAttribute("aria-label"),
      ).toBe("Drafts");
    });
  });

  it("puts focus on the next row once discarded with the mouse from its row's menu", async () => {
    // Given a newer draft before it, so its row is not the first
    const removing = person("p6", "Finley Fictional", {
      draft: draft({ action: "deleted", madeAt: "2026-11-01T09:00:00.000Z" }),
    });
    await openDrafts(discardingServer(saved, [removing]), "/drafts?tab=all");
    // When it is discarded from its row's menu
    await discardFromRow("Avery Fictional");
    // Then focus is on the row after it
    await waitFor(() => {
      expect(document.activeElement?.closest("tr")?.textContent).toContain(
        "Drew Fictional",
      );
    });
  });

  it("is resubmitted from its row's menu once rejected, by whoever made it", async () => {
    const { fetch } = await openDrafts(
      {
        "GET /api/people": peopleWith([
          renamed({
            discardable: true,
            state: "rejected",
            reason: "Fictional reason",
          }),
        ]),
        "DELETE /api/people/p1/draft/rejection": saved,
      },
      "/drafts?tab=all",
    );
    expect(await rowMenuItems("Avery Fictional")).toContain("Resubmit");
    await userEvent.click(screen.getByRole("menuitem", { name: "Resubmit" }));
    expect(
      await screen.findByText("Resubmitted the draft of Avery Fictional."),
    ).toBeDefined();
    expect(sentTo(fetch, "DELETE")).toEqual(["/api/people/p1/draft/rejection"]);
  });

  it("leaves one's own unpublished changes to Not published's buttons", async () => {
    await openDrafts(
      {
        "GET /api/people": peopleWith([
          renamed({ discardable: true, unpublished: true }),
        ]),
        "GET /api/unpublished": () => Response.json({ changes: [] }),
      },
      "/drafts?tab=unpublished",
    );
    expect(await rowMenuItems("Avery Fictional")).not.toContain(
      "Discard draft",
    );
  });
});
