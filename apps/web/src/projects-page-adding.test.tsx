// SPDX-License-Identifier: Apache-2.0

// Tests for adding records on the Projects page against a simulated server: in the side panel, and
// by pasting rows into a table, all saved by one request as one change.

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordDraft } from "./test-support.tsx";
import {
  addingAnswer,
  changeSetId,
  chooseFrom,
  customer,
  deleted,
  milestone,
  newButton,
  newId,
  openPage,
  plan,
  project,
  projectId,
  proposal,
  rowMenu,
  sent,
  sentTo,
  statusId,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
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
      { "POST /api/customers": addingAnswer(() => after) },
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
      { records: [{ name: "Added Customer", description: "", note: null }] },
    ]);
  });

  it("starts a proposal in the first status, and sends what is entered", async () => {
    const after = plan({
      proposals: [proposal(), proposal({ id: newId, name: "Added Proposal" })],
    });
    const { fetch, held } = await openPage("/projects?tab=proposals", plan(), {
      "POST /api/proposals": addingAnswer(() => after),
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
          records: [
            {
              name: "Added Proposal",
              externalId: "",
              link: null,
              ownerId: null,
              customerIds: [],
              statusId,
              featureIds: [],
            },
          ],
        },
      ]);
    });
  });

  it("adds a project", async () => {
    const after = plan({
      projects: [project(), project({ id: newId, name: "Added Project" })],
    });
    const { fetch, held } = await openPage("/projects", plan(), {
      "POST /api/projects": addingAnswer(() => after),
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
          records: [
            {
              name: "Added Project",
              externalId: "",
              ownerId: null,
              customerIds: [],
              proposalIds: [],
              featureIds: [],
            },
          ],
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
      "POST /api/milestones": addingAnswer(() => after),
    });
    const menu = await rowMenu("Fictional Project");
    await chooseFrom(menu, "Show on Milestones");
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
    expect(sent(fetch, "POST /api/milestones")).toEqual([
      {
        records: [
          {
            name: "Handover",
            date: "2030-09-01",
            customerDelivery: false,
            projectId,
          },
        ],
      },
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

describe("pasting rows into a table", () => {
  const rows = [
    { id: "90000000-0000-4000-8000-000000000011", name: "Fictional Alder" },
    { id: "90000000-0000-4000-8000-000000000012", name: "Fictional Birch" },
    { id: "90000000-0000-4000-8000-000000000013", name: "Fictional Cedar" },
  ];
  const names = rows.map(({ name }) => name);
  const ids = rows.map(({ id }) => id);

  const pasteCustomers = async () => {
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.paste(names.join("\n"));
  };

  it("adds every row by one request, and keeps none when it fails", async () => {
    // Given a server that can't save the customers
    const { fetch } = await openPage("/projects?tab=customers", plan(), {
      "POST /api/customers": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });

    // When three rows are pasted into the empty row
    await pasteCustomers();

    // Then they are sent together, and the failure names them all
    expect(
      await screen.findByText(
        "Fathom could not add Fictional Alder, Fictional Birch, and Fictional Cedar. Try again in a moment.",
      ),
    ).toBeTruthy();
    expect(sent(fetch, "POST /api/customers")).toMatchObject([
      { records: names.map((name) => ({ name })) },
    ]);
    // And the rows come back as new rows, none of them saved
    const nameCells = (saved: boolean) =>
      [...document.querySelectorAll('[id^="cell-"][id$="-name"]')]
        .filter((cell) => cell.id.startsWith("cell-new-") !== saved)
        .map((cell) => cell.textContent);
    await waitFor(() => {
      expect(nameCells(false)).toEqual(
        expect.arrayContaining(
          names.map((name): unknown => expect.stringContaining(name)),
        ),
      );
    });
    expect(nameCells(true)).toEqual(["Fictional Customer"]);
  });

  it("shows each row as the record the server gave it, and asks to undo them as one change", async () => {
    // Given a server that adds the customers under identifiers of its own
    const after = plan({
      customers: [
        customer(),
        ...rows.map(({ id, name }) =>
          customer({
            id,
            name,
            draft: recordDraft({ action: "created" }),
          }),
        ),
      ],
    });
    const { fetch, history, held } = await openPage(
      "/projects?tab=customers",
      plan(),
      {
        "POST /api/customers": addingAnswer(() => after, ids),
        [`POST /api/undo/${changeSetId}`]: deleted,
      },
    );
    held.plan = after;

    // When three rows are pasted, one is opened, and the paste is undone
    await pasteCustomers();
    // The plan is read again once the paste is saved.
    await waitFor(() => {
      const sentKeys = sentTo(fetch);
      expect(
        sentKeys
          .slice(sentKeys.indexOf("POST /api/customers"))
          .includes("GET /api/projects"),
      ).toBe(true);
    });
    await chooseFrom(await rowMenu("Fictional Birch"), "Show details");
    await waitFor(() => {
      expect(history.location.search).toContain(rows[1]?.id);
    });
    held.plan = plan();
    await userEvent.keyboard("{Control>}z{/Control}");

    // Then the row opened is the record the server gave it, and one undo names the change set they
    // were all saved in
    await waitFor(() => {
      expect(
        sentTo(fetch).filter((sentKey) =>
          sentKey.startsWith("POST /api/undo/"),
        ),
      ).toEqual([`POST /api/undo/${changeSetId}`]);
    });
    expect(
      sentTo(fetch).filter((sentKey) => sentKey === "POST /api/customers"),
    ).toHaveLength(1);
  });
});
