// SPDX-License-Identifier: Apache-2.0

// Tests for a private page's ⋯ drawn on its own, outside the layout that renames and removes pages.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PageMenu } from "./page-menu.tsx";
import { testTheme } from "./test-support.tsx";

describe("a page's ⋯ outside the layout", () => {
  it("opens no dialog, as nothing there renames or removes a page", async () => {
    render(
      <MantineProvider theme={testTheme}>
        <PageMenu page={{ id: "p1", name: "Follow-ups", key: null }} />
      </MantineProvider>,
    );
    for (const item of ["Rename page…", "Remove page…"]) {
      await userEvent.click(
        screen.getByRole("button", { name: "Actions for Follow-ups" }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: item }),
      );
    }
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
