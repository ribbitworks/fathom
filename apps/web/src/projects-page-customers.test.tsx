// SPDX-License-Identifier: Apache-2.0

// Tests for what the Customers tab works out from the plan's links: the projects, proposals and
// features naming each customer, sorted, filtered and exported, and listed in its details; Show all
// features, opening Features filtered to the customer; and Remove customer turned off while
// anything names it.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordDraft, savedFiles } from "./test-support.tsx";
import {
  answers,
  chooseFrom,
  customer,
  customerId,
  editor,
  feature,
  featureEditor,
  openPage,
  plan,
  project,
  proposal,
  rowMenu,
  sidePanel,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const otherCustomerId = "c0000000-0000-4000-8000-000000000002";
const unnamedCustomerId = "c0000000-0000-4000-8000-000000000003";
const otherProjectId = "a0000000-0000-4000-8000-000000000002";

const direct = {
  ...feature("Fictional Direct", null),
  customerIds: [customerId],
};
const needed = feature("Fictional Needed", null);
const proposed = feature("Fictional Proposed", null);
const elsewhere = feature("Fictional Elsewhere", null);

// Fictional Customer is named by a project, a proposal and a feature, and gets a feature through
// each; Other Customer by another project alone; Unnamed Customer by nothing.
const linked = plan({
  customers: [
    customer({ id: otherCustomerId, name: "Other Customer" }),
    customer(),
    customer({ id: unnamedCustomerId, name: "Unnamed Customer" }),
  ],
  projects: [
    project({ featureIds: [needed.id] }),
    project({
      id: otherProjectId,
      name: "Another Project",
      externalId: "FP-2",
      customerIds: [otherCustomerId],
      proposalIds: [],
      featureIds: [elsewhere.id],
    }),
  ],
  proposals: [proposal({ featureIds: [proposed.id] })],
  features: [elsewhere, proposed, direct, needed],
});

const customersAt = (more = "") => `/projects?tab=customers${more}`;
const encoded = (value: unknown) => encodeURIComponent(JSON.stringify(value));

const grid = () => screen.getByRole("grid", { name: "Customers" });

const headers = () =>
  within(grid())
    .getAllByRole("columnheader")
    .map(({ textContent }) => textContent)
    .filter((text) => text !== "" && text !== "Actions");

// Each customer's row's name, in the order shown.
const customerRows = () =>
  within(grid())
    .getAllByRole("row")
    .map(
      ({ textContent }) =>
        /(Other|Fictional|Unnamed) Customer/u.exec(textContent)?.[0],
    )
    .filter((name) => name !== undefined);

const rowOf = (name: string) => {
  const found = within(grid())
    .getAllByRole("row")
    .find(({ textContent }) => textContent.includes(name));
  if (found === undefined) throw new Error(`No row for ${name}`);
  return found;
};

describe("the Customers tab's worked-out columns", () => {
  it("list the projects, proposals and features naming each customer, after its own columns", async () => {
    await openPage(customersAt(), linked);

    expect(headers()).toEqual([
      "Name",
      "Description",
      "Notes",
      "Projects",
      "Proposals",
      "Features",
    ]);
    const named = rowOf("Fictional Customer").textContent;
    expect(named).toContain("FP-1 Fictional Project");
    expect(named).toContain("Fictional Proposal");
    expect(named).toContain(
      "Fictional Proposed, Fictional Direct, Fictional Needed",
    );
    expect(named).not.toContain("Fictional Elsewhere");
    expect(rowOf("Other Customer").textContent).toContain(
      "FP-2 Another Project",
    );
    expect(rowOf("Unnamed Customer").textContent).not.toContain("Fictional");
  });

  it("follow a draft linking a project to a customer", async () => {
    await openPage(
      customersAt(),
      plan({
        projects: [
          project({
            customerIds: [customerId],
            draft: recordDraft({
              changed: ["customerIds"],
              live: { customerIds: [] },
            }),
          }),
        ],
        proposals: [],
      }),
    );

    expect(rowOf("Fictional Customer").textContent).toContain(
      "FP-1 Fictional Project",
    );
  });

  // A project a draft links to Fictional Customer, its link a draft's alone.
  const linkedByDraft = (state: "waiting" | "rejected") =>
    plan({
      projects: [
        project({
          customerIds: [customerId],
          draft: recordDraft({
            state,
            changed: ["customerIds"],
            live: { customerIds: [] },
          }),
        }),
      ],
      proposals: [],
    });

  it("leave out a link a draft makes under Live only", async () => {
    await openPage(customersAt("&show=live"), linkedByDraft("waiting"));

    expect(rowOf("Fictional Customer").textContent).not.toContain(
      "Fictional Project",
    );
  });

  it("take back a rejected draft's link under Drafts applied", async () => {
    await openPage(customersAt("&show=drafts"), linkedByDraft("rejected"));

    expect(rowOf("Fictional Customer").textContent).not.toContain(
      "Fictional Project",
    );
  });

  it("mark a project drafted to be removed under Drafts applied, as Features does", async () => {
    await openPage(
      customersAt("&show=drafts"),
      plan({
        projects: [project({ draft: recordDraft({ action: "deleted" }) })],
        proposals: [],
      }),
    );

    expect(rowOf("Fictional Customer").textContent).toContain(
      "Fictional Project, removed",
    );
  });

  it("find a customer by the name of a project naming it", async () => {
    await openPage(customersAt("&search=Another"), linked);

    expect(customerRows()).toEqual(["Other Customer"]);
  });

  it("sort customers by the projects naming them, those with none last", async () => {
    await openPage(customersAt(`&sort=${encoded(["projectIds"])}`), linked);

    expect(customerRows()).toEqual([
      "Fictional Customer",
      "Other Customer",
      "Unnamed Customer",
    ]);
  });

  it("filter customers to those a project names", async () => {
    await openPage(
      customersAt(
        `&filters=${encoded({ projectIds: { any: [otherProjectId] } })}`,
      ),
      linked,
    );

    expect(customerRows()).toEqual(["Other Customer"]);
    expect(
      screen.getByText("Projects: FP-2 Another Project", { exact: false }),
    ).toBeTruthy();
  });

  it("are exported, each record by its ID and name", async () => {
    const files = savedFiles();
    await openPage(customersAt(), linked);

    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );

    await waitFor(() => {
      expect(files).toHaveLength(1);
    });
    const lines = (await files[0]?.text())?.split("\r\n") ?? [];
    expect(lines[0]).toBe(
      "Draft,Change,Name,Description,Notes,Projects,Proposals,Features",
    );
    expect(lines).toContain(
      ",,Fictional Customer,,,FP-1 Fictional Project,Fictional Proposal,Fictional Proposed; Fictional Direct; Fictional Needed",
    );
  });

  it("leave Features out for a reader who doesn't see features, with Show all features", async () => {
    await openPage(customersAt(), linked, {}, ["plan:view", "plan:edit"]);

    expect(headers()).toEqual([
      "Name",
      "Description",
      "Notes",
      "Projects",
      "Proposals",
    ]);
    const menu = await rowMenu("Fictional Customer");
    expect(
      within(menu).queryByRole("menuitem", { name: "Show all features" }),
    ).toBeNull();
  });
});

