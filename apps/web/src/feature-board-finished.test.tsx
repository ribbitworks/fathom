// SPDX-License-Identifier: Apache-2.0

// Tests for the Features Board leaving out done and cancelled features, in months and a schedule's
// cycles alike, unless its view shows them, and the table showing every feature.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finishedOnBoard } from "./feature-board.ts";
import { featureDraft } from "./test-support.tsx";
import {
  alpha,
  cardNames,
  feature,
  ids,
  openBoard,
  size,
  target,
} from "./test-feature-board.tsx";

vi.mock("@mantine/hooks", async (importOriginal) =>
  (await import("./test-board-width.ts")).withBoardWidth(
    await importOriginal(),
  ),
);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-05-10T12:00:00Z"));
  size.width = 1000;
});

afterEach(() => {
  vi.useRealTimers();
});

const shipped = feature("Fictional Shipped", {
  ...target("2027-04-01"),
  statusId: ids.done,
  neededBy: "2027-06",
});
const dropped = feature("Fictional Dropped", {
  ...target("2027-04-01"),
  statusId: ids.cancelled,
  neededBy: "2027-06",
});
const features = [alpha, shipped, dropped];
const showItem = () =>
  screen.findByRole("menuitem", {
    name: /^Show done and cancelled \(2\)/,
  });

describe("finishedOnBoard", () => {
  const statuses = [
    { id: ids.done, meaning: "done" as const },
    { id: ids.cancelled, meaning: "cancelled" as const },
    { id: ids.planned, meaning: "planned" as const },
    { id: ids.likely },
  ];

  it("is true only for a status meaning done or cancelled", () => {
    expect(
      [ids.done, ids.cancelled, ids.planned, ids.likely, "gone"].map(
        (statusId) => finishedOnBoard({ statusId }, statuses),
      ),
    ).toEqual([true, true, false, false, false]);
  });
});

describe("the Board without done and cancelled features", () => {
  it("leaves them out of a schedule's cycles until Views shows them, kept in the address", async () => {
    // Given the board by a schedule's cycles
    const history = await openBoard(undefined, { features });
    expect(cardNames("Cycle 27.2", features)).toEqual(["Fictional Alpha"]);

    // When Show done and cancelled is chosen in the Views menu
    await userEvent.click(screen.getByRole("button", { name: /^Views/ }));
    await userEvent.click(await showItem());

    // Then they show, and the address keeps the choice
    expect(cardNames("Cycle 27.2", features)).toEqual([
      "Fictional Alpha",
      "Fictional Shipped",
      "Fictional Dropped",
    ]);
    expect(history.location.search).toContain("finished=shown");
  });

  it("leaves them out of months too", async () => {
    await openBoard("/features?mode=board", { features, months: true });
    expect(cardNames("Jun 2027", features)).toEqual(["Fictional Alpha"]);
  });

  it("opens showing them when the address says so", async () => {
    await openBoard("/features?mode=board&finished=shown", {
      features,
      months: true,
    });
    expect(cardNames("Jun 2027", features)).toHaveLength(3);
  });

  it("leaves the table showing every feature, with no such choice", async () => {
    await openBoard("/features", { features, months: true });
    const grid = screen.getByRole("grid", { name: "Features" });
    expect(within(grid).getByText("Fictional Shipped")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^Views/ }));
    await screen.findByRole("menu");
    expect(
      screen.queryByRole("menuitem", {
        name: /^Show done and cancelled/,
      }),
    ).toBeNull();
  });
});

describe("done and cancelled by the status the Draft view shows", () => {
  const finishing = feature("Fictional Finishing", {
    ...target("2027-04-01"),
    statusId: ids.done,
    draft: featureDraft({
      changed: ["statusId"],
      live: { statusId: ids.planned },
    }),
  });
  const reopening = feature("Fictional Reopening", {
    ...target("2027-04-01"),
    statusId: ids.planned,
    draft: featureDraft({
      changed: ["statusId"],
      live: { statusId: ids.done },
    }),
  });
  // Only drafted to be added, as done, so not live at all.
  const added = feature("Fictional Added", {
    ...target("2027-04-01"),
    statusId: ids.done,
    draft: featureDraft({ action: "created" }),
  });
  const among = [alpha, finishing, reopening, added];

  it("goes by the drafted status beside live", async () => {
    await openBoard(undefined, { features: among });
    expect(cardNames("Cycle 27.2", among)).toEqual([
      "Fictional Alpha",
      "Fictional Reopening",
    ]);
  });

  it("goes by the live status under Live only", async () => {
    await openBoard("/features?mode=board&show=live", { features: among });
    expect(cardNames("Cycle 27.2", among)).toEqual([
      "Fictional Alpha",
      "Fictional Finishing",
    ]);
  });

  it("opens a feature it leaves out in its details", async () => {
    await openBoard(`/features?mode=board&open=${shipped.id}`, { features });
    expect(
      await screen.findByRole("heading", { name: /Fictional Shipped/ }),
    ).toBeTruthy();
  });
});
