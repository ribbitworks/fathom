// SPDX-License-Identifier: Apache-2.0

// Tests for the Projects page against a simulated server: its tabs and tables, adding a record in
// the side panel, what the side panel shows and links to, a project's milestones, and each change
// to a record's draft, from its row's menu and a milestone's menu.

import type { ProjectPlan } from "@fathom/shared";
import { projectLengths } from "@fathom/shared";
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
import { operationsOf } from "./projects.ts";

const customerId = "c0000000-0000-4000-8000-000000000001";
const proposalId = "b0000000-0000-4000-8000-000000000001";
const projectId = "a0000000-0000-4000-8000-000000000001";
const milestoneId = "d0000000-0000-4000-8000-000000000001";
const ownerId = "e0000000-0000-4000-8000-000000000001";
const statusId = "f0000000-0000-4000-8000-000000000001";
const newId = "90000000-0000-4000-8000-000000000001";
const changeSetId = "80000000-0000-4000-8000-000000000001";

type Plan = ProjectPlan;
type Project = Plan["projects"][number];
type Milestone = Project["milestones"][number];

const milestone = (more: Partial<Milestone> = {}): Milestone => ({
  id: milestoneId,
  projectId,
  name: "Fictional Kickoff",
  date: "2030-03-15",
  customerDelivery: true,
  ...more,
});

const project = (more: Partial<Project> = {}): Project => ({
  id: projectId,
  name: "Fictional Project",
  externalId: "FP-1",
  ownerId,
  customerIds: [customerId],
  proposalIds: [proposalId],
  milestones: [],
  dates: { first: null, last: null, nextDelivery: null },
  ...more,
});

const proposal = (more: Partial<Plan["proposals"][number]> = {}) => ({
  id: proposalId,
  name: "Fictional Proposal",
  externalId: null,
  link: null,
  ownerId: null,
  customerIds: [customerId],
  statusId,
  ...more,
});

const customer = (more: Partial<Plan["customers"][number]> = {}) => ({
  id: customerId,
  name: "Fictional Customer",
  ...more,
});

const plan = (more: Partial<Plan> = {}): Plan => ({
  customers: [customer()],
  projects: [project()],
  proposals: [proposal()],
  features: [],
  canEdit: true,
  canEditFeatures: false,
  ...more,
});

const editor = ["plan:view", "plan:edit"];
const approver = [...editor, "plan:approve"];

const saved = (current: () => Plan) => () =>
  Response.json({ plan: current(), changeSetId });
const deleted = () => Response.json({ changeSetId });

