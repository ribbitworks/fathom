// SPDX-License-Identifier: Apache-2.0

// Tests for a release's details: its values, note, features, key and links, and the changes made
// from them.

import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReleasesTable } from "./release-tab.tsx";
import type { SavedViews } from "./table-controls.tsx";
import { emptyView } from "./table-view.ts";
import {
  fictionalRelease,
  fictionalStream,
  streamId,
} from "./test-releases.ts";
import {
  bodyOf,
  detailRow,
  detailValue,
  fictionalFeature,
  planAnswers,
  recordCell,
  recordDraft,
  testTheme,
  featuresAddress,
  openedIn,
} from "./test-support.tsx";
import {
  setUpEachTest,
  changeSetId,
  release,
  releasePath,
  shippedId,
  shipped,
  editsReleases,
  openPage,
  openRelease,
  inStream,
  searchOf,
  chooseRowAction,
} from "./test-release-tab.tsx";

setUpEachTest();

// No saved views, for the tab drawn on its own.
const noSavedViews: SavedViews = {
  views: [],
  unusable: [],
  applied: undefined,
  onApply: vi.fn(),
  onSave: vi.fn(),
  onRename: vi.fn(),
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onDeleteUnusable: vi.fn(),
  onScope: vi.fn(),
};

const releasePanel = () =>
  screen.getByRole("region", { name: "Fictional One" });

describe("a release's details", () => {
  it("show the table's values in its order, then its colour and note, with Not shipped for a release to come", async () => {
    await openRelease(
      inStream(fictionalRelease({ colour: "grape", note: "Fictional words" })),
    );
    const labels = [...releasePanel().querySelectorAll("dt")].map(
      ({ textContent }) => textContent,
    );
    expect(labels).toEqual([
      "Release",
      "Schedule",
      "Ships on",
      "Cycles",
      "Status",
      "Colour",
      "Note",
    ]);
    expect(
      labels.slice(0, -1).map((label) => detailValue(label, releasePanel())),
    ).toEqual([
      "Fictional One",
      "Fictional Majors",
      "Mar 31, 2027",
      "27.1",
      "Not shipped",
      "Grape",
    ]);
  });

  it("mark a value a draft changes, with the value as it is live under it", async () => {
    await openRelease(
      inStream(
        fictionalRelease({
          colour: "grape",
          draft: recordDraft({ changed: ["colour"], live: { colour: null } }),
        }),
      ),
    );
    expect(detailValue("Colour", releasePanel())).toBe(
      "Grape, Draft: changed from “Sea”Sea, live",
    );
  });

  it("mark the note when a draft changes it", async () => {
    await openRelease(
      inStream(
        fictionalRelease({
          note: "Fictional words",
          draft: recordDraft({ changed: ["note"], live: { note: null } }),
        }),
      ),
    );
    expect(detailValue("Note", releasePanel())).toBe("Fictional words, Draft");
  });

  it("open from the address even while shipped releases are hidden", async () => {
    await openPage(inStream(release, shipped), {
      path: `/releases?open=${shippedId}`,
    });
    expect(
      await screen.findByRole("heading", {
        name: "Fictional Shipped",
        level: 2,
      }),
    ).toBeDefined();
  });

  it("put focus on the release's name when they open", async () => {
    await openRelease(inStream(release));
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Fictional One");
    });
  });

  it("close from Close details, putting focus back on the release's name in the table", async () => {
    const { history } = await openRelease(inStream(release));
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(searchOf(history).has("open")).toBe(false);
      expect(document.activeElement).toBe(recordCell(release.id, "name"));
    });
  });
});

describe("changing a release from its details", () => {
  it.each([
    ["Release", "Rename Fictional One", ["Name"]],
    ["Ships on", "Change when Fictional One ships", ["Ships on"]],
    [
      "Cycles",
      "Change the cycles of Fictional One",
      ["First cycle", "Last cycle"],
    ],
    ["Colour", "Change the colour of Fictional One", ["Colour"]],
  ])(
    "asks only for the value changed from %s's pencil",
    async (label, title, fields) => {
      await openRelease(inStream(release), { can: editsReleases });
      await userEvent.click(
        within(releasePanel()).getByRole("button", { name: `Change ${label}` }),
      );
      const dialog = await screen.findByRole("dialog", { name: title });
      expect(
        [...dialog.querySelectorAll("label")].map(
          ({ textContent }) => textContent,
        ),
      ).toEqual(fields);
    },
  );

  it("drafts the change, saying so", async () => {
    const { fetch } = await openRelease(inStream(release), {
      can: editsReleases,
      answers: {
        [`PUT ${releasePath}`]: () =>
          Response.json({ stream: fictionalStream(), changeSetId }),
      },
    });
    await userEvent.click(
      within(releasePanel()).getByRole("button", { name: "Change Release" }),
    );
    const name = await screen.findByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Fictional Renamed{Enter}");
    expect(
      await screen.findByText("Drafted the change to the release."),
    ).toBeDefined();
    expect(bodyOf(fetch, "PUT", releasePath)).toEqual([
      {
        name: "Fictional Renamed",
        firstCycle: release.firstCycle,
        lastCycle: release.lastCycle,
        shipsOn: null,
        colour: null,
      },
    ]);
  });

  it.each([
    [
      "in a retired schedule",
      [fictionalStream({ retired: true, releases: [release] })],
      editsReleases,
      "",
    ],
    [
      "being changed by someone else",
      inStream(fictionalRelease({ heldBy: "Fictional Editor" })),
      editsReleases,
      "",
    ],
    [
      "drafted to be removed",
      inStream(fictionalRelease({ draft: recordDraft({ action: "deleted" }) })),
      editsReleases,
      "",
    ],
    ["shown as it is live", inStream(release), editsReleases, "&show=live"],
    ["to a role that doesn't change releases", inStream(release), {}, ""],
  ])("is not offered for a release %s", async (_, shown, can, view) => {
    await openRelease(shown, {
      can,
      path: `/releases?open=${release.id}${view}`,
    });
    expect(
      within(releasePanel()).queryByRole("button", { name: "Change Release" }),
    ).toBeNull();
  });
});

