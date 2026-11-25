// SPDX-License-Identifier: Apache-2.0

// A control turned off for a change the server would refuse, with a short dimmed line saying why,
// which describes the control so a screen reader hears the reason with it. The page decides why; the
// line is placed where the control's layout wants it.

import { Text, type TextProps } from "@mantine/core";
import { type ComponentType, type ReactNode, useId } from "react";
import classes from "./turned-off.module.css";

export interface ReasonLineProps {
  id: string;
  children: ReactNode;
}

// The line under a form's control, placed as its control's layout wants.
export function ReasonLine({
  id,
  children,
  ...placed
}: ReasonLineProps & Pick<TextProps, "ta" | "className">) {
  return (
    <Text id={id} size="xs" c="dimmed" {...placed}>
      {children}
    </Text>
  );
}

// The line under a tick box, lined up with its label and description.
export function TickReasonLine(props: ReasonLineProps) {
  return <ReasonLine {...props} className={classes.underTick} />;
}

// The line under a control at the right of a row, ending under it.
export function RightReasonLine(props: ReasonLineProps) {
  return <ReasonLine {...props} ta="right" />;
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
