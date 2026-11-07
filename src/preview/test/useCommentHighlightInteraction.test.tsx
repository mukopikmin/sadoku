import { afterEach, describe, expect, it } from "vitest";
import { useCommentHighlightInteraction } from "../markdown/commentable/useCommentHighlightInteraction";
import { cleanup, fireEvent, render, screen } from "./domTestUtils";

afterEach(cleanup);

const Harness = () => {
  const { interactionRange, interactionProps } =
    useCommentHighlightInteraction();
  return (
    <div
      className="markdown-preview"
      data-testid="preview"
      data-range={JSON.stringify(interactionRange)}
      {...interactionProps}
    >
      <div
        className="commentable-block"
        data-source-line="1"
        data-source-end-line="3"
      >
        <p data-testid="paragraph">
          Paragraph <a href="#example">Link</a>
        </p>
      </div>
      <div className="document-diff-addition">
        <ul>
          <li>
            <ul>
              <li>
                <div
                  className="commentable-block"
                  data-source-line="5"
                  data-source-end-line="5"
                >
                  <button>Nested action</button>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </div>
      <div className="document-diff-deletion">
        <div className="markdown-preview">
          <p data-testid="removed">Removed</p>
        </div>
      </div>
    </div>
  );
};

describe("comment highlight interaction", () => {
  it("tracks the nearest block across children and clears on removed content or leaving", () => {
    render(<Harness />);
    const preview = screen.getByTestId("preview");
    fireEvent.mouseOver(screen.getByTestId("paragraph"));
    expect(JSON.parse(preview.dataset.range!)).toEqual({
      startLine: 1,
      endLine: 3,
    });
    fireEvent.mouseOut(screen.getByTestId("paragraph"), {
      relatedTarget: screen.getByRole("link"),
    });
    expect(JSON.parse(preview.dataset.range!)).toEqual({
      startLine: 1,
      endLine: 3,
    });
    fireEvent.mouseOver(screen.getByRole("button"));
    expect(JSON.parse(preview.dataset.range!)).toEqual({
      startLine: 5,
      endLine: 5,
    });
    fireEvent.mouseOver(screen.getByTestId("removed"));
    expect(preview.dataset.range).toBeUndefined();
    fireEvent.mouseOver(screen.getByTestId("paragraph"));
    fireEvent.mouseOut(screen.getByTestId("paragraph"), {
      relatedTarget: document.body,
    });
    expect(preview.dataset.range).toBeUndefined();
  });

  it("retains keyboard focus when the pointer leaves and clears it on blur", () => {
    render(<Harness />);
    const preview = screen.getByTestId("preview");
    const button = screen.getByRole("button");
    fireEvent.focus(button);
    expect(JSON.parse(preview.dataset.range!)).toEqual({
      startLine: 5,
      endLine: 5,
    });
    fireEvent.mouseOver(screen.getByTestId("paragraph"));
    expect(JSON.parse(preview.dataset.range!)).toEqual({
      startLine: 1,
      endLine: 3,
    });
    fireEvent.mouseOut(screen.getByTestId("paragraph"), {
      relatedTarget: document.body,
    });
    expect(JSON.parse(preview.dataset.range!)).toEqual({
      startLine: 5,
      endLine: 5,
    });
    fireEvent.blur(button, { relatedTarget: document.body });
    expect(preview.dataset.range).toBeUndefined();
  });
});
