// SPDX-License-Identifier: Apache-2.0

// Tests for adding a record from a picker on the Projects and Features pages, against a simulated
// server.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  choices,
  customer,
  customerId,
  featurePlan,
  first,
  newId,
  open,
  openPage,
  plan,
  project,
  projectId,
  proposal,
  proposalId,
  saved,
  sent,
  sidePanel,
  statusId,
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
      { name: "Harbour Ferries", description: "", note: null },
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

  it("adds a customer from a project's Customers and links it to the project", async () => {
    const onProject = plan({
      customers: [customer(), added],
      projects: [project({ customerIds: [customerId, newId] })],
    });
    const { fetch, held } = await openPage(
      `/projects?open=${projectId}`,
      plan(),
      {
        "POST /api/customers": saved(() => withAdded),
        [`PUT /api/projects/${projectId}`]: saved(() => onProject),
      },
    );
    await screen.findByRole("heading", { name: /Fictional Project/ });
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "Change Customers" }),
    );
    await userEvent.type(
      within(sidePanel()).getByRole("textbox", { name: "Customers" }),
      "Harbour Ferries{Enter}",
    );
    held.plan = withAdded;
    await userEvent.click(
      within(newForm() as HTMLElement).getByRole("button", { name: "Add" }),
    );
    await waitFor(() => {
      expect(sent(fetch, `PUT /api/projects/${projectId}`)).toEqual([
        expect.objectContaining({ customerIds: [customerId, newId] }),
      ]);
    });
  });

  it("names the form's values apart from the details' values it is stacked under", async () => {
    await typeInCustomers("Harbour");
    await userEvent.keyboard("{Enter}");
    const ids = [...document.querySelectorAll("[id*='-value-']")].map(
      ({ id }) => id,
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "new-record-value-name-label",
        "record-value-customerIds-label",
      ]),
    );
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("puts focus on the form's own field when Add is refused under the details", async () => {
    await typeInCustomers("Harbour");
    await userEvent.keyboard("{Enter}");
    const form = newForm() as HTMLElement;
    await userEvent.clear(within(form).getByRole("textbox", { name: "Name" }));
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("new-record-value-name-editor");
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

  it("offers no New customer in a proposal's empty row, whose customers can change once saved", async () => {
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

// What a field's description and error under it say, as screen readers read them with it.
const saidUnder = (field: HTMLElement) =>
  (field.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

describe("a value refused in the new record's form", () => {
  const nameIn = (form: HTMLElement) =>
    within(form).getByRole<HTMLInputElement>("textbox", { name: "Name" });

  it("keeps focus in Name when its × empties it", async () => {
    await typeInCustomers("Zeta Depot");
    await userEvent.keyboard("{Enter}");
    const form = newForm() as HTMLElement;
    await userEvent.click(
      within(form).getByRole("button", { name: "Clear Name" }),
    );
    expect([nameIn(form).value, document.activeElement]).toEqual([
      "",
      nameIn(form),
    ]);
  });

  it("refuses an emptied Name on Add, keeping it empty with the reason under it, and adds nothing", async () => {
    const { fetch } = await typeInCustomers("Zeta Depot");
    await userEvent.keyboard("{Enter}");
    const form = newForm() as HTMLElement;
    await userEvent.click(
      within(form).getByRole("button", { name: "Clear Name" }),
    );
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(document.activeElement).toBe(nameIn(form));
    });
    expect([
      nameIn(form).value,
      nameIn(form).getAttribute("aria-invalid"),
      saidUnder(nameIn(form)),
      newForm(),
      sent(fetch, "POST /api/customers"),
    ]).toEqual(["", "true", expect.stringContaining("Name needed"), form, []]);
  });

  it("names a refusal from the server under Name, with focus in it, not in a notification", async () => {
    const reason = "Another customer has that name";
    await typeInCustomers("Marlow City Transit", atProposal, {
      "POST /api/customers": () =>
        Response.json({ error: reason, field: "name" }, { status: 409 }),
    });
    await userEvent.keyboard("{Enter}");
    const form = newForm() as HTMLElement;
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(saidUnder(nameIn(form))).toContain(reason);
    });
    expect([
      nameIn(form).value,
      nameIn(form).getAttribute("aria-invalid"),
      document.activeElement,
      screen.getAllByText(reason).every((shown) => form.contains(shown)),
    ]).toEqual(["Marlow City Transit", "true", nameIn(form), true]);
  });
});

describe("adding a record from a feature's picker", () => {
  const atFirst = `/features?open=${first.id}`;
  const start = featurePlan({ canEdit: true });

  async function newFrom(label: string, typed: string, answers = {}) {
    const opened = await open(start, answers, atFirst);
    await screen.findByRole("heading", { name: /Fictional First/ });
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: `Change ${label}` }),
    );
    await userEvent.type(
      within(sidePanel()).getByRole("textbox", { name: label }),
      `${typed}{Enter}`,
    );
    return opened;
  }

  it.each([
    [
      "Projects",
      "project",
      "/api/projects",
      { projects: [project(), project({ id: newId, name: "Harbour Survey" })] },
    ],
    [
      "Proposals",
      "proposal",
      "/api/proposals",
      {
        proposals: [
          proposal(),
          proposal({ id: newId, name: "Harbour Survey" }),
        ],
      },
    ],
  ])(
    "adds a new record from %s, naming the feature, with nothing else to link",
    async (label, one, path, added) => {
      const after = featurePlan({ canEdit: true, ...added });
      const { fetch, held } = await newFrom(label, "Harbour Survey", {
        [`POST ${path}`]: saved(() => after),
        // A new proposal starts in the first status offered.
        "GET /api/projects/choices": async () =>
          Response.json({
            ...((await choices().json()) as object),
            statuses: [{ id: statusId, name: "Open", retired: false }],
          }),
      });
      const form = newForm() as HTMLElement;
      expect(
        within(form).getByRole("heading", { name: `New ${one}` }),
      ).toBeTruthy();
      held.plan = after;
      await userEvent.click(within(form).getByRole("button", { name: "Add" }));
      await waitFor(() => {
        expect(sent(fetch, `POST ${path}`)).toEqual([
          expect.objectContaining({
            name: "Harbour Survey",
            featureIds: [first.id],
          }),
        ]);
      });
      await waitFor(() => {
        expect(newForm()).toBeNull();
      });
      expect(sent(fetch, `PUT /api/features/${first.id}`)).toEqual([]);
    },
  );

  it("adds a customer and links it to the feature", async () => {
    const after = featurePlan({
      canEdit: true,
      customers: [customer(), added],
    });
    const { fetch, held } = await newFrom("Customers", "Harbour Ferries", {
      "POST /api/customers": saved(() => after),
      [`PUT /api/features/${first.id}`]: saved(() => after),
    });
    held.plan = after;
    await userEvent.click(
      within(newForm() as HTMLElement).getByRole("button", { name: "Add" }),
    );
    await waitFor(() => {
      expect(sent(fetch, `PUT /api/features/${first.id}`)).toEqual([
        expect.objectContaining({ customerIds: [newId] }),
      ]);
    });
  });

  it("asks before discarding a new project changed from how it opened", async () => {
    await newFrom("Projects", "Harbour Survey");
    const form = newForm() as HTMLElement;
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Project ID" }),
      "HS-1",
    );
    await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(
      await screen.findByRole("dialog", { name: "Discard the new project?" }),
    ).toBeTruthy();
  });

  it("closes a new project left as it opened, naming the feature, without asking", async () => {
    await newFrom("Projects", "Harbour Survey");
    await userEvent.click(
      within(newForm() as HTMLElement).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(newForm()).toBeNull();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers no New to a role that changes features but not the plan, which can't change Customers", async () => {
    await open(featurePlan(), {}, atFirst);
    await screen.findByRole("heading", { name: /Fictional First/ });
    expect(
      within(sidePanel()).queryByRole("button", { name: "Change Customers" }),
    ).toBeNull();
  });
});

