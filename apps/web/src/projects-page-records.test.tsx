// SPDX-License-Identifier: Apache-2.0

// Tests for changing the Projects page's records: each change to a record's draft from its panel
// and its row's menu, the panel beside Live only, exporting a table, and a customer's description
// and notes.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { unsavedExport } from "./exports.ts";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordDraft, savedFiles } from "./test-support.tsx";
import {
  customerId,
  proposalId,
  projectId,
  milestoneId,
  newId,
  changeSetId,
  milestone,
  project,
  proposal,
  customer,
  plan,
  approver,
  saved,
  deleted,
  openPage,
  sent,
  sentTo,
  sidePanel,
  rowMenu,
  chooseFrom,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("changing a record in its panel", () => {
  const atProposal = `/projects?tab=proposals&open=${proposalId}`;
  const pencil = (label: string) =>
    within(sidePanel()).queryByRole("button", { name: `Change ${label}` });
  const heading = () =>
    screen.findByRole("heading", { name: /Fictional Proposal/ });

  it.each([
    [
      atProposal,
      /Fictional Proposal/,
      `PUT /api/proposals/${proposalId}`,
      "Proposal ID",
      "externalId",
    ],
    [
      `/projects?open=${projectId}`,
      /Fictional Project/,
      `PUT /api/projects/${projectId}`,
      "Project ID",
      "externalId",
    ],
    [
      `/projects?tab=customers&open=${customerId}`,
      /Fictional Customer/,
      `PUT /api/customers/${customerId}`,
      "Name",
      "name",
    ],
    [
      `/projects?tab=customers&open=${customerId}`,
      /Fictional Customer/,
      `PUT /api/customers/${customerId}`,
      "Description",
      "description",
    ],
  ])(
    "saves a value changed from its pencil at %s",
    async (address, name, request, label, key) => {
      // Given a record open beside the table
      const start = plan();
      const { fetch } = await openPage(address, start, {
        [request]: saved(() => start),
      });
      await screen.findByRole("heading", { name });
      // When a value is changed
      await userEvent.click(pencil(label) as HTMLElement);
      const box = within(sidePanel()).getByRole("textbox", { name: label });
      await userEvent.clear(box);
      await userEvent.type(box, "Changed{Enter}");
      // Then the change is sent
      await waitFor(() => {
        expect(sent(fetch, request)).toEqual([
          expect.objectContaining({ [key]: "Changed" }),
        ]);
      });
    },
  );

  it("names a value it will not take, saving nothing", async () => {
    // Given a proposal open beside the table
    const start = plan();
    const { fetch } = await openPage(atProposal, start, {
      [`PUT /api/proposals/${proposalId}`]: saved(() => start),
    });
    await heading();
    // When its Name is emptied
    await userEvent.click(pencil("Name") as HTMLElement);
    await userEvent.clear(
      within(sidePanel()).getByRole("textbox", { name: "Name" }),
    );
    await userEvent.keyboard("{Enter}");
    // Then the problem is named and nothing is sent
    expect(within(sidePanel()).getByText("Name needed")).toBeTruthy();
    expect(sent(fetch, `PUT /api/proposals/${proposalId}`)).toEqual([]);
  });

  it.each([
    ["those who only see the plan", atProposal, { canEdit: false }, {}],
    ["Live only", `${atProposal}&show=live`, {}, {}],
    ["a record held by another's changes", atProposal, {}, { heldBy: "Rae" }],
    [
      "a record drafted to be removed",
      atProposal,
      {},
      { draft: recordDraft({ action: "deleted" }) },
    ],
  ])(
    "offers no pencils to %s",
    async (_who, address, planMore, proposalMore) => {
      await openPage(
        address,
        plan({ ...planMore, proposals: [proposal(proposalMore)] }),
      );
      await heading();
      expect(pencil("Name")).toBeNull();
    },
  );

  it("offers no pencil for a project's dates", async () => {
    await openPage(`/projects?open=${projectId}`, plan());
    await screen.findByRole("heading", { name: /Fictional Project/ });
    expect(pencil("Name")).not.toBeNull();
    expect(pencil("First milestone")).toBeNull();
  });
});

describe("the panel beside Live only", () => {
  const drafted = plan({
    proposals: [
      proposal({
        externalId: "NEW-1",
        draft: recordDraft({
          changed: ["externalId"],
          live: { externalId: "OLD-1" },
        }),
      }),
    ],
    projects: [
      project({
        milestones: [milestone({ draft: recordDraft({ action: "created" }) })],
        dates: { first: "2030-03-15", last: null, nextDelivery: null },
        liveDates: { first: "2031-01-02", last: null, nextDelivery: null },
      }),
    ],
  });

  it("shows a record as it is live, with no way to change it", async () => {
    await openPage(`/projects?open=${projectId}&show=live`, drafted);
    await screen.findByRole("heading", { name: "Fictional Project" });
    expect(within(sidePanel()).getByText("Jan 2, 2031")).toBeTruthy();
    expect(within(sidePanel()).queryByText("Fictional Kickoff")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add milestone" })).toBeNull();
  });

  it("shows a project's live dates in the table", async () => {
    await openPage("/projects?show=live", drafted);
    expect(await screen.findAllByText("Jan 2, 2031")).toHaveLength(1);
  });

  it("shows no live value under a drafted one while drafts are applied", async () => {
    await openPage(
      `/projects?tab=proposals&open=${proposalId}&show=drafts`,
      drafted,
    );
    await screen.findByRole("heading", { name: /Fictional Proposal/ });
    expect(within(sidePanel()).getByText("NEW-1")).toBeTruthy();
    expect(within(sidePanel()).queryByText("OLD-1")).toBeNull();
  });
});

describe("changing a record from its row", () => {
  const typeInto = async (cell: string, text: string) => {
    act(() => {
      document.getElementById(cell)?.focus();
    });
    await userEvent.keyboard(`${text}{Enter}`);
  };

  it("drafts a change to a customer, a project, a proposal, and a milestone", async () => {
    const start = plan({
      projects: [project({ milestones: [milestone()] })],
    });
    const { fetch } = await openPage("/projects?tab=customers", start, {
      [`PUT /api/customers/${customerId}`]: saved(() => start),
      [`PUT /api/projects/${projectId}`]: saved(() => start),
      [`PUT /api/proposals/${proposalId}`]: saved(() => start),
      [`PUT /api/projects/${projectId}/milestones/${milestoneId}`]: saved(
        () => start,
      ),
    });
    await typeInto(`cell-${customerId}-name`, "A");
    await waitFor(() => {
      expect(sent(fetch, `PUT /api/customers/${customerId}`)).toEqual([
        { name: "A", description: null, note: null },
      ]);
    });
    await userEvent.click(screen.getByRole("tab", { name: "Projects" }));
    await screen.findByRole("grid", { name: "Projects" });
    await typeInto(`cell-${projectId}-name`, "B");
    await waitFor(() => {
      expect(sent(fetch, `PUT /api/projects/${projectId}`)).toHaveLength(1);
    });
    await userEvent.click(screen.getByRole("tab", { name: "Proposals" }));
    await screen.findByRole("grid", { name: "Proposals" });
    await typeInto(`cell-${proposalId}-name`, "C");
    await waitFor(() => {
      expect(sent(fetch, `PUT /api/proposals/${proposalId}`)).toHaveLength(1);
    });
    await userEvent.click(screen.getByRole("tab", { name: "Milestones" }));
    await screen.findByRole("grid", { name: "Milestones" });
    await typeInto(`cell-${milestoneId}-name`, "D");
    await waitFor(() => {
      expect(
        sent(fetch, `PUT /api/projects/${projectId}/milestones/${milestoneId}`),
      ).toEqual([{ name: "D", date: "2030-03-15", customerDelivery: true }]);
    });
  });

  it("removes a record nothing names, and a milestone by its project", async () => {
    const start = plan({
      projects: [project({ customerIds: [], milestones: [milestone()] })],
      proposals: [proposal({ customerIds: [] })],
    });
    const { fetch } = await openPage("/projects?tab=customers", start, {
      [`DELETE /api/customers/${customerId}`]: deleted,
      [`DELETE /api/projects/${projectId}/milestones/${milestoneId}`]: deleted,
    });
    await chooseFrom(await rowMenu("Fictional Customer"), "Remove customer");
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(`DELETE /api/customers/${customerId}`);
    });
    await userEvent.click(screen.getByRole("tab", { name: "Milestones" }));
    await chooseFrom(await rowMenu("Fictional Kickoff"), "Remove milestone");
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(
        `DELETE /api/projects/${projectId}/milestones/${milestoneId}`,
      );
    });
  });

  it("removes a project and a proposal", async () => {
    const { fetch } = await openPage("/projects", plan(), {
      [`DELETE /api/projects/${projectId}`]: deleted,
      [`DELETE /api/proposals/${proposalId}`]: deleted,
    });
    await chooseFrom(await rowMenu("Fictional Project"), "Remove project");
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(`DELETE /api/projects/${projectId}`);
    });
    await userEvent.click(screen.getByRole("tab", { name: "Proposals" }));
    await chooseFrom(await rowMenu("Fictional Proposal"), "Remove proposal");
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(`DELETE /api/proposals/${proposalId}`);
    });
  });

  it("undoes a change from its notice", async () => {
    const { fetch, held } = await openPage(
      "/projects?tab=customers",
      plan({
        customers: [
          customer({
            id: newId,
            name: "Only Drafted",
            draft: recordDraft({ action: "created" }),
          }),
        ],
      }),
      {
        [`DELETE /api/records/customer/${newId}/draft`]: deleted,
        [`POST /api/undo/${changeSetId}`]: deleted,
      },
    );
    held.plan = plan({ customers: [] });
    await chooseFrom(await rowMenu("Only Drafted"), "Discard draft");
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(`POST /api/undo/${changeSetId}`);
    });
  });

  it("discards a draft changing a record", async () => {
    const start = plan({
      customers: [
        customer({
          draft: recordDraft({ changed: ["name"], live: { name: "Before" } }),
        }),
      ],
    });
    const { fetch } = await openPage("/projects?tab=customers", start, {
      [`DELETE /api/records/customer/${customerId}/draft`]: deleted,
    });
    await chooseFrom(await rowMenu("Fictional Customer"), "Discard draft");
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(
        `DELETE /api/records/customer/${customerId}/draft`,
      );
    });
  });

  it("discards a draft adding a record, saying so", async () => {
    const { held } = await openPage(
      "/projects?tab=customers",
      plan({
        customers: [
          customer({
            id: newId,
            name: "Only Drafted",
            draft: recordDraft({ action: "created" }),
          }),
        ],
      }),
      { [`DELETE /api/records/customer/${newId}/draft`]: deleted },
    );
    held.plan = plan({ customers: [] });
    await chooseFrom(await rowMenu("Only Drafted"), "Discard draft");
    expect(
      await screen.findByText("Discarded the draft adding Only Drafted."),
    ).toBeTruthy();
  });

  it("sends a rejected draft for approval again", async () => {
    const start = plan({
      customers: [
        customer({
          draft: recordDraft({ state: "rejected", reason: "No" }),
        }),
      ],
    });
    const { fetch } = await openPage("/projects?tab=customers", start, {
      [`DELETE /api/records/customer/${customerId}/draft/rejection`]: deleted,
    });
    await chooseFrom(await rowMenu("Fictional Customer"), "Resubmit");
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(
        `DELETE /api/records/customer/${customerId}/draft/rejection`,
      );
    });
  });

  it("approves a record's draft after asking, and closes the question", async () => {
    await openPage(
      "/projects?tab=customers",
      plan({ customers: [customer({ draft: recordDraft() })] }),
      {},
      approver,
    );
    await chooseFrom(await rowMenu("Fictional Customer"), "Approve draft…");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("goes from a milestone to its project", async () => {
    const { history } = await openPage(
      "/projects?tab=milestones",
      plan({ projects: [project({ milestones: [milestone()] })] }),
    );
    await chooseFrom(await rowMenu("Fictional Kickoff"), "Show project");
    await waitFor(() => {
      expect(history.location.search).toContain(projectId);
    });
    expect(sidePanel()).toBeTruthy();
  });
});

