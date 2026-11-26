// SPDX-License-Identifier: Apache-2.0

// Tests for a role's grid of permissions, and the summary of what a role allows as it changes.

import { permissionDescriptions } from "@fathom/shared";
import { within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp, serverAnswers } from "./test-support.tsx";
import {
  setUpEachTest,
  roleEditor,
  auditors,
  roleList,
  openDialog,
  box,
  summaryLines,
} from "./test-roles-page.tsx";

setUpEachTest();

// A line of the summary, under one heading if given.
function summaryLine(
  dialog: HTMLElement,
  text: string,
  title?: string,
): HTMLElement {
  const summary = within(dialog).getByLabelText("What the role allows");
  const section =
    title === undefined
      ? summary
      : (within(summary).getByRole("heading", { name: title })
          .parentElement as HTMLElement);
  return within(section).getByText(text);
}

describe("the grid of permissions", () => {
  it("ticks, greys, and names a view that comes with editing the same area", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    expect(box(dialog, "View People").disabled).toBe(false);
    await userEvent.click(box(dialog, "Edit People"));
    const implied = box(dialog, "View People, which comes with Edit People");
    expect(implied.checked).toBe(true);
    expect(implied.disabled).toBe(true);
    await userEvent.click(box(dialog, "Edit People"));
    expect(box(dialog, "View People").checked).toBe(true);
    expect(box(dialog, "View People").disabled).toBe(false);
  });

  it("follows the areas with the data classes, General coming with each area", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("New role", "New role");
    const rows = within(dialog)
      .getAllByRole("row")
      .map((row) => row.textContent);
    expect(rows.slice(0, 1)).toEqual(["AreaViewApproveEdit"]);
    expect(rows.slice(-4)).toEqual([
      "Data classification",
      "General",
      "Personal",
      "Confidential",
    ]);
    for (const name of [
      "View General, which comes with each area",
      "Edit General, which comes with each area",
    ]) {
      expect(box(dialog, name).checked).toBe(true);
      expect(box(dialog, name).disabled).toBe(true);
    }
    expect(
      box(
        dialog,
        "View Personal details, which needs View People or View Feature teams",
      ).checked,
    ).toBe(false);
  });

  it("turns off a box that does nothing without others, and takes it away with them", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    expect(box(dialog, "Approve People").disabled).toBe(false);
    expect(box(dialog, "View Hiring plan").disabled).toBe(false);
    await userEvent.click(box(dialog, "View People"));
    for (const name of [
      "Approve People, which needs View People",
      "View Hiring plan, which needs View People",
      "View Personal details, which needs View People or View Feature teams",
    ]) {
      expect(box(dialog, name).checked).toBe(false);
      expect(box(dialog, name).disabled).toBe(true);
    }
    expect(within(dialog).queryByText(/does nothing without/)).toBeNull();
  });

  it("keeps a box a role was saved with without its needs, until it is unticked", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": () =>
        Response.json({
          roles: [
            { ...auditors, permissions: ["plan:view", "hiring-plan:view"] },
          ],
        }),
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    const hiring = box(dialog, "View Hiring plan");
    expect([hiring.checked, hiring.disabled]).toEqual([true, false]);
    await userEvent.click(box(dialog, "View Configuration"));
    expect(box(dialog, "View Hiring plan").checked).toBe(true);
    await userEvent.click(box(dialog, "View Hiring plan"));
    const waiting = box(dialog, "View Hiring plan, which needs View People");
    expect([waiting.checked, waiting.disabled]).toEqual([false, true]);
  });

  it("gives Classify data and Approve own drafts a box of their own, saying what each allows", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("New role", "New role");
    const classify = within(dialog).getByRole<HTMLInputElement>("checkbox", {
      name: "Classify data",
    });
    expect(classify.checked).toBe(false);
    expect(
      within(dialog).getByText(permissionDescriptions["data:classify"].allows),
    ).toBeDefined();
    await userEvent.click(box(dialog, "View Plan"));
    await userEvent.click(box(dialog, "Approve Plan"));
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Approve own drafts" }),
    );
    expect(
      within(dialog).getByRole<HTMLInputElement>("checkbox", {
        name: "Approve own drafts",
      }).checked,
    ).toBe(true);
  });
});