// Opens the page at an address, with the server holding the plan the test can change.
async function openPage(
  path: string,
  start: Plan,
  answers: Parameters<typeof serverAnswers>[0] = {},
  permissions: string[] = editor,
) {
  const held = { plan: start };
  const fetch = serverAnswers({
    "GET /api/session": () => Response.json({ ...fictionalUser, permissions }),
    "GET /api/projects": () => Response.json(held.plan),
    "GET /api/projects/choices": () =>
      Response.json({
        owners: [{ id: ownerId, name: "Fictional Owner", retired: false }],
        statuses: [{ id: statusId, name: "Open", retired: false }],
        featureTeams: [],
      }),
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("grid");
  return { fetch, history, held };
}

const sent = (fetch: ReturnType<typeof serverAnswers>, key: string) =>
  fetch.mock.calls
    .filter(([url, init]) => `${init?.method ?? "GET"} ${url}` === key)
    .map(([, init]) => JSON.parse(init?.body as string) as unknown);

const sentTo = (fetch: ReturnType<typeof serverAnswers>) =>
  fetch.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);

const sidePanel = () => {
  const found = document.getElementById("project-record-panel");
  if (found === null) throw new Error("No side panel");
  return found;
};

const newButton = (name: string) =>
  screen.findByRole("button", { name: `New ${name}` });

const rowMenu = async (name: string) => {
  await userEvent.click(
    await screen.findByRole("button", { name: `Actions for ${name}` }),
  );
  return screen.findByRole("menu");
};

const chooseFrom = async (menu: HTMLElement, name: string) => {
  await userEvent.click(within(menu).getByRole("menuitem", { name }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the page's tabs", () => {
  it("shows each tab's table, with no way to add for those who only see the plan", async () => {
    const { history } = await openPage(
      "/projects",
      plan({ canEdit: false }),
      {},
      ["plan:view"],
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

  it("says when the projects cannot be loaded, and tries again", async () => {
    let healthy = false;
    serverAnswers({
      "GET /api/session": () => Response.json(fictionalUser),
      "GET /api/projects": () =>
        healthy
          ? Response.json(plan())
          : Response.json({ error: "Down" }, { status: 500 }),
      "GET /api/projects/choices": () =>
        Response.json({ owners: [], statuses: [], featureTeams: [] }),
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
      { name: "Added Customer" },
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
        name: "Discard the customer you're adding?",
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
    expect(screen.getByText("No milestones yet")).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Fictional Customer" }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain("tab=customers");
    });
    expect(history.location.search).toContain(customerId);
    await screen.findByRole("heading", { name: "Fictional Customer" });
  });

  it("links to a project's proposals, separated when there are several", async () => {
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
    ).toBe("Fictional Proposal,");
    await userEvent.click(screen.getByRole("button", { name: "Second" }));
    await waitFor(() => {
      expect(history.location.search).toContain("tab=proposals");
    });
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

  it("shows None as the live date of one only its drafts give", async () => {
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
    expect(row?.textContent).toMatch(/None\s*Live/);
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
    expect(screen.queryByText("Live")).toBeNull();
  });

  it("opens nothing for a record that is not there", async () => {
    await openPage(`/projects?open=${newId}`, plan());
    expect(screen.queryByRole("button", { name: "Close details" })).toBeNull();
    expect(screen.queryByText("No milestones yet")).toBeNull();
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

describe("a project's milestones in its panel", () => {
  const withMilestone = (more: Partial<Milestone> = {}) =>
    plan({ projects: [project({ milestones: [milestone(more)] })] });
  const atProject = `/projects?open=${projectId}`;
  const path = `/api/projects/${projectId}/milestones`;

  it("adds one from a dialog", async () => {
    const { fetch } = await openPage(atProject, plan(), {
      [`POST ${path}`]: saved(() => plan()),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Add milestone" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "New milestone" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add milestone" }),
    );
    expect(within(dialog).getByText("Name needed")).toBeTruthy();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: /^Name/ }),
      "Pilot",
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: /^Date/ }),
      "20300315",
    );
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Customer delivery" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add milestone" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(sent(fetch, `POST ${path}`)).toEqual([
      { name: "Pilot", date: "2030-03-15", customerDelivery: true },
    ]);
  });

  describe("the dialog's checks", () => {
    const openDialog = async () => {
      await openPage(atProject, plan());
      await userEvent.click(
        await screen.findByRole("button", { name: "Add milestone" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "New milestone",
      });
      return {
        dialog: within(dialog),
        name: within(dialog).getByRole<HTMLInputElement>("textbox", {
          name: /^Name/,
        }),
        date: within(dialog).getByRole<HTMLInputElement>("textbox", {
          name: /^Date/,
        }),
        submit: () =>
          userEvent.click(
            within(dialog).getByRole("button", { name: "Add milestone" }),
          ),
      };
    };

    it("starts in Name, which stops at the longest name", async () => {
      const { name } = await openDialog();
      await waitFor(() => {
        expect(document.activeElement).toBe(name);
      });
      expect(name.maxLength).toBe(projectLengths.name);
    });

    it("says a date is needed, and takes it back once one is given", async () => {
      const { dialog, date, submit } = await openDialog();
      await submit();
      expect(dialog.getByText("Date needed")).toBeTruthy();
      await userEvent.type(date, "20300315");
      expect(dialog.queryByText("Date needed")).toBeNull();
    });

    it("says an unfinished date is not a date", async () => {
      const { dialog, date, submit } = await openDialog();
      await userEvent.type(date, "2030");
      await submit();
      expect(dialog.getByText("Use a date such as 2026-10-31")).toBeTruthy();
    });

    it("needs more than spaces in a name, and takes that back once given one", async () => {
      const { dialog, name, submit } = await openDialog();
      await userEvent.type(name, "   ");
      await submit();
      expect(dialog.getByText("Name needed")).toBeTruthy();
      await userEvent.type(name, "Pilot");
      expect(dialog.queryByText("Name needed")).toBeNull();
    });
  });

  it("closes the dialog on Cancel", async () => {
    await openPage(atProject, plan());
    await userEvent.click(
      await screen.findByRole("button", { name: "Add milestone" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "New milestone" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("changes one from a dialog", async () => {
    const start = withMilestone();
    const { fetch } = await openPage(atProject, start, {
      [`PUT ${path}/${milestoneId}`]: saved(() => start),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Menu of Fictional Kickoff" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Edit…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Edit milestone",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(sent(fetch, `PUT ${path}/${milestoneId}`)).toEqual([
      {
        name: "Fictional Kickoff",
        date: "2030-03-15",
        customerDelivery: true,
      },
    ]);
  });

  it("removes one", async () => {
    const start = withMilestone();
    const { fetch } = await openPage(atProject, start, {
      [`DELETE ${path}/${milestoneId}`]: deleted,
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Menu of Fictional Kickoff" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove milestone" }),
    );
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(`DELETE ${path}/${milestoneId}`);
    });
  });

  it("offers no menu to those who may not change it, while it has no draft", async () => {
    await openPage(atProject, { ...withMilestone(), canEdit: false }, {}, [
      "plan:view",
    ]);
    await screen.findByText("Fictional Kickoff");
    expect(
      screen.queryByRole("button", { name: "Menu of Fictional Kickoff" }),
    ).toBeNull();
  });

  it("shows no way to add to a project being removed", async () => {
    await openPage(
      atProject,
      plan({
        projects: [project({ draft: recordDraft({ action: "deleted" }) })],
      }),
    );
    await screen.findByRole("heading", { name: /Fictional Project/ });
    expect(screen.queryByRole("button", { name: "Add milestone" })).toBeNull();
  });

  it("offers only discarding its draft while it is being removed", async () => {
    await openPage(
      atProject,
      withMilestone({ draft: recordDraft({ action: "deleted" }) }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Menu of Fictional Kickoff" }),
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Edit…" })).toBeNull();
    expect(
      within(menu).getByRole("menuitem", { name: /Discard/ }),
    ).toBeTruthy();
  });

  it("offers editing but not removing one only drafted to be added", async () => {
    await openPage(
      atProject,
      withMilestone({ draft: recordDraft({ action: "created" }) }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Menu of Fictional Kickoff" }),
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Edit…" })).toBeTruthy();
    expect(
      within(menu).queryByRole("menuitem", { name: "Remove milestone" }),
    ).toBeNull();
  });

  it("discards its draft", async () => {
    const start = withMilestone({ draft: recordDraft() });
    const { fetch } = await openPage(atProject, start, {
      [`DELETE /api/records/milestone/${milestoneId}/draft`]: deleted,
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Menu of Fictional Kickoff" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Discard/ }),
    );
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(
        `DELETE /api/records/milestone/${milestoneId}/draft`,
      );
    });
  });

  it("sends a rejected draft for approval again", async () => {
    const start = withMilestone({
      draft: recordDraft({ state: "rejected", reason: "Too soon" }),
    });
    const { fetch } = await openPage(atProject, start, {
      [`DELETE /api/records/milestone/${milestoneId}/draft/rejection`]: deleted,
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Menu of Fictional Kickoff" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Resubmit/ }),
    );
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(
        `DELETE /api/records/milestone/${milestoneId}/draft/rejection`,
      );
    });
  });

  it("asks before approving or rejecting its draft", async () => {
    await openPage(
      atProject,
      withMilestone({ draft: recordDraft() }),
      {},
      approver,
    );
    const open = async () => {
      await userEvent.click(
        await screen.findByRole("button", {
          name: "Menu of Fictional Kickoff",
        }),
      );
      return screen.findByRole("menu");
    };
    await chooseFrom(await open(), "Approve…");
    const approve = await screen.findByRole("dialog");
    await userEvent.click(
      within(approve).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await chooseFrom(await open(), "Reject…");
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("names who holds it, and closes on Esc", async () => {
    await openPage(
      atProject,
      withMilestone({
        draft: recordDraft(),
        heldBy: "Someone Else",
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Menu of Fictional Kickoff" }),
    );
    expect(
      within(await screen.findByRole("menu")).getByText(/Someone Else/),
    ).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
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
    await chooseFrom(await rowMenu("Fictional Customer"), "Approve draft");
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

  it("shows a value a draft filled in as having been None", async () => {
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
    ).toContain("None");
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

describe("a milestone's menu", () => {
  it("closes on a click on nothing in it, ignores other keys, and marks an unpublished draft", async () => {
    await openPage(
      `/projects?open=${projectId}`,
      plan({
        projects: [
          project({
            milestones: [
              milestone({ draft: recordDraft({ unpublished: true }) }),
            ],
          }),
        ],
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Menu of Fictional Kickoff" }),
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText(/Only you see these changes/)).toBeTruthy();
    await userEvent.keyboard("a");
    expect(screen.getByRole("menu")).toBeTruthy();
    await userEvent.click(within(menu).getByText("Fictional Kickoff"));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
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
        { name: "A" },
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

  it("removes a record, and a milestone by its project", async () => {
    const start = plan({
      projects: [project({ milestones: [milestone()] })],
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
    await chooseFrom(await rowMenu("Fictional Customer"), "Approve draft");
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

describe("the Features page", () => {
  const streamId = "00000000-0000-4000-8000-0000000000aa";
  const teamId = "00000000-0000-4000-8000-0000000000ab";
  const cycleOne = "2027-01-01";
  const cycleTwo = "2027-04-01";
  const cycle = (startsOn: string, endsOn: string, name: string) => ({
    startsOn,
    endsOn,
    name,
    months: [],
  });
  const streams = () =>
    Response.json({
      streams: [
        {
          id: streamId,
          name: "Fictional Stream",
          position: 1,
          retired: false,
          cyclesUntil: "2027-12-31",
          patterns: [],
          cycles: [
            cycle(cycleOne, "2027-03-31", "27.1"),
            cycle(cycleTwo, "2027-06-30", "27.2"),
          ],
          releases: [],
        },
      ],
      canEditStreams: true,
      canEditReleases: true,
    });
  const choices = () =>
    Response.json({
      owners: [],
      statuses: [],
      featureTeams: [{ id: teamId, name: "Fictional Team", retired: false }],
    });
  const feature = (name: string, targetCycle: string | null) => ({
    id: crypto.randomUUID(),
    name,
    status: "possible" as const,
    targetStreamId: targetCycle === null ? null : streamId,
    targetCycle,
    estimateHours: 40,
    featureTeamId: null,
    description: null,
  });
  const later = feature("Fictional Later", null);
  const second = feature("Fictional Second", cycleTwo);
  const first = feature("Fictional First", cycleOne);
  const featurePlan = (more: Partial<Plan> = {}) =>
    plan({
      features: [later, second, first],
      canEdit: false,
      canEditFeatures: true,
      ...more,
    });
  const answers = {
    "GET /api/release-streams": streams,
    "GET /api/projects/choices": choices,
  };
  const featureEditor = ["plan:view", "features:edit"];
  const open = (
    start = featurePlan(),
    more: typeof answers | object = {},
    path = "/features",
  ) => openPage(path, start, { ...answers, ...more }, featureEditor);
  const groupHeading = /^(Fictional Stream: 27\.[12]|Later)\d+ features?$/;
  const headings = () =>
    screen
      .queryAllByRole("rowheader")
      .map((cell) => cell.textContent)
      .filter((text) => groupHeading.test(text));
  const groupButton = () =>
    screen.getByRole("button", { name: "Group by cycle" });
  const rowNames = () =>
    screen
      .getAllByRole("row")
      .map(
        ({ textContent }) =>
          /Fictional (Later|Second|First)/.exec(textContent)?.[0],
      )
      .filter((name) => name !== undefined);

  it("titles the page Features, with no tabs", async () => {
    await open();
    expect(screen.getByRole("heading", { name: "Features" })).not.toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("groups features by cycle, in the cycles' order, with Later last", async () => {
    await open();
    expect(headings()).toEqual([
      "Fictional Stream: 27.11 feature",
      "Fictional Stream: 27.21 feature",
      "Later1 feature",
    ]);
    expect(rowNames()).toEqual([
      "Fictional First",
      "Fictional Second",
      "Fictional Later",
    ]);
  });

  it("counts each group's rows that show, under a search", async () => {
    await open(
      featurePlan({
        features: [
          feature("Fictional First", cycleOne),
          feature("Fictional First Again", cycleOne),
          later,
        ],
      }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search features" }),
      "Again",
    );
    await waitFor(() => {
      expect(headings()).toEqual(["Fictional Stream: 27.11 feature"]);
    });
  });

  it("sorts within each group, keeping the groups in order", async () => {
    await open(
      featurePlan({
        features: [
          later,
          feature("Fictional Zebra", cycleOne),
          feature("Fictional Aardvark", cycleOne),
        ],
      }),
      {},
      "/features?sort=%5B%22name%22%5D",
    );
    expect(
      screen
        .getAllByRole("row")
        .map(
          ({ textContent }) =>
            /Fictional (Zebra|Aardvark|Later)/.exec(textContent)?.[0],
        )
        .filter((name) => name !== undefined),
    ).toEqual(["Fictional Aardvark", "Fictional Zebra", "Fictional Later"]);
  });

  it("moves down past a heading to the next group's first row", async () => {
    await open();
    await userEvent.click(
      document.getElementById(`cell-${first.id}-name`) as HTMLElement,
    );
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.id).toBe(`cell-${second.id}-name`);
  });

  it("shows one list once grouping is turned off, kept in the address", async () => {
    const { history } = await open();
    await userEvent.click(groupButton());
    await waitFor(() => {
      expect(headings()).toEqual([]);
    });
    expect(history.location.search).toContain("ungrouped");
  });

  it("groups them again when turned back on", async () => {
    await open();
    await userEvent.click(groupButton());
    await waitFor(() => {
      expect(headings()).toEqual([]);
    });
    await userEvent.click(groupButton());
    await waitFor(() => {
      expect(headings()).toHaveLength(3);
    });
  });

  it("shows those who only see the plan the table with no way to add", async () => {
    await openPage(
      "/features",
      featurePlan({ canEditFeatures: false }),
      answers,
      ["plan:view"],
    );
    expect(screen.queryByRole("button", { name: "New feature" })).toBeNull();
  });

  it("offers one who edits features but not the plan the New button", async () => {
    await open();
    expect(await newButton("feature")).not.toBeNull();
  });

  it("sends a change of status with the feature's other values", async () => {
    const path = `PUT /api/features/${later.id}`;
    const { fetch } = await open(featurePlan(), {
      [path]: saved(featurePlan),
    });
    const operations = operationsOf("feature");
    await operations.change(later, { status: "planned" });
    expect(sent(fetch, path)).toEqual([
      {
        name: "Fictional Later",
        status: "planned",
        estimateHours: 40,
        featureTeamId: null,
        description: null,
        target: null,
      },
    ]);
  });

  it("sends a target as a stream and a cycle together", async () => {
    const path = `PUT /api/features/${later.id}`;
    const { fetch } = await open(featurePlan(), {
      [path]: saved(featurePlan),
    });
    await operationsOf("feature").change(later, {
      targetStreamId: streamId,
      targetCycle: cycleOne,
    });
    expect(sent(fetch, path)).toMatchObject([
      { target: { streamId, cycle: cycleOne } },
    ]);
  });

  it("adds a feature with what is entered and the rest empty", async () => {
    const { fetch } = await open(featurePlan(), {
      "POST /api/features": saved(featurePlan),
    });
    await operationsOf("feature").add({ name: "Fictional New" });
    expect(sent(fetch, "POST /api/features")).toEqual([
      {
        name: "Fictional New",
        status: "possible",
        estimateHours: null,
        featureTeamId: null,
        description: null,
        target: null,
      },
    ]);
  });

  it("removes a feature from its row's menu", async () => {
    const path = `DELETE /api/features/${later.id}`;
    const { fetch } = await open(featurePlan(), { [path]: deleted });
    await chooseFrom(await rowMenu("Fictional Later"), "Remove feature");
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(path);
    });
  });

  it("keeps a row under its heading until the view changes", async () => {
    const path = `DELETE /api/features/${later.id}`;
    const { held } = await open(featurePlan(), { [path]: deleted });
    held.plan = featurePlan({
      features: [
        later,
        { ...second, targetCycle: cycleOne },
        first,
        feature("Fictional Arrived", cycleOne),
      ],
    });
    await chooseFrom(await rowMenu("Fictional Later"), "Remove feature");
    await waitFor(() => {
      expect(rowNames()).toEqual([
        "Fictional First",
        "Fictional Second",
        "Fictional Later",
      ]);
    });
    // The row that arrived since stays at the end, under a heading of its own.
    await waitFor(() => {
      expect(headings()).toEqual([
        "Fictional Stream: 27.11 feature",
        "Fictional Stream: 27.21 feature",
        "Later1 feature",
        "Fictional Stream: 27.11 feature",
      ]);
    });
  });

  it("says when the release streams could not be loaded", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({ ...fictionalUser, permissions: featureEditor }),
      "GET /api/projects": () => Response.json(featurePlan()),
      "GET /api/projects/choices": choices,
      "GET /api/release-streams": () => new Response(null, { status: 500 }),
    });
    renderApp("/features");
    expect(
      await screen.findByText(/could not load the features/i),
    ).not.toBeNull();
  });

  it("tries the release streams again when asked", async () => {
    let healthy = false;
    serverAnswers({
      "GET /api/session": () =>
        Response.json({ ...fictionalUser, permissions: featureEditor }),
      "GET /api/projects": () => Response.json(featurePlan()),
      "GET /api/projects/choices": choices,
      "GET /api/release-streams": () =>
        healthy ? streams() : new Response(null, { status: 500 }),
    });
    renderApp("/features");
    const again = await screen.findByRole("button", { name: "Try again" });
    healthy = true;
    await userEvent.click(again);
    expect(await screen.findByRole("grid")).not.toBeNull();
  });
});