describe("exporting a plan table", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says the file couldn't be saved when the browser's Save dialog fails", async () => {
    vi.stubGlobal(
      "showSaveFilePicker",
      vi.fn(async () => Promise.reject(new Error("No place"))),
    );
    await openPage("/projects", plan());
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "TSV file" }),
    );
    expect(await screen.findByText(unsavedExport)).not.toBeNull();
  });

  it("saves what the Projects tab shows at once, asking nothing, since the plan is General", async () => {
    // Given the Projects tab
    const files = savedFiles();
    await openPage("/projects", plan());

    // When it is exported as a CSV file from the page's heading
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );

    // Then no question is asked, and the file holds the project, after the Draft and Change columns
    await waitFor(() => {
      expect(files).toHaveLength(1);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    const [file] = files;
    expect(file?.name).toMatch(
      /^fathom_projects_fictional-person_drafts-and-live_\d{4}-\d{2}-\d{2}\.csv$/u,
    );
    const lines = (await file?.text())?.split("\r\n") ?? [];
    // Reading the file as text takes off its byte order mark.
    expect(lines[0]).toMatch(/^Draft,Change,Name,/u);
    expect(lines.some((line) => line.includes("Fictional Project"))).toBe(true);
  });
});

describe("a customer's description and notes", () => {
  const described = plan({
    customers: [
      customer({
        description: "Island ferry line",
        note: "**Pilot** at the north quay first.",
      }),
    ],
  });

  it("shows them in the table, Notes last", async () => {
    await openPage("/projects?tab=customers", described);

    const grid = await screen.findByRole("grid", { name: "Customers" });
    expect(
      within(grid)
        .getAllByRole("columnheader")
        .map(({ textContent }) => textContent)
        .filter((text) => text !== "" && text !== "Actions"),
    ).toEqual([
      "Name",
      "Description",
      "Projects",
      "Proposals",
      "Features",
      "Notes",
    ]);
    expect(within(grid).getByText("Island ferry line")).toBeDefined();
  });

  it("lists them under Details in a customer's details, Notes last, as a feature's are", async () => {
    await openPage(`/projects?tab=customers&open=${customerId}`, described);
    await screen.findByRole("heading", { name: /Fictional Customer/u });

    expect(
      within(sidePanel())
        .getAllByRole("heading", { level: 3 })
        .map(({ textContent }) => textContent),
    ).toEqual(["Details"]);
    expect(
      [...sidePanel().querySelectorAll("dt")].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Name", "Description", "Notes"]);
    expect(within(sidePanel()).getByText("Island ferry line")).toBeDefined();
    expect(within(sidePanel()).getByText("Pilot")).toBeDefined();
  });
});
