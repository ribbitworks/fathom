// SPDX-License-Identifier: Apache-2.0

// Tests for the Projects page's own New forms, against a simulated server: adding by Enter or Add,
// and a value refused, with the reason under the field it is about, focus in it, and nothing added.

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { newButton, openPage, plan, sent } from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

// What a field's description and error under it say, as screen readers read them with it.
const saidUnder = (field: HTMLElement) =>
  (field.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

const name = () =>
  screen.getByRole<HTMLInputElement>("textbox", { name: "Name" });

describe("a value refused in a page's New form", () => {
  it.each([
    ["customer", "customers", "Another customer has that name"],
    ["project", "projects", "Another project has that name"],
  ])(
    "names the server's refusal of a new %s under Name, with focus in it, not in a notification",
    async (one, tab, reason) => {
      await openPage(`/projects?tab=${tab}`, plan(), {
        [`POST /api/${tab}`]: () =>
          Response.json({ error: reason, field: "name" }, { status: 409 }),
      });
      await userEvent.click(await newButton(one));
      await userEvent.type(name(), "Crane Control");
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() => {
        expect(saidUnder(name())).toContain(reason);
      });
      expect([
        name().value,
        name().getAttribute("aria-invalid"),
        document.activeElement,
        screen.getAllByText(reason).length,
      ]).toEqual(["Crane Control", "true", name(), 1]);
    },
  );

  it("refuses a name emptied with its ×, with the reason under it, and adds nothing", async () => {
    const { fetch } = await openPage("/projects?tab=customers", plan());
    await userEvent.click(await newButton("customer"));
    await userEvent.type(name(), "Zeta Depot");
    await userEvent.click(screen.getByRole("button", { name: "Clear Name" }));
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(document.activeElement).toBe(name());
    });
    expect([
      name().value,
      name().getAttribute("aria-invalid"),
      saidUnder(name()),
      sent(fetch, "POST /api/customers"),
    ]).toEqual(["", "true", expect.stringContaining("Name needed"), []]);
  });

  it.each(["Add", "Cancel"])(
    "keeps focus in the field while %s is pressed, so leaving it moves nothing before the click",
    async (label) => {
      await openPage("/projects?tab=customers", plan());
      await userEvent.click(await newButton("customer"));
      await userEvent.type(name(), "Zeta Depot");
      await userEvent.pointer({
        keys: "[MouseLeft>]",
        target: screen.getByRole("button", { name: label }),
      });
      expect(document.activeElement).toBe(name());
    },
  );

  it("puts focus back in the field left when Cancel's question is answered Keep adding", async () => {
    await openPage("/projects?tab=customers", plan());
    await userEvent.click(await newButton("customer"));
    await userEvent.type(name(), "Zeta Depot");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Keep adding" }),
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(name());
    });
  });

  it("names a refusal about no field of the form in a notification", async () => {
    const reason = "Someone else saved a change at the same moment. Try again.";
    await openPage("/projects?tab=customers", plan(), {
      "POST /api/customers": () =>
        Response.json({ error: reason }, { status: 409 }),
    });
    await userEvent.click(await newButton("customer"));
    await userEvent.type(name(), "Zeta Depot");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(reason)).toBeTruthy();
    expect([saidUnder(name()), name().getAttribute("aria-invalid")]).toEqual([
      "",
      null,
    ]);
  });

  it("adds the name still being typed at the first click on Add", async () => {
    const { fetch } = await openPage("/projects?tab=customers", plan());
    await userEvent.click(await newButton("customer"));
    await userEvent.type(name(), "Zeta Depot");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(sent(fetch, "POST /api/customers")).toEqual([
        { records: [{ name: "Zeta Depot", description: "", note: null }] },
      ]);
    });
  });

  it("adds from the keyboard, with focus on Add", async () => {
    const { fetch } = await openPage("/projects?tab=customers", plan());
    await userEvent.click(await newButton("customer"));
    await userEvent.type(name(), "Zeta Depot");
    screen.getByRole("button", { name: "Add" }).focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(sent(fetch, "POST /api/customers")).toEqual([
        { records: [{ name: "Zeta Depot", description: "", note: null }] },
      ]);
    });
  });
});

describe("Enter in a page's New form", () => {
  it.each([
    ["customer", "customers"],
    ["proposal", "proposals"],
  ])("adds the new %s from its Name", async (one, tab) => {
    const { fetch } = await openPage(`/projects?tab=${tab}`, plan());
    await userEvent.click(await newButton(one));
    await userEvent.type(name(), "Zeta Depot{Enter}");
    await waitFor(() => {
      expect(sent(fetch, `POST /api/${tab}`)).toEqual([
        { records: [expect.objectContaining({ name: "Zeta Depot" })] },
      ]);
    });
  });

  it("refuses an emptied Name, as Add does, and adds nothing", async () => {
    const { fetch } = await openPage("/projects?tab=customers", plan());
    await userEvent.click(await newButton("customer"));
    await userEvent.type(name(), "Zeta Depot");
    await userEvent.click(screen.getByRole("button", { name: "Clear Name" }));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(saidUnder(name())).toContain("Name needed");
    });
    expect([
      document.activeElement,
      sent(fetch, "POST /api/customers"),
    ]).toEqual([name(), []]);
  });
});
