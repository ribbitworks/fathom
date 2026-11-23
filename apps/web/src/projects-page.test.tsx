// SPDX-License-Identifier: Apache-2.0

// Tests for the Projects page against a simulated server: its tabs and tables, adding a record in
// the side panel, what the side panel shows and links to, and the page around its tables.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  recordDraft,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";
import {
  customerId,
  proposalId,
  projectId,
  milestoneId,
  statusId,
  newId,
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
  newButton,
  rowMenu,
  chooseFrom,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the page's tabs", () => {
  it("shows each tab's table, with no way to add for those who only see the plan", async () => {
    const { history } = await openPage(
      "/projects",
      plan({ canEdit: false }),
      {},
      ["plan:view", "features:view"],
    );
    expect(screen.getByRole("grid", { name: "Projects" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^New/ })).toBeNull();
    for (const [tab, address] of [
      ["Proposals", "tab=proposals"],
      ["Customers", "tab=customers"],
      ["Milestones", "tab=milestones"],
    ] as const) {
      await userEvent.click(screen.getByRole("tab", { name: tab }));
      expect(await screen.findByRole("grid", { name: tab })).toBeTruthy();
      expect(history.location.search).toContain(address);
    }
  });

  it("offers each tab's own saved views", async () => {
    // Given a view saved on Proposals and none on Projects
    await openPage("/projects?tab=proposals", plan(), {
      "GET /api/views/proposals": () =>
        Response.json([
          {
            id: crypto.randomUUID(),
            name: "Fictional proposals",
            scope: "personal",
            definition: { search: "fictional" },
            canChange: true,
            canShare: false,
          },
        ]),
      "GET /api/views/projects": () =>
        Response.json([
          {
            id: crypto.randomUUID(),
            name: "Fictional projects",
            scope: "personal",
            definition: { search: "fictional" },
            canChange: true,
            canShare: false,
          },
        ]),
    });
    const offered = async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: /^Views/ }),
      );
      await screen.findByRole("menu");
      return screen
        .getAllByRole("menuitem")
        .map(({ textContent }) => textContent);
    };

    // When the Views menu opens on Proposals, then on Projects
    const onProposals = await offered();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("tab", { name: "Projects" }));
    await screen.findByRole("grid", { name: "Projects" });
    const onProjects = await offered();

    // Then each offers its own view alone
    expect(onProposals).toContain("Fictional proposals");
    expect(onProposals).not.toContain("Fictional projects");
    expect(onProjects).toContain("Fictional projects");
    expect(onProjects).not.toContain("Fictional proposals");
  });

  it("names its tabs, each pointing at the table it shows", async () => {
    await openPage("/projects", plan({ canEdit: false }), {}, [
      "plan:view",
      "features:view",
    ]);
    const tabs = screen.getByRole("tablist", { name: "Projects tables" });
    const chosen = within(tabs).getByRole("tab", { name: "Projects" });
    const shown = screen.getByRole("tabpanel", { name: "Projects" });
    expect(chosen.getAttribute("aria-controls")).toBe(shown.id);
    expect(within(shown).getByRole("grid", { name: "Projects" })).toBeTruthy();
  });

  it("says when the projects cannot be loaded, and tries again", async () => {
    let healthy = false;
    serverAnswers({
      "GET /api/session": () => Response.json(fictionalUser),
      "GET /api/projects": () =>
        healthy
          ? Response.json(plan())
          : Response.json({ error: "Down" }, { status: 500 }),
      "GET /api/projects/choices": () =>
        Response.json({
          owners: [],
          statuses: [],
          featureStatuses: [],
          featureTeams: [],
          priorities: [],
          sizes: [],
          risks: [],
        }),
    });
    renderApp("/projects");
    expect(
      await screen.findByText("Fathom could not load the projects."),
    ).toBeTruthy();
    healthy = true;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("grid", { name: "Projects" })).toBeTruthy();
  });
});

