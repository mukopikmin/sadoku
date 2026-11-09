import { act, cleanup, fireEvent, render, screen } from "./testUtils";
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
    vi.stubGlobal(
      "ResizeObserver",
      class {
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
      },
    );
    const { unmount } = render(
      <DocumentActionBar
        markdown="# Introduction"
        memoryCount={0}
        onOpenInstructions={() => {}}
        onOpenMemories={() => {}}
        onOpenRevisions={() => {}}
      />,
    );
    const bar = screen.getByRole("dialog", { name: "Document actions" });
    const spacer = screen.getByTestId("action-bar-spacer");
    let height = 56;
    vi.spyOn(bar, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(0, 0, 420, height),
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

  it("renders accessible icon actions with stable names, badges, and tooltips", async () => {
    const onOpenInstructions = vi.fn();
    const onOpenMemories = vi.fn();
    const onOpenRevisions = vi.fn();
    render(
      <DocumentActionBar
        markdown="# Introduction"
        memoryCount={12}
        onOpenInstructions={onOpenInstructions}
        onOpenMemories={onOpenMemories}
        onOpenRevisions={onOpenRevisions}
      />,
    );

    expect(screen.queryByRole("button", { name: "Tags" })).toBeNull();
    const instructions = screen.getByRole("button", { name: "Instructions" });
    const memories = screen.getByRole("button", { name: "Memories" });
    expect(screen.queryByRole("button", { name: /HTML comments/ })).toBeNull();
    expect(instructions.textContent).toBe("");
    expect(memories.textContent).toBe("12");
    expect(
      instructions.querySelector('svg[aria-hidden="true"]'),
    ).not.toBeNull();
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

it("keeps a single table of contents and its open state when the bar updates", async () => {
  const bar = (count: number) => (
    <DocumentActionBar
      markdown="# Introduction"
      memoryCount={count}
      onOpenInstructions={() => {}}
      onOpenMemories={() => {}}
      onOpenRevisions={() => {}}
    />
  );
  const { rerender } = render(bar(0));
  const trigger = screen.getByRole("button", { name: "Table of contents" });
  fireEvent.click(trigger);
  const contents = await screen.findByRole("navigation", {
    name: "Table of contents",
  });
  rerender(bar(3));
  expect(screen.getAllByRole("button", { name: "Table of contents" })).toEqual([
    trigger,
  ]);
  expect(screen.getByRole("navigation", { name: "Table of contents" })).toBe(
    contents,
  );
  expect(screen.getByRole("link", { name: "Introduction" })).not.toBeNull();
});
