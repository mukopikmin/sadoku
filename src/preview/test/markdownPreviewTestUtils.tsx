import { cleanup, createCommentActions, render } from "./testUtils";
import { afterEach } from "vitest";
import type { ActiveComment } from "../models/comment";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import { TableOfContents } from "../pages/markdown/TableOfContents";
import { markdownStyles as previewThemeCss } from "../markdown/markdownStyles";

afterEach(() => {
  globalThis.getSelection()?.removeAllRanges();
  document.documentElement.removeAttribute("data-code-wrap");
  cleanup();
});

const ensurePreviewThemeStyle = () => {
  if (document.querySelector("style[data-testid='preview-theme-css']")) return;
  const style = document.createElement("style");
  style.dataset.testid = "preview-theme-css";
  style.textContent = previewThemeCss;
  document.head.append(style);
};

export const renderMarkdown = (
  markdown: string,
  comments: ActiveComment[] = [],
  callbacks: Partial<{
    onCreateComment: (
      startLine: number,
      body: string,
      endLine: number,
    ) => Promise<void>;
    onResolveComment: (id: number) => Promise<void>;
  }> = {},
  documentPath?: string,
  showHtmlComments = true,
) => {
  ensurePreviewThemeStyle();
  const PreviewWithActions = () => {
    return (
      <>
        <TableOfContents markdown={markdown} />
        <MarkdownPreview
          actions={createCommentActions({
            onCreateComment: callbacks.onCreateComment ?? (async () => {}),
            onResolveComment: callbacks.onResolveComment ?? (async () => {}),
          })}
          comments={comments}
          documentPath={documentPath}
          markdown={markdown}
          showHtmlComments={showHtmlComments}
          theme="default"
        />
      </>
    );
  };
  const result = render(
    <PreviewWithActions />,
  );
  return { ...result, container: result.container };
};

export const mockRect = (top: number, bottom: number): DOMRect => ({
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
