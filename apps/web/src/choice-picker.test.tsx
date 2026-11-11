// SPDX-License-Identifier: Apache-2.0

// Tests for picking choices in a cell: where several can be picked, a check marks each one picked,
// and Enter after picking one finishes; a choice's description shows under it and finds it; and a
// value that need not have a choice offers none first, which Enter never picks unasked.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChoicePicker } from "./choice-picker.tsx";
import { testTheme } from "./test-support.tsx";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
];

function renderPicker(
  multiple: boolean,
  onDone: (values: string[], finish: string) => void = () => undefined,
) {
  render(
    <MantineProvider theme={testTheme}>
      <ChoicePicker
        id="picker"
        label="Teams"
        options={options}
        multiple={multiple}
        initial={["b"]}
        typed=""
        onDone={onDone}
        onCancel={() => undefined}
      />
    </MantineProvider>,
  );
}

const checkOf = (label: string) =>
  screen.getByRole("option", { name: label }).querySelector("svg");

describe("picking choices", () => {
  it("checks each choice picked where several can be", () => {
    renderPicker(true);

    expect(checkOf("Beta")?.getAttribute("visibility")).toBe("visible");
    expect(checkOf("Alpha")?.getAttribute("visibility")).toBe("hidden");
  });

  it("shows no checks where one can be", () => {
    renderPicker(false);

    expect(checkOf("Beta")).toBeNull();
  });

  it.each([
    ["typed", "alp{Enter}{Enter}"],
    ["moved to", "{ArrowDown}{Enter}{Enter}"],
  ])(
    "finishes with Enter after picking the choice %s, where several can be",
    async (_, keys) => {
      const onDone = vi.fn();
      renderPicker(true, onDone);

      await userEvent.click(screen.getByLabelText("Teams"));
      await userEvent.keyboard(keys);

      expect(onDone).toHaveBeenCalledExactlyOnceWith(["a", "b"], "enter");
    },
  );
});

function renderOptional(
  onDone: (values: string[], finish: string) => void = () => undefined,
  multiple = false,
  initial = ["a"],
) {
  render(
    <MantineProvider theme={testTheme}>
      <ChoicePicker
        id="picker"
        label="Site"
        options={[
          { value: "a", label: "Alpha" },
          { value: "n", label: "Northmere", description: "The research site." },
        ]}
        none="No site"
        multiple={multiple}
        initial={initial}
        typed=""
        onDone={onDone}
        onCancel={() => undefined}
      />
    </MantineProvider>,
  );
}

const optionNames = () =>
  screen.getAllByRole("option").map(({ textContent }) => textContent);

describe("a choice's description", () => {
  it("shows under the choice's name", () => {
    renderOptional();

    expect(optionNames()).toContain("NorthmereThe research site.");
  });

  it("finds the choice when typed", async () => {
    renderOptional();

    await userEvent.type(screen.getByLabelText("Site"), "research");

    expect(optionNames()).toEqual(["NorthmereThe research site."]);
  });
});

describe("choosing none", () => {
  it("is offered first, and empties the value when picked", async () => {
    const onDone = vi.fn();
    renderOptional(onDone);

    expect(optionNames()[0]).toBe("No site");
    await userEvent.click(screen.getByRole("option", { name: "No site" }));

    expect(onDone).toHaveBeenCalledExactlyOnceWith([], "enter");
  });

  it("is not offered once something is typed, when the first match is picked with Enter", async () => {
    const onDone = vi.fn();
    renderOptional(onDone);

    await userEvent.type(screen.getByLabelText("Site"), "n{Enter}");

    expect(onDone).toHaveBeenCalledExactlyOnceWith(["n"], "enter");
  });

  it("is not offered where several can be picked", () => {
    renderOptional(undefined, true);

    expect(optionNames()).not.toContain("No site");
  });

  it("highlights nothing as the list opens, so Enter and Tab change nothing", async () => {
    const onDone = vi.fn();
    renderOptional(onDone, false, ["n"]);

    expect(
      screen
        .getAllByRole("option")
        .some((option) => option.hasAttribute("data-combobox-selected")),
    ).toBe(false);
    await userEvent.click(screen.getByLabelText("Site"));
    await userEvent.keyboard("{Enter}");

    expect(onDone).toHaveBeenCalledExactlyOnceWith(["n"], "enter");
  });

  it("goes with Down to the first choice after none", async () => {
    const onDone = vi.fn();
    renderOptional(onDone, false, ["n"]);

    await userEvent.click(screen.getByLabelText("Site"));
    await userEvent.keyboard("{ArrowDown}");

    expect(
      screen
        .getByRole("option", { name: "Alpha" })
        .hasAttribute("data-combobox-selected"),
    ).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(onDone).toHaveBeenCalledExactlyOnceWith(["a"], "enter");
  });
});