describe("a customer's details", () => {
  const rows = (title: string) =>
    within(within(sidePanel()).getByRole("region", { name: title }))
      .getAllByRole("term")
      .map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent ?? "",
      ]);

  it("list under Commitments the projects, proposals and features it gets, as a feature's details list its own", async () => {
    await openPage(customersAt(`&open=${customerId}`), linked);
    await screen.findByRole("heading", { name: /Fictional Customer/u });

    expect(
      within(sidePanel())
        .getAllByRole("heading", { level: 3 })
        .map(({ textContent }) => textContent),
    ).toEqual(["Details", "Commitments"]);
    expect(rows("Commitments")).toEqual([
      ["Projects", "FP-1 Fictional Project"],
      ["Proposals", "Fictional Proposal"],
      ["Features", expect.stringContaining("Fictional Direct")],
    ]);
  });

  it("read None in each empty row", async () => {
    await openPage(customersAt(`&open=${unnamedCustomerId}`), linked);
    await screen.findByRole("heading", { name: /Unnamed Customer/u });

    expect(rows("Commitments")).toEqual([
      ["Projects", "None"],
      ["Proposals", "None"],
      ["Features", "None"],
    ]);
  });

  it("leave Features out for a reader who doesn't see features", async () => {
    await openPage(customersAt(`&open=${customerId}`), linked, {}, [
      "plan:view",
      "plan:edit",
    ]);
    await screen.findByRole("heading", { name: /Fictional Customer/u });

    expect(rows("Commitments").map(([label]) => label)).toEqual([
      "Projects",
      "Proposals",
    ]);
  });

  it("open a project's details on its tab from its link", async () => {
    await openPage(customersAt(`&open=${customerId}`), linked);

    await userEvent.click(
      await within(sidePanel()).findByRole("button", {
        name: "FP-1 Fictional Project",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: /Fictional Project/u }),
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Projects", selected: true }),
    ).toBeTruthy();
  });
});

