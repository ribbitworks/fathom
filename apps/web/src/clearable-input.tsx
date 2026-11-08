// SPDX-License-Identifier: Apache-2.0

// A text field that shows an × to empty it while it holds any text, as Fathom's text fields do.
// Pressing the × keeps focus in the field, so a field that saves when left is not left by it.

import { Input, TextInput, type TextInputProps } from "@mantine/core";

export function ClearableInput({
  value,
  onClear,
  clearLabel,
  ...props
}: Omit<TextInputProps, "value" | "rightSection"> & {
  value: string;
  onClear: () => void;
  // What the × is called, such as "Clear the name".
  clearLabel: string;
}) {
  return (
    <TextInput
      {...props}
      value={value}
      rightSection={
        value === "" ? null : (
          <Input.ClearButton
            aria-label={clearLabel}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={onClear}
          />
        )
      }
    />
  );
}
