// SPDX-License-Identifier: Apache-2.0

// Tests for a record's short list in its details: each item a link, None when there are none, and
// the actions under it.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShortList } from "./short-list.tsx";
import { testTheme } from "./test-support.tsx";

const renderList = (
  items: readonly { id: string; name: string }[],
  onShow = vi.fn(),
  onAdd = vi.fn(),
) => {
  render(
    <MantineProvider theme={testTheme}>
      <ShortList
        items={items}
        noun="activities"
        onShow={onShow}
        actions={[{ label: "Add activity", onClick: onAdd }]}
      />
    </MantineProvider>,
  );
  return { onShow, onAdd };
};

describe("a short list", () => {
  it("opens an item from its link", async () => {
    const { onShow } = renderList([{ id: "a", name: "Fictional Migration" }]);
    await userEvent.click(
      screen.getByRole("button", { name: "Fictional Migration" }),
    );
    expect(onShow).toHaveBeenCalledWith("a");
    expect(screen.queryByText("None")).toBeNull();
  });

  it("says None with no items, still offering its actions", async () => {
    const { onAdd } = renderList([]);
    const none = screen.getByText("None");
    // Nothing between None and the actions, which would double the gap under it.
    expect(
      none.nextElementSibling?.contains(
        screen.getByRole("button", { name: "Add activity" }),
      ),
    ).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Add activity" }));
    expect(onAdd).toHaveBeenCalled();
  });
});