describe("adding a record in the side panel", () => {
  it("names what is missing, then adds the customer and shows it", async () => {
    const added = customer({
      id: newId,
      name: "Added Customer",
      draft: recordDraft({ action: "created" }),
    });
    const after = plan({ customers: [customer(), added] });
    const { fetch, history, held } = await openPage(
      "/projects?tab=customers",
      plan(),
      { "POST /api/customers": saved(() => after) },
    );
    await userEvent.click(await newButton("customer"));
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Name needed")).toBeTruthy();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Added Customer",
    );
    await userEvent.tab();
    expect(screen.queryByText("Name needed")).toBeNull();
    held.plan = after;
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(
      await screen.findByRole("heading", { name: /Added Customer/ }),
    ).toBeTruthy();
    expect(history.location.search).toContain(newId);
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("project-record-panel-title");
    });
    expect(sent(fetch, "POST /api/customers")).toEqual([
      { name: "Added Customer", description: "", note: null },
    ]);
  });

  it("starts a proposal in the first status, and sends what is entered", async () => {
    const after = plan({
      proposals: [proposal(), proposal({ id: newId, name: "Added Proposal" })],
    });
    const { fetch, held } = await openPage("/projects?tab=proposals", plan(), {
      "POST /api/proposals": saved(() => after),
    });
    await userEvent.click(await newButton("proposal"));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Added Proposal",
    );
    held.plan = after;
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(sent(fetch, "POST /api/proposals")).toEqual([
        {
          name: "Added Proposal",
          externalId: "",
          link: null,
          ownerId: null,
          customerIds: [],
          statusId,
          featureIds: [],
        },
      ]);
    });
  });

  it("adds a project", async () => {
    const after = plan({
      projects: [project(), project({ id: newId, name: "Added Project" })],
    });
    const { fetch, held } = await openPage("/projects", plan(), {
      "POST /api/projects": saved(() => after),
    });
    await userEvent.click(await newButton("project"));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Added Project",
    );
    held.plan = after;
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(sent(fetch, "POST /api/projects")).toEqual([
        {
          name: "Added Project",
          externalId: "",
          ownerId: null,
          customerIds: [],
          proposalIds: [],
          featureIds: [],
        },
      ]);
    });
  });

  it("adds a milestone to the project the table is filtered to, then closes", async () => {
    const after = plan({
      projects: [
        project({ milestones: [milestone({ id: newId, name: "Handover" })] }),
      ],
    });
    const { fetch, held } = await openPage("/projects", plan(), {
      [`POST /api/projects/${projectId}/milestones`]: saved(() => after),
    });
    const menu = await rowMenu("Fictional Project");
    await chooseFrom(menu, "Show milestones");
    await screen.findByRole("grid", { name: "Milestones" });
    await userEvent.click(await newButton("milestone"));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Handover",
    );
    const date = screen.getByRole<HTMLInputElement>("textbox", {
      name: /^Date/,
    });
    await userEvent.type(date, "20300901");
    expect(date.value).toBe("2030-09-01");
    held.plan = after;
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    });
    expect(sent(fetch, `POST /api/projects/${projectId}/milestones`)).toEqual([
      { name: "Handover", date: "2030-09-01", customerDelivery: false },
    ]);
  });

  it("keeps what was entered when the server refuses it", async () => {
    await openPage("/projects?tab=customers", plan(), {
      "POST /api/customers": () =>
        Response.json({ error: "That name is taken" }, { status: 409 }),
    });
    await userEvent.click(await newButton("customer"));
    const name = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Name",
    });
    await userEvent.type(name, "Taken");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("That name is taken")).toBeTruthy();
    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "Add" })
          .getAttribute("data-loading"),
      ).toBeNull();
    });
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value,
    ).toBe("Taken");
  });

  it("asks before discarding what was entered, and not when nothing was", async () => {
    await openPage("/projects?tab=customers", plan());
    await userEvent.click(await newButton("customer"));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    await userEvent.click(await newButton("customer"));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Unsure",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      await screen.findByRole("dialog", {
        name: "Discard the new customer?",
      }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Keep adding" }));
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Close New customer" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Discard" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    });
  });

  it("asks before changing tabs with something entered", async () => {
    const { history } = await openPage("/projects?tab=customers", plan());
    await userEvent.click(await newButton("customer"));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Unsure",
    );
    await userEvent.click(screen.getByRole("tab", { name: "Proposals" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Discard" }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain("tab=proposals");
    });
  });
});

