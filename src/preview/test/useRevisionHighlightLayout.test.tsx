import { useRef } from "react";
import { afterEach, expect, it } from "vitest";
import {
  measureRevisionHighlightLayouts,
  useRevisionHighlightLayout,
} from "../markdown/useRevisionHighlightLayout";
import { act, cleanup, render, screen } from "./domTestUtils";

afterEach(cleanup);

it("measures changed block heights relative to the document regardless of indentation", () => {
  const preview = document.createElement("div");
  preview.innerHTML = `
    <ins data-revision-kind="addition">Paragraph</ins>
    <ul><li><ul><li><ins data-revision-kind="addition">Nested item</ins></li></ul></li></ul>
    <blockquote><del data-revision-kind="deletion">Quoted text</del></blockquote>
  `;
  preview.getBoundingClientRect = () => new DOMRect(40, 100, 800, 500);
  const blocks = preview.querySelectorAll<HTMLElement>("[data-revision-kind]");
  blocks[0].getBoundingClientRect = () => new DOMRect(40, 120, 800, 30);
  blocks[1].getBoundingClientRect = () => new DOMRect(160, 180, 680, 40);
  blocks[2].getBoundingClientRect = () => new DOMRect(70, 240, 770, 50);

  expect(measureRevisionHighlightLayouts(preview)).toEqual([
    { kind: "addition", top: 20, bottom: 120 },
    { kind: "deletion", top: 140, bottom: 190 },
  ]);
});

it("connects consecutive changed blocks across gaps but stops at unchanged nested content", () => {
  const preview = document.createElement("div");
  preview.innerHTML = `
    <ins data-revision-block data-revision-kind="addition">Heading</ins>
    <ins data-revision-block data-revision-kind="addition">Paragraph</ins>
    <ul>
      <li><div data-revision-block>Unchanged parent</div>
        <ul>
          <li><ins data-revision-block data-revision-kind="addition">Changed child</ins></li>
          <li><div data-revision-block>Unchanged child</div></li>
          <li><ins data-revision-block data-revision-kind="addition">Next change</ins></li>
        </ul>
      </li>
    </ul>
    <del data-revision-block data-revision-kind="deletion">Removed</del>
  `;
  preview.getBoundingClientRect = () => new DOMRect(40, 100, 800, 500);
  preview
    .querySelectorAll<HTMLElement>("[data-revision-block]")
    .forEach((block, index) => {
      block.getBoundingClientRect = () =>
        new DOMRect(80, 120 + index * 50, 700, 30);
    });
  expect(measureRevisionHighlightLayouts(preview)).toEqual([
    { kind: "addition", top: 20, bottom: 100 },
    { kind: "addition", top: 170, bottom: 200 },
    { kind: "addition", top: 270, bottom: 300 },
    { kind: "deletion", top: 320, bottom: 350 },
  ]);
});

const LayoutHarness = ({ highlighted }: { highlighted: boolean }) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const layouts = useRevisionHighlightLayout(previewRef);
  return (
    <div
      ref={previewRef}
      data-testid="preview"
      data-layouts={JSON.stringify(layouts)}
    >
      <ins
        data-testid="changed"
        data-revision-kind={highlighted ? "addition" : undefined}
      >
        Changed content
      </ins>
    </div>
  );
};

it("uses layout coordinates while the revision dialog is scaled during opening", () => {
  const preview = document.createElement("div");
  preview.innerHTML =
    '<ins data-revision-kind="addition">Changed content</ins>';
  Object.defineProperty(preview, "offsetWidth", { value: 800 });
  preview.getBoundingClientRect = () => new DOMRect(40, 100, 400, 250);
  preview.querySelector<HTMLElement>("ins")!.getBoundingClientRect = () =>
    new DOMRect(100, 140, 340, 20);
  expect(measureRevisionHighlightLayouts(preview)).toEqual([
    { kind: "addition", top: 80, bottom: 120 },
  ]);
});

it("updates highlight positions after resizing and removes highlights when toggled off", () => {
  const { rerender } = render(<LayoutHarness highlighted />);
  const preview = screen.getByTestId("preview");
  const changed = screen.getByTestId("changed");
  preview.getBoundingClientRect = () => new DOMRect(40, 100, 800, 500);
  changed.getBoundingClientRect = () => new DOMRect(160, 180, 680, 40);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(JSON.parse(preview.dataset.layouts!)).toEqual([
    { kind: "addition", top: 80, bottom: 120 },
  ]);

  changed.getBoundingClientRect = () => new DOMRect(80, 220, 280, 80);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(JSON.parse(preview.dataset.layouts!)).toEqual([
    { kind: "addition", top: 120, bottom: 200 },
  ]);

  rerender(<LayoutHarness highlighted={false} />);
  expect(JSON.parse(preview.dataset.layouts!)).toEqual([]);
});
