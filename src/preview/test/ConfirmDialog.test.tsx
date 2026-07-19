import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";

afterEach(() => cleanup());

const TestDialog = ({
  isPending = false,
  onConfirm = () => {},
}: {
  isPending?: boolean;
  onConfirm?: () => void | Promise<void>;
}) => {
  const [open, setOpen] = useState(true);

  return (
    <ConfirmDialog
      confirmColorPalette="red"
      confirmLabel="Continue"
      isPending={isPending}
      onConfirm={onConfirm}
      onOpenChange={setOpen}
      open={open}
      title="Continue action?"
    >
      Check the details before continuing.
    </ConfirmDialog>
  );
};

describe("ConfirmDialog", () => {
  it("renders an accessible dialog and focuses the safe action", async () => {
    render(<TestDialog />);

    const dialog = await screen.findByRole("alertdialog", {
      name: "Continue action?",
    });
    expect(within(dialog).getByText("Check the details before continuing."))
      .not.toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole("button", { name: "Cancel" }),
      )
    );
  });

  it("only confirms when the confirm action is selected", async () => {
    const onConfirm = vi.fn();
    render(<TestDialog onConfirm={onConfirm} />);
    let dialog = await screen.findByRole("alertdialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();

    cleanup();
    render(<TestDialog onConfirm={onConfirm} />);
    dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("prevents actions while confirmation is pending", async () => {
    const onConfirm = vi.fn();
    render(<TestDialog isPending onConfirm={onConfirm} />);
    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).getByRole("button", { name: "Cancel" }).hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    expect(
      within(dialog).getByRole("button", { name: "Continue" }).hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
