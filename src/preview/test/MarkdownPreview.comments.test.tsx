import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeMermaid } from "../markdown/mermaid";
import type { ActiveComment } from "../models/comment";
import { fireEvent, screen, waitFor } from "./testUtils";
import { renderMarkdown } from "./markdownPreviewTestUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

afterEach(() => vi.mocked(initializeMermaid).mockReset());

describe("MarkdownPreview comments", () => {
  it("selects a range from a table header through a rendered Mermaid diagram", async () => {
    vi.mocked(initializeMermaid).mockImplementation(async () => {
      const diagram = document.querySelector("pre.mermaid");
      if (diagram && !diagram.querySelector("svg")) {
        diagram.innerHTML =
          '<svg role="img" aria-label="Example diagram"><rect width="100" height="50" /></svg>';
      }
    });
    const { container } = renderMarkdown(
      "| Header |\n| --- |\n| Value |\n\n```mermaid\ngraph TD; A --> B\n```\n",
    );
    const header = screen.getByRole("columnheader", { name: "Header" });
    const diagram = await screen.findByRole("img", { name: "Example diagram" });

    fireEvent.click(header);
    expect(screen.getByRole("button", { name: "Add comment on lines 1-3" }))
      .not.toBeNull();
    fireEvent.click(diagram.querySelector("rect")!, { shiftKey: true });
    expect(screen.getByRole("button", { name: "Add comment on lines 1-7" }))
      .not.toBeNull();
    expect(
      container.querySelector(".markdown-range-highlight-selection")
        ?.getAttribute("data-end-line"),
    ).toBe("7");
    expect(screen.getByRole("img", { name: "Example diagram" })).toBe(diagram);

    fireEvent.click(diagram.querySelector("rect")!);
    expect(screen.getByRole("button", { name: "Add comment on lines 5-7" }))
      .not.toBeNull();
    fireEvent.click(diagram.querySelector("rect")!);
    expect(screen.queryByRole("button", { name: "Add comment on lines 5-7" }))
      .toBeNull();
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
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
    );
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
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
    );
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

    screen.getByRole("button", { name: "Resolve" }).click();

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
    expect(container.querySelector(".markdown-range-highlight-comment"))
      .not.toBeNull();
    expect(
      container.querySelector('[data-source-line="3"]')?.classList.contains(
        "commentable-block-continuous-highlight",
      ),
    ).toBe(true);
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

  it("renders one selection range spanning the selected source lines", () => {
    const { container } = renderMarkdown("# Title\n\nBody\n");
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
    expect(titleContent).not.toBeNull();
    expect(bodyContent).not.toBeNull();

    fireEvent.click(titleContent!);
    fireEvent.click(bodyContent!, { shiftKey: true });

    const highlight = container.querySelector<HTMLElement>(
      ".markdown-range-highlight-selection",
    );
    expect(highlight).not.toBeNull();
    expect(highlight?.dataset.startLine).toBe("1");
    expect(highlight?.dataset.endLine).toBe("3");
    expect(container.querySelectorAll(".markdown-range-highlight-selection"))
      .toHaveLength(1);
    expect(screen.getByRole("button", { name: "Add comment on lines 1-3" })).not
      .toBeNull();
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
    expect(block?.dataset.sourceLine).toBe("3");
    expect(block?.dataset.sourceEndLine).toBe("3");
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

  it("preserves native text selection without changing the selected comment line", () => {
    const { container } = renderMarkdown("# Title\n\nBody text\n");
    const getBody = () => container.querySelector('[data-source-line="3"] p');
    expect(getBody()).not.toBeNull();

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
    expect(screen.queryByRole("button", {
      name: "Add comment on line 3",
    })).toBeNull();

    selection?.removeAllRanges();
    fireEvent.click(body!);
    expect(screen.getByRole("button", {
      name: "Add comment on line 3",
    })).not.toBeNull();

    selection?.addRange(range);

    fireEvent.click(body!);

    expect(selection?.toString()).toBe("Body");
    expect(screen.getByRole("button", {
      name: "Add comment on line 3",
    })).not.toBeNull();
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

  it("inserts a suggest block with the selected Markdown source into the comment", async () => {
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
    const suggestButton = screen.getByRole("button", { name: "Suggest edit" });
    expect(suggestButton.textContent).toBe("");
    expect(suggestButton.querySelector('svg[aria-hidden="true"]')).not
      .toBeNull();
    fireEvent.click(suggestButton);

    const textbox = screen.getByRole("textbox", {
      name: "Comment body",
    });
    expect((textbox as HTMLTextAreaElement).value).toBe(
      "```suggest\n# Title\n\nBody\n```",
    );
    expect(document.activeElement).toBe(textbox);
    const body =
      "Please update this.\n\n```suggest\n# Better title\n\nRevised body\n```\n\nThanks!";
    fireEvent.change(textbox, {
      target: { value: body },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(
        1,
        body,
        3,
      )
    );
  });

  it("preserves the draft when inserting suggestions containing code fences", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = renderMarkdown("```ts\nconst value = 1;\n```\n", [], {
      onCreateComment,
    });
    fireEvent.click(container.querySelector('[data-source-line="1"] pre')!);
    fireEvent.click(screen.getByRole("button", {
      name: "Add comment on lines 1-3",
    }));
    const textbox = screen.getByRole("textbox", { name: "Comment body" });
    fireEvent.change(textbox, {
      target: { value: "Please revise this example." },
    });

    const suggestion = "````suggest\n```ts\nconst value = 1;\n```\n````";
    fireEvent.click(screen.getByRole("button", { name: "Suggest edit" }));
    expect((textbox as HTMLTextAreaElement).value).toBe(
      `Please revise this example.\n\n${suggestion}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "Suggest edit" }));
    const body =
      `Please revise this example.\n\n${suggestion}\n\n${suggestion}`;
    expect((textbox as HTMLTextAreaElement).value).toBe(body);
    fireEvent.keyDown(textbox, { key: "Enter", ctrlKey: true });
    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(1, body, 3)
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
