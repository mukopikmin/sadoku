import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentList } from "../CommentList";
import type { PreviewComment } from "../comments";

afterEach(() => cleanup());

const createComment = (
  overrides: Partial<PreviewComment>,
): PreviewComment => ({
  body: "Clarify this.",
  createdAt: "2026-06-05T00:00:00.000Z",
  id: 1,
  startLine: 3,
  endLine: 3,
  originalStartLine: 3,
  originalEndLine: 3,
  resolved: false,
  sourceHash: "example",
  sourceText: "Body",
  stale: false,
  updatedAt: "2026-06-05T00:00:00.000Z",
  ...overrides,
});

describe("CommentList", () => {
  it("groups active, stale, and resolved comments", () => {
    render(
      <CommentList
        comments={[
          createComment({ body: "Active comment.", id: 1 }),
          createComment({
            body: "Stale comment.",
            id: 2,
            sourceText: "Old body",
            stale: true,
          }),
          createComment({
            body: "Resolved comment.",
            id: 3,
            resolved: true,
          }),
        ]}
        onDeleteComment={async () => {}}
        onDeleteReply={async () => {}}
        onReplyComment={async () => {}}
        onReopenComment={async () => {}}
        onResolveComment={async () => {}}
        onUpdateComment={async () => {}}
        onUpdateReply={async () => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Active comments (1)" }))
      .not.toBeNull();
    expect(screen.getByRole("heading", { name: "Stale comments (1)" }))
      .not.toBeNull();
    expect(screen.getByRole("heading", { name: "Resolved comments (1)" }))
      .not.toBeNull();
    expect(screen.getByText("Active comment.")).not.toBeNull();
    expect(screen.getByText("Stale comment.")).not.toBeNull();
    expect(screen.getByText("Resolved comment.")).not.toBeNull();
    expect(screen.getByText("Stale")).not.toBeNull();
    expect(screen.getByText("Resolved")).not.toBeNull();
    expect(screen.getAllByText("Target line")).toHaveLength(2);
    expect(screen.getAllByText("Body")).toHaveLength(2);
    expect(screen.getByText("Original line")).not.toBeNull();
    expect(screen.getByText("Old body")).not.toBeNull();
  });

  it("formats source ranges in list headings", () => {
    render(
      <CommentList
        comments={[
          createComment({
            body: "Range comment.",
            endLine: 5,
            originalEndLine: 5,
          }),
          createComment({
            body: "Moved range.",
            id: "moved-range",
            startLine: 7,
            endLine: 8,
            originalStartLine: 2,
            originalEndLine: 3,
          }),
          createComment({
            body: "Stale range.",
            id: "stale-range",
            stale: true,
            endLine: 9,
            originalStartLine: 4,
            originalEndLine: 6,
          }),
        ]}
        onDeleteComment={async () => {}}
        onReplyComment={async () => {}}
        onReopenComment={async () => {}}
        onResolveComment={async () => {}}
        onUpdateComment={async () => {}}
      />,
    );

    expect(screen.getByText("Lines 3-5")).not.toBeNull();
    expect(screen.getByText("Lines 7-8 (originally lines 2-3)")).not.toBeNull();
    expect(screen.getByText("Originally lines 4-6")).not.toBeNull();
  });

  it("updates and deletes comments", async () => {
    const onDeleteComment = vi.fn(async () => {});
    const onReopenComment = vi.fn(async () => {});
    const onReplyComment = vi.fn(async () => {});
    const onResolveComment = vi.fn(async () => {});
    const onUpdateComment = vi.fn(async () => {});
    render(
      <CommentList
        comments={[createComment({ body: "Original body." })]}
        onDeleteComment={onDeleteComment}
        onDeleteReply={async () => {}}
        onReplyComment={onReplyComment}
        onReopenComment={onReopenComment}
        onResolveComment={onResolveComment}
        onUpdateComment={onUpdateComment}
        onUpdateReply={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated body." },
    });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      ctrlKey: true,
      key: "Enter",
    });
    await waitFor(() =>
      expect(onUpdateComment).toHaveBeenCalledWith(
        1,
        "Updated body.",
      )
    );

    const deleteButton = await screen.findByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);
    await waitFor(() => expect(onDeleteComment).toHaveBeenCalledWith(1));
  });

  it("shows and creates replies", async () => {
    const onDeleteReply = vi.fn(async () => {});
    const onReplyComment = vi.fn(async () => {});
    const onUpdateReply = vi.fn(async () => {});
    render(
      <CommentList
        comments={[createComment({
          replies: [{
            body: "Existing reply.",
            createdAt: "2026-06-05T01:00:00.000Z",
            id: 1,
            updatedAt: "2026-06-05T01:00:00.000Z",
          }],
        })]}
        onDeleteComment={async () => {}}
        onDeleteReply={onDeleteReply}
        onReplyComment={onReplyComment}
        onReopenComment={async () => {}}
        onResolveComment={async () => {}}
        onUpdateComment={async () => {}}
        onUpdateReply={onUpdateReply}
      />,
    );

    const existingReply = screen.getByText("Existing reply.");
    const replyContainer = existingReply.closest(".comment-reply");
    expect(existingReply).not.toBeNull();
    expect(getComputedStyle(replyContainer!).marginLeft).toBe(
      "var(--chakra-spacing-4)",
    );
    expect(getComputedStyle(replyContainer!).borderLeftWidth).toBe("3px");
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Reply body" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Reply body" }), {
      target: { value: "New reply." },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Reply body" }), {
      key: "Enter",
      metaKey: true,
    });

    await waitFor(() =>
      expect(onReplyComment).toHaveBeenCalledWith(1, "New reply.")
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Edit reply" }).hasAttribute(
          "disabled",
        ),
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit reply" }));
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", {
        name: "Edit reply body",
      }),
    );
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Edit reply body",
      }),
      {
        target: { value: "Updated reply." },
      },
    );
    fireEvent.keyDown(
      screen.getByRole("textbox", {
        name: "Edit reply body",
      }),
      { ctrlKey: true, key: "Enter" },
    );

    await waitFor(() =>
      expect(onUpdateReply).toHaveBeenCalledWith(
        1,
        1,
        "Updated reply.",
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete reply" }));
    await waitFor(() => expect(onDeleteReply).toHaveBeenCalledWith(1, 1));
  });

  it("renders comments and replies as safe GFM Markdown", () => {
    const { container } = render(
      <CommentList
        comments={[createComment({
          body:
            "**Important**\n\n- first\n- second\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>",
          replies: [{
            body:
              "See [documentation](https://example.com).\n\n```ts\nconst answer = 42;\n```",
            createdAt: "2026-06-05T01:00:00.000Z",
            id: 1,
            updatedAt: "2026-06-05T01:00:00.000Z",
          }],
        })]}
        onDeleteComment={async () => {}}
        onDeleteReply={async () => {}}
        onReplyComment={async () => {}}
        onReopenComment={async () => {}}
        onResolveComment={async () => {}}
        onUpdateComment={async () => {}}
        onUpdateReply={async () => {}}
      />,
    );

    expect(container.querySelector("strong")?.textContent).toBe("Important");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelector("table td")?.textContent).toBe("1");
    expect(
      screen.getByRole("link", { name: "documentation" }).getAttribute("href"),
    )
      .toBe("https://example.com");
    expect(container.querySelector("code.hljs.language-ts")?.textContent)
      .toContain("const answer = 42;");
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("resolves and reopens comments", async () => {
    const onReopenComment = vi.fn(async () => {});
    const onResolveComment = vi.fn(async () => {});
    render(
      <CommentList
        comments={[
          createComment({ id: 1 }),
          createComment({ id: 3, resolved: true }),
        ]}
        onDeleteComment={async () => {}}
        onDeleteReply={async () => {}}
        onReplyComment={async () => {}}
        onReopenComment={onReopenComment}
        onResolveComment={onResolveComment}
        onUpdateComment={async () => {}}
        onUpdateReply={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(onResolveComment).toHaveBeenCalledWith(1));

    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(onReopenComment).toHaveBeenCalledWith(3));
  });
});