describe("adding a project from a new milestone's row", () => {
  const surveyed = plan({
    projects: [project(), project({ id: newId, name: "Harbour Survey" })],
  });
  const newCell = (key: string) =>
    document.getElementById(`cell-new-0-${key}`) as HTMLElement;

  it("adds the project and fills the row with it, keeping what was typed in the row", async () => {
    // Given the Milestones tab, with a name typed in the empty row
    const { fetch, held } = await openPage("/projects?tab=milestones", plan(), {
      "POST /api/projects": saved(() => surveyed),
    });
    await userEvent.click(newCell("name"));
    await userEvent.keyboard("Survey done{Enter}");

    // When New project is chosen in its Project picker, a date is typed in the row, and the project
    // is added
    await userEvent.click(newCell("projectId"));
    await userEvent.keyboard("Harbour Survey");
    await userEvent.click(
      await screen.findByRole("option", {
        name: "New project “Harbour Survey”",
      }),
    );
    const form = newForm() as HTMLElement;
    expect(
      within(form).getByRole("heading", { name: "New project" }),
    ).toBeTruthy();
    await userEvent.click(newCell("date"));
    await userEvent.keyboard("20300501{Enter}");
    held.plan = surveyed;
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));

    // Then the project is sent, and the row keeps its name and date, its Project now the new one
    await waitFor(() => {
      expect(newForm()).toBeNull();
    });
    expect([
      sent(fetch, "POST /api/projects"),
      newCell("name").textContent,
      newCell("date").textContent,
      newCell("projectId").textContent,
    ]).toEqual([
      [expect.objectContaining({ name: "Harbour Survey" })],
      expect.stringMatching(/^Survey done/u),
      expect.stringMatching(/2030/u),
      "FP-1 Harbour Survey",
    ]);
    await waitFor(() => {
      expect(document.activeElement).toBe(newCell("projectId"));
    });
  });
});
