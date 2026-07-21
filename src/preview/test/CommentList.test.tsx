import {
  cleanup,
  createCommentActions,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentList } from "../pages/comments/CommentList";
import { toaster } from "../components/ui/toaster";
import type { Comment } from "../models/comment";

afterEach(() => {
  cleanup();
  toaster.remove();
});

const createComment = (
  overrides: Partial<Comment>,
): Comment => ({
  body: "Clarify this.",
  author: { type: "human" },
  createdAt: "2026-06-05T00:00:00.000Z",
  id: 1,
  startLine: 3,
  endLine: 3,
  originalStartLine: 3,
  originalEndLine: 3,
  sourceHash: "example",
  sourceText: "Body",
  state: "active",
  updatedAt: "2026-06-05T00:00:00.000Z",
  ...overrides,
});

describe("CommentList", () => {
  it("switches between active, stale, and resolved comment tabs", () => {
    render(
      <CommentList
        actions={createCommentActions()}
        comments={[
          createComment({ body: "Active comment.", id: 1 }),
          createComment({
            body: "Stale comment.",
            id: 2,
            sourceText: "Old body",
            state: "stale",
          }),
          createComment({
            body: "Resolved comment.",
            id: 3,
            state: "resolved",
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("tab", { name: "Active (1)" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    expect(screen.getByRole("heading", { name: "Active comments (1)" }))
      .not.toBeNull();
    expect(
      within(screen.getByRole("tabpanel", { name: "Active (1)" })).getByText(
        "Active comment.",
      ),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Stale (1)" }));
    expect(screen.getByRole("heading", { name: "Stale comments (1)" }))
      .not.toBeNull();
    const stalePanel = screen.getByRole("tabpanel", { name: "Stale (1)" });
    expect(within(stalePanel).getByText("Stale comment.")).not.toBeNull();
    expect(within(stalePanel).getByText("Stale")).not.toBeNull();
    expect(within(stalePanel).getByText("Original line")).not.toBeNull();
    expect(within(stalePanel).getByText("Old body")).not.toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Resolved (1)" }));
    expect(screen.getByRole("heading", { name: "Resolved comments (1)" }))
      .not.toBeNull();
    const resolvedPanel = screen.getByRole("tabpanel", {
      name: "Resolved (1)",
    });
    expect(within(resolvedPanel).getByText("Resolved comment.")).not.toBeNull();
    expect(within(resolvedPanel).getByText("Resolved")).not.toBeNull();
    expect(within(resolvedPanel).getByText("Target line")).not.toBeNull();
    expect(within(resolvedPanel).getByText("Body")).not.toBeNull();

    fireEvent.keyDown(screen.getByRole("tab", { name: "Resolved (1)" }), {
      key: "ArrowLeft",
    });
    expect(screen.getByRole("tabpanel", { name: "Stale (1)" })).not.toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Stale (1)" }),
    );
  });

  it("formats source ranges in list headings", () => {
    render(
      <CommentList
        actions={createCommentActions()}
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
            state: "stale",
            endLine: 9,
            originalStartLine: 4,
            originalEndLine: 6,
          }),
        ]}
      />,
    );

    expect(screen.getByText("Lines 3-5")).not.toBeNull();
    expect(screen.getByText("Lines 7-8 (originally lines 2-3)")).not.toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Stale (1)" }));
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
        actions={createCommentActions({
          onDeleteComment,
          onReopenComment,
          onReplyComment,
          onResolveComment,
          onUpdateComment,
        })}
        comments={[createComment({ body: "Original body." })]}
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
    expect(onDeleteComment).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete comment?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onDeleteComment).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    fireEvent.click(deleteButton);
    fireEvent.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Delete comment?",
        }),
      ).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => expect(onDeleteComment).toHaveBeenCalledWith(1));
  });

  it("shows and creates replies", async () => {
    const onDeleteReply = vi.fn(async () => {});
    const onReplyComment = vi.fn(async () => {});
    const onUpdateReply = vi.fn(async () => {});
    render(
      <CommentList
        actions={createCommentActions({
          onDeleteReply,
          onReplyComment,
          onUpdateReply,
        })}
        comments={[createComment({
          replies: [{
            body: "Existing reply.",
            author: { type: "human" },
            createdAt: "2026-06-05T01:00:00.000Z",
            id: 1,
            updatedAt: "2026-06-05T01:00:00.000Z",
          }],
        })]}
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
    expect(onDeleteReply).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete reply?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onDeleteReply).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Delete reply" }));
    fireEvent.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Delete reply?",
        }),
      ).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => expect(onDeleteReply).toHaveBeenCalledWith(1, 1));
  });

  it("renders comments and replies as safe GFM Markdown", () => {
    const { container } = render(
      <CommentList
        actions={createCommentActions()}
        comments={[createComment({
          body:
            "**Important**\n\n- first\n- second\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>",
          replies: [{
            body:
              "See [documentation](https://example.com).\n\n```ts\nconst answer = 42;\n```",
            author: { type: "human" },
            createdAt: "2026-06-05T01:00:00.000Z",
            id: 1,
            updatedAt: "2026-06-05T01:00:00.000Z",
          }],
        })]}
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
        actions={createCommentActions({
          onReopenComment,
          onResolveComment,
        })}
        comments={[
          createComment({ id: 1 }),
          createComment({ id: 3, state: "resolved" }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(onResolveComment).toHaveBeenCalledWith(1));

    expect(await screen.findByText("Comment resolved")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(onReopenComment).toHaveBeenCalledWith(1));

    fireEvent.click(screen.getByRole("tab", { name: "Resolved (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(onReopenComment).toHaveBeenCalledWith(3));
  });

  it("shows an error toast when resolving a comment fails", async () => {
    const onResolveComment = vi.fn(async () => {
      throw new Error("Server unavailable.");
    });
    render(
      <CommentList
        actions={createCommentActions({ onResolveComment })}
        comments={[createComment({ id: 7 })]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));

    expect(await screen.findByText("Could not resolve comment")).not.toBeNull();
    expect(screen.getAllByText("Server unavailable.").length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Comment resolved")).toBeNull();
  });

  it("shows an error toast when undoing a resolution fails", async () => {
    const onReopenComment = vi.fn(async () => {
      throw new Error("Reopen rejected.");
    });
    render(
      <CommentList
        actions={createCommentActions({ onReopenComment })}
        comments={[createComment({ id: 9 })]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

    expect(await screen.findByText("Could not reopen comment")).not.toBeNull();
    expect(screen.getAllByText("Reopen rejected.").length).toBeGreaterThan(0);
  });
});
