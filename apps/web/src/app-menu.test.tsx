// SPDX-License-Identifier: Apache-2.0

// Tests for Fathom's menus: a click on a menu's title or empty space closes it, and a click on one
// of its fields does not.

import { MantineProvider, Menu, TextInput } from "@mantine/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppMenu } from "./app-menu.tsx";

describe("a menu", () => {
  it("closes on a click on its title, but not on a field in it", async () => {
    render(
      <MantineProvider>
        <AppMenu hideDetached={false}>
          <AppMenu.Target>
            <button type="button">Open</button>
          </AppMenu.Target>
          <AppMenu.Dropdown>
            <Menu.Label>Fictional title</Menu.Label>
            <TextInput label="Fictional field" />
          </AppMenu.Dropdown>
        </AppMenu>
      </MantineProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const menu = await screen.findByRole("menu");
    await userEvent.click(within(menu).getByRole("textbox"));
    expect(screen.getByRole("menu")).toBeDefined();
    await userEvent.click(within(menu).getByText("Fictional title"));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  it("leaves a menu that keeps its own open state to close itself", async () => {
    render(
      <MantineProvider>
        <Menu opened hideDetached={false}>
          <Menu.Target>
            <button type="button">Open</button>
          </Menu.Target>
          <AppMenu.Dropdown>
            <Menu.Label>Fictional title</Menu.Label>
          </AppMenu.Dropdown>
        </Menu>
      </MantineProvider>,
    );
    await userEvent.click(await screen.findByText("Fictional title"));
    expect(screen.getByRole("menu")).toBeDefined();
  });
});
