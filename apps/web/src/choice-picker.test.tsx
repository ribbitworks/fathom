// SPDX-License-Identifier: Apache-2.0

// Tests for picking choices in a cell: where several can be picked, a check marks each one picked,
// and Enter after picking one finishes.

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
