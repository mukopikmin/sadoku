import { afterEach, describe, expect, it, vi } from "vitest";
import { MermaidDiagram } from "../markdown/MermaidDiagram";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderDiagram = () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("mermaid-zoom-scroller") ? 600 : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("mermaid-zoom-scroller") ? 300 : 0;
    },
  );
  const onSelect = vi.fn();
  const { container } = render(
    <div onClick={onSelect}>
      <MermaidDiagram source="graph TD; A-->B;" />
    </div>,
  );
  const source = container.querySelector<HTMLElement>("pre.mermaid")!;
  source.innerHTML = '<svg viewBox="0 0 200 100"><title>Diagram</title></svg>';
  return { source, onSelect };
};

const pinch = (viewport: HTMLElement, factor = 2) => {
  const event = new WheelEvent("wheel", {
    ctrlKey: true,
    deltaY: -Math.log(factor) / 0.01,
    clientX: 300,
    clientY: 150,
    bubbles: true,
    cancelable: true,
  });
  viewport.dispatchEvent(event);
  return event;
};

describe("MermaidDiagram", () => {
  it("opens only from Zoom after the diagram has rendered", async () => {
    const { container } = render(<MermaidDiagram source="graph TD; A-->B;" />);
    const source = container.querySelector<HTMLElement>("pre.mermaid")!;
    fireEvent.click(source);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Zoom Mermaid diagram" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    source.innerHTML = '<svg viewBox="0 0 200 100"></svg>';
    fireEvent.click(
      screen.getByRole("button", { name: "Zoom Mermaid diagram" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Zoomed Mermaid diagram" }),
    )
      .not.toBeNull();
  });

  it("zooms and fits only the dialog without selecting the underlying block", async () => {
    const { source, onSelect } = renderDiagram();
    expect(pinch(source).defaultPrevented).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Zoom Mermaid diagram" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Zoomed Mermaid diagram",
    });
    const viewport = dialog.querySelector<HTMLElement>(
      ".mermaid-zoom-scroller",
    )!;
    expect(viewport.querySelector("svg")!.getAttribute("viewBox")).toBe(
      "0 0 200 100",
    );
    expect(viewport.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "200px",
    );
    expect(pinch(viewport).defaultPrevented).toBe(true);
    expect(viewport.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "400px",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Zoom in Mermaid diagram" }),
    );
    expect(viewport.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "1500px",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Zoom out Mermaid diagram" }),
    );
    expect(viewport.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "1200px",
    );
    expect(pinch(viewport, 0.5).defaultPrevented).toBe(true);
    expect(viewport.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "200px",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Zoom out Mermaid diagram" }),
    );
    expect(viewport.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "480px",
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Fit Mermaid diagram to view",
      }),
    );
    expect(viewport.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "200px",
    );
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(0);
    expect(source.style.getPropertyValue("--mermaid-pinch-width")).toBe("");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("cleans up zoom, restores focus, and starts fitted when reopened", async () => {
    renderDiagram();
    const trigger = screen.getByRole("button", {
      name: "Zoom Mermaid diagram",
    });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    const viewport = dialog.querySelector<HTMLElement>(
      ".mermaid-zoom-scroller",
    )!;
    pinch(viewport);
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Close Mermaid diagram zoom",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(pinch(viewport).defaultPrevented).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    fireEvent.click(trigger);
    const reopened = await screen.findByRole("dialog");
    expect(reopened.querySelector<HTMLElement>(".mermaid-zoom-scroller")!
      .style.getPropertyValue("--mermaid-pinch-width")).toBe("200px");
  });

  it("uses the standard Escape behavior", async () => {
    renderDiagram();
    fireEvent.click(
      screen.getByRole("button", { name: "Zoom Mermaid diagram" }),
    );
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true)
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