describe("removing a customer", () => {
  const removeItem = (menu: HTMLElement) =>
    within(menu).getByRole("menuitem", { name: "Remove customer" });

  it("is turned off while a project names it, with the first naming it", async () => {
    await openPage(customersAt(), linked);

    const menu = await rowMenu("Fictional Customer");

    expect(removeItem(menu).hasAttribute("data-disabled")).toBe(true);
    expect(
      within(menu).getByText(
        "FP-1 Fictional Project and 2 others name this customer.",
      ),
    ).toBeTruthy();
  });

  it("names the first record naming it and counts the others", async () => {
    await openPage(
      customersAt(),
      plan({ features: [direct, { ...direct, id: crypto.randomUUID() }] }),
    );

    const menu = await rowMenu("Fictional Customer");

    expect(
      within(menu).getByText(
        "FP-1 Fictional Project and 3 others name this customer.",
      ),
    ).toBeTruthy();
  });

  it("is turned off while only a feature names it, naming the feature", async () => {
    await openPage(
      customersAt(),
      plan({ projects: [], proposals: [], features: [direct] }),
    );

    const menu = await rowMenu("Fictional Customer");

    expect(removeItem(menu).hasAttribute("data-disabled")).toBe(true);
    expect(
      within(menu).getByText("Fictional Direct names this customer."),
    ).toBeTruthy();
  });

  it("is turned off while only a proposal names it, naming the proposal", async () => {
    await openPage(customersAt(), plan({ projects: [] }));

    const menu = await rowMenu("Fictional Customer");

    expect(removeItem(menu).hasAttribute("data-disabled")).toBe(true);
    expect(
      within(menu).getByText("Fictional Proposal names this customer."),
    ).toBeTruthy();
  });

  it("is turned off under Drafts applied while a project names it", async () => {
    await openPage(customersAt("&show=drafts"), linked);

    const menu = await rowMenu("Fictional Customer");

    expect(removeItem(menu).hasAttribute("data-disabled")).toBe(true);
    expect(
      within(menu).getByText(
        "FP-1 Fictional Project and 2 others name this customer.",
      ),
    ).toBeTruthy();
  });

  it("is offered under Drafts applied once a rejected draft's link is taken back", async () => {
    await openPage(
      customersAt("&show=drafts"),
      plan({
        projects: [
          project({
            draft: recordDraft({
              state: "rejected",
              changed: ["customerIds"],
              live: { customerIds: [] },
            }),
          }),
        ],
        proposals: [],
      }),
    );

    const menu = await rowMenu("Fictional Customer");

    expect(removeItem(menu).hasAttribute("data-disabled")).toBe(false);
  });

  it("is offered once the only project naming it is drafted to be removed", async () => {
    await openPage(
      customersAt(),
      plan({
        projects: [project({ draft: recordDraft({ action: "deleted" }) })],
        proposals: [],
      }),
    );

    const menu = await rowMenu("Fictional Customer");

    expect(removeItem(menu).hasAttribute("data-disabled")).toBe(false);
    expect(within(menu).queryByText(/names this customer/u)).toBeNull();
  });
});

