import {
  cleanup,
  createCommentActions,
  fireEvent,
  render,
  screen,
  waitFor,
} from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActiveComment } from "../models/comment";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import { initializeMermaid } from "../markdown/mermaid";
import { previewThemeCss } from "../theme";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

afterEach(() => {
  globalThis.getSelection()?.removeAllRanges();
  cleanup();
  vi.mocked(initializeMermaid).mockClear();
});

const ensurePreviewThemeStyle = () => {
  if (document.querySelector("style[data-testid='preview-theme-css']")) return;
  const style = document.createElement("style");
  style.dataset.testid = "preview-theme-css";
  style.textContent = previewThemeCss;
  document.head.append(style);
};

const renderMarkdown = (
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
) => {
  ensurePreviewThemeStyle();
  const result = render(
    <MarkdownPreview
      actions={createCommentActions({
        onCreateComment: callbacks.onCreateComment ?? (async () => {}),
        onResolveComment: callbacks.onResolveComment ?? (async () => {}),
      })}
      comments={comments}
      markdown={markdown}
    />,
  );
  return { ...result, container: result.container };
};

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

describe("MarkdownPreview", () => {
  it("uses Chakra tokens for custom preview colors and spacing", () => {
    expect(previewThemeCss).not.toMatch(/#[\da-f]{3,8}\b/i);
    expect(previewThemeCss).not.toMatch(/\brgba?\(/);
    expect(previewThemeCss).toContain("var(--chakra-spacing-2)");
    expect(previewThemeCss).toContain("var(--chakra-colors-syntax-keyword)");
  });

  it("keeps overlapping selection backgrounds opaque", () => {
    const mixedBackgrounds = previewThemeCss.match(/color-mix\([^;]+\)/g) ?? [];

    expect(mixedBackgrounds).toHaveLength(6);
    for (const background of mixedBackgrounds) {
      expect(background).toContain("var(--chakra-colors-canvas)");
      expect(background).not.toContain("var(--chakra-colors-transparent)");
    }
  });

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
    expect(unorderedList?.classList.contains("comment-markdown-list")).toBe(
      true,
    );
    expect(getComputedStyle(unorderedList!).display).not.toBe("contents");
    expect(getComputedStyle(unorderedList!).marginTop).toBe(
      "var(--chakra-spacing-2)",
    );
    expect(getComputedStyle(unorderedList!).marginBottom).toBe(
      "var(--chakra-spacing-4)",
    );
    expect(getComputedStyle(unorderedList!).listStyleType).not.toBe("none");
    expect(getComputedStyle(unorderedList!).listStylePosition).toBe("outside");
    expect(container.querySelector("code.hljs.language-js")?.innerHTML)
      .toContain("console");
    expect(getComputedStyle(container.querySelector(".hljs-string")!).color)
      .toBe("var(--chakra-colors-syntax-string)");
    expect(previewThemeCss).not.toContain(".comment-markdown-body pre");
  });

  it("leaves a two-pixel gap between adjacent highlight backgrounds", () => {
    expect(previewThemeCss).toMatch(
      /\.commentable-content::before\s*\{[^}]*top: calc\(-1 \* var\(--comment-highlight-spacing-before\) \+ 1px\);[^}]*bottom: calc\(-1 \* var\(--comment-highlight-spacing-after\) \+ 1px\);/,
    );
    expect(previewThemeCss).not.toContain("inset: -4px -8px");
  });

  it("defines highlight spacing by Markdown element type", () => {
    expect(previewThemeCss).toMatch(
      /\.commentable-heading\s*\{[^}]*--comment-highlight-spacing-before: var\(--chakra-spacing-6\);[^}]*--comment-highlight-spacing-after: var\(--chakra-spacing-4\);/,
    );
    expect(previewThemeCss).toMatch(
      /\.commentable-horizontal-rule\s*\{[^}]*--comment-highlight-spacing-before: var\(--chakra-spacing-6\);[^}]*--comment-highlight-spacing-after: var\(--chakra-spacing-6\);/,
    );
    expect(previewThemeCss).toContain(
      ":where(.commentable-list-item, .commentable-table)",
    );
    expect(previewThemeCss).toMatch(
      /\.commentable-block:has\(\+ \.commentable-heading\)[^{]*\{[^}]*bottom: 1px;/,
    );
  });

  it("keeps native list markers above full-width highlight backgrounds", () => {
    expect(previewThemeCss).toMatch(
      /\.commentable-list-item > \.commentable-content\s*\{[^}]*isolation: auto;/,
    );
    expect(previewThemeCss).toMatch(
      /\.comment-markdown-list > li\s*\{[^}]*isolation: isolate;[^}]*position: relative;/,
    );
    expect(previewThemeCss).not.toContain("::marker");
    expect(previewThemeCss).not.toContain('content: "•"');
    expect(previewThemeCss).toContain(
      "left: calc(-1 * var(--chakra-spacing-2) - var(--comment-indent-offset, 0em));",
    );
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
    expect(container.querySelector('[data-source-line="1"]')).not.toBeNull();
  });

  it("keeps unsupported syntax samples selectable", () => {
    const { container } = renderMarkdown(`Raw HTML:

<script>alert("nope")</script>

Footnote-looking text stays plain.[^note]

[^note]: Footnote definitions are not enabled.
`);

    expect(container.textContent).toContain('<script>alert("nope")</script>');
    expect(container.querySelector('[data-source-line="3"]')).not.toBeNull();
    expect(container.querySelector('[data-source-line="5"]')).not.toBeNull();
    expect(container.querySelector('[data-source-line="7"]')).not.toBeNull();
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

  it("renders horizontal rules with vertical spacing around the line", () => {
    const { container } = renderMarkdown(`Before

---

After
`);

    const horizontalRule = container.querySelector("hr");

    expect(horizontalRule).not.toBeNull();
    expect(horizontalRule?.getAttribute("role")).toBe("separator");
    expect(horizontalRule?.getAttribute("aria-orientation")).toBe(
      "horizontal",
    );
    expect(getComputedStyle(horizontalRule!.parentElement!).marginTop).toBe(
      "var(--chakra-spacing-6)",
    );
    expect(getComputedStyle(horizontalRule!.parentElement!).marginBottom).toBe(
      "var(--chakra-spacing-6)",
    );
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
    expect(getComputedStyle(nestedUnorderedList!).marginTop).toBe("0.25em");
    expect(getComputedStyle(nestedUnorderedList!).marginBottom).toBe("0px");
    expect(getComputedStyle(nestedOrderedList!).marginTop).toBe("0.25em");
    expect(getComputedStyle(nestedOrderedList!).marginBottom).toBe("0px");
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

    const nestedItemContent = container.querySelector(
      '[data-source-line="3"] .commentable-content',
    );
    expect(nestedItemContent).not.toBeNull();
    fireEvent.click(nestedItemContent!);
    const nestedItemGutter = container.querySelector(
      '[data-source-line="3"] .comment-line-gutter',
    );
    expect(nestedItemGutter).not.toBeNull();
    expect(getComputedStyle(nestedItemGutter!).left).toBe(
      "calc(-1 * var(--chakra-spacing-8) - 7.5em)",
    );
    const nestedItemBlock = container.querySelector('[data-source-line="3"]');
    expect(nestedItemBlock).not.toBeNull();
    expect(
      getComputedStyle(nestedItemBlock!).getPropertyValue(
        "--comment-indent-offset",
      ),
    ).toBe("7.5em");
    expect(previewThemeCss).toContain(
      "left: calc(-1 * var(--chakra-spacing-2) - var(--comment-indent-offset, 0em))",
    );

    fireEvent.click(screen.getByRole("button", {
      name: "Add comment on line 3",
    }));
    const nestedCommentThread = container.querySelector(
      '[data-source-line="3"] .comment-thread',
    );
    expect(nestedCommentThread).not.toBeNull();
    expect(getComputedStyle(nestedCommentThread!).marginLeft).toBe(
      "calc(0em - var(--comment-indent-offset, 0em))",
    );
  });

  it("renders task list checkboxes", () => {
    const { container } = renderMarkdown(`- [ ] todo
  - [x] nested done
- [x] done
- [X] also done
`);

    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkboxes).toHaveLength(4);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(true);
    expect(checkboxes[3].checked).toBe(true);
    expect(checkboxes[0].disabled).toBe(true);
    const checkboxRoots = container.querySelectorAll<HTMLElement>(
      '[data-scope="checkbox"][data-part="root"]',
    );
    expect(checkboxRoots).toHaveLength(4);
    for (const checkboxRoot of checkboxRoots) {
      expect(getComputedStyle(checkboxRoot).marginInlineStart).toBe("-1.5em");
    }
    expect(
      container.querySelectorAll(
        '[data-scope="checkbox"][data-part="control"]',
      ),
    )
      .toHaveLength(4);
    const taskListItems = container.querySelectorAll(".task-list-item");
    expect(taskListItems).toHaveLength(4);
    for (const taskListItem of taskListItems) {
      expect(getComputedStyle(taskListItem).listStyleType).toBe("none");
    }
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
    expect(getComputedStyle(container.querySelector(".hljs-keyword")!).color)
      .toBe("var(--chakra-colors-syntax-keyword)");
  });

  it("adds source line controls to code fences", () => {
    const { container } = renderMarkdown(`\`\`\`ts
const value = 1;
\`\`\`
`);

    expect(
      container.querySelector('[data-source-line="1"] pre code.language-ts'),
    ).not.toBeNull();
    expect(
      getComputedStyle(container.querySelector(".language-ts span")!).color,
    )
      .not.toBe("var(--chakra-colors-code-fg)");
    expect(getComputedStyle(container.querySelector("pre")!).color).toBe(
      "var(--chakra-colors-code-fg)",
    );
    expect(previewThemeCss).toContain(
      ".hljs {\n        color: var(--chakra-colors-code-fg);",
    );
  });

  it("renders indented code blocks with readable text color", () => {
    const { container } = renderMarkdown(`    const indented = "<escaped>";
    console.log(indented);
`);

    const code = container.querySelector("pre code");

    expect(code?.classList.contains("hljs")).toBe(false);
    expect(code?.textContent).toContain('const indented = "<escaped>";');
    expect(getComputedStyle(code!.parentElement!).color).toBe(
      "var(--chakra-colors-code-fg)",
    );
    expect(getComputedStyle(code!).color).toBe(
      "var(--chakra-colors-code-fg)",
    );
    expect(getComputedStyle(code!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
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
      "background: var(--chakra-colors-canvas-subtle);",
    );
    expect(previewThemeCss).toContain("color: var(--chakra-colors-fg);");
    expect(previewThemeCss).toContain(".mermaid-zoom-button");
    expect(previewThemeCss).toContain(
      "background: var(--chakra-colors-canvas);",
    );
  });

  it("reruns mermaid rendering after preview interactions recreate diagram nodes", async () => {
    renderMarkdown(`\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`);

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTitle("Select line 1 for comment"));

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(2));
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
    fireEvent.click(screen.getByRole("button", {
      name: "Add comment on line 1",
    }));

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
    fireEvent.click(screen.getByRole("button", {
      name: "Add comment on line 1",
    }));
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
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("Write a GitHub PR comment..."),
      ).toBeNull()
    );

    fireEvent.click(getBodyLine()!);
    fireEvent.click(screen.getByRole("button", {
      name: "Add comment on line 3",
    }));
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
      sourceHash: "example",
      sourceText: "Body",
      state: "active",
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
      sourceHash: "example",
      sourceText: "# Title\n\nBody",
      state: "active",
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
    expect(container.querySelector(".markdown-range-highlight-comment"))
      .not.toBeNull();
    expect(
      container.querySelector('[data-source-line="3"]')?.classList.contains(
        "commentable-block-continuous-highlight",
      ),
    ).toBe(true);
    expect(previewThemeCss).toContain(".commentable-block-comment-highlight");
    expect(previewThemeCss).toContain(
      "var(--chakra-colors-selection-comment)",
    );
    expect(previewThemeCss).toContain(
      ".commentable-block:not(.commentable-block-selected):not(.commentable-block-continuous-highlight):has(.comment-thread)",
    );
    expect(previewThemeCss).toContain(
      ".commentable-block:not(.commentable-block-selected):focus-within",
    );
    expect(previewThemeCss).toContain(".commentable-block-range-selected");
  });

  it("fills the full area between selected range endpoints", () => {
    const { container } = renderMarkdown("# Title\n\nBody\n");
    const preview = container.querySelector<HTMLElement>(".markdown-preview");
    const titleBlock = container.querySelector<HTMLElement>(
      '[data-source-line="1"]',
    );
    const bodyBlock = container.querySelector<HTMLElement>(
      '[data-source-line="3"]',
    );
    const titleContent = titleBlock?.querySelector<HTMLElement>(
      ":scope > .commentable-content",
    );
    const bodyContent = bodyBlock?.querySelector<HTMLElement>(
      ":scope > .commentable-content",
    );
    const heading = titleContent?.querySelector<HTMLElement>("h1");
    const paragraph = bodyContent?.querySelector<HTMLElement>("p");
    expect(preview).not.toBeNull();
    expect(titleContent).not.toBeNull();
    expect(bodyContent).not.toBeNull();
    preview!.getBoundingClientRect = () => mockRect(100, 400);
    heading!.getBoundingClientRect = () => mockRect(120, 150);
    paragraph!.getBoundingClientRect = () => mockRect(200, 240);

    fireEvent.click(titleContent!);
    fireEvent.click(bodyContent!);

    const highlight = container.querySelector<HTMLElement>(
      ".markdown-range-highlight-selection",
    );
    expect(highlight).not.toBeNull();
    expect(highlight?.dataset.startLine).toBe("1");
    expect(highlight?.dataset.endLine).toBe("3");
    expect(highlight?.style.top).toBe("21px");
    expect(highlight?.style.height).toBe("118px");
    expect(
      titleBlock?.classList.contains(
        "commentable-block-range-selected",
      ),
    ).toBe(false);
    expect(
      bodyBlock?.classList.contains(
        "commentable-block-range-selected",
      ),
    ).toBe(false);
    expect(previewThemeCss).toContain(
      "left: calc(-1 * var(--chakra-spacing-2));",
    );
    expect(previewThemeCss).toContain(
      "right: calc(-1 * var(--chakra-spacing-2));",
    );
    expect(previewThemeCss).toMatch(
      /\.markdown-range-highlights\s*\{[^}]*z-index: -1;/,
    );
  });

  it("merges saved ranges and gives the active selection priority", () => {
    const comments: ActiveComment[] = [
      {
        body: "First range",
        createdAt: "2026-06-05T00:00:00.000Z",
        endLine: 3,
        id: 1,
        originalEndLine: 3,
        originalStartLine: 1,
        state: "active",
        startLine: 1,
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
      {
        body: "Adjacent range",
        createdAt: "2026-06-05T00:00:00.000Z",
        endLine: 5,
        id: 2,
        originalEndLine: 5,
        originalStartLine: 4,
        state: "active",
        startLine: 4,
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
    ];
    const { container } = renderMarkdown(
      "# Title\n\nFirst\n\nSecond\n",
      comments,
    );
    expect(container.querySelectorAll(
      ".markdown-range-highlight-comment",
    )).toHaveLength(1);
    expect(
      container.querySelector<HTMLElement>(
        ".markdown-range-highlight-comment",
      )?.dataset.endLine,
    ).toBe("5");

    fireEvent.click(
      container.querySelector(
        '[data-source-line="1"] .commentable-content',
      )!,
    );
    fireEvent.click(
      container.querySelector(
        '[data-source-line="3"] .commentable-content',
      )!,
    );

    const savedHighlight = container.querySelector<HTMLElement>(
      ".markdown-range-highlight-comment",
    );
    expect(savedHighlight?.dataset.startLine).toBe("4");
    expect(savedHighlight?.dataset.endLine).toBe("5");
    expect(container.querySelectorAll(
      ".markdown-range-highlight-selection",
    )).toHaveLength(1);
  });

  it("shows and clears a single-line comment selection", () => {
    const { container } = renderMarkdown("# Title\n\nBody\n");

    const getLine = () => container.querySelector('[data-source-line="3"] p');
    expect(getLine()).not.toBeNull();
    expect(screen.queryByRole("button", {
      name: "Add comment on line 3",
    })).toBeNull();

    fireEvent.click(getLine()!);

    expect(screen.getByRole("button", {
      name: "Add comment on line 3",
    })).not.toBeNull();
    expect(
      container.querySelector('[data-source-line="3"]')?.classList.contains(
        "commentable-block-range-selected",
      ),
    ).toBe(true);

    fireEvent.click(getLine()!);

    expect(screen.queryByRole("button", {
      name: "Add comment on line 3",
    })).toBeNull();
    expect(
      container.querySelector('[data-source-line="3"]')?.classList.contains(
        "commentable-block-range-selected",
      ),
    ).toBe(false);
  });

  it("keeps the Markdown DOM mounted when comment selection changes", () => {
    const { container } = renderMarkdown("# Title\n\nBody text\n");
    const body = container.querySelector('[data-source-line="3"] p');
    expect(body).not.toBeNull();

    fireEvent.click(body!);

    expect(container.querySelector('[data-source-line="3"] p')).toBe(body);
  });

  it("preserves text selection within a selected comment line", () => {
    const { container } = renderMarkdown("# Title\n\nBody text\n");
    const getBody = () => container.querySelector('[data-source-line="3"] p');
    expect(getBody()).not.toBeNull();

    fireEvent.click(getBody()!);
    expect(screen.getByRole("button", {
      name: "Add comment on line 3",
    })).not.toBeNull();

    const body = getBody();
    const text = body?.firstChild;
    expect(body).not.toBeNull();
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.setStart(text!, 0);
    range.setEnd(text!, 4);
    const selection = globalThis.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    fireEvent.click(body!);

    expect(selection?.toString()).toBe("Body");
    expect(screen.getByRole("button", {
      name: "Add comment on line 3",
    })).not.toBeNull();
  });

  it("does not select a comment line when selecting its text", () => {
    const { container } = renderMarkdown("# Title\n\nBody text\n");
    const body = container.querySelector('[data-source-line="3"] p');
    const text = body?.firstChild;
    expect(body).not.toBeNull();
    expect(text).not.toBeNull();

    const range = document.createRange();
    range.setStart(text!, 0);
    range.setEnd(text!, 4);
    const selection = globalThis.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    fireEvent.click(body!);

    expect(selection?.toString()).toBe("Body");
    expect(screen.queryByRole("button", {
      name: "Add comment on line 3",
    })).toBeNull();
  });

  it("creates comments for a selected line range", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = renderMarkdown("# Title\n\nBody\n", [], {
      onCreateComment,
    });
    expect(container.querySelector('[data-source-line="1"] h1')).not.toBeNull();
    expect(container.querySelector('[data-source-line="3"] p')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-source-line="1"] h1')!);
    fireEvent.click(container.querySelector('[data-source-line="3"] p')!);

    fireEvent.click(screen.getByRole("button", {
      name: "Add comment on lines 1-3",
    }));
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
    fireEvent.click(screen.getByRole("button", {
      name: "Add comment on line 3",
    }));
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
