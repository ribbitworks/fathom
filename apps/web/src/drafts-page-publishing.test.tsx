// SPDX-License-Identifier: Apache-2.0

// Tests for one's own and held drafts on the Drafts page: listing unpublished and held drafts,
// and publishing and discarding one's own changes.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf } from "./test-support.tsx";
import {
  sites,
  draft,
  changed,
  added,
  removed,
  peopleWith,
  type Answers,
  openDrafts,
  entries,
} from "./test-drafts-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("unpublished and held drafts on the Drafts page", () => {
  it("lists drafts someone is changing under All drafts, not To decide, and one's own unpublished drafts under Not published", async () => {
    await openDrafts(
      {
        "GET /api/people": peopleWith([
          { ...changed, heldBy: "Second Fictional Editor" },
          {
            ...added,
            draft: draft({
              action: "created",
              changed: ["preferredName", "employeeId", "f1"],
              unpublished: true,
            }),
          },
          removed,
        ]),
      },
      "/drafts?tab=all",
    );
    const records = async () =>
      (await entries()).map((text) => text.split(" | ")[0]);
    expect(await records()).toEqual([
      "Avery Fictional, Draft, being changed by Second Fictional Editor",
      "Casey Fictional, Draft: removed",
    ]);

    // And To decide holds only the draft nobody is changing
    await userEvent.click(screen.getByRole("tab", { name: /^To decide/u }));
    await waitFor(async () => {
      expect(await records()).toEqual(["Casey Fictional, Draft: removed"]);
    });

    // And one's own unpublished draft is under Not published, with no Made by
    await userEvent.click(screen.getByRole("tab", { name: /^Not published/u }));
    await waitFor(async () => {
      expect(await entries()).toEqual([
        "Blake Fictional, Draft: added, unpublished | Added | Not published | ID set to E-p2; Site set to Harbour | Person | People | Oct 30, 2026 | ",
      ]);
    });
    expect(
      screen.getByRole("checkbox", {
        name: "Select the change to Blake Fictional",
      }),
    ).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /^Made by column/u }),
    ).toBeNull();
  });
});

