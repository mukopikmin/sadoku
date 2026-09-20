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
  it("uses ordinary diff code blocks for suggestions and preserves surrounding prose", () => {
    render(
      <>
        <div data-testid="suggested-diff">
          <CommentMarkdown sourceText={"Original\nUnchanged"}>
            {"Please revise this.\n\n```suggest\n<script>edited</script>\nUnchanged\n```\n\nThanks."}
          </CommentMarkdown>
        </div>
        <div data-testid="ordinary-diff">
          <CommentMarkdown>
            {"```diff\n-Original\n+<script>edited</script>\n Unchanged\n```"}
          </CommentMarkdown>
        </div>
      </>,
    );

    const suggestion = screen.getByTestId("suggested-diff");
    const ordinary = screen.getByTestId("ordinary-diff");
    expect(suggestion.querySelector("pre")?.outerHTML).toBe(
      ordinary.querySelector("pre")?.outerHTML,
    );
    expect(suggestion.querySelector("script")).toBeNull();
    expect(screen.getByText("Please revise this.")).not.toBeNull();
    expect(screen.getByText("Thanks.")).not.toBeNull();
  });

  it("preserves suggestion text when the original source is unavailable", () => {
    const { container } = render(
      <CommentMarkdown>{"```suggest\nReplacement\n```"}</CommentMarkdown>,
    );
    expect(container.querySelector("pre code.language-diff")?.textContent).toBe(
      "Replacement\n",
    );
    expect(container.querySelector(".hljs-deletion")).toBeNull();
  });

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
