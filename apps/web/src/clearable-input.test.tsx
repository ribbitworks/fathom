// SPDX-License-Identifier: Apache-2.0

// Tests for a text field with an × to empty it: shown only while there is text, and keeping focus in
// the field when pressed.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ClearableInput } from "./clearable-input.tsx";
import { testTheme } from "./test-support.tsx";

function Field({ start, onClear }: { start: string; onClear: () => void }) {
  const [text, setText] = useState(start);
  return (
    <ClearableInput
      aria-label="Name"
      clearLabel="Clear Name"
      value={text}
      onChange={(event) => {
        setText(event.currentTarget.value);
      }}
      onClear={() => {
        onClear();
        setText("");
      }}
    />
  );
}

const field = (start: string, onClear = vi.fn()) => {
  render(
    <MantineProvider theme={testTheme}>
      <Field start={start} onClear={onClear} />
    </MantineProvider>,
  );
  return screen.getByRole("textbox", { name: "Name" });
};

describe("a clearable field", () => {
  it("offers no × while it is empty", () => {
    field("");
    expect(screen.queryByRole("button", { name: "Clear Name" })).toBeNull();
  });

  it("offers the × once text is typed", async () => {
    await userEvent.type(field(""), "Fictional");
    expect(screen.getByRole("button", { name: "Clear Name" })).toBeDefined();
  });

  it("empties itself with the ×, keeping focus in the field", async () => {
    // Given a field holding text, with focus in it
    const onClear = vi.fn();
    const input = field("Fictional", onClear);
    await userEvent.click(input);
    // When the × is pressed
    await userEvent.click(screen.getByRole("button", { name: "Clear Name" }));
    // Then it is cleared, the × goes, and focus stays in the field
    expect(onClear).toHaveBeenCalledOnce();
    expect(input).toHaveProperty("value", "");
    expect(screen.queryByRole("button", { name: "Clear Name" })).toBeNull();
    expect(document.activeElement).toBe(input);
  });
});
