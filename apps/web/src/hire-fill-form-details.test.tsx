// SPDX-License-Identifier: Apache-2.0

// Tests for a planned hire's details around filling it: who is offered Fill, how a fill waiting for
// approval shows, and the new person once People has them.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";
import {
  setUpEachTest,
  person,
  robin,
  hire,
  builtIn,
  choice,
  answers,
  openForm,
  fillNow,
  type,
} from "./test-hire-fill-form.tsx";

setUpEachTest();

describe("a planned hire's details", () => {
  it("offer Fill when it can be filled", async () => {
    answers([robin, hire()]);
    renderApp("/people?open=TBD-1");
    await screen.findByRole("region", { name: "Fictional Hire" });

    await userEvent.click(
      within(screen.getByRole("region", { name: "Fictional Hire" })).getByRole(
        "button",
        { name: "Fill" },
      ),
    );

    expect(
      await screen.findByRole("heading", { name: "Fill this planned hire" }),
    ).toBeDefined();
  });

  it("offer no Fill to those who may not change planned hires", async () => {
    answers([robin, hire()], {
      permissions: [
        "people:view",
        "people:edit",
        "hiring-plan:view",
        "confidential:view",
        "personal:view",
        "plan:view",
        "features:view",
      ],
    });
    renderApp("/people?open=TBD-1");
    const panel = await screen.findByRole("region", { name: "Fictional Hire" });

    expect(within(panel).queryByRole("button", { name: "Fill" })).toBeNull();
  });

  it("name who is filling it, with links to them", async () => {
    answers([
      robin,
      person("n1", "Fictional Starter", { employeeId: "E9" }),
      hire({ filler: "n1" }),
    ]);
    renderApp("/people?open=TBD-1");
    const panel = await screen.findByRole("region", { name: "Fictional Hire" });
    expect(
      within(panel).getByRole("heading", { name: "Filled by" }),
    ).toBeDefined();
    expect(within(panel).getByRole("button", { name: "E9" })).toBeDefined();

    await userEvent.click(
      within(panel).getByRole("button", { name: "Fictional Starter" }),
    );

    expect(
      await screen.findByRole("region", { name: "Fictional Starter" }),
    ).toBeDefined();
  });

  it("say only that it is filled to those who may not know by whom", async () => {
    answers([robin, hire({ filler: null })]);
    renderApp("/people?open=TBD-1");
    const panel = await screen.findByRole("region", { name: "Fictional Hire" });

    expect(
      within(panel).getByRole("heading", { name: "Filled by" }),
    ).toBeDefined();
    expect(within(panel).queryByRole("button", { name: "Fill" })).toBeNull();
  });
});

describe("after filling", () => {
  it("shows the new person once People has them", async () => {
    let filled = false;
    const added = person("n1", "Fictional Starter", { employeeId: "E9" });
    const fetch = serverAnswers({});
    fetch.mockImplementation((url: string, init?: RequestInit) => {
      const respond = (body: object) => Promise.resolve(Response.json(body));
      if (url === "/api/session") {
        return respond({
          ...fictionalUser,
          permissions: [
            "people:view",
            "people:edit",
            "hiring-plan:view",
            "confidential:view",
            "hiring-plan:edit",
            "confidential:edit",
            "personal:view",
            "plan:view",
            "features:view",
          ],
        });
      }
      if (url === "/api/people") {
        return respond({
          people: filled
            ? [robin, hire({ filler: "n1" }), added]
            : [robin, hire()],
          fields: [],
          order: [],
        });
      }
      if (url === "/api/lists") {
        return respond({
          lists: [
            builtIn("positions", [choice("engineer", "Fictional Engineer")]),
            builtIn("hiring-states", [
              choice("open", "Approved to hire", "open"),
            ]),
          ],
        });
      }
      if (url === "/api/unpublished") return respond({ changes: [] });
      if (init?.method === "POST") {
        filled = true;
        return respond({ changeSetId: null });
      }
      return respond({});
    });
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await type("ID", "E9");
    await userEvent.tab();

    await fillNow();

    expect(
      await screen.findByRole("region", { name: "Fictional Starter" }),
    ).toBeDefined();
  });
});
