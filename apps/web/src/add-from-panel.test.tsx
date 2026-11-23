// SPDX-License-Identifier: Apache-2.0

// Tests for adding a customer from a picker on the Projects page, against a simulated server.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  customer,
  customerId,
  newId,
  openPage,
  plan,
  proposal,
  proposalId,
  saved,
  sent,
  sidePanel,
} from "./test-projects-page.tsx";
import { recordCell } from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const atProposal = `/projects?tab=proposals&open=${proposalId}`;
const added = customer({ id: newId, keyNumber: 2, name: "Harbour Ferries" });
const withAdded = plan({ customers: [customer(), added] });
const linked = plan({
  customers: [customer(), added],
  proposals: [proposal({ customerIds: [customerId, newId] })],
});

const newForm = () => document.getElementById("linked-record-panel");

// Opens a proposal's details and its Customers picker, and types into it.
async function typeInCustomers(typed: string, address = atProposal, more = {}) {
  const opened = await openPage(address, plan(), more);
  await screen.findByRole("heading", { name: /Fictional Proposal/ });
  await userEvent.click(
    within(sidePanel()).getByRole("button", { name: "Change Customers" }),
  );
  const box = within(sidePanel()).getByRole("textbox", { name: "Customers" });
  if (typed === "") await userEvent.click(box);
  else await userEvent.type(box, typed);
  return opened;
}

