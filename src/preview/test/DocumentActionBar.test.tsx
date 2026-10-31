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
import { DocumentActionBar } from "../components/DocumentActionBar";

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
        instructionCount={0}
        memoryCount={0}
        onOpenInstructions={() => {}}
        onOpenMemories={() => {}}
        onOpenRevisions={() => {}}
        onOpenTags={() => {}}
        tagCount={0}
        tags={[]}
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

  it("describes document tags and opens the editor", async () => {
    const onOpenTags = vi.fn();
    const { rerender } = render(
      <DocumentActionBar
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
