// SPDX-License-Identifier: Apache-2.0

// Tests for a control turned off with a line saying why, which describes the control to a screen
// reader, under a form's control or a menu's item alike.

import { Button, MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MenuNote } from "./draft-details.tsx";
import { useTurnedOff } from "./turned-off.tsx";
import { testTheme } from "./test-support.tsx";

const why = "Fictional Harbour needs a keeper";

function Control({
  reason,
  inMenu = false,
}: {
  reason: string | undefined;
  inMenu?: boolean;
}) {
  const { control, line } = useTurnedOff(reason, inMenu ? MenuNote : undefined);
  return (
    <MantineProvider theme={testTheme}>
      <Button {...control}>Retire</Button>
      {line}
    </MantineProvider>
  );
}

describe("a control turned off with its reason", () => {
  it("is turned off, with the reason in a line under it that describes it", () => {
    render(<Control reason={why} />);
    const button = screen.getByRole("button", {
      name: "Retire",
      description: why,
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(why)).toBeDefined();
  });

  it("is on, with no line and nothing describing it, without a reason", () => {
    render(<Control reason={undefined} />);
    const button = screen.getByRole("button", { name: "Retire" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.hasAttribute("aria-describedby")).toBe(false);
    expect(screen.queryByText(why)).toBeNull();
  });

  it("describes a menu's item with the menu's own note", () => {
    render(<Control reason={why} inMenu />);
    expect(
      screen.getByRole("button", { name: "Retire", description: why }),
    ).toBeDefined();
  });
});
