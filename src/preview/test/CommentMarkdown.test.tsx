import { cleanup, render, screen, waitFor } from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentMarkdown } from "../components/comments/CommentMarkdown";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import { initializeMermaid } from "../markdown/mermaid";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

afterEach(() => {
  cleanup();
  vi.mocked(initializeMermaid).mockClear();
  document.documentElement.removeAttribute("data-theme");
});

const callbacks = {
  onCreateComment: async () => {},
  onDeleteComment: async () => {},
  onDeleteReply: async () => {},
  onReopenComment: async () => {},
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
          <MarkdownPreview
            actions={callbacks}
            comments={[]}
            markdown={markdown}
            showHtmlComments
            theme="default"
          />
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
      const documentElement = [...documentMarkdown.querySelectorAll(selector)]
        .find((element) => !element.closest("[data-scope=collapsible]"))!;
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

  it("renders Mermaid diagrams with zoom controls", async () => {
    document.documentElement.dataset.theme = "dark";
    const { container } = render(
      <CommentMarkdown>
        {`\`\`\`mermaid
graph TD
  A --> B
\`\`\``}
      </CommentMarkdown>,
    );

    expect(
      container.querySelector(".mermaid-container pre.mermaid")?.textContent,
    )
      .toBe("graph TD\n  A --> B");
    expect(screen.getByRole("button", { name: "Zoom Mermaid diagram" }))
      .not.toBeNull();
    await waitFor(() =>
      expect(initializeMermaid).toHaveBeenCalledWith({
        root: container.querySelector(".comment-markdown-body"),
        theme: "dark",
      })
    );
  });
});
