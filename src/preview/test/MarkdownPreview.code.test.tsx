import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import { initializeMermaid } from "../markdown/mermaid";
import { markdownStyles as previewThemeCss } from "../markdown/markdownStyles";
import {
  cleanup,
  createCommentActions,
  fireEvent,
  render,
  screen,
  waitFor,
} from "./testUtils";
import {
  expectComputedStyleValue,
  renderMarkdown,
} from "./markdownPreviewTestUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

afterEach(() => vi.mocked(initializeMermaid).mockReset());

describe("MarkdownPreview code and Mermaid", () => {
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
    const pre = container.querySelector("pre")!;
    expect(pre.closest(".chakra-theme")).not.toBeNull();
    expect(getComputedStyle(pre).color).toBe(
      "var(--chakra-colors-code-fg)",
    );
    const code = pre.querySelector("code")!;
    const codeWrapper = pre.closest(".comment-markdown-body")
      ?.firstElementChild;
    expect(getComputedStyle(codeWrapper!).paddingBlock)
      .toBe("var(--chakra-spacing-2)");
    expect(getComputedStyle(code).display).toBe("block");
    expect(getComputedStyle(code).lineHeight).toBe("1.5");
    expect(getComputedStyle(code).whiteSpace).toBe("pre");
    expect(previewThemeCss).toContain(
      ".hljs {\n    color: var(--chakra-colors-code-fg);",
    );
  });

  it("creates comments for the full fenced code block range", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = renderMarkdown(
      `\`\`\`ts
const value = 1;
\`\`\`
`,
      [],
      { onCreateComment },
    );

    fireEvent.click(container.querySelector("pre")!);
    fireEvent.click(screen.getByRole("button", {
      name: "Add comment on lines 1-3",
    }));
    expect(screen.getByText(/Commenting on lines 1-3/)).not.toBeNull();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Review this code block." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(
        1,
        "Review this code block.",
        3,
      )
    );
  });

  it("shows the selected source as raw Markdown in a dialog", async () => {
    const { container } = renderMarkdown(`# Title

Paragraph with **formatting**.
`);

    fireEvent.click(container.querySelector(".commentable-content p")!);
    const addCommentButton = screen.getByRole("button", {
      name: "Add comment on line 3",
    });
    const rawMarkdownButton = screen.getByRole("button", {
      name: "View raw Markdown for line 3",
    });

    expect(addCommentButton.nextElementSibling).toBe(rawMarkdownButton);
    fireEvent.click(rawMarkdownButton);

    const dialog = await screen.findByRole("dialog", {
      name: "Raw Markdown — line 3",
    });
    expect(dialog.querySelector("pre code")?.textContent).toBe(
      "Paragraph with **formatting**.",
    );
    const rawMarkdown = dialog.querySelector("pre")!;
    expect(getComputedStyle(rawMarkdown).whiteSpace).toBe("pre");

    document.documentElement.dataset.codeWrap = "wrap";
    expect(getComputedStyle(rawMarkdown).whiteSpace).toBe("pre-wrap");
    expect(getComputedStyle(rawMarkdown).overflowWrap).toBe("anywhere");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", {
        name: "Raw Markdown — line 3",
      })).toBeNull()
    );
  });

  it("shows action tooltips on hover and keyboard focus without native titles", async () => {
    const { container } = renderMarkdown("Paragraph\n");

    fireEvent.click(container.querySelector(".commentable-content p")!);
    const addCommentButton = screen.getByRole("button", {
      name: "Add comment on line 1",
    });
    const rawMarkdownButton = screen.getByRole("button", {
      name: "View raw Markdown for line 1",
    });

    expect(addCommentButton.getAttribute("title")).toBeNull();
    expect(rawMarkdownButton.getAttribute("title")).toBeNull();

    fireEvent.pointerMove(addCommentButton);
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Add comment on line 1",
    );

    fireEvent.pointerLeave(addCommentButton);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());

    fireEvent.keyDown(document, { key: "Tab" });
    rawMarkdownButton.focus();
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "View raw Markdown for line 1",
    );

    fireEvent.click(rawMarkdownButton);
    expect(
      await screen.findByRole("dialog", {
        name: "Raw Markdown — line 1",
      }),
    ).not.toBeNull();
  });

  it("creates comments for the full table range", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = renderMarkdown(
      `| Name | Count |
| --- | ---: |
| One | 1 |
`,
      [],
      { onCreateComment },
    );

    fireEvent.click(container.querySelector("table")!);
    fireEvent.click(screen.getByRole("button", {
      name: "Add comment on lines 1-3",
    }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Review this table." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(
        1,
        "Review this table.",
        3,
      )
    );
  });

  it("fills selected code and Mermaid block backgrounds", () => {
    const codeResult = renderMarkdown(`\`\`\`ts
const value = 1;
\`\`\`
`);
    const codeBlock = codeResult.container.querySelector<HTMLElement>(
      ".commentable-content",
    );
    fireEvent.click(codeBlock!);

    expect(
      codeBlock?.parentElement?.classList.contains(
        "commentable-block-range-selected",
      ),
    ).toBe(true);

    cleanup();
    const mermaidResult = renderMarkdown(`\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`);
    const mermaidBlock = mermaidResult.container.querySelector<HTMLElement>(
      ".commentable-content",
    );
    fireEvent.click(mermaidBlock!);

    expect(
      mermaidBlock?.parentElement?.classList.contains(
        "commentable-block-range-selected",
      ),
    ).toBe(true);
    expect(previewThemeCss).toMatch(
      /\.commentable-block-range-selected > \.commentable-content pre\s*\{[^}]*background: color-mix\(in srgb, var\(--chakra-colors-accent\) 18%, var\(--chakra-colors-canvas\)\);/,
    );
  });

  it("fills code and Mermaid block backgrounds on hover", () => {
    const { container } = renderMarkdown(`\`\`\`ts
const value = 1;
\`\`\`

\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`);

    expect(container.querySelector("pre code.language-ts")).not.toBeNull();
    expect(container.querySelector("pre.mermaid")).not.toBeNull();
    const codeRoot = container.querySelector<HTMLElement>(
      '[data-source-line="1"] .comment-markdown-body > :first-child',
    );
    const mermaidContainer = container.querySelector<HTMLElement>(
      '[data-source-line="5"] .mermaid-container',
    );
    expect(getComputedStyle(codeRoot!).paddingBlock).toBe(
      "var(--chakra-spacing-2)",
    );
    expect(getComputedStyle(mermaidContainer!).paddingBlock).toBe(
      "var(--chakra-spacing-2)",
    );
    expect(previewThemeCss).toMatch(
      /\.commentable-block:not\(\.commentable-block-selected\):hover > \.commentable-content pre,[^{]*\.commentable-block:not\(\.commentable-block-selected\):focus-within > \.commentable-content pre\s*\{[^}]*background: color-mix\(in srgb, var\(--chakra-colors-accent\) 14%, var\(--chakra-colors-canvas\)\);/,
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
    const zoomButton = screen.getByRole("button", {
      name: "Zoom Mermaid diagram",
    });
    expect(zoomButton).not.toBeNull();
    expect(zoomButton.getAttribute("title")).toBeNull();
    expect(previewThemeCss).toContain(".mermaid {");
    expect(previewThemeCss).toContain(
      "background: var(--chakra-colors-canvas-subtle);",
    );
    expect(previewThemeCss).toContain("color: var(--chakra-colors-fg);");
    expect(getComputedStyle(zoomButton).position).toBe("absolute");
    expect(previewThemeCss).not.toContain(".mermaid-zoom-button");
  });

  it("reruns mermaid rendering after the Markdown replaces diagram nodes", async () => {
    const initializedSources: (string | null | undefined)[] = [];
    vi.mocked(initializeMermaid).mockImplementation(async () => {
      initializedSources.push(document.querySelector(".mermaid")?.textContent);
    });
    const { container, rerender } = renderMarkdown(`\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`);

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(1));
    expect(initializedSources).toEqual(["graph TD\n  A --> B"]);

    rerender(
      <MarkdownPreview
        actions={createCommentActions()}
        comments={[]}
        markdown={`\`\`\`mermaid
graph LR
  C --> D
\`\`\`
`}
        showHtmlComments
        theme="default"
      />,
    );

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(2));
    const updatedNode = container.querySelector(".mermaid");
    expect(updatedNode?.textContent).toBe("graph LR\n  C --> D");
    expect(initializedSources).toEqual([
      "graph TD\n  A --> B",
      "graph LR\n  C --> D",
    ]);
    expect(initializeMermaid).toHaveBeenLastCalledWith({ theme: "default" });
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
});
