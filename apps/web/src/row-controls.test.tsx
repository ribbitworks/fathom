// SPDX-License-Identifier: Apache-2.0

// Tests of the ⋯ every menu opens from: named by its label, opening its menu, and turned off while
// the menu can't be used.

import { MantineProvider, Menu } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { MoreButton } from "./row-controls.tsx";
import { testTheme } from "./test-support.tsx";

const renderInMenu = (button: ReactNode) =>
  render(
    <MantineProvider theme={testTheme}>
      <Menu>
        <Menu.Target>{button}</Menu.Target>
        <Menu.Dropdown>
          <Menu.Item>Fictional action</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </MantineProvider>,
  );

describe("MoreButton", () => {
  it("opens its menu, named by its label", async () => {
    renderInMenu(<MoreButton label="Drafts of Fictional List" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Drafts of Fictional List" }),
    );

    expect(
      await screen.findByRole("menuitem", { name: "Fictional action" }),
    ).toBeTruthy();
  });

  it("is turned off while its menu can't be used", () => {
    renderInMenu(<MoreButton label="Unpublished changes" disabled />);

    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Unpublished changes",
      }).disabled,
    ).toBe(true);
  });
});
