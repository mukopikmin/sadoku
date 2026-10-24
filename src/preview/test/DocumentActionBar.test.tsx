import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { DocumentActionBar } from "../components/DocumentActionBar";
import type { PreviewView } from "../models/previewView";

afterEach(cleanup);

describe("DocumentActionBar", () => {
  it("keeps the view switch and shared actions available in both views", async () => {
    const Actions = () => {
      const [view, setView] = useState<PreviewView>("preview");
      return (
        <DocumentActionBar
          instructionCount={0}
          markdown="# Heading"
          memoryCount={0}
          onChangeView={setView}
          onOpenInstructions={() => {}}
          onOpenMemories={() => {}}
          onOpenRevisions={() => {}}
          onOpenTags={() => {}}
          staleCommentCount={1}
          tagCount={0}
          tags={[]}
          unresolvedCommentCount={2}
          view={view}
        />
      );
    };
    render(<Actions />);

    const actionBar = screen.getByRole("dialog", { name: "Document actions" });
    const views = within(actionBar).getByRole("tablist", {
      name: "Preview views",
    });
    const preview = within(views).getByRole("tab", { name: "Preview" });
    const comments = within(views).getByRole("tab", {
      name: "Comments, 2 unresolved",
    });
    expect(preview.getAttribute("aria-selected")).toBe("true");
    expect(within(comments).getByText("2")).not.toBeNull();
    expect(within(comments).getByRole("img", { name: "Stale comments: 1" }))
      .not.toBeNull();

    fireEvent.click(comments);
    await waitFor(() =>
      expect(comments.getAttribute("aria-selected")).toBe("true")
    );
    for (const name of ["Tags", "Instructions", "Memories"]) {
      expect(within(actionBar).getByRole("button", { name })).not.toBeNull();
    }
    for (
      const name of ["Table of contents", "Revisions"]
    ) {
      expect(within(actionBar).queryByRole("button", { name })).toBeNull();
    }

    fireEvent.click(preview);
    await waitFor(() =>
      expect(preview.getAttribute("aria-selected")).toBe("true")
    );
    for (
      const name of ["Table of contents", "Revisions"]
    ) {
      expect(within(actionBar).getByRole("button", { name })).not.toBeNull();
    }
  });

  it("describes document tags and opens the editor", async () => {
    const onOpenTags = vi.fn();
    const { rerender } = render(
      <DocumentActionBar
        onChangeView={() => {}}
        staleCommentCount={0}
        unresolvedCommentCount={0}
        view="preview"
        instructionCount={3}
        memoryCount={4}
        onOpenInstructions={() => {}}
        onOpenMemories={() => {}}
        onOpenRevisions={() => {}}
        onOpenTags={onOpenTags}
        tagCount={2}
        tags={[
          { backgroundColor: "#3182ce", id: 1, name: "reviewed" },
          { backgroundColor: "#38a169", id: 2, name: "documentation" },
        ]}
      />,
    );

    const tagsButton = screen.getByRole("button", { name: "Tags" });
    const comments = screen.getByRole("tab", {
      name: "Comments, 0 unresolved",
    });
    expect(comments.textContent).toBe("Comments");
    expect(within(comments).queryByRole("img")).toBeNull();
    expect(tagsButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(tagsButton.textContent).toBe("2");
    expect(screen.getByRole("button", { name: "Instructions" }).textContent)
      .toBe("3");
    expect(screen.getByRole("button", { name: "Memories" }).textContent).toBe(
      "4",
    );
    expect(screen.queryByText("Tags")).toBeNull();

    fireEvent.pointerEnter(tagsButton);
    await waitFor(() => {
      expect(screen.getByRole("tooltip").textContent).toBe("Tags");
      expect(screen.getByText("reviewed")).not.toBeNull();
      expect(screen.getByText("documentation")).not.toBeNull();
    });

    fireEvent.click(tagsButton);
    expect(onOpenTags).toHaveBeenCalledOnce();

    fireEvent.pointerLeave(tagsButton);
    rerender(
      <DocumentActionBar
        onChangeView={() => {}}
        staleCommentCount={0}
        unresolvedCommentCount={0}
        view="preview"
        instructionCount={0}
        memoryCount={0}
        onOpenInstructions={() => {}}
        onOpenMemories={() => {}}
        onOpenRevisions={() => {}}
        onOpenTags={onOpenTags}
        tagCount={0}
        tags={[]}
      />,
    );

    for (const name of ["Tags", "Instructions", "Memories"]) {
      const button = screen.getByRole("button", { name });
      expect(button.textContent).toBe("");
      expect(button.querySelector("svg")).not.toBeNull();
    }

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Tags" }));

    await waitFor(() => {
      expect(screen.getByText("No tags added.")).not.toBeNull();
    });
  });

  it("renders accessible icon actions with stable names, badges, and tooltips", async () => {
    const onOpenInstructions = vi.fn();
    const onOpenMemories = vi.fn();
    const onOpenRevisions = vi.fn();
    render(
      <DocumentActionBar
        onChangeView={() => {}}
        staleCommentCount={0}
        unresolvedCommentCount={0}
        view="preview"
        instructionCount={0}
        memoryCount={12}
        onOpenInstructions={onOpenInstructions}
        onOpenMemories={onOpenMemories}
        onOpenRevisions={onOpenRevisions}
        onOpenTags={() => {}}
        tagCount={0}
        tags={[]}
      />,
    );

    const instructions = screen.getByRole("button", { name: "Instructions" });
    const memories = screen.getByRole("button", { name: "Memories" });
    expect(screen.queryByRole("button", { name: /HTML comments/ })).toBeNull();
    expect(instructions.textContent).toBe("");
    expect(memories.textContent).toBe("12");
    expect(instructions.querySelector('svg[aria-hidden="true"]')).not
      .toBeNull();
    expect(memories.querySelector('svg[aria-hidden="true"]')).not.toBeNull();

    fireEvent.pointerEnter(memories);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Memories");
    fireEvent.pointerLeave(memories);
    fireEvent.click(instructions);
    fireEvent.click(memories);
    fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
    expect(onOpenInstructions).toHaveBeenCalledOnce();
    expect(onOpenMemories).toHaveBeenCalledOnce();
    expect(onOpenRevisions).toHaveBeenCalledOnce();
  });
});