describe("a release's note", () => {
  const notePanel = () =>
    screen.findByRole("region", { name: "Note for Fictional One" });

  it("is added from its row's menu, opening the release's details and the note", async () => {
    const { history } = await openPage(inStream(release), {
      can: editsReleases,
    });
    await chooseRowAction("Fictional One", "Add note…");
    expect(await notePanel()).toBeDefined();
    expect(searchOf(history).get("open")).toBe(release.id);
  });

  it.each([
    ["once its release's details open", true, 1],
    ["when its release's details can't open now", false, 0],
  ] as const)(
    "is started from another release's menu %s",
    async (_, opens, started) => {
      const two = fictionalRelease({
        id: "30000000-0000-4000-8000-000000000003",
        name: "Fictional Two",
      });
      const start = vi.fn<(note: { name: string }) => void>();
      const shown = (open: string) => (
        <MantineProvider theme={testTheme}>
          <ReleasesTable
            streams={inStream(release, two)}
            day="2027-02-15"
            view={emptyView}
            onView={vi.fn()}
            approves={[]}
            saved={noSavedViews}
            canEdit
            narrow={false}
            open={open}
            onOpen={(_id, opened) => {
              if (opens) opened?.();
            }}
            onClose={vi.fn()}
            planned={undefined}
            onFeatures={vi.fn()}
            showIn={vi.fn()}
            notes={{ start, reopen: vi.fn(), asking: undefined }}
            notePanel={undefined}
            onChange={vi.fn()}
            run={vi.fn()}
            decide={vi.fn()}
          />
        </MantineProvider>
      );
      const { rerender } = render(shown(release.id));
      await chooseRowAction("Fictional Two", "Add note…");
      rerender(shown(two.id));
      await screen.findByRole("heading", { name: "Fictional Two", level: 2 });
      expect(start.mock.calls.map(([note]) => note.name)).toEqual(
        Array.from({ length: started }, () => "Fictional Two"),
      );
    },
  );

  it("is added from the menu of the release already open", async () => {
    await openRelease(inStream(release), { can: editsReleases });
    await chooseRowAction("Fictional One", "Add note…");
    expect(await notePanel()).toBeDefined();
  });

  it("is drafted once written, saying so", async () => {
    const { fetch } = await openRelease(inStream(release), {
      can: editsReleases,
      answers: {
        [`PUT ${releasePath}/note`]: () =>
          Response.json({ stream: fictionalStream(), changeSetId }),
      },
    });
    await chooseRowAction("Fictional One", "Add note…");
    const opened = await notePanel();
    await userEvent.click(within(opened).getByText("Markdown"));
    await userEvent.type(
      within(opened).getByRole("textbox", { name: "Markdown" }),
      "Fictional words",
    );
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Drafted the note on Fictional One."),
    ).toBeDefined();
    expect(bodyOf(fetch, "PUT", `${releasePath}/note`)).toEqual([
      { note: "Fictional words" },
    ]);
  });

  it("is drafted to be removed once emptied, saying so", async () => {
    const { fetch } = await openRelease(
      inStream(fictionalRelease({ note: "Fictional words" })),
      {
        can: editsReleases,
        answers: {
          [`PUT ${releasePath}/note`]: () =>
            Response.json({ stream: fictionalStream(), changeSetId }),
        },
      },
    );
    await userEvent.click(
      within(releasePanel()).getByRole("button", { name: "Open Note" }),
    );
    const opened = await notePanel();
    await userEvent.click(await within(opened).findByText("Markdown"));
    await userEvent.clear(
      within(opened).getByRole("textbox", { name: "Markdown" }),
    );
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Drafted removing the note on Fictional One."),
    ).toBeDefined();
    expect(bodyOf(fetch, "PUT", `${releasePath}/note`)).toEqual([
      { note: null },
    ]);
  });

  it("is read only for a release that can't be changed now", async () => {
    await openRelease(inStream(fictionalRelease({ note: "Fictional words" })));
    await userEvent.click(
      within(releasePanel()).getByRole("button", { name: "Open Note" }),
    );
    const opened = await notePanel();
    await within(opened).findByRole("button", { name: "Close note" });
    expect(within(opened).queryByText("Markdown")).toBeNull();
  });

  it("is not offered from the menu of a release with one", async () => {
    await openPage(inStream(fictionalRelease({ note: "Fictional words" })), {
      can: editsReleases,
    });
    const [more] = within(
      screen.getByRole("grid", { name: "Releases" }),
    ).getAllByRole("button", { name: "Actions for Fictional One" });
    await userEvent.click(more as HTMLElement);
    const menu = await screen.findByRole("menu");
    await within(menu).findByRole("menuitem", { name: "Remove release" });
    expect(
      within(menu).queryByRole("menuitem", { name: "Add note…" }),
    ).toBeNull();
  });
});

