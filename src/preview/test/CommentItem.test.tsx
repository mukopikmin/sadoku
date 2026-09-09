import {
  cleanup,
  createComment,
  createCommentActions,
  createCommentReply,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentItem } from "../components/comments/CommentItem";
import { toaster } from "../components/ui/toaster";

afterEach(() => {
  cleanup();
  toaster.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const openCommentMenu = async () => {
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  return await screen.findByRole("menu");
};

describe("CommentItem", () => {
  it("renders suggested edits without an apply action", () => {
    render(
      <CommentItem
        actions={createCommentActions()}
        comment={createComment({
          body: "```suggestion\nRevised **Markdown**\n```",
        })}
        lineLabel="Line 3"
      />,
    );

    expect(screen.getByText("Suggested change")).not.toBeNull();
    expect(screen.getByText("Revised **Markdown**")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /apply/i })).toBeNull();
  });

  it("renders comment and source Markdown safely with thread metadata", () => {
    const { container } = render(
      <CommentItem
        actions={createCommentActions()}
        comment={createComment({
          author: { type: "bot" },
          body:
            "**Comment**\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>",
          sourceText: [
            "# Source heading",
            "",
            "[Safe link](https://example.com)",
            "",
            "<script>window.sourceTextExecuted = true</script>",
          ].join("\n"),
          state: "stale",
        })}
        lineLabel="Originally line 3"
        showSource
        showState
        variant="panel"
      />,
    );

    const target = container.querySelector(".comment-source-target")!;
    const sourceMarkdown = target.querySelector(".comment-source-markdown")!;
    const rootThread = container.querySelector(".comment-root-thread")!;
    expect(target.tagName).toBe("SECTION");
    expect(within(target).getByText("Original line")).not.toBeNull();
    expect(
      within(sourceMarkdown).getByRole("heading", {
        name: "Source heading",
      }),
    ).not.toBeNull();
    expect(
      within(sourceMarkdown).getByRole("link", { name: "Safe link" })
        .getAttribute("href"),
    ).toBe("https://example.com");
    expect(sourceMarkdown.querySelector("script")).toBeNull();
    expect(sourceMarkdown.textContent).toContain(
      "<script>window.sourceTextExecuted = true</script>",
    );
    expect(target.contains(screen.getByText("Comment"))).toBe(false);
    expect(screen.getByText("Comment").tagName).toBe("STRONG");
    expect(container.querySelector("table td")?.textContent).toBe("1");
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(screen.getByText("Bot")).not.toBeNull();
    expect(screen.getByText("Stale")).not.toBeNull();
    expect(target.nextElementSibling).toBe(rootThread);
    expect(getComputedStyle(rootThread).borderLeftWidth).toBe("3px");
  });

  it("expands overflowing source previews independently", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockImplementation(function () {
        return this.classList.contains("comment-source-markdown") ? 320 : 0;
      });
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockImplementation(function () {
        return this.classList.contains("comment-source-markdown") ? 160 : 0;
      });

    render(
      <>
        <CommentItem
          actions={createCommentActions()}
          comment={createComment({ id: 1, sourceText: "First long source" })}
          lineLabel="Line 3"
          showSource
        />
        <CommentItem
          actions={createCommentActions()}
          comment={createComment({ id: 2, sourceText: "Second long source" })}
          lineLabel="Line 3"
          showSource
        />
      </>,
    );

    const expandButtons = screen.getAllByRole("button", {
      name: "Show full source",
    });
    expect(expandButtons).toHaveLength(2);
    fireEvent.click(expandButtons[0]);
    expect(
      screen.getByRole("button", { name: "Collapse source" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(screen.getAllByRole("button", { name: "Show full source" }))
      .toHaveLength(1);
  });

  it("edits a comment with focus and keyboard submission", async () => {
    const onUpdateComment = vi.fn(async () => {});
    render(
      <CommentItem
        actions={createCommentActions({ onUpdateComment })}
        comment={createComment({ body: "Original body." })}
        lineLabel="Line 3"
      />,
    );

    const menuButton = screen.getByRole("button", { name: "More actions" });
    menuButton.focus();
    fireEvent.keyDown(menuButton, { key: "Enter" });
    expect(await screen.findByText("Line 3")).not.toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Discarded body." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Original body.")).not.toBeNull();

    await openCommentMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Updated body.  " },
    });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      ctrlKey: true,
      key: "Enter",
    });
    await waitFor(() =>
      expect(onUpdateComment).toHaveBeenCalledWith(1, "Updated body.")
    );
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  });

  it("deletes a comment only after confirmation", async () => {
    const onDeleteComment = vi.fn(async () => {});
    render(
      <CommentItem
        actions={createCommentActions({ onDeleteComment })}
        comment={createComment()}
        lineLabel="Line 3"
      />,
    );

    await openCommentMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete comment?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onDeleteComment).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    await openCommentMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Delete comment?",
        }),
      ).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => expect(onDeleteComment).toHaveBeenCalledWith(1));
  });

  it("composes replies and disables the whole thread while saving", async () => {
    let finishReply!: () => void;
    const onReplyComment = vi.fn(() =>
      new Promise<void>((resolve) => {
        finishReply = resolve;
      })
    );
    render(
      <CommentItem
        actions={createCommentActions({ onReplyComment })}
        comment={createComment({ replies: [createCommentReply()] })}
        lineLabel="Line 3"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    const textbox = screen.getByRole("textbox", { name: "Reply body" });
    expect(document.activeElement).toBe(textbox);
    fireEvent.change(textbox, { target: { value: "  New reply.  " } });
    fireEvent.keyDown(textbox, { key: "Enter", metaKey: true });
    await waitFor(() =>
      expect(onReplyComment).toHaveBeenCalledWith(1, "New reply.")
    );

    expect(
      screen.getByRole("button", { name: "Copy comment" }).hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    expect(
      screen.getByRole("button", {
        name: "More actions for reply",
      }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Add reply" }).hasAttribute(
        "disabled",
      ),
    ).toBe(true);

    finishReply();
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Reply body" })).toBeNull()
    );
    expect(
      screen.getByRole("button", { name: "Reply" }).hasAttribute(
        "disabled",
      ),
    ).toBe(false);
  });

  it("copies comments and reports clipboard failures", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(
      <CommentItem
        actions={createCommentActions()}
        comment={createComment({ body: "**Comment** body." })}
        lineLabel="Line 3"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy comment" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("**Comment** body.")
    );
    expect(await screen.findByText("Comment copied")).not.toBeNull();

    writeText.mockRejectedValueOnce(new Error("Clipboard unavailable."));
    fireEvent.click(screen.getByRole("button", { name: "Copy comment" }));
    expect(await screen.findByText("Could not copy comment")).not.toBeNull();
    expect(screen.getAllByText("Clipboard unavailable.").length)
      .toBeGreaterThan(0);
  });

  it("resolves, reopens, and undoes resolution", async () => {
    const onReopenComment = vi.fn(async () => {});
    const onResolveComment = vi.fn(async () => {});
    const actions = createCommentActions({
      onReopenComment,
      onResolveComment,
    });
    const { rerender } = render(
      <CommentItem
        actions={actions}
        comment={createComment()}
        lineLabel="Line 3"
      />,
    );

    await openCommentMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Resolve" }));
    await waitFor(() => expect(onResolveComment).toHaveBeenCalledWith(1));
    expect(await screen.findByText("Comment resolved")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(onReopenComment).toHaveBeenCalledWith(1));

    rerender(
      <CommentItem
        actions={actions}
        comment={createComment({ state: "resolved" })}
        lineLabel="Line 3"
      />,
    );
    await openCommentMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Reopen" }));
    await waitFor(() => expect(onReopenComment).toHaveBeenCalledTimes(2));
  });

  it("keeps editors open and shows errors when actions fail", async () => {
    const onResolveComment = vi.fn(async () => {
      throw new Error("Server unavailable.");
    });
    const onUpdateComment = vi.fn(async () => {
      throw new Error("Update rejected.");
    });
    render(
      <CommentItem
        actions={createCommentActions({
          onResolveComment,
          onUpdateComment,
        })}
        comment={createComment()}
        lineLabel="Line 3"
      />,
    );

    await openCommentMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Resolve" }));
    expect(await screen.findByText("Could not resolve comment")).not.toBeNull();
    expect(screen.getAllByText("Server unavailable.").length)
      .toBeGreaterThan(0);
    expect(screen.queryByText("Comment resolved")).toBeNull();

    await openCommentMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated body." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Could not update comment")).not.toBeNull();
    expect(screen.getByRole("textbox")).not.toBeNull();
    expect(screen.getAllByText("Update rejected.").length).toBeGreaterThan(0);
  });

  it("reports a failed resolution undo", async () => {
    const onReopenComment = vi.fn(async () => {
      throw new Error("Reopen rejected.");
    });
    render(
      <CommentItem
        actions={createCommentActions({ onReopenComment })}
        comment={createComment()}
        lineLabel="Line 3"
      />,
    );

    await openCommentMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Resolve" }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Could not reopen comment")).not.toBeNull();
    expect(screen.getAllByText("Reopen rejected.").length).toBeGreaterThan(0);
  });
});