describe("the summary of what a role allows", () => {
  it("lists the pages its holders do not see, and what they cannot do", async () => {
    // Given
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog("New role", "New role");
    // Then
    expect(summaryLines(dialog, "Doesn't see")).toEqual(
      expect.arrayContaining(["Capacity", "People"]),
    );
    // When
    await userEvent.click(box(dialog, "Edit Allocations"));
    // Then
    expect(summaryLines(dialog, "Can")).toEqual(
      expect.arrayContaining([
        `New: ${permissionDescriptions["allocations:edit"].allows}`,
      ]),
    );
    expect(summaryLines(dialog, "Cannot")).toContain(
      permissionDescriptions["people:view"].without,
    );
    expect(summaryLines(dialog, "Doesn't see")).toContain("People");
  });

  it("says which pages its holders see and what they can and cannot do", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    expect(summaryLines(dialog, "Sees")).toEqual([
      "Projects",
      "People",
      "People on other dates",
      "Org chart",
      "Org chart on other dates",
      "Drafts",
      "Change history",
    ]);
    expect(summaryLines(dialog, "Doesn't see")).toEqual(
      expect.arrayContaining([
        "Org chart on future dates: needs Confidential",
        "Accounts",
      ]),
    );
    expect(summaryLines(dialog, "Can")).toEqual([
      permissionDescriptions["plan:view"].allows,
      permissionDescriptions["people:view"].allows,
      permissionDescriptions["personal:view"].allows,
    ]);
  });

  it("marks a class named in a line Fathom writes with the class's symbol", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    const line = summaryLines(dialog, "Doesn't see").indexOf(
      "Org chart on future dates: needs Confidential",
    );
    const summary = within(dialog).getByLabelText("What the role allows");
    const item = within(summary)
      .getByRole("heading", { name: "Doesn't see" })
      .parentElement?.querySelectorAll("li")
      .item(line);
    expect(item?.querySelector("[class*='classSymbol'] svg")).not.toBeNull();
    expect(item?.textContent).toBe(
      "Org chart on future dates: needs Confidential",
    );
  });

  it("marks lines added since the dialog opened, and keeps those taken away, struck through", async () => {
    // Given
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    // When
    await userEvent.click(box(dialog, "View People"));
    // Then
    expect(summaryLines(dialog, "Sees")).toEqual([
      "Projects",
      "No longer: People",
      "No longer: People on other dates",
      "No longer: Org chart",
      "No longer: Org chart on other dates",
      // Drafts and the change history stay, since viewing the plan opens them too.
      "Drafts",
      "Change history",
    ]);
    expect(summaryLines(dialog, "Can")).toEqual([
      permissionDescriptions["plan:view"].allows,
      `No longer: ${permissionDescriptions["people:view"].allows}`,
      `No longer: ${permissionDescriptions["personal:view"].allows}`,
    ]);
    expect(summaryLine(dialog, "People", "Sees").className).toMatch(/removed/);
    const cannot = permissionDescriptions["people:view"].without;
    expect(summaryLine(dialog, cannot).className).toMatch(/added/);
    // When the first line is taken away too, and others added
    await userEvent.click(box(dialog, "View Plan"));
    await userEvent.click(box(dialog, "View Configuration"));
    // Then
    expect(summaryLines(dialog, "Sees")).toEqual([
      "No longer: Projects",
      "No longer: People",
      "No longer: People on other dates",
      "No longer: Org chart",
      "No longer: Org chart on other dates",
      // Releases, Drafts and the change history stay, since configuration opens them too, and
      // Capacity and Lists open with it.
      "New: Releases",
      "New: Capacity",
      "New: Lists",
      "Drafts",
      "Change history",
    ]);
    expect(summaryLine(dialog, "Releases", "Sees").className).toMatch(/added/);
    expect(summaryLine(dialog, "Drafts", "Sees").className).not.toMatch(
      /added/,
    );
    // When the role grants again what it did when the dialog opened
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reset" }),
    );
    // Then
    expect(within(dialog).queryByText("No longer:")).toBeNull();
    expect(summaryLine(dialog, "People", "Sees").className).not.toMatch(
      /removed/,
    );
    expect(
      within(dialog).getByRole("button", { name: "Reset" }),
    ).toHaveProperty("disabled", true);
  });

  it("reads Nothing once the role sees no page, marked as added", async () => {
    serverAnswers({
      "GET /api/session": roleEditor,
      "GET /api/roles": roleList,
    });
    renderApp("/roles");
    const dialog = await openDialog(
      "Edit Fictional Auditors",
      "Edit Fictional Auditors",
    );
    await userEvent.click(box(dialog, "View Plan"));
    await userEvent.click(box(dialog, "View People"));
    expect(summaryLines(dialog, "Sees").at(-1)).toBe("New: Nothing.");
    expect(summaryLine(dialog, "Nothing.").className).toMatch(/added/);
  });
});
