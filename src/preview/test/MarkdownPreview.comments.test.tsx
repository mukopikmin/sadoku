import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeMermaid } from "../markdown/mermaid";
import { markdownStyles as previewThemeCss } from "../markdown/markdownStyles";
import { fireEvent, screen, waitFor } from "./testUtils";
import { mockRect, renderMarkdown } from "./markdownPreviewTestUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

afterEach(() => vi.mocked(initializeMermaid).mockReset());

describe("MarkdownPreview comments", () => {
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

    const blockquote = container.querySelector("blockquote");

    expect(blockquote?.querySelector("p")?.textContent).toBe(
      "Quoted text",
    );
    expect(getComputedStyle(blockquote!).paddingBlock).toBe(
      "var(--chakra-spacing-2)",
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
      author: { type: "human" },
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

    screen.getByRole("button", { name: "More actions" }).click();
    (await screen.findByRole("menuitem", { name: "Resolve" })).click();

    await waitFor(() => expect(onResolveComment).toHaveBeenCalledWith(1));
  });

  it("renders a range comment once at its end line", async () => {
    const { container } = renderMarkdown("# Title\n\nBody\n", [{
      body: "Clarify this range.",
      author: { type: "human" },
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

    expect(screen.queryByText("Lines 1-3")).toBeNull();
    screen.getByRole("button", { name: "More actions" }).click();
    expect(await screen.findByText("Lines 1-3")).not.toBeNull();
    expect(screen.getAllByText("Clarify this range.")).toHaveLength(1);
    expect(
      container.querySelector('[data-source-line="1"] .comment-thread'),
    ).toBeNull();
    expect(
      container.querySelector('[data-source-line="3"] .comment-thread'),
    ).not.toBeNull();
    const commentThread = container.querySelector(
      '[data-source-line="3"] > .comment-thread',
    );
    expect(commentThread?.tagName).toBe("DIV");
    expect(
      commentThread?.parentElement?.classList.contains(
        "commentable-block",
      ),
    ).toBe(true);
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

  it("renders a range comment at the last commentable line in its range", () => {
    const { container } = renderMarkdown(
      "# Title\n\nFirst line\ncontinued line\n\nAfter\n",
      [{
        body: "Clarify the changed range.",
        author: { type: "human" },
        createdAt: "2026-06-05T00:00:00.000Z",
        endLine: 4,
        id: 1,
        startLine: 1,
        originalEndLine: 4,
        originalStartLine: 1,
        sourceHash: "example",
        sourceText: "# Title\n\nFirst line\ncontinued line",
        state: "active",
        updatedAt: "2026-06-05T00:00:00.000Z",
      }],
    );

    expect(screen.getAllByText("Clarify the changed range.")).toHaveLength(1);
    expect(
      container.querySelector('[data-source-line="3"] .comment-thread'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-source-line="6"] .comment-thread'),
    ).toBeNull();
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
    expect(preview).not.toBeNull();
    expect(titleContent).not.toBeNull();
    expect(bodyContent).not.toBeNull();
    preview!.getBoundingClientRect = () => mockRect(100, 400);
    titleContent!.getBoundingClientRect = () => mockRect(120, 150);
    bodyContent!.getBoundingClientRect = () => mockRect(200, 240);

    fireEvent.click(titleContent!);
    fireEvent.click(bodyContent!, { shiftKey: true });

    const highlight = container.querySelector<HTMLElement>(
      ".markdown-range-highlight-selection",
    );
    expect(highlight).not.toBeNull();
    expect(highlight?.dataset.startLine).toBe("1");
    expect(highlight?.dataset.endLine).toBe("3");
    expect(getComputedStyle(highlight!).top).toBe("21px");
    expect(getComputedStyle(highlight!).height).toBe("118px");
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
        author: { type: "human" },
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
        author: { type: "human" },
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
      { shiftKey: true },
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
    const block = container.querySelector<HTMLElement>(
      '[data-source-line="3"]',
    );
    const content = block?.querySelector<HTMLElement>(
      ":scope > .commentable-content",
    );
    const markdownBody = content?.querySelector<HTMLElement>(
      ":scope > .comment-markdown-body",
    );
    expect(block?.tagName).toBe("DIV");
    expect(block?.dataset.sourceLine).toBe("3");
    expect(block?.dataset.sourceEndLine).toBe("3");
    expect(block?.style.getPropertyValue("--comment-indent-offset")).toBe(
      "0em",
    );
    expect(content?.tagName).toBe("DIV");
    expect(content?.getAttribute("title")).toBeNull();
    expect(markdownBody?.tagName).toBe("DIV");
    expect(markdownBody?.querySelector("p")).toBe(getLine());
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
    fireEvent.click(container.querySelector('[data-source-line="3"] p')!, {
      shiftKey: true,
    });

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

  it("creates a suggested edit from the selected Markdown source", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = renderMarkdown("# Title\n\nBody\n", [], {
      onCreateComment,
    });

    fireEvent.click(container.querySelector('[data-source-line="1"] h1')!);
    fireEvent.click(container.querySelector('[data-source-line="3"] p')!, {
      shiftKey: true,
    });
    fireEvent.click(screen.getByRole("button", {
      name: "Add comment on lines 1-3",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Suggest edit" }));

    const replacement = screen.getByRole("textbox", {
      name: "Suggested replacement",
    });
    expect((replacement as HTMLTextAreaElement).value).toBe("# Title\n\nBody");
    fireEvent.change(replacement, {
      target: { value: "# Better title\n\nRevised body" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add suggestion" }));

    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(
        1,
        "```suggestion\n# Better title\n\nRevised body\n```",
        3,
      )
    );
  });

  it("extends a comment range when Shift+click creates a native text selection", () => {
    const { container } = renderMarkdown("# Title\n\nBody\n");
    const title = container.querySelector('[data-source-line="1"] h1')!;
    const body = container.querySelector('[data-source-line="3"] p')!;

    fireEvent.click(title);

    const text = body.firstChild!;
    const nativeRange = document.createRange();
    nativeRange.selectNodeContents(text);
    const nativeSelection = globalThis.getSelection();
    nativeSelection?.removeAllRanges();
    nativeSelection?.addRange(nativeRange);

    fireEvent.click(body, { shiftKey: true });

    expect(screen.getByRole("button", {
      name: "Add comment on lines 1-3",
    })).not.toBeNull();
  });

  it("selects only the clicked line without the shift key", () => {
    const { container } = renderMarkdown("# Title\n\nBody\n");

    fireEvent.click(container.querySelector('[data-source-line="1"] h1')!);
    fireEvent.click(container.querySelector('[data-source-line="3"] p')!);

    expect(screen.getByRole("button", {
      name: "Add comment on line 3",
    })).not.toBeNull();
    expect(screen.queryByRole("button", {
      name: "Add comment on lines 1-3",
    })).toBeNull();
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
