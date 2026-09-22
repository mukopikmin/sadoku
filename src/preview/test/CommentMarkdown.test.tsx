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
  it("labels ordinary and suggested code while highlighting suggestions as diffs", async () => {
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
    expect(suggestion.querySelector("[data-code-language-label]")?.textContent)
      .toBe("suggest");
    expect(ordinary.querySelector("[data-code-language-label]")?.textContent)
      .toBe("Diff");
    expect(suggestion.querySelector("code.language-diff")).not.toBeNull();
    expect(ordinary.querySelector("code.language-diff")).not.toBeNull();
    await waitFor(() => {
      expect(suggestion.querySelector("code.language-diff span[style]")).not
        .toBeNull();
    });
    expect(suggestion.querySelector("script")).toBeNull();
    expect(screen.getByText("Please revise this.")).not.toBeNull();
    expect(screen.getByText("Thanks.")).not.toBeNull();
  });

  it("uses the same suggestion label for the suggestion alias", () => {
    const { container } = render(
      <CommentMarkdown>{"```suggestion\nReplacement\n```"}</CommentMarkdown>,
    );

    expect(container.querySelector("[data-code-language-label]")?.textContent)
      .toBe("suggest");
    expect(container.querySelector("code.language-diff")).not.toBeNull();
  });

  it("preserves suggestion text when the original source is unavailable", async () => {
    const { container } = render(
      <CommentMarkdown>{"```suggest\nReplacement\n```"}</CommentMarkdown>,
    );
    expect(container.querySelector("pre code.language-diff")?.textContent).toBe(
      "Replacement",
    );
    await waitFor(() => {
      expect(container.querySelector("code.language-diff span[style]")).not
        .toBeNull();
    });
  });

  it("shares MarkdownPreview element styles", async () => {
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

    const diff = commentMarkdown.querySelector("code.language-diff")!;
    await waitFor(() =>
      expect(diff.querySelector("span[style]")).not.toBeNull()
    );
    expect(diff.textContent).toContain('-const state = "loading";');
    expect(diff.textContent).toContain('+const state = "ready";');
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
