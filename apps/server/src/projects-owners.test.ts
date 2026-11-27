// SPDX-License-Identifier: Apache-2.0

// Tests for the owners of projects and proposals, against a PostgreSQL server of their own.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unique, errorOf } from "./test-app.ts";
import {
  test,
  addProject,
  addProposal,
  approve,
  addPerson,
  startProjectTests,
  closeProjectTests,
} from "./test-projects.ts";

beforeAll(startProjectTests);

afterAll(closeProjectTests);

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
      { records: [{ name: project, ownerId: person }] },
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
