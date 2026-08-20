import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  afterEach(cleanup);
  it("renders nothing when open is false", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Delete Item"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("renders title, message, and buttons when open is true", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Move to Trash"
        message="Are you sure you want to move this note to trash?"
        confirmLabel="Move to Trash"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(screen.getByText("Move to Trash", { selector: "h3" })).toBeVisible();
    expect(
      screen.getByText("Are you sure you want to move this note to trash?")
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Move to Trash" }));
    expect(onConfirm).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("closes on Escape key press", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete Item"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("focuses Cancel and traps focus for destructive actions", async () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete Item"
        message="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    await waitFor(() => expect(cancel).toHaveFocus());
    confirm.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(cancel).toHaveFocus();
  });
});
