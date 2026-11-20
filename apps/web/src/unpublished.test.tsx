// SPDX-License-Identifier: Apache-2.0

// Tests for the user's unpublished changes in the top bar, with the server's responses simulated:
// shown only while there are any, to those who may make drafts, with Publish, and a menu naming them
// with Discard all, which asks first.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  renderApp,
  serverAnswers,
  wholeText,
} from "./test-support.tsx";
import { changeCount } from "./unpublished.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const editor = () =>
  Response.json({
    ...fictionalUser,
    permissions: ["people:view", "people:edit"],
  });

const changes = (total: number) => () =>
  Response.json({
    changes: Array.from({ length: total }, (_, index) => ({
      subject: `Fictional Person ${String(index + 1)}`,
      action: "changed",
      key: `person p${String(index + 1)}`,
      linked: [],
    })),
  });

const done =
  (total: number, left = 0) =>
  () =>
    Response.json({ total, left });

async function openHelp(answers: Parameters<typeof serverAnswers>[0]) {
  const fetch = serverAnswers({ "GET /api/session": editor, ...answers });
  renderApp("/help/drafts");
  await screen.findByRole("heading", { name: "Drafts", level: 1 });
  return fetch;
}

const posted = (fetch: ReturnType<typeof serverAnswers>, url: string) =>
  fetch.mock.calls.some(
    ([called, init]) => called === url && init?.method === "POST",
  );

describe("unpublished changes", () => {
  it("says what each change does, as a record's menu does", async () => {
    await openHelp({
      "GET /api/unpublished": () =>
        Response.json({
          changes: [
            { subject: "the list Equipment", action: "created" },
            { subject: "Fictional Person", action: "deleted" },
            { subject: "the new order for Sites" },
            { subject: "the new order for Levels", discarded: true },
            { subject: "Fictional Other", discarded: true },
          ].map((change, index) => ({
            ...change,
            key: `person p${String(index)}`,
            linked: [],
          })),
        }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Unpublished changes" }),
    );
    const menu = await screen.findByRole("menu");
    for (const line of [
      "Added the list Equipment",
      "Removed Fictional Person",
      "Reordered Sites",
      "Discarded the new order for Levels",
      "Discarded the draft of Fictional Other",
    ]) {
      expect(within(menu).getByText(wholeText(line))).toBeDefined();
    }
  });

  it("counts them, names them in a menu, and publishes them all", async () => {
    const fetch = await openHelp({
      "GET /api/unpublished": changes(2),
      "POST /api/unpublished/publish": done(2),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Unpublished changes" }),
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Unpublished changes")).toBeDefined();
    expect(
      within(menu).getByText(
        "Nobody else sees these changes until they're published.",
      ),
    ).toBeDefined();
    expect(
      within(menu).getByText(wholeText("Changed Fictional Person 2")),
    ).toBeDefined();
    expect(within(menu).queryByText(/more$/)).toBeNull();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      await screen.findByRole("button", { name: "Publish 2 changes" }),
    );
    expect(await screen.findByText("Published 2 changes.")).toBeDefined();
    expect(posted(fetch, "/api/unpublished/publish")).toBe(true);
  });

  it.each([
    [2, 1, "Published 2 changes. 1 needs another role."],
    [1, 2, "Published 1 change. 2 need another role."],
    [0, 1, "Nothing was published. 1 change needs another role."],
    [0, 2, "Nothing was published. 2 changes need another role."],
  ])(
    "says it published %i changes and left %i for another role",
    async (total, left, words) => {
      await openHelp({
        "GET /api/unpublished": changes(total + left),
        "POST /api/unpublished/publish": done(total, left),
      });
      await userEvent.click(
        await screen.findByRole("button", {
          name: `Publish ${changeCount(total + left)}`,
        }),
      );
      expect(await screen.findByText(words)).toBeDefined();
    },
  );

  it("names ten and counts the rest, and says one change", async () => {
    await openHelp({ "GET /api/unpublished": changes(12) });
    await userEvent.click(
      await screen.findByRole("button", { name: "Unpublished changes" }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu).getByText(wholeText("Changed Fictional Person 10")),
    ).toBeDefined();
    expect(
      within(menu).queryByText(wholeText("Changed Fictional Person 11")),
    ).toBeNull();
    expect(within(menu).getByText("and 2 more")).toBeDefined();
    vi.unstubAllGlobals();
    await openHelp({ "GET /api/unpublished": changes(1) });
    expect(
      await screen.findByRole("button", { name: "Publish 1 change" }),
    ).toBeDefined();
  });

  it("discards them all after asking, and can be cancelled", async () => {
    const fetch = await openHelp({
      "GET /api/unpublished": changes(2),
      "POST /api/unpublished/discard": done(2),
    });
    const chooseDiscard = async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: "Unpublished changes" }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Discard all…" }),
      );
      return screen.findByRole("dialog", { name: "Discard 2 changes?" });
    };
    await chooseDiscard();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    let dialog = await chooseDiscard();
    expect(
      within(dialog).getByText(
        "The unpublished changes are discarded. This cannot be undone.",
      ),
    ).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(posted(fetch, "/api/unpublished/discard")).toBe(false);
    dialog = await chooseDiscard();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Discard" }),
    );
    expect(await screen.findByText("Discarded 2 changes.")).toBeDefined();
    expect(posted(fetch, "/api/unpublished/discard")).toBe(true);
  });

  it("says when publishing or discarding fails", async () => {
    const broken = () => Response.json({}, { status: 500 });
    await openHelp({
      "GET /api/unpublished": changes(2),
      "POST /api/unpublished/publish": broken,
      "POST /api/unpublished/discard": broken,
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Publish 2 changes" }),
    );
    expect(
      await screen.findByText("Fathom could not publish the changes."),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("button", { name: "Unpublished changes" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Discard all…" }),
    );
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Discard 2 changes?" }),
      ).getByRole("button", { name: "Discard" }),
    );
    expect(
      await screen.findByText("Fathom could not discard the changes."),
    ).toBeDefined();
  });

  it("shows nothing without changes, or to those who may not make drafts", async () => {
    const fetch = await openHelp({ "GET /api/unpublished": changes(0) });
    await waitFor(() => {
      expect(fetch.mock.calls.some(([url]) => url === "/api/unpublished")).toBe(
        true,
      );
    });
    expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();
    vi.unstubAllGlobals();
    const viewer = serverAnswers({
      "GET /api/session": () => Response.json(fictionalUser),
    });
    renderApp("/help/drafts");
    await screen.findAllByRole("heading", { name: "Drafts", level: 1 });
    expect(viewer.mock.calls.some(([url]) => url === "/api/unpublished")).toBe(
      false,
    );
  });
});
