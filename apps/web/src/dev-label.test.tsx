// SPDX-License-Identifier: Apache-2.0

// Tests of the development mode label naming the copy of the repository and the branch.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DevBadge, devLabel, devTitle } from "./dev-label.tsx";
import { testTheme } from "./test-support.tsx";

const label = { clone: "3", branch: "feat/fictional-branch" };

describe("the development mode label", () => {
  it("is absent outside development mode", () => {
    expect(devLabel).toBeNull();
  });

  it("starts the title with the clone number only in development mode", () => {
    expect(devTitle("Fathom", label)).toBe("[3] Fathom");
    expect(devTitle("Fathom", null)).toBe("Fathom");
  });

  it("names the clone and the branch only in development mode", () => {
    const { container, rerender } = render(
      <MantineProvider theme={testTheme}>
        <DevBadge label={label} />
      </MantineProvider>,
    );
    expect(
      screen.queryByText("Clone 3 · feat/fictional-branch"),
    ).not.toBeNull();

    rerender(<DevBadge label={null} />);
    expect(container.innerHTML).toBe("");
  });
});
