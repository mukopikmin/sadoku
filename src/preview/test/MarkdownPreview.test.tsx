import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreviewComment } from "../comments";
import { MarkdownPreview } from "../MarkdownPreview";
import { previewThemeCss } from "../theme";

afterEach(() => cleanup());

const ensurePreviewThemeStyle = () => {
  if (document.querySelector("style[data-testid='preview-theme-css']")) return;
  const style = document.createElement("style");
  style.dataset.testid = "preview-theme-css";
  style.textContent = previewThemeCss;
  document.head.append(style);
};

const renderMarkdown = (
  markdown: string,
  comments: PreviewComment[] = [],
  callbacks: Partial<{
    onCreateComment: (
      startLine: number,
      body: string,
      endLine: number,
    ) => Promise<void>;
    onResolveComment: (id: number) => Promise<void>;
  }> = {},
) => {
  ensurePreviewThemeStyle();
  const result = render(
    <MarkdownPreview
      comments={comments}
      markdown={markdown}
      onCreateComment={callbacks.onCreateComment ?? (async () => {})}
      onDeleteComment={async () => {}}
      onDeleteReply={async () => {}}
      onReplyComment={async () => {}}
      onResolveComment={callbacks.onResolveComment ?? (async () => {})}
      onUpdateComment={async () => {}}
      onUpdateReply={async () => {}}
    />,
  );
  return { ...result, container: result.container };
};

