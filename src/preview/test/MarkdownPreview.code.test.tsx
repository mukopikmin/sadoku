import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import { initializeMermaid } from "../markdown/mermaid";
import {
  cleanup,
  createCommentActions,
  fireEvent,
  screen,
  waitFor,
} from "./testUtils";
import { renderMarkdown } from "./markdownPreviewTestUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

afterEach(() => vi.mocked(initializeMermaid).mockReset());

describe("MarkdownPreview code and Mermaid", () => {
  it("shows the declared language in each fenced code header", () => {
    const { container } = renderMarkdown(`\`\`\`typescript
const longName = true;
\`\`\`

\`\`\`ts
const shortName = true;
\`\`\`

\`\`\`
plain text
\`\`\`
`);

    const labels = [
      ...container.querySelectorAll("[data-code-language-label]"),
    ];
    expect(labels.map((label) => label.textContent)).toEqual([
      "TypeScript",
      "TypeScript",
    ]);
    expect(labels.map((label) => label.parentElement?.tagName)).toEqual([
      "HEADER",
      "HEADER",
    ]);
    expect(container.querySelector("code.language-plaintext")).not.toBeNull();
  });

  it("highlights Kotlin code fences", async () => {
    const { container } = renderMarkdown(`\`\`\`kotlin
fun main() {
    println("Hello")
}
\`\`\`
`);

    const code = container.querySelector("code.language-kotlin")!;
    expect(code.parentElement?.tagName).toBe("PRE");
    await waitFor(() => {
      expect(code.querySelector("span[style]")?.textContent).toContain("fun");
    });
    expect(code.textContent).toContain('println("Hello")');
  });

  it("adds source line controls to code fences", async () => {
    const { container } = renderMarkdown(`\`\`\`ts
const value = 1;
\`\`\`
`);

    expect(
      container.querySelector('[data-source-line="1"] pre code.language-ts'),
    ).not.toBeNull();
    await waitFor(() => {
      expect(container.querySelector(".language-ts span[style]")).not
        .toBeNull();
    });
    const block = container.querySelector('[data-source-line="1"]')!;
    expect(block.getAttribute("data-source-end-line")).toBe("3");
    expect(block.querySelector("pre code")?.textContent).toContain(
      "const value = 1;",
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

  it("marks code and Mermaid blocks as selected when clicked", () => {
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
  });

  it("preserves indented code as literal text inside a code block", () => {
    const { container } = renderMarkdown(`    const indented = "<escaped>";
    console.log(indented);
`);

    const code = container.querySelector("pre code");

    expect(code?.textContent).toBe(
      'const indented = "<escaped>";\nconsole.log(indented);',
    );
    expect(code?.querySelector("escaped")).toBeNull();
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
    expect(container.querySelector("[data-code-language-label]")).toBeNull();
    const zoomButton = screen.getByRole("button", {
      name: "Zoom Mermaid diagram",
    });
    expect(zoomButton).not.toBeNull();
    expect(zoomButton.getAttribute("title")).toBeNull();
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

  it("renders longer code fences without treating nested shorter fences as blocks", async () => {
    const { container } = renderMarkdown(`\`\`\`\`md
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`\`
`);

    await waitFor(() => {
      expect(container.querySelector("code.language-md span[style]")).not
        .toBeNull();
    });
    expect(container.textContent).toContain("```mermaid");
    expect(container.textContent).toContain("A --> B");
  });
});
