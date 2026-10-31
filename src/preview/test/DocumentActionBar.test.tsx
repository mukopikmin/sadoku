import {
  act,
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DocumentActionBar", () => {
  it("reserves space for the measured bar height and follows wrapping changes", () => {
    const measurements = new Set<() => void>();
    vi.stubGlobal("ResizeObserver", class {
      constructor(readonly callback: ResizeObserverCallback) {}
      notify = () => this.callback([], this as unknown as ResizeObserver);
      observe(target: Element) {
        if (target.getAttribute("aria-label") === "Document actions") {
          measurements.add(this.notify);
        }
      }
      unobserve() {
        measurements.delete(this.notify);
      }
      disconnect() {
        measurements.delete(this.notify);
      }
    });
    const { unmount } = render(
      <DocumentActionBar
        memoryCount={0}
        onChangeView={() => {}}
        onOpenInstructions={() => {}}
        onOpenMemories={() => {}}
        onOpenRevisions={() => {}}
        onOpenTags={() => {}}
        staleCommentCount={0}
        tagCount={0}
        tags={[]}
        unresolvedCommentCount={0}
        view="preview"
      />,
    );
    const bar = screen.getByRole("dialog", { name: "Document actions" });
    const spacer = screen.getByTestId("action-bar-spacer");
    let height = 56;
    vi.spyOn(bar, "getBoundingClientRect").mockImplementation(() =>
      new DOMRect(0, 0, 420, height)
    );
    expect(measurements.size).toBeGreaterThan(0);
    for (const nextHeight of [56, 112, 148, 56]) {
      height = nextHeight;
      act(() => measurements.forEach((notify) => notify()));
      expect(getComputedStyle(spacer).height).toBe(`${height}px`);
    }
    unmount();
    expect(measurements.size).toBe(0);
  });

  it("keeps the view switch and shared actions available in both views", async () => {
    const Actions = () => {
      const [view, setView] = useState<PreviewView>("preview");
      return (
        <DocumentActionBar
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
    const actions = within(actionBar).getAllByRole("button");
    expect(within(actionBar).getByRole("button", { name: "Revisions" }))
      .not.toBeNull();
    expect(
      within(actionBar).queryByRole("button", { name: "Table of contents" }),
    )
      .toBeNull();
    expect(preview.getAttribute("aria-selected")).toBe("true");
    const previewPanel = document.getElementById(
      preview.getAttribute("aria-controls")!,
    );
    expect(previewPanel?.getAttribute("aria-labelledby")).toBe(preview.id);
    expect(preview.textContent).toBe("");
    expect(comments.textContent).toBe("2");
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
    expect(within(actionBar).getAllByRole("button")).toEqual(actions);
    const commentsPanel = document.getElementById(
      comments.getAttribute("aria-controls")!,
    );
    expect(commentsPanel?.getAttribute("aria-labelledby")).toBe(comments.id);

    fireEvent.click(preview);
    await waitFor(() =>
      expect(preview.getAttribute("aria-selected")).toBe("true")
    );
    expect(within(actionBar).getAllByRole("button")).toEqual(actions);
  });

  it("describes document tags and opens the editor", async () => {
    const onOpenTags = vi.fn();
    const { rerender } = render(
      <DocumentActionBar
        onChangeView={() => {}}
        staleCommentCount={0}
        unresolvedCommentCount={0}
        view="preview"
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
    expect(comments.textContent).toBe("");
    expect(comments.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(within(comments).queryByRole("img")).toBeNull();
    expect(tagsButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(tagsButton.textContent).toBe("2");
    expect(screen.getByRole("button", { name: "Instructions" }).textContent)
      .toBe("");
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
