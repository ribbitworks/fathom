// SPDX-License-Identifier: Apache-2.0

// Tests that Features names a feature's team and release with its colour's square before the name,
// wherever it is named: cells, details, the picker, the filter's list and pill, and group headings.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { featureDraft, recordCell } from "./test-support.tsx";
import {
  featurePlan,
  first,
  open,
  sidePanel,
  teamId,
  withRelease,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

// The colour of the square drawn before a name, if any.
const squareIn = (element: Element | null | undefined) =>
  element?.querySelector("[data-colour]")?.getAttribute("data-colour") ??
  undefined;

const onTeam = featurePlan({
  features: [{ ...first, featureTeamId: teamId }],
});

describe("a feature's team on Features", () => {
  it("draws the team's square before its name in its cell", async () => {
    await open(onTeam);
    await waitFor(() => {
      expect(recordCell(first.id, "featureTeamId")?.textContent).toBe(
        "Fictional Team",
      );
    });
    expect(squareIn(recordCell(first.id, "featureTeamId"))).toBe("teal");
  });

  it("draws the team's square before its name in the feature's details", async () => {
    await open(onTeam, {}, `/features?open=${first.id}`);
    const team = await within(sidePanel()).findByText("Fictional Team");
    expect(squareIn(team.closest("dd"))).toBe("teal");
  });

  it("offers each team in the picker after its square", async () => {
    await open(onTeam, {}, `/features?open=${first.id}`);
    await userEvent.click(
      await screen.findByRole("button", { name: "Change Feature team" }),
    );
    const option = await screen.findByRole("option", {
      name: "Fictional Team",
    });
    expect(squareIn(option)).toBe("teal");
  });

  it("heads the team's group with its square", async () => {
    await open(onTeam, {}, "/features?grouping=featureTeamId");
    const heading = await screen.findByRole("rowheader", {
      name: /^Fictional Team/,
    });
    expect(squareIn(heading)).toBe("teal");
  });

  it("names the team after its square in the filter's list and its pill", async () => {
    await open(onTeam);
    await userEvent.click(
      await screen.findByRole("button", { name: /^Feature team column/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Filter…" }),
    );
    const box = await screen.findByRole("checkbox", {
      name: "Fictional Team",
    });
    expect(squareIn(box.closest(".mantine-Checkbox-root"))).toBe("teal");
    await userEvent.click(box);
    await userEvent.keyboard("{Escape}");
    const pill = await screen.findByText(/^Feature team:/);
    expect(squareIn(pill.closest(".mantine-Pill-root"))).toBe("teal");
    expect(pill.closest(".mantine-Pill-root")?.textContent).toBe(
      "Feature team: Fictional Team",
    );
  });

  it("draws the team's square in a Live row under a draft that takes the team away", async () => {
    await open(
      featurePlan({
        features: [
          {
            ...first,
            featureTeamId: null,
            draft: featureDraft({
              changed: ["featureTeamId"],
              live: { featureTeamId: teamId },
            }),
          },
        ],
      }),
    );
    const live = await screen.findByText("Fictional Team");
    expect(squareIn(live.closest("td"))).toBe("teal");
  });

  it("labels the team's row on the Board after its square", async () => {
    await open(onTeam, {}, "/features?grouping=featureTeamId");
    await userEvent.click(screen.getByRole("radio", { name: "Board" }));
    const label = await waitFor(() => {
      const found = screen
        .getAllByText(/Fictional Team/)
        .find((element) => element.tagName === "DIV");
      expect(found).toBeDefined();
      return found;
    });
    expect(squareIn(label)).toBe("teal");
  });

  it("draws no square for a team the page doesn't know", async () => {
    await open(
      featurePlan({
        features: [{ ...first, featureTeamId: crypto.randomUUID() }],
      }),
    );
    await waitFor(() => {
      expect(recordCell(first.id, "featureTeamId")).toBeDefined();
    });
    expect(squareIn(recordCell(first.id, "featureTeamId"))).toBeUndefined();
  });

  it("draws no square for a feature with no team", async () => {
    await open(featurePlan({ features: [{ ...first, featureTeamId: null }] }));
    await waitFor(() => {
      expect(recordCell(first.id, "featureTeamId")).toBeDefined();
    });
    expect(squareIn(recordCell(first.id, "featureTeamId"))).toBeUndefined();
  });
});

describe("a feature's release on Features", () => {
  it("draws the release's square before its name in its cell", async () => {
    await open(featurePlan({ features: [first] }), withRelease);
    await waitFor(() => {
      expect(recordCell(first.id, "release")?.textContent).toContain(
        "Fictional Release",
      );
    });
    expect(squareIn(recordCell(first.id, "release"))).toBe("sea");
  });

  it("heads the release's group with its square", async () => {
    await open(
      featurePlan({ features: [first] }),
      withRelease,
      "/features?grouping=release",
    );
    const heading = await screen.findByRole("rowheader", {
      name: /Fictional Release/,
    });
    expect(squareIn(heading)).toBe("sea");
  });
});
