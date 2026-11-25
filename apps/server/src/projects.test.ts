// SPDX-License-Identifier: Apache-2.0

// Tests for customers, projects with their milestones, and proposals, against a PostgreSQL server of
// their own: reading them and their choices, who may change them, and what they keep and link to.

import { listItems, lists, milestones, people, projects } from "@fathom/db";
import { noteLength } from "@fathom/shared";
import type { PlanChoices } from "@fathom/shared";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  testPosition,
  missingRecord as missing,
  unique,
  errorOf,
} from "./test-app.ts";
import {
  test,
  approver,
  viewer,
  type Saved,
  readPlan,
  send,
  added,
  byName,
  addCustomer,
  addProject,
  addProposal,
  addFeature,
  addMilestone,
  approve,
  projectNamed,
  statuses,
  addPerson,
  startProjectTests,
  closeProjectTests,
} from "./test-projects.ts";

beforeAll(startProjectTests);

afterAll(closeProjectTests);

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
    expect(errorOf(response)).toBe("Another customer has that name");
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
    expect(errorOf(sameId)).toBe("Another project has that Project ID");
    const sameName = await send("POST", "/api/projects", {
      name: project.name.toLowerCase(),
    });
    expect(errorOf(sameName)).toBe("Another project has that name");
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
    expect(errorOf(sameName)).toBe("Another proposal has that name");
    const response = await send("POST", "/api/proposals", {
      name: unique("Fictional Proposal"),
      externalId: externalId.toUpperCase(),
    });
    expect(errorOf(response)).toBe("Another proposal has that Proposal ID");
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
