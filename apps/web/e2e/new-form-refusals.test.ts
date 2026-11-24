// SPDX-License-Identifier: Apache-2.0

// UI tests of a New form refusing a value, stacked under a record's details or on its own page: the
// reason under the field, focus in it, nothing saved, and Add and Cancel acting on the first click.

import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./test-accounts.ts";

// The requests that would save something, as the page sends them.
function changesSent(): string[] {
  const changes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/"))
      changes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  return changes;
}

// One page, signed in once for the file, since signing in again for each test meets the limit on
// sign-in attempts.
test.describe.configure({ mode: "serial" });
let page: Page;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await signIn(page, "/projects?tab=proposals", "product.manager@fathom.test");
  await page.getByRole("button", { name: "New proposal" }).waitFor();
});
test.afterAll(async () => {
  await page.close();
});

// Opens Fleet Tracking Bid's details, then its Customers picker's New customer form, named by what
// was typed.
async function newCustomerFromBid(typed: string) {
  const bidId = await page.evaluate(async () => {
    const plan = (await (await fetch("/api/projects")).json()) as {
      proposals: { id: string; name: string }[];
    };
    return plan.proposals.find(({ name }) => name === "Fleet Tracking Bid")?.id;
  });
  await page.goto(`/projects?tab=proposals&open=${String(bidId)}`);
  const details = page.getByRole("region", { name: /Fleet Tracking Bid/ });
  await details.getByText("Customers", { exact: true }).click();
  await details.getByRole("textbox", { name: "Customers" }).fill(typed);
  await page.getByRole("option", { name: `New customer “${typed}”` }).click();
  const form = page.getByRole("region", { name: "New customer" });
  return { form, name: form.getByRole("textbox", { name: "Name" }) };
}

const customersNamed = (name: string) =>
  page.evaluate(async (wanted) => {
    const plan = (await (await fetch("/api/projects")).json()) as {
      customers: { name: string }[];
    };
    return plan.customers.filter((one) => one.name === wanted).length;
  }, name);

test("the stacked form refuses a Name emptied with its ×, keeping focus in it and saving nothing", async () => {
  // Given the New customer form stacked under a proposal's details, its Name filled in
  const { form, name } = await newCustomerFromBid("Fictional Depot");
  const changes = changesSent();

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
  expect(await customersNamed("Fictional Depot")).toBe(0);
});

test("the stacked form names a taken name under Name, with focus in it, and adds at the first click once it is changed", async () => {
  // Given the New customer form, named as a customer already is
  const { form, name } = await newCustomerFromBid("Marlow City Transit");
  const reason = "There is already a customer with that name";

  // When Add is selected, the server's refusal is under Name, not in a notification
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await expect(name).toHaveAccessibleDescription(new RegExp(reason));
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await expect(page.getByText(reason)).toHaveCount(1);
  expect(await customersNamed("Marlow City Transit")).toBe(1);

  // And when a new name is typed, leaving it takes the reason away, which moves Add up; one click
  // on Add still adds the customer
  await name.fill("Fictional Harbour Works");
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await expect(form).toBeHidden();
  expect(await customersNamed("Fictional Harbour Works")).toBe(1);
});

test("Cancel asks before discarding a name typed, and Keep adding puts focus back in it", async () => {
  const { form, name } = await newCustomerFromBid("Fictional Pier");
  await name.fill("Fictional Pier Two");
  await form.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Keep adding" }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("Fictional Pier Two");
});

test("the page's own New proposal names a taken name under Name, with focus in it, saving nothing", async () => {
  // Given the New proposal form on Projects
  await page.goto("/projects?tab=proposals");
  await page.getByRole("button", { name: "New proposal" }).click();
  const form = page.getByRole("region", { name: "New proposal" });
  const name = form.getByRole("textbox", { name: "Name" });

  // When it is named as a proposal already is, and added
  await name.fill("Fleet Tracking Bid");
  await form.getByRole("button", { name: "Add", exact: true }).click();

  // Then the server's refusal is under Name, with focus in it, and the form stays open
  const reason = "There is already a proposal with that name";
  await expect(name).toHaveAccessibleDescription(new RegExp(reason));
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await expect(page.getByText(reason)).toHaveCount(1);
  await expect(form).toBeVisible();
});
