// SPDX-License-Identifier: Apache-2.0

// Tests for a list of records a record's own field holds, such as a project's customers, as a draft
// changes it: each record the draft adds or takes away marked on its own, in the table, its Live row
// and the record's details, in each Draft view, and the rest unmarked.

import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { featureDraft, recordCell, recordDraft } from "./test-support.tsx";
import {
  answers,
  customer,
  customerId,
  featurePlan,
  first,
  openPage,
  plan,
  project,
  projectId,
  second,
  sidePanel,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const betaId = "c0000000-0000-4000-8000-000000000002";
const gammaId = "c0000000-0000-4000-8000-000000000003";
const customers = [
  customer(),
  customer({ id: betaId, keyNumber: 2, name: "Fictional Beta" }),
  customer({ id: gammaId, keyNumber: 3, name: "Fictional Gamma" }),
];
const removalWaits = '[data-tip="Live. Its removal is waiting for approval."]';

// A project whose draft keeps Fictional Customer, adds Fictional Beta and takes away Fictional Gamma.
const changedCustomers = (state: "waiting" | "rejected" = "waiting") =>
  plan({
    customers,
    projects: [
      project({
        customerIds: [customerId, betaId],
        draft: recordDraft({
          action: "changed",
          state,
          changed: ["customerIds"],
          live: { customerIds: [customerId, gammaId] },
        }),
      }),
    ],
  });

const struck = (name: HTMLElement) =>
  name.closest('[class*="struck"]') !== null;
const customersCell = () => recordCell(projectId, "customerIds") as HTMLElement;

describe("a project's customers as its draft changes them, in the table", () => {
  it("marks the one added and the one taken away, and strikes that one through", async () => {
    await openPage("/projects", changedCustomers());
    const cell = customersCell();
    expect(within(cell).getAllByText(", added")).toHaveLength(1);
    expect(within(cell).getAllByText(", removed")).toHaveLength(1);
    expect(struck(within(cell).getByText("Fictional Gamma"))).toBe(true);
    expect(struck(within(cell).getByText("Fictional Beta"))).toBe(false);
  });

  it("leaves the one kept unmarked, the cell neither tinted nor read as changed as a whole", async () => {
    await openPage("/projects", changedCustomers());
    const cell = customersCell();
    expect(struck(within(cell).getByText("Fictional Customer"))).toBe(false);
    expect(cell.className).not.toContain("draftCell");
    expect(cell.textContent).not.toContain(", draft");
  });

  it("lists them as they are live in the Live row, giving the one taken away Live's dot", async () => {
    await openPage("/projects", changedCustomers());
    const liveRow = screen
      .getByRole("grid", { name: "Projects" })
      .querySelector('[class*="recordLiveRow"]') as HTMLElement;
    expect(liveRow.textContent).toContain(
      "Fictional Customer, Fictional Gamma, live",
    );
    expect(liveRow.querySelectorAll('[data-tip="Live"]')).toHaveLength(1);
  });

  it("shows them as they are live under Live only, with Live's dot for the waiting removal", async () => {
    await openPage("/projects?show=live", changedCustomers());
    const cell = customersCell();
    expect(cell.textContent).not.toContain("Fictional Beta");
    expect(cell.querySelector(removalWaits)).not.toBeNull();
  });

  it("leaves out a rejected addition with drafts applied", async () => {
    await openPage("/projects?show=drafts", changedCustomers("rejected"));
    expect(customersCell().textContent).not.toContain("Fictional Beta");
  });
});

describe("a project's customers as its draft changes them, in its details", () => {
  const openDetails = async (view = "") => {
    await openPage(`/projects?open=${projectId}${view}`, changedCustomers());
    await screen.findByRole("heading", { name: "Fictional Project" });
    return sidePanel();
  };

  it("marks the one added and the one taken away, with no Live line", async () => {
    const panel = await openDetails();
    expect(within(panel).getAllByText(", added")).toHaveLength(1);
    expect(within(panel).getAllByText(", removed")).toHaveLength(1);
    expect(struck(within(panel).getByText("Fictional Gamma"))).toBe(true);
    expect(struck(within(panel).getByText("Fictional Customer"))).toBe(false);
    expect(within(panel).queryAllByText(", live")).toEqual([]);
  });

  it("gives the waiting removal Live's dot under Live only, leaving out the one added", async () => {
    const panel = await openDetails("&show=live");
    expect(within(panel).queryByText("Fictional Beta")).toBeNull();
    expect(panel.querySelector(removalWaits)).not.toBeNull();
  });
});

describe("a new project's customers", () => {
  it("marks the cell as the rest of the new row, each customer unmarked", async () => {
    await openPage(
      "/projects",
      plan({
        customers,
        projects: [
          project({
            customerIds: [customerId, betaId],
            draft: recordDraft({ action: "created" }),
          }),
        ],
      }),
    );
    const cell = customersCell();
    expect(cell.className).toContain("draftCell");
    expect(recordCell(projectId, "name")?.className).toContain("draftCell");
    expect(within(cell).queryAllByText(", added")).toEqual([]);
  });
});

describe("other lists of records", () => {
  it("marks a feature a project's draft adds to its Features", async () => {
    await openPage(
      "/projects",
      plan({
        features: [first, second],
        projects: [
          project({
            featureIds: [first.id, second.id],
            draft: recordDraft({
              action: "changed",
              changed: ["featureIds"],
              live: { featureIds: [first.id] },
            }),
          }),
        ],
      }),
    );
    const cell = recordCell(projectId, "featureIds") as HTMLElement;
    expect(within(cell).getAllByText(", added")).toHaveLength(1);
    expect(cell.textContent).toContain(
      "Fictional First, Fictional Second, added",
    );
  });

  it("marks a customer a feature's draft takes from its Customers on Features", async () => {
    await openPage(
      "/features",
      featurePlan({
        customers,
        features: [
          {
            ...first,
            customerIds: [customerId],
            draft: featureDraft({
              changed: ["customerIds"],
              live: { customerIds: [customerId, gammaId] },
            }),
          },
        ],
      }),
      answers,
      ["plan:view", "features:view", "features:edit"],
    );
    const cell = recordCell(first.id, "customerIds") as HTMLElement;
    expect(within(cell).getAllByText(", removed")).toHaveLength(1);
    expect(struck(within(cell).getByText("Fictional Customer"))).toBe(false);
  });
});
