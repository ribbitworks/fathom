// SPDX-License-Identifier: Apache-2.0

// UI tests of a New form refusing a value, stacked under a record's details or on its own page: the
// reason under the field, focus in it, nothing saved, and Add and Cancel acting on the first click.

import { expect, type Page, test } from "@playwright/test";
import { signedInAs } from "./test-accounts.ts";
import { send } from "./test-requests.ts";

test.use({ storageState: signedInAs("productManager") });

// The requests that would save something, as the page sends them.
function changesSent(page: Page): string[] {
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  return changes;
}

// Opens Fleet Tracking Bid's details, then its Customers picker's New customer form, named by what
// was typed. Panels are regions beside the page, and dialogs covering a narrow screen.
async function newCustomerFromBid(
  page: Page,
  typed: string,
  role: "region" | "dialog" = "region",
) {
  await page.goto("/projects?tab=proposals");
  const plan = (await send(page, "GET", "/api/projects")).body as {
    proposals: { id: string; name: string }[];
  };
  const bidId = plan.proposals.find(
    ({ name }) => name === "Fleet Tracking Bid",
  )?.id;
  await page.goto(`/projects?tab=proposals&open=${String(bidId)}`);
  const details = page.getByRole(role, { name: /Fleet Tracking Bid/ });
  await details.getByText("Customers", { exact: true }).click();
  await details.getByRole("textbox", { name: "Customers" }).fill(typed);
  await page.getByRole("option", { name: `New customer “${typed}”` }).click();
  const form = page.getByRole(role, { name: "New customer" });
  return { details, form, name: form.getByRole("textbox", { name: "Name" }) };
}

async function customersNamed(page: Page, name: string) {
  const plan = (await send(page, "GET", "/api/projects")).body as {
    customers: { name: string }[];
  };
  return plan.customers.filter((one) => one.name === name).length;
}

test("the stacked form refuses a Name emptied with its ×, keeping focus in it and saving nothing", async ({
  page,
}) => {
  // Given the New customer form stacked under a proposal's details, its Name filled in
  const { form, name } = await newCustomerFromBid(page, "Fictional Depot");
  const changes = changesSent(page);

  // When Name is emptied with its ×, focus is in it
  await form.getByRole("button", { name: "Clear Name" }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("");

  // And when Add is selected, it is refused under Name, with focus in it
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await expect(name).toHaveAccessibleDescription(/Name needed/);
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await expect(form).toBeVisible();

  // Then nothing was sent to be saved
  expect(changes).toEqual([]);
  expect(await customersNamed(page, "Fictional Depot")).toBe(0);
});

test("the stacked form names a taken name under Name, with focus in it, and adds at the first click once it is changed", async ({
  page,
}) => {
  // Given the New customer form, named as a customer already is
  const { form, name } = await newCustomerFromBid(page, "Marlow City Transit");
  const reason = "Another customer has that name";

  // When Add is selected, the server's refusal is under Name, not in a notification
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await expect(name).toHaveAccessibleDescription(new RegExp(reason));
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await expect(page.getByText(reason)).toHaveCount(1);
  expect(await customersNamed(page, "Marlow City Transit")).toBe(1);

  // And when a new name is typed, leaving it takes the reason away, which moves Add up; one click
  // on Add still adds the customer
  await name.fill("Fictional Harbour Works");
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await expect(form).toBeHidden();
  expect(await customersNamed(page, "Fictional Harbour Works")).toBe(1);
});

test("Cancel asks before discarding a name typed, and Keep adding puts focus back in it", async ({
  page,
}) => {
  const { form, name } = await newCustomerFromBid(page, "Fictional Pier");
  await name.fill("Fictional Pier Two");
  await form.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Keep adding" }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("Fictional Pier Two");
});

test("Cancel asks before discarding the name typed into the picker, though left as it opened", async ({
  page,
}) => {
  const { form } = await newCustomerFromBid(page, "Fictional Pier");
  await form.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("dialog", { name: "Discard the new customer?" }),
  ).toBeVisible();
});

test("the page's own New proposal names a taken name under Name, with focus in it, saving nothing", async ({
  page,
}) => {
  // Given the New proposal form on Projects
  await page.goto("/projects?tab=proposals");
  await page.getByRole("button", { name: "New proposal" }).click();
  const form = page.getByRole("region", { name: "New proposal" });
  const name = form.getByRole("textbox", { name: "Name" });

  // When it is named as a proposal already is, and added
  await name.fill("Fleet Tracking Bid");
  await form.getByRole("button", { name: "Add", exact: true }).click();

  // Then the server's refusal is under Name, with focus in it, and the form stays open
  const reason = "Another proposal has that name";
  await expect(name).toHaveAccessibleDescription(new RegExp(reason));
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await expect(page.getByText(reason)).toHaveCount(1);
  await expect(form).toBeVisible();
});

test.describe("on a narrow screen", () => {
  test.use({ viewport: { width: 760, height: 900 } });

  test("the stacked form covers the details, and adding the customer shows them again with it", async ({
    page,
  }) => {
    // Given a proposal's details covering the screen, New customer chosen from its Customers picker
    const { details, form, name } = await newCustomerFromBid(
      page,
      "Fictional Quay",
      "dialog",
    );

    // Then the form covers the details, with the cursor in Name
    await expect(form).toBeVisible();
    await expect(details).toBeHidden();
    await expect(name).toBeFocused();

    // And when it is added, the details show again, the customer among their Customers, with focus
    // back on their Customers row
    await form.getByRole("button", { name: "Add", exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(details).toBeVisible();
    await expect(
      details.getByText("Fictional Quay", { exact: true }),
    ).toBeVisible();
    await expect(
      details.getByRole("button", { name: "Change Customers" }),
    ).toBeFocused();
  });
});
