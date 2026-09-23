import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentActionBar } from "../components/DocumentActionBar";

afterEach(cleanup);

describe("DocumentActionBar", () => {
  it("describes document tags and opens the editor", async () => {
    const onOpenTags = vi.fn();
    const { rerender } = render(
      <DocumentActionBar
        instructionCount={3}
        memoryCount={4}
        onOpenInstructions={() => {}}
        onOpenMemories={() => {}}
        onOpenTags={onOpenTags}
        onToggleHtmlComments={() => {}}
        showHtmlComments
        tagCount={2}
        tags={[
          { backgroundColor: "#3182ce", id: 1, name: "reviewed" },
          { backgroundColor: "#38a169", id: 2, name: "documentation" },
        ]}
      />,
    );

    const tagsButton = screen.getByRole("button", { name: "Tags" });
    expect(tagsButton.querySelector(".lucide-tag")).not.toBeNull();
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
        instructionCount={0}
        memoryCount={0}
        onOpenInstructions={() => {}}
        onOpenMemories={() => {}}
        onOpenTags={onOpenTags}
        onToggleHtmlComments={() => {}}
        showHtmlComments
        tagCount={0}
        tags={[]}
      />,
    );

    for (const name of ["Tags", "Instructions", "Memories"]) {
      const button = screen.getByRole("button", { name });
      expect(button.textContent).toBe("");
      expect(button.querySelector("svg")).not.toBeNull();
      expect(button.children).toHaveLength(1);
    }

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Tags" }));

    await waitFor(() => {
      expect(screen.getByText("No tags added.")).not.toBeNull();
    });
  });

  it("renders accessible icon actions with stable names, badges, and tooltips", async () => {
    const onOpenInstructions = vi.fn();
    const onOpenMemories = vi.fn();
    const onToggleHtmlComments = vi.fn();
    render(
      <DocumentActionBar
        instructionCount={0}
        memoryCount={12}
        onOpenInstructions={onOpenInstructions}
        onOpenMemories={onOpenMemories}
        onOpenTags={() => {}}
        onToggleHtmlComments={onToggleHtmlComments}
        showHtmlComments={false}
        tagCount={0}
        tags={[]}
      />,
    );

    const instructions = screen.getByRole("button", { name: "Instructions" });
    const memories = screen.getByRole("button", { name: "Memories" });
    const comments = screen.getByRole("button", {
      name: "Show HTML comments",
    });
    expect(instructions.textContent).toBe("");
    expect(memories.textContent).toBe("12");
    expect(instructions.querySelector(".lucide-file-text")).not.toBeNull();
    expect(memories.querySelector(".lucide-brain")).not.toBeNull();
    expect(comments.textContent).toBe("");
    expect(comments.getAttribute("aria-pressed")).toBe("true");
    expect(comments.querySelector(".lucide-eye-off")).not.toBeNull();

    fireEvent.pointerEnter(memories);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Memories");
    fireEvent.pointerLeave(memories);
    fireEvent.pointerEnter(comments);
    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toBe(
        "Show HTML comments",
      )
    );

    fireEvent.click(instructions);
    fireEvent.click(memories);
    fireEvent.click(comments);
    expect(onOpenInstructions).toHaveBeenCalledOnce();
    expect(onOpenMemories).toHaveBeenCalledOnce();
    expect(onToggleHtmlComments).toHaveBeenCalledOnce();
  });
});
