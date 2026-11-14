// SPDX-License-Identifier: Apache-2.0

// Tests for what every page shares through the theme: each kind of drop-down list gives its options
// the class that keeps the keyboard's option grey, rather than filled with the accent, a Select's
// search finds options whatever their accents, and every dialog's close button has a name.

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

describe("a Select's search", () => {
  const optionNames = async () =>
    (await screen.findAllByRole("option")).map(
      ({ textContent }) => textContent,
    );

  it("finds options whatever their accents, and words in any order", async () => {
    render(
      <MantineProvider theme={testTheme}>
        <Select
          label="Person"
          searchable
          data={["Silje Holm-Schrøder", "José Fictional", "Avery Fictional"]}
        />
      </MantineProvider>,
    );

    await userEvent.type(
      screen.getByRole("combobox", { name: "Person" }),
      "schroder silje",
    );

    expect(await optionNames()).toEqual(["Silje Holm-Schrøder"]);
  });

  it("finds options within groups", async () => {
    render(
      <MantineProvider theme={testTheme}>
        <Select
          label="Find"
          searchable
          data={[
            { group: "People", items: ["José Fictional", "Avery Fictional"] },
            { group: "Teams", items: ["Jose's Fictional team"] },
          ]}
        />
      </MantineProvider>,
    );

    await userEvent.type(
      screen.getByRole("combobox", { name: "Find" }),
      "jose",
    );

    expect(await optionNames()).toEqual([
      "José Fictional",
      "Jose's Fictional team",
    ]);
  });
  it("shows no more options than its limit, within groups too", async () => {
    render(
      <MantineProvider theme={testTheme}>
        <Select
          label="Find"
          searchable
          limit={2}
          data={[
            { group: "People", items: ["José Fictional"] },
            {
              group: "Teams",
              items: ["Jose's Fictional team", "Jose's Fictional crew"],
            },
          ]}
        />
      </MantineProvider>,
    );

    await userEvent.type(
      screen.getByRole("combobox", { name: "Find" }),
      "jose",
    );

    expect(await optionNames()).toEqual([
      "José Fictional",
      "Jose's Fictional team",
    ]);
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
        name: "Close dialog",
      }),
    ).toBeDefined();
  });
});
