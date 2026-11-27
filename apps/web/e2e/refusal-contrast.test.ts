// SPDX-License-Identifier: Apache-2.0

// UI tests of how well a refusal reads: its red words stand out from what is behind them by at least
// WCAG's 4.5 to 1 for text, and the red outline of the value refused by at least 3 to 1, in light
// mode and in dark; and a table's refusal stays one line under its row.

import type { Locator, Page } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";
import { expect, test } from "./test-fixtures.ts";

const textContrast = 4.5;
const outlineContrast = 3;

type Colour = [number, number, number];

// Marks an element so the page's own code, given as text, can find it once.
const markMeasured = (element: Locator) =>
  element.evaluate(
    (node: { setAttribute: (name: string, value: string) => void }) => {
      node.setAttribute("data-measured", "");
    },
  );

// The height of one line of an element's text.
const lineHeightOf = async (element: Locator) => {
  await markMeasured(element);
  return Number.parseFloat(
    await element.page().evaluate<string>(`(() => {
      const node = document.querySelector("[data-measured]");
      node.removeAttribute("data-measured");
      return getComputedStyle(node).lineHeight;
    })()`),
  );
};

// Whether an element's text is wider than its own box, so runs on past it.
const runsPast = async (element: Locator) => {
  await markMeasured(element);
  return element.page().evaluate<boolean>(`(() => {
    const node = document.querySelector("[data-measured]");
    node.removeAttribute("data-measured");
    return node.scrollWidth > node.clientWidth;
  })()`);
};

// The colour a part of an element is drawn in, and the colour behind it, as the page shows them: each
// background from the page's root down to the element painted over the one before, so a faint tint
// over a panel counts as the panel shows it. Only background colours count, not a tint painted as a
// gradient, such as a drafted column's, so the refusals measured are on rows without one. The page's
// code is text, as the UI tests have no types for the browser's own objects.
const drawnColours = async (
  element: Locator,
  part: "color" | "border-top-color",
) => {
  await markMeasured(element);
  return element.page().evaluate<{ drawn: Colour; behind: Colour }>(`(() => {
    const node = document.querySelector("[data-measured]");
    node.removeAttribute("data-measured");
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const painted = (colours) => {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 1, 1);
      for (const colour of colours) {
        context.fillStyle = colour;
        context.fillRect(0, 0, 1, 1);
      }
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const backgrounds = [];
    for (let at = node; at !== null; at = at.parentElement)
      backgrounds.unshift(getComputedStyle(at).backgroundColor);
    return {
      drawn: painted([...backgrounds, getComputedStyle(node).getPropertyValue("${part}")]),
      behind: painted(backgrounds),
    };
  })()`);
};

// WCAG's relative luminance of a colour.
const luminance = (colour: Colour) => {
  const [red, green, blue] = colour.map((channel) => {
    const share = channel / 255;
    return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  }) as Colour;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastOf = async (
  element: Locator,
  part: "color" | "border-top-color",
) => {
  const { drawn, behind } = await drawnColours(element, part);
  const [lighter, darker] = [luminance(drawn), luminance(behind)].sort(
    (first, second) => second - first,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
};

// The theme's red for refusals, as the page computes it.
const errorRed = (page: Page) =>
  page.evaluate<string>(`(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--mantine-color-error)";
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  })()`);

const neededByRefused = async (page: Page) => {
  await page.goto("/features");
  const cell = page.locator('[role=grid] tbody td[id$="-neededBy"]').first();
  await cell.click();
  await page.keyboard.press("Enter");
  const editor = page.getByRole("textbox", { name: "Needed by" });
  await expect(editor).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("203013");
  await page.keyboard.press("Enter");
  const reason = page.getByText("Type a month for Needed by, such as 2027-03");
  await expect(reason).toBeVisible();
  await expect(editor).toHaveAttribute("aria-invalid", "true");
  return { reason, editor };
};

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test.describe("a table's refusal", () => {
      test.use({ storageState: signedInAs("productManager") });

      test("reads clearly, words and outline", async ({ page }) => {
        // Given the Product Manager on Features
        // When a Needed by that is no month is saved
        const { reason, editor } = await neededByRefused(page);

        // Then its reason under the row, and the outline of the value refused, are the refusal red
        const red = await errorRed(page);
        await expect(reason).toHaveCSS("color", red);
        await expect(editor).toHaveCSS("border-top-color", red);

        // And each stands out
        expect(await contrastOf(reason, "color")).toBeGreaterThanOrEqual(
          textContrast,
        );
        expect(
          await contrastOf(editor, "border-top-color"),
        ).toBeGreaterThanOrEqual(outlineContrast);
        await page.keyboard.press("Escape");
      });
    });

    test.describe("a dialog's refusal", () => {
      test.use({ storageState: signedInAs("engineeringDirector") });

      test("reads clearly under its field", async ({ page }) => {
        // Given the Engineering Director on Lists, with the New list dialog open
        await page.goto("/lists");
        await page.getByRole("button", { name: "New list" }).click();
        const dialog = page.getByRole("dialog", { name: "New list" });

        // When the list is created with no name
        await dialog.getByRole("button", { name: "Create list" }).click();

        // Then the reason under Name stands out
        const reason = dialog.getByText("Name needed");
        await expect(reason).toBeVisible();
        expect(await contrastOf(reason, "color")).toBeGreaterThanOrEqual(
          textContrast,
        );
      });
    });
  });
}

test.describe("a table's refusal in a narrow window", () => {
  test.use({
    storageState: signedInAs("productManager"),
    viewport: { width: 760, height: 900 },
  });

  test("makes its row one line taller, though its first column is narrower", async ({
    page,
  }) => {
    // Given the Product Manager on Features, in a narrow window
    // When the first row's Needed by is saved as no month
    const { reason } = await neededByRefused(page);
    const rows = page.locator("[role=grid] tbody tr");
    const [refused, unrefused] = await Promise.all([
      rows.nth(0).boundingBox(),
      rows.nth(1).boundingBox(),
    ]);

    // Then the reason runs on past its cell, rather than wrapping
    expect(await runsPast(reason)).toBe(true);
    // And the row is one line taller than a row with no refusal
    expect(
      (refused?.height ?? 0) - (unrefused?.height ?? 0),
    ).toBeLessThanOrEqual((await lineHeightOf(reason)) + 1);
    await page.keyboard.press("Escape");
  });
});
