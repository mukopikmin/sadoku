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
  vi.unstubAllGlobals();
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
  it("renders source text as safe GFM in a distinct target region", () => {
    render(
      <CommentList
        actions={createCommentActions()}
        comments={[createComment({
          body: "Comment body stays separate.",
          sourceText: [
            "# Source heading",
            "",
            "This is **important**.",
            "",
            "- First item",
            "- Second item",
            "",
            "[Safe link](https://example.com)",
            "",
            "```ts",
            "const answer = 42;",
            "```",
            "",
            "<script>window.sourceTextExecuted = true</script>",
          ].join("\n"),
        })]}
      />,
    );

    const target = document.querySelector(".comment-source-target")!;
    const sourceMarkdown = target.querySelector(".comment-source-markdown")!;
    const rootThread = document.querySelector(".comment-root-thread")!;
    expect(target.tagName).toBe("SECTION");
    expect(within(target).getByText("Target line")).not.toBeNull();
    expect(
      within(sourceMarkdown).getByRole("heading", {
        name: "Source heading",
      }),
    ).not.toBeNull();
    expect(within(sourceMarkdown).getByText("important").tagName).toBe(
      "STRONG",
    );
    expect(within(sourceMarkdown).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(sourceMarkdown).getByRole("link", { name: "Safe link" })
        .getAttribute("href"),
    ).toBe("https://example.com");
    const codeBlock = sourceMarkdown.querySelector("pre code")!;
    expect(codeBlock.textContent).toContain("const answer = 42;");
    expect(sourceMarkdown.querySelector("script")).toBeNull();
    expect(sourceMarkdown.textContent).toContain(
      "<script>window.sourceTextExecuted = true</script>",
    );
    expect(target.contains(screen.getByText("Comment body stays separate.")))
      .toBe(false);

    const targetStyles = getComputedStyle(target);
    expect(targetStyles.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(targetStyles.borderLeftStyle).toBe("none");
    expect(targetStyles.borderTopStyle).toBe("none");
    expect(target.nextElementSibling).toBe(rootThread);
    expect(getComputedStyle(rootThread).borderLeftWidth).toBe("3px");
    expect(getComputedStyle(sourceMarkdown).fontSize).toBe(
      getComputedStyle(screen.getByText("Comment body stays separate."))
        .fontSize,
    );
  });

  it("labels only bot comments and replies", () => {
    render(
      <CommentList
        actions={createCommentActions()}
        comments={[
          createComment({
            body: "Human comment.",
            id: 1,
            replies: [{
              author: { type: "human" },
              body: "Human reply.",
              createdAt: "2026-06-05T01:00:00.000Z",
              id: 1,
              updatedAt: "2026-06-05T01:00:00.000Z",
            }],
          }),
          createComment({
            author: { type: "bot" },
            body: "Bot comment.",
            id: 2,
            replies: [{
              author: { type: "bot" },
              body: "Bot reply.",
              createdAt: "2026-06-05T01:00:00.000Z",
              id: 2,
              updatedAt: "2026-06-05T01:00:00.000Z",
            }],
          }),
          createComment({
            author: { type: "bot" },
            body: "Unnamed bot comment.",
            id: 3,
          }),
        ]}
      />,
    );

    expect(screen.getAllByText("Bot")).toHaveLength(3);

    const humanComment = screen.getByText("Human comment.").closest("article")!;
    const humanReply = screen.getByText("Human reply.").closest(
      ".comment-reply",
    )!;
    expect(within(humanComment).queryByText("Bot")).toBeNull();
    expect(within(humanReply).queryByText("Bot")).toBeNull();
  });

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
    expect(
      within(screen.getByRole("tabpanel", { name: "Active (1)" })).getByText(
        "Target line",
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

  it("shows source ranges only in action menus", async () => {
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

    expect(screen.queryByText("Lines 3-5")).toBeNull();
    const firstMenuButton = screen.getAllByRole("button", {
      name: "More actions",
    })[0];
    expect(firstMenuButton.querySelector('svg[aria-hidden="true"]')).not
      .toBeNull();
    expect(firstMenuButton.textContent).toBe("");
    firstMenuButton.focus();
    fireEvent.keyDown(firstMenuButton, { key: "Enter" });
    expect(await screen.findByText("Lines 3-5")).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: "Resolve" })).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: "Edit" })).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: "Delete" })).not.toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(firstMenuButton));
    fireEvent.click(screen.getAllByRole("button", { name: "More actions" })[1]);
    expect(await screen.findByText("Lines 7-8 (originally lines 2-3)"))
      .not.toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.click(screen.getByRole("tab", { name: "Stale (1)" }));
    expect(screen.queryByText("Originally lines 4-6")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(await screen.findByText("Originally lines 4-6")).not.toBeNull();
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

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
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

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(onDeleteComment).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete comment?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onDeleteComment).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Delete comment?",
        }),
      ).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => expect(onDeleteComment).toHaveBeenCalledWith(1));
  });

  it("copies comment and reply bodies to the clipboard", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    });
    render(
      <CommentList
        actions={createCommentActions()}
        comments={[createComment({
          body: "**Comment** body.",
          replies: [{
            author: { type: "human" },
            body: "Reply body.",
            createdAt: "2026-06-05T01:00:00.000Z",
            id: 1,
            updatedAt: "2026-06-05T01:00:00.000Z",
          }],
        })]}
      />,
    );

    const copyCommentButton = screen.getByRole("button", {
      name: "Copy comment",
    });
    expect(copyCommentButton.querySelector('svg[aria-hidden="true"]')).not
      .toBeNull();
    expect(copyCommentButton.textContent).toBe("");
    fireEvent.click(copyCommentButton);
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "**Comment** body.",
      )
    );
    expect(await screen.findByText("Comment copied")).not.toBeNull();

    const copyReplyButton = screen.getByRole("button", { name: "Copy reply" });
    expect(copyReplyButton.querySelector('svg[aria-hidden="true"]')).not
      .toBeNull();
    expect(copyReplyButton.textContent).toBe("");
    fireEvent.click(copyReplyButton);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Reply body."));
    expect(await screen.findByText("Reply copied")).not.toBeNull();
  });

  it("shows accessible reply cards without visual reply labels", async () => {
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
          replies: [
            {
              body: "First human reply.\n\nSecond line in the same reply.",
              author: { type: "human" },
              createdAt: "2026-06-05T01:00:00.000Z",
              id: 1,
              updatedAt: "2026-06-05T01:00:00.000Z",
            },
            {
              body: "Existing bot reply.",
              author: { type: "bot" },
              createdAt: "2026-06-05T02:00:00.000Z",
              id: 2,
              reviewRequested: true,
              updatedAt: "2026-06-05T02:00:00.000Z",
            },
          ],
        })]}
      />,
    );

    const existingReply = screen.getByText("First human reply.");
    const replyContainer = existingReply.closest(".comment-reply");
    expect(existingReply).not.toBeNull();
    expect(screen.getByText("Second line in the same reply.")).not.toBeNull();
    const replyCards = screen.getAllByRole("article", { name: "Reply" });
    expect(replyCards).toHaveLength(2);
    expect(replyCards.every((card) => card.classList.contains("comment-reply")))
      .toBe(true);
    expect(replyCards.map((card) => getComputedStyle(card).marginTop))
      .toEqual(["0", "0"]);
    const humanReply = within(replyCards[0]);
    expect(within(replyCards[0]).queryByText("Reply")).toBeNull();
    expect(within(replyCards[1]).queryByText("Reply")).toBeNull();
    expect(within(replyCards[0]).queryByText("Bot")).toBeNull();
    expect(within(replyCards[1]).getByText("Bot")).not.toBeNull();
    expect(screen.getByText("Review requested")).not.toBeNull();
    expect(screen.getAllByText("Review requested")).toHaveLength(1);
    expect(screen.queryByText("Line 3")).toBeNull();
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Reply" })).toHaveLength(1);
    expect(getComputedStyle(replyContainer!).marginLeft).toBe(
      "var(--chakra-spacing-4)",
    );
    expect(getComputedStyle(replyContainer!).borderLeftWidth).toBe("3px");
    const newReplyButton = screen.getByRole("button", { name: "Reply" });
    expect(newReplyButton.textContent).toContain("Reply");
    fireEvent.click(newReplyButton);
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
        humanReply.getByRole("button", { name: "More actions for reply" })
          .hasAttribute(
            "disabled",
          ),
      ).toBe(false)
    );
    fireEvent.click(
      humanReply.getByRole("button", { name: "More actions for reply" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
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

    fireEvent.click(
      humanReply.getByRole("button", { name: "More actions for reply" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(onDeleteReply).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete reply?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onDeleteReply).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    fireEvent.click(
      humanReply.getByRole("button", { name: "More actions for reply" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
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
    const table = container.querySelector("table")!;
    const tableContainer = table.parentElement!;
    expect(getComputedStyle(table).width).toBe("max-content");
    expect(getComputedStyle(tableContainer).width).toBe("fit-content");
    expect(getComputedStyle(tableContainer).maxWidth).toBe("100%");
    expect(getComputedStyle(tableContainer).overflowX).toBe("auto");
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

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Resolve" }));
    await waitFor(() => expect(onResolveComment).toHaveBeenCalledWith(1));

    expect(await screen.findByText("Comment resolved")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(onReopenComment).toHaveBeenCalledWith(1));

    fireEvent.click(screen.getByRole("tab", { name: "Resolved (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Reopen" }));
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

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Resolve" }));

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

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Resolve" }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

    expect(await screen.findByText("Could not reopen comment")).not.toBeNull();
    expect(screen.getAllByText("Reopen rejected.").length).toBeGreaterThan(0);
  });
});
