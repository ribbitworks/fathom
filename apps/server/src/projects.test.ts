// SPDX-License-Identifier: Apache-2.0

// Tests for customers, projects with their milestones, and proposals, against a PostgreSQL server of
// their own: who may change them, what they keep and link to, and their drafts.

import {
  features,
  listItems,
  lists,
  milestones,
  people,
  projects,
} from "@fathom/db";
import { noteLength } from "@fathom/shared";
import type {
  ChangeHistory,
  Permission,
  PlanChoices,
  Project,
  ProjectPlan,
  Unpublished,
} from "@fathom/shared";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startTestApp,
  type TestApp,
  testPosition,
  missingRecord as missing,
  unique,
  errorOf,
} from "./test-app.ts";

let test: TestApp;
let planner: { id: string; cookie: string };
let approver: { id: string; cookie: string };
let viewer: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  planner = await test.signedIn("product-manager");
  approver = await test.signedIn("project-manager");
  viewer = await test.signedIn("team-member");
});

afterAll(async () => {
  await test.close();
});

type Saved = { plan: ProjectPlan; changeSetId: string | null };

async function readPlan(cookie = planner.cookie): Promise<ProjectPlan> {
  const response = await test.request(cookie, "GET", "/api/projects");
  expect(response.statusCode).toBe(200);
  return response.json<ProjectPlan>();
}

const send = (
  method: "POST" | "PUT" | "DELETE",
  url: string,
  body?: object,
  options?: { publish?: boolean },
) => test.request(planner.cookie, method, url, body, options);

async function added(path: string, body: object): Promise<ProjectPlan> {
  const response = await send("POST", `/api/${path}`, body);
  expect(response.statusCode).toBe(201);
  return response.json<Saved>().plan;
}

const byName = <Named extends { name: string }>(
  records: readonly Named[],
  name: string,
): Named => records.find((record) => record.name === name) as Named;

async function addCustomer(name = unique("Fictional Customer")) {
  return byName((await added("customers", { name })).customers, name);
}

async function addProject(body: object = {}) {
  const name = unique("Fictional Project");
  return byName((await added("projects", { name, ...body })).projects, name);
}

async function addProposal(body: object = {}) {
  const name = unique("Fictional Proposal");
  return byName((await added("proposals", { name, ...body })).proposals, name);
}

async function addFeature() {
  const name = unique("Fictional Feature");
  return byName((await added("features", { name })).features, name);
}

async function addMilestone(projectId: string, body: object) {
  const response = await send("POST", `/api/projects/${projectId}/milestones`, {
    name: unique("Fictional Milestone"),
    ...body,
  });
  expect(response.statusCode).toBe(201);
}

const approve = async (records: { type: string; id: string }[]) => {
  const response = await test.request(
    approver.cookie,
    "POST",
    "/api/drafts/approval",
    { records },
  );
  expect(response.statusCode).toBe(200);
};

const projectNamed = async (id: string): Promise<Project> =>
  (await readPlan()).projects.find((project) => project.id === id) as Project;

// The built-in proposal statuses, by label, in order.
async function statuses(): Promise<Map<string, string>> {
  const rows = await test.connection
    .select({ id: listItems.id, label: listItems.label })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "proposal-statuses"))
    .orderBy(asc(listItems.position));
  return new Map(rows.map(({ id, label }) => [label, id]));
}

async function addPerson(): Promise<string> {
  const id = randomUUID();
  await test.connection.insert(people).values({
    id,
    preferredName: unique("Fictional Owner"),
    employeeId: unique("OWN"),
    positionId: testPosition,
  });
  return id;
}

describe("reading", () => {
  it("shows the plan's records, and whether the reader may change them", async () => {
    const customer = await addCustomer();
    const plan = await readPlan(viewer.cookie);
    expect(plan.canEdit).toBe(false);
    expect(plan.customers.some(({ id }) => id === customer.id)).toBe(true);
    expect((await readPlan()).canEdit).toBe(true);
  });

  it("sends features only to those who see them, and the plan's other records only to those who see the plan", async () => {
    const project = await addProject();
    const customer = await addCustomer();
    const feature = await addFeature();
    const featuresOnly = await test.signedIn(["features:view"]);
    const planOnly = await test.signedIn(["plan:view"]);
    const ids = (records: readonly { id: string }[]) =>
      records.map(({ id }) => id);

    const features = await readPlan(featuresOnly.cookie);
    expect(ids(features.features)).toContain(feature.id);
    expect(features.featureColumns).toEqual((await readPlan()).featureColumns);
    expect(ids(features.projects)).not.toContain(project.id);
    expect(ids(features.customers)).not.toContain(customer.id);
    expect(features.proposals).toEqual([]);

    const plan = await readPlan(planOnly.cookie);
    expect(ids(plan.projects)).toContain(project.id);
    expect(ids(plan.customers)).toContain(customer.id);
    expect(ids(plan.features)).not.toContain(feature.id);
    expect(plan.featureColumns).toEqual({ fields: [], order: [], lists: [] });
  });

  it("lists live records by name, then those drafted to be added", async () => {
    const later = await addCustomer(unique("Fictional Zed"));
    const earlier = await addCustomer(unique("Fictional Abe"));
    await approve([
      { type: "customer", id: later.id },
      { type: "customer", id: earlier.id },
    ]);
    const drafted = await addCustomer(unique("Fictional Aaron"));
    const order = (await readPlan()).customers.map(({ id }) => id);
    expect(order.indexOf(earlier.id)).toBeLessThan(order.indexOf(later.id));
    expect(order.indexOf(later.id)).toBeLessThan(order.indexOf(drafted.id));
  });
});