describe("adding a record from a picker", () => {
  it("opens the new customer's form under the details, named by what was typed", async () => {
    await typeInCustomers("Harbour Ferries");
    await userEvent.click(
      screen.getByRole("option", { name: "New customer “Harbour Ferries”" }),
    );
    const form = newForm() as HTMLElement;
    expect([
      within(form).getByRole("heading", { name: "New customer" }),
      within(form).getByRole<HTMLInputElement>("textbox", { name: "Name" })
        .value,
      screen.getByRole("heading", { name: /Fictional Proposal/ }),
    ]).toEqual([expect.anything(), "Harbour Ferries", expect.anything()]);
  });

  it("adds the customer and links it, then closes, with focus back on Customers", async () => {
    const { fetch, held } = await typeInCustomers(
      "Harbour Ferries",
      atProposal,
      {
        "POST /api/customers": saved(() => withAdded),
        [`PUT /api/proposals/${proposalId}`]: saved(() => linked),
      },
    );
    await userEvent.keyboard("{Enter}");
    held.plan = withAdded;
    await userEvent.click(
      within(newForm() as HTMLElement).getByRole("button", { name: "Add" }),
    );
    await waitFor(() => {
      expect(sent(fetch, `PUT /api/proposals/${proposalId}`)).toEqual([
        expect.objectContaining({ customerIds: [customerId, newId] }),
      ]);
    });
    expect(sent(fetch, "POST /api/customers")).toEqual([
      { name: "Harbour Ferries" },
    ]);
    await waitFor(() => {
      expect(newForm()).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "Change Customers",
      );
    });
  });

  it("asks before discarding a form changed from what was typed", async () => {
    await typeInCustomers("Harbour");
    await userEvent.keyboard("{Enter}");
    const form = newForm() as HTMLElement;
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Name" }),
      " Ferries",
    );
    await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));
    const question = await screen.findByRole("dialog", {
      name: "Discard the new customer?",
    });
    await userEvent.click(
      within(question).getByRole("button", { name: "Discard" }),
    );
    await waitFor(() => {
      expect(newForm()).toBeNull();
    });
  });

  it("closes a form left as it opened without asking", async () => {
    await typeInCustomers("Harbour");
    await userEvent.keyboard("{Enter}");
    await userEvent.click(
      within(newForm() as HTMLElement).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(newForm()).toBeNull();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("adds from a cell's picker beside the table, then puts focus back on the cell", async () => {
    const { fetch, held } = await openPage("/projects?tab=proposals", plan(), {
      "POST /api/customers": saved(() => withAdded),
      [`PUT /api/proposals/${proposalId}`]: saved(() => linked),
    });
    await userEvent.click(recordCell(proposalId, "customerIds") as HTMLElement);
    await userEvent.keyboard("Harbour Ferries");
    await userEvent.click(
      await screen.findByRole("option", {
        name: "New customer “Harbour Ferries”",
      }),
    );
    held.plan = withAdded;
    await userEvent.click(
      within(newForm() as HTMLElement).getByRole("button", { name: "Add" }),
    );
    await waitFor(() => {
      expect(sent(fetch, `PUT /api/proposals/${proposalId}`)).toHaveLength(1);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        recordCell(proposalId, "customerIds"),
      );
    });
  });

  it("offers no New in a New form's own pickers", async () => {
    await openPage("/projects?tab=proposals", plan());
    await userEvent.click(screen.getByRole("button", { name: "New proposal" }));
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "Change Customers" }),
    );
    expect(
      screen
        .getAllByRole("option")
        .map(({ textContent }) => textContent)
        .filter((name) => name.startsWith("New")),
    ).toEqual([]);
  });

  it("offers no New in the empty row, which isn't a record to link to yet", async () => {
    await openPage("/projects?tab=proposals", plan());
    await userEvent.click(
      document.getElementById("cell-new-0-customerIds") as HTMLElement,
    );
    await userEvent.keyboard("{Enter}");
    expect(
      await screen.findByRole("option", { name: "Fictional Customer" }),
    ).toBeTruthy();
    expect(screen.queryByRole("option", { name: /^New customer/ })).toBeNull();
  });

  it("opens an empty form from New with nothing typed", async () => {
    await typeInCustomers("");
    await userEvent.click(screen.getByRole("option", { name: "New customer" }));
    expect(
      within(newForm() as HTMLElement).getByRole<HTMLInputElement>("textbox", {
        name: "Name",
      }).value,
    ).toBe("");
  });

  it("keeps the form, with what was entered, when the server refuses it", async () => {
    await typeInCustomers("Taken", atProposal, {
      "POST /api/customers": () =>
        Response.json({ error: "That name is taken" }, { status: 409 }),
    });
    await userEvent.keyboard("{Enter}");
    const form = newForm() as HTMLElement;
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    expect(await screen.findByText("That name is taken")).toBeTruthy();
    await waitFor(() => {
      expect(
        within(form)
          .getByRole("button", { name: "Add" })
          .getAttribute("data-loading"),
      ).toBeNull();
    });
    expect(
      within(form).getByRole<HTMLInputElement>("textbox", { name: "Name" })
        .value,
    ).toBe("Taken");
  });

  it("asks before leaving the page's tab with the form changed", async () => {
    await typeInCustomers("Harbour");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(
      within(newForm() as HTMLElement).getByRole("textbox", { name: "Name" }),
      " Ferries",
    );
    await userEvent.click(screen.getByRole("tab", { name: "Customers" }));
    expect(
      await screen.findByRole("dialog", { name: "Discard the new customer?" }),
    ).toBeTruthy();
  });

  it("stays while the customer is being added", async () => {
    await typeInCustomers("Harbour Ferries", atProposal, {
      "POST /api/customers": () => new Promise<Response>(() => undefined),
    });
    await userEvent.keyboard("{Enter}");
    await userEvent.click(
      within(newForm() as HTMLElement).getByRole("button", { name: "Add" }),
    );
    await userEvent.click(screen.getByRole("tab", { name: "Customers" }));
    expect([
      screen
        .getByRole("tab", { name: "Proposals" })
        .getAttribute("aria-selected"),
      newForm(),
    ]).toEqual(["true", expect.anything()]);
  });

  it("asks before closing the details with the form changed", async () => {
    await typeInCustomers("Harbour");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(
      within(newForm() as HTMLElement).getByRole("textbox", { name: "Name" }),
      " Ferries",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Discard the new customer?" }),
    ).toBeTruthy();
  });
});
