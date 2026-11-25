// SPDX-License-Identifier: Apache-2.0

// Tests for what a page shows in place of what it reads: the loader while it loads, why it could
// not be loaded with a way to try again, and nothing once it has loaded.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueryState } from "./load-problem.tsx";
import { testTheme } from "./test-support.tsx";

function renderState({ pending = false, failed = false }) {
  const onRetry = vi.fn();
  render(
    <MantineProvider theme={testTheme}>
      <QueryState
        pending={pending}
        failed={failed}
        what="the fictional records"
        onRetry={onRetry}
      />
    </MantineProvider>,
  );
  return onRetry;
}

describe("QueryState", () => {
  it("shows the loader while loading", () => {
    renderState({ pending: true });
    expect(screen.getByRole("status", { name: "Loading" })).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says what could not be loaded, and tries again when asked", async () => {
    const onRetry = renderState({ failed: true });
    expect(screen.getByRole("alert").textContent).toContain(
      "Fathom could not load the fictional records.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows nothing once loaded", () => {
    renderState({});
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
