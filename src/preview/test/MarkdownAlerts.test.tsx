import { describe, expect, it, vi } from "vitest";
import { CommentMarkdown } from "../components/comments/CommentMarkdown";
import { CommentSourceMarkdown } from "../components/comments/CommentSourceMarkdown";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import { renderMarkdown } from "./markdownPreviewTestUtils";
import {
  createCommentActions,
  fireEvent,
  render,
  screen,
  waitFor,
} from "./testUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

describe("GitHub Markdown alerts", () => {
  it.each(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"])(
    "renders %s with a label and Markdown body",
    (kind) => {
      const { container } = renderMarkdown(
        `> [!${kind}]\n> Some **details**\n>\n> - Item\n>\n> Another paragraph`,
      );
      const alert = container.querySelector<HTMLElement>(
        `[data-markdown-alert="${kind}"]`,
      );
      expect(alert).not.toBeNull();
      expect(alert?.textContent).toContain(
        kind[0] + kind.slice(1).toLowerCase(),
      );
      expect(alert?.textContent).not.toContain(`[!${kind}]`);
      expect(alert?.querySelector("strong")?.textContent).toBe("details");
      expect(screen.getByRole("listitem").textContent).toBe("Item");
      expect(screen.getByText("Another paragraph")).not.toBeNull();
    },
  );

  it.each([
    "> Ordinary quote",
    "> [!UNKNOWN]\n> Body",
    "> Prefix [!NOTE]\n> Body",
    "> [!NOTE] same line",
    "> [!NOTE] **same line**",
    "> \\[!NOTE]\n> Escaped marker",
    "> `[!NOTE]`\n> Code marker",
  ])("keeps ordinary or unsupported quotes: %s", (markdown) => {
    const { container } = renderMarkdown(markdown);
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("[data-markdown-alert]")).toBeNull();
  });

  it.each(["\n", "\r\n"])(
    "handles empty alerts, separated paragraphs, hard breaks and nested content with %j",
    (newline) => {
      const { container } = renderMarkdown(
        [
          "> [!NOTE]",
          "",
          "> [!TIP]",
          ">",
          "> Body",
          "",
          "> [!WARNING]  ",
          "> Warning body",
          "",
          "- Parent",
          "  > [!IMPORTANT]",
          "  > Nested body",
          "",
          "> Outer",
          ">",
          "> > [!CAUTION]",
          "> > Inner body",
        ].join(newline),
      );
      expect(container.querySelectorAll("[data-markdown-alert]")).toHaveLength(
        5,
      );
      expect(screen.getByText("Nested body")).not.toBeNull();
      expect(screen.getByText("Inner body")).not.toBeNull();
      expect(container.textContent).not.toContain("[!");
    },
  );

  it("adds a comment using the complete original alert range", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = renderMarkdown(
      "Intro\n\n> [!NOTE]\n> Review **this**",
      [],
      { onCreateComment },
    );
    const alert = container.querySelector<HTMLElement>("[data-markdown-alert]");
    const block = alert?.closest(".commentable-block");
    expect(block?.getAttribute("data-source-line")).toBe("3");
    expect(block?.getAttribute("data-source-end-line")).toBe("4");
    fireEvent.click(screen.getByText("Note"));
    fireEvent.click(
      screen.getByRole("button", { name: "Add comment on lines 3-4" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
      { target: { value: "Review alert" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(3, "Review alert", 4),
    );
  });

  it("renders alerts in comment bodies and quoted source", () => {
    const { container } = render(
      <>
        <CommentMarkdown>{"> [!TIP]\n> Advice"}</CommentMarkdown>
        <CommentSourceMarkdown>{"> [!NOTE]\n> Source"}</CommentSourceMarkdown>
      </>,
    );
    expect(
      container.querySelector('[data-markdown-alert="TIP"]')?.textContent,
    ).toMatch(/Tip\s*Advice/);
    expect(
      container.querySelector('[data-markdown-alert="NOTE"]')?.textContent,
    ).toMatch(/Note\s*Source/);
  });

  it("renders removed and added alerts and preserves unchanged context", () => {
    const { container } = render(
      <MarkdownPreview
        actions={createCommentActions()}
        comments={[]}
        markdown={"Intro\n\n> [!WARNING]\n> New\n\n> [!TIP]\n> Same"}
        previousMarkdown={"Intro\n\n> [!NOTE]\n> Old\n\n> [!TIP]\n> Same"}
        showHtmlComments
        theme="default"
      />,
    );
    const removed = screen.getByRole("group", { name: "Removed content" });
    const added = screen.getByRole("group", { name: "Added content" });
    expect(
      removed.querySelector('[data-markdown-alert="NOTE"]')?.textContent,
    ).toMatch(/Note\s*Old/);
    expect(
      added.querySelector('[data-markdown-alert="WARNING"]')?.textContent,
    ).toMatch(/Warning\s*New/);
    expect(removed.querySelector("[data-source-line]")).toBeNull();
    expect(
      added
        .querySelector('[data-source-line="3"]')
        ?.getAttribute("data-source-end-line"),
    ).toBe("4");
    expect(
      container.querySelectorAll('[data-markdown-alert="TIP"]'),
    ).toHaveLength(1);
    expect(screen.queryByText("[!NOTE]")).toBeNull();
  });
});