describe("choices", () => {
  it("give those who see the plan owners by name alone, those who have left retired, proposal statuses, and features' priorities, sizes and risks", async () => {
    const current = await addPerson();
    const left = await addPerson();
    await test.connection
      .update(people)
      .set({ startDate: "2001-01-01", endDate: "2001-12-31" })
      .where(eq(people.id, left));
    const response = await test.request(
      viewer.cookie,
      "GET",
      "/api/projects/choices",
    );
    expect(response.statusCode).toBe(200);
    const choices = response.json<PlanChoices>();
    expect(Object.keys(choices).sort()).toEqual([
      "featureStatuses",
      "featureTeams",
      "owners",
      "priorities",
      "risks",
      "sizes",
      "statuses",
    ]);
    for (const choice of [
      ...choices.owners,
      ...choices.statuses,
      ...choices.priorities,
      ...choices.risks,
    ]) {
      expect(Object.keys(choice).sort()).toEqual(["id", "name", "retired"]);
    }
    for (const size of choices.sizes) {
      expect(Object.keys(size).sort()).toEqual([
        "id",
        "name",
        "retired",
        "weight",
      ]);
    }
    const [person] = await test.connection
      .select({ name: people.preferredName })
      .from(people)
      .where(eq(people.id, current));
    expect(choices.owners).toContainEqual({
      id: current,
      name: String(person?.name),
      retired: false,
    });
    expect(choices.owners.find(({ id }) => id === left)?.retired).toBe(true);
    expect(choices.statuses.map(({ name }) => name).slice(0, 4)).toEqual([
      "Open",
      "Won",
      "Lost",
      "Withdrawn",
    ]);
  });
});

