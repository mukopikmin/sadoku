import { cleanup, render, screen } from "./testUtils";
import { afterEach, describe, expect, it } from "vitest";
import { CommentMarkdown } from "../CommentMarkdown";
import { MarkdownPreview } from "../MarkdownPreview";

afterEach(() => cleanup());

const callbacks = {
  onCreateComment: async () => {},
  onDeleteComment: async () => {},
  onDeleteReply: async () => {},
  onReplyComment: async () => {},
  onResolveComment: async () => {},
  onUpdateComment: async () => {},
  onUpdateReply: async () => {},
};

describe("CommentMarkdown", () => {
  it("shares MarkdownPreview element styles", () => {
    const markdown = `## Heading

Paragraph with [a link](https://example.com) and \`code\`.

> Quote

- first
- second

---

\`\`\`diff
-const state = "loading";
+const state = "ready";
\`\`\`
`;
    render(
      <>
        <div data-testid="document-markdown">
          <MarkdownPreview comments={[]} markdown={markdown} {...callbacks} />
        </div>
        <div data-testid="comment-markdown">
          <CommentMarkdown>{markdown}</CommentMarkdown>
        </div>
      </>,
    );

    const documentMarkdown = screen.getByTestId("document-markdown");
    const commentMarkdown = screen.getByTestId("comment-markdown");
    for (
      const selector of ["h2", "p", "blockquote", "ul", "hr", "pre", "code"]
    ) {
      const documentElement = documentMarkdown.querySelector(selector)!;
      const commentElement = commentMarkdown.querySelector(selector)!;
      expect(documentElement.tagName).toBe(commentElement.tagName);
      expect(documentElement.className).toBe(commentElement.className);
      expect(documentElement.getAttribute("style")).toBe(
        commentElement.getAttribute("style"),
      );
    }

    expect(commentMarkdown.querySelector(".hljs-deletion")?.textContent)
      .toContain('-const state = "loading";');
    expect(commentMarkdown.querySelector(".hljs-addition")?.textContent)
      .toContain('+const state = "ready";');
  });

  it("keeps Mermaid as a code block without document controls", () => {
    const { container } = render(
      <CommentMarkdown>
        {`\`\`\`mermaid
graph TD
  A --> B
\`\`\``}
      </CommentMarkdown>,
    );

    expect(container.querySelector("pre code.language-mermaid")?.textContent)
      .toContain("graph TD");
    expect(
      screen.queryByRole("button", { name: "Zoom Mermaid diagram" }),
    ).toBeNull();
  });
});
