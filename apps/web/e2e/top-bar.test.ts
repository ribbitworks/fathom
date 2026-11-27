// SPDX-License-Identifier: Apache-2.0

// UI tests of the top bar in a narrow window: each part stays on one line, the development label is
// cut short before the account's name, and a part cut short shows its whole text in a tip.

import { expect, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";

test.use({ storageState: signedInAs("engineeringOperationsManager") });

const accountName = "Engineering Operations Manager";

interface BarParts {
  fits: boolean;
  lines: number[];
  nameCut: boolean;
  labelCut: boolean;
  labelAtLeast: boolean;
}

// How the bar's parts are drawn: whether its content fits inside it, how many lines the name, the
// place and the label each take, whether the name and the label are cut short, by their words'
// width against their box's, and whether the label is down to the least room it keeps.
const barParts = (page: Page) =>
  page.evaluate<BarParts>(`(() => {
    const bar = document.querySelector("header");
    const content = bar.firstElementChild;
    const leaf = (wanted) =>
      [...bar.querySelectorAll("*")].find(
        (element) => element.childElementCount === 0 && wanted(element.textContent),
      );
    const linesOf = (element) =>
      Math.round(
        element.getBoundingClientRect().height /
          parseFloat(getComputedStyle(element).lineHeight),
      );
    const cut = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().width > element.getBoundingClientRect().width + 0.01;
    };
    const name = leaf((words) => words === ${JSON.stringify(accountName)});
    const place = leaf((words) => words === "People").parentElement;
    const label = leaf((words) => words.startsWith("Clone "));
    let labelBox = label;
    while (["auto", "0px"].includes(getComputedStyle(labelBox).minWidth))
      labelBox = labelBox.parentElement;
    return {
      fits: content.scrollHeight <= content.clientHeight,
      lines: [name, place, label].map(linesOf),
      nameCut: cut(name),
      labelCut: cut(label),
      labelAtLeast:
        Math.abs(
          labelBox.getBoundingClientRect().width -
            parseFloat(getComputedStyle(labelBox).minWidth),
        ) < 1,
    };
  })()`);

async function openPeopleAt(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto("/people");
  // The seeded changes not yet published add Publish to the bar.
  await expect(
    page.getByRole("banner").getByRole("button", { name: /^Publish/ }),
  ).toBeVisible();
  await page.evaluate("document.fonts.ready");
}

test("keeps the top bar to one line, cutting the development label short before the account's name", async ({
  page,
}) => {
  // Given People, as the account with the longest name, in a window wide enough for every part
  await openPeopleAt(page, 1000);
  expect(await barParts(page)).toMatchObject({
    fits: true,
    lines: [1, 1, 1],
    nameCut: false,
    labelCut: false,
  });

  // When the window narrows to 760 pixels
  await page.setViewportSize({ width: 760, height: 800 });

  // Then only the label is cut short, with room still to give
  await expect
    .poll(() => barParts(page))
    .toMatchObject({
      fits: true,
      lines: [1, 1, 1],
      nameCut: false,
      labelCut: true,
      labelAtLeast: false,
    });

  // And when it narrows until the name no longer fits, the label has given up all it can first
  await page.setViewportSize({ width: 680, height: 800 });
  await expect
    .poll(() => barParts(page))
    .toMatchObject({
      fits: true,
      lines: [1, 1, 1],
      nameCut: true,
      labelCut: true,
      labelAtLeast: true,
    });
});

test("shows a part's whole text in a tip only while it is cut short", async ({
  page,
}) => {
  // Given People at 760 pixels, where the label is cut short and the name is whole
  await openPeopleAt(page, 760);
  const bar = page.getByRole("banner");
  const label = bar.getByText(/^Clone \d+ · /);
  const labelText = (await label.textContent()) ?? "";

  // When the label is pointed at, its whole text shows in a tip
  await label.hover();
  await expect(
    page.getByRole("tooltip").filter({ hasText: labelText }),
  ).toBeVisible();

  // And when the whole name is pointed at, no tip shows, since the bar names it in full
  await bar.getByText(accountName).hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("shows the account's whole name, cut short, in a tip on keyboard focus but not after a click", async ({
  page,
}) => {
  // Given People at 680 pixels, where the account's name is cut short
  await openPeopleAt(page, 680);
  const account = page.getByRole("button", { name: `Account, ${accountName}` });

  // When the account's menu is opened by a click and closed by another, handing focus back, and the
  // pointer moves away
  await account.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await account.click();
  await expect(page.getByRole("menu")).toBeHidden();
  await page.mouse.move(0, 400);

  // Then no tip shows
  await expect(page.getByRole("tooltip")).toHaveCount(0);

  // But when the button is reached from the keyboard, its whole name shows in a tip
  await page.getByRole("button", { name: /^Publish/ }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(account).toBeFocused();
  await expect(
    page.getByRole("tooltip").filter({ hasText: accountName }),
  ).toBeVisible();
});