describe("showing all a customer's features", () => {
  const featuresPage = (more = "") =>
    openPage(
      `/features?customer=${customerId}${more}`,
      { ...linked, canEditFeatures: true },
      answers,
      featureEditor,
    );

  const featureRows = () =>
    screen
      .getAllByRole("row")
      .map(
        ({ textContent }) =>
          /Fictional (Direct|Needed|Proposed|Elsewhere)/u.exec(
            textContent,
          )?.[0],
      )
      .filter((name) => name !== undefined);

  it("opens Features with the customer's filter from its row's menu", async () => {
    const { history } = await openPage(customersAt(), linked, answers, editor);

    await chooseFrom(await rowMenu("Fictional Customer"), "Show all features");

    await waitFor(() => {
      expect(history.location.pathname).toBe("/features");
    });
    expect(new URLSearchParams(history.location.search).get("customer")).toBe(
      customerId,
    );
    expect(await screen.findByText("For Fictional Customer")).toBeTruthy();
  });

  it("shows the features naming the customer, needed by its projects and proposed by its proposals", async () => {
    await featuresPage();

    await waitFor(() => {
      expect(featureRows()).toEqual([
        "Fictional Proposed",
        "Fictional Direct",
        "Fictional Needed",
      ]);
    });
    expect(screen.getByText("3 of 4")).toBeTruthy();
  });

  it.each([
    [
      "beside live",
      "",
      ["Fictional Proposed", "Fictional Direct", "Fictional Needed"],
    ],
    [
      "not under Live only",
      "&show=live",
      ["Fictional Proposed", "Fictional Direct"],
    ],
  ])(
    "keeps a feature a draft gives the customer's project %s",
    async (_, show, shown) => {
      await openPage(
        `/features?customer=${customerId}${show}`,
        {
          ...linked,
          projects: [
            project({
              featureIds: [needed.id],
              draft: recordDraft({
                changed: ["featureIds"],
                live: { featureIds: [] },
              }),
            }),
          ],
          canEditFeatures: true,
        },
        answers,
        featureEditor,
      );

      await waitFor(() => {
        expect(featureRows()).toEqual(shown);
      });
    },
  );

  it("is narrowed further by the columns' filters", async () => {
    await featuresPage(
      `&filters=${encoded({ customerIds: { any: [customerId] } })}`,
    );

    await waitFor(() => {
      expect(featureRows()).toEqual(["Fictional Direct"]);
    });
    expect(screen.getByText("For Fictional Customer")).toBeTruthy();
  });

  it("is taken away by its pill's ×", async () => {
    const { history } = await featuresPage();
    await screen.findByText("For Fictional Customer");

    await userEvent.click(
      screen.getByRole("button", {
        name: "Remove filter: For Fictional Customer",
      }),
    );

    await waitFor(() => {
      expect(featureRows()).toHaveLength(4);
    });
    expect(screen.queryByText("For Fictional Customer")).toBeNull();
    expect(history.location.search).not.toContain("customer");
  });

  it("names it in what a saved view includes", async () => {
    await featuresPage();
    await screen.findByText("For Fictional Customer");

    await userEvent.click(screen.getByRole("button", { name: /^Views/u }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Save view…" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("For Fictional Customer")).toBeTruthy();
  });

  it("is left out for a customer the reader isn't sent", async () => {
    await openPage(
      `/features?customer=${unnamedCustomerId}`,
      { ...linked, customers: [], canEditFeatures: true },
      answers,
      featureEditor,
    );

    await waitFor(() => {
      expect(featureRows()).toHaveLength(4);
    });
    expect(screen.queryByText(/^For /u)).toBeNull();
  });
});