describe("a release's features", () => {
  const spanning = fictionalRelease({ lastCycle: "2027-04-01" });
  const inCycle = (name: string, targetCycle: string, at: number) =>
    fictionalFeature({
      id: `60000000-0000-4000-8000-00000000000${String(at)}`,
      name,
      targetStreamId: streamId,
      targetCycle,
    });
  const answers = planAnswers([
    inCycle("Fictional Sync", "2027-01-01", 1),
    inCycle("Fictional Maps", "2027-04-01", 2),
    inCycle("Fictional Later", "2027-07-01", 3),
  ]);
  // The Features row of the release's details, once the features are read.
  const section = async () => {
    await within(releasePanel()).findByRole("button", {
      name: "Fictional Sync",
    });
    return detailRow("Features", releasePanel());
  };

  it("names those in every cycle it spans, in one line in the table and one to a line in its details", async () => {
    await openRelease(inStream(spanning), { answers });

    const listed = await section();
    expect(
      within(listed)
        .getAllByRole("button")
        .map(({ textContent }) => textContent),
    ).toEqual([
      "Fictional Sync",
      "Fictional Maps",
      "Show on Features",
      "Show on the Board",
    ]);
    expect(recordCell(spanning.id, "features")?.textContent).toBe(
      "Fictional Sync, Fictional Maps",
    );
  });

  it.each([
    ["Show on Features", {}],
    [
      "Show on the Board",
      { mode: "board", stream: streamId, from: "2027-01-01" },
    ],
  ])("shows them with %s, filtered to the release", async (button, board) => {
    const user = userEvent.setup();
    const { history } = await openRelease(inStream(spanning), { answers });

    await user.click(
      within(await section()).getByRole("button", { name: button }),
    );

    expect(featuresAddress(history)).toEqual({
      page: "/features",
      filters: { release: { any: [`${streamId} ${spanning.id}`] } },
      board,
    });
  });

  it("opens a feature's details on Features", async () => {
    const user = userEvent.setup();
    const { history } = await openRelease(inStream(spanning), { answers });

    await user.click(
      within(await section()).getByRole("button", { name: "Fictional Sync" }),
    );

    expect([history.location.pathname, searchOf(history).get("open")]).toEqual([
      "/features",
      "60000000-0000-4000-8000-000000000001",
    ]);
  });
});

describe("links from a release", () => {
  const spanning = fictionalRelease({ lastCycle: "2027-04-01" });
  it.each([
    ["Cycles", "27.2", { tab: "cycles", open: `${streamId} 2027-04-01` }],
    ["Schedule", "Fictional Majors", { tab: "schedules", open: streamId }],
  ])(
    "opens what its %s row names, on its own tab",
    async (label, link, address) => {
      const user = userEvent.setup();
      const { history } = await openRelease(inStream(spanning));

      await user.click(
        within(detailRow(label, releasePanel())).getByRole("button", {
          name: link,
        }),
      );

      expect(openedIn(history)).toEqual(address);
    },
  );

  it("opens a release from its span on the timeline, and its schedule from its name there", async () => {
    const user = userEvent.setup();
    const { history } = await openPage(inStream(spanning));
    const timeline = () => screen.getByRole("region", { name: "Timeline" });

    await user.click(
      within(timeline()).getByRole("button", { name: /^Fictional One: / }),
    );
    expect(openedIn(history)).toEqual({ tab: null, open: spanning.id });

    await user.click(
      within(timeline()).getByRole("button", { name: "Fictional Majors" }),
    );
    expect(openedIn(history)).toEqual({ tab: "schedules", open: streamId });
  });
});

describe("a release's key", () => {
  it("shows under the release's name in its details", async () => {
    await openRelease(inStream(release));

    expect(
      within(releasePanel()).getByRole("button", {
        name: "#RELEASE-1, copy link or key",
      }),
    ).toBeDefined();
  });

  it("is copied as a link from the release's row menu", async () => {
    const user = userEvent.setup();
    await openPage(inStream(release));
    const [more] = within(
      screen.getByRole("grid", { name: "Releases" }),
    ).getAllByRole("button", { name: "Actions for Fictional One" });

    await user.click(more as HTMLElement);
    await user.click(
      await screen.findByRole("menuitem", { name: "Copy link" }),
    );

    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/go/release/1`,
    );
  });
});