describe("the side panel", () => {
  it("shows a project's values, and links to its customers and proposals", async () => {
    const { history } = await openPage(`/projects?open=${projectId}`, plan());
    const details = await screen.findByRole("heading", {
      name: "Fictional Project",
    });
    expect(details).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Milestones" })).getByText(
        "None",
      ),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Fictional Customer" }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain("tab=customers");
    });
    expect(history.location.search).toContain(customerId);
    await screen.findByRole("heading", { name: "Fictional Customer" });
  });

  it("links to a project's proposals, one to a line", async () => {
    const other = "b0000000-0000-4000-8000-000000000002";
    const { history } = await openPage(
      `/projects?open=${projectId}`,
      plan({
        projects: [project({ proposalIds: [proposalId, other] })],
        proposals: [proposal(), proposal({ id: other, name: "Second" })],
      }),
    );
    expect(
      (await screen.findByRole("button", { name: "Fictional Proposal" }))
        .parentElement?.textContent,
    ).toBe("Fictional Proposal");
    await userEvent.click(screen.getByRole("button", { name: "Second" }));
    await waitFor(() => {
      expect(history.location.search).toContain("tab=proposals");
    });
  });

  it("lists a project's customers one to a line", async () => {
    const other = "c0000000-0000-4000-8000-000000000002";
    await openPage(
      `/projects?open=${projectId}`,
      plan({
        projects: [project({ customerIds: [customerId, other] })],
        customers: [customer(), customer({ id: other, name: "Second" })],
      }),
    );
    expect(
      (await screen.findByRole("button", { name: "Fictional Customer" }))
        .parentElement?.textContent,
    ).toBe("Fictional Customer");
    expect(
      screen.getByRole("button", { name: "Second" }).parentElement?.textContent,
    ).toBe("Second");
  });

  it("leaves out a linked record it cannot name, and says None when there are none", async () => {
    await openPage(
      `/projects?open=${projectId}`,
      plan({
        projects: [
          project({
            customerIds: ["c0000000-0000-4000-8000-00000000000f"],
            proposalIds: [],
          }),
        ],
      }),
    );
    await screen.findByRole("heading", { name: "Fictional Project" });
    const panelText = sidePanel().textContent;
    expect(panelText).not.toContain("c0000000");
    expect(panelText).toContain("ProposalsNone");
  });

  it("shows a value a draft changes with its live value under it", async () => {
    await openPage(
      `/projects?tab=proposals&open=${proposalId}`,
      plan({
        proposals: [
          proposal({
            externalId: "NEW-1",
            draft: recordDraft({
              changed: ["externalId"],
              live: { externalId: "OLD-1" },
            }),
          }),
        ],
      }),
    );
    await screen.findByRole("heading", { name: /Fictional Proposal/ });
    expect(within(sidePanel()).getByText("OLD-1")).toBeTruthy();
    expect(within(sidePanel()).getByText("NEW-1")).toBeTruthy();
  });

  it("shows a project's dates, with the live ones under those its milestones' drafts change", async () => {
    await openPage(
      `/projects?open=${projectId}`,
      plan({
        projects: [
          project({
            milestones: [milestone()],
            dates: {
              first: "2030-03-15",
              last: "2030-10-15",
              nextDelivery: null,
            },
            liveDates: {
              first: "2030-03-15",
              last: "2030-09-01",
              nextDelivery: null,
            },
          }),
        ],
      }),
    );
    expect(await screen.findByText("Sep 1, 2030")).toBeTruthy();
  });

  it("says None for a date a project does not have", async () => {
    await openPage(`/projects?open=${projectId}`, plan());
    await screen.findByRole("heading", { name: /Fictional Project/ });
    expect(
      within(sidePanel()).getByText("First milestone").closest("div")
        ?.textContent,
    ).toBe("First milestoneNone");
  });

  it("words an empty live date as none, for one only its drafts give", async () => {
    await openPage(
      `/projects?open=${projectId}`,
      plan({
        projects: [
          project({
            milestones: [milestone()],
            dates: { first: "2030-03-15", last: null, nextDelivery: null },
            liveDates: { first: null, last: null, nextDelivery: null },
          }),
        ],
      }),
    );
    await screen.findByRole("heading", { name: /Fictional Project/ });
    const row = within(sidePanel()).getByText("First milestone").closest("div");
    expect(row?.textContent).toContain("Mar 15, 2030");
    expect(row?.textContent).toContain("No first milestone, live");
  });

  it("shows no live dates for a project only drafted to be added", async () => {
    await openPage(
      `/projects?open=${projectId}`,
      plan({
        projects: [
          project({
            draft: recordDraft({ action: "created" }),
            dates: { first: "2030-03-15", last: null, nextDelivery: null },
            liveDates: { first: null, last: null, nextDelivery: null },
          }),
        ],
      }),
    );
    await screen.findByRole("heading", { name: /Fictional Project/ });
    expect(screen.queryByText(", live")).toBeNull();
  });

  it("opens nothing for a record that is not there", async () => {
    await openPage(`/projects?open=${newId}`, plan());
    expect(screen.queryByRole("button", { name: "Close details" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Milestones" })).toBeNull();
  });

  it("closes, and goes to the project's milestones", async () => {
    const { history } = await openPage(`/projects?open=${projectId}`, plan());
    await userEvent.click(
      await screen.findByRole("button", { name: "Show milestones" }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain("tab=milestones");
    });
    await userEvent.click(screen.getByRole("tab", { name: "Projects" }));
    await screen.findByRole("grid", { name: "Projects" });
  });

  it("closes from its button", async () => {
    const { history } = await openPage(`/projects?open=${projectId}`, plan());
    await userEvent.click(
      await screen.findByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(history.location.search).not.toContain("open");
    });
  });

  it("shows a proposal's and a customer's details from their rows", async () => {
    const { history } = await openPage("/projects?tab=proposals", plan());
    await chooseFrom(await rowMenu("Fictional Proposal"), "Show details");
    await waitFor(() => {
      expect(history.location.search).toContain(proposalId);
    });
    await userEvent.click(screen.getByRole("tab", { name: "Customers" }));
    await chooseFrom(await rowMenu("Fictional Customer"), "Show details");
    await waitFor(() => {
      expect(history.location.search).toContain(customerId);
    });
  });
});