describe("MarkdownPreview", () => {
  it("renders common Markdown blocks", () => {
    const { container } = renderMarkdown(`# Title

Hello **world** and *friends*.

- one
- two

\`\`\`js
console.log("<ok>");
\`\`\`
`);

    expect(container.querySelector("h1#title .heading-anchor")?.textContent)
      .toBe("Title");
    expect(container.querySelector("strong")?.textContent).toBe("world");
    const unorderedList = container.querySelector("ul");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(unorderedList?.classList.contains("comment-markdown-body")).toBe(
      false,
    );
    expect(getComputedStyle(unorderedList!).display).not.toBe("contents");
    expect(getComputedStyle(unorderedList!).listStyleType).not.toBe("none");
    expect(getComputedStyle(unorderedList!).listStylePosition).toBe("outside");
    expect(container.querySelector("code.hljs.language-js")?.innerHTML)
      .toContain("console");
    expect(previewThemeCss).toContain(".comment-markdown-body pre");
  });

  it("renders stable heading anchor links", () => {
    const { container } = renderMarkdown(`# Title!

## Title!

### **Rich** \`Heading\`
`);

    expect(container.querySelector("h1#title a.heading-anchor")?.textContent)
      .toBe("Title!");
    expect(container.querySelector("h2#title-1 a.heading-anchor")?.textContent)
      .toBe("Title!");
    expect(
      container.querySelector("h3#rich-heading a.heading-anchor")?.textContent,
    ).toBe("Rich Heading");
  });

  it("escapes raw html", () => {
    const { container } = renderMarkdown("<script>alert(1)</script>");

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe("<script>alert(1)</script>");
  });

  it("renders links and images with titles", () => {
    const { container } = renderMarkdown(
      '[site](https://example.com "Site title") ![logo](logo.png "Logo title")',
    );

    const link = screen.getByRole("link", { name: "site" });
    const image = screen.getByRole("img", { name: "logo" });

    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("title")).toBe("Site title");
    expect(image.getAttribute("src")).toBe("logo.png");
    expect(image.getAttribute("title")).toBe("Logo title");
    expect(container.querySelector("p")).not.toBeNull();
  });

  it("autolinks plain urls", () => {
    renderMarkdown("Visit https://example.com/path?q=1.");

    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "https://example.com/path?q=1",
    );
  });

  it("renders markdown tables", () => {
    const { container } = renderMarkdown(`| Name | Count |
| ---- | ----: |
| alpha | 1 |
| **beta** | 20 |
`);

    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("th")?.textContent).toBe("Name");
    expect(container.querySelector('th[style*="text-align: right"]'))
      .not.toBeNull();
    expect(container.querySelector("td strong")?.textContent).toBe("beta");
    expect(previewThemeCss).not.toContain("tbody tr:nth-child");
    expect(previewThemeCss).not.toMatch(/th \{[^}]*background:/);
  });

  it("renders nested lists inside parent list items", () => {
    const { container } = renderMarkdown(`- parent
  - child
    1. ordered child
- sibling
`);

    expect(container.querySelector("ul ul ol li")?.textContent).toBe(
      "ordered child",
    );
    expect(container.querySelectorAll("ul > li")).toHaveLength(3);
    const nestedUnorderedList = container.querySelector("ul ul");
    const nestedOrderedList = container.querySelector("ul ul ol");
    expect(nestedUnorderedList).not.toBeNull();
    expect(nestedOrderedList).not.toBeNull();
    expect(getComputedStyle(nestedUnorderedList!).display).not.toBe(
      "contents",
    );
    expect(getComputedStyle(nestedOrderedList!).display).not.toBe("contents");
    expect(getComputedStyle(nestedUnorderedList!).paddingInlineStart).not.toBe(
      "0px",
    );
    expect(getComputedStyle(nestedOrderedList!).paddingInlineStart).not.toBe(
      "0px",
    );
    expect(getComputedStyle(nestedUnorderedList!).listStylePosition).toBe(
      "outside",
    );
    expect(getComputedStyle(nestedOrderedList!).listStylePosition).toBe(
      "outside",
    );
    const listCommentTarget = container.querySelector(
      "li > .commentable-list-item",
    );
    expect(listCommentTarget).not.toBeNull();
    expect(listCommentTarget?.classList.contains("commentable-block")).toBe(
      true,
    );
    expect(getComputedStyle(listCommentTarget!).display).toBe("contents");
    const listCommentContent = listCommentTarget!.querySelector(
      ".commentable-content",
    );
    expect(getComputedStyle(listCommentContent!).display).toBe("block");
    expect(getComputedStyle(listCommentContent!).width).toBe("100%");
    expect(
      container.querySelector('[data-source-line="1"] .commentable-content ul'),
    ).toBeNull();
  });

  it("renders task list checkboxes", () => {
    const { container } = renderMarkdown(`- [ ] todo
- [x] done
- [X] also done
`);

    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(true);
    expect(container.querySelector(".task-list-item")).not.toBeNull();
    expect(previewThemeCss).not.toContain("0 0.5em 0.2em -");
  });

  it("highlights Kotlin code fences", () => {
    const { container } = renderMarkdown(`\`\`\`kotlin
fun main() {
    println("Hello")
}
\`\`\`
`);

    expect(container.querySelector("code.hljs.language-kotlin")).not.toBeNull();
    expect(container.querySelector(".hljs-keyword")?.textContent).toBe("fun");
  });

  it("adds source line controls to code fences", () => {
    const { container } = renderMarkdown(`\`\`\`ts
const value = 1;
\`\`\`
`);

    expect(
      container.querySelector('[data-source-line="1"] pre code.language-ts'),
    ).not.toBeNull();
  });

  it("renders mermaid code fences for browser-side diagrams", () => {
    const { container } = renderMarkdown(`\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`);

    const mermaid = container.querySelector(".mermaid-container pre.mermaid");
    expect(mermaid).not.toBeNull();
    expect(mermaid?.textContent).toBe("graph TD\n  A --> B");
    expect(
      screen.getByRole("button", { name: "Zoom Mermaid diagram" }),
    ).not.toBeNull();
    expect(previewThemeCss).toContain(".mermaid {");
    expect(previewThemeCss).toContain(
      "background: var(--color-canvas-subtle);",
    );
    expect(previewThemeCss).toContain("color: var(--color-text);");
    expect(previewThemeCss).toContain(".mermaid-zoom-button");
    expect(previewThemeCss).toContain("background: var(--color-canvas);");
  });

  it("does not render Mermaid zoom buttons for regular code fences", () => {
    renderMarkdown(`\`\`\`ts
const value = 1;
\`\`\`
`);

    expect(
      screen.queryByRole("button", { name: "Zoom Mermaid diagram" }),
    ).toBeNull();
  });

  it("renders longer code fences without treating nested shorter fences as blocks", () => {
    const { container } = renderMarkdown(`\`\`\`\`md
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`\`
`);

    expect(container.querySelector("code.hljs.language-md")).not.toBeNull();
    expect(container.textContent).toContain("```mermaid");
    expect(container.textContent).toContain("A --> B");
  });

  it("adds source line controls to rendered Markdown blocks", () => {
    const { container } = renderMarkdown(`# Title

Body
`);

    expect(container.querySelector('[data-source-line="1"] h1')?.textContent)
      .toBe("Title");
    expect(container.querySelector('[data-source-line="3"] p')?.textContent)
      .toBe("Body");
  });

  it("focuses the comment textarea when opening the comment form", () => {
    const { container } = renderMarkdown("# Title\n");
    const line = container.querySelector('[data-source-line="1"] h1');
    expect(line).not.toBeNull();

    fireEvent.click(line!);
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
    );
  });

  it("submits a new comment with command or control enter", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = renderMarkdown("# Title\n\nBody\n", [], {
      onCreateComment,
    });
    const getTitleLine = () =>
      container.querySelector('[data-source-line="1"] h1');
    const getBodyLine = () =>
      container.querySelector('[data-source-line="3"] p');
    expect(getTitleLine()).not.toBeNull();
    expect(getBodyLine()).not.toBeNull();

    fireEvent.click(getTitleLine()!);
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    fireEvent.change(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
      { target: { value: "Mac shortcut." } },
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
      { key: "Enter", metaKey: true },
    );

    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(1, "Mac shortcut.", 1)
    );

    fireEvent.click(getBodyLine()!);
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    fireEvent.change(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
      { target: { value: "Control shortcut." } },
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
      { key: "Enter", ctrlKey: true },
    );

    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(3, "Control shortcut.", 3)
    );
  });

  it("does not add duplicate source line controls for blockquotes", () => {
    const { container } = renderMarkdown(`> Quoted text
`);

    expect(container.querySelector("blockquote p")?.textContent).toBe(
      "Quoted text",
    );
    expect(container.querySelectorAll('[data-source-line="1"]')).toHaveLength(
      1,
    );
  });

  it("does not add duplicate source line controls for loose list paragraphs", () => {
    const { container } = renderMarkdown(`- Parent item

  More detail
`);

    expect(container.querySelector("li p")?.textContent).toBe("Parent item");
    expect(container.querySelectorAll('[data-source-line="1"]')).toHaveLength(
      1,
    );
    expect(container.querySelectorAll('[data-source-line="3"]')).toHaveLength(
      1,
    );
  });

  it("resolves inline comments from the preview", async () => {
    const onResolveComment = vi.fn(async () => {});
    renderMarkdown("# Title\n\nBody\n", [{
      body: "Clarify this.",
      createdAt: "2026-06-05T00:00:00.000Z",
      id: 1,
      endLine: 3,
      originalEndLine: 3,
      originalStartLine: 3,
      startLine: 3,
      resolved: false,
      sourceHash: "example",
      sourceText: "Body",
      stale: false,
      updatedAt: "2026-06-05T00:00:00.000Z",
    }], { onResolveComment });

    screen.getByRole("button", { name: "Resolve" }).click();

    await waitFor(() => expect(onResolveComment).toHaveBeenCalledWith(1));
  });

  it("renders a range comment once at its end line", () => {
    const { container } = renderMarkdown("# Title\n\nBody\n", [{
      body: "Clarify this range.",
      createdAt: "2026-06-05T00:00:00.000Z",
      endLine: 3,
      id: 1,
      startLine: 1,
      originalEndLine: 3,
      originalStartLine: 1,
      resolved: false,
      sourceHash: "example",
      sourceText: "# Title\n\nBody",
      stale: false,
      updatedAt: "2026-06-05T00:00:00.000Z",
    }]);

    expect(screen.getAllByText("Lines 1-3")).toHaveLength(1);
    expect(screen.getAllByText("Clarify this range.")).toHaveLength(1);
    expect(
      container.querySelector('[data-source-line="1"] .comment-thread'),
    ).toBeNull();
    expect(
      container.querySelector('[data-source-line="3"] .comment-thread'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-source-line="1"]')?.classList.contains(
        "commentable-block-selected",
      ),
    ).toBe(true);
    expect(
      container.querySelector('[data-source-line="3"]')?.classList.contains(
        "commentable-block-selected",
      ),
    ).toBe(true);
  });

  it("shows and clears a single-line comment selection", () => {
    const { container } = renderMarkdown("# Title\n\nBody\n");

    const getLine = () => container.querySelector('[data-source-line="3"] p');
    expect(getLine()).not.toBeNull();

    fireEvent.click(getLine()!);

    expect(screen.getByRole("button", { name: "Add comment" })).not.toBeNull();

    fireEvent.click(getLine()!);

    expect(screen.queryByRole("button", { name: "Add comment" })).toBeNull();
  });

  it("creates comments for a selected line range", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = renderMarkdown("# Title\n\nBody\n", [], {
      onCreateComment,
    });
    const getTitleLine = () =>
      container.querySelector('[data-source-line="1"] h1');
    const getBodyLine = () =>
      container.querySelector('[data-source-line="3"] p');
    expect(getTitleLine()).not.toBeNull();
    expect(getBodyLine()).not.toBeNull();

    fireEvent.click(getTitleLine()!);
    fireEvent.click(getBodyLine()!);

    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    expect(screen.getByText(/Commenting on lines 1-3/)).not.toBeNull();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Review this line range." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(
        1,
        "Review this line range.",
        3,
      )
    );
  });

  it("creates comments on the clicked nested list item line", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = renderMarkdown(
      `- parent
  - child
    1. ordered child
`,
      [],
      { onCreateComment },
    );
    const orderedChild = container.querySelector(
      '[data-source-line="3"] .commentable-content',
    );
    expect(orderedChild).not.toBeNull();

    fireEvent.click(orderedChild!);
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Review nested item." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(
        3,
        "Review nested item.",
        3,
      )
    );
  });
});
