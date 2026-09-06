import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  scrollToHeadingHash,
  useHeadingHashNavigation,
} from "../markdown/useHeadingHashNavigation";
import { cleanup, fireEvent, render } from "./testUtils";

const mockRect = (top: number, bottom: number): DOMRect => ({
  bottom,
  height: bottom - top,
  left: 0,
  right: 800,
  top,
  width: 800,
  x: 0,
  y: top,
  toJSON: () => ({}),
});

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
const scrollIntoView = vi.fn();

const HeadingHarness = ({
  contentKey,
  headingId,
}: {
  contentKey: string;
  headingId: string;
}) => {
  const previewRef = useRef<HTMLDivElement>(null);
  useHeadingHashNavigation(previewRef, contentKey);
  return (
    <div ref={previewRef}>
      <h2 id={headingId}>Target</h2>
    </div>
  );
};

beforeEach(() => {
  scrollIntoView.mockReset();
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  if (originalScrollIntoView) {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  } else {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  }
});

describe("heading hash navigation", () => {
  it("scrolls only to a heading contained in the preview", () => {
    const preview = document.createElement("main");
    preview.innerHTML = '<h2 id="inside">Inside</h2><p id="body">Body</p>';
    document.body.append(preview);
    const outside = document.createElement("h2");
    outside.id = "outside";
    document.body.append(outside);

    expect(scrollToHeadingHash(preview, "#inside")).toBe(true);
    expect(scrollToHeadingHash(preview, "#body")).toBe(false);
    expect(scrollToHeadingHash(preview, "#outside")).toBe(false);
    expect(scrollToHeadingHash(preview, "#%E0%A4%A")).toBe(false);
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it("syncs the initial hash, hash changes, and rendered content updates", () => {
    const header = document.createElement("header");
    header.getBoundingClientRect = () => mockRect(0, 64);
    document.body.append(header);
    globalThis.history.replaceState(null, "", "/docs#target");

    const { rerender } = render(
      <HeadingHarness contentKey="first" headingId="target" />,
    );
    const target = document.getElementById("target")!;
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.instances[0]).toBe(target);
    expect(target.style.scrollMarginTop).toBe("64px");

    scrollIntoView.mockClear();
    globalThis.location.hash = "#later";
    fireEvent(globalThis, new HashChangeEvent("hashchange"));
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(<HeadingHarness contentKey="second" headingId="later" />);
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.instances[0]).toBe(
      document.getElementById("later"),
    );
  });
});
