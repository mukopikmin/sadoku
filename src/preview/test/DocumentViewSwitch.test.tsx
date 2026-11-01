import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { DocumentViewSwitch } from "../components/DocumentViewSwitch";
import type { PreviewView } from "../models/previewView";

afterEach(cleanup);

describe("DocumentViewSwitch", () => {
  it("switches views with accessible labels, badges, and tooltips", async () => {
    const Actions = () => {
      const [view, setView] = useState<PreviewView>("preview");
      return (
        <DocumentViewSwitch
          onChangeView={setView}
          staleCommentCount={1}
          unresolvedCommentCount={2}
          view={view}
        />
      );
    };
    render(<Actions />);

    const views = screen.getByRole("tablist", { name: "Preview views" });
    const preview = within(views).getByRole("tab", { name: "Preview" });
    const comments = within(views).getByRole("tab", {
      name: "Comments, 2 unresolved",
    });
    expect(preview.getAttribute("aria-selected")).toBe("true");
    const previewPanel = document.getElementById(
      preview.getAttribute("aria-controls")!,
    );
    expect(previewPanel?.getAttribute("aria-labelledby")).toBe(preview.id);
    expect(preview.textContent).toBe("Preview");
    expect(comments.textContent).toBe("Comments2");
    expect(within(comments).getByText("2")).not.toBeNull();
    expect(within(comments).getByRole("img", { name: "Stale comments: 1" }))
      .not.toBeNull();

    fireEvent.pointerEnter(preview);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Preview");
    fireEvent.pointerLeave(preview);
    fireEvent.pointerEnter(comments);
    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toBe(
        "Comments, 2 unresolved, 1 stale",
      )
    );
    fireEvent.pointerLeave(comments);

    fireEvent.click(comments);
    await waitFor(() =>
      expect(comments.getAttribute("aria-selected")).toBe("true")
    );
    const commentsPanel = document.getElementById(
      comments.getAttribute("aria-controls")!,
    );
    expect(commentsPanel?.getAttribute("aria-labelledby")).toBe(comments.id);

    fireEvent.click(preview);
    await waitFor(() =>
      expect(preview.getAttribute("aria-selected")).toBe("true")
    );
  });

  it("omits comment badges when there are no unresolved or stale comments", () => {
    render(
      <DocumentViewSwitch
        onChangeView={() => {}}
        staleCommentCount={0}
        unresolvedCommentCount={0}
        view="preview"
      />,
    );
    const comments = screen.getByRole("tab", {
      name: "Comments, 0 unresolved",
    });
    expect(comments.textContent).toBe("Comments");
    expect(comments.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(within(comments).queryByRole("img")).toBeNull();
  });
});
