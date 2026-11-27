// SPDX-License-Identifier: Apache-2.0

// A text field that shows an × to empty it while it holds any text, as Fathom's text fields do.

import { Group, Input, TextInput, type TextInputProps } from "@mantine/core";
import { type ReactNode, useRef } from "react";

// Room for the ×, and for what comes before it, such as a count of characters.
const clearWidth = 28;
const besideWidth = 44;

export function ClearableInput({
  value,
  onClear,
  clearLabel,
  beside,
  ...props
}: Omit<TextInputProps, "value" | "rightSection" | "rightSectionWidth"> & {
  value: string;
  onClear: () => void;
  // What the × is called, such as "Clear the name".
  clearLabel: string;
  // Shown before the ×, such as a count of characters near the field's limit.
  beside?: ReactNode;
}) {
  const field = useRef<HTMLInputElement>(null);
  const clear =
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
    );
  const besideShown = beside !== undefined && beside !== null;
  return (
    <TextInput
      {...props}
      ref={field}
      value={value}
      rightSection={
        besideShown ? (
          <Group gap={4} wrap="nowrap" justify="flex-end">
            {beside}
            {clear}
          </Group>
        ) : (
          clear
        )
      }
      {...(besideShown ? { rightSectionWidth: besideWidth + clearWidth } : {})}
    />
  );
}
