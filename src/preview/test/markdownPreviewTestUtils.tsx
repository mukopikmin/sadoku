import { cleanup, createCommentActions, render } from "./testUtils";
import { afterEach, expect } from "vitest";
import { useState } from "react";
import type { ActiveComment } from "../models/comment";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import { DocumentActionBar } from "../components/DocumentActionBar";
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
) => {
  ensurePreviewThemeStyle();
  const PreviewWithActions = () => {
    const [showHtmlComments, setShowHtmlComments] = useState(true);
    return (
      <>
        <DocumentActionBar
          instructionCount={3}
          markdown={markdown}
          onOpenInstructions={() => {}}
          onOpenTags={() => {}}
          onToggleHtmlComments={() => setShowHtmlComments((shown) => !shown)}
          showHtmlComments={showHtmlComments}
          tagCount={2}
          tags={[]}
        />
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

export const expectComputedStyleValue = (
  element: Element,
  property: string,
  expectedValue: string,
) => {
  const reference = document.createElement("div");
  reference.style.setProperty(property, expectedValue);
  document.body.append(reference);
  expect(getComputedStyle(element).getPropertyValue(property)).toBe(
    getComputedStyle(reference).getPropertyValue(property),
  );
  reference.remove();
};
