// SPDX-License-Identifier: Apache-2.0

// Tests for features' effort on the Features page, in the units each view shows.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { composingKeys, recordCell } from "./test-support.tsx";
import {
  saved,
  sent,
  first,
  featurePlan,
  open,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Features page", () => {
  describe("effort", () => {
    const effortMenu = async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: /^Effort/ }),
      );
    };
    const choose = async (name: string) => {
      await effortMenu();
      await userEvent.click(
        await screen.findByRole("menuitem", {
          name: (shown) => shown.startsWith(name),
        }),
      );
    };
    it("shows a feature's estimate in person-months to no decimal places, rounded up", async () => {
      // Given a feature estimated at 100 hours, which rounds up to 13 person-days, 0.65 person-months
      const { history } = await open(
        featurePlan({ features: [{ ...first, estimateHours: 100 }] }),
      );
      expect(await screen.findByText("100 h")).not.toBeNull();

      // When it is shown in person-months, then to no decimal places
      await choose("Person-months");
      expect(await screen.findByText("0.65 PM")).not.toBeNull();
      await choose("0");

      // Then it reads one person-month, kept in the address
      expect(await screen.findByText("1 PM")).not.toBeNull();
      expect(decodeURIComponent(history.location.search)).toContain(
        '"estimateHours":0',
      );
    });

    // The Features page's address, showing Effort in a unit.
    const inUnit = (unit: string) =>
      `/features?units=${encodeURIComponent(
        JSON.stringify({ estimateHours: unit }),
      )}`;
    const withEstimate = (hours: number) =>
      featurePlan({ features: [{ ...first, estimateHours: hours }] });
    const featurePath = `PUT /api/features/${first.id}`;
    const effortCell = () =>
      recordCell(first.id, "estimateHours") as HTMLElement;

    it("is what Metrics adds up at first, its total shown in the view's unit, rounded up", async () => {
      // Given a feature estimated at 100 hours, shown in person-months
      await open(
        withEstimate(100),
        {},
        `${inUnit("person-months")}&breakdown=${encodeURIComponent(
          JSON.stringify(["statusId"]),
        )}`,
      );

      // Then Metrics adds Effort up, in person-months
      const metrics = await screen.findByRole("region", { name: "Metrics" });
      expect(
        within(metrics).getByRole("columnheader", { name: "Effort (PM)" }),
      ).toBeTruthy();
      const all = within(metrics).getByRole("rowheader", { name: /^All / });
      expect(
        within(all.closest("tr") as HTMLElement)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      ).toEqual(["1", "100%", "0.65", "0.65", ""]);
    });

    it("leaves the address once Effort is back in hours to two decimal places", async () => {
      const { history } = await open(
        withEstimate(100),
        {},
        inUnit("person-months"),
      );
      expect(await screen.findByText("0.65 PM")).not.toBeNull();
      await choose("1");
      await choose("2");
      await choose("Hours");
      expect(await screen.findByText("100 h")).not.toBeNull();
      expect(history.location.search).not.toContain("units");
      expect(history.location.search).not.toContain("places");
    });

    it("tells the hours behind an amount, and when it was rounded up", async () => {
      await open(withEstimate(1), {}, inUnit("person-days"));
      await userEvent.hover(await screen.findByText("0.5 PD"));
      expect(await screen.findByText("1 hour, rounded up")).not.toBeNull();
    });

    it("tells the hours behind an amount that needed no rounding", async () => {
      await open(withEstimate(20), {}, inUnit("person-days"));
      await userEvent.hover(await screen.findByText("2.5 PD"));
      expect(await screen.findByText("20 hours")).not.toBeNull();
    });

    it("edits a cell from the amount shown, keeping the estimate when it is left unchanged", async () => {
      // Given 32 hours, 4 person-days, shown in person-quarters as 0.07
      const { fetch } = await open(
        withEstimate(32),
        { [featurePath]: saved(() => withEstimate(32)) },
        inUnit("person-quarters"),
      );
      expect(await screen.findByText("0.07 PQ")).not.toBeNull();

      // When the cell is edited and left as it opened
      await userEvent.dblClick(effortCell());
      const field = screen.getByRole("textbox", {
        name: "Effort in person-quarters",
      });
      expect((field as HTMLInputElement).value).toBe("0.07");
      expect(screen.getByText("PQ")).not.toBeNull();
      await userEvent.keyboard("{Enter}");

      // Then nothing is saved; and typing a new amount saves it in hours, rounded up
      expect(sent(fetch, featurePath)).toEqual([]);
      await userEvent.dblClick(effortCell());
      await userEvent.keyboard("{Control>}a{/Control}0.1{Enter}");
      await waitFor(() => {
        expect(sent(fetch, featurePath)).toMatchObject([{ estimateHours: 48 }]);
      });
    });

    it.each([
      ["-1", "Effort: use 0 or more"],
      ["200000", "Effort: use 124,999.5 or less"],
    ])("refuses %s person-days", async (typed, message) => {
      await open(withEstimate(20), {}, inUnit("person-days"));
      await userEvent.dblClick(await screen.findByText("2.5 PD"));
      await userEvent.keyboard(`{Control>}a{/Control}${typed}{Enter}`);
      expect(await screen.findByText(message)).not.toBeNull();
    });

    it("gives the estimate in the details in the table's unit, then in hours", async () => {
      await open(
        withEstimate(20),
        {},
        `${inUnit("person-days")}&open=${first.id}`,
      );
      expect(
        await screen.findByText("2.5 person-days (20 hours)"),
      ).not.toBeNull();
    });

    it("gives only the hours in the details when the table shows hours", async () => {
      await open(withEstimate(20), {}, `/features?open=${first.id}`);
      // The table's cell says the same to assistive technology, so the details' value is the one
      // in a description list.
      const shown = await screen.findAllByText("20 hours");
      expect(shown.filter((text) => text.closest("dd") !== null)).toHaveLength(
        1,
      );
    });

    it("gives only the hours in the details of an estimate of none, whatever the table's unit", async () => {
      await open(
        withEstimate(0),
        {},
        `${inUnit("person-days")}&open=${first.id}`,
      );
      const shown = await screen.findAllByText("0 hours");
      expect(shown.filter((text) => text.closest("dd") !== null)).toHaveLength(
        1,
      );
    });

    it("edits the estimate in the details in a unit chosen there, saving hours", async () => {
      // Given the details of 20 hours, with the table in person-days
      const { fetch } = await open(
        withEstimate(20),
        { [featurePath]: saved(() => withEstimate(20)) },
        `${inUnit("person-days")}&open=${first.id}`,
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "Change Effort" }),
      );
      const field = screen.getByRole("textbox", {
        name: "Effort in person-days",
      });
      expect((field as HTMLInputElement).value).toBe("2.5");

      // When hours are chosen beside it, the editor stays open, and 28 is typed
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Effort unit" }),
        "hours",
      );
      const inHours = screen.getByRole("textbox", { name: "Effort in hours" });
      await userEvent.clear(inHours);
      await userEvent.type(inHours, "28");
      await userEvent.click(screen.getByRole("heading", { name: "Features" }));

      // Then 28 hours are saved, once the field and its menu are left
      await waitFor(() => {
        expect(sent(fetch, featurePath)).toMatchObject([{ estimateHours: 28 }]);
      });
    });

    // The address showing Effort in person-months to no decimal places.
    const inMonthsWhole = `${inUnit("person-months")}&places=${encodeURIComponent(
      JSON.stringify({ estimateHours: 0 }),
    )}`;

    it("reads a cell's amount, its unit, and its hours to assistive technology", async () => {
      await open(withEstimate(100), {}, inMonthsWhole);
      expect(
        await screen.findByText("1 person-month, 100 hours, rounded up"),
      ).not.toBeNull();
    });

    it("names one of a unit in the details as the amount is shown, rounded up", async () => {
      // Given 152 hours, 19 person-days, which reads 1 person-month to no decimal places
      await open(withEstimate(152), {}, `${inMonthsWhole}&open=${first.id}`);
      expect(
        await screen.findByText("1 person-month (152 hours)"),
      ).not.toBeNull();
    });

    it("resets the units from the Views menu", async () => {
      await open(withEstimate(100), {}, inUnit("person-months"));
      expect(await screen.findByText("0.65 PM")).not.toBeNull();
      await userEvent.click(screen.getByRole("button", { name: /^Views/ }));
      await userEvent.click(
        await screen.findByRole("menuitem", {
          name: /^Units: Effort in person-months/,
        }),
      );
      expect(await screen.findByText("100 h")).not.toBeNull();
    });

    it("tells the hours of the cell with keyboard focus", async () => {
      await open(withEstimate(20), {}, inUnit("person-days"));
      await userEvent.click(recordCell(first.id, "neededBy") as HTMLElement);
      await userEvent.keyboard("{ArrowRight}");
      expect((await screen.findByRole("tooltip")).textContent).toBe("20 hours");
    });

    it("gives none in the details for a feature with no estimate", async () => {
      await open(
        featurePlan({ features: [{ ...first, estimateHours: null }] }),
        {},
        `${inUnit("person-days")}&open=${first.id}`,
      );
      const effort = await screen.findByText("Effort", { selector: "dt" });
      expect(effort.nextElementSibling?.textContent).toContain("None");
    });

    const editInDetails = async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: "Change Effort" }),
      );
    };

    it("cancels editing the estimate in the details with Esc in the menu of units", async () => {
      const { fetch } = await open(
        withEstimate(20),
        { [featurePath]: saved(() => withEstimate(20)) },
        `${inUnit("person-days")}&open=${first.id}`,
      );
      await editInDetails();
      // Past the field's × to the menu of units.
      await userEvent.tab();
      await userEvent.tab();
      expect(document.activeElement).toBe(
        screen.getByRole("combobox", { name: "Effort unit" }),
      );
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(
          screen.queryByRole("combobox", { name: "Effort unit" }),
        ).toBeNull();
      });
      expect(sent(fetch, featurePath)).toEqual([]);
    });

    it.each(composingKeys)(
      "keeps the estimate open in the details at an Esc pressed %s a word, cancelling at the reader's",
      async (_, composing) => {
        await open(
          withEstimate(20),
          { [featurePath]: saved(() => withEstimate(20)) },
          `${inUnit("person-days")}&open=${first.id}`,
        );
        await editInDetails();
        // The field opens focused.
        await waitFor(() => {
          expect(document.activeElement?.tagName).toBe("INPUT");
        });
        fireEvent.keyDown(document.activeElement as HTMLElement, {
          key: "Escape",
          ...composing,
        });
        expect(
          screen.getByRole("combobox", { name: "Effort unit" }),
        ).toBeDefined();
        await userEvent.keyboard("{Escape}");
        await waitFor(() => {
          expect(
            screen.queryByRole("combobox", { name: "Effort unit" }),
          ).toBeNull();
        });
      },
    );

    it("shows the same estimate in another unit chosen before typing, saving nothing", async () => {
      const { fetch } = await open(
        withEstimate(20),
        { [featurePath]: saved(() => withEstimate(20)) },
        `${inUnit("person-days")}&open=${first.id}`,
      );
      await editInDetails();
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Effort unit" }),
        "hours",
      );
      expect(
        screen.getByRole<HTMLInputElement>("textbox", {
          name: "Effort in hours",
        }).value,
      ).toBe("20");
      await userEvent.click(screen.getByRole("heading", { name: "Features" }));
      await waitFor(() => {
        expect(
          screen.queryByRole("combobox", { name: "Effort unit" }),
        ).toBeNull();
      });
      expect(sent(fetch, featurePath)).toEqual([]);
    });

    it("enters a new feature's estimate in a unit chosen in its form, saving hours", async () => {
      const path = "POST /api/features";
      const { fetch } = await open(
        featurePlan(),
        { [path]: saved(featurePlan) },
        inUnit("person-weeks"),
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "New feature" }),
      );
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name" }),
        "Fictional Estimated",
      );
      await userEvent.type(
        screen.getByRole("textbox", { name: "Effort in person-weeks" }),
        "2",
      );
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Effort unit" }),
        "person-days",
      );
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() => {
        expect(sent(fetch, path)).toMatchObject([
          { name: "Fictional Estimated", estimateHours: 16 },
        ]);
      });
    });
  });
});
