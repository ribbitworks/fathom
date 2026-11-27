// SPDX-License-Identifier: Apache-2.0

// UI tests of how a table's row is drawn around its values: its refusal in line with its name, its
// buttons level with the name, and a drafted row's one tint across every cell.

import type { Page } from "@playwright/test";
import { expect, test } from "./test-fixtures.ts";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("engineeringDirector") });

interface RefusedRow {
  nameStart: number;
  refusalStart: number;
  lineCentre: number;
}

// Where the name and the refusal in the refused row's first cell start across the page, rather than
// where their boxes do, which may be set in, and the centre of the cell's first line.
const refusedRow = (page: Page, name: string) =>
  page.evaluate<RefusedRow>(`(() => {
    const refusal = document.querySelector('[role="alert"]');
    const cell = refusal.closest("td");
    const wordsStart = (words) => {
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        if (node.textContent.includes(words)) {
          const range = document.createRange();
          range.selectNodeContents(node);
          return range.getBoundingClientRect().left;
        }
      }
      throw new Error("No words " + words);
    };
    const style = getComputedStyle(cell);
    return {
      nameStart: wordsStart(${JSON.stringify(name)}),
      refusalStart: wordsStart(refusal.textContent),
      lineCentre: cell.getBoundingClientRect().top + parseFloat(style.paddingTop) +
        parseFloat(style.lineHeight) / 2,
    };
  })()`);

test("lines a row's refusal up with the name above it, the row's buttons level with the name", async ({
  page,
}) => {
  // Given Features, with a Needed by that can't be a month typed into a feature's row
  await page.goto("/features");
  const row = page.getByRole("row").filter({ hasText: "Barcode Scanning" });
  await row.locator("[role=gridcell][id$='-neededBy']").click();
  await page.keyboard.type("203013");
  await expect(row.getByRole("textbox", { name: "Needed by" })).toHaveValue(
    "2030-13",
  );

  // When it is saved
  await page.keyboard.press("Enter");

  // Then the refusal under the row starts where the feature's name does
  await expect(row.getByRole("alert")).toHaveText(
    "Type a month for Needed by, such as 2027-03",
  );
  const { nameStart, refusalStart, lineCentre } = await refusedRow(
    page,
    "Barcode Scanning",
  );
  expect(refusalStart).toBeCloseTo(nameStart, 0);

  // And the buttons over the name stay level with it, not centred in the taller row
  await row.hover();
  const controls = await row
    .getByRole("button", { name: "Actions for Barcode Scanning" })
    .first()
    .boundingBox();
  expect(controls).not.toBeNull();
  expect((controls?.y ?? 0) + (controls?.height ?? 0) / 2).toBeCloseTo(
    lineCentre,
    0,
  );

  await page.keyboard.press("Escape");
});

// The background of every cell scrolling with each of a person's rows, the draft's and the Live
// row under it, which also crosses the drafted columns.
const rowGrounds = (page: Page, name: string) =>
  page.evaluate<string[][]>(`(() => {
    const rows = [...document.querySelectorAll("tr[class*='draftRow'], tr[class*='LiveRow']")]
      .filter((row) => row.textContent.includes(${JSON.stringify(name)}));
    return rows.map((row) =>
      [...row.querySelectorAll("[role=gridcell]:not([class*='frozen'])")].map(
        (cell) => getComputedStyle(cell).backgroundColor,
      ),
    );
  })()`);

test("tints a drafted row and its Live row alike in every cell, the drafted columns' included, in the dark scheme", async ({
  page,
}) => {
  // Given People in the dark scheme, where the seeded drafted person's rows cross drafted columns
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/people");
  const draftRow = page
    .locator("tr[class*='draftRow']")
    .filter({ hasText: "西尾 亮" });
  await draftRow.scrollIntoViewIfNeeded();
  await expect(draftRow).toBeVisible();

  // Then every cell scrolling with either row lets the row's one tint show, laying none of its own
  const grounds = await rowGrounds(page, "西尾 亮");
  expect(grounds).toHaveLength(2);
  expect(new Set(grounds.flat())).toEqual(new Set(["rgba(0, 0, 0, 0)"]));
});