describe("the page around its tables", () => {
  it("keeps a change to the table's view in the address", async () => {
    const { history } = await openPage("/projects", plan());
    await userEvent.type(
      screen.getByRole("textbox", { name: /Search/ }),
      "Fictional",
    );
    await waitFor(() => {
      expect(history.location.search).toContain("Fictional");
    });
  });

  it("shows a record's details from the button in its Name cell", async () => {
    const { history } = await openPage("/projects?tab=customers", plan());
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Fictional Customer",
      }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain(customerId);
    });
  });

  it("opens no details on the Milestones tab", async () => {
    await openPage(`/projects?tab=milestones&open=${milestoneId}`, plan());
    expect(screen.queryByRole("button", { name: "Close details" })).toBeNull();
  });

  it("changes nothing while a record is being added", async () => {
    let finish: (answer: Response) => void = () => undefined;
    const { history } = await openPage("/projects?tab=customers", plan(), {
      "POST /api/customers": () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    });
    await userEvent.click(await newButton("customer"));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Slow");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await userEvent.click(screen.getByRole("tab", { name: "Proposals" }));
    expect(history.location.search).toContain("tab=customers");
    await userEvent.click(
      screen.getByRole("button", { name: "Close New customer" }),
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    finish(Response.json({ error: "Refused" }, { status: 409 }));
    expect(await screen.findByText("Refused")).toBeTruthy();
  });

  it("closes the milestone dialog with Esc", async () => {
    await openPage(`/projects?open=${projectId}`, plan());
    await userEvent.click(
      await screen.findByRole("button", { name: "Add milestone" }),
    );
    await screen.findByRole("dialog", { name: "New milestone" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("approves a draft after asking, sending only that record", async () => {
    const { fetch } = await openPage(
      "/projects?tab=customers",
      plan({
        customers: [
          customer({ draft: recordDraft() }),
          customer({ id: newId, name: "Another" }),
        ],
      }),
      { "POST /api/drafts/approval": deleted },
      approver,
    );
    await chooseFrom(await rowMenu("Fictional Customer"), "Approve draft…");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^Approve/ }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(sent(fetch, "POST /api/drafts/approval")).toEqual([
      expect.objectContaining({
        records: [{ type: "customer", id: customerId }],
      }),
    ]);
  });

  it("discards one record's draft, leaving the others as they are", async () => {
    const { fetch } = await openPage(
      "/projects?tab=customers",
      plan({
        customers: [
          customer({ draft: recordDraft() }),
          customer({ id: newId, name: "Another" }),
        ],
      }),
      { [`DELETE /api/records/customer/${customerId}/draft`]: deleted },
    );
    await chooseFrom(await rowMenu("Fictional Customer"), "Discard draft");
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(
        `DELETE /api/records/customer/${customerId}/draft`,
      );
    });
    expect(screen.getByText("Another")).toBeTruthy();
  });

  it("empties the milestone dialog's name from its clear button", async () => {
    await openPage(`/projects?open=${projectId}`, plan());
    await userEvent.click(
      await screen.findByRole("button", { name: "Add milestone" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "New milestone" });
    const name = within(dialog).getByRole<HTMLInputElement>("textbox", {
      name: /^Name/,
    });
    await userEvent.type(name, "Pilot");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Clear Name" }),
    );
    expect(name.value).toBe("");
  });

  it("does not carry what is typed in a new row to another tab", async () => {
    await openPage("/projects?tab=customers", plan());
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Half typed{Tab}");
    expect(screen.getByText("Half typed")).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Proposals" }));
    await screen.findByRole("grid", { name: "Proposals" });
    expect(screen.queryByText("Half typed")).toBeNull();
  });

  it("moves focus to a record's details when opened, and back to its row when closed", async () => {
    await openPage("/projects", plan());
    await chooseFrom(await rowMenu("Fictional Project"), "Show details");
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("project-record-panel-title");
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(document.activeElement?.id).toBe(`cell-${projectId}-name`);
    });
  });

  it("sets apart each group in a row's menu with a divider", async () => {
    await openPage(
      "/projects?tab=customers",
      plan({ customers: [customer({ draft: recordDraft() })] }),
      {},
      approver,
    );
    const menu = await rowMenu("Fictional Customer");
    expect(menu.querySelectorAll(".mantine-Menu-divider").length).toBe(4);
  });

  it("closes an open record when New is chosen", async () => {
    const { history } = await openPage(`/projects?open=${projectId}`, plan());
    await userEvent.click(await newButton("project"));
    await waitFor(() => {
      expect(history.location.search).not.toContain("open");
    });
  });

  it("names the record it could not add", async () => {
    await openPage("/projects?tab=customers", plan(), {
      "POST /api/customers": () => {
        throw new Error("Offline");
      },
    });
    await userEvent.click(await newButton("customer"));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Lost");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(
      await screen.findByText(
        "Fathom could not add Lost. Try again in a moment.",
      ),
    ).toBeTruthy();
  });

  it("says who owns a record by the table's words when nobody does", async () => {
    await openPage(
      `/projects?tab=proposals&open=${proposalId}`,
      plan({ proposals: [proposal({ ownerId: null })] }),
    );
    await screen.findByRole("heading", { name: /Fictional Proposal/ });
    expect(within(sidePanel()).getByText("No owner")).toBeTruthy();
  });

  it("shows a proposal's web link as a link", async () => {
    await openPage(
      `/projects?tab=proposals&open=${proposalId}`,
      plan({
        proposals: [
          proposal({
            link: "https://example.test/rfp",
          }),
        ],
      }),
    );
    await screen.findByRole("heading", { name: /Fictional Proposal/ });
    expect(
      within(sidePanel())
        .getByRole("link", { name: /example\.test/ })
        .getAttribute("href"),
    ).toBe("https://example.test/rfp");
  });

  it("shows a value a draft filled in as having been empty, in the words for none", async () => {
    await openPage(
      `/projects?tab=proposals&open=${proposalId}`,
      plan({
        proposals: [
          proposal({
            externalId: "NEW-1",
            draft: recordDraft({
              changed: ["externalId"],
              live: { externalId: null },
            }),
          }),
        ],
      }),
    );
    await screen.findByRole("heading", { name: /Fictional Proposal/ });
    expect(
      within(sidePanel()).getByText("NEW-1").closest("dd")?.textContent,
    ).toContain("No proposal ID, live");
  });
});