describe("customers", () => {
  it("are drafted, changed, and approved", async () => {
    const customer = await addCustomer();
    expect(customer.draft?.action).toBe("created");
    const renamed = unique("Fictional Renamed Customer");
    const response = await send("PUT", `/api/customers/${customer.id}`, {
      name: renamed,
    });
    expect(response.statusCode).toBe(200);
    await approve([{ type: "customer", id: customer.id }]);
    const live = byName((await readPlan()).customers, renamed);
    expect(live.draft).toBeUndefined();
  });

  it("keep a description and a note as given", async () => {
    const name = unique("Fictional Described Customer");
    const { customers } = await added("customers", {
      name,
      description: "Island ferry line",
      note: "**Pilot** at the north quay first.",
    });

    const customer = byName(customers, name);
    expect([customer.description, customer.note]).toEqual([
      "Island ferry line",
      "**Pilot** at the north quay first.",
    ]);
  });

  it("keep a blank note as none", async () => {
    const customer = await addCustomer();

    await send("PUT", `/api/customers/${customer.id}`, {
      name: customer.name,
      note: " ",
    });

    expect(byName((await readPlan()).customers, customer.name).note).toBeNull();
  });

  it("refuses a customer's note a note may not hold", async () => {
    const response = await send("POST", "/api/customers", {
      name: unique("Fictional Customer"),
      note: "a".repeat(noteLength + 1),
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuses a name taken, ignoring letter case", async () => {
    const customer = await addCustomer();
    const response = await send("POST", "/api/customers", {
      name: customer.name.toUpperCase(),
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "There is already a customer with that name",
    );
  });

  it("refuses changing one that does not exist", async () => {
    const response = await send("PUT", `/api/customers/${missing}`, {
      name: unique("Fictional Nobody"),
    });
    expect(response.statusCode).toBe(404);
  });

  it("are removed as a draft that cannot be changed, only discarded", async () => {
    const customer = await addCustomer();
    await approve([{ type: "customer", id: customer.id }]);
    const removed = await send("DELETE", `/api/customers/${customer.id}`);
    expect(removed.statusCode).toBe(200);
    const changed = await send("PUT", `/api/customers/${customer.id}`, {
      name: unique("Fictional Changed"),
    });
    expect(changed.statusCode).toBe(409);
    const discarded = await send(
      "DELETE",
      `/api/records/customer/${customer.id}/draft`,
    );
    expect(discarded.statusCode).toBe(200);
    await send("DELETE", `/api/customers/${customer.id}`);
    await approve([{ type: "customer", id: customer.id }]);
    expect(
      (await readPlan()).customers.some(({ id }) => id === customer.id),
    ).toBe(false);
  });

  it("removing one only drafted to be added discards its draft", async () => {
    const customer = await addCustomer();
    const response = await send("DELETE", `/api/customers/${customer.id}`);
    expect(response.statusCode).toBe(200);
    expect(
      (await readPlan()).customers.some(({ id }) => id === customer.id),
    ).toBe(false);
  });

  it("cannot be removed while a project uses it", async () => {
    const customer = await addCustomer();
    await approve([{ type: "customer", id: customer.id }]);
    const project = await addProject({ customerIds: [customer.id] });
    const response = await send("DELETE", `/api/customers/${customer.id}`);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      `This is used by the project ${project.name}; change that first`,
    );
  });

  it("names no feature using it to a role that can't see features", async () => {
    const customer = await addCustomer();
    await approve([{ type: "customer", id: customer.id }]);
    const feature = await send("POST", "/api/features", {
      name: unique("Fictional Feature"),
      customerIds: [customer.id],
    });
    expect(feature.statusCode).toBe(201);
    const editor = await test.signedIn(["plan:edit"]);
    const response = await test.request(
      editor.cookie,
      "DELETE",
      `/api/customers/${customer.id}`,
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This is used by a feature; change that first",
    );
  });

  it("cannot be approved removed while a project still uses it", async () => {
    const customer = await addCustomer();
    await approve([{ type: "customer", id: customer.id }]);
    await send("DELETE", `/api/customers/${customer.id}`);
    // Saved before the removal was drafted would be refused, so the project links to it live.
    const project = await addProject();
    await approve([{ type: "project", id: project.id }]);
    await test.connection
      .update(projects)
      .set({ customerIds: [customer.id] })
      .where(eq(projects.id, project.id));
    const response = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/approval",
      { records: [{ type: "customer", id: customer.id }] },
    );
    expect(response.statusCode).toBe(409);
  });
});

describe("projects", () => {
  it("cannot be approved removed while a live milestone not removed with it still links", async () => {
    const project = await addProject();
    await approve([{ type: "project", id: project.id }]);
    await send("DELETE", `/api/projects/${project.id}`);
    // Added after the removal was drafted, so the removal does not take it, and the database's own
    // link would refuse deleting the project if the rule were judged after the deletes.
    await test.connection.insert(milestones).values({
      projectId: project.id,
      name: "Fictional Late Milestone",
      date: "2030-01-01",
    });
    const response = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/approval",
      { records: [{ type: "project", id: project.id }] },
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toContain("Fictional Late Milestone");
  });

  it("use the drafts of customers and proposals only drafted to be added, approved with them", async () => {
    const customer = await addCustomer();
    const proposal = await addProposal();
    const project = await addProject({
      customerIds: [customer.id, customer.id],
      proposalIds: [proposal.id],
    });
    expect(project.customerIds).toEqual([customer.id]);
    expect(project.draft?.uses).toEqual(
      expect.arrayContaining([
        { type: "customer", id: customer.id },
        { type: "proposal", id: proposal.id },
      ]),
    );
    await approve([{ type: "project", id: project.id }]);
    const plan = await readPlan();
    expect(byName(plan.customers, customer.name).draft).toBeUndefined();
    expect(byName(plan.proposals, proposal.name).draft).toBeUndefined();
  });

  it("refuse a customer that does not exist", async () => {
    const response = await send("POST", "/api/projects", {
      name: unique("Fictional Project"),
      customerIds: [missing],
    });
    expect(response.statusCode).toBe(404);
  });

  it("refuse a customer drafted to be removed", async () => {
    const customer = await addCustomer();
    await approve([{ type: "customer", id: customer.id }]);
    await send("DELETE", `/api/customers/${customer.id}`);
    const response = await send("POST", "/api/projects", {
      name: unique("Fictional Project"),
      customerIds: [customer.id],
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      `This links to the customer ${customer.name}, which is drafted to be removed; discard that draft first`,
    );
  });

  it("keep their names and Project IDs unique, ignoring letter case, but share having none", async () => {
    const externalId = unique("P");
    const project = await addProject({ externalId });
    expect(project.externalId).toBe(externalId);
    const sameId = await send("POST", "/api/projects", {
      name: unique("Fictional Project"),
      externalId: externalId.toLowerCase(),
    });
    expect(errorOf(sameId)).toBe(
      "There is already a project with that Project ID",
    );
    const sameName = await send("POST", "/api/projects", {
      name: project.name.toLowerCase(),
    });
    expect(errorOf(sameName)).toBe("There is already a project with that name");
    await addProject({ externalId: "" });
    expect((await addProject()).externalId).toBeNull();
  });

  it("are owned by one of People", async () => {
    const ownerId = await addPerson();
    const project = await addProject({ ownerId });
    expect(project.ownerId).toBe(ownerId);
    const response = await send("PUT", `/api/projects/${project.id}`, {
      name: project.name,
      ownerId: missing,
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose an owner from People");
  });

  it("refuse changing one that does not exist", async () => {
    const response = await send("PUT", `/api/projects/${missing}`, {
      name: unique("Fictional Nobody"),
    });
    expect(response.statusCode).toBe(404);
  });

  it("are removed with their milestones, approved and discarded together", async () => {
    const project = await addProject();
    await addMilestone(project.id, { date: "2027-01-04" });
    await addMilestone(project.id, { date: "2027-02-01" });
    const drafted = await projectNamed(project.id);
    await approve([
      { type: "project", id: project.id },
      ...drafted.milestones.map(({ id }) => ({ type: "milestone", id })),
    ]);
    // A milestone only drafted to be added goes with the project's removal, as does one already
    // drafted to be removed.
    await addMilestone(project.id, { date: "2027-03-01" });
    await send(
      "DELETE",
      `/api/projects/${project.id}/milestones/${String(drafted.milestones[1]?.id)}`,
    );
    expect(
      (await send("DELETE", `/api/projects/${project.id}`)).statusCode,
    ).toBe(200);
    const removing = await projectNamed(project.id);
    expect(removing.draft?.action).toBe("deleted");
    expect(removing.milestones).toHaveLength(2);
    expect(removing.draft?.uses).toHaveLength(2);
    for (const milestone of removing.milestones) {
      expect(milestone.draft?.uses).toEqual([
        { type: "project", id: project.id },
      ]);
    }
    const discarded = await send(
      "DELETE",
      `/api/records/milestone/${String(removing.milestones[0]?.id)}/draft`,
    );
    expect(discarded.statusCode).toBe(200);
    const restored = await projectNamed(project.id);
    expect(restored.draft).toBeUndefined();
    expect(restored.milestones.every(({ draft }) => draft === undefined)).toBe(
      true,
    );
    await send("DELETE", `/api/projects/${project.id}`);
    await approve([{ type: "project", id: project.id }]);
    expect(await projectNamed(project.id)).toBeUndefined();
  });

  it("only drafted to be added are discarded with their milestones", async () => {
    const project = await addProject();
    await addMilestone(project.id, { date: "2027-01-04" });
    const response = await send("DELETE", `/api/projects/${project.id}`);
    expect(response.statusCode).toBe(200);
    expect(await projectNamed(project.id)).toBeUndefined();
  });
});

describe("milestones", () => {
  it("give their project its dates, with the live dates beside while drafts change them", async () => {
    const project = await addProject();
    expect(project.dates).toEqual({
      first: null,
      last: null,
      nextDelivery: null,
    });
    await addMilestone(project.id, {
      date: "2001-01-01",
      customerDelivery: true,
    });
    await addMilestone(project.id, {
      date: "2999-06-01",
      customerDelivery: true,
    });
    await addMilestone(project.id, { name: "Fictional B", date: "2999-12-01" });
    await addMilestone(project.id, { name: "Fictional A", date: "2999-12-01" });
    const drafted = await projectNamed(project.id);
    expect(drafted.dates).toEqual({
      first: "2001-01-01",
      last: "2999-12-01",
      nextDelivery: "2999-06-01",
    });
    expect(drafted.liveDates).toEqual({
      first: null,
      last: null,
      nextDelivery: null,
    });
    expect(drafted.milestones.map(({ date }) => date)).toEqual([
      "2001-01-01",
      "2999-06-01",
      "2999-12-01",
      "2999-12-01",
    ]);
    expect(drafted.milestones.at(-1)?.name).toBe("Fictional B");
    await approve([
      { type: "project", id: project.id },
      ...drafted.milestones.map(({ id }) => ({ type: "milestone", id })),
    ]);
    const live = await projectNamed(project.id);
    expect(live.liveDates).toBeUndefined();
    for (const { id } of live.milestones.slice(-2)) {
      await send("DELETE", `/api/projects/${project.id}/milestones/${id}`);
    }
    expect((await projectNamed(project.id)).dates.last).toBe("2999-06-01");
  });

  it("are changed within their project only", async () => {
    const project = await addProject();
    const other = await addProject();
    await addMilestone(project.id, { date: "2027-01-04" });
    const [milestone] = (await projectNamed(project.id)).milestones;
    const body = { name: "Fictional Moved", date: "2027-05-03" };
    const elsewhere = await send(
      "PUT",
      `/api/projects/${other.id}/milestones/${String(milestone?.id)}`,
      body,
    );
    expect(elsewhere.statusCode).toBe(404);
    const changed = await send(
      "PUT",
      `/api/projects/${project.id}/milestones/${String(milestone?.id)}`,
      { ...body, customerDelivery: true },
    );
    expect(changed.statusCode).toBe(200);
    expect((await projectNamed(project.id)).milestones[0]).toMatchObject({
      name: "Fictional Moved",
      date: "2027-05-03",
      customerDelivery: true,
    });
    const removedElsewhere = await send(
      "DELETE",
      `/api/projects/${other.id}/milestones/${String(milestone?.id)}`,
    );
    expect(removedElsewhere.statusCode).toBe(404);
  });

  it("refuse a project that does not exist", async () => {
    const response = await send("POST", `/api/projects/${missing}/milestones`, {
      name: "Fictional Orphan",
      date: "2027-01-04",
    });
    expect(response.statusCode).toBe(404);
  });

  it("are removed alone as a draft", async () => {
    const project = await addProject();
    await addMilestone(project.id, { date: "2027-01-04" });
    const drafted = await projectNamed(project.id);
    await approve([
      { type: "project", id: project.id },
      { type: "milestone", id: String(drafted.milestones[0]?.id) },
    ]);
    const id = String(drafted.milestones[0]?.id);
    const response = await send(
      "DELETE",
      `/api/projects/${project.id}/milestones/${id}`,
    );
    expect(response.statusCode).toBe(200);
    expect((await projectNamed(project.id)).milestones[0]?.draft).toMatchObject(
      { action: "deleted", uses: [] },
    );
  });
});

describe("proposals", () => {
  it("start in the first status offered, and keep theirs when a change does not name one", async () => {
    const found = await statuses();
    const proposal = await addProposal();
    expect(proposal.statusId).toBe(found.get("Open"));
    const response = await send("PUT", `/api/proposals/${proposal.id}`, {
      name: proposal.name,
    });
    expect(response.statusCode).toBe(200);
    const kept = byName(response.json<Saved>().plan.proposals, proposal.name);
    expect(kept.statusId).toBe(found.get("Open"));
  });

  it("move to any status from any other", async () => {
    const found = await statuses();
    const proposal = await addProposal({ statusId: found.get("Lost") });
    for (const label of ["Won", "Open", "Withdrawn"]) {
      const response = await send("PUT", `/api/proposals/${proposal.id}`, {
        name: proposal.name,
        statusId: found.get(label),
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it("refuse a status that is not one of proposals'", async () => {
    const response = await send("POST", "/api/proposals", {
      name: unique("Fictional Proposal"),
      statusId: testPosition,
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose a status from its list");
  });

  it("refuse adding one when no status is offered", async () => {
    await test.connection
      .update(listItems)
      .set({ retired: true })
      .where(eq(listItems.id, String((await statuses()).get("Open"))));
    const rest = [...(await statuses()).values()];
    for (const id of rest) {
      await test.connection
        .update(listItems)
        .set({ retired: true })
        .where(eq(listItems.id, id));
    }
    const response = await send("POST", "/api/proposals", {
      name: unique("Fictional Proposal"),
    });
    for (const id of rest) {
      await test.connection
        .update(listItems)
        .set({ retired: false })
        .where(eq(listItems.id, id));
    }
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "No proposal status is offered. Add one to the list first.",
    );
  });

  it("keep a web link in the form it is kept, and refuse one Fathom does not accept", async () => {
    const proposal = await addProposal({ link: "example.com/bid" });
    expect(proposal.link).toBe("https://example.com/bid");
    const response = await send("POST", "/api/proposals", {
      name: unique("Fictional Proposal"),
      link: "javascript:alert(1)",
    });
    expect(response.statusCode).toBe(400);
  });

  it("keep their names and Proposal IDs unique, ignoring letter case", async () => {
    const externalId = unique("PR");
    const proposal = await addProposal({ externalId });
    const sameName = await send("POST", "/api/proposals", {
      name: proposal.name.toUpperCase(),
    });
    expect(errorOf(sameName)).toBe(
      "There is already a proposal with that name",
    );
    const response = await send("POST", "/api/proposals", {
      name: unique("Fictional Proposal"),
      externalId: externalId.toUpperCase(),
    });
    expect(errorOf(response)).toBe(
      "There is already a proposal with that Proposal ID",
    );
  });

  it("cannot be removed while a project links to them", async () => {
    const proposal = await addProposal();
    await approve([{ type: "proposal", id: proposal.id }]);
    const project = await addProject({ proposalIds: [proposal.id] });
    const response = await send("DELETE", `/api/proposals/${proposal.id}`);
    expect(errorOf(response)).toBe(
      `This is used by the project ${project.name}; change that first`,
    );
  });

  it("keep the customers they use from being removed", async () => {
    const customer = await addCustomer();
    await approve([{ type: "customer", id: customer.id }]);
    const proposal = await addProposal({ customerIds: [customer.id] });
    const response = await send("DELETE", `/api/customers/${customer.id}`);
    expect(errorOf(response)).toBe(
      `This is used by the proposal ${proposal.name}; change that first`,
    );
  });

  it("keep their status from being removed from the list, live or in a draft", async () => {
    const list = await test.connection
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.builtIn, "proposal-statuses"));
    const listId = String(list[0]?.id);
    const configurer = await test.signedIn("workforce-administrator");
    const choice = await test.request(
      configurer.cookie,
      "POST",
      `/api/lists/${listId}/choices`,
      { choices: [{ label: unique("Fictional Status") }] },
    );
    expect(choice.statusCode).toBe(201);
    await test.approveLists();
    const [added] = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .where(and(eq(listItems.listId, listId), eq(listItems.retired, false)))
      .orderBy(asc(listItems.position))
      .then((rows) => rows.slice(-1));
    const proposal = await addProposal({ statusId: added?.id });
    const drafted = await test.request(
      configurer.cookie,
      "DELETE",
      `/api/lists/${listId}/choices/${String(added?.id)}`,
    );
    expect(drafted.statusCode).toBe(409);
    await approve([{ type: "proposal", id: proposal.id }]);
    const live = await test.request(
      configurer.cookie,
      "DELETE",
      `/api/lists/${listId}/choices/${String(added?.id)}`,
    );
    expect(live.statusCode).toBe(409);
  });
});

describe("the features projects and proposals name", () => {
  it("are kept each once, in order, and use the drafts of features only drafted to be added", async () => {
    // Given two features only drafted to be added
    const first = await addFeature();
    const second = await addFeature();
    // When a project and a proposal name them
    const project = await addProject({
      featureIds: [second.id, first.id, second.id],
    });
    const proposal = await addProposal({ featureIds: [first.id] });
    // Then each is named once, in order, and approving them approves the features
    expect(project.featureIds).toEqual([first.id, second.id].sort());
    expect(proposal.featureIds).toEqual([first.id]);
    expect(project.draft?.uses).toEqual(
      expect.arrayContaining([
        { type: "feature", id: first.id },
        { type: "feature", id: second.id },
      ]),
    );
    await approve([
      { type: "project", id: project.id },
      { type: "proposal", id: proposal.id },
    ]);
    const plan = await readPlan(viewer.cookie);
    expect(byName(plan.projects, project.name)).toMatchObject({
      featureIds: [first.id, second.id].sort(),
    });
    expect(byName(plan.proposals, proposal.name)).toMatchObject({
      featureIds: [first.id],
    });
    expect(byName(plan.features, first.name).draft).toBeUndefined();
  });

  it("are changed as a draft of the project or proposal", async () => {
    const feature = await addFeature();
    const project = await addProject();
    const proposal = await addProposal();
    await approve([
      { type: "feature", id: feature.id },
      { type: "project", id: project.id },
      { type: "proposal", id: proposal.id },
    ]);
    const changed = await send("PUT", `/api/projects/${project.id}`, {
      name: project.name,
      featureIds: [feature.id],
    });
    expect(changed.statusCode).toBe(200);
    const proposed = await send("PUT", `/api/proposals/${proposal.id}`, {
      name: proposal.name,
      featureIds: [feature.id],
    });
    expect(proposed.statusCode).toBe(200);
    const plan = await readPlan();
    expect(byName(plan.projects, project.name).draft).toMatchObject({
      changed: ["featureIds"],
      live: { featureIds: [] },
    });
    expect(byName(plan.proposals, proposal.name).draft).toMatchObject({
      changed: ["featureIds"],
      live: { featureIds: [] },
    });
  });

  it("refuse a project's general feature, which is off the roadmap", async () => {
    const project = await addProject();
    await approve([{ type: "project", id: project.id }]);
    const [general] = await test.connection
      .select({ id: features.id })
      .from(features)
      .where(eq(features.generalForProjectId, project.id));
    const generalId = String(general?.id);
    for (const path of ["projects", "proposals"]) {
      const response = await send("POST", `/api/${path}`, {
        name: unique("Fictional Record"),
        featureIds: [generalId],
      });
      expect(response.statusCode).toBe(400);
      expect(errorOf(response)).toBe("Choose features from Features");
    }
  });

  it("refuse a feature that does not exist", async () => {
    const response = await send("POST", "/api/proposals", {
      name: unique("Fictional Proposal"),
      featureIds: [missing],
    });
    expect(response.statusCode).toBe(404);
  });

  it("keep a feature from being removed while a project or proposal names it", async () => {
    const feature = await addFeature();
    await approve([{ type: "feature", id: feature.id }]);
    // Given a live feature a proposal names
    const proposal = await addProposal({ featureIds: [feature.id] });
    // When its removal is drafted, it is refused, naming the proposal, then the project
    const refused = await send("DELETE", `/api/features/${feature.id}`);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `This is used by the proposal ${proposal.name}; change that first`,
    );
    await send("DELETE", `/api/proposals/${proposal.id}`);
    const project = await addProject({ featureIds: [feature.id] });
    expect(errorOf(await send("DELETE", `/api/features/${feature.id}`))).toBe(
      `This is used by the project ${project.name}; change that first`,
    );
  });
});

describe("a feature's projects and proposals", () => {
  const changeNamers = (
    featureId: string,
    body: object,
    cookie = planner.cookie,
  ) =>
    test.request(
      cookie,
      "PUT",
      `/api/features/${featureId}/projects-and-proposals`,
      body,
    );

  async function liveRecords() {
    const feature = await addFeature();
    const kept = await addProject({ featureIds: [feature.id] });
    const dropped = await addProject({ featureIds: [feature.id] });
    const added = await addProject();
    const proposal = await addProposal();
    await approve([
      { type: "feature", id: feature.id },
      ...[kept, dropped, added].map(({ id }) => ({ type: "project", id })),
      { type: "proposal", id: proposal.id },
    ]);
    return { feature, kept, dropped, added, proposal };
  }

  it("are changed as drafts of each project and proposal added or taken away, in one change", async () => {
    // Given a feature two live projects need
    const { feature, kept, dropped, added, proposal } = await liveRecords();
    // When it is moved from one project to another, and added to a proposal
    const response = await changeNamers(feature.id, {
      projectIds: [kept.id, added.id],
      proposalIds: [proposal.id],
    });
    // Then each record that changes has a draft, and the one kept has none
    expect(response.statusCode).toBe(200);
    const { plan, changeSetId } = response.json<Saved>();
    expect(byName(plan.projects, kept.name).draft).toBeUndefined();
    expect(byName(plan.projects, dropped.name)).toMatchObject({
      featureIds: [],
      draft: { changed: ["featureIds"] },
    });
    expect(byName(plan.projects, added.name)).toMatchObject({
      featureIds: [feature.id],
      draft: { changed: ["featureIds"] },
    });
    expect(byName(plan.proposals, proposal.name).featureIds).toEqual([
      feature.id,
    ]);
    expect(byName(plan.features, feature.name).draft).toBeUndefined();
    // And all of them are one change
    expect(changeSetId).not.toBeNull();
  });

  it("leave a kind not named as it is, and save nothing when nothing changes", async () => {
    const { feature, kept } = await liveRecords();
    const response = await changeNamers(feature.id, { proposalIds: [] });
    expect(response.statusCode).toBe(200);
    const { plan, changeSetId } = response.json<Saved>();
    expect(changeSetId).toBeNull();
    expect(byName(plan.projects, kept.name).featureIds).toEqual([feature.id]);
  });

  it("refuse a feature that does not exist, or a project's general feature", async () => {
    const project = await addProject();
    await approve([{ type: "project", id: project.id }]);
    const [general] = await test.connection
      .select({ id: features.id })
      .from(features)
      .where(eq(features.generalForProjectId, project.id));
    for (const featureId of [missing, String(general?.id)]) {
      const response = await changeNamers(featureId, {
        projectIds: [project.id],
      });
      expect(response.statusCode).toBe(404);
      expect(errorOf(response)).toBe("There is no such feature");
    }
  });

  it("leave a project drafted to be removed as it is, and refuse adding the feature to one", async () => {
    // Given a project needing the feature, drafted to be removed, and another drafted to be removed
    const { feature, kept, dropped, added } = await liveRecords();
    for (const project of [dropped, added]) {
      expect(
        (await send("DELETE", `/api/projects/${project.id}`)).statusCode,
      ).toBe(200);
    }
    // When a view of the drafts applied, which shows neither, names only the project kept
    const unchanged = await changeNamers(feature.id, {
      projectIds: [kept.id],
    });
    // Then nothing changes
    expect(unchanged.statusCode).toBe(200);
    expect(unchanged.json<Saved>().changeSetId).toBeNull();
    // And adding the feature to a project drafted to be removed is refused, naming it
    const refused = await changeNamers(feature.id, {
      projectIds: [kept.id, added.id],
    });
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The project ${added.name} is drafted to be removed, so it can't be changed`,
    );
  });

  it("refuse a project that does not exist", async () => {
    const { feature } = await liveRecords();
    const response = await changeNamers(feature.id, { projectIds: [missing] });
    expect(response.statusCode).toBe(404);
  });

  it("refuse a project another planner is changing", async () => {
    const { feature, added } = await liveRecords();
    const other = await test.signedIn("product-manager");
    const held = await test.request(
      other.cookie,
      "PUT",
      `/api/projects/${added.id}`,
      { name: unique("Fictional Renamed") },
      { publish: false },
    );
    expect(held.statusCode).toBe(200);
    const response = await changeNamers(feature.id, {
      projectIds: [added.id],
    });
    expect(response.statusCode).toBe(409);
  });

  it("are refused to those who edit features but not the rest of the plan", async () => {
    const { feature } = await liveRecords();
    const lead = await test.signedIn("feature-lead");
    const response = await changeNamers(
      feature.id,
      { projectIds: [] },
      lead.cookie,
    );
    expect(response.statusCode).toBe(403);
  });
});

describe("owners", () => {
  it("cannot be removed from People while they own a project or proposal", async () => {
    const editor = await test.signedIn("workforce-administrator");
    const drafted = await addPerson();
    await addProposal({ ownerId: drafted });
    const response = await test.request(
      editor.cookie,
      "DELETE",
      `/api/people/${drafted}`,
    );
    expect(response.statusCode).toBe(409);
    const live = await addPerson();
    const project = await addProject({ ownerId: live });
    await approve([{ type: "project", id: project.id }]);
    const refused = await test.request(
      editor.cookie,
      "DELETE",
      `/api/people/${live}`,
    );
    expect(errorOf(refused)).toBe(
      `This person is named by the project ${project.name}; change that first`,
    );
  });

  it("are refused removal without naming the project to a role that can't see the plan", async () => {
    const editor = await test.signedIn(["people:edit"]);
    const person = await addPerson();
    const project = await addProject({ ownerId: person });
    await approve([{ type: "project", id: project.id }]);
    const response = await test.request(
      editor.cookie,
      "DELETE",
      `/api/people/${person}`,
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This person is named by a project; change that first",
    );
  });

  it.each([
    ["names the project to an approver who sees the plan", ["plan:view"], true],
    ["names no project to an approver who can't see the plan", [], false],
  ] as const)(
    "cannot be approved removed once they own a project, and %s",
    async (_case, more, named) => {
      const editor = await test.signedIn("workforce-administrator");
      const person = await addPerson();
      const removed = await test.request(
        editor.cookie,
        "DELETE",
        `/api/people/${person}`,
      );
      expect(removed.statusCode).toBe(200);
      const project = await addProject({ ownerId: person });
      const decider = await test.signedIn([
        "people:view",
        "people:approve",
        ...more,
      ]);
      const response = await test.request(
        decider.cookie,
        "POST",
        "/api/drafts/approval",
        { people: [person] },
      );
      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toBe(
        `This person is named by ${named ? `the project ${project.name}` : "a project"}; change that first`,
      );
    },
  );

  it("cannot be removed while unpublished changes name them, naming only the remover's own", async () => {
    const editor = await test.signedIn("workforce-administrator");
    const person = await addPerson();
    const owner = await test.signedIn(["plan:edit", "people:edit"]);
    const project = unique("Fictional Project");
    const drafted = await test.request(
      owner.cookie,
      "POST",
      "/api/projects",
      { name: project, ownerId: person },
      { publish: false },
    );
    expect(drafted.statusCode).toBe(201);
    const byOther = await test.request(
      editor.cookie,
      "DELETE",
      `/api/people/${person}`,
    );
    const byMaker = await test.request(
      owner.cookie,
      "DELETE",
      `/api/people/${person}`,
      undefined,
      { publish: false },
    );
    expect(byOther.statusCode).toBe(409);
    expect(errorOf(byOther)).toBe(
      "This person is named by a project; change that first",
    );
    expect(byMaker.statusCode).toBe(409);
    expect(errorOf(byMaker)).toBe(
      `This person is named by the project ${project}; change that first`,
    );
    await test.request(owner.cookie, "POST", "/api/unpublished/discard");
  });
});

describe("drafts", () => {
  it("are rejected only together with the drafts that use them, and resubmitted", async () => {
    const customer = await addCustomer();
    const project = await addProject({ customerIds: [customer.id] });
    const alone = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/rejection",
      { records: [{ type: "customer", id: customer.id }], reason: "Fictional" },
    );
    expect(alone.statusCode).toBe(409);
    const together = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/rejection",
      {
        records: [
          { type: "customer", id: customer.id },
          { type: "project", id: project.id },
        ],
        reason: "Fictional",
      },
    );
    expect(together.statusCode).toBe(200);
    const resubmitted = await send(
      "DELETE",
      `/api/records/project/${project.id}/draft/rejection`,
    );
    expect(resubmitted.statusCode).toBe(200);
    expect((await projectNamed(project.id)).draft?.state).toBe("waiting");
  });

  it("are named among the maker's unpublished changes", async () => {
    const project = await addProject();
    const customer = unique("Fictional Unpublished Customer");
    await send(
      "POST",
      "/api/customers",
      { name: customer },
      { publish: false },
    );
    await send(
      "POST",
      `/api/projects/${project.id}/milestones`,
      { name: "Fictional Unpublished Milestone", date: "2027-01-04" },
      { publish: false },
    );
    const proposal = unique("Fictional Unpublished Proposal");
    await send(
      "POST",
      "/api/proposals",
      { name: proposal },
      { publish: false },
    );
    const response = await test.request(
      planner.cookie,
      "GET",
      "/api/unpublished",
    );
    const subjects = response
      .json<Unpublished>()
      .changes.map(({ subject }) => subject);
    expect(subjects).toEqual(
      expect.arrayContaining([
        `the customer ${customer}`,
        `the milestone Fictional Unpublished Milestone of ${project.name}`,
        `the proposal ${proposal}`,
      ]),
    );
    await test.request(planner.cookie, "POST", "/api/unpublished/discard");
  });

  it("are named among the maker's unpublished changes without their name once their role no longer sees the plan", async () => {
    const maker = await test.signedIn(["plan:view", "plan:edit"]);
    const customer = unique("Fictional Hidden Customer");
    await test.request(
      maker.cookie,
      "POST",
      "/api/customers",
      { name: customer },
      { publish: false },
    );
    await test.holdOnly(maker.id, ["configuration:view", "configuration:edit"]);

    const response = await test.request(
      maker.cookie,
      "GET",
      "/api/unpublished",
    );

    expect(
      response.json<Unpublished>().changes.map(({ subject }) => subject),
    ).toEqual(["a customer"]);
  });

  it("are shown in the change history only to those who see the plan, as release streams are also to those who see configuration", async () => {
    const customer = await addCustomer();
    const configurer = await test.signedIn("workforce-administrator");
    const stream = unique("Fictional Stream");
    await test.request(configurer.cookie, "POST", "/api/release-streams", {
      name: stream,
    });
    const history = async (permissions: Permission[]) => {
      const reader = await test.signedIn(permissions);
      const response = await test.request(reader.cookie, "GET", "/api/changes");
      return response
        .json<ChangeHistory>()
        .entries.flatMap((entry) => entry.records)
        .map(({ name }) => name);
    };
    expect(await history(["plan:view"])).toContain(customer.name);
    const configuration = await history(["configuration:view"]);
    expect(configuration).not.toContain(customer.name);
    expect(configuration).toContain(stream);
  });

  it("are named in the change history, with the customers and statuses they pick", async () => {
    const customer = await addCustomer();
    const project = await addProject({ customerIds: [customer.id] });
    await addMilestone(project.id, { date: "2027-01-04" });
    const proposal = await addProposal();
    await send("PUT", `/api/proposals/${proposal.id}`, {
      name: proposal.name,
      statusId: (await statuses()).get("Won"),
    });
    await send("PUT", `/api/projects/${project.id}`, {
      name: project.name,
      customerIds: [],
    });
    const response = await test.request(planner.cookie, "GET", "/api/changes");
    const records = response
      .json<ChangeHistory>()
      .entries.flatMap((entry) => entry.records);
    expect(
      records
        .filter(({ name }) => name === project.name)
        .flatMap(({ fields }) => fields),
    ).toContainEqual({
      field: "customerIds",
      oldValue: [customer.name],
      newValue: [],
    });
    expect(
      records
        .filter(({ name }) => name === proposal.name)
        .flatMap(({ fields }) => fields),
    ).toContainEqual({ field: "statusId", oldValue: "Open", newValue: "Won" });
    expect(records.find(({ kind }) => kind === "milestone")).toMatchObject({
      list: expect.any(String) as string,
    });
  });
});
