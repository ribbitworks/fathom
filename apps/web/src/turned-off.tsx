// SPDX-License-Identifier: Apache-2.0

// A control turned off, with the line saying why, which describes the control for screen readers.

import { Stack, Text, type TextProps } from "@mantine/core";
import { type ComponentType, type ReactNode, useId } from "react";

// The room between a control and its reason line, so the line reads as the control's.
const reasonGap = 2;

export interface ReasonLineProps {
  id: string;
  children: ReactNode;
}

// The line under a form's control, placed as its control's layout wants.
export function ReasonLine({
  id,
  children,
  ...placed
}: ReasonLineProps & Pick<TextProps, "ta">) {
  return (
    <Text id={id} size="xs" c="dimmed" {...placed}>
      {children}
    </Text>
  );
}

// The line above a table saying why a control in its page's heading is turned off, kept apart from
// the heading so the heading stays one line.
export function TableReasonLine({ id, children }: ReasonLineProps) {
  return (
    <Text id={id} size="sm" c="dimmed" mb="sm">
      {children}
    </Text>
  );
}

// The line under a control at the right of a row, ending under it.
export function RightReasonLine(props: ReasonLineProps) {
  return <ReasonLine {...props} ta="right" />;
}

// A control with its reason line under it, lined up at the start or the end of the control.
export function WithReason({
  align,
  children,
}: {
  align: "start" | "end";
  children: ReactNode;
}) {
  return (
    <Stack
      gap={reasonGap}
      align={align === "start" ? "flex-start" : "flex-end"}
    >
      {children}
    </Stack>
  );
}

export interface TurnedOffControl {
  disabled: boolean;
  "aria-describedby"?: string;
}

// The props that turn the control off and tie it to its line, and the line, or none while there is
// no reason.
export function useTurnedOff(
  reason: string | undefined,
  Line: ComponentType<ReasonLineProps> = ReasonLine,
): { control: TurnedOffControl; line: ReactNode } {
  const id = useId();
  if (reason === undefined) return { control: { disabled: false }, line: null };
  return {
    control: { disabled: true, "aria-describedby": id },
    line: <Line id={id}>{reason}</Line>,
  };
}
