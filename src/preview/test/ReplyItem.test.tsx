import {
  cleanup,
  createCommentReply,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommentReply } from "../models/comment";
import { ReplyItem } from "../components/comments/ReplyItem";
import { useCommentActionState } from "../components/comments/useCommentActionState";
import { toaster } from "../components/ui/toaster";

afterEach(() => {
  cleanup();
  toaster.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type ReplyItemHarnessProps = {
  onDelete?: (commentId: number, replyId: number) => Promise<void>;
  onUpdate?: (
    commentId: number,
    replyId: number,
    body: string,
  ) => Promise<void>;
  reply?: CommentReply;
};

const ReplyItemHarness = ({
  onDelete = async () => {},
  onUpdate = async () => {},
  reply = createCommentReply(),
}: ReplyItemHarnessProps) => {
  const { error, isPending, reportError, runAction } = useCommentActionState();
  return (
    <>
      <ReplyItem
        commentId={5}
        disabled={isPending}
        onDelete={onDelete}
        onUpdate={onUpdate}
        reply={reply}
        reportError={reportError}
        runAction={runAction}
      />
      {error && <span>{error}</span>}
    </>
  );
};

const openReplyMenu = async () => {
  fireEvent.click(
    screen.getByRole("button", { name: "More actions for reply" }),
  );
  return await screen.findByRole("menu");
};

describe("ReplyItem", () => {
  it("renders an accessible reply card with safe Markdown and bot badges", () => {
    const { container } = render(
      <ReplyItemHarness
        reply={createCommentReply({
          author: { type: "bot" },
          body:
            "See [documentation](https://example.com).\n\n```ts\nconst answer = 42;\n```\n\n<script>alert(1)</script>",
          reviewRequested: true,
        })}
      />,
    );

    const card = screen.getByRole("article", { name: "Reply" });
    expect(card.classList).toContain("comment-reply");
    expect(within(card).queryByText("Reply")).toBeNull();
    expect(within(card).getByText("Bot")).not.toBeNull();
    expect(within(card).getByText("Review requested")).not.toBeNull();
    expect(
      within(card).getByRole("link", { name: "documentation" })
        .getAttribute("href"),
    ).toBe("https://example.com");
    expect(container.querySelector("code.hljs.language-ts")?.textContent)
      .toContain("const answer = 42;");
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(getComputedStyle(card).marginLeft).toBe("var(--chakra-spacing-4)");
    expect(getComputedStyle(card).borderLeftWidth).toBe("3px");
  });

  it("edits a reply with focus, shortcuts, and shared pending state", async () => {
    let finishUpdate!: () => void;
    const onUpdate = vi.fn(() =>
      new Promise<void>((resolve) => {
        finishUpdate = resolve;
      })
    );
    render(
      <ReplyItemHarness
        onUpdate={onUpdate}
        reply={createCommentReply({ body: "Original reply.", id: 8 })}
      />,
    );

    await openReplyMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    const textbox = screen.getByRole("textbox", { name: "Edit reply body" });
    expect(document.activeElement).toBe(textbox);
    fireEvent.change(textbox, { target: { value: "Discarded reply." } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel reply edit" }));
    expect(screen.getByText("Original reply.")).not.toBeNull();

    await openReplyMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit reply body" }), {
      target: { value: "  Updated reply.  " },
    });
    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Edit reply body" }),
      { ctrlKey: true, key: "Enter" },
    );
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(5, 8, "Updated reply.")
    );
    expect(
      screen.getByRole("button", { name: "Save reply" }).hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    finishUpdate();
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Edit reply body" }))
        .toBeNull()
    );
  });

  it("deletes a reply only after confirmation", async () => {
    const onDelete = vi.fn(async () => {});
    render(
      <ReplyItemHarness
        onDelete={onDelete}
        reply={createCommentReply({ id: 8 })}
      />,
    );

    await openReplyMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete reply?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    await openReplyMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Delete reply?",
        }),
      ).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(5, 8));
  });

  it("copies reply bodies and reports clipboard failures", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(
      <ReplyItemHarness
        reply={createCommentReply({ body: "**Reply** body." })}
      />,
    );

    const copyButton = screen.getByRole("button", { name: "Copy reply" });
    expect(copyButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(copyButton.textContent).toBe("");
    fireEvent.click(copyButton);
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("**Reply** body.")
    );
    expect(await screen.findByText("Reply copied")).not.toBeNull();

    writeText.mockRejectedValueOnce(new Error("Clipboard unavailable."));
    fireEvent.click(copyButton);
    expect(await screen.findByText("Comment action failed")).not.toBeNull();
    expect(screen.getAllByText("Clipboard unavailable.").length)
      .toBeGreaterThan(0);
  });

  it("keeps the editor open and reports update failures", async () => {
    const onUpdate = vi.fn(async () => {
      throw new Error("Update rejected.");
    });
    render(<ReplyItemHarness onUpdate={onUpdate} />);

    await openReplyMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit reply body" }), {
      target: { value: "Updated reply." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reply" }));

    expect(await screen.findByText("Comment action failed")).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "Edit reply body" }))
      .not.toBeNull();
    expect(screen.getAllByText("Update rejected.").length).toBeGreaterThan(0);
  });
});
