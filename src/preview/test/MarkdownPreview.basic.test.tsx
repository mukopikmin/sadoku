import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import { initializeMermaid } from "../markdown/mermaid";
import { markdownStyles as previewThemeCss } from "../markdown/markdownStyles";
import { sadokuChakraSystem } from "../theme";
import {
  createCommentActions,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import {
  expectComputedStyleValue,
  renderMarkdown,
} from "./markdownPreviewTestUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

afterEach(() => vi.mocked(initializeMermaid).mockReset());

describe("MarkdownPreview basic rendering", () => {
  it("toggles HTML comments without affecting ordinary Markdown", () => {
    const { container } = renderMarkdown(
      "Before\n\n<!-- internal note -->\n\nAfter",
    );

    expect(screen.getByText("HTML COMMENT")).not.toBeNull();
    expect(screen.getByText("Before")).not.toBeNull();
    expect(screen.getByText("After")).not.toBeNull();

    const hideButton = screen.getByRole("button", {
      name: "Hide HTML comments",
    });
    expect(hideButton.getAttribute("aria-pressed")).toBe("false");
    expect(hideButton.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(hideButton.querySelector("svg")?.classList.contains("lucide-eye"))
      .toBe(true);
    expect(hideButton.textContent).toBe("HTML comments");
    fireEvent.click(hideButton);

    expect(screen.queryByText("HTML COMMENT")).toBeNull();
    expect(container.querySelector("[data-html-comment]")).toBeNull();
    expect(screen.getByText("Before")).not.toBeNull();
    expect(screen.getByText("After")).not.toBeNull();

    const showButton = screen.getByRole("button", {
      name: "Show HTML comments",
    });
    expect(showButton.getAttribute("aria-pressed")).toBe("true");
    expect(
      showButton.querySelector("svg")?.classList.contains("lucide-eye-off"),
    ).toBe(true);
    expect(showButton.textContent).toBe("HTML comments");
    fireEvent.click(showButton);

    expect(screen.getByText("HTML COMMENT")).not.toBeNull();
    expect(screen.getByText("Before")).not.toBeNull();
    expect(screen.getByText("After")).not.toBeNull();
  });

  it("renders complete single-line and empty HTML comments as plain-text cards", () => {
    const { container } = renderMarkdown(
      "<!-- **not bold** <img src=x onerror=alert(1)> -->\n\n<!-- -->",
    );

    const labels = screen.getAllByText("HTML COMMENT");
    expect(labels).toHaveLength(2);
    expect(labels.every((label) => label.tagName === "SPAN")).toBe(true);
    const cards = labels.map((label) => label.closest("[data-html-comment]")!);
    const body = cards[0].querySelector("p");
    expect(body?.textContent).toBe(
      "**not bold** <img src=x onerror=alert(1)>",
    );
    expect(cards[0].querySelector("strong, img")).toBeNull();
    expect(cards[1].textContent?.trim()).toBe("HTML COMMENT");
    expect(container.querySelectorAll("html-comment")).toHaveLength(0);
    expect(getComputedStyle(cards[0].parentElement!).paddingBlock).toBe(
      "var(--chakra-spacing-2)",
    );
  });

  it("preserves multiline HTML comment text and its source range", () => {
    const { container } = renderMarkdown(
      "Before\n\n<!-- first line\n# still plain text\nlast line -->\n\nAfter",
    );

    const card = screen.getByText("HTML COMMENT").parentElement!;
    expect(card.querySelector("p")?.textContent).toBe(
      "first line\n# still plain text\nlast line",
    );
    expect(card.querySelector("h1")).toBeNull();
    const commentable = card.closest(".commentable-block");
    expect(commentable?.getAttribute("data-source-line")).toBe("3");
    expect(commentable?.getAttribute("data-source-end-line")).toBe("5");
  });

  it("removes surrounding blank lines but preserves blank lines in the body", () => {
    const { container } = renderMarkdown(
      "<!--\n\nfirst line\n\nlast line\n\n-->",
    );

    const body = container.querySelector("[data-html-comment] p");
    expect(body?.textContent).toBe("first line\n\nlast line");
  });

  it("keeps unfinished comments and ordinary raw HTML as safe text", () => {
    const { container } = renderMarkdown(
      "<!-- unfinished\n\n<section><strong>ordinary HTML</strong></section>",
    );

    expect(screen.queryByText("HTML COMMENT")).toBeNull();
    expect(container.textContent).toContain("<!-- unfinished");
    expect(container.textContent).toContain(
      "<section><strong>ordinary HTML</strong></section>",
    );
    expect(container.querySelector("section, strong")).toBeNull();
  });

  it("adds a review comment for the complete HTML comment source range", async () => {
    const onCreateComment = vi.fn(async () => {});
    renderMarkdown("intro\n\n<!-- one\ntwo -->", [], { onCreateComment });

    fireEvent.click(screen.getByText("two", { exact: false }));
    fireEvent.click(
      screen.getByRole("button", { name: "Add comment on lines 3-4" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
      { target: { value: "Review this comment" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(
        3,
        "Review this comment",
        4,
      )
    );
  });

  it("renders agent front matter as commentable plain-text metadata", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = renderMarkdown(
      `---
name: Reviewer
description: |
  First line with **Markdown**.
  <img src=x onerror=alert(1)>
unknown-key: visible
---
# Instructions

Review carefully.
`,
      [],
      { onCreateComment },
      "tools/SKILL.md",
    );

    const dataList = container.querySelector(".chakra-data-list__root");
    expect(dataList).not.toBeNull();
    expect(
      getComputedStyle(
        dataList!.querySelector("dt")!,
      )
        .minWidth,
    ).toBe("auto");
    expect(dataList?.textContent).toContain("nameReviewer");
    expect(dataList?.textContent).toContain(
      "descriptionFirst line with **Markdown**.\n<img src=x onerror=alert(1)>",
    );
    expect(dataList?.textContent).toContain("unknown-keyvisible");
    expect(dataList?.querySelector("strong, img")).toBeNull();
    expect(container.textContent).not.toContain("---");
    expect(screen.getByRole("heading", { name: "Instructions" })).not
      .toBeNull();
    expect(
      container.querySelector("h1")?.closest(".commentable-block")
        ?.getAttribute("data-source-line"),
    )
      .toBe("8");

    fireEvent.click(screen.getByText("Reviewer"));
    fireEvent.click(
      screen.getByRole("button", { name: "Add comment on line 2" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
      {
        target: { value: "Metadata comment" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(2, "Metadata comment", 2)
    );
  });

  it.each([
    ["a regular Markdown file", "notes.md", "---\nname: Plain\n---\n# Body"],
    ["unterminated front matter", "SKILL.md", "---\nname: Plain\n# Body"],
    ["invalid front matter", "AGENTS.md", "---\nnot valid yaml\n---\n# Body"],
  ])("keeps %s as ordinary Markdown", (_label, documentPath, markdown) => {
    const { container } = renderMarkdown(markdown, [], {}, documentPath);

    expect(container.querySelector(".chakra-data-list__root")).toBeNull();
    expect(container.textContent).toMatch(/Plain|not valid yaml/);
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("uses Chakra tokens for custom preview colors and spacing", () => {
    expect(previewThemeCss).not.toMatch(/#[\da-f]{3,8}\b/i);
    expect(previewThemeCss).not.toMatch(/\brgba?\(/);
    expect(previewThemeCss).toContain("var(--chakra-spacing-2)");
    expect(previewThemeCss).toContain("var(--chakra-colors-syntax-keyword)");
  });

  it("gets semantic preview colors from the Chakra theme", () => {
    const tokenCss = JSON.stringify(sadokuChakraSystem.getTokenCss());

    expect(tokenCss).toContain("--chakra-colors-accent");
    expect(tokenCss).toContain("--chakra-colors-syntax-keyword");
    expect(tokenCss).toContain(".dark");
    expect(previewThemeCss).not.toMatch(/--chakra-colors-accent\s*:/);
  });

  it("keeps overlapping selection backgrounds opaque", () => {
    const mixedBackgrounds = previewThemeCss.match(/color-mix\([^;]+\)/g) ?? [];

    expect(mixedBackgrounds).toHaveLength(10);
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
    const unorderedList = container.querySelector("ul.comment-markdown-list");
    expect(unorderedList?.querySelectorAll(":scope > li")).toHaveLength(2);
    expect(
      getComputedStyle(
        unorderedList!.querySelectorAll(":scope > li")[1].querySelector(
          ".commentable-content",
        )!,
      ).paddingTop,
    ).toBe("var(--chakra-spacing-1)");
    expect(unorderedList?.classList.contains("comment-markdown-body")).toBe(
      false,
    );
    expect(unorderedList?.classList.contains("comment-markdown-list")).toBe(
      true,
    );
    expect(getComputedStyle(unorderedList!).display).not.toBe("contents");
    expect(getComputedStyle(unorderedList!).marginTop).toBe("0px");
    expect(getComputedStyle(unorderedList!).marginBottom).toBe("0px");
    expect(getComputedStyle(unorderedList!).paddingTop).toBe("0px");
    expect(getComputedStyle(unorderedList!).paddingBottom).toBe("0");
    expect(getComputedStyle(unorderedList!).listStyleType).not.toBe("none");
    expect(getComputedStyle(unorderedList!).listStylePosition).toBe("outside");
    expect(container.querySelector("code.hljs.language-js")?.innerHTML)
      .toContain("console");
    expect(getComputedStyle(container.querySelector(".hljs-string")!).color)
      .toBe("var(--chakra-colors-syntax-string)");
    expect(previewThemeCss).not.toContain(".comment-markdown-body pre");
  });

  it("uses the document line height, stacks blocks with a fixed gap, and keeps highlights within padding", () => {
    expect(sadokuChakraSystem._config.globalCss?.body).toMatchObject({
      fontSize: "md",
      lineHeight: "1.7",
    });
    expect(sadokuChakraSystem._config.theme?.tokens?.fontSizes?.md).toEqual({
      value: "calc(1rem * var(--sadoku-font-scale, 1))",
    });
    expect(previewThemeCss).toMatch(
      /\.markdown-preview\s*\{[^}]*display: flex;[^}]*flex-direction: column;[^}]*gap: var\(--chakra-spacing-3\);/,
    );
    expect(previewThemeCss).toMatch(
      /\.commentable-content::before\s*\{[^}]*top: 0;[^}]*bottom: 0;/,
    );
    expect(previewThemeCss).not.toContain("--comment-highlight-spacing");
    expect(previewThemeCss).toMatch(
      /\.comment-thread\s*\{[^}]*margin: var\(--chakra-spacing-2\) 0 var\(--chakra-spacing-3\);/,
    );
    expect(previewThemeCss).not.toContain(
      "margin: calc(-1 * var(--chakra-spacing-2))",
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

  it("escapes raw html", () => {
    const { container } = renderMarkdown("<script>alert(1)</script>");

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector(".commentable-content")?.textContent).toBe(
      "<script>alert(1)</script>",
    );
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
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
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
    expect(container.querySelector("table")?.className).toContain(
      "chakra-table__root",
    );
    expect(
      getComputedStyle(container.querySelector("table")!.parentElement!)
        .paddingBlock,
    ).toBe(
      "var(--chakra-spacing-2)",
    );
    const table = container.querySelector("table")!;
    const tableContainer = table.parentElement!;
    expect(getComputedStyle(table).width).toBe("max-content");
    expect(getComputedStyle(tableContainer).width).toBe("fit-content");
    expect(getComputedStyle(tableContainer).maxWidth).toBe("100%");
    expect(getComputedStyle(tableContainer).overflowX).toBe("auto");
    expect(container.querySelector("thead")?.className).toContain(
      "chakra-table__header",
    );
    expect(container.querySelector("tbody")?.className).toContain(
      "chakra-table__body",
    );
    expect(container.querySelector("tr")?.className).toContain(
      "chakra-table__row",
    );
    expect(container.querySelector("th")?.className).toContain(
      "chakra-table__columnHeader",
    );
    expect(container.querySelector("td")?.className).toContain(
      "chakra-table__cell",
    );
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
    expect(getComputedStyle(horizontalRule!.parentElement!).paddingBlock).toBe(
      "var(--chakra-spacing-4)",
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
    expect(getComputedStyle(nestedUnorderedList!).marginTop).toBe("0px");
    expect(getComputedStyle(nestedUnorderedList!).marginBottom).toBe("0px");
    expect(getComputedStyle(nestedUnorderedList!).paddingTop).toBe("0px");
    expect(getComputedStyle(nestedOrderedList!).marginTop).toBe("0px");
    expect(getComputedStyle(nestedOrderedList!).marginBottom).toBe("0px");
    expect(getComputedStyle(nestedOrderedList!).paddingTop).toBe("0px");
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
      expectComputedStyleValue(
        checkboxRoot,
        "margin-inline-start",
        "-1.5em",
      );
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
});
