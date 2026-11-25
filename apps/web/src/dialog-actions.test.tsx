// SPDX-License-Identifier: Apache-2.0

// Tests for the modal a dialog that saves is shown in: closed by Escape, its close button or a
// click outside while idle, and by none of them while its dialog is saving.

import { Button, MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BusyModal } from "./dialog-actions.tsx";
import { testTheme } from "./test-support.tsx";

function renderModal({
  closeOnClickOutside,
}: { closeOnClickOutside?: boolean } = {}) {
  const onClose = vi.fn();
  render(
    <MantineProvider theme={testTheme}>
      <BusyModal
        opened
        onClose={onClose}
        title="Fictional dialog"
        {...(closeOnClickOutside === undefined ? {} : { closeOnClickOutside })}
      >
        {(onBusy, busy) => (
          <Button
            onClick={() => {
              onBusy(!busy);
            }}
          >
            {busy ? "Saving" : "Save"}
          </Button>
        )}
      </BusyModal>
    </MantineProvider>,
  );
  return onClose;
}

const overlay = () => {
  const found = document.querySelector(".mantine-Modal-overlay");
  if (found === null) throw new Error("The modal has no overlay.");
  return found;
};

describe("BusyModal", () => {
  it("closes by Escape, its close button or a click outside while idle", async () => {
    const onClose = renderModal();
    const dialog = await screen.findByRole("dialog", {
      name: "Fictional dialog",
    });
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close dialog" }),
    );
    fireEvent.click(overlay());
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("can't be closed while its dialog is saving", async () => {
    const onClose = renderModal();
    const dialog = await screen.findByRole("dialog", {
      name: "Fictional dialog",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      within(dialog).getByRole("button", { name: "Saving" }),
    ).toBeDefined();
    expect(
      within(dialog).queryByRole("button", { name: "Close dialog" }),
    ).toBeNull();
    await userEvent.keyboard("{Escape}");
    fireEvent.click(overlay());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes again once its dialog has finished saving", async () => {
    const onClose = renderModal();
    const dialog = await screen.findByRole("dialog", {
      name: "Fictional dialog",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Saving" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open on a click outside when its page asks, though idle", async () => {
    const onClose = renderModal({ closeOnClickOutside: false });
    const dialog = await screen.findByRole("dialog", {
      name: "Fictional dialog",
    });
    fireEvent.click(overlay());
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    expect(
      within(dialog).getByRole("button", { name: "Close dialog" }),
    ).toBeDefined();
  });
});