describe("publishing and discarding one's own changes on the Drafts page", () => {
  const own = (fields: object = {}) =>
    draft({
      action: "created",
      changed: [],
      live: {},
      unpublished: true,
      ...fields,
    });
  // A list only drafted to be added, with choices added to it, and an unrelated person, all the
  // reader's own unpublished changes.
  const equipment = (labels: string[]) => ({
    id: "l9",
    keyNumber: 9,
    name: "Equipment",
    description: "",
    visibility: "general",
    retired: false,
    choices: labels.map((label, index) => ({
      id: `c9${String(index)}`,
      label,
      description: "",
      retired: false,
      draft: own(),
    })),
    draft: own(),
  });
  const ownPerson = {
    ...added,
    draft: draft({
      action: "created",
      changed: ["preferredName"],
      unpublished: true,
    }),
  };
  // The changes as the server lists and links them: each choice uses the list it is added to.
  const linked = (labels: string[]) => () =>
    Response.json({
      changes: [
        {
          subject: "the list Equipment",
          action: "created",
          key: "list l9",
          linked: [],
        },
        ...labels.map((label, index) => ({
          subject: `the choice ${label} in Equipment`,
          action: "created",
          key: `list-item c9${String(index)}`,
          linked: ["list l9"],
        })),
        // A change the page doesn't list, linked to the list.
        {
          subject: "a column",
          action: "created",
          key: "field f-unlisted",
          linked: ["list l9"],
        },
        {
          subject: "Blake Fictional",
          action: "created",
          key: `person ${added.id}`,
          linked: [],
        },
      ],
    });
  const openOwn = (labels: string[] = ["Laptop"], answers: Answers = {}) =>
    openDrafts(
      {
        "GET /api/people": peopleWith([ownPerson]),
        "GET /api/lists": () =>
          Response.json({ lists: [sites, equipment(labels)] }),
        "GET /api/unpublished": linked(labels),
        ...answers,
      },
      "/drafts?tab=unpublished",
    );
  const box = (record: string) =>
    screen.getByRole("checkbox", { name: `Select the change to ${record}` });
  const selection = (more: object) => ({
    people: [],
    plannedHires: [],
    featureTeams: [],
    lists: [],
    choices: [],
    orders: [],
    columns: [],
    records: [],
    ...more,
  });

  it("ticks a change with every change linked to it, both ways, and unticks them together", async () => {
    // Given a list only drafted to be added, a choice added to it, and an unrelated change
    await openOwn();
    await screen.findByRole("checkbox", {
      name: "Select the change to Equipment",
    });

    // When the list is ticked
    await userEvent.click(box("Equipment"));

    // Then the choice that uses it is ticked too, and nothing else
    expect(box("Laptop in Equipment")).toHaveProperty("checked", true);
    expect(box("Blake Fictional")).toHaveProperty("checked", false);
    expect(
      screen.getByRole("button", { name: "Publish 2 changes" }),
    ).toBeDefined();

    // And unticking the choice unticks the list it uses
    await userEvent.click(box("Laptop in Equipment"));
    expect(box("Equipment")).toHaveProperty("checked", false);
    expect(
      screen.queryByRole("button", { name: "Publish 2 changes" }),
    ).toBeNull();

    // And ticking the choice ticks the list it uses
    await userEvent.click(box("Laptop in Equipment"));
    expect(box("Equipment")).toHaveProperty("checked", true);
  });

  it("names the changes a tick is linked to in its tip, and gives an unlinked change none", async () => {
    await openOwn();
    await screen.findByRole("checkbox", {
      name: "Select the change to Equipment",
    });
    const tipOf = (record: string) =>
      box(record).closest("[data-tip]")?.getAttribute("data-tip");
    expect(tipOf("Equipment")).toBe(
      "Linked to the change to Laptop in Equipment",
    );
    expect(box("Equipment").getAttribute("aria-description")).toBe(
      "Linked to the change to Laptop in Equipment",
    );
    expect(tipOf("Laptop in Equipment")).toBe(
      "Linked to the change to Equipment",
    );
    expect(tipOf("Blake Fictional")).toBeUndefined();
    expect(box("Blake Fictional").getAttribute("aria-description")).toBeNull();
  });

  it("names several linked changes in one tip", async () => {
    await openOwn(["Laptop", "Monitor"]);
    await screen.findByRole("checkbox", {
      name: "Select the change to Equipment",
    });
    expect(
      box("Equipment").closest("[data-tip]")?.getAttribute("data-tip"),
    ).toBe(
      "Linked to the changes to Laptop in Equipment and Monitor in Equipment",
    );
  });

  it("publishes exactly the changes ticked, saying how many, and unticks them", async () => {
    // Given the list and its choice ticked together
    const { fetch } = await openOwn(["Laptop"], {
      "POST /api/unpublished/publish": () =>
        Response.json({ total: 2, left: 0 }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the change to Laptop in Equipment",
      }),
    );

    // When Publish is chosen, which doesn't ask first
    await userEvent.click(
      screen.getByRole("button", { name: "Publish 2 changes" }),
    );

    // Then the ticked changes alone are published, and the page says so
    expect(await screen.findByText("Published 2 changes.")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/unpublished/publish")).toEqual([
      { drafts: selection({ lists: ["l9"], choices: ["c90"] }) },
    ]);
    await waitFor(() => {
      expect(box("Equipment")).toHaveProperty("checked", false);
    });
  });

  it("asks before discarding the changes ticked, and keeps them ticked when cancelled", async () => {
    const { fetch } = await openOwn(["Laptop"], {
      "POST /api/unpublished/discard": () => Response.json({ total: 1 }),
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the change to Blake Fictional",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Discard 1 change…" }),
    );
    const asking = await screen.findByRole("dialog", {
      name: "Discard 1 change?",
    });
    expect(
      within(asking).getByText(
        "The chosen change is discarded. This cannot be undone.",
      ),
    ).toBeDefined();
    await userEvent.click(
      within(asking).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(bodyOf(fetch, "POST", "/api/unpublished/discard")).toEqual([]);
    expect(box("Blake Fictional")).toHaveProperty("checked", true);

    // And discarding it, once asked, discards only that change
    await userEvent.click(
      screen.getByRole("button", { name: "Discard 1 change…" }),
    );
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Discard 1 change?" }),
      ).getByRole("button", { name: "Discard" }),
    );
    expect(await screen.findByText("Discarded 1 change.")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/unpublished/discard")).toEqual([
      { drafts: selection({ people: ["p2"] }) },
    ]);
  });

  it("asks before discarding several changes in the plural", async () => {
    await openOwn();
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the change to Equipment",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Discard 2 changes…" }),
    );
    expect(
      within(
        await screen.findByRole("dialog", { name: "Discard 2 changes?" }),
      ).getByText("The chosen changes are discarded. This cannot be undone."),
    ).toBeDefined();
  });

  it("unticks changes a search hides, so only changes in sight are published", async () => {
    await openOwn();
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the change to Equipment",
      }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search drafts" }),
      "Blake",
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Publish 2 changes" }),
      ).toBeNull();
    });
    await userEvent.clear(
      screen.getByRole("textbox", { name: "Search drafts" }),
    );
    expect(
      await screen.findByRole("checkbox", {
        name: "Select the change to Equipment",
      }),
    ).toHaveProperty("checked", false);
  });

  it("names the first three linked changes in a tip, and counts the rest", async () => {
    await openOwn(["Laptop", "Monitor", "Dock", "Mouse", "Stand"]);
    await screen.findByRole("checkbox", {
      name: "Select the change to Equipment",
    });
    expect(box("Equipment").getAttribute("aria-description")).toBe(
      "Linked to the changes to Laptop in Equipment, Monitor in Equipment, Dock in Equipment and 2 more",
    );
  });

  it("settles with nothing ticked once the changes ticked are published from the top bar", async () => {
    // Given the list and its choice ticked
    let published = false;
    await openOwn(["Laptop"], {
      "GET /api/unpublished": () =>
        published ? Response.json({ changes: [] }) : linked(["Laptop"])(),
      "GET /api/lists": () =>
        Response.json({
          lists: published ? [sites] : [sites, equipment(["Laptop"])],
        }),
      "POST /api/unpublished/publish": () => {
        published = true;
        return Response.json({ total: 4, left: 0 });
      },
    });
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select the change to Equipment",
      }),
    );

    // When every change is published from the top bar
    await userEvent.click(
      screen.getByRole("button", { name: "Publish 4 changes" }),
    );

    // Then the page settles, with nothing left to publish from its heading
    expect(await screen.findByText("Published 4 changes.")).toBeDefined();
    await waitFor(() => {
      expect(
        screen.queryByRole("checkbox", {
          name: "Select the change to Equipment",
        }),
      ).toBeNull();
    });
    expect(
      screen.queryByRole("button", { name: "Publish 2 changes" }),
    ).toBeNull();
  });

  it("can't tick a change whose linked change the search hides, and says so", async () => {
    // Given a search that shows the choice but not the list it uses
    await openOwn();
    await screen.findByRole("checkbox", {
      name: "Select the change to Equipment",
    });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search drafts" }),
      "Laptop",
    );

    // Then the choice can't be ticked, and its tip says the list isn't shown
    await waitFor(() => {
      expect(box("Laptop in Equipment")).toHaveProperty("disabled", true);
    });
    expect(box("Laptop in Equipment").getAttribute("aria-description")).toBe(
      "Linked to the change to Equipment, not shown in the table",
    );
  });

  it("links a change's details to the changes linked to it, each opening its own details", async () => {
    // Given the list's details open on Not published
    await openOwn();
    await userEvent.click(
      await screen.findByRole("button", { name: "Show details of Equipment" }),
    );
    const linked = await screen.findByRole("region", { name: "Linked to" });

    // When the linked choice is followed
    await userEvent.click(
      within(linked).getByRole("button", {
        name: /^#LIST-\d+ Laptop in Equipment$/u,
      }),
    );

    // Then the choice's details open, linked back to the list
    await waitFor(() => {
      expect(
        within(screen.getByRole("region", { name: "Linked to" })).getByRole(
          "button",
          { name: /^#LIST-\d+ Equipment$/u },
        ),
      ).toBeDefined();
    });
  });

  it("gives an unlinked change's details no Linked to", async () => {
    await openOwn();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Blake Fictional",
      }),
    );
    await screen.findByRole("region", { name: "Details" });
    expect(screen.queryByRole("region", { name: "Linked to" })).toBeNull();
  });

  it("names no Linked to in the details of a published draft", async () => {
    // A published list only drafted to be added, with a choice added to it
    const published = (more: object = {}) =>
      draft({ action: "created", changed: [], live: {}, ...more });
    await openDrafts({
      "GET /api/people": peopleWith([]),
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...equipment(["Laptop"]),
              draft: published(),
              choices: [
                {
                  id: "c90",
                  label: "Laptop",
                  description: "",
                  retired: false,
                  draft: published(),
                },
              ],
            },
          ],
        }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Show details of Equipment" }),
    );
    await screen.findByRole("region", { name: "Details" });
    expect(screen.queryByRole("region", { name: "Linked to" })).toBeNull();
  });
});
