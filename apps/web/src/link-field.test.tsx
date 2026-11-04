// SPDX-License-Identifier: Apache-2.0

// Tests for a web link's cell and menu item, and the form that edits it, from the keyboard and the
// mouse. Which addresses Fathom accepts is tested in the shared package's links.test.ts, and the
// People table's web link columns in people-links.test.tsx.

import { addressProblem, type Link } from "@fathom/shared";
import { MantineProvider, Menu } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LinkCell, LinkEditor, LinkMenuItem } from "./link-field.tsx";

const web = "https://proposals.example.test/P-1";
const proposal = { address: web, text: "P-1 proposal" };

describe("a link's cell", () => {
  const cell = (link: Link) =>
    render(
      <MantineProvider>
        <div role="gridcell" tabIndex={-1}>
          <LinkCell link={link} />
        </div>
      </MantineProvider>,
    );

  it("opens the address in a new tab, without telling the site where it was opened from", () => {
    cell(proposal);
    const link = screen.getByRole("link", { name: "P-1 proposal" });
    expect(link.getAttribute("href")).toBe(web);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("title")).toBe(web);
  });

  it("leaves focus on its cell when clicked, so the table's keys still work", () => {
    cell(proposal);
    fireEvent.click(screen.getByRole("link", { name: "P-1 proposal" }));
    expect(document.activeElement).toBe(screen.getByRole("gridcell"));
  });

  it("shows an address Fathom does not accept as plain text, never as a link", () => {
    cell({ address: "javascript:alert(1)", text: "Click me" });
    expect(screen.getByText("Click me").getAttribute("title")).toBe(
      "javascript:alert(1)",
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("a link's menu item", () => {
  const menu = (link: Link) =>
    render(
      <MantineProvider>
        <Menu opened>
          <Menu.Target>
            <button type="button">Actions</button>
          </Menu.Target>
          <Menu.Dropdown>
            <LinkMenuItem name="Proposal" link={link} />
          </Menu.Dropdown>
        </Menu>
      </MantineProvider>,
    );

  it("opens the address in a new tab", () => {
    menu(proposal);
    const item = screen.getByRole("menuitem", { name: "Open Proposal" });
    expect(item.getAttribute("href")).toBe(web);
    expect(item.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("is not offered for an address Fathom does not accept", () => {
    menu({ address: "javascript:alert(1)", text: "" });
    expect(screen.queryByRole("menuitem")).toBeNull();
  });
});

describe("editing a link", () => {
  // Edits the link given, or none when given null.
  function edit({
    initial = proposal,
    typed,
  }: { initial?: Link | null; typed?: string } = {}) {
    const onDone = vi.fn();
    const onCancel = vi.fn();
    render(
      <MantineProvider>
        <button type="button">Elsewhere</button>
        <LinkEditor
          id="editor"
          name="Proposal"
          initial={initial ?? undefined}
          typed={typed}
          onDone={onDone}
          onCancel={onCancel}
        />
      </MantineProvider>,
    );
    const address = screen.getByRole("textbox", { name: "Address" });
    const text = screen.getByRole("textbox", { name: /Text to show/ });
    return { onDone, onCancel, address, text };
  }
  const editEmpty = (typed?: string) =>
    edit({ initial: null, ...(typed === undefined ? {} : { typed }) });

  it("saves the address and text with Enter, trimmed", async () => {
    const { onDone, text } = edit();
    await userEvent.clear(text);
    await userEvent.type(text, "  Proposal one {Enter}");
    expect(onDone).toHaveBeenCalledWith(
      { address: web, text: "Proposal one" },
      "enter",
    );
  });

  it("starts the address with what was typed, and saves from its button", async () => {
    const { onDone, address } = editEmpty("h");
    expect((address as HTMLInputElement).value).toBe("h");
    await userEvent.type(address, "ttp://wiki/P-9");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onDone).toHaveBeenCalledWith(
      { address: "http://wiki/P-9", text: "" },
      "enter",
    );
  });

  it("does not judge an address while it is typed", async () => {
    const { address } = editEmpty();
    await userEvent.type(address, "proposals/P-1");
    expect(screen.queryByText(addressProblem)).toBeNull();
  });

  it("shows a refused address once it is left", async () => {
    const { address } = editEmpty();
    await userEvent.type(address, "proposals/P-1");
    await userEvent.tab();
    expect(screen.getByText(addressProblem)).toBeDefined();
    expect(address.getAttribute("aria-invalid")).toBe("true");
  });

  it("stays open rather than save a refused address", async () => {
    const { onDone, address } = editEmpty();
    await userEvent.type(address, "proposals/P-1{Enter}");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("adds https:// to a web address typed without it", async () => {
    const { onDone, address } = editEmpty();
    await userEvent.type(address, "www.example.com/news?page=2");
    await userEvent.tab();
    await userEvent.keyboard("Example news{Enter}");
    expect(onDone).toHaveBeenCalledWith(
      { address: "https://www.example.com/news?page=2", text: "Example news" },
      "enter",
    );
  });

  it("judges nothing when an empty address is left", async () => {
    const { address, text } = editEmpty();
    await userEvent.click(address);
    await userEvent.click(text);
    expect(screen.queryByText("Enter the address")).toBeNull();
  });

  it("asks for an address when only text is given, once saving is tried", async () => {
    const { onDone, text } = editEmpty();
    await userEvent.type(text, "Only text{Enter}");
    expect(screen.getByText("Enter the address")).toBeDefined();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("refuses text too long", async () => {
    const { onDone, text } = edit();
    fireEvent.change(text, { target: { value: "x".repeat(201) } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByText("The text is too long; use at most 200 characters"),
    ).toBeDefined();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("clears the link when both fields are emptied", async () => {
    const { onDone, address, text } = edit();
    await userEvent.clear(address);
    await userEvent.clear(text);
    await userEvent.keyboard("{Enter}");
    expect(onDone).toHaveBeenCalledWith(null, "enter");
  });

  it("moves from the address to the text with Tab", async () => {
    const { onDone, address, text } = edit();
    await waitFor(() => {
      expect(document.activeElement).toBe(address);
    });
    await userEvent.tab();
    expect(document.activeElement).toBe(text);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("saves and moves on to the next cell with Tab from the text", async () => {
    const { onDone, address } = edit();
    await waitFor(() => {
      expect(document.activeElement).toBe(address);
    });
    await userEvent.tab();
    await userEvent.tab();
    expect(onDone).toHaveBeenCalledWith(proposal, "next");
  });

  it("saves and moves back to the cell before with Shift+Tab from the address", async () => {
    const { onDone, address } = edit();
    address.focus();
    await userEvent.tab({ shift: true });
    expect(onDone).toHaveBeenCalledWith(proposal, "previous");
  });

  it("cancels with Esc", async () => {
    const { onCancel, address } = edit();
    address.focus();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("cancels with its button", async () => {
    const { onCancel } = edit();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("saves when clicked away from", () => {
    const { onDone } = edit();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Elsewhere" }));
    expect(onDone).toHaveBeenCalledWith(proposal, "leave");
  });
});
