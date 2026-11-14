// SPDX-License-Identifier: Apache-2.0

// Tests for what every page shares through the theme: each kind of drop-down list gives its options
// the class that keeps the keyboard's option grey, rather than filled with the accent, and every
// dialog's close button has a name.

import {
  Combobox,
  MantineProvider,
  Modal,
  Select,
  useCombobox,
} from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import comboboxClasses from "./combobox.module.css";
import { testTheme } from "./test-support.tsx";

function OpenList() {
  const store = useCombobox({ opened: true });
  return (
    <Combobox store={store} withinPortal={false}>
      <Combobox.Target>
        <input aria-label="List" />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options>
          <Combobox.Option value="a">Alpha</Combobox.Option>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

describe("the keyboard's option in a drop-down list", () => {
  it("takes the theme's class in a list built on Combobox", () => {
    render(
      <MantineProvider theme={testTheme}>
        <OpenList />
      </MantineProvider>,
    );

    expect(
      screen
        .getByRole("option", { name: "Alpha" })
        .classList.contains(comboboxClasses.option as string),
    ).toBe(true);
  });

  it("takes the theme's class in a Select", async () => {
    render(
      <MantineProvider theme={testTheme}>
        <Select label="Colour" data={["Alpha"]} />
      </MantineProvider>,
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Colour" }));

    expect(
      (await screen.findByRole("option", { name: "Alpha" })).classList.contains(
        comboboxClasses.option as string,
      ),
    ).toBe(true);
  });
});

describe("dialogs", () => {
  it("name their close button", async () => {
    render(
      <MantineProvider theme={testTheme}>
        <Modal opened onClose={() => undefined} title="Fictional dialog">
          Fictional text
        </Modal>
      </MantineProvider>,
    );

    expect(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Close",
      }),
    ).toBeDefined();
  });
});
