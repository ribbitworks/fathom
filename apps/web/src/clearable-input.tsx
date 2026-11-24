// SPDX-License-Identifier: Apache-2.0

// A text field that shows an × to empty it while it holds any text, as Fathom's text fields do.

import { Input, TextInput, type TextInputProps } from "@mantine/core";
import { useRef } from "react";

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
  const field = useRef<HTMLInputElement>(null);
  return (
    <TextInput
      {...props}
      ref={field}
      value={value}
      rightSection={
        value === "" ? null : (
          <Input.ClearButton
            aria-label={clearLabel}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              onClear();
              // Focus goes to the field even from elsewhere, such as a form's title, so leaving it
              // checks the emptied value as any other edit is checked.
              field.current?.focus();
            }}
          />
        )
      }
    />
  );
}
