// SPDX-License-Identifier: Apache-2.0

// Tests for the Projects page against a simulated server: its tabs and tables, adding a record in
// the side panel, what the side panel shows and links to, a project's milestones, and each change
// to a record's draft, from its row's menu and a milestone's menu.

import type { ProjectPlan } from "@fathom/shared";
import { projectLengths, startingEffortConversions } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  fictionalUser,
  noFeatureColumns,
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
  featureIds: [],
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
  featureIds: [],
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
  featureColumns: noFeatureColumns,
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
        featureStatuses: [],
        featureTeams: [],
      }),
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("grid");
  return { fetch, history, held };
}

// The bodies sent with a request named as its method and address, such as "POST /api/customers".
const sent = (fetch: ReturnType<typeof serverAnswers>, key: string) => {
  const [method = "", url = ""] = key.split(" ");
  return bodyOf(fetch, method, url);
};

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
        Response.json({
          owners: [],
          statuses: [],
          featureStatuses: [],
          featureTeams: [],
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
      expect(dialog.getByText("Invalid YYYY-MM-DD date")).toBeTruthy();
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
  const possibleId = crypto.randomUUID();
  const plannedId = crypto.randomUUID();
  const choices = () =>
    Response.json({
      owners: [],
      statuses: [],
      featureStatuses: [
        {
          id: possibleId,
          name: "Possible",
          retired: false,
          meaning: "possible",
        },
        {
          id: plannedId,
          name: "Planned",
          retired: false,
          meaning: "planned",
        },
      ],
      featureTeams: [{ id: teamId, name: "Fictional Team", retired: false }],
    });
  const feature = (name: string, targetCycle: string | null) => ({
    id: crypto.randomUUID(),
    name,
    statusId: possibleId,
    neededBy: null,
    customerIds: [],
    targetStreamId: targetCycle === null ? null : streamId,
    targetCycle,
    estimateHours: 40,
    featureTeamId: null,
    description: null,
    note: null,
    values: {},
    links: {},
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
    "GET /api/effort-conversions": () =>
      Response.json(startingEffortConversions),
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
  const groupButton = (shown: string) =>
    screen.getByRole("button", { name: `Group by: ${shown}` });
  const groupBy = async (shown: string, next: string) => {
    await userEvent.click(groupButton(shown));
    await userEvent.click(await screen.findByRole("menuitem", { name: next }));
  };
  const rowNames = () =>
    screen
      .getAllByRole("row")
      .map(
        ({ textContent }) =>
          /Fictional (Later|Second|First)/.exec(textContent)?.[0],
      )
      .filter((name) => name !== undefined);

  it("lists a project's features in its panel, each a link to its details on Features", async () => {
    // Given a project needing two features, open beside Projects
    const { history } = await open(
      featurePlan({
        projects: [project({ featureIds: [first.id, second.id] })],
      }),
      {},
      `/projects?open=${projectId}`,
    );
    const link = await within(sidePanel()).findByRole("button", {
      name: "Fictional First",
    });
    expect(link.parentElement?.textContent).toBe("Fictional First");
    // When the first is chosen
    await userEvent.click(link);
    // Then Features opens with its details beside the table
    await waitFor(() => {
      expect(history.location.pathname).toBe("/features");
    });
    expect(history.location.search).toContain(first.id);
    await screen.findByRole("heading", { name: "Fictional First" });
  });

  it("opens a feature's details beside the table from its Name cell", async () => {
    const { history } = await open();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Fictional First",
        hidden: true,
      }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain(`open=${first.id}`);
    });
    expect(
      await screen.findByRole("button", { name: "Close details" }),
    ).not.toBeNull();
  });

  describe("effort", () => {
    const effortMenu = async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: /^Effort/ }),
      );
    };
    const choose = async (name: string) => {
      await effortMenu();
      await userEvent.click(
        await screen.findByRole("menuitem", {
          name: (shown) => shown.startsWith(name),
        }),
      );
    };
    it("shows a feature's estimate in person-months to no decimal places, rounded up", async () => {
      // Given a feature estimated at 100 hours, which rounds up to 13 person-days, 0.65 person-months
      const { history } = await open(
        featurePlan({ features: [{ ...first, estimateHours: 100 }] }),
      );
      expect(await screen.findByText("100 h")).not.toBeNull();

      // When it is shown in person-months, then to no decimal places
      await choose("Person-months");
      expect(await screen.findByText("0.65 PM")).not.toBeNull();
      await choose("0");

      // Then it reads one person-month, kept in the address
      expect(await screen.findByText("1 PM")).not.toBeNull();
      expect(decodeURIComponent(history.location.search)).toContain(
        '"estimateHours":0',
      );
    });

    // The Features page's address, showing Effort in a unit.
    const inUnit = (unit: string) =>
      `/features?units=${encodeURIComponent(
        JSON.stringify({ estimateHours: unit }),
      )}`;
    const withEstimate = (hours: number) =>
      featurePlan({ features: [{ ...first, estimateHours: hours }] });
    const featurePath = `PUT /api/features/${first.id}`;
    const effortCell = () =>
      document.getElementById(`cell-${first.id}-estimateHours`) as HTMLElement;

    it("leaves the address once Effort is back in hours to two decimal places", async () => {
      const { history } = await open(
        withEstimate(100),
        {},
        inUnit("person-months"),
      );
      expect(await screen.findByText("0.65 PM")).not.toBeNull();
      await choose("1");
      await choose("2");
      await choose("Hours");
      expect(await screen.findByText("100 h")).not.toBeNull();
      expect(history.location.search).not.toContain("units");
      expect(history.location.search).not.toContain("places");
    });

    it("tells the hours behind an amount, and when it was rounded up", async () => {
      await open(withEstimate(1), {}, inUnit("person-days"));
      await userEvent.hover(await screen.findByText("0.5 PD"));
      expect(await screen.findByText("1 hour, rounded up")).not.toBeNull();
    });

    it("tells the hours behind an amount that needed no rounding", async () => {
      await open(withEstimate(20), {}, inUnit("person-days"));
      await userEvent.hover(await screen.findByText("2.5 PD"));
      expect(await screen.findByText("20 hours")).not.toBeNull();
    });

    it("edits a cell from the amount shown, keeping the estimate when it is left unchanged", async () => {
      // Given 32 hours, 4 person-days, shown in person-quarters as 0.07
      const { fetch } = await open(
        withEstimate(32),
        { [featurePath]: saved(() => withEstimate(32)) },
        inUnit("person-quarters"),
      );
      expect(await screen.findByText("0.07 PQ")).not.toBeNull();

      // When the cell is edited and left as it opened
      await userEvent.dblClick(effortCell());
      const field = screen.getByRole("textbox", {
        name: "Effort in person-quarters",
      });
      expect((field as HTMLInputElement).value).toBe("0.07");
      expect(screen.getByText("PQ")).not.toBeNull();
      await userEvent.keyboard("{Enter}");

      // Then nothing is saved; and typing a new amount saves it in hours, rounded up
      expect(sent(fetch, featurePath)).toEqual([]);
      await userEvent.dblClick(effortCell());
      await userEvent.keyboard("{Control>}a{/Control}0.1{Enter}");
      await waitFor(() => {
        expect(sent(fetch, featurePath)).toMatchObject([{ estimateHours: 48 }]);
      });
    });

    it.each([
      ["-1", "Effort: use 0 or more"],
      ["200000", "Effort: use 124,999.5 or less"],
    ])("refuses %s person-days", async (typed, message) => {
      await open(withEstimate(20), {}, inUnit("person-days"));
      await userEvent.dblClick(await screen.findByText("2.5 PD"));
      await userEvent.keyboard(`{Control>}a{/Control}${typed}{Enter}`);
      expect(await screen.findByText(message)).not.toBeNull();
    });

    it("gives the estimate in the details in the table's unit, then in hours", async () => {
      await open(
        withEstimate(20),
        {},
        `${inUnit("person-days")}&open=${first.id}`,
      );
      expect(
        await screen.findByText("2.5 person-days (20 hours)"),
      ).not.toBeNull();
    });

    it("gives only the hours in the details when the table shows hours", async () => {
      await open(withEstimate(20), {}, `/features?open=${first.id}`);
      // The table's cell says the same to assistive technology, so the details' value is the one
      // in a description list.
      const shown = await screen.findAllByText("20 hours");
      expect(shown.filter((text) => text.closest("dd") !== null)).toHaveLength(
        1,
      );
    });

    it("gives only the hours in the details of an estimate of none, whatever the table's unit", async () => {
      await open(
        withEstimate(0),
        {},
        `${inUnit("person-days")}&open=${first.id}`,
      );
      const shown = await screen.findAllByText("0 hours");
      expect(shown.filter((text) => text.closest("dd") !== null)).toHaveLength(
        1,
      );
    });

    it("edits the estimate in the details in a unit chosen there, saving hours", async () => {
      // Given the details of 20 hours, with the table in person-days
      const { fetch } = await open(
        withEstimate(20),
        { [featurePath]: saved(() => withEstimate(20)) },
        `${inUnit("person-days")}&open=${first.id}`,
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "Change Effort" }),
      );
      const field = screen.getByRole("textbox", {
        name: "Effort in person-days",
      });
      expect((field as HTMLInputElement).value).toBe("2.5");

      // When hours are chosen beside it, the editor stays open, and 28 is typed
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Effort unit" }),
        "hours",
      );
      const inHours = screen.getByRole("textbox", { name: "Effort in hours" });
      await userEvent.clear(inHours);
      await userEvent.type(inHours, "28");
      await userEvent.click(screen.getByRole("heading", { name: "Features" }));

      // Then 28 hours are saved, once the field and its menu are left
      await waitFor(() => {
        expect(sent(fetch, featurePath)).toMatchObject([{ estimateHours: 28 }]);
      });
    });

    // The address showing Effort in person-months to no decimal places.
    const inMonthsWhole = `${inUnit("person-months")}&places=${encodeURIComponent(
      JSON.stringify({ estimateHours: 0 }),
    )}`;

    it("reads a cell's amount, its unit, and its hours to assistive technology", async () => {
      await open(withEstimate(100), {}, inMonthsWhole);
      expect(
        await screen.findByText("1 person-month, 100 hours, rounded up"),
      ).not.toBeNull();
    });

    it("names one of a unit in the details as the amount is shown, rounded up", async () => {
      // Given 152 hours, 19 person-days, which reads 1 person-month to no decimal places
      await open(withEstimate(152), {}, `${inMonthsWhole}&open=${first.id}`);
      expect(
        await screen.findByText("1 person-month (152 hours)"),
      ).not.toBeNull();
    });

    it("resets the units from the Views menu", async () => {
      await open(withEstimate(100), {}, inUnit("person-months"));
      expect(await screen.findByText("0.65 PM")).not.toBeNull();
      await userEvent.click(screen.getByRole("button", { name: /^Views/ }));
      await userEvent.click(
        await screen.findByRole("menuitem", {
          name: /^Units: Effort in person-months/,
        }),
      );
      expect(await screen.findByText("100 h")).not.toBeNull();
    });

    it("tells the hours of the cell with keyboard focus", async () => {
      await open(withEstimate(20), {}, inUnit("person-days"));
      await userEvent.click(
        document.getElementById(`cell-${first.id}-targetCycle`) as HTMLElement,
      );
      await userEvent.keyboard("{ArrowRight}");
      expect((await screen.findByRole("tooltip")).textContent).toBe("20 hours");
    });

    it("gives none in the details for a feature with no estimate", async () => {
      await open(
        featurePlan({ features: [{ ...first, estimateHours: null }] }),
        {},
        `${inUnit("person-days")}&open=${first.id}`,
      );
      const effort = await screen.findByText("Effort", { selector: "dt" });
      expect(effort.nextElementSibling?.textContent).toContain("None");
    });

    const editInDetails = async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: "Change Effort" }),
      );
    };

    it("cancels editing the estimate in the details with Esc in the menu of units", async () => {
      const { fetch } = await open(
        withEstimate(20),
        { [featurePath]: saved(() => withEstimate(20)) },
        `${inUnit("person-days")}&open=${first.id}`,
      );
      await editInDetails();
      // Past the field's × to the menu of units.
      await userEvent.tab();
      await userEvent.tab();
      expect(document.activeElement).toBe(
        screen.getByRole("combobox", { name: "Effort unit" }),
      );
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(
          screen.queryByRole("combobox", { name: "Effort unit" }),
        ).toBeNull();
      });
      expect(sent(fetch, featurePath)).toEqual([]);
    });

    it("shows the same estimate in another unit chosen before typing, saving nothing", async () => {
      const { fetch } = await open(
        withEstimate(20),
        { [featurePath]: saved(() => withEstimate(20)) },
        `${inUnit("person-days")}&open=${first.id}`,
      );
      await editInDetails();
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Effort unit" }),
        "hours",
      );
      expect(
        screen.getByRole<HTMLInputElement>("textbox", {
          name: "Effort in hours",
        }).value,
      ).toBe("20");
      await userEvent.click(screen.getByRole("heading", { name: "Features" }));
      await waitFor(() => {
        expect(
          screen.queryByRole("combobox", { name: "Effort unit" }),
        ).toBeNull();
      });
      expect(sent(fetch, featurePath)).toEqual([]);
    });

    it("enters a new feature's estimate in a unit chosen in its form, saving hours", async () => {
      const path = "POST /api/features";
      const { fetch } = await open(
        featurePlan(),
        { [path]: saved(featurePlan) },
        inUnit("person-weeks"),
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "New feature" }),
      );
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name" }),
        "Fictional Estimated",
      );
      await userEvent.type(
        screen.getByRole("textbox", { name: "Effort in person-weeks" }),
        "2",
      );
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Effort unit" }),
        "person-days",
      );
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() => {
        expect(sent(fetch, path)).toMatchObject([
          { name: "Fictional Estimated", estimateHours: 16 },
        ]);
      });
    });
  });

  it("marks a feature whose status means Planned and that has no feature team", async () => {
    await open(featurePlan({ features: [{ ...first, statusId: plannedId }] }));
    expect(await screen.findByText("No team")).not.toBeNull();
  });

  it("follows a customer from a feature's details to the Customers tab", async () => {
    const buyer = customer();
    const start = featurePlan({
      customers: [buyer],
      features: [{ ...first, customerIds: [buyer.id] }],
    });
    const { history } = await open(start, {}, `/features?open=${first.id}`);
    await userEvent.click(
      await screen.findByRole("button", { name: buyer.name }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/projects");
    });
    expect(history.location.search).toContain("tab=customers");
    expect(history.location.search).toContain(`open=${buyer.id}`);
  });

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
    await groupBy("Cycle", "None");
    await waitFor(() => {
      expect(headings()).toEqual([]);
    });
    expect(history.location.search).toContain("grouping=none");
  });

  it("groups features by the month they are needed by, with No date last, kept in the address", async () => {
    const start = featurePlan({
      features: [
        { ...later, neededBy: "2027-11" },
        { ...second, neededBy: "2027-03" },
        first,
      ],
    });
    const { history } = await open(start);
    await groupBy("Cycle", "Needed by");
    await waitFor(() => {
      expect(
        screen
          .queryAllByRole("rowheader")
          .map((cell) => /^[A-Za-z ]*\d*/.exec(cell.textContent)?.[0])
          .filter((text) => /Mar|Nov|No date/.test(String(text))),
      ).toHaveLength(3);
    });
    const shownHeadings = screen
      .queryAllByRole("rowheader")
      .map((cell) => cell.textContent)
      .filter((text) => /Mar|Nov|No date/.test(text));
    expect(shownHeadings.at(0)).toContain("Mar");
    expect(shownHeadings.at(1)).toContain("Nov");
    expect(shownHeadings.at(2)).toContain("No date");
    expect(history.location.search).toContain("grouping=neededBy");
    expect(groupButton("Needed by")).not.toBeNull();
  });

  it("groups them again when turned back on", async () => {
    await open();
    await groupBy("Cycle", "None");
    await waitFor(() => {
      expect(headings()).toEqual([]);
    });
    await groupBy("None", "Cycle");
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

  describe("added columns", () => {
    const sizes = {
      id: "10000000-0000-4000-8000-0000000000a1",
      name: "Fictional Sizes",
      description: "",
      visibility: "general",
      retired: false,
      choices: [
        {
          id: "10000000-0000-4000-8000-0000000000b1",
          label: "Small",
          description: "",
          retired: false,
        },
      ],
    };
    const hidden = {
      ...sizes,
      id: "10000000-0000-4000-8000-0000000000a2",
      name: "Fictional Hidden",
      visibility: "restricted",
    };
    const size = {
      id: "10000000-0000-4000-8000-0000000000c1",
      name: "Fictional Size",
      type: "choice" as const,
      listId: sizes.id,
      visibility: null,
      multiple: false,
      required: false,
      onPlannedHires: false,
    };
    const columnsOf = (fields: Plan["featureColumns"]["fields"] = [size]) =>
      ({
        fields,
        order: ["name", ...fields.map(({ id }) => id)],
        lists: [sizes],
      }) as Plan["featureColumns"];
    const withColumns = (more: Partial<Plan> = {}) =>
      featurePlan({ featureColumns: columnsOf(), ...more });
    const columnEditor = [
      "plan:view",
      "features:edit",
      "configuration:view",
      "configuration:edit",
    ];
    const lists = () => Response.json({ lists: [sizes, hidden] });
    const openWith = (
      start: Plan,
      more: object = {},
      permissions = columnEditor,
    ) =>
      openPage(
        "/features",
        start,
        { ...answers, "GET /api/lists": lists, ...more },
        permissions,
      );
    const newColumn = async () => {
      await waitFor(() => {
        expect(
          screen.getByRole<HTMLButtonElement>("button", { name: "New column" })
            .disabled,
        ).toBe(false);
      });
      await userEvent.click(screen.getByRole("button", { name: "New column" }));
      return screen.findByRole("dialog", { name: "New column" });
    };
    const editColumn = async () => {
      await userEvent.click(
        screen.getByRole("button", { name: "Fictional Size column" }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Edit column" }),
      );
      return screen.findByRole("dialog", { name: "Edit column" });
    };

    it("shows a value in its column", async () => {
      await openWith(
        withColumns({
          features: [
            { ...later, values: { [size.id]: [String(sizes.choices[0]?.id)] } },
          ],
        }),
        {},
        featureEditor,
      );
      expect(screen.getByRole("grid").textContent).toContain("Small");
    });

    it("offers no new column to those who may not change columns", async () => {
      await openWith(withColumns(), {}, featureEditor);
      expect(screen.queryByRole("button", { name: "New column" })).toBeNull();
    });

    it("adds a column to Features, offering only General lists and no planned hires", async () => {
      const path = "POST /api/features/columns";
      const added = { ...size, id: "new", name: "Fictional New" };
      const { fetch, held } = await openWith(withColumns(), {
        [path]: () => {
          held.plan = withColumns({ featureColumns: columnsOf([size, added]) });
          return Response.json({ field: added, changeSetId }, { status: 201 });
        },
      });
      const dialog = await newColumn();
      expect(
        within(dialog).queryByLabelText("Offered on planned hires"),
      ).toBeNull();
      const options = within(
        within(dialog).getByLabelText("List"),
      ).getAllByRole("option");
      expect(options.map(({ textContent }) => textContent)).toEqual([
        "",
        "Fictional Sizes",
      ]);
      await userEvent.type(
        within(dialog).getByLabelText("Name"),
        "Fictional New",
      );
      await userEvent.selectOptions(
        within(dialog).getByLabelText("List"),
        sizes.id,
      );
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Add column" }),
      );
      await waitFor(() => {
        expect(sent(fetch, path)).toEqual([
          {
            name: "Fictional New",
            type: "choice",
            listId: sizes.id,
            multiple: false,
            required: false,
            onPlannedHires: false,
          },
        ]);
      });
      expect(
        await screen.findByRole("button", { name: "Fictional New column" }),
      ).toBeDefined();
    });

    it("asks no visibility for a column that holds its own values", async () => {
      await openWith(withColumns());
      const dialog = await newColumn();
      await userEvent.selectOptions(
        within(dialog).getByLabelText("Type"),
        "number",
      );
      expect(within(dialog).queryByLabelText("List")).toBeNull();
      expect(within(dialog).queryByRole("radiogroup")).toBeNull();
      expect(within(dialog).queryByLabelText(/visible|see/i)).toBeNull();
    });

    it("offers no moving of a column", async () => {
      await openWith(withColumns());
      await userEvent.click(
        screen.getByRole("button", { name: "Fictional Size column" }),
      );
      await screen.findByRole("menuitem", { name: "Edit column" });
      expect(screen.queryByRole("menuitem", { name: /Move/ })).toBeNull();
    });

    it("deletes a column for those who may change features", async () => {
      const path = `DELETE /api/features/columns/${size.id}`;
      const { fetch, held } = await openWith(withColumns(), {
        [path]: () => {
          held.plan = withColumns({ featureColumns: columnsOf([]) });
          return deleted();
        },
      });
      const dialog = await editColumn();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Delete column" }),
      );
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "Fictional Size column" }),
        ).toBeNull();
      });
      expect(sentTo(fetch)).toContain(path);
    });

    it("offers no deleting to those who may not change features", async () => {
      await openWith(withColumns({ canEditFeatures: false }));
      const dialog = await editColumn();
      expect(
        within(dialog).queryByRole("button", { name: "Delete column" }),
      ).toBeNull();
    });

    it("discards a column's draft through Features' columns", async () => {
      const path = `DELETE /api/features/columns/${size.id}/draft`;
      const drafted = {
        ...size,
        draft: recordDraft({
          action: "changed",
          changed: ["name"],
          live: { name: "Before" },
        }),
      };
      const { fetch } = await openWith(
        withColumns({ featureColumns: columnsOf([drafted]) }),
        { [path]: deleted },
      );
      await userEvent.click(
        screen.getByRole("button", { name: /^Fictional Size column/ }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: /Discard/ }),
      );
      await waitFor(() => {
        expect(sentTo(fetch)).toContain(path);
      });
    });

    it("shows a new feature with an empty optional number while it saves", async () => {
      const score = {
        ...size,
        id: "10000000-0000-4000-8000-0000000000c3",
        name: "Fictional Points",
        type: "number" as const,
        listId: null,
        visibility: "general" as const,
      };
      const start = withColumns({
        features: [],
        featureColumns: columnsOf([score]),
      });
      const path = "POST /api/features";
      let answer: (response: Response) => void = () => undefined;
      await openWith(
        start,
        {
          [path]: () =>
            new Promise<Response>((resolve) => {
              answer = resolve;
            }),
        },
        featureEditor,
      );
      await userEvent.click(await newButton("feature"));
      await userEvent.type(
        await screen.findByRole("textbox", { name: /^Name/ }),
        "Fictional Pending",
      );
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      expect(await screen.findByText("Fictional Pending")).toBeDefined();
      expect(screen.getByRole("grid").textContent).not.toContain("null");
      answer(Response.json({ plan: start, changeSetId }));
    });

    it("says so when the lists to offer could not be loaded, and tries again", async () => {
      let available = false;
      await openPage(
        "/features",
        withColumns(),
        {
          ...answers,
          "GET /api/lists": () =>
            available ? lists() : new Response(null, { status: 500 }),
        },
        columnEditor,
      ).catch(() => undefined);
      const again = await screen.findByRole("button", { name: /Try again/ });
      available = true;
      await userEvent.click(again);
      expect(await screen.findByRole("grid")).toBeDefined();
    });

    it("saves a value typed in an added column's cell", async () => {
      const score = {
        ...size,
        id: "10000000-0000-4000-8000-0000000000c2",
        name: "Fictional Score",
        type: "number" as const,
        listId: null,
        visibility: "general" as const,
      };
      const start = withColumns({
        features: [later],
        featureColumns: columnsOf([score]),
      });
      const path = `PUT /api/features/${later.id}`;
      const { fetch } = await openWith(
        start,
        { [path]: saved(() => start) },
        featureEditor,
      );
      await userEvent.dblClick(
        document.getElementById(`cell-${later.id}-${score.id}`) as HTMLElement,
      );
      await userEvent.keyboard("7{Enter}");
      await waitFor(() => {
        expect(sent(fetch, path)).toMatchObject([
          { numbers: { [score.id]: 7 } },
        ]);
      });
    });

    it("sends only the added column's value a change gives", async () => {
      const path = `PUT /api/features/${later.id}`;
      const { fetch } = await open(withColumns(), {
        [path]: saved(withColumns),
      });
      await operationsOf("feature").change(
        { ...later, values: { other: ["kept"] } },
        { values: { [size.id]: ["picked"] } },
      );
      expect(sent(fetch, path)).toMatchObject([
        { values: { [size.id]: ["picked"] }, links: {} },
      ]);
    });

    it("offers an added column in the new feature's form", async () => {
      await openWith(withColumns(), {}, featureEditor);
      await userEvent.click(await newButton("feature"));
      await screen.findByRole("heading", { name: "New feature" });
      const columns = within(sidePanel()).getByRole("region", {
        name: "Columns",
      });
      expect(within(columns).getByText("Fictional Size")).toBeTruthy();
    });

    const requiredNote = {
      ...size,
      id: "10000000-0000-4000-8000-0000000000c4",
      name: "Fictional Why",
      type: "note" as const,
      listId: null,
      visibility: "general" as const,
      required: true,
    };
    const startWriting = async () => {
      await userEvent.click(await newButton("feature"));
      await userEvent.click(
        await screen.findByRole("button", { name: "Change Fictional Why" }),
      );
      const opened = await screen.findByRole("region", {
        name: "Fictional Why for New feature",
      });
      await userEvent.click(within(opened).getByText("Markdown"));
      await userEvent.type(
        within(opened).getByRole("textbox", { name: "Markdown" }),
        "Because",
      );
      return opened;
    };

    it("writes a new feature's note in the note's own panel, and sends it", async () => {
      const start = withColumns({ featureColumns: columnsOf([requiredNote]) });
      const path = "POST /api/features";
      const { fetch } = await openWith(
        start,
        { [path]: saved(() => start) },
        featureEditor,
      );
      const opened = await startWriting();
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name" }),
        "Fictional Noted",
      );
      await userEvent.click(
        within(opened).getByRole("button", { name: "Save" }),
      );
      await waitFor(() => {
        expect(
          screen.queryByRole("region", {
            name: "Fictional Why for New feature",
          }),
        ).toBeNull();
      });
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() => {
        expect(sent(fetch, path)).toMatchObject([
          { name: "Fictional Noted", notes: { [requiredNote.id]: "Because" } },
        ]);
      });
    });

    it("names a required note left empty under its row", async () => {
      await openWith(
        withColumns({ featureColumns: columnsOf([requiredNote]) }),
        {},
        featureEditor,
      );
      await userEvent.click(await newButton("feature"));
      await userEvent.type(
        await screen.findByRole("textbox", { name: "Name" }),
        "Fictional Noted",
      );
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      expect(
        await within(sidePanel()).findByText("Fictional Why needed"),
      ).toBeTruthy();
      const change = screen.getByRole("button", {
        name: "Change Fictional Why",
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(change);
      });
    });

    it("asks before Add discards a note being written", async () => {
      const start = withColumns({ featureColumns: columnsOf([requiredNote]) });
      const path = "POST /api/features";
      const { fetch } = await openWith(
        start,
        { [path]: saved(() => start) },
        featureEditor,
      );
      const opened = await startWriting();
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name" }),
        "Fictional Noted",
      );
      await userEvent.click(
        within(opened).getByRole("button", { name: "Save" }),
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "Change Fictional Why" }),
      );
      const again = await screen.findByRole("region", {
        name: "Fictional Why for New feature",
      });
      await userEvent.click(within(again).getByText("Markdown"));
      await userEvent.type(
        within(again).getByRole("textbox", { name: "Markdown" }),
        " more",
      );
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      await screen.findByText("Discard the note you're writing?");
      expect(sent(fetch, path)).toEqual([]);
      await userEvent.click(screen.getByRole("button", { name: "Discard" }));
      await waitFor(() => {
        expect(sent(fetch, path)).toMatchObject([
          { notes: { [requiredNote.id]: "Because" } },
        ]);
      });
    });

    it("keeps writing when Add's question says so, adding nothing", async () => {
      const start = withColumns({ featureColumns: columnsOf([requiredNote]) });
      const path = "POST /api/features";
      const { fetch } = await openWith(
        start,
        { [path]: saved(() => start) },
        featureEditor,
      );
      const opened = await startWriting();
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name" }),
        "Fictional Noted",
      );
      await userEvent.click(
        within(opened).getByRole("button", { name: "Save" }),
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "Change Fictional Why" }),
      );
      const again = await screen.findByRole("region", {
        name: "Fictional Why for New feature",
      });
      await userEvent.click(within(again).getByText("Markdown"));
      await userEvent.type(
        within(again).getByRole("textbox", { name: "Markdown" }),
        " more",
      );
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      await screen.findByText("Discard the note you're writing?");
      await userEvent.click(
        screen.getByRole("button", { name: "Keep writing" }),
      );
      expect(sent(fetch, path)).toEqual([]);
      expect(
        screen.getByRole("region", { name: "Fictional Why for New feature" }),
      ).toBeTruthy();
    });

    it("asks before Cancel discards a note being written", async () => {
      await openWith(
        withColumns({ featureColumns: columnsOf([requiredNote]) }),
        {},
        featureEditor,
      );
      await startWriting();
      await userEvent.click(
        within(screen.getByRole("region", { name: "New feature" })).getByRole(
          "button",
          { name: "Cancel" },
        ),
      );
      await screen.findByText("Discard the note you're writing?");
      await userEvent.click(screen.getByRole("button", { name: "Discard" }));
      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: "New feature" }),
        ).toBeNull();
      });
    });
  });

  it("sends a change of status with the feature's other values", async () => {
    const path = `PUT /api/features/${later.id}`;
    const { fetch } = await open(featurePlan(), {
      [path]: saved(featurePlan),
    });
    const operations = operationsOf("feature");
    await operations.change(later, { statusId: plannedId });
    expect(sent(fetch, path)).toEqual([
      {
        name: "Fictional Later",
        statusId: plannedId,
        neededBy: null,
        customerIds: [],
        estimateHours: 40,
        featureTeamId: null,
        description: null,
        note: null,
        values: {},
        links: {},
        notes: {},
        numbers: {},
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
        neededBy: null,
        customerIds: [],
        estimateHours: null,
        featureTeamId: null,
        description: null,
        note: null,
        values: {},
        links: {},
        notes: {},
        numbers: {},
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
      "GET /api/effort-conversions": answers["GET /api/effort-conversions"],
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
      "GET /api/effort-conversions": answers["GET /api/effort-conversions"],
    });
    renderApp("/features");
    const again = await screen.findByRole("button", { name: "Try again" });
    healthy = true;
    await userEvent.click(again);
    expect(await screen.findByRole("grid")).not.toBeNull();
  });

  it("tries the conversions between units of effort again when asked", async () => {
    let healthy = false;
    serverAnswers({
      "GET /api/session": () =>
        Response.json({ ...fictionalUser, permissions: featureEditor }),
      "GET /api/projects": () => Response.json(featurePlan()),
      "GET /api/projects/choices": choices,
      "GET /api/release-streams": streams,
      "GET /api/effort-conversions": () =>
        healthy
          ? Response.json(startingEffortConversions)
          : new Response(null, { status: 500 }),
    });
    renderApp("/features");
    const again = await screen.findByRole("button", { name: "Try again" });
    healthy = true;
    await userEvent.click(again);
    expect(await screen.findByRole("grid")).not.toBeNull();
  });
});
