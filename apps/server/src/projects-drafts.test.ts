// SPDX-License-Identifier: Apache-2.0

// Tests for the drafts of customers, projects, milestones and proposals, against a PostgreSQL server
// of their own.

import type { ChangeHistory, Permission, Unpublished } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unique } from "./test-app.ts";
import {
  test,
  planner,
  approver,
  send,
  addCustomer,
  addProject,
  addProposal,
  addMilestone,
  projectNamed,
  statuses,
  startProjectTests,
  closeProjectTests,
} from "./test-projects.ts";

beforeAll(startProjectTests);

afterAll(closeProjectTests);

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
      { records: [{ name: customer }] },
      { publish: false },
    );
    await send(
      "POST",
      "/api/milestones",
      {
        records: [
          {
            projectId: project.id,
            name: "Fictional Unpublished Milestone",
            date: "2027-01-04",
          },
        ],
      },
      { publish: false },
    );
    const proposal = unique("Fictional Unpublished Proposal");
    await send(
      "POST",
      "/api/proposals",
      { records: [{ name: proposal }] },
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
      { records: [{ name: customer }] },
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
