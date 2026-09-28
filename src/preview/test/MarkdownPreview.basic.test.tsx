import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeMermaid } from "../markdown/mermaid";
import { fireEvent, screen, waitFor, within } from "./testUtils";
import { renderMarkdown } from "./markdownPreviewTestUtils";

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
    expect(hideButton.textContent).toBe("");
    fireEvent.click(hideButton);

    expect(screen.queryByText("HTML COMMENT")).toBeNull();
    expect(container.querySelector("[data-html-comment]")).toBeNull();
    expect(screen.getByText("Before")).not.toBeNull();
    expect(screen.getByText("After")).not.toBeNull();

    const showButton = screen.getByRole("button", {
      name: "Show HTML comments",
    });
    expect(showButton.getAttribute("aria-pressed")).toBe("true");
    expect(showButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(showButton.textContent).toBe("");
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
    expect(labels.every((label) => label.parentElement?.tagName === "HEADER"))
      .toBe(true);
    expect(
      labels.every((label) =>
        label.parentElement?.querySelector(".lucide-message-square-text") !==
          null
      ),
    ).toBe(true);
    const cards = labels.map((label) => label.closest("[data-html-comment]")!);
    const body = cards[0].querySelector("p");
    expect(body?.textContent).toBe(
      "**not bold** <img src=x onerror=alert(1)>",
    );
    expect(cards[0].querySelector("strong, img")).toBeNull();
    expect(cards[1].textContent?.trim()).toBe("HTML COMMENT");
    expect(container.querySelectorAll("html-comment")).toHaveLength(0);
  });

  it("preserves multiline HTML comment text and its source range", () => {
    renderMarkdown(
      "Before\n\n<!-- first line\n# still plain text\nlast line -->\n\nAfter",
    );

    const card = screen.getByText("HTML COMMENT").closest(
      "[data-html-comment]",
    )!;
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

    const dataList = container.querySelector("dl");
    expect(dataList).not.toBeNull();
    expect(
      [...dataList!.querySelectorAll("dt")].map((term) => term.textContent),
    )
      .toEqual(["name", "description", "unknown-key"]);
    expect(dataList!.querySelectorAll("dd")).toHaveLength(3);
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

    expect(container.querySelector("dl")).toBeNull();
    expect(container.textContent).toMatch(/Plain|not valid yaml/);
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("renders common Markdown blocks", async () => {
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
    const unorderedList = screen.getByRole("list");
    expect(unorderedList?.querySelectorAll(":scope > li")).toHaveLength(2);
    const code = container.querySelector("code.language-js")!;
    await waitFor(() =>
      expect(code.querySelector("span[style]")).not.toBeNull()
    );
    expect(code.textContent).toContain('console.log("<ok>")');
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
    renderMarkdown(
      '[site](https://example.com "Site title") ![logo](logo.png "Logo title")',
    );

    const link = screen.getByRole("link", { name: "site" });
    const image = screen.getByRole("img", { name: "logo" });

    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(image.getAttribute("src")).toBe("logo.png");
  });

  it("autolinks plain urls", () => {
    renderMarkdown("Visit https://example.com/path?q=1.");

    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "https://example.com/path?q=1",
    );
  });

  it("renders markdown tables", () => {
    renderMarkdown(`| Name | Count |
| ---- | ----: |
| alpha | 1 |
| **beta** | 20 |
`);

    const table = screen.getByRole("table");
    expect(
      within(table).getAllByRole("columnheader").map((cell) =>
        cell.textContent
      ),
    )
      .toEqual(["Name", "Count"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getAllByRole("cell").map((cell) => cell.textContent))
      .toEqual(["alpha", "1", "beta", "20"]);
    expect(
      within(table).getByRole("cell", { name: "beta" }).querySelector("strong"),
    )
      .not.toBeNull();
  });

  it("renders horizontal rules as separators between paragraphs", () => {
    renderMarkdown(`Before

---

After
`);

    const horizontalRule = screen.getByRole("separator");

    expect(horizontalRule).not.toBeNull();
    expect(horizontalRule?.getAttribute("role")).toBe("separator");
    expect(horizontalRule?.getAttribute("aria-orientation")).toBe(
      "horizontal",
    );
    expect(
      screen.getByText("Before").compareDocumentPosition(horizontalRule) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      horizontalRule.compareDocumentPosition(screen.getByText("After")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    expect(nestedUnorderedList?.parentElement?.tagName).toBe("LI");
    expect(nestedOrderedList?.parentElement?.tagName).toBe("LI");
    const listCommentTarget = container.querySelector(
      "li > .commentable-list-item",
    );
    expect(listCommentTarget).not.toBeNull();
    expect(listCommentTarget?.classList.contains("commentable-block")).toBe(
      true,
    );
    const listCommentContent = listCommentTarget!.querySelector(
      ".commentable-content",
    );
    expect(listCommentContent?.textContent?.trim()).toBe("parent");
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

    fireEvent.click(screen.getByRole("button", {
      name: "Add comment on line 3",
    }));
    const nestedCommentThread = container.querySelector(
      '[data-source-line="3"] .comment-thread',
    );
    expect(nestedCommentThread).not.toBeNull();
  });

  it("renders task list checkboxes", () => {
    renderMarkdown(`- [ ] todo
  - [x] nested done
- [x] done
- [X] also done
`);

    const checkboxes = screen.getAllByRole<HTMLInputElement>("checkbox");
    expect(checkboxes).toHaveLength(4);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(true);
    expect(checkboxes[3].checked).toBe(true);
    for (const checkbox of checkboxes) {
      expect(checkbox.disabled).toBe(true);
      expect(checkbox.closest("li")).not.toBeNull();
    }
    expect(checkboxes[1].closest("ul")?.parentElement).toBe(
      checkboxes[0].closest("li"),
    );
  });
});
